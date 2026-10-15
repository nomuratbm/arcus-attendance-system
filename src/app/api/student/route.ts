import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { getStudent } from "@/lib/dynamodb/students";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const studentId = request.nextUrl.searchParams.get("student_id")?.trim();

    if (!studentId) {
      return NextResponse.json(
        { error: "Invalid QR code: missing student number" },
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

    const student = await getStudent(studentId);

    if (!student) {
      return NextResponse.json(
        { error: "Student not registered in the system", valid: false },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        student,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error querying DynamoDB for student:", error);
    return NextResponse.json(
      { error: "Failed to connect to DynamoDB database" },
      { status: 500 }
    );
  }
}
