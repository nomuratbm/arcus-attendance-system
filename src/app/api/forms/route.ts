import { NextRequest, NextResponse } from "next/server";
import {
  createMember,
  MAX_MEMBER_ORGANIZATIONS,
} from "@/lib/dynamodb/members";
import { getOrganizations } from "@/lib/dynamodb/organizations";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, student_id, course, department, organization_ids } =
      body as {
      full_name: string;
      student_id: string;
      course: string;
      department: string;
      organization_ids: unknown;
    };

    const normalizedStudentId =
      typeof student_id === "string" ? student_id.trim() : "";

    if (normalizedStudentId.length > MAX_STUDENT_NUMBER_LENGTH) {
      return NextResponse.json(
        {
          error: `Student number cannot exceed ${MAX_STUDENT_NUMBER_LENGTH} characters`,
        },
        { status: 400 },
      );
    }

    const requestedOrganizationIds = Array.isArray(organization_ids)
      ? Array.from(
          new Set(
            organization_ids
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        )
      : [];
    const hasOnlyStringIds =
      Array.isArray(organization_ids) &&
      requestedOrganizationIds.length === organization_ids.length;
    const selectedOrganizations = hasOnlyStringIds
      ? await getOrganizations(requestedOrganizationIds)
      : [];
    const organizationIds = selectedOrganizations.map(
      (organization) => organization.value,
    );

    if (
      !full_name ||
      !normalizedStudentId ||
      !course ||
      !department ||
      organizationIds.length > MAX_MEMBER_ORGANIZATIONS ||
      organizationIds.length !== requestedOrganizationIds.length
    ) {
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
      current_organization: organizationIds[0] ?? "",
    }, organizationIds);

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
        organization_ids: organizationIds,
        organizations: selectedOrganizations,
        current_organization: organizationIds[0] ?? "",
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
