import { NextRequest, NextResponse } from "next/server";
import { registerStudent } from "@/lib/dynamodb/students";
import { parseStudentRegistrationInput } from "@/lib/student-registration";
import { verifySessionApi } from "@/lib/auth/session";
import { syncStudentId } from "@/lib/student-id-sync";
import { validateStudentNumber } from "@/lib/student-validation";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await verifySessionApi();
  if (identity.status !== "ok") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  try {
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
    const validNumber = validateStudentNumber(studentId);
    if (!validNumber.ok) return NextResponse.json({ error: validNumber.message }, { status: 400 });
    if (identity.studentId && identity.studentId !== studentId) return NextResponse.json({ error: "Your account is already linked to another student number. Contact an administrator." }, { status: 409 });

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

    await syncStudentId(identity, studentId);

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
