import { ClockIcon, PinIcon, TruckIcon, WalletIcon } from "@/components/home/icons";

/**
 * Four real delivery facts in a single hairline-divided strip (replaces the old
 * three identical icon cards). 2x2 on mobile, single row on desktop.
 */
const ITEMS = [
  { Icon: ClockIcon, value: "30 min", label: "Average delivery" },
  { Icon: TruckIcon, value: "Free delivery", label: "Over 200.000₫" },
  { Icon: PinIcon, value: "Inner Hanoi", label: "Service area" },
  { Icon: WalletIcon, value: "Cash", label: "On delivery" },
] as const;

export function TrustStrip() {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card md:grid-cols-4 md:divide-y-0">
      {ITEMS.map(({ Icon, value, label }) => (
        <div key={value} className="flex items-center gap-3 p-5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-fg">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold leading-tight text-fg">{value}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
