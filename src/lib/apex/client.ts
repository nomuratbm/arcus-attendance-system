import "server-only";

export type ApexEventWindow = "attendance" | "evaluation";

export type ApexWindowInfo = {
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
};

export type ApexPublishedEvent = {
  event_id: string;
  submission_id: string;
  organization_id: string | null;
  organization_name: string | null;
  status: string | null;
  title: string | null;
  venue: string | null;
  date_of_event: string | null;
  day_of_event: string | null;
  time_of_event: string | null;
  finished_at: string | null;
  attendance: ApexWindowInfo;
  evaluation: ApexWindowInfo;
};

function apiBaseUrl(): string {
  const value = process.env.APEX_API_BASE_URL?.trim().replace(/\/$/, "");
  if (!value) {
    throw new Error("APEX_API_BASE_URL environment variable is not set");
  }
  return value;
}

function serviceToken(): string {
  const value = process.env.ARCUS_SERVICE_TOKEN?.trim();
  if (!value) {
    throw new Error("ARCUS_SERVICE_TOKEN environment variable is not set");
  }
  return value;
}

/**
 * Fetch published (approved/finished) events whose window is currently open,
 * straight from the mapua-apex backend. Server-side only: the shared service
 * token never reaches the browser. When `organizationId` is provided the
 * backend scopes the result to that org (used for org_submitter callers);
 * omit it for admins who should see every org.
 */
export async function fetchPublishedEvents(
  options: {
    organizationId?: string | null;
    window?: ApexEventWindow;
  } = {},
): Promise<ApexPublishedEvent[]> {
  const url = new URL(`${apiBaseUrl()}/arcus/events`);
  url.searchParams.set("window", options.window ?? "attendance");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Arcus-Service-Token": serviceToken(),
  };
  if (options.organizationId) {
    headers["X-Arcus-Organization-Id"] = options.organizationId;
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Apex events request failed (${response.status}): ${body}`,
    );
  }

  const payload = (await response.json()) as { data?: ApexPublishedEvent[] };
  return Array.isArray(payload.data) ? payload.data : [];
}