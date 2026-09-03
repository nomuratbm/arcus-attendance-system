"use client";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <Button size="sm" type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
