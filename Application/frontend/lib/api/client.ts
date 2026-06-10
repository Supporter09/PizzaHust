import { reportApiError } from "@/lib/api/report-api-error";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function csrfFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";").map((entry) => entry.trim());
  const csrfCookie = cookies.find((entry) => entry.startsWith("csrf_token="));
  if (!csrfCookie) {
    return null;
  }
  return decodeURIComponent(csrfCookie.split("=").slice(1).join("="));
}

function isMutatingMethod(method?: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes((method ?? "GET").toUpperCase());
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const headers = new Headers(init?.headers ?? {});
    const method = init?.method ?? "GET";

    // Only default to JSON for string bodies. FormData/Blob/URLSearchParams set
    // their own Content-Type (e.g. multipart boundary), which we must not clobber.
    if (!headers.has("Content-Type") && typeof init?.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    if (isMutatingMethod(method) && !headers.has("X-CSRF-Token")) {
      const csrfToken = csrfFromCookie();
      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
      }
    }

    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      ...init,
      method,
      headers,
    });

    if (!res.ok) {
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object"
      ) {
        const errorObj = payload.error as {
          code?: string;
          message?: string;
          details?: unknown;
        };
        throw new ApiClientError(
          errorObj.message ?? `API ${res.status}`,
          res.status,
          errorObj.code,
          errorObj.details,
        );
      }

      throw new ApiClientError(`API ${res.status}`, res.status);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  } catch (error) {
    reportApiError(`apiFetch ${path}`, error);
    throw error;
  }
}
