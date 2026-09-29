"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control";

const adminNavItems = [
  { href: "/scanner", label: "Scanner" },
  { href: "/addevent", label: "Add Event" },
  { href: "/organizations", label: "Organizations" },
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

function isAdminPath(pathname: string) {
  return (
    pathname === "/scanner" ||
    pathname === "/addevent" ||
    pathname === "/organizations"
  );
}

export function AppNav({
  isAdmin,
  isSuperAdmin,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const navItems = isSuperAdmin
    ? adminNavItems
    : adminNavItems.filter((item) => item.href !== "/organizations");

  if (!isAdminPath(pathname)) {
    return (
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
        {isAdmin ? (
          <Button
            onFocus={preloadScanner}
            onMouseEnter={preloadScanner}
            render={<a href="/api/auth/login?next=/scanner" />}
            size="sm"
          >
            Admin
          </Button>
        ) : null}
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
      <SegmentedPageNav items={navItems} pathname={pathname} />
      <div className="flex items-center gap-2 sm:gap-3">
        <Button render={<Link href="/" />} size="sm">
          Register
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}
