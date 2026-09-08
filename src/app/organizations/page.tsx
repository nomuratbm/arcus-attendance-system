import { AppHeader, PageShell } from "@/components/AppHeader";
import { OrganizationsImport } from "@/components/OrganizationsImport";
import { requireAdminPage } from "@/lib/auth/session";

export default async function OrganizationsPage() {
  await requireAdminPage("/organizations");

  return (
    <PageShell>
      <AppHeader subtitle="Organization registry" />
      <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6">
        <OrganizationsImport />
      </main>
    </PageShell>
  );
}
