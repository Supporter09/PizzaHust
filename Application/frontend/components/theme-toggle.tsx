"use client";

import { useState } from "react";

import { applyTheme, setStoredTheme, type Theme } from "@/lib/theme";

function readThemeFromDom(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" ? readThemeFromDom() : "light",
  );

  const toggle = () => {
    const next: Theme = readThemeFromDom() === "dark" ? "light" : "dark";
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