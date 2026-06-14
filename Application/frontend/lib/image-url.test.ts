import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prefixes relative image paths with the configured image origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/api");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_BASE_URL", "http://localhost:8000");
    const { resolveImageUrl } = await import("./image-url");
    expect(resolveImageUrl("/images/demo.png")).toBe("http://localhost:8000/images/demo.png");
  });

  it("leaves absolute image URLs untouched", async () => {
    const { resolveImageUrl } = await import("./image-url");
    expect(resolveImageUrl("https://cdn.example.com/demo.png")).toBe(
      "https://cdn.example.com/demo.png",
    );
  });
});
