"use client";

import { SignOutButton } from "@/components/SignOutButton";

export function AppNav() {
  return (
    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
      <SignOutButton />
    </div>
  );
}
