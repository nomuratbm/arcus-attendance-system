"use client";

import { useAttendanceStore } from "@/store/useAttendanceStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function MemberProfileCard() {
  const { currentMember, scanStatus } = useAttendanceStore();

  return (
    <Card className="flex flex-col justify-between min-h-[340px]">
      <div>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Member Details</CardTitle>
              <CardDescription className="text-xs">Scanned student verification record</CardDescription>
            </div>
            <div>
              {scanStatus === "success" && (
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-500 tracking-tight">
                  Verified
                </span>
              )}
              {scanStatus === "error" && (
                <span className="text-base font-bold text-red-600 dark:text-red-500 tracking-tight">
                  Not Found
                </span>
              )}
              {scanStatus === "loading" && (
                <span className="text-xs font-medium text-muted-foreground">
                  Checking...
                </span>
              )}
              {scanStatus === "idle" && (
                <span className="text-xs font-medium text-muted-foreground">
                  Ready
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {currentMember ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Full Name</span>
                <span className="font-semibold text-foreground text-sm">
                  {currentMember.full_name || currentMember.fullName || "—"}
                </span>
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground block text-[11px]">Student ID</span>
                <span className="font-mono text-foreground font-medium">
                  {currentMember.student_id ||
                    currentMember.studentId ||
                    currentMember.PK ||
                    currentMember.uuid ||
                    "—"}
                </span>
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground block text-[11px]">Email</span>
                <span className="text-foreground">
                  {currentMember.student_email || currentMember.email || "—"}
                </span>
              </div>

              {currentMember.course && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Program</span>
                    <span className="text-foreground">{currentMember.course}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-14 text-center text-muted-foreground text-xs">
              <p>No student scanned yet.</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Scan a member QR code to view and verify credentials.
              </p>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
