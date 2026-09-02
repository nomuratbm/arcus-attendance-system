import { AppHeader } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";
import { Button } from "@/components/ui/button";

const scannerActions = (
  <>
    <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
      <span>Test QRs:</span>
      <Button
        render={<a download="001.png" href="/test-qrs/001.png" />}
        size="xs"
        variant="outline"
      >
        001.png
      </Button>
      <Button
        render={<a download="002.png" href="/test-qrs/002.png" />}
        size="xs"
        variant="outline"
      >
        002.png
      </Button>
    </div>
    <Button render={<a href="/" />} size="sm" variant="outline">
      Register
    </Button>
  </>
);

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Event Check-In & Attendance Registry">
        {scannerActions}
      </AppHeader>
      <ScannerWorkspace />
    </div>
  );
}
