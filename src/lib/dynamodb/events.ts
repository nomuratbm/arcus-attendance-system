import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import { EVENT_GSI1PK, eventItemKey } from "@/store/dynamodb-keys";

export type EventItem = {
  PK: string;
  SK: string;
  GSI1PK: typeof EVENT_GSI1PK;
  GSI1SK: string;
  name: string;
  description: string;
};

export async function createEvent(
  name: string,
  description: string,
): Promise<EventItem> {
  const key = eventItemKey(crypto.randomUUID());
  const item: EventItem = {
    PK: key,
    SK: key,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: String(Date.now()),
    name,
    description,
  };

  await dynamodb.send(
    new PutCommand({
      TableName: tableName(),
      Item: item,
    }),
  );

  return item;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const key = eventItemKey(eventId);

  await dynamodb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: {
        PK: key,
        SK: key,
      },
    }),
  );
}

export async function getEvents(): Promise<EventItem[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        ExpressionAttributeValues: {
          ":gsi1pk": EVENT_GSI1PK,
        },
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ScanIndexForward: false,
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

  return items
    .map(eventItemFromRecord)
    .filter((item): item is EventItem => item !== null);
}

function eventItemFromRecord(item: Record<string, unknown>): EventItem | null {
  const pk = typeof item.PK === "string" ? item.PK : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const description =
    typeof item.description === "string" ? item.description : "";

  if (!pk.startsWith("EVENT#") || !name) {
    return null;
  }

  const gsi1sk =
    typeof item.GSI1SK === "string"
      ? item.GSI1SK
      : typeof item.GSI1SK === "number"
        ? String(item.GSI1SK)
        : "";

  return {
    PK: pk,
    SK: typeof item.SK === "string" && item.SK ? item.SK : pk,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: gsi1sk,
    name,
    description,
  };
}
