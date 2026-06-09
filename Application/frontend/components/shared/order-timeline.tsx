"use client";

const ORDER_STATUSES = [
  "Received",
  "Preparing",
  "ReadyForDispatch",
  "Delivering",
  "Delivered",
] as const;

const STATUS_LABELS: Record<string, string> = {
  Received: "Order Received",
  Preparing: "Preparing",
  ReadyForDispatch: "Ready for Pickup",
  DispatchPending: "Dispatch Pending",
  Delivering: "Out for Delivery",
  Delivered: "Delivered",
  DeliveryFailed: "Delivery Failed",
  Cancelled: "Cancelled",
};

export interface TimelineEntry {
  status: string;
  at: string;
}

interface Props {
  currentStatus: string;
  timeline?: TimelineEntry[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function OrderTimeline({ currentStatus, timeline = [] }: Props) {
  const timeMap = Object.fromEntries(timeline.map((e) => [e.status, e.at]));

  const isFailed =
    currentStatus === "DeliveryFailed" || currentStatus === "Cancelled" || currentStatus === "DispatchPending";

  const steps = isFailed
    ? [...ORDER_STATUSES.filter((s) => timeMap[s]), currentStatus]
    : ORDER_STATUSES;

  const currentIdx = steps.indexOf(currentStatus as (typeof ORDER_STATUSES)[number]);

  return (
    <ol className="relative border-l border-line ml-3 space-y-6">
      {steps.map((step, i) => {
        const at = timeMap[step];
        const done = currentIdx >= i || !!at;
        const active = step === currentStatus;

        return (
          <li key={step} className="ml-6">
            <span
              className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${
                done ? "bg-brand text-on-brand" : "bg-surface-hover text-muted"
              } ${active ? "ring-brand/20" : ""}`}
            >
              {done ? (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z" />
                </svg>
              ) : (
                <span className="h-2 w-2 rounded-full bg-line" />
              )}
            </span>
            <div className={`font-medium text-sm ${active ? "text-brand-fg" : done ? "text-fg" : "text-muted"}`}>
              {STATUS_LABELS[step] ?? step}
            </div>
            {at && (
              <time className="text-xs text-muted">{formatTime(at)}</time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
