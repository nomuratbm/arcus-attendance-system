import { AddEventForm } from "@/components/AddEventForm";
import { AppHeader } from "@/components/AppHeader";

export default function AddEventPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Create an event for attendance scanning" />
      <main className="mx-auto max-w-xl px-6 py-8">
        <AddEventForm />
      </main>
    </div>
  );
}
