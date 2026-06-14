// Resolve backend-served asset paths (uploaded/seeded images) to browser-loadable URLs.
//
// Image URLs are stored root-relative (`/images/<file>`) and served by the backend's
// StaticFiles mount. Behind the production load balancer `/images` and `/api` route to
// the backend under one origin, so the relative URL works as-is. In local dev the API
// lives on a different origin (NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api) than
// the frontend (:3000), so a bare `/images/...` hits the frontend and 404s. Derive the
// asset origin from the API base — same source the API client uses — and prefix it.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

/** Pure resolver: prefix a root-relative URL with the origin behind `apiBase`. */
export function resolveAssetUrl(url: string, apiBase: string): string {
  if (url.startsWith("http")) return url;
  return `${apiBase.replace(/\/api\/?$/, "")}${url}`;
}

/** Browser src for a backend image URL, using the configured API base. */
export const imageSrc = (url: string): string => resolveAssetUrl(url, API_BASE);
