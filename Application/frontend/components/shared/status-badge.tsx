"use client";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  Received: { label: "Received", classes: "bg-blue-50 text-blue-700 ring-blue-200" },
  Preparing: { label: "Preparing", classes: "bg-amber-50 text-amber-700 ring-amber-200" },
  ReadyForDispatch: { label: "Ready", classes: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  DispatchPending: { label: "Dispatch Pending", classes: "bg-orange-50 text-orange-700 ring-orange-200" },
  Delivering: { label: "Delivering", classes: "bg-purple-50 text-purple-700 ring-purple-200" },
  Delivered: { label: "Delivered", classes: "bg-green-50 text-green-700 ring-green-200" },
  DeliveryFailed: { label: "Failed", classes: "bg-red-50 text-red-700 ring-red-200" },
  Cancelled: { label: "Cancelled", classes: "bg-gray-100 text-gray-500 ring-gray-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: "bg-gray-100 text-gray-600 ring-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}
