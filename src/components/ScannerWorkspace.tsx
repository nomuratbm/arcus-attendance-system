"use client";

import dynamic from "next/dynamic";
import { EventSelector } from "@/components/EventSelector";
import { MemberProfileCard } from "@/components/MemberProfileCard";

const scannerPanelFallback = (
  <div aria-hidden className="min-h-[340px] rounded-2xl border bg-card" />
);

const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((mod) => mod.QRScanner),
  { loading: () => scannerPanelFallback, ssr: false },
);

const PDFExportSection = dynamic(
  () =>
    import("@/components/PDFExportSection").then((mod) => mod.PDFExportSection),
  { ssr: false },
);

export function ScannerWorkspace() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <EventSelector />
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <QRScanner />
        <MemberProfileCard />
      </div>
      <PDFExportSection />
    </main>
  );
}
