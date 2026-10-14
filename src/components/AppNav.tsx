"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control";

const scaneeNavItems = [
  { href: "/", label: "Register" },
  { href: "/retrieve", label: "Retrieve" },
] as const;

const orgNavItems = [
  { href: "/scanner", label: "Scanner" },
] as const;

const navItemClassName = segmentedControlItemVariants({
  size: "sm",
  state: "current",
});

function preloadScanner() {
  if (typeof window === "undefined") {
    return;
  }

  void import("@/components/QRScanner");
  void import("@/components/AttendanceDashboard");
}

function SegmentedPageNav({
  items,
  pathname,
}: {
  items: readonly { href: string; label: string }[];
  pathname: string;
}) {
  return (
    <nav aria-label="Pages" className={segmentedControlRootClassName}>
      {items.map((item) => (
        <a
          aria-current={pathname === item.href ? "page" : undefined}
          className={navItemClassName}
          href={item.href}
          key={item.href}
          onFocus={item.href === "/scanner" ? preloadScanner : undefined}
          onMouseEnter={item.href === "/scanner" ? preloadScanner : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function AppNav({ isOrgAccount = false }: { isOrgAccount?: boolean }) {
  const pathname = usePathname();

  if (isOrgAccount) {
    return (
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
        <SegmentedPageNav items={orgNavItems} pathname={pathname} />
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
      <SegmentedPageNav items={scaneeNavItems} pathname={pathname} />
      <SignOutButton />
    </div>
  );
}
