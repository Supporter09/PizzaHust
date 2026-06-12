"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { PickOptions } from "@/components/combos/pick-options";
import { SlotPicker } from "@/components/combos/slot-picker";
import { StepHeader } from "@/components/combos/step-header";
import { quoteCart } from "@/lib/api/cart";
import type { ComboComponent, ComboDetail } from "@/lib/api/combos";
import {
  buildComboLine,
  initComboSelections,
  isQuoteReady,
  setPickOptions,
  setPickProduct,
  slotProgress,
  type ComboSelections,
  type PickUnit,
} from "@/lib/combo-selections";
import { formatVnd } from "@/lib/format";
import { isComboNoLongerActive, isSelectionRuleViolation } from "@/lib/quote-errors";

function pickedProductName(c: ComboComponent, unit: PickUnit): string {
  if (c.kind === "product") return c.name;
  return (
    c.eligible_products?.find((p) => p.product_id === unit.productId)?.name ?? c.name
  );
}

export function ComboCustomizer({ combo }: { combo: ComboDetail }) {
  const [selections, setSelections] = useState<ComboSelections>(() =>
    initComboSelections(combo),
  );
  const [estimate, setEstimate] = useState<{ total: number; savings: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [selectionIssue, setSelectionIssue] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const { addLine } = useCart();

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
        lines: [buildComboLine(combo.combo_id, selections, 1)],
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
  }, [combo.combo_id, selections, canQuote]);

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

  // The mockup numbers every pick as its own step, so flatten (component, unit)
  // pairs into one numbered list.
  const steps = combo.components.flatMap((c) =>
    selections[c.combo_item_id].map((unit, unitIndex) => ({ component: c, unit, unitIndex })),
  );

  return (
    <div className="space-y-8">
      {steps.map(({ component: c, unit, unitIndex }, idx) => (
        <section key={`${c.combo_item_id}-${unitIndex}`} className="space-y-3">
          <StepHeader
            number={idx + 1}
            title={c.name}
            progress={
              c.kind === "category" ? slotProgress(selections[c.combo_item_id]) : undefined
            }
          />
          {c.kind === "category" ? (
            <SlotPicker
              label={`${c.name} pick ${unitIndex + 1}`}
              products={c.eligible_products ?? []}
              selectedProductId={unit.productId}
              onPick={(pid) =>
                setSelections((s) => setPickProduct(s, c.combo_item_id, unitIndex, pid))
              }
            />
          ) : null}
          {unit.productId !== null ? (
            /* keyed by product: PickOptions assumes a fixed productId per mount */
            <PickOptions
              key={unit.productId}
              productId={unit.productId}
              productName={pickedProductName(c, unit)}
              options={unit.options}
              onOptionsChange={(o) =>
                setSelections((s) => setPickOptions(s, c.combo_item_id, unitIndex, o))
              }
            />
          ) : null}
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p>
          <span className="block text-xs text-muted">
            {ready ? "Combo total" : "Finish your picks to see the total"}
          </span>
          <span
            data-testid="combo-estimate"
            aria-live="polite"
            className="text-3xl font-extrabold leading-tight text-brand-fg"
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
        <div className="text-right">
          {addMessage ? (
            <p role="status" className="mb-1 text-xs font-medium text-success">
              {addMessage}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!ready || adding}
            className="btn-primary inline-flex h-12 items-center px-6 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={async () => {
              setAdding(true);
              setAddMessage(null);
              try {
                await addLine(buildComboLine(combo.combo_id, selections, 1));
                setAddMessage("Added to cart");
                window.setTimeout(() => setAddMessage(null), 3000);
              } catch {
                setAddMessage("Could not add to cart");
              } finally {
                setAdding(false);
              }
            }}
          >
            Add Combo to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
