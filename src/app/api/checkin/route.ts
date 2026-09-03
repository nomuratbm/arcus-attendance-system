import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { checkIn } from "@/lib/dynamodb/attendance";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const studentId =
      typeof body.student_id === "string" ? body.student_id.trim() : "";
    const scannedAt =
      typeof body.scannedAt === "string" ? body.scannedAt : undefined;
    const timestamp =
      typeof body.timestamp === "number" ? body.timestamp : undefined;

    if (!eventId || !studentId) {
      return NextResponse.json(
        { error: "Missing required fields: eventId and student_id" },
        { status: 400 },
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 },
      );
    }

    const result = await checkIn(
      eventId,
      studentId,
      scannedAt && timestamp !== undefined ? { scannedAt, timestamp } : undefined,
    );

    if (result.status === "already-checked-in") {
      return NextResponse.json(
        { error: "Already checked in to this event" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/checkin:", error);
    return NextResponse.json(
      { error: "Failed to record check-in" },
      { status: 500 },
    );
  }
}
