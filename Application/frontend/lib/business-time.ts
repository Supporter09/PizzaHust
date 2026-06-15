/**
 * Business-timezone display helpers.
 *
 * Timestamps come from the API as UTC-aware ISO strings. The business timezone
 * is admin-configured (`GET /api/config/business`) and is the authority for how
 * staff see wall-clock times — so absolute times are formatted in that zone
 * rather than the browser's local zone. (Relative "X min ago" is elapsed time
 * and stays zone-independent.)
 */

export const DEFAULT_BUSINESS_TZ = "Asia/Ho_Chi_Minh";

export function formatInBusinessTz(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleString("vi-VN", { ...options, timeZone });
}
