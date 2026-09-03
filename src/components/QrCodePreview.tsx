"use client";

import type { Ref } from "react";

type QrCodePreviewProps = {
  dataUrl: string;
  ref?: Ref<HTMLDivElement>;
};

export function QrCodePreview({ dataUrl, ref }: QrCodePreviewProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 pb-6 pt-2"
      ref={ref}
    >
      <img
        alt="Student QR Code"
        className="h-64 w-64 rounded-md border object-contain shadow-sm"
        height={256}
        src={dataUrl}
        width={256}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Right-click (or long press) and save this QR code image. You will need
        it to scan in at events.
      </p>
    </div>
  );
}
