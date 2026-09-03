import { AppHeader, PageShell } from "@/components/AppHeader";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import { StudentDetailsForm } from "@/components/StudentDetailsForm";

export default function Home() {
  return (
    <PageShell>
      <AppHeader subtitle="Student registration" />
      <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
        <InstructionsDialog />
        <StudentDetailsForm />
      </main>
    </PageShell>
  );
}
