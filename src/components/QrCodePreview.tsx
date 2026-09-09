"use client";

import Image from "next/image";
import type { Ref } from "react";
import type { OrganizationOption } from "@/lib/organizations";

type QrCodePreviewProps = {
  dataUrl: string;
  studentId: string;
  organization: OrganizationOption | null;
  ref?: Ref<HTMLDivElement>;
};

export function QrCodePreview({
  dataUrl,
  studentId,
  organization,
  ref,
}: QrCodePreviewProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-2"
      ref={ref}
    >
      <p className="text-center text-sm text-muted-foreground">
        Representing:{" "}
        <strong className="text-foreground">
          {organization?.label ?? "No organization"}
        </strong>
      </p>
      <Image
        alt={`Student QR Code for ${studentId}`}
        className="h-64 w-64 rounded-md border object-contain shadow-sm"
        height={256}
        src={dataUrl}
        unoptimized
        width={256}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Right-click (or long press) and save this QR code image. You will need
        it to scan in at events.
      </p>
    </div>
  );
}
