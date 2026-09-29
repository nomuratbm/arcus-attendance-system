import { NextRequest, NextResponse } from "next/server";
import { rejectForeignEvent } from "@/lib/auth/organization-scope";
import { requireAdminUser } from "@/lib/auth/session";
import { checkIn, recordLeave } from "@/lib/dynamodb/attendance";
import { formatAttendanceClockTime } from "@/lib/scan-time";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireAdminUser();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const studentId =
      typeof body.student_id === "string" ? body.student_id.trim() : "";
    const mode = body.mode === "leave" ? "leave" : "enter";
    const scannedAt =
      typeof body.scannedAt === "string" ? body.scannedAt : undefined;
    const leftAt = typeof body.leftAt === "string" ? body.leftAt : undefined;
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

    const denied = await rejectForeignEvent(user, eventId);
    if (denied) {
      return denied;
    }

    if (mode === "leave") {
      const leaveResult = await recordLeave(eventId, studentId, leftAt);

      if (leaveResult.status === "not-checked-in") {
        return NextResponse.json(
          { error: "Not checked in to this event" },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    const result = await checkIn(eventId, studentId, {
      scannedAt: scannedAt ?? formatAttendanceClockTime(),
      timestamp: timestamp ?? Date.now(),
    });

    if (result.status === "already-checked-in") {
      return NextResponse.json(
        { error: "Already checked in to this event" },
        { status: 409 },
      );
    }

    if (result.status === "member-not-found") {
      return NextResponse.json(
        { error: "Member not registered in the system" },
        { status: 404 },
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
