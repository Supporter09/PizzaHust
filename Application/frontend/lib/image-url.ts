"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_BASE_URL;

function deriveAssetOrigin() {
  if (IMAGE_BASE) {
    return IMAGE_BASE.replace(/\/$/, "");
  }

  if (/^https?:\/\//i.test(API_BASE)) {
    return new URL(API_BASE).origin;
  }

  return "";
}

export function resolveImageUrl(url: string): string {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const origin = deriveAssetOrigin();
  if (!origin) {
    return url;
  }
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}
