import { AddEventForm } from "@/components/AddEventForm";
import { AdminOrganizationNotice } from "@/components/AdminOrganizationNotice";
import { AppHeader, PageShell } from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/session";

export default async function AddEventPage() {
  const user = await requireAdminPage("/addevent");
  const lockedOrganizationId = user.isSuperAdmin ? null : user.organizationId;

  return (
    <PageShell>
      <AppHeader subtitle="Event Creation" />
      <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
        {lockedOrganizationId || user.isSuperAdmin ? (
          <AddEventForm lockedOrganizationId={lockedOrganizationId} />
        ) : (
          <AdminOrganizationNotice />
        )}
      </main>
    </PageShell>
  );
}
