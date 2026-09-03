import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function tableName(): string {
  const name = process.env.DYNAMODB_TABLE_NAME;
  if (!name) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not set");
  }
  return name;
}
