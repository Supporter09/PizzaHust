"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ClosingCta } from "@/components/home/closing-cta";
import { CraftBento } from "@/components/home/craft-bento";
import { HomeHero } from "@/components/home/home-hero";
import { Reveal } from "@/components/home/reveal";
import { TrustStrip } from "@/components/home/trust-strip";
import { ComboCard } from "@/components/combos/combo-card";
import { PizzaCard } from "@/components/menu/pizza-card";
import { fetchCombos, type PublicCombo } from "@/lib/api/combos";
import { fetchItems, type MenuItem } from "@/lib/api/menu";

export default function HomePage() {
  const [featured, setFeatured] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<PublicCombo[]>([]);

  useEffect(() => {
    let alive = true;
    // Both rails are optional: on fetch failure they simply don't render
    // (length-0 guards below), so errors are deliberately ignored.
    fetchItems()
      .then((items) => {
        if (alive) setFeatured(items.slice(0, 4));
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
    <div className="space-y-16 sm:space-y-20">
      <HomeHero />

      <Reveal>
        <TrustStrip />
      </Reveal>

      {featured.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                Fresh from the menu
              </h2>
              <p className="mt-1 text-sm text-muted">Popular pizzas, ready to order.</p>
            </div>
            <Link
              href="/menu"
              className="shrink-0 text-sm font-semibold text-brand-fg hover:underline"
            >
              View all items →
            </Link>
          </div>
          <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <PizzaCard
                key={item.product_id}
                productId={item.product_id}
                name={item.name}
                basePriceVnd={item.base_price_vnd}
                hasPriceOptions={item.has_price_options}
                imageUrl={item.image_url ?? null}
              />
            ))}
          </Reveal>
        </section>
      ) : null}

      <Reveal>
        <CraftBento />
      </Reveal>

      {combos.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Combo deals</h2>
              <p className="mt-1 text-sm text-muted">More pizza for less.</p>
            </div>
            <Link
              href="/combos"
              className="shrink-0 text-sm font-semibold text-brand-fg hover:underline"
            >
              View all combos →
            </Link>
          </div>
          <Reveal className="grid gap-6 lg:grid-cols-2">
            {combos.map((combo) => (
              <ComboCard key={combo.combo_id} combo={combo} />
            ))}
          </Reveal>
        </section>
      ) : null}

      <ClosingCta />
    </div>
  );
}
