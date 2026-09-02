import { AppHeader } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Event Check-In & Attendance Registry" />
      <ScannerWorkspace />
    </div>
  );
}
