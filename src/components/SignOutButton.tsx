"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <form
      action="/api/auth/logout"
      aria-busy={signingOut}
      method="POST"
      onSubmit={() => setSigningOut(true)}
    >
      {signingOut ? (
        <AsyncLoadingOverlay
          className="fixed inset-0 rounded-none"
          label="Signing out..."
        />
      ) : null}
      <Button
        aria-label="Sign out"
        className="max-sm:size-8 max-sm:px-0"
        loading={signingOut}
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
