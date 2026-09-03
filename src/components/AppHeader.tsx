import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

const headerTitle = (
  <div className="flex min-w-0 items-center gap-2">
    <h1 className="truncate text-base font-semibold text-foreground">
      A2S
    </h1>
    <Badge className="max-sm:hidden" size="sm" variant="outline">
      By AWS-SBG: Arcus
    </Badge>
  </div>
);

type AppHeaderProps = {
  subtitle: string;
  children?: ReactNode;
};

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col overflow-x-clip bg-background text-foreground transition-colors duration-150">
      {children}
    </div>
  );
}

export function AppHeader({ subtitle, children }: AppHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:flex sm:h-16 sm:px-6 sm:py-0">
        <div className="min-w-0">
          {headerTitle}
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="order-last col-span-2 min-w-0 sm:order-none sm:ml-auto sm:w-auto">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain sm:gap-3">
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
