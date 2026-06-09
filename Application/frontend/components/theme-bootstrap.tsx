"use client";

import { useLayoutEffect } from "react";

import { bootstrapTheme } from "@/lib/theme";

export function ThemeBootstrap() {
  useLayoutEffect(() => {
    bootstrapTheme();
  }, []);
  return null;
}