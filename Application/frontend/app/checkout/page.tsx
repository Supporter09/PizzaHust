"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { ApiClientError } from "@/lib/api/client";
import { checkoutQuote } from "@/lib/api/cart";
import type { CartQuoteOut } from "@/lib/api/cart";
import { getDeliveryConfig } from "@/lib/api/config";
import { placeOrder } from "@/lib/api/orders";
import { clampRedeemPoints, effectiveMaxRedeem } from "@/lib/checkout-redeem";
import { isValidVnPhone } from "@/lib/checkout-validation";
import { formatVnd } from "@/lib/format";

function lineSummaryLabel(line: {
  quantity: number;
  name: string;
  descriptor: string | null;
}): string {
  const base = `${line.quantity}× ${line.name}`;
  return line.descriptor ? `${base} (${line.descriptor})` : base;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { cart, loading, refresh } = useCart();

  const [wards, setWards] = useState<string[]>([]);
  const [ward, setWard] = useState("");
  const [street, setStreet] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [quote, setQuote] = useState<CartQuoteOut | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [staleBanner, setStaleBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderPlacedRef = useRef(false);

  useEffect(() => {
    void getDeliveryConfig().then((c) => setWards(c.service_area));
  }, []);

  useEffect(() => {
    if (orderPlacedRef.current) return;
    if (!loading && (!cart || cart.lines.length === 0)) {
      router.replace("/cart");
    }
  }, [cart, loading, router]);

  const runQuote = useCallback(
    async (administrativeUnit: string, streetVal: string, points: number) => {
      const ready = Boolean(administrativeUnit) && streetVal.trim().length > 0;
      try {
        const q = await checkoutQuote({
          address: ready
            ? { administrative_unit: administrativeUnit, street: streetVal.trim() }
            : null,
          redeem_points: points,
        });
        setQuote(q);
        setRedeemPoints((prev) => {
          const newMax = effectiveMaxRedeem(q.loyalty.balance, q.loyalty.max_redeemable);
          const clamped = Math.min(prev, newMax);
          if (clamped !== prev) setRedeemInput(clamped > 0 ? String(clamped) : "");
          return clamped;
        });
        setQuoteError(null);
        setStaleBanner(false);
      } catch (e) {
        setQuote(null);
        if (e instanceof ApiClientError && e.code === "OUT_OF_SERVICE_AREA") {
          setQuoteError("This address is outside our delivery area.");
        } else if (e instanceof ApiClientError && e.code === "INSUFFICIENT_LOYALTY") {
          setQuoteError("You don't have enough points for that.");
        } else {
          setQuoteError("Could not calculate delivery total.");
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => {
      void runQuote(ward, street, redeemPoints);
    }, 250);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [ward, street, redeemPoints, runQuote]);

  const addressReady = ward.length > 0 && street.trim().length > 0;
  const summaryQuote = addressReady ? quote : null;

  const balance = quote?.loyalty.balance ?? 0;
  const maxRedeemable = quote?.loyalty.max_redeemable ?? 0;
  const maxRedeem = effectiveMaxRedeem(balance, maxRedeemable);
  const loyaltyDiscount = quote?.discount_loyalty_vnd ?? 0;
  const comboDiscount = quote?.discount_combo_vnd ?? 0;
  const showRedeem = Boolean(user) && balance > 0;

  const applyRedeem = useCallback(() => {
    const next = clampRedeemPoints(Number.parseInt(redeemInput, 10), balance, maxRedeemable);
    setRedeemPoints(next);
    setRedeemInput(next > 0 ? String(next) : "");
  }, [redeemInput, balance, maxRedeemable]);

  const useMaxRedeem = useCallback(() => {
    setRedeemPoints(maxRedeem);
    setRedeemInput(maxRedeem > 0 ? String(maxRedeem) : "");
  }, [maxRedeem]);

  const resolvedName = name.trim() || user?.full_name.trim() || "";
  const resolvedPhone = phone.replace(/\s/g, "") || user?.phone_number || "";

  const canSubmit = useMemo(() => {
    return (
      resolvedName.length > 0 &&
      isValidVnPhone(resolvedPhone) &&
      ward.length > 0 &&
      street.trim().length > 0 &&
      summaryQuote !== null &&
      quoteError === null &&
      !submitting
    );
  }, [resolvedName, resolvedPhone, ward, street, summaryQuote, quoteError, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !summaryQuote) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const out = await placeOrder({
        recipient_name: resolvedName,
        recipient_phone: resolvedPhone,
        address: { administrative_unit: ward, street: street.trim() },
        delivery_note: deliveryNote.trim() || null,
        redeem_points: redeemPoints,
      });
      orderPlacedRef.current = true;
      router.push(`/order-confirmed/${encodeURIComponent(out.order_code)}`);
      void refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_FAILED") {
        setStaleBanner(true);
        setSubmitError(err.message);
      } else if (err instanceof ApiClientError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Could not place order. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !cart || cart.lines.length === 0) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-10 w-40 animate-pulse rounded bg-surface-active" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-active" />
      </div>
    );
  }

  const placeLabel =
    summaryQuote && canSubmit
      ? `Place Order — ${formatVnd(summaryQuote.total_vnd)}`
      : "Place Order";

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-3xl font-bold text-fg">Checkout</h1>

      {staleBanner ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-fg"
        >
          <p>{submitError ?? "Some cart items are no longer available."}</p>
          <Link href="/cart" className="mt-2 inline-block font-semibold text-brand hover:underline">
            Review your cart
          </Link>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-xl font-bold text-fg">Delivery Information</h2>
          <form className="mt-6 space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
            <div>
              <label htmlFor="checkout-name" className="text-sm font-medium text-fg">
                Full Name *
              </label>
              <input
                id="checkout-name"
                type="text"
                required
                value={name || user?.full_name || ""}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-fg"
              />
            </div>
            <div>
              <label htmlFor="checkout-phone" className="text-sm font-medium text-fg">
                Phone Number *
              </label>
              <input
                id="checkout-phone"
                type="tel"
                required
                value={phone || user?.phone_number || ""}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-fg"
              />
            </div>
            <div>
              <label htmlFor="checkout-ward" className="text-sm font-medium text-fg">
                Ward *
              </label>
              <select
                id="checkout-ward"
                required
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-fg"
              >
                <option value="">Select ward</option>
                {wards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="checkout-street" className="text-sm font-medium text-fg">
                Street Address *
              </label>
              <input
                id="checkout-street"
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-fg"
              />
            </div>
            <div>
              <label htmlFor="checkout-note" className="text-sm font-medium text-fg">
                Delivery Notes (Optional)
              </label>
              <textarea
                id="checkout-note"
                rows={2}
                maxLength={255}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="E.g., Ring doorbell twice"
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-fg"
              />
              <p className="mt-1.5 text-xs text-muted">
                For the courier only — the kitchen sees the dish notes you added while customizing.
              </p>
            </div>

            <div className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-brand">
                ₫
              </span>
              <div>
                <h3 className="font-semibold text-fg">Cash on Delivery</h3>
                <p className="mt-0.5 text-sm text-muted">Pay with cash when your order arrives.</p>
              </div>
            </div>

            {quoteError ? (
              <p className="text-sm text-danger" role="alert">
                {quoteError}
              </p>
            ) : null}
            {submitError && !staleBanner ? (
              <p className="text-sm text-danger" role="alert">
                {submitError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary btn-block mt-2 flex h-12 w-full items-center justify-center text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Placing order…" : placeLabel}
            </button>
          </form>
        </div>

        <aside className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-bold text-fg">Order Summary</h2>
          <ul className="mt-4 space-y-3 border-b border-line pb-4 text-sm text-fg">
            {cart.lines.map((line) => (
              <li key={line.line_id} className="flex justify-between gap-3">
                <span className="text-muted">{lineSummaryLabel(line)}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {line.line_total_vnd !== null ? formatVnd(line.line_total_vnd) : "—"}
                </span>
              </li>
            ))}
          </ul>

          {showRedeem ? (
            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <div className="text-sm font-semibold text-fg">
                Redeem loyalty points{" "}
                <span className="font-normal text-muted">· {balance} available</span>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={maxRedeem}
                  inputMode="numeric"
                  value={redeemInput}
                  onChange={(e) => setRedeemInput(e.target.value)}
                  placeholder="0"
                  aria-label="Points to redeem"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-fg"
                />
                <button
                  type="button"
                  onClick={useMaxRedeem}
                  className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-fg hover:bg-surface-active"
                >
                  Use max
                </button>
                <button
                  type="button"
                  onClick={applyRedeem}
                  className="h-11 shrink-0 rounded-lg border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand/10"
                >
                  Apply
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Up to {maxRedeem} pts here · max 50% of subtotal
              </p>
            </div>
          ) : null}

          {quote ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium tabular-nums">{formatVnd(quote.subtotal_vnd)}</span>
              </div>
              {comboDiscount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted">Combo savings</span>
                  <span className="font-medium tabular-nums text-brand">
                    −{formatVnd(comboDiscount)}
                  </span>
                </div>
              ) : null}
              {loyaltyDiscount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted">Loyalty discount</span>
                  <span className="font-medium tabular-nums text-brand">
                    −{formatVnd(loyaltyDiscount)}
                  </span>
                </div>
              ) : null}
              {summaryQuote ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted">Delivery</span>
                    <span className="font-medium tabular-nums">
                      {formatVnd(summaryQuote.delivery_fee_vnd)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                    <span>Total</span>
                    <span className="tabular-nums text-brand">
                      {formatVnd(summaryQuote.total_vnd)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted">Select ward and street for delivery total.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Select ward and street for delivery total.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
