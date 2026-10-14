import { AppHeader, PageShell } from "@/components/AppHeader";
import { listOrganizations } from "@/lib/dynamodb/organizations";
import { requireSuperAdminPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requireSuperAdminPage("/organizations");
  const organizations = await listOrganizations();

  return (
    <PageShell>
      <AppHeader isOrgAccount subtitle="Organization registry (read-only)" />
      <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Organizations are managed in the mapua-apex admin. Changes made there
          appear here.
        </p>
        {organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No organizations found. Create one in mapua-apex first.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {organizations.map((organization) => (
              <li
                key={organization.value}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {organization.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {organization.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageShell>
  );
}
