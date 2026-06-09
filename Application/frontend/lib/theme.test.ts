import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrapTheme, resolveInitialTheme } from "./theme";

describe("resolveInitialTheme", () => {
  it("uses a valid stored value over system preference", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });
  it("falls back to system when stored is absent or invalid", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme("", true)).toBe("dark");
    expect(resolveInitialTheme("system", false)).toBe("light");
  });
});

function stubDom(stored: string | null, prefersDark: boolean, throwOnStorage = false) {
  const classes = new Set<string>();
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    },
  });
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => {
        if (throwOnStorage) throw new Error("storage blocked");
        return stored;
      },
    },
    matchMedia: (query: string) => ({ matches: prefersDark, media: query }),
  });
  return classes;
}

describe("bootstrapTheme (exact pre-paint code)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds .dark for stored dark", () => {
    const c = stubDom("dark", false);
    bootstrapTheme();
    expect(c.has("dark")).toBe(true);
  });
  it("removes .dark for stored light even when system prefers dark", () => {
    const c = stubDom("light", true);
    bootstrapTheme();
    expect(c.has("dark")).toBe(false);
  });
  it("follows system when nothing is stored", () => {
    const dark = stubDom(null, true);
    bootstrapTheme();
    expect(dark.has("dark")).toBe(true);
    vi.unstubAllGlobals();
    const light = stubDom(null, false);
    bootstrapTheme();
    expect(light.has("dark")).toBe(false);
  });
  it("falls back to system when localStorage access throws", () => {
    const c = stubDom(null, true, true);
    bootstrapTheme();
    expect(c.has("dark")).toBe(true);
  });
});