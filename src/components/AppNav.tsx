"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control";

const publicNavItems = [
  { href: "/", label: "Register" },
  { href: "/retrieve", label: "Retrieve" },
] as const;

const adminNavItems = [
  { href: "/scanner", label: "Scanner" },
  { href: "/addevent", label: "Add Event" },
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

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/retrieve";
}

export function AppNav() {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return (
      <div className="flex items-center gap-3">
        <SegmentedPageNav items={publicNavItems} pathname={pathname} />
        <Button
          onFocus={preloadScanner}
          onMouseEnter={preloadScanner}
          render={<a href="/api/auth/login?next=/scanner" />}
          size="sm"
        >
          Admin
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <SegmentedPageNav items={adminNavItems} pathname={pathname} />
      <Button render={<Link href="/" />} size="sm">
        Register
      </Button>
      <SignOutButton />
    </div>
  );
}
