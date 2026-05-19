"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMenuItemBySlug, type MenuItem, type OptionChoice } from "@/lib/menu/catalog";

type ItemSelection = {
  size?: string;
  crust?: string;
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function findDelta(options: OptionChoice[], current?: string): number {
  if (!current) return 0;
  return options.find((option) => option.value === current)?.priceDeltaVnd ?? 0;
}

export default function MenuDetailPage({ params }: { params: { slug: string } }) {
  const [item, setItem] = useState<MenuItem | null>(null);
  const [selection, setSelection] = useState<ItemSelection>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFallbackData, setIsFallbackData] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const minLoadingDelayMs = 420;

    async function load() {
      const result = await getMenuItemBySlug(params.slug);
      if (!active) return;

      setItem(result.item);
      setIsFallbackData(result.fromFallback);
      setSelection({
        size: result.item?.sizeOptions[0]?.value,
        crust: result.item?.crustOptions[0]?.value,
      });

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, minLoadingDelayMs - elapsed);
      setTimeout(() => {
        if (active) setIsLoading(false);
      }, remaining);
    }

    void load();
    return () => {
      active = false;
    };
  }, [params.slug]);

  const totalPrice = useMemo(() => {
    if (!item) return 0;
    return item.priceVnd + findDelta(item.sizeOptions, selection.size) + findDelta(item.crustOptions, selection.crust);
  }, [item, selection]);

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="surface-card animate-pulse p-7">
          <div className="h-6 w-40 rounded bg-[color:var(--surface-zone)]" />
          <div className="mt-4 h-10 w-2/3 rounded bg-[color:var(--surface-zone)]" />
          <div className="mt-3 h-5 w-full rounded bg-[color:var(--surface-zone)]" />
        </div>
        <div className="surface-card animate-pulse p-6">
          <div className="h-72 w-full rounded bg-[color:var(--surface-zone)]" />
        </div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="surface-card p-8 text-center">
        <p className="font-display text-3xl font-semibold">Khong tim thay mon an</p>
        <p className="mt-2 text-[color:var(--ink-muted)]">Slug khong ton tai hoac API chua tra ve mon nay.</p>
        <Link href="/menu" className="shell-action mt-5 inline-flex px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em]">
          Quay lai menu
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="surface-card p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">U2 · Item Details</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{item.name}</h1>
        <p className="mt-3 max-w-3xl text-[color:var(--ink-soft)]">{item.description}</p>
        {isFallbackData ? (
          <p className="mt-4 inline-flex rounded-md bg-[#fff4ec] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#9d482f]">
            Dang dung fallback data vi API /items chua san sang
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card overflow-hidden">
          <div className="relative h-72 sm:h-96">
            <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" priority />
            {item.badge ? (
              <span className="absolute left-4 top-4 rounded bg-[color:var(--secondary)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                {item.badge}
              </span>
            ) : null}
          </div>
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">{item.category}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Ban dang o man hinh chi tiet voi scale lon hon de quan sat thanh phan va tuy chinh de dang hon.
            </p>
          </div>
        </article>

        <aside className="surface-card p-6 sm:p-7">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[0.04em]">Customize</h2>

          <div className="mt-5 space-y-5">
            {item.sizeOptions.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">Pizza Size</label>
                <select
                  value={selection.size ?? item.sizeOptions[0]?.value}
                  onChange={(event) => setSelection((prev) => ({ ...prev, size: event.target.value }))}
                  className="w-full rounded-md border border-[color:var(--ghost-border)] bg-white px-4 py-3 text-base outline-none focus:border-[color:var(--primary)]"
                >
                  {item.sizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.priceDeltaVnd > 0 ? ` (+${formatVnd(option.priceDeltaVnd)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {item.crustOptions.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">Crust Type</label>
                <select
                  value={selection.crust ?? item.crustOptions[0]?.value}
                  onChange={(event) => setSelection((prev) => ({ ...prev, crust: event.target.value }))}
                  className="w-full rounded-md border border-[color:var(--ghost-border)] bg-white px-4 py-3 text-base outline-none focus:border-[color:var(--primary)]"
                >
                  {item.crustOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.priceDeltaVnd > 0 ? ` (+${formatVnd(option.priceDeltaVnd)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="mt-7 rounded-lg bg-[color:var(--surface-zone)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">Current Quote</p>
            <p className="font-display mt-2 text-4xl font-bold">{formatVnd(totalPrice)}</p>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" className="shell-action signal-action flex-1 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]">
              Add To Cart
            </button>
            <Link href="/menu" className="shell-action px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]">
              Back
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
