import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { createEvent, getEvents } from "@/lib/dynamodb/events";
import { getOrganization } from "@/lib/dynamodb/organizations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const organization =
      request.nextUrl.searchParams.get("organization")?.trim() ?? "";

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
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const organization =
      typeof body.organization === "string" ? body.organization.trim() : "";

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
