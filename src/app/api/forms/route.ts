import { NextRequest, NextResponse } from "next/server";
import { registerStudent } from "@/lib/dynamodb/students";
import { parseStudentRegistrationInput } from "@/lib/student-registration";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseStudentRegistrationInput(body);

    if (!parsed.ok && parsed.reason === "student-number-too-long") {
      return NextResponse.json(
        {
          error: `Student number cannot exceed ${MAX_STUDENT_NUMBER_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { fullName, studentId, course, department } = parsed.value;

    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    const result = await registerStudent({
      full_name: fullName,
      student_id: studentId,
      course,
      department,
    });

    if (result.status === "exists") {
      return NextResponse.json(
        {
          error:
            "This student number already has a QR code. Use Retrieve to get the existing code.",
          code: "existing-qr",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        student_id: studentId,
      },
      { status: result.status === "created" ? 201 : 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/forms:", error);
    return NextResponse.json(
      { error: "Failed to register student" },
      { status: 500 }
    );
  }
}
