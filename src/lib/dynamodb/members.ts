import {
  BatchGetCommand,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import { listOrganizations } from "@/lib/dynamodb/organizations";
import { planMemberRegistration } from "@/lib/member-registration";
import type { OrganizationOption } from "@/lib/organizations";
import {
  memberItemKey,
  organizationIdFromKey,
  organizationItemKey,
  studentIdFromMemberKey,
} from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";

export type { Member };

export type MemberDetails = Omit<
  Member,
  "PK" | "SK" | "registration_version"
>;

export type RegisterMemberResult =
  | { status: "created" }
  | { status: "replaced" };

const MAX_TRANSACTION_ITEMS = 100;
const MAX_REGISTRATION_ATTEMPTS = 3;

export async function registerMember(
  details: MemberDetails,
  organizationId: string,
): Promise<RegisterMemberResult> {
  const studentId = details.student_id.trim();
  const key = memberItemKey(studentId);
  const selectedOrganizationId = organizationId.trim();

  for (let attempt = 0; attempt < MAX_REGISTRATION_ATTEMPTS; attempt += 1) {
    const existingMember = await getMember(studentId);
    const existingOrganizationIds = existingMember
      ? await getMemberOrganizationIds(studentId)
      : [];
    const plan = planMemberRegistration(
      existingMember?.registration_version ?? null,
      existingOrganizationIds,
      selectedOrganizationId,
    );

    const fixedItemCount = selectedOrganizationId ? 2 : 1;
    const transactionalStaleOrganizationIds =
      plan.staleOrganizationIds.slice(
        0,
        MAX_TRANSACTION_ITEMS - fixedItemCount,
      );
    const deferredStaleOrganizationIds =
      plan.staleOrganizationIds.slice(
        MAX_TRANSACTION_ITEMS - fixedItemCount,
      );
    const memberPut = {
      TableName: tableName(),
      Item: {
        PK: key,
        SK: key,
        ...details,
        student_id: studentId,
        current_organization: plan.currentOrganization,
        registration_version: plan.registrationVersion,
      },
      ...(existingMember
        ? existingMember.registration_version > 0
          ? {
              ConditionExpression:
                "attribute_exists(PK) AND #registrationVersion = :expectedVersion",
              ExpressionAttributeNames: {
                "#registrationVersion": "registration_version",
              },
              ExpressionAttributeValues: {
                ":expectedVersion": existingMember.registration_version,
              },
            }
          : {
              ConditionExpression:
                "attribute_exists(PK) AND attribute_not_exists(#registrationVersion)",
              ExpressionAttributeNames: {
                "#registrationVersion": "registration_version",
              },
            }
        : {
            ConditionExpression: "attribute_not_exists(PK)",
          }),
    };

    try {
      await dynamodb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: memberPut,
            },
            ...(selectedOrganizationId
              ? [
                  {
                    Put: {
                      TableName: tableName(),
                      Item: {
                        PK: organizationItemKey(selectedOrganizationId),
                        SK: key,
                        organization_id: selectedOrganizationId,
                        student_id: studentId,
                      },
                    },
                  },
                ]
              : []),
            ...transactionalStaleOrganizationIds.map(
              (staleOrganizationId) => ({
                Delete: {
                  TableName: tableName(),
                  Key: {
                    PK: organizationItemKey(staleOrganizationId),
                    SK: key,
                  },
                },
              }),
            ),
          ],
        }),
      );

      if (deferredStaleOrganizationIds.length > 0) {
        await deleteOrganizationMemberships(
          studentId,
          deferredStaleOrganizationIds,
          plan.registrationVersion,
        );
      }

      return { status: plan.status };
    } catch (error: unknown) {
      if (
        isTransactionCanceled(error) &&
        attempt + 1 < MAX_REGISTRATION_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not replace registration for student ${studentId} after concurrent updates`,
  );
}

async function deleteOrganizationMemberships(
  studentId: string,
  organizationIds: string[],
  registrationVersion: number,
): Promise<void> {
  const memberKey = memberItemKey(studentId);

  for (let offset = 0; offset < organizationIds.length; offset += 99) {
    try {
      await dynamodb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: tableName(),
                Key: { PK: memberKey, SK: memberKey },
                ConditionExpression:
                  "#registrationVersion = :registrationVersion",
                ExpressionAttributeNames: {
                  "#registrationVersion": "registration_version",
                },
                ExpressionAttributeValues: {
                  ":registrationVersion": registrationVersion,
                },
              },
            },
            ...organizationIds
              .slice(offset, offset + 99)
              .map((staleOrganizationId) => ({
                Delete: {
                  TableName: tableName(),
                  Key: {
                    PK: organizationItemKey(staleOrganizationId),
                    SK: memberKey,
                  },
                },
              })),
          ],
        }),
      );
    } catch (error: unknown) {
      if (isTransactionCanceled(error)) {
        return;
      }
      throw error;
    }
  }
}

export async function getMember(studentId: string): Promise<Member | null> {
  const trimmed = studentId.trim();
  if (!trimmed) {
    return null;
  }

  const keyed = memberItemKey(trimmed);
  const member = await getMemberByKey(keyed);
  if (member) {
    return member;
  }

  if (keyed !== trimmed) {
    return getMemberByKey(trimmed);
  }

  return null;
}

export async function getMemberOrganizationIds(
  studentId: string,
): Promise<string[]> {
  return (await getMemberOrganizations(studentId)).map(
    (organization) => organization.value,
  );
}

export async function getMemberOrganizations(
  studentId: string,
): Promise<OrganizationOption[]> {
  const memberKey = memberItemKey(studentId);
  const name = tableName();
  const found = new Set<string>();
  const organizations = await listOrganizations();
  for (let offset = 0; offset < organizations.length; offset += 100) {
    let keysToFetch = organizations
      .slice(offset, offset + 100)
      .map((organization) => ({
        PK: organizationItemKey(organization.value),
        SK: memberKey,
      }));

    while (keysToFetch.length > 0) {
      const result = await dynamodb.send(
        new BatchGetCommand({
          RequestItems: {
            [name]: {
              Keys: keysToFetch,
              ProjectionExpression: "PK, SK",
            },
          },
        }),
      );

      for (const item of result.Responses?.[name] ?? []) {
        if (typeof item.PK === "string") {
          found.add(organizationIdFromKey(item.PK));
        }
      }

      keysToFetch = (result.UnprocessedKeys?.[name]?.Keys ?? []) as {
        PK: string;
        SK: string;
      }[];
    }
  }

  return organizations.filter((organization) =>
    found.has(organization.value),
  );
}

export async function isMemberOfOrganization(
  studentId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: organizationItemKey(organizationId),
        SK: memberItemKey(studentId),
      },
      ProjectionExpression: "PK, SK",
    }),
  );
  return Boolean(result.Item);
}

export async function getMembers(
  memberKeys: string[],
): Promise<Map<string, Member>> {
  const members = new Map<string, Member>();
  const uniqueKeys = Array.from(
    new Set(
      memberKeys
        .map((key) => key.trim())
        .filter(Boolean)
        .map((key) => memberItemKey(key)),
    ),
  );

  if (uniqueKeys.length === 0) {
    return members;
  }

  const name = tableName();

  for (let offset = 0; offset < uniqueKeys.length; offset += 100) {
    let keysToFetch = uniqueKeys.slice(offset, offset + 100).map((key) => ({
      PK: key,
      SK: key,
    }));

    while (keysToFetch.length > 0) {
      const result = await dynamodb.send(
        new BatchGetCommand({
          RequestItems: {
            [name]: {
              Keys: keysToFetch,
            },
          },
        }),
      );

      for (const item of result.Responses?.[name] ?? []) {
        const member = memberFromRecord(item as Record<string, unknown>);
        if (member) {
          members.set(member.PK, member);
        }
      }

      keysToFetch = (result.UnprocessedKeys?.[name]?.Keys ?? []) as {
        PK: string;
        SK: string;
      }[];
    }
  }

  return members;
}

async function getMemberByKey(key: string): Promise<Member | null> {
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: key,
        SK: key,
      },
    }),
  );

  return result.Item
    ? memberFromRecord(result.Item as Record<string, unknown>)
    : null;
}

function memberFromRecord(item: Record<string, unknown>): Member | null {
  const pk = typeof item.PK === "string" ? item.PK : "";
  const sk = typeof item.SK === "string" && item.SK ? item.SK : pk;
  if (!pk) {
    return null;
  }

  const studentId =
    typeof item.student_id === "string" && item.student_id
      ? item.student_id
      : studentIdFromMemberKey(pk);

  return {
    PK: pk,
    SK: sk,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id: studentId,
    course: typeof item.course === "string" ? item.course : "",
    department: typeof item.department === "string" ? item.department : "",
    current_organization:
      typeof item.current_organization === "string"
        ? item.current_organization
        : "",
    registration_version:
      typeof item.registration_version === "number" &&
      Number.isInteger(item.registration_version) &&
      item.registration_version > 0
        ? item.registration_version
        : 0,
  };
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "TransactionCanceledException"
  );
}
