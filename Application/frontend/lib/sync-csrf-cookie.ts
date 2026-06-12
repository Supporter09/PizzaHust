export function syncCsrfCookie(token: string): void {
  if (typeof document === "undefined" || !token) {
    return;
  }
  // Mirror the backend's csrf cookie attributes: Secure everywhere except
  // plain-HTTP local dev (matches SESSION_HTTPS_ONLY=false there).
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `csrf_token=${encodeURIComponent(token)}; path=/; SameSite=Lax${secure}`;
}