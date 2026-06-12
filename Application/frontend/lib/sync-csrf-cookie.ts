export function syncCsrfCookie(token: string): void {
  if (typeof document === "undefined" || !token) {
    return;
  }
  document.cookie = `csrf_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}