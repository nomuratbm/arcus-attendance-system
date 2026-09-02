import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { memberItemKey } from "@/store/dynamodb-keys";

export const dynamic = "force-dynamic";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(request: NextRequest) {
  try {
    // validate & trim QR code extraction result
    const uuid = request.nextUrl.searchParams.get("uuid")?.trim();

    if (!uuid) {
      return NextResponse.json(
        { error: "Invalid QR code: missing UUID parameter" },
        { status: 400 }
      );
    }

    // validate Server AWS Config
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      console.error("DYNAMODB_TABLE_NAME environment variable is not defined");
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    const pkValue = memberItemKey(uuid);

    // query DynamoDB by Partition Key
    let response = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": pkValue,
        },
      })
    );

    // fallback only if no match found, query using raw uuid
    if (!response.Items || response.Items.length === 0) {
      response = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": uuid,
          },
        })
      );
    }

    const memberItem = response.Items?.[0];

    // if unregistered/invalid member uuid
    if (!memberItem) {
      return NextResponse.json(
        { error: "Member not registered in the system", valid: false },
        { status: 404 }
      );
    }

    // return member record
    return NextResponse.json(
      {
        valid: true,
        member: memberItem,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error querying DynamoDB for member UUID:", error);
    return NextResponse.json(
      { error: "Failed to connect to DynamoDB database" },
      { status: 500 }
    );
  }
}
