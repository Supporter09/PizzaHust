import Link from "next/link";

import { CoverFallback } from "@/components/cover-fallback";
import { imageSrc } from "@/lib/api/asset-url";
import { formatVnd } from "@/lib/format";
import type { PublicCombo } from "@/lib/api/combos";

export function ComboCard({ combo }: { combo: PublicCombo }) {
  const cover = combo.image_url ?? combo.items.find((i) => i.image_url)?.image_url ?? null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      <div className="relative">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc(cover)}
            alt={combo.name}
            loading="lazy"
            className="aspect-[16/7] w-full object-cover"
          />
        ) : (
          <CoverFallback label={combo.name} className="aspect-[16/7] w-full" />
        )}
        {combo.savings_vnd > 0 ? (
          <span className="absolute right-3 top-3 rounded-full bg-success-subtle px-3 py-1.5 text-xs font-bold text-success">
            Save {formatVnd(combo.savings_vnd)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-xl font-bold text-fg">{combo.name}</h3>
        {combo.description ? <p className="text-sm text-muted">{combo.description}</p> : null}
        <ul className="grid gap-2.5 rounded-xl border border-line bg-surface p-4">
          {combo.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-fg">
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc(it.image_url)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <CoverFallback className="h-9 w-9 shrink-0 rounded-lg" />
              )}
              <span className="min-w-7 font-bold">{it.quantity}×</span>
              <span>{it.name}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="flex flex-wrap items-baseline gap-2.5">
            {combo.savings_vnd > 0 ? (
              <span className="text-sm text-muted line-through">
                {formatVnd(combo.items_total_vnd)}
              </span>
            ) : null}
            <span className="text-2xl font-extrabold text-brand-fg">
              {formatVnd(combo.combo_price_vnd)}
            </span>
          </p>
          <Link
            href={`/combos/${combo.combo_id}`}
            aria-label={`Order Now — ${combo.name}`}
            className="btn-primary inline-flex h-11 items-center px-5 text-sm"
          >
            Order Now
          </Link>
        </div>
      </div>
    </article>
  );
}
