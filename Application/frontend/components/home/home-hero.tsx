"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { ClockIcon } from "@/components/home/icons";

/**
 * Photo-led asymmetric hero: copy left (brand accent on "30 minutes"), the
 * margherita photo right with a single functional delivery chip. Entrance
 * animation plays on load and degrades to static under reduced motion.
 */
export function HomeHero() {
  const reduce = useReducedMotion();
  const rise = (y: number, delay: number) => ({
    initial: reduce ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-card">
      <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="space-y-6">
          <motion.span
            {...rise(8, 0)}
            className="inline-flex items-center rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand-fg"
          >
            Fresh from our Hanoi ovens
          </motion.span>
          <motion.h1
            {...rise(16, 0.05)}
            className="text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]"
          >
            Hot pizza at your door in <span className="text-brand-fg">30 minutes</span>.
          </motion.h1>
          <motion.p
            {...rise(16, 0.1)}
            className="max-w-md text-base leading-relaxed text-muted sm:text-lg"
          >
            Handcrafted on fresh dough, baked to order, and rushed hot to your door across inner
            Hanoi.
          </motion.p>
          <motion.div {...rise(16, 0.15)} className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/menu"
              className="inline-flex h-11 items-center rounded-xl bg-brand px-6 font-bold text-on-brand shadow-sm transition hover:bg-brand-hover active:scale-[0.98]"
            >
              Order now
            </Link>
            <Link
              href="/combos"
              className="inline-flex h-11 items-center rounded-xl border border-line bg-card px-6 font-semibold text-fg transition hover:bg-surface-hover active:scale-[0.98]"
            >
              See combos
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/photos/hero-margherita.jpg"
            alt="Margherita pizza fresh from the oven, topped with basil"
            width={1200}
            height={801}
            fetchPriority="high"
            decoding="async"
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl shadow-black/10"
          />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm font-semibold text-fg shadow-lg ring-1 ring-line">
            <ClockIcon className="h-4 w-4 text-brand-fg" />
            30 min delivery
          </span>
        </motion.div>
      </div>
    </section>
  );
}
