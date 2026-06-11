import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type SalesReport = components["schemas"]["SalesReportOut"];

function query(dateFrom?: string, dateTo?: string): string {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchSalesReport(dateFrom?: string, dateTo?: string): Promise<SalesReport> {
  return apiFetch<SalesReport>(`/admin/reports/sales${query(dateFrom, dateTo)}`);
}

/** Absolute URL for the CSV export (credentials flow via the same-origin cookie). */
export function salesCsvUrl(dateFrom?: string, dateTo?: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
  return `${base}/admin/reports/sales.csv${query(dateFrom, dateTo)}`;
}
