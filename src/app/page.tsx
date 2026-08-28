"use client";

import { QRScanner } from "@/components/QRScanner";
import { MemberProfileCard } from "@/components/MemberProfileCard";
import { PDFExportSection } from "@/components/PDFExportSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      {/* top header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">
                  Arcus Attendance
                </h1>
                <Badge variant="outline" size="sm">
                  AWS Student Builder Group
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Event Check-In & Attendance Registry</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="hidden sm:flex items-center gap-1.5">
              <span>Test QRs:</span>
              <Button variant="outline" size="xs" render={<a href="/test-qrs/001.png" download="001.png" />}>
                001.png
              </Button>
              <Button variant="outline" size="xs" render={<a href="/test-qrs/002.png" download="002.png" />}>
                002.png
              </Button>
            </div>

            {/* dark / light mode toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* main content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <QRScanner />
          <MemberProfileCard />
        </div>

        <PDFExportSection />
      </main>
    </div>
  );
}
