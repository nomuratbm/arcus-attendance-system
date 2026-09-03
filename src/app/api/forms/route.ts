import { NextRequest, NextResponse } from "next/server";
import { createMember } from "@/lib/dynamodb/members";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, student_id, course, department } = body as {
      full_name: string;
      student_id: string;
      course: string;
      department: string;
    };

    const normalizedStudentId =
      typeof student_id === "string" ? student_id.trim() : "";

    if (!full_name || !normalizedStudentId || !course || !department) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    const result = await createMember({
      full_name,
      student_id: normalizedStudentId,
      course,
      department,
    });

    if (result.status === "already-exists") {
      return NextResponse.json(
        { error: "This student number is already registered" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        student_id: normalizedStudentId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/forms:", error);
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 }
    );
  }
}
