"use client";

import { useEffect } from "react";
import { QrCodePreview } from "@/components/QrCodePreview";
import { Skeleton } from "@/components/ui/skeleton";
import { useQrCode } from "@/hooks/use-qr-code";

export function StudentQrCode({ studentId }: { studentId: string }) {
  const { dataUrl, error, generate } = useQrCode();

  useEffect(() => {
    const controller = new AbortController();
    void generate(studentId, controller.signal);
    return () => controller.abort();
  }, [studentId, generate]);

  return (
    <section className="rounded-xl border bg-card py-6">
      <h1 className="px-6 text-xl font-semibold">Your student QR code</h1>
      <p className="px-6 pt-2 pb-6 text-sm text-muted-foreground">
        Student number: {studentId}
      </p>
      {dataUrl ? (
        <QrCodePreview dataUrl={dataUrl} studentId={studentId} />
      ) : error ? (
        <p role="status" className="px-6 text-sm">
          {error}
        </p>
      ) : (
        <div
          aria-label="Preparing your QR code"
          className="flex justify-center px-6"
          role="status"
        >
          <Skeleton className="size-64 max-w-full" />
        </div>
      )}
      {error ? (
        <button
          type="button"
          onClick={() => void generate(studentId)}
          className="mx-6 mt-4 rounded-md border px-4 py-2 text-sm"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
