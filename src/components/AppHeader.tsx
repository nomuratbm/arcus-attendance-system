import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

const BUG_REPORT_EMAIL = "awsstudentbuildergrouparcus@gmail.com";

type AppHeaderProps = {
  subtitle: string;
  children?: ReactNode;
};

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col overflow-x-clip bg-background text-foreground transition-colors duration-150">
      {children}
      <AppFooter />
    </div>
  );
}

export function AppHeader({ subtitle, children }: AppHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:flex sm:h-16 sm:px-6 sm:py-0">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">
            A2S
          </h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="order-last col-span-2 w-full min-w-0 sm:order-none sm:ml-auto sm:w-auto">
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <AppNav />
            {children}
          </div>
        </div>
        <Separator className="hidden h-6 sm:block" orientation="vertical" />
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>By AWS-SBG: Arcus</p>
        <p>
          Bug reports:{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={`mailto:${BUG_REPORT_EMAIL}`}
          >
            {BUG_REPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
