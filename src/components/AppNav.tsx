"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { Button } from "@/components/ui/button";
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control";

const navItems = [
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

export function AppNav() {
  const pathname = usePathname();
  const isRegisterPage = pathname === "/";

  if (isRegisterPage) {
    return (
      <Button
        onFocus={preloadScanner}
        onMouseEnter={preloadScanner}
        render={<Link href="/scanner" />}
        size="sm"
      >
        Admin
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <nav aria-label="Pages" className={segmentedControlRootClassName}>
        {navItems.map((item) => (
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
      <Button render={<Link href="/" />} size="sm">
        Register
      </Button>
      <SignOutButton />
    </div>
  );
}
