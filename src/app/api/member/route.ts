import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(request: NextRequest) {
  try {
    const uuid = request.nextUrl.searchParams.get("uuid");

    // validate QR code extraction result
    if (!uuid) {
      return NextResponse.json(
        { error: "Invalid QR code: missing UUID parameter" },
        { status: 400 }
      );
    }

    /* MOCK DATA (REMOVE ONLY WHEN HAVE ENV VARIABLES) */
    if (!process.env.DYNAMODB_TABLE_NAME || !process.env.AWS_ACCESS_KEY_ID) {
      console.warn("AWS env missing: Returning mock data for local testing.");

      if (uuid !== "001") {
        return NextResponse.json(
          { error: "Member not registered in the system", valid: false },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          valid: true,
          mock: true,
          member: {
            uuid: "001",
            fullName: "Juan Dela Cruz",
            studentId: "2030123456",
            email: "juan.delacruz@mapua.edu.ph",
            course: "BS Computer Science",
            yearLevel: "3rd Year",
          },
        },
        { status: 200 }
      );
    }
    /* END OF MOCK DATA (remove once have aws env variables) */

    // validate Server AWS Config
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      console.error("DYNAMODB_TABLE_NAME environment variable is not defined");
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    // query DynamoDB using UUID as Partition Key
    const response = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { uuid },
      })
    );

    // if unregistered/invalid member uuid
    if (!response.Item) {
      return NextResponse.json(
        { error: "Member not registered in the system", valid: false },
        { status: 404 }
      );
    }

    // return member record
    return NextResponse.json(
      {
        valid: true,
        member: response.Item,
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
