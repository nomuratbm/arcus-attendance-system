import { AppHeader } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";
import { requireAdminPage } from "@/lib/auth/session";

export default async function ScannerPage() {
  await requireAdminPage("/scanner");
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Scanner View" />
      <ScannerWorkspace />
    </div>
  );
}
