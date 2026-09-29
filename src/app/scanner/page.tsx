import { AdminOrganizationNotice } from "@/components/AdminOrganizationNotice";
import { AppHeader, PageShell } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";
import { requireAdminPage } from "@/lib/auth/session";

export default async function ScannerPage() {
  const user = await requireAdminPage("/scanner");
  const lockedOrganizationId = user.isSuperAdmin ? null : user.organizationId;

  return (
    <PageShell>
      <AppHeader subtitle="Scanner View" />
      {lockedOrganizationId || user.isSuperAdmin ? (
        <ScannerWorkspace lockedOrganizationId={lockedOrganizationId} />
      ) : (
        <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
          <AdminOrganizationNotice />
        </main>
      )}
    </PageShell>
  );
}
