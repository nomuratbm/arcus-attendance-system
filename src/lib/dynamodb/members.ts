import { BatchGetCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  memberItemKey,
  studentIdFromMemberKey,
} from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";

export type { Member };

export type MemberDetails = Omit<Member, "PK" | "SK">;

export type CreateMemberResult =
  | { status: "created" }
  | { status: "already-exists" };

export async function createMember(
  details: MemberDetails,
): Promise<CreateMemberResult> {
  const studentId = details.student_id.trim();
  const key = memberItemKey(studentId);

  try {
    await dynamodb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: key,
          SK: key,
          ...details,
          student_id: studentId,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );

    return { status: "created" };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
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
