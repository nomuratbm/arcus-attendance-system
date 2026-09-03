import { NextRequest, NextResponse } from "next/server";
import { checkInToEvent } from "@/lib/dynamodb";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, uuid } = body as { eventId: string; uuid: string };

    if (!eventId || !uuid) {
      return NextResponse.json(
        { error: "Missing required fields: eventId and uuid" },
        { status: 400 }
      );
    }

    if (!process.env.DYNAMODB_TABLE_NAME) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    await checkInToEvent(eventId, uuid);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "ConditionalCheckFailedException"
    ) {
      return NextResponse.json(
        { error: "Already checked in to this event" },
        { status: 409 }
      );
    }
    console.error("Error in POST /api/checkin:", error);
    return NextResponse.json(
      { error: "Failed to record check-in" },
      { status: 500 }
    );
  }
}
