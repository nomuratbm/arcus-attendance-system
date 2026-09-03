import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import { getMembers } from "@/lib/dynamodb/members";
import { eventItemKey, memberItemKey } from "@/store/dynamodb-keys";

export type CheckInResult =
  | { status: "created" }
  | { status: "already-checked-in" };

export type EventCheckIn = {
  PK: string;
  SK: string;
  full_name: string;
  student_id: string;
  course: string;
  department: string;
  scannedAt: string;
  timestamp: number;
};

export async function checkIn(
  eventId: string,
  uuid: string,
  attendance?: { scannedAt: string; timestamp: number },
): Promise<CheckInResult> {
  const eventPK = eventItemKey(eventId);
  const memberSK = memberItemKey(uuid);
  const now = new Date();
  const scannedAt =
    attendance?.scannedAt ??
    now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const timestamp = attendance?.timestamp ?? now.getTime();

  try {
    await dynamodb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: eventPK,
          SK: memberSK,
          scannedAt,
          timestamp,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );

    return { status: "created" };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "ConditionalCheckFailedException"
    ) {
      return { status: "already-checked-in" };
    }

    throw error;
  }
}

export async function listEventCheckIns(
  eventId: string,
): Promise<EventCheckIn[]> {
  const eventPK = eventItemKey(eventId);
  const checkIns = await queryEventCheckIns(eventPK);
  const members = await getMembers(
    checkIns.map((checkIn) => String(checkIn.SK ?? "")),
  );

  return checkIns.map((checkIn) => {
    const sk = String(checkIn.SK ?? "");
    const member = members.get(sk) ?? null;
    const timestamp =
      typeof checkIn.timestamp === "number"
        ? checkIn.timestamp
        : Number(checkIn.timestamp);

    return {
      PK: typeof checkIn.PK === "string" && checkIn.PK ? checkIn.PK : eventPK,
      SK: sk,
      full_name: member?.full_name ?? "",
      student_id: member?.student_id ?? "",
      course: member?.course ?? "",
      department: member?.department ?? "",
      scannedAt: String(checkIn.scannedAt ?? ""),
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  });
}

async function queryEventCheckIns(
  eventPK: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        ExpressionAttributeValues: {
          ":member": "MEMBER#",
          ":pk": eventPK,
        },
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :member)",
        TableName: tableName(),
      }),
    );

    if (result.Items) {
      items.push(...(result.Items as Record<string, unknown>[]));
    }

    exclusiveStartKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (exclusiveStartKey);

  return items;
}
