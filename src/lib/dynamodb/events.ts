import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  EVENT_GSI1PK,
  ORGANIZATION_GSI3PK,
  eventItemKey,
  organizationItemKey,
} from "@/store/dynamodb-keys";

export type EventItem = {
  PK: string;
  SK: string;
  GSI1PK: typeof EVENT_GSI1PK;
  GSI1SK: string;
  GSI3PK: typeof ORGANIZATION_GSI3PK;
  GSI3SK: string;
  name: string;
  description: string;
};

export async function createEvent(
  name: string,
  description: string,
  organizationId: string,
): Promise<EventItem> {
  const key = eventItemKey(crypto.randomUUID());
  const organizationKey = organizationItemKey(organizationId);
  const item: EventItem = {
    PK: key,
    SK: key,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: String(Date.now()),
    GSI3PK: ORGANIZATION_GSI3PK,
    GSI3SK: organizationKey,
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

export async function getEvent(eventId: string): Promise<EventItem | null> {
  const key = eventItemKey(eventId);
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
    ? eventItemFromRecord(result.Item as Record<string, unknown>)
    : null;
}

export async function getEvents(organizationId?: string): Promise<EventItem[]> {
  if (organizationId) {
    try {
      const organizationEvents = await queryEventsByOrganization(organizationId);
      return sortEventsByNewest(organizationEvents);
    } catch (error) {
      if (!isMissingIndex(error)) {
        throw error;
      }
    }
  }

  const events = await queryAllEvents();
  if (!organizationId) {
    return events;
  }

  const organizationKey = organizationItemKey(organizationId);
  return events.filter((event) => event.GSI3SK === organizationKey);
}

async function queryAllEvents(): Promise<EventItem[]> {
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

async function queryEventsByOrganization(
  organizationId: string,
): Promise<EventItem[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  const organizationKey = organizationItemKey(organizationId);

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        ExpressionAttributeValues: {
          ":gsi3pk": ORGANIZATION_GSI3PK,
          ":gsi3sk": organizationKey,
        },
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :gsi3pk AND GSI3SK = :gsi3sk",
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

function sortEventsByNewest(events: EventItem[]): EventItem[] {
  return [...events].sort((left, right) => {
    const rightTime = Number(right.GSI1SK);
    const leftTime = Number(left.GSI1SK);
    return (Number.isFinite(rightTime) ? rightTime : 0) -
      (Number.isFinite(leftTime) ? leftTime : 0);
  });
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
  const gsi3sk =
    typeof item.GSI3SK === "string" && item.GSI3SK
      ? item.GSI3SK.startsWith("ORGANIZATION#")
        ? item.GSI3SK
        : organizationItemKey(item.GSI3SK)
      : "";

  return {
    PK: pk,
    SK: typeof item.SK === "string" && item.SK ? item.SK : pk,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: gsi1sk,
    GSI3PK: ORGANIZATION_GSI3PK,
    GSI3SK: gsi3sk,
    name,
    description,
  };
}

function isMissingIndex(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }

  const name = (error as { name: string }).name;
  if (name === "ResourceNotFoundException") {
    return true;
  }

  if (name !== "ValidationException") {
    return false;
  }

  const message =
    "message" in error ? String((error as { message: unknown }).message) : "";
  return message.toLowerCase().includes("index");
}
