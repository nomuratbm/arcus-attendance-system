import { AppHeader, PageShell } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";
import { requireAdminPage } from "@/lib/auth/session";

export default async function ScannerPage() {
  await requireAdminPage("/scanner");
  return (
    <PageShell>
      <AppHeader subtitle="Scanner View" />
      <ScannerWorkspace />
    </PageShell>
  );
}
