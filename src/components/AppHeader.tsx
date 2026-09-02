import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

const headerTitle = (
  <div className="flex items-center gap-2">
    <h1 className="text-base font-semibold text-foreground">Arcus Attendance</h1>
    <Badge size="sm" variant="outline">
      AWS Student Builder Group
    </Badge>
  </div>
);

type AppHeaderProps = {
  subtitle: string;
  children?: ReactNode;
};

export function AppHeader({ subtitle, children }: AppHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div>
          {headerTitle}
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
