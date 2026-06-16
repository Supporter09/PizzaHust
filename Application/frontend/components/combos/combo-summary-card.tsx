import { ImageViewer } from "@/components/menu/image-viewer";
import { formatVnd } from "@/lib/format";
import { formatComboComponent } from "@/lib/format-combo-component";
import type { ComboDetail } from "@/lib/api/combos";

export function ComboSummaryCard({
  combo,
  live = null,
}: {
  combo: ComboDetail;
  /**
   * Live quote from the customizer. When present, the headline price mirrors the
   * customer's picks (size, crust, toppings, slot upgrades) so it never diverges
   * from the running total beside the Add button. Null until the picks are done,
   * in which case we show the combo's base deal.
   */
  live?: { total: number; savings: number } | null;
}) {
  const charged = live ? live.total : combo.combo_price_vnd;
  const savings = live ? live.savings : combo.savings_vnd;
  const fullValue = live ? live.total + live.savings : combo.items_total_vnd;
  return (
    <aside className="overflow-hidden rounded-2xl border border-line bg-card lg:sticky lg:top-6">
      <ImageViewer images={combo.images ?? []} name={combo.name} />
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-fg">{combo.name}</h1>
          {savings > 0 ? (
            <span className="shrink-0 rounded-full bg-warning-subtle px-2.5 py-1 text-xs font-bold text-warning">
              Save {formatVnd(savings)}
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {combo.components.map((c) => formatComboComponent(c)).join(" · ")}
        </p>
        <p className="flex flex-wrap items-baseline gap-3 pt-1" aria-live="polite">
          {savings > 0 ? (
            <span className="text-sm text-muted line-through">{formatVnd(fullValue)}</span>
          ) : null}
          <span className="text-3xl font-extrabold text-brand-fg">{formatVnd(charged)}</span>
        </p>
      </div>
    </aside>
  );
}
