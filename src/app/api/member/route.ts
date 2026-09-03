import { NextRequest, NextResponse } from "next/server";
import { getMember } from "@/lib/dynamodb/members";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const uuid = request.nextUrl.searchParams.get("uuid")?.trim();

    if (!uuid) {
      return NextResponse.json(
        { error: "Invalid QR code: missing UUID parameter" },
        { status: 400 }
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      console.error("DYNAMODB_TABLE_NAME environment variable is not defined");
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    const member = await getMember(uuid);

    if (!member) {
      return NextResponse.json(
        { error: "Member not registered in the system", valid: false },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        member,
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
