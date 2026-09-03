import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const name = process.env.DYNAMODB_TABLE_NAME;
  if (!name) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not set");
  }
  return name;
}

export async function createProfile(uuid: string, details: Record<string, unknown>): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `MEMBER#${uuid}`,
        SK: `MEMBER#${uuid}`,
        ...details,
      },
    })
  );
}

export async function getProfile(uuid: string): Promise<Record<string, unknown> | null> {
  const result = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: {
        PK: `MEMBER#${uuid}`,
        SK: `MEMBER#${uuid}`,
      },
    })
  );
  return (result.Item as Record<string, unknown>) ?? null;
}

export async function checkInToEvent(eventId: string, uuid: string): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `EVENT#${eventId}`,
        SK: `MEMBER#${uuid}`,
        scannedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        timestamp: Date.now(),
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
}

export async function getEventCheckIns(eventId: string): Promise<Record<string, unknown>[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `EVENT#${eventId}`,
      },
    })
  );
  return (result.Items as Record<string, unknown>[]) ?? [];
}
