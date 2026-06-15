"use client";

import { formatOrderStatus } from "@/lib/order-status";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  Received: {
    label: "Received",
    classes:
      "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/30",
  },
  Preparing: {
    label: "Preparing",
    classes:
      "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
  },
  ReadyForDispatch: {
    label: "Ready for Dispatch",
    classes:
      "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-500/30",
  },
  DispatchPending: {
    label: "Dispatch Pending",
    classes:
      "bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-500/30",
  },
  Delivering: {
    label: "Delivering",
    classes:
      "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-200 dark:ring-purple-500/30",
  },
  Delivered: {
    label: "Delivered",
    classes:
      "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 ring-green-200 dark:ring-green-500/30",
  },
  DeliveryFailed: {
    label: "Delivery Failed",
    classes:
      "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30",
  },
  Cancelled: {
    label: "Cancelled",
    classes:
      "bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-300 ring-gray-200 dark:ring-gray-500/30",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    classes:
      "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300 ring-gray-200 dark:ring-gray-500/30",
  };
  return (
    <span
      data-testid="order-status-badge"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.classes}`}
    >
      {formatOrderStatus(status)}
    </span>
  );
}
