import { describe, expect, it } from "vitest";

import { resolveAssetUrl } from "./asset-url";

describe("resolveAssetUrl", () => {
  it("prefixes a root-relative blob URL with the backend origin in dev", () => {
    // Local dev: frontend (:3000) and backend (:8000) are different origins, so a
    // bare /images/... would hit the frontend and 404. It must point at the backend.
    expect(resolveAssetUrl("/images/abc.png", "http://localhost:8000/api")).toBe(
      "http://localhost:8000/images/abc.png",
    );
  });

  it("leaves a root-relative URL unchanged when the API base is same-origin", () => {
    // Prod behind the LB: /api and /images both route to the backend under one origin.
    expect(resolveAssetUrl("/images/abc.png", "/api")).toBe("/images/abc.png");
  });

  it("tolerates a trailing slash on the API base", () => {
    expect(resolveAssetUrl("/images/abc.png", "http://localhost:8000/api/")).toBe(
      "http://localhost:8000/images/abc.png",
    );
  });

  it("passes absolute http(s) URLs through untouched", () => {
    const ext = "https://cdn.example.com/x.png";
    expect(resolveAssetUrl(ext, "http://localhost:8000/api")).toBe(ext);
  });
});
