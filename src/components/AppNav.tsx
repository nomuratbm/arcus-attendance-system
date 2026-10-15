"use client";

import { SignOutButton } from "@/components/SignOutButton";

export function AppNav() {
  return (
    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
      <SignOutButton className="border-[color-mix(in_srgb,var(--color-maroon)_92%,black)] bg-[color-mix(in_srgb,var(--color-maroon)_92%,black)] text-white shadow-xs/5 shadow-maroon/24 hover:border-[color-mix(in_srgb,var(--color-maroon)_84%,black)] hover:bg-[color-mix(in_srgb,var(--color-maroon)_84%,black)] hover:text-white focus-visible:ring-white focus-visible:ring-offset-maroon not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-maroon/40%)] [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-maroon/32%)]" />
    </div>
  );
}
