import { formatVnd } from "@/lib/format";
import type { PublicCombo } from "@/lib/api/combos";

export function ComboCard({ combo }: { combo: PublicCombo }) {
  const cover = combo.items.find((i) => i.image_url)?.image_url ?? null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      {cover ? (
        <img src={cover} alt={combo.name} loading="lazy" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-surface-active text-sm text-muted">
          No image
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-fg">{combo.name}</h3>
          {combo.savings_vnd > 0 ? (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              Save {formatVnd(combo.savings_vnd)}
            </span>
          ) : null}
        </div>
        {combo.description ? <p className="text-sm text-muted">{combo.description}</p> : null}
        <ul className="text-sm text-muted">
          {combo.items.map((i) => (
            <li key={i.product_id}>
              {i.quantity}× {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-bold text-brand">{formatVnd(combo.combo_price_vnd)}</span>
          {combo.savings_vnd > 0 ? (
            <span className="text-sm text-muted line-through">{formatVnd(combo.items_total_vnd)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}