import { AppHeader, PageShell } from "@/components/AppHeader";
import { RetrieveQrForm } from "@/components/RetrieveQrForm";

export default function RetrievePage() {
  return (
    <PageShell>
      <AppHeader subtitle="Retrieve QR code" />
      <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
        <RetrieveQrForm />
      </main>
    </PageShell>
  );
}
