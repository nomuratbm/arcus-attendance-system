import { NextRequest, NextResponse } from "next/server";
import { registerMember } from "@/lib/dynamodb/members";
import { getOrganization } from "@/lib/dynamodb/organizations";
import { parseMemberRegistrationInput } from "@/lib/member-registration";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseMemberRegistrationInput(body);

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

    const {
      fullName,
      studentId,
      course,
      department,
      organizationId,
    } = parsed.value;
    const selectedOrganization = organizationId
      ? await getOrganization(organizationId)
      : null;

    if (organizationId && !selectedOrganization) {
      return NextResponse.json(
        { error: "Invalid organization" },
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

    const result = await registerMember(
      {
        full_name: fullName,
        student_id: studentId,
        course,
        department,
        current_organization: organizationId,
      },
      organizationId,
    );

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        student_id: studentId,
        organization: selectedOrganization,
        current_organization: organizationId,
      },
      { status: result.status === "created" ? 201 : 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/forms:", error);
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 }
    );
  }
}
