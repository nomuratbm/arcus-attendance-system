import { AppHeader, PageShell } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function ScannerLoading() {
  return (
    <PageShell>
      <AppHeader subtitle="Scanner View" />
      <main
        aria-busy="true"
        className="mx-auto w-full max-w-5xl min-w-0 space-y-6 px-4 py-8 sm:px-6"
      >
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-24 w-full" />
        <div
          aria-label="Loading scanner"
          className="min-h-[340px] space-y-4 rounded-2xl border bg-card p-6"
          role="status"
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div
          aria-label="Loading attendance"
          className="space-y-3 rounded-lg border bg-card p-4"
          role="status"
        >
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </main>
    </PageShell>
  );
}
