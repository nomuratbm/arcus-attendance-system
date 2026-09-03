import { AppHeader } from "@/components/AppHeader";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import { StudentDetailsForm } from "@/components/StudentDetailsForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Student registration" />
      <main className="mx-auto max-w-xl px-6 py-8">
        <InstructionsDialog />
        <StudentDetailsForm />
      </main>
    </div>
  );
}
