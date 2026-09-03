import { NextRequest, NextResponse } from "next/server";
import { deleteEvent } from "@/lib/dynamodb/events";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
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

    await deleteEvent(eventId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/events/[eventId]:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 },
    );
  }
}
