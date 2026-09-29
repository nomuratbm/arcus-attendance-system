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
  userItemKey,
} from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";

export type { Member };

export const MAX_MEMBER_ORGANIZATIONS = 99;

export type RegisterMemberResult =
  | { member: Member; status: "created" | "linked" }
  | { reason: "account" | "student-number"; status: "already-linked" };

export async function registerMemberForUser(input: {
  cognitoSub: string;
  course: string;
  department: string;
  fullName: string;
  studentId: string;
}): Promise<RegisterMemberResult> {
  const cognitoSub = input.cognitoSub.trim();
  const studentId = input.studentId.trim();
  const linked = await getMemberForUser(cognitoSub);

  if (linked) {
    if (linked.student_id === studentId) {
      return { member: linked, status: "linked" };
    }

    return { reason: "account", status: "already-linked" };
  }

  const existing = await getMember(studentId);
  if (existing?.cognito_sub && existing.cognito_sub !== cognitoSub) {
    return { reason: "student-number", status: "already-linked" };
  }

  if (existing?.cognito_sub === cognitoSub) {
    return { member: existing, status: "linked" };
  }

  if (existing) {
    return claimExistingMember(existing, cognitoSub);
  }

  return createLinkedMember({
    cognitoSub,
    course: input.course.trim(),
    department: input.department.trim(),
    fullName: input.fullName.trim(),
    studentId,
  });
}

async function createLinkedMember(input: {
  cognitoSub: string;
  course: string;
  department: string;
  fullName: string;
  studentId: string;
}): Promise<RegisterMemberResult> {
  const memberKey = memberItemKey(input.studentId);
  const userKey = userItemKey(input.cognitoSub);

  try {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: memberKey,
                SK: memberKey,
                full_name: input.fullName,
                student_id: input.studentId,
                course: input.course,
                department: input.department,
                current_organization: "",
                cognito_sub: input.cognitoSub,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: userKey,
                SK: userKey,
                cognito_sub: input.cognitoSub,
                student_id: input.studentId,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  } catch (error: unknown) {
    if (!isTransactionCanceled(error)) {
      throw error;
    }

    const existing = await getMember(input.studentId);
    if (existing && !existing.cognito_sub) {
      return claimExistingMember(existing, input.cognitoSub);
    }

    return classifyRegistrationConflict(input.cognitoSub, input.studentId);
  }

  const member = await getMember(input.studentId);
  if (!member) {
    throw new Error("Member was created but could not be read");
  }

  return { member, status: "created" };
}

async function claimExistingMember(
  member: Member,
  cognitoSub: string,
): Promise<RegisterMemberResult> {
  const userKey = userItemKey(cognitoSub);

  try {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName(),
              Key: {
                PK: member.PK,
                SK: member.SK,
              },
              UpdateExpression: "SET cognito_sub = :sub",
              ConditionExpression:
                "attribute_exists(PK) AND (attribute_not_exists(cognito_sub) OR cognito_sub = :empty)",
              ExpressionAttributeValues: {
                ":empty": "",
                ":sub": cognitoSub,
              },
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: userKey,
                SK: userKey,
                cognito_sub: cognitoSub,
                student_id: member.student_id,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  } catch (error: unknown) {
    if (!isTransactionCanceled(error)) {
      throw error;
    }

    return classifyRegistrationConflict(cognitoSub, member.student_id);
  }

  return {
    member: { ...member, cognito_sub: cognitoSub },
    status: "linked",
  };
}

async function classifyRegistrationConflict(
  cognitoSub: string,
  studentId: string,
): Promise<RegisterMemberResult> {
  const linked = await getMemberForUser(cognitoSub);
  if (linked?.student_id === studentId) {
    return { member: linked, status: "linked" };
  }

  if (linked) {
    return { reason: "account", status: "already-linked" };
  }

  const existing = await getMember(studentId);
  if (existing?.cognito_sub === cognitoSub) {
    return { member: existing, status: "linked" };
  }

  if (existing?.cognito_sub) {
    return { reason: "student-number", status: "already-linked" };
  }

  throw new Error("Member registration conflict could not be resolved");
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

export async function getMemberForUser(
  cognitoSub: string,
): Promise<Member | null> {
  const sub = cognitoSub.trim();
  if (!sub) {
    return null;
  }

  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: userItemKey(sub),
        SK: userItemKey(sub),
      },
      ProjectionExpression: "student_id",
    }),
  );
  const studentId =
    typeof result.Item?.student_id === "string"
      ? result.Item.student_id.trim()
      : "";
  if (!studentId) {
    return null;
  }

  const member = await getMember(studentId);
  if (!member || (member.cognito_sub && member.cognito_sub !== sub)) {
    return null;
  }

  return member;
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
  | { status: "organization-not-found" }
  | { status: "member-not-found" }
  | { status: "updated" };

export async function updateMemberCurrentOrganization(
  studentId: string,
  organizationId: string,
): Promise<UpdateCurrentOrganizationResult> {
  const member = await getMember(studentId);
  if (!member) {
    return { status: "member-not-found" };
  }

  if (organizationId) {
    const organization = await getOrganization(organizationId);
    if (!organization) {
      return { status: "organization-not-found" };
    }
  }

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
          ":organization": organizationId,
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
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
    cognito_sub: typeof item.cognito_sub === "string" ? item.cognito_sub : "",
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
