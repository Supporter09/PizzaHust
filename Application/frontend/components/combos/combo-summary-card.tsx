import { CoverFallback } from "@/components/cover-fallback";
import { formatVnd } from "@/lib/format";
import { formatComboComponent } from "@/lib/format-combo-component";
import type { ComboDetail } from "@/lib/api/combos";

export function ComboSummaryCard({ combo }: { combo: ComboDetail }) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-line bg-card lg:sticky lg:top-6">
      {combo.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={combo.image_url} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <CoverFallback label={combo.name} className="aspect-video w-full" />
      )}
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-fg">{combo.name}</h1>
          {combo.savings_vnd > 0 ? (
            <span className="shrink-0 rounded-full bg-warning-subtle px-2.5 py-1 text-xs font-bold text-warning">
              Save {formatVnd(combo.savings_vnd)}
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {combo.components.map((c) => formatComboComponent(c)).join(" · ")}
        </p>
        <p className="flex flex-wrap items-baseline gap-3 pt-1">
          {combo.savings_vnd > 0 ? (
            <span className="text-sm text-muted line-through">
              {formatVnd(combo.items_total_vnd)}
            </span>
          ) : null}
          <span className="text-3xl font-extrabold text-brand-fg">
            {formatVnd(combo.combo_price_vnd)}
          </span>
        </p>
      </div>
    </aside>
  );
}
