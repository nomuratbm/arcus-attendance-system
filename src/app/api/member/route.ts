import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import {
  addMemberOrganizations,
  getMember,
  MAX_MEMBER_ORGANIZATIONS,
  updateMemberCurrentOrganization,
} from "@/lib/dynamodb/members";

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

    const member = await getMember(studentId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not registered in the system", valid: false },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        member,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error querying DynamoDB for member:", error);
    return NextResponse.json(
      { error: "Failed to connect to DynamoDB database" },
      { status: 500 }
    );
  }
}

function readStudentId(body: unknown): string {
  return typeof body === "object" &&
    body !== null &&
    "student_id" in body &&
    typeof body.student_id === "string"
    ? body.student_id.trim()
    : "";
}

function readAddOrganizationIds(body: unknown): string[] | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("add_organization_ids" in body)
  ) {
    return null;
  }

  if (!Array.isArray(body.add_organization_ids)) {
    return [];
  }

  return Array.from(
    new Set(
      body.add_organization_ids
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const studentId = readStudentId(body);
    const addOrganizationIds = readAddOrganizationIds(body);
    const hasOrganizationId =
      typeof body === "object" &&
      body !== null &&
      "organization_id" in body;
    const rawOrganizationId =
      hasOrganizationId &&
      typeof body === "object" &&
      body !== null &&
      "organization_id" in body
        ? body.organization_id
        : undefined;
    const organizationId =
      typeof rawOrganizationId === "string"
        ? rawOrganizationId.trim()
        : rawOrganizationId === null
          ? ""
          : null;

    if (!studentId || (addOrganizationIds === null && organizationId === null)) {
      return NextResponse.json(
        { error: "Invalid student or organization" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    if (addOrganizationIds !== null) {
      if (addOrganizationIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one organization to add" },
          { status: 400 },
        );
      }

      const addResult = await addMemberOrganizations(
        studentId,
        addOrganizationIds,
      );

      if (addResult.status === "member-not-found") {
        return NextResponse.json(
          { error: "Member not registered in the system" },
          { status: 404 },
        );
      }

      if (addResult.status === "invalid-organizations") {
        return NextResponse.json(
          { error: "One or more organizations are not in the registry" },
          { status: 400 },
        );
      }

      if (addResult.status === "limit-exceeded") {
        return NextResponse.json(
          {
            error: `A member cannot select more than ${MAX_MEMBER_ORGANIZATIONS} organizations`,
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { success: true, organizations: addResult.organizations },
        { status: 200 },
      );
    }

    const result = await updateMemberCurrentOrganization(
      studentId,
      organizationId ?? "",
    );

    if (result.status === "member-not-found") {
      return NextResponse.json(
        { error: "Member not registered in the system" },
        { status: 404 },
      );
    }

    if (result.status === "not-member") {
      return NextResponse.json(
        { error: "Member does not belong to this organization" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: true, current_organization: organizationId },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating member organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 },
    );
  }
}
