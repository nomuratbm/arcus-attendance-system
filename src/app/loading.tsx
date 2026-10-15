import { AppHeader, PageShell } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <PageShell>
      <AppHeader subtitle="Your student QR code" />
      <main className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <section
          aria-busy="true"
          aria-label="Loading your QR code"
          className="rounded-xl border bg-card px-6 py-6"
          role="status"
        >
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mx-auto mt-6 size-64 max-w-full" />
        </section>
      </main>
    </PageShell>
  );
}
