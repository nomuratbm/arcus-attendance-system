import { AddEventForm } from "@/components/AddEventForm";
import { AppHeader, PageShell } from "@/components/AppHeader";
import { requireSuperAdminPage } from "@/lib/auth/session";

export default async function AddEventPage() {
  await requireSuperAdminPage("/addevent");
  return (
    <PageShell>
      <AppHeader subtitle="Event Creation" />
      <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
        <AddEventForm />
      </main>
    </PageShell>
  );
}
