import { NextResponse } from "next/server";
import { fetchPublishedEvents } from "@/lib/apex/client";
import { requireAdminApiWithIdentity } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Scanner event source. Org scope comes from the verified Cognito token (not a
 * client-supplied param): an org_submitter only ever sees their own org's open
 * events, while an admin (no custom:organization_id claim) sees every org.
 * Each mapua-apex event is mapped into the shape the existing events store and
 * parseAttendanceEvent() already understand, so QRScanner / check-ins are
 * untouched — the scanner key stays `EVENT#<event_id>`.
 */
export async function GET() {
  const { unauthorized, organizationId } = await requireAdminApiWithIdentity();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const published = await fetchPublishedEvents({
      organizationId,
      window: "attendance",
    });

    const events = published.map((event) => {
      const pk = `EVENT#${event.event_id}`;
      return {
        PK: pk,
        SK: pk,
        name: event.title?.trim() || event.event_id,
        description: [
          event.organization_name,
          event.date_of_event,
          event.venue,
        ]
          .filter((part): part is string => Boolean(part))
          .join(" • "),
        GSI1SK: String(Date.now()),
        GSI3SK: event.organization_id
          ? `ORGANIZATION#${event.organization_id}`
          : "",
        organization_name: event.organization_name ?? "",
      };
    });

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/apex/events:", error);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }
}