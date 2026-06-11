"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PickOptions } from "@/components/combos/pick-options";
import { SlotPicker } from "@/components/combos/slot-picker";
import { QuantityStepper } from "@/components/menu/quantity-stepper";
import { quoteCart } from "@/lib/api/cart";
import type { ComboDetail } from "@/lib/api/combos";
import {
  buildComboLine,
  initComboSelections,
  isQuoteReady,
  setPickOptions,
  setPickProduct,
  type ComboSelections,
} from "@/lib/combo-selections";
import { formatVnd } from "@/lib/format";
import { isComboNoLongerActive, isSelectionRuleViolation } from "@/lib/quote-errors";

export function ComboCustomizer({ combo }: { combo: ComboDetail }) {
  const [selections, setSelections] = useState<ComboSelections>(() =>
    initComboSelections(combo),
  );
  const [quantity, setQuantity] = useState(1);
  const [estimate, setEstimate] = useState<{ total: number; savings: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [selectionIssue, setSelectionIssue] = useState(false);

  const ready = isQuoteReady(selections);
  const canQuote = ready && !expired;
  const shownEstimate = canQuote ? estimate : null;

  useEffect(() => {
    if (!canQuote) {
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      if (!active) return;
      setQuoting(true);
      quoteCart({
        redeem_points: 0,
        lines: [buildComboLine(combo.combo_id, selections, quantity)],
      })
        .then((q) => {
          if (!active) return;
          setSelectionIssue(false);
          setEstimate({ total: q.total_vnd, savings: q.discount_combo_vnd });
        })
        .catch((err) => {
          if (!active) return;
          if (isComboNoLongerActive(err)) setExpired(true);
          else if (isSelectionRuleViolation(err)) setSelectionIssue(true);
          setEstimate(null);
        })
        .finally(() => {
          if (active) setQuoting(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [combo.combo_id, selections, quantity, canQuote]);

  if (expired) {
    return (
      <div
        data-testid="combo-expired"
        className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg"
      >
        <p>This combo is no longer active.</p>
        <Link href="/combos" className="btn-primary mt-3 inline-flex h-11 items-center px-5">
          Browse current combos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {combo.components.map((c) => (
        <section key={c.combo_item_id} className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold text-fg">
            {c.quantity > 1 ? `${c.quantity}× ` : ""}
            {c.name}
            {c.kind === "category" ? (
              <span className="ml-2 text-xs font-medium text-muted">customer&apos;s choice</span>
            ) : null}
          </h2>
          {selections[c.combo_item_id].map((unit, i) => (
            <div key={i} className="space-y-3">
              {c.quantity > 1 ? (
                <p className="text-xs font-semibold text-muted">Pick {i + 1}</p>
              ) : null}
              {c.kind === "category" ? (
                <SlotPicker
                  label={`${c.name} pick ${i + 1}`}
                  products={c.eligible_products ?? []}
                  selectedProductId={unit.productId}
                  onPick={(pid) =>
                    setSelections((s) => setPickProduct(s, c.combo_item_id, i, pid))
                  }
                />
              ) : null}
              {unit.productId !== null ? (
                <PickOptions
                  key={unit.productId}
                  productId={unit.productId}
                  options={unit.options}
                  onOptionsChange={(o) =>
                    setSelections((s) => setPickOptions(s, c.combo_item_id, i, o))
                  }
                />
              ) : null}
            </div>
          ))}
        </section>
      ))}

      {selectionIssue ? (
        <div
          data-testid="combo-quote-error"
          role="alert"
          className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg"
        >
          Some of your selections are no longer available. Please adjust your picks or
          options above.
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <p className="text-right">
          <span className="block text-xs text-muted">
            {ready ? "Combo total" : "Finish your picks to see the total"}
          </span>
          <span
            data-testid="combo-estimate"
            aria-live="polite"
            className="text-2xl font-bold text-brand"
          >
            {shownEstimate !== null
              ? formatVnd(shownEstimate.total)
              : quoting && canQuote
                ? "…"
                : !ready
                  ? "…"
                  : "—"}
          </span>
          {shownEstimate !== null && shownEstimate.savings > 0 ? (
            <span data-testid="combo-savings" className="block text-sm font-medium text-muted">
              You save {formatVnd(shownEstimate.savings)}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}