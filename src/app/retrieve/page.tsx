import { AppHeader } from "@/components/AppHeader";
import { RetrieveQrForm } from "@/components/RetrieveQrForm";

export default function RetrievePage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Retrieve QR code" />
      <main className="mx-auto max-w-xl px-6 py-8">
        <RetrieveQrForm />
      </main>
    </div>
  );
}
