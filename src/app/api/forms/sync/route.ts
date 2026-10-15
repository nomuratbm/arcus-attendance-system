import { NextRequest, NextResponse } from "next/server";
import { verifySessionApi } from "@/lib/auth/session";
import { getStudent } from "@/lib/dynamodb/students";
import { syncStudentId } from "@/lib/student-id-sync";
import { validateStudentNumber } from "@/lib/student-validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await verifySessionApi();
  if (identity.status !== "ok") {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studentId = typeof body === "object" && body !== null && "student_id" in body && typeof body.student_id === "string"
    ? body.student_id.trim()
    : "";
  const validNumber = validateStudentNumber(studentId);
  if (!validNumber.ok) {
    return NextResponse.json({ error: validNumber.message }, { status: 400 });
  }

  if (identity.studentId && identity.studentId !== studentId) {
    return NextResponse.json(
      { error: "Your account is already linked to another student number. Contact an administrator." },
      { status: 409 },
    );
  }

  if (!process.env.DYNAMODB_TABLE_NAME) {
    return NextResponse.json(
      { error: "Server configuration error: missing table configuration" },
      { status: 500 },
    );
  }

  if (!(await getStudent(studentId))) {
    return NextResponse.json(
      { error: "No student record exists for this number." },
      { status: 404 },
    );
  }

  const sync = await syncStudentId(identity, studentId);
  if (sync === "skipped") {
    return NextResponse.json(
      { error: "Account sync is not configured. Contact an administrator." },
      { status: 503 },
    );
  }
  if (sync === "failed") {
    return NextResponse.json(
      { error: "The account sync could not be queued. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Account sync queued. Sign out and sign in again to load your QR code.",
  });
}
