"use client";

import { Button } from "@/components/ui/button";

function preloadScanner() {
  if (typeof window === "undefined") {
    return;
  }

  void import("@/components/QRScanner");
  void import("@/components/PDFExportSection");
  void import("@/components/MemberProfileCard");
}

export function ScannerNavLink() {
  return (
    <Button
      onFocus={preloadScanner}
      onMouseEnter={preloadScanner}
      render={<a href="/scanner" />}
      size="sm"
      variant="outline"
    >
      Scanner
    </Button>
  );
}
