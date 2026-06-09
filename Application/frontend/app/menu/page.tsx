"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CategoryFilter } from "@/components/menu/category-filter";
import { PizzaCard } from "@/components/menu/pizza-card";
import {
  fetchCategories,
  fetchItems,
  type MenuCategory,
  type MenuItem,
} from "@/lib/api/menu";

type Status = "loading" | "ready" | "error";

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    Promise.all([fetchCategories(), fetchItems()])
      .then(([cats, list]) => {
        setCategories(cats);
        setItems(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(
    () => (active === null ? items : items.filter((i) => i.category_id === active)),
    [items, active],
  );

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-fg">Menu</h1>

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load the menu.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "ready" ? (
        <CategoryFilter categories={categories} active={active} onSelect={setActive} />
      ) : null}

      {status === "loading" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-surface-active" />
          ))}
        </div>
      ) : null}

      {status === "ready" && visible.length === 0 ? (
        <p className="py-12 text-center text-muted">No items in this category.</p>
      ) : null}

      {status === "ready" && visible.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <Link
              key={item.product_id}
              href={`/menu/${item.product_id}`}
              aria-label={item.name}
              className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <PizzaCard
                name={item.name}
                basePriceVnd={item.base_price_vnd}
                isPizza={item.is_pizza}
                imageUrl={item.image_url ?? null}
              />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}