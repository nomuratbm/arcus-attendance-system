"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <Button
        aria-label="Sign out"
        className="max-sm:size-8 max-sm:px-0"
        size="sm"
        title="Sign out"
        type="submit"
        variant="outline"
      >
        <LogOut className="sm:hidden" />
        <span className="max-sm:hidden">Sign out</span>
      </Button>
    </form>
  );
}
