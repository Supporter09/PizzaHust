"use client";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  Received: "Received",
  Preparing: "Preparing",
  ReadyForDispatch: "Ready for Dispatch",
  DispatchPending: "Dispatch Pending",
  Delivering: "Delivering",
  Delivered: "Delivered",
  DeliveryFailed: "Delivery Failed",
  Cancelled: "Cancelled",
};

export const ORDER_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "Received", label: "Received" },
  { value: "Preparing", label: "Preparing" },
  { value: "ReadyForDispatch", label: "Ready for Dispatch" },
  { value: "DispatchPending", label: "Dispatch Pending ⚠" },
  { value: "Delivering", label: "Delivering" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
];

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}
