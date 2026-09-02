"use client";

import { useState } from "react";
import { useAttendanceStore, AttendanceRecord } from "@/store/useAttendanceStore";
import { useEventsStore } from "@/store/useEventsStore";
import { generateAttendancePDF } from "@/utils/pdfFiller";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export function PDFExportSection() {
  const { attendanceHistory, clearHistory, removeAttendanceRecord } = useAttendanceStore();
  const events = useEventsStore((state) => state.events);
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const selectedEventName =
    events.find((event) => event.PK === selectedEventPK)?.name ??
    "AWS Arcus Member Event Check-in";
  const [searchQuery, setSearchQuery] = useState("");
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  // calculate unique attendees by uuid / pk / student id
  const uniqueUuids = Array.from(
    new Set(
      attendanceHistory.map(
        (item) => item.SK || item.member.SK || item.member.PK || item.member.student_id || item.id,
      ),
    ),
  );
  const uniqueAttendeesCount = uniqueUuids.length;
  const totalScansCount = attendanceHistory.length;

  const latestRecord = attendanceHistory[0];
  const latestName = latestRecord ? latestRecord.member.full_name || "Member" : null;

  // filter records by search query
  const query = searchQuery.trim().toLowerCase();
  const filteredRecords = attendanceHistory.filter((item) => {
    if (!query) return true;
    const name = item.member.full_name.toLowerCase();
    const id = item.member.student_id.toLowerCase();
    const course = item.member.course.toLowerCase();
    const department = item.member.department.toLowerCase();

    return (
      name.includes(query) ||
      id.includes(query) ||
      course.includes(query) ||
      department.includes(query)
    );
  });

  const handleExportPDF = async () => {
    await generateAttendancePDF(attendanceHistory, selectedEventName);
  };

  const handleConfirmClearAll = () => {
    clearHistory();
    setIsClearAllOpen(false);
  };

  const handleConfirmDeleteRecord = () => {
    if (recordToDelete) {
      removeAttendanceRecord(recordToDelete.id);
      setRecordToDelete(null);
    }
  };

  return (
    <Card>
      {/* modal dialog for clearing all records */}
      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Attendance Log?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all {attendanceHistory.length} attendee records from
              this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </AlertDialogClose>
            <Button variant="destructive" size="sm" onClick={handleConfirmClearAll}>
              Yes, Clear All
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* modal dialog for removing a single attendee */}
      <AlertDialog
        open={recordToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRecordToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Attendee?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong className="text-foreground">
                {recordToDelete?.member.full_name || "this attendee"}
              </strong>{" "}
              (
              <span className="font-mono">
                {recordToDelete?.member.student_id || "ID"}
              </span>
              ) from the attendance log?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </AlertDialogClose>
            <Button variant="destructive" size="sm" onClick={handleConfirmDeleteRecord}>
              Yes, Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* card header & main actions */}
      <CardHeader className="pb-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold">Attendance Dashboard</CardTitle>
            <CardDescription className="text-xs">
              Live attendee tracking and PDF export
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleExportPDF}>
              Download Attendance PDF
            </Button>

            {attendanceHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setIsClearAllOpen(true)}
              >
                Clear Log
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5">
        {/* metric dashboard cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-muted/40 border rounded-lg">
            <span className="text-[11px] text-muted-foreground block uppercase font-medium">
              Unique Attendees
            </span>
            <span className="text-xl font-semibold text-foreground mt-0.5 block font-mono">
              {uniqueAttendeesCount}
            </span>
            <span className="text-[11px] text-muted-foreground">Distinct students present</span>
          </div>

          <div className="p-3.5 bg-muted/40 border rounded-lg">
            <span className="text-[11px] text-muted-foreground block uppercase font-medium">
              Total Scans
            </span>
            <span className="text-xl font-semibold text-foreground mt-0.5 block font-mono">
              {totalScansCount}
            </span>
            <span className="text-[11px] text-muted-foreground">Total check-in events logged</span>
          </div>

          <div className="p-3.5 bg-muted/40 border rounded-lg">
            <span className="text-[11px] text-muted-foreground block uppercase font-medium">
              Latest Check-in
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 block truncate">
              {latestName || "—"}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {latestRecord ? latestRecord.scannedAt : "No activity yet"}
            </span>
          </div>
        </div>

        {/* search input bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Input
              size="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, ID, program, or department..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-semibold"
              >
                ✕
              </button>
            )}
          </div>

          <span className="text-xs text-muted-foreground">
            {query ? (
              <>
                Showing <strong className="text-foreground">{filteredRecords.length}</strong> of{" "}
                {attendanceHistory.length} records
              </>
            ) : (
              `${attendanceHistory.length} total logged`
            )}
          </span>
        </div>

        {/* attendance table with per-row remove button */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="w-10 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? `No students found matching "${searchQuery}"`
                      : "No records logged in this session yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((item, index) => {
                  const name = item.member.full_name || "—";
                  const id = item.member.student_id || "—";
                  const course = item.member.course || "—";

                  return (
                    <TableRow key={item.id} className="group">
                      <TableCell className="text-center text-muted-foreground font-mono text-xs">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{id}</TableCell>
                      <TableCell className="text-muted-foreground">{course}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono text-xs">
                        {item.scannedAt}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setRecordToDelete(item)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={`Remove ${name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
