// A one-shot reorder notice carried across the navigation from /account/orders
// to /cart. Reorder navigates away immediately, so a partial-failure message
// ("N item(s) couldn't be added …") can't be shown on the orders page — it is
// stashed in sessionStorage and consumed once by the cart page.
export const REORDER_NOTICE_KEY = "ph:reorder-notice";

export function stashReorderNotice(message: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REORDER_NOTICE_KEY, message);
}

export function consumeReorderNotice(): string | null {
  if (typeof window === "undefined") return null;
  const message = window.sessionStorage.getItem(REORDER_NOTICE_KEY);
  if (message !== null) window.sessionStorage.removeItem(REORDER_NOTICE_KEY);
  return message;
}
