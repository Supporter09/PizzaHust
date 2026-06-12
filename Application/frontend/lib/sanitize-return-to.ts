/**
 * Only same-origin path strings survive: must start with a single "/",
 * never "//" or "/\" (protocol-relative), never a scheme. Anything else
 * falls back — unvalidated input must never reach router.push/replace
 * (javascript: URLs execute).
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}