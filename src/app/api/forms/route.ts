import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/session";
import { registerMemberForUser } from "@/lib/dynamodb/members";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireUserApi();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const { full_name, student_id, course, department } = body as {
      full_name: string;
      student_id: string;
      course: string;
      department: string;
    };

    const normalizedFullName =
      typeof full_name === "string" ? full_name.trim() : "";
    const normalizedStudentId =
      typeof student_id === "string" ? student_id.trim() : "";
    const normalizedCourse = typeof course === "string" ? course.trim() : "";
    const normalizedDepartment =
      typeof department === "string" ? department.trim() : "";

    if (normalizedStudentId.length > MAX_STUDENT_NUMBER_LENGTH) {
      return NextResponse.json(
        {
          error: `Student number cannot exceed ${MAX_STUDENT_NUMBER_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    if (
      !normalizedFullName ||
      !normalizedStudentId ||
      !normalizedCourse ||
      !normalizedDepartment
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const result = await registerMemberForUser({
      cognitoSub: user.sub,
      fullName: normalizedFullName,
      studentId: normalizedStudentId,
      course: normalizedCourse,
      department: normalizedDepartment,
    });

    if (result.status === "already-linked") {
      return NextResponse.json(
        {
          error:
            result.reason === "account"
              ? "This account is already registered"
              : "This student number is already registered to another account",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        student_id: result.member.student_id,
        full_name: result.member.full_name,
        course: result.member.course,
        department: result.member.department,
        current_organization: result.member.current_organization,
      },
      { status: result.status === "created" ? 201 : 200 },
    );
  } catch (error) {
    console.error("Error in POST /api/forms:", error);
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 },
    );
  }
}
