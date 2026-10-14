import { NextResponse } from "next/server";
import { listOrganizations } from "@/lib/dynamodb/organizations";

export const dynamic = "force-dynamic";

/**
 * Organization picker source. The registry is owned by mapua-apex (orgs are
 * created/edited in the apex admin); this route is read-only. Any signed-in
 * user may list orgs — the registration form on / needs the picker, and the
 * proxy already requires a session for /api/*.
 */
export async function GET() {
  try {
    const organizations = await listOrganizations();
    return NextResponse.json(
      { organizations },
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
  } catch (error) {
    console.error("Error listing organizations:", error);
    return NextResponse.json(
      { error: "Failed to load organizations" },
      { status: 500 },
    );
  }
}
