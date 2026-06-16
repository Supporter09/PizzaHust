"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import type { Theme } from "@/lib/theme";

/**
 * Mounts sonner's Toaster and keeps its theme in sync with the app's manual
 * `.dark` toggle (lib/theme.ts). theme="system" would ignore a user override,
 * so observe the documentElement class directly.
 */
export function AppToaster() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      richColors
      closeButton
      position="top-right"
      toastOptions={{ duration: 3500 }}
    />
  );
}
