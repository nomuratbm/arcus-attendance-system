import { NextRequest, NextResponse } from "next/server";
import { listEventCheckIns } from "@/lib/dynamodb/attendance";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId parameter" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const checkIns = await listEventCheckIns(eventId);
    const wantsJson = request.nextUrl.searchParams.get("format") === "json";

    if (wantsJson) {
      return NextResponse.json({ checkIns }, { status: 200 });
    }

    const header = "SK,full_name,student_id,course,department,scannedAt,timestamp";
    const rows = checkIns.map((row) =>
      [
        csvEscape(row.SK),
        csvEscape(row.full_name),
        csvEscape(row.student_id),
        csvEscape(row.course),
        csvEscape(row.department),
        csvEscape(row.scannedAt),
        csvEscape(String(row.timestamp || "")),
      ].join(","),
    );

    const csv = [header, ...rows].join("\r\n");
    const filename = "checkins-" + eventId.replace(/^EVENT#/, "") + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/checkins:", error);
    return NextResponse.json(
      { error: "Failed to retrieve check-ins" },
      { status: 500 },
    );
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
