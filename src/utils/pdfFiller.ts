import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import saveAs from "file-saver";
import { AttendanceRecord } from "@/store/useAttendanceStore";

export async function generateAttendancePDF(
  records: AttendanceRecord[],
  eventName: string = "AWS Arcus Member Event Check-in"
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();

  // embed fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // theme colors
  const darkNavy = rgb(0.08, 0.12, 0.25);
  const awsOrange = rgb(1, 0.6, 0);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.95, 0.95, 0.95);

  // header background banner
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: darkNavy,
  });

  // title & subtitle
  page.drawText("AWS Student Builder Group (Arcus)", {
    x: 40,
    y: height - 40,
    size: 20,
    font: helveticaBold,
    color: awsOrange,
  });

  page.drawText(`Event Attendance Record: ${eventName}`, {
    x: 40,
    y: height - 65,
    size: 13,
    font: helvetica,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    {
      x: 40,
      y: height - 85,
      size: 10,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    }
  );

  // table header
  const tableTop = height - 140;
  page.drawRectangle({
    x: 40,
    y: tableTop - 25,
    width: width - 80,
    height: 25,
    color: lightGray,
  });

  page.drawText("#", { x: 50, y: tableTop - 18, size: 10, font: helveticaBold, color: darkGray });
  page.drawText("Student Name", { x: 80, y: tableTop - 18, size: 10, font: helveticaBold, color: darkGray });
  page.drawText("Student ID", { x: 250, y: tableTop - 18, size: 10, font: helveticaBold, color: darkGray });
  page.drawText("Program", { x: 370, y: tableTop - 18, size: 10, font: helveticaBold, color: darkGray });
  page.drawText("Time", { x: 510, y: tableTop - 18, size: 10, font: helveticaBold, color: darkGray });

  // render records
  let currentY = tableTop - 45;

  if (records.length === 0) {
    page.drawText("No attendance records logged for this session.", {
      x: 40,
      y: currentY,
      size: 11,
      font: helvetica,
      color: darkGray,
    });
  } else {
    records.forEach((rec, idx) => {
      if (currentY < 60) return;

      const name = rec.member.full_name || "N/A";
      const id = rec.member.student_id || "N/A";
      const course = rec.member.course || "N/A";
      const time = rec.scannedAt || "N/A";

      page.drawText(`${idx + 1}`, { x: 50, y: currentY, size: 10, font: helvetica, color: darkGray });
      page.drawText(name.substring(0, 25), { x: 80, y: currentY, size: 10, font: helvetica, color: darkGray });
      page.drawText(id.substring(0, 18), { x: 250, y: currentY, size: 10, font: helvetica, color: darkGray });
      page.drawText(course.substring(0, 22), { x: 370, y: currentY, size: 9, font: helvetica, color: darkGray });
      page.drawText(time, { x: 510, y: currentY, size: 9, font: helvetica, color: darkGray });

      // row border line
      page.drawLine({
        start: { x: 40, y: currentY - 8 },
        end: { x: width - 40, y: currentY - 8 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });

      currentY -= 25;
    });
  }

  // footer sign-off section
  page.drawText("Official Verification Signature: _______________________", {
    x: 40,
    y: 40,
    size: 10,
    font: helvetica,
    color: darkGray,
  });

  // serialize to bytes & save pdf
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.slice()], { type: "application/pdf" });
  const filename = `Arcus_Attendance_${new Date().toISOString().slice(0, 10)}.pdf`;
  saveAs(blob, filename);
}
