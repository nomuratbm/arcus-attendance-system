import { AppHeader, PageShell } from "@/components/AppHeader";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import { OrganizationSelect } from "@/components/OrganizationSelect";
import { StudentDetailsForm } from "@/components/StudentDetailsForm";

export default function Home() {
  return (
    <PageShell>
      <AppHeader subtitle="Student registration" />
      <main className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <InstructionsDialog />
        <OrganizationSelect />
        <StudentDetailsForm />
      </main>
    </PageShell>
  );
}
