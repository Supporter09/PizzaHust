"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ComboCard } from "@/components/combos/combo-card";
import { CoverFallback } from "@/components/cover-fallback";
import { PizzaCard } from "@/components/menu/pizza-card";
import { fetchCombos, type PublicCombo } from "@/lib/api/combos";
import { fetchItems, type MenuItem } from "@/lib/api/menu";

const VALUE_PROPS = [
  {
    title: "30 Min Delivery",
    body: "Hot pizzas at your door in 30 minutes or less across inner Hanoi.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    title: "Quality Guaranteed",
    body: "Premium ingredients and authentic recipes, baked fresh to order.",
    icon: (
      <>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Free Delivery",
    body: "Free delivery on every order over 200.000₫ — no hidden fees.",
    icon: (
      <>
        <path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2" />
        <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1" />
        <circle cx="7.5" cy="18.5" r="2.5" />
        <circle cx="17.5" cy="18.5" r="2.5" />
      </>
    ),
  },
];

export default function HomePage() {
  const [pizzas, setPizzas] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<PublicCombo[]>([]);

  useEffect(() => {
    let alive = true;
    // Both sections are optional decoration: on fetch failure they simply
    // don't render (length-0 guards below), so errors are deliberately ignored.
    fetchItems()
      .then((items) => {
        if (alive) setPizzas(items.filter((i) => i.is_pizza).slice(0, 4));
      })
      .catch(() => undefined);
    fetchCombos()
      .then((list) => {
        if (alive) setCombos(list.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand px-6 py-10 text-on-brand sm:px-10 sm:py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <p className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            Delivering across Hanoi in minutes
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Hot &amp; Fresh Pizza Delivered Fast</h1>
          <p className="max-w-xl text-base text-on-brand/85 sm:text-lg">
            Handcrafted pizzas with premium ingredients, baked to order and rushed straight to your
            door.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/menu"
              style={{ color: "var(--brand-hover)" }}
              className="inline-flex h-11 items-center rounded-xl bg-on-brand px-6 font-bold shadow-md transition hover:-translate-y-0.5"
            >
              Order Now
            </Link>
            <Link
              href="/combos"
              className="inline-flex h-11 items-center rounded-xl border border-white/40 px-6 font-semibold text-on-brand transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              View Combos
            </Link>
          </div>
          <dl className="flex flex-wrap gap-8 pt-4">
            {[
              ["30", "Min avg delivery"],
              ["4.9★", "Customer rating"],
              ["50+", "Pizzas & sides"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-bold">{value}</dt>
                <dd className="text-xs text-on-brand/80">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <CoverFallback label="PizzaHust" className="aspect-[4/3] w-full rounded-2xl border border-white/20" />
          <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-fg shadow">
            ⏱ 30 min
          </span>
          <span className="absolute bottom-3 right-3 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-fg shadow">
            🚚 Free delivery
          </span>
        </div>
      </section>

      {/* Value props */}
      <section className="grid gap-6 sm:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <div key={prop.title} className="rounded-2xl border border-line bg-card p-6 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand-fg">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                {prop.icon}
              </svg>
            </span>
            <h2 className="mt-4 font-semibold text-fg">{prop.title}</h2>
            <p className="mt-1 text-sm text-muted">{prop.body}</p>
          </div>
        ))}
      </section>

      {/* Featured pizzas */}
      {pizzas.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-fg">Featured Pizzas</h2>
              <p className="text-sm text-muted">Our most popular handcrafted pies.</p>
            </div>
            <Link href="/menu" className="shrink-0 text-sm font-semibold text-brand-fg hover:underline">
              View all items →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pizzas.map((item) => (
              <PizzaCard
                key={item.product_id}
                productId={item.product_id}
                name={item.name}
                basePriceVnd={item.base_price_vnd}
                isPizza={item.is_pizza}
                imageUrl={item.image_url ?? null}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Combo deals */}
      {combos.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-fg">Special Combo Deals</h2>
              <p className="text-sm text-muted">More pizza, less spend — for a limited time.</p>
            </div>
            <Link href="/combos" className="shrink-0 text-sm font-semibold text-brand-fg hover:underline">
              View all combos →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {combos.map((combo) => (
              <ComboCard key={combo.combo_id} combo={combo} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
