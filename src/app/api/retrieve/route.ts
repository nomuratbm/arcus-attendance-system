import { NextRequest, NextResponse } from "next/server";
import {
  getMember,
  getMemberOrganizations,
} from "@/lib/dynamodb/members";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

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

    if (studentId.length > MAX_STUDENT_NUMBER_LENGTH) {
      return NextResponse.json(
        {
          registered: false,
          error: `Student number cannot exceed ${MAX_STUDENT_NUMBER_LENGTH} characters`,
        },
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

    const organizations = await getMemberOrganizations(studentId);

    return NextResponse.json(
      {
        registered: true,
        organization_ids: organizations.map(
          (organization) => organization.value,
        ),
        organizations,
        current_organization: member.current_organization,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/retrieve:", error);
    return NextResponse.json(
      { error: "Failed to check registration" },
      { status: 500 },
    );
  }
}
