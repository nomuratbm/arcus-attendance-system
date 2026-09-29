import "server-only";

import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth/session";
import { getEvent } from "@/lib/dynamodb/events";
import { organizationIdFromKey } from "@/store/dynamodb-keys";

const UNASSIGNED_ADMIN =
  "This admin account is not assigned to an organization.";

export function organizationScopeError(
  user: SessionUser,
): NextResponse | null {
  if (user.isSuperAdmin || !user.isAdmin || user.organizationId) {
    return null;
  }

  return NextResponse.json({ error: UNASSIGNED_ADMIN }, { status: 403 });
}

export function rejectForeignOrganization(
  user: SessionUser,
  organizationId: string,
): NextResponse | null {
  const missing = organizationScopeError(user);
  if (missing) {
    return missing;
  }

  if (user.isSuperAdmin || user.organizationId === organizationId) {
    return null;
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function rejectForeignEvent(
  user: SessionUser,
  eventId: string,
): Promise<NextResponse | null> {
  const missing = organizationScopeError(user);
  if (missing) {
    return missing;
  }

  if (user.isSuperAdmin) {
    return null;
  }

  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return rejectForeignOrganization(
    user,
    organizationIdFromKey(event.GSI3SK),
  );
}
