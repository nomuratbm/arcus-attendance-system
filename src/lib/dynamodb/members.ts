import {
  BatchGetCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  getOrganization,
  getOrganizations,
  listOrganizations,
} from "@/lib/dynamodb/organizations";
import type { OrganizationOption } from "@/lib/organizations";
import {
  memberItemKey,
  organizationIdFromKey,
  organizationItemKey,
  studentIdFromMemberKey,
} from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";

export type { Member };

export const MAX_MEMBER_ORGANIZATIONS = 99;

export type MemberDetails = Omit<Member, "PK" | "SK">;

export type CreateMemberResult =
  | { status: "created" }
  | { status: "already-exists" };

export async function createMember(
  details: MemberDetails,
  organizationIds: string[],
): Promise<CreateMemberResult> {
  const studentId = details.student_id.trim();
  const key = memberItemKey(studentId);
  const uniqueOrganizationIds = Array.from(
    new Set(organizationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueOrganizationIds.length > MAX_MEMBER_ORGANIZATIONS) {
    throw new Error(
      `A member cannot select more than ${MAX_MEMBER_ORGANIZATIONS} organizations`,
    );
  }

  try {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: key,
                SK: key,
                ...details,
                student_id: studentId,
                current_organization: "",
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          ...uniqueOrganizationIds.map((organizationId) => ({
            Put: {
              TableName: tableName(),
              Item: {
                PK: organizationItemKey(organizationId),
                SK: key,
                organization_id: organizationId,
                student_id: studentId,
              },
              ConditionExpression:
                "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          })),
        ],
      }),
    );

    return { status: "created" };
  } catch (error: unknown) {
    if (
      isConditionalCheckFailed(error) ||
      (isTransactionCanceled(error) && (await getMember(studentId)) !== null)
    ) {
      return { status: "already-exists" };
    }

    throw error;
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

export type AddMemberOrganizationsResult =
  | { status: "added"; organizations: OrganizationOption[] }
  | { status: "member-not-found" }
  | { status: "invalid-organizations" }
  | { status: "limit-exceeded" };

export async function addMemberOrganizations(
  studentId: string,
  organizationIds: string[],
): Promise<AddMemberOrganizationsResult> {
  const member = await getMember(studentId);
  if (!member) {
    return { status: "member-not-found" };
  }

  const requestedIds = Array.from(
    new Set(organizationIds.map((value) => value.trim()).filter(Boolean)),
  );
  if (requestedIds.length === 0) {
    return { status: "invalid-organizations" };
  }

  const selectedOrganizations = await getOrganizations(requestedIds);
  if (selectedOrganizations.length !== requestedIds.length) {
    return { status: "invalid-organizations" };
  }

  const existing = await getMemberOrganizations(studentId);
  const existingIds = new Set(existing.map((organization) => organization.value));
  const toAdd = selectedOrganizations.filter(
    (organization) => !existingIds.has(organization.value),
  );

  if (existing.length + toAdd.length > MAX_MEMBER_ORGANIZATIONS) {
    return { status: "limit-exceeded" };
  }

  if (toAdd.length === 0) {
    return { status: "added", organizations: existing };
  }

  const memberKey = memberItemKey(studentId);

  try {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: toAdd.map((organization) => ({
          Put: {
            TableName: tableName(),
            Item: {
              PK: organizationItemKey(organization.value),
              SK: memberKey,
              organization_id: organization.value,
              student_id: studentId.trim(),
            },
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        })),
      }),
    );
  } catch (error: unknown) {
    if (isTransactionCanceled(error)) {
      return {
        status: "added",
        organizations: await getMemberOrganizations(studentId),
      };
    }
    throw error;
  }

  return {
    status: "added",
    organizations: [...existing, ...toAdd],
  };
}

export type UpdateCurrentOrganizationResult =
  | { status: "updated" }
  | { status: "member-not-found" }
  | { status: "not-member" };

export async function updateMemberCurrentOrganization(
  studentId: string,
  organizationId: string,
): Promise<UpdateCurrentOrganizationResult> {
  const member = await getMember(studentId);
  if (!member) {
    return { status: "member-not-found" };
  }

  if (!organizationId) {
    try {
      await dynamodb.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: {
            PK: memberItemKey(studentId),
            SK: memberItemKey(studentId),
          },
          UpdateExpression: "SET current_organization = :organization",
          ExpressionAttributeValues: {
            ":organization": "",
          },
          ConditionExpression:
            "attribute_exists(PK) AND attribute_exists(SK)",
        }),
      );
      return { status: "updated" };
    } catch (error: unknown) {
      if (isConditionalCheckFailed(error)) {
        return { status: "member-not-found" };
      }
      throw error;
    }
  }

  const [organization, hasMembership] = await Promise.all([
    getOrganization(organizationId),
    isMemberOfOrganization(studentId, organizationId),
  ]);
  if (!organization || !hasMembership) {
    return { status: "not-member" };
  }

  try {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: {
                PK: organizationItemKey(organizationId),
                SK: memberItemKey(studentId),
              },
              ConditionExpression:
                "attribute_exists(PK) AND attribute_exists(SK)",
            },
          },
          {
            Update: {
              TableName: tableName(),
              Key: {
                PK: memberItemKey(studentId),
                SK: memberItemKey(studentId),
              },
              UpdateExpression: "SET current_organization = :organization",
              ExpressionAttributeValues: {
                ":organization": organizationId,
              },
              ConditionExpression:
                "attribute_exists(PK) AND attribute_exists(SK)",
            },
          },
        ],
      }),
    );

    return { status: "updated" };
  } catch (error: unknown) {
    if (isTransactionCanceled(error)) {
      return { status: "not-member" };
    }
    throw error;
  }
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
  };
}

function isConditionalCheckFailed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "ConditionalCheckFailedException"
  );
}

function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "TransactionCanceledException"
  );
}
