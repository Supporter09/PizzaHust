"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

export type NavItem = { href: string; label: string; active: boolean };

const SPRING = { stiffness: 420, damping: 38, mass: 0.8 };

/**
 * Desktop primary nav, dead-centered on the header. A brand-red pill snaps to
 * whichever item the cursor is over, springs back to the active route on leave,
 * and settles on the item the user clicks. A white label layer is clipped to the
 * pill (counter-translated to stay locked to the base labels) so contrast holds
 * mid-slide without the white-on-white flash a plain colour swap would cause.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [boxes, setBoxes] = useState<{ left: number; width: number }[]>([]);
  const [navWidth, setNavWidth] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const w = useMotionValue(0);
  const opacity = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sw = useSpring(w, SPRING);
  const sOpacity = useSpring(opacity, { stiffness: 500, damping: 40 });
  const px = reduce ? x : sx;
  const pw = reduce ? w : sw;
  const pOpacity = reduce ? opacity : sOpacity;
  const labelX = useTransform(px, (v) => -v);

  const activeIndex = items.findIndex((i) => i.active);
  const key = items.map((i) => i.href).join("|");

  // Measure each item's box + the full nav width; keep current on resize / changes.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      setNavWidth(nav.scrollWidth);
      setBoxes(
        itemRefs.current
          .slice(0, items.length)
          .map((el) => (el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 })),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
    // key changes whenever the item set changes (e.g. Admin appears).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Position the pill: hovered item wins, else the active route, else hide it.
  const visibleRef = useRef(false);
  useEffect(() => {
    const target = hovered ?? (activeIndex >= 0 ? activeIndex : null);
    const box = target == null ? undefined : boxes[target];
    if (!box || box.width === 0) {
      opacity.set(0);
      visibleRef.current = false;
      return;
    }
    if (!visibleRef.current) {
      // Appear directly at the target rather than sliding in from the origin.
      x.jump(box.left);
      w.jump(box.width);
      sx.jump(box.left);
      sw.jump(box.width);
    }
    x.set(box.left);
    w.set(box.width);
    opacity.set(1);
    visibleRef.current = true;
  }, [hovered, activeIndex, boxes, x, w, sx, sw, opacity]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      onPointerLeave={() => setHovered(null)}
      className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 text-sm sm:flex"
    >
      {/* Sliding brand pill with a white label layer clipped to it. */}
      <motion.div
        aria-hidden
        style={{ x: px, width: pw, opacity: pOpacity }}
        className="pointer-events-none absolute left-0 top-0 z-0 h-9 overflow-hidden rounded-full bg-brand shadow-sm"
      >
        <motion.div style={{ x: labelX, width: navWidth || undefined }} className="flex h-9 items-center gap-1">
          {items.map((it) => (
            <span key={it.href} className="whitespace-nowrap px-4 py-2 font-semibold text-on-brand">
              {it.label}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {items.map((it, i) => (
        <Link
          key={it.href}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          onMouseEnter={() => setHovered(i)}
          className="relative z-10 whitespace-nowrap rounded-full px-4 py-2 font-semibold text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg/60"
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
