import { BatchGetCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import { memberItemKey } from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";

export type { Member };

export type MemberDetails = Omit<Member, "PK" | "SK">;

export async function createMember(
  uuid: string,
  details: MemberDetails,
): Promise<void> {
  const key = memberItemKey(uuid);

  await dynamodb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: key,
        SK: key,
        ...details,
      },
    }),
  );
}

export async function getMember(uuid: string): Promise<Member | null> {
  const trimmed = uuid.trim();
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

  return {
    PK: pk,
    SK: sk,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id: typeof item.student_id === "string" ? item.student_id : "",
    course: typeof item.course === "string" ? item.course : "",
    department: typeof item.department === "string" ? item.department : "",
  };
}
