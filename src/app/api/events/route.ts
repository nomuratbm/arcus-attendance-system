import { NextRequest, NextResponse } from "next/server";
import {
  organizationScopeError,
  rejectForeignOrganization,
} from "@/lib/auth/organization-scope";
import { requireAdminUser } from "@/lib/auth/session";
import { createEvent, getEvents } from "@/lib/dynamodb/events";
import { getOrganization } from "@/lib/dynamodb/organizations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAdminUser();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const missingOrganization = organizationScopeError(user);
    if (missingOrganization) {
      return missingOrganization;
    }

    const requestedOrganization =
      request.nextUrl.searchParams.get("organization")?.trim() ?? "";
    const organization = user.isSuperAdmin
      ? requestedOrganization
      : (user.organizationId ?? "");

    if (organization && !(await getOrganization(organization))) {
      return NextResponse.json(
        { error: "Invalid organization" },
        { status: 400 },
      );
    }

    const events = await getEvents(organization || undefined);
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/events:", error);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdminUser();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const requestedOrganization =
      typeof body.organization === "string" ? body.organization.trim() : "";
    const missingOrganization = organizationScopeError(user);
    if (missingOrganization) {
      return missingOrganization;
    }

    const denied = user.isSuperAdmin
      ? null
      : rejectForeignOrganization(user, requestedOrganization);
    if (denied) {
      return denied;
    }

    const organization = user.isSuperAdmin
      ? requestedOrganization
      : (user.organizationId ?? "");

    if (!name || !description || !organization) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!(await getOrganization(organization))) {
      return NextResponse.json(
        { error: "Invalid organization" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const event = await createEvent(name, description, organization);

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/events:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 },
    );
  }
}
