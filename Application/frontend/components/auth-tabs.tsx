"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

type AuthTab = "login" | "register";

const TABS: { id: AuthTab; label: string }[] = [
  { id: "login", label: "Sign In" },
  { id: "register", label: "Create Account" },
];

// Track inner padding (p-1 = 4px). The pill lives inside this inset.
const PAD = 4;

type AuthTabsProps = {
  active: AuthTab;
  disabled?: boolean;
  onSelect: (tab: AuthTab) => void;
};

/**
 * Segmented Sign In / Create Account control with a brand-red pill that follows
 * the cursor while hovering, springs back to the active tab when the pointer
 * leaves, and settles on the tab the user clicks. The white label layer is a
 * counter-translated copy clipped to the pill, so contrast holds wherever the
 * pill currently sits. Mouse-only follow; touch and reduced-motion just snap.
 */
export function AuthTabs({ active, disabled = false, onSelect }: AuthTabsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [slotW, setSlotW] = useState(0);
  const reduce = useReducedMotion();

  const activeIndex = active === "login" ? 0 : 1;

  // Pill left offset in px (0 = left slot, slotW = right slot). The spring
  // smooths follow + settle; reduced motion drives the raw value (instant).
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 420, damping: 36, mass: 0.7 });
  const pillX = reduce ? x : springX;
  // Reveal labels counter-translate so they stay locked to the base labels.
  const labelX = useTransform(pillX, (v) => -v);

  // Measure one slot (half the inner width) and keep it current on resize.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setSlotW((el.clientWidth - PAD * 2) / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rest position = the selected tab's slot. Runs on select and on resize.
  useEffect(() => {
    x.set(activeIndex * slotW);
  }, [activeIndex, slotW, x]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || reduce || slotW === 0 || event.pointerType !== "mouse") return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const local = event.clientX - rect.left - PAD;
    // Centre the pill on the cursor, clamped so it stays fully inside the track.
    x.set(Math.min(Math.max(local - slotW / 2, 0), slotW));
  };

  const handlePointerLeave = () => {
    if (!disabled) x.set(activeIndex * slotW);
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label="Authentication mode"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative mb-6 grid grid-cols-2 rounded-full bg-surface-hover p-1 dark:bg-surface-active"
    >
      {/* Pill — sits above the base labels; clicks pass through to the buttons. */}
      <motion.div
        aria-hidden
        style={{ x: pillX, width: slotW || undefined }}
        className="pointer-events-none absolute inset-y-1 left-1 z-20 overflow-hidden rounded-full bg-brand shadow-sm"
      >
        <motion.div
          style={{ x: labelX, width: slotW ? slotW * 2 : undefined }}
          className="grid h-full grid-cols-2"
        >
          {TABS.map((t) => (
            <span
              key={t.id}
              className="flex items-center justify-center px-3 py-2.5 text-sm font-semibold text-on-brand"
            >
              {t.label}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Base labels — the clickable layer, readable on the grey track. */}
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          disabled={disabled}
          onClick={() => onSelect(t.id)}
          className="relative z-10 rounded-full px-3 py-2.5 text-sm font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg/60 disabled:opacity-60"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
