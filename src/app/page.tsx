import { redirect } from "next/navigation";
import { AppHeader, PageShell } from "@/components/AppHeader";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import { StudentDetailsForm } from "@/components/StudentDetailsForm";
import { getLandingPath, requireStudentPage } from "@/lib/auth/session";
import { StudentQrCode } from "@/components/StudentQrCode";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await requireStudentPage("/");
  // Organization / operator accounts land on the scanner instead of the
  // registration form. Scanees stay here to register and view their own QR.
  if ((await getLandingPath()) === "/scanner") {
    redirect("/scanner");
  }

  return (
    <PageShell>
      <AppHeader subtitle={identity.studentId ? "Your student QR code" : "Student registration"} />
      <main className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <InstructionsDialog />
        {identity.studentId ? <StudentQrCode key={identity.studentId} studentId={identity.studentId} /> : <StudentDetailsForm />}
      </main>
    </PageShell>
  );
}
