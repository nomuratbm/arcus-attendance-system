import { NextRequest, NextResponse } from "next/server";
import { checkIn } from "@/lib/dynamodb/attendance";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const uuid = typeof body.uuid === "string" ? body.uuid.trim() : "";
    const scannedAt =
      typeof body.scannedAt === "string" ? body.scannedAt : undefined;
    const timestamp =
      typeof body.timestamp === "number" ? body.timestamp : undefined;

    if (!eventId || !uuid) {
      return NextResponse.json(
        { error: "Missing required fields: eventId and uuid" },
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
      uuid,
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
