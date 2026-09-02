import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createProfile } from "@/lib/dynamodb";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid, full_name, student_id, course, department } = body as {
      uuid: string;
      full_name: string;
      student_id: string;
      course: string;
      department: string;
    };

    if (!uuid || !full_name || !student_id || !course || !department) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      return NextResponse.json(
        { error: "Server configuration error: missing table configuration" },
        { status: 500 }
      );
    }

    await createProfile(uuid, { full_name, student_id, course, department });

    const qrDataUrl = await QRCode.toDataURL(uuid, { 
      type: "image/png",
      margin: 2,
      scale: 8,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    });

    return NextResponse.json(
      {
        success: true,
        uuid,
        qrDataUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/forms:", error);
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 }
    );
  }
}
