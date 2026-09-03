import { AddEventForm } from "@/components/AddEventForm";
import { AppHeader } from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/session";

export default async function AddEventPage() {
  await requireAdminPage("/addevent");
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Event Creation" />
      <main className="mx-auto max-w-xl px-6 py-8">
        <AddEventForm />
      </main>
    </div>
  );
}
