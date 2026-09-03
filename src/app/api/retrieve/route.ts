import { NextRequest, NextResponse } from "next/server";
import { getMember } from "@/lib/dynamodb/members";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("student_id")?.trim();

    if (!studentId) {
      return NextResponse.json(
        { registered: false, error: "Missing student number" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const member = await getMember(studentId);

    if (!member) {
      return NextResponse.json(
        {
          registered: false,
          error: "This student number is not registered",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ registered: true }, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/retrieve:", error);
    return NextResponse.json(
      { error: "Failed to check registration" },
      { status: 500 },
    );
  }
}
