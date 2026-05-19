"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMenuCatalog, type MenuItem, type OptionChoice } from "@/lib/menu/catalog";

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

function SkeletonCard() {
  return (
    <article className="surface-card overflow-hidden">
      <div className="h-44 w-full animate-pulse bg-[color:var(--surface-zone)]" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-20 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-6 w-5/6 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
      </div>
    </article>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isFallbackData, setIsFallbackData] = useState(false);
  const [selectionMap, setSelectionMap] = useState<Record<string, ItemSelection>>({});

  useEffect(() => {
    let active = true;
    const minLoadingDelayMs = 650;
    const startedAt = Date.now();

    async function load() {
      setIsLoading(true);
      const result = await getMenuCatalog();
      if (!active) return;

      setItems(result.items);
      setIsFallbackData(result.fromFallback);
      setSelectionMap((current) => {
        const next = { ...current };
        for (const item of result.items) {
          if (!next[item.slug]) {
            next[item.slug] = {
              size: item.sizeOptions[0]?.value,
              crust: item.crustOptions[0]?.value,
            };
          }
        }
        return next;
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
  }, []);

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const visibleItems = useMemo(() => {
    if (selectedCategory === "All") return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  function updateSelection(slug: string, patch: Partial<ItemSelection>) {
    setSelectionMap((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], ...patch },
    }));
  }

  return (
    <section className="space-y-6">
      <header className="surface-card motion-rise p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">U1 · Browse Menus</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pizza Menu Command Grid</h1>
        <p className="mt-3 max-w-3xl text-[color:var(--ink-soft)]">
          Click vao bat ky vung nao trong card (tru control) de mo man hinh chi tiet mon an. Control customize van xu ly truc tiep ngay tai luoi menu.
        </p>
        {isFallbackData ? (
          <p className="mt-4 inline-flex rounded-md bg-[#fff4ec] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#9d482f]">
            Dang hien thi du lieu mau vi API /items chua san sang (fallback mode)
          </p>
        ) : (
          <p className="mt-4 inline-flex rounded-md bg-[#edf8ee] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#1f6f28]">
            Du lieu dang duoc tai tu API /items (database-backed)
          </p>
        )}
      </header>

      <div className="surface-card p-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  isActive
                    ? "bg-[color:var(--ink)] text-white"
                    : "border border-[color:var(--ghost-border)] bg-white text-[color:var(--ink-soft)] hover:bg-[color:var(--surface-zone)]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="font-display text-2xl font-semibold">Khong tim thay mon nao</p>
          <p className="mt-2 text-sm text-[color:var(--ink-muted)]">Thu doi danh muc khac hoac reset bo loc ve All.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const selection = selectionMap[item.slug] ?? {};
            const totalPrice = item.priceVnd + findDelta(item.sizeOptions, selection.size) + findDelta(item.crustOptions, selection.crust);

            return (
              <article key={item.slug} className="surface-card relative flex flex-col overflow-hidden">
                <Link href={`/menu/${item.slug}`} className="absolute inset-0 z-10" aria-label={`View details for ${item.name}`} />

                <div className="pointer-events-none relative z-0">
                  <div className="relative h-44">
                    <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" />
                    {item.badge ? (
                      <span className="absolute left-3 top-3 rounded bg-[color:var(--secondary)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">{item.category}</p>
                    <h2 className="font-display text-xl font-semibold leading-tight">{item.name}</h2>
                    <p className="line-clamp-2 text-sm text-[color:var(--ink-soft)]">{item.description}</p>
                  </div>
                </div>

                <div className="relative z-20 mt-auto space-y-3 p-5 pt-0">
                  {item.sizeOptions.length > 0 ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">Size</label>
                      <select
                        value={selection.size ?? item.sizeOptions[0]?.value}
                        onChange={(event) => updateSelection(item.slug, { size: event.target.value })}
                        className="w-full rounded-md border border-[color:var(--ghost-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">Crust</label>
                      <select
                        value={selection.crust ?? item.crustOptions[0]?.value}
                        onChange={(event) => updateSelection(item.slug, { crust: event.target.value })}
                        className="w-full rounded-md border border-[color:var(--ghost-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
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

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-display text-xl font-bold">{formatVnd(totalPrice)}</span>
                    <Link
                      href={`/menu/${item.slug}`}
                      className="shell-action signal-action px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                    >
                      Customize
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
