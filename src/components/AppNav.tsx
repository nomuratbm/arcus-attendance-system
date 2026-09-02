"use client";

import { usePathname } from "next/navigation";
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control";

const navItems = [
  { href: "/", label: "Register" },
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
  void import("@/components/PDFExportSection");
  void import("@/components/MemberProfileCard");
}

export function AppNav() {
  const pathname = usePathname();

  return (
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
  );
}
