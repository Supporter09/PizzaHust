"use client";

import { useEffect, useState } from "react";

import { applyTheme, setStoredTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    setStoredTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label="Toggle dark mode"
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-fg"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {theme === "dark" ? "☀" : "☾"}
      </span>
    </button>
  );
}