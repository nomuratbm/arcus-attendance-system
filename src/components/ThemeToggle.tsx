"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // check saved theme or system preference
    const savedTheme = localStorage.getItem("theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialDark = savedTheme === "dark" || (!savedTheme && systemDark);

    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="xs" className="w-8 h-8 p-0 opacity-0">
        <Sun className="w-3.5 h-3.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={toggleTheme}
      className="flex items-center gap-1.5 cursor-pointer"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-slate-700" />
          <span>Dark</span>
        </>
      )}
    </Button>
  );
}
