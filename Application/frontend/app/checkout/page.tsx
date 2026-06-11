"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { quoteCart, type CartQuoteOut } from "@/lib/api/cart";
import { placeOrder, type PlaceOrderIn } from "@/lib/api/orders";
import { formatVnd } from "@/lib/format";

type DeliveryConfig = { fee_vnd: number; service_area: string[] };

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { lines, clear } = useCart();
  const { getLoyalty } = useAuth();

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [ward, setWard] = useState("");
  const [street, setStreet] = useState("");
  const [note, setNote] = useState("");
  const [redeem, setRedeem] = useState(0);
  const [points, setPoints] = useState(0);

  const [wards, setWards] = useState<string[]>([]);
  const [quote, setQuote] = useState<CartQuoteOut | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DeliveryConfig>("/config/delivery")
      .then((c) => setWards(c.service_area))
      .catch(() => setWards([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => {
      setRecipientName((n) => n || user.full_name);
      setRecipientPhone((p) => p || user.phone_number);
      getLoyalty()
        .then((l) => setPoints(l.current_points))
        .catch(() => setPoints(0));
    }, 0);
    return () => window.clearTimeout(handle);
  }, [user, getLoyalty]);

  const apiLines = useMemo(
    () =>
      lines.map((l) => ({
        kind: l.kind,
        item_id: l.item_id ?? undefined,
        combo_id: l.combo_id ?? undefined,
        option_ids: l.option_ids,
        quantity: l.quantity,
        notes: l.notes,
      })),
    [lines],
  );

  // Live authoritative quote once a ward is chosen (so the delivery fee + total show).
  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      if (lines.length === 0 || !ward) {
        if (active) setQuote(null);
        return;
      }
      quoteCart({
        redeem_points: redeem,
        address: { administrative_unit: ward },
        lines: apiLines,
      })
        .then((q) => {
          if (!active) return;
          setQuote(q);
          setQuoteError(null);
        })
        .catch((e) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(
            e instanceof ApiClientError && e.code === "OUT_OF_SERVICE_AREA"
              ? "Sorry — we only deliver within inner Hanoi."
              : "Couldn't price this order.",
          );
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [apiLines, ward, redeem, lines.length]);

  if (lines.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-fg">Checkout</h1>
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/menu" className="btn-primary inline-block px-5 py-2.5">
          Browse Menu
        </Link>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: PlaceOrderIn = {
      lines: apiLines,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      address: { administrative_unit: ward, street },
      delivery_note: note || undefined,
      redeem_points: redeem,
    };
    try {
      const placed = await placeOrder(body);
      clear();
      router.push(`/track?code=${encodeURIComponent(placed.order_code)}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(
          err.code === "OUT_OF_SERVICE_AREA"
            ? "We only deliver within inner Hanoi. Please choose a serviced ward."
            : err.message,
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  };

  const maxRedeem = quote?.loyalty.max_redeemable ?? 0;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
            <h2 className="font-semibold text-fg">Delivery details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Recipient name</span>
                <input
                  required
                  minLength={2}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Phone</span>
                <input
                  required
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Ward / administrative unit</span>
              <input
                required
                list="ward-list"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="e.g. Ba Đình"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
              />
              <datalist id="ward-list">
                {wards.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Street address</span>
              <input
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="12 Phan Đình Phùng"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Delivery note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
              />
            </label>
          </div>

          {user ? (
            <div className="rounded-2xl border border-line bg-card p-5 space-y-2">
              <h2 className="font-semibold text-fg">Loyalty points</h2>
              <p className="text-sm text-muted">
                Balance: <span className="font-medium text-fg">{points}</span> pts
                {maxRedeem > 0 ? ` · up to ${maxRedeem} usable on this order` : ""}
              </p>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Redeem points (1 pt = 1.000₫)</span>
                <input
                  type="number"
                  min={0}
                  max={Math.min(points, maxRedeem || points)}
                  value={redeem}
                  onChange={(e) => setRedeem(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-fg"
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted">
              <Link href="/login" className="text-brand hover:underline">
                Log in
              </Link>{" "}
              to earn and redeem loyalty points.
            </p>
          )}
        </div>

        <aside className="h-fit space-y-3 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold text-fg">Order Summary</h2>
          {quoteError ? <p className="text-sm text-danger">{quoteError}</p> : null}
          {quote ? (
            <dl className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatVnd(quote.subtotal_vnd)} />
              {quote.discount_combo_vnd > 0 ? (
                <Row label="Combo savings" value={`−${formatVnd(quote.discount_combo_vnd)}`} />
              ) : null}
              {quote.discount_loyalty_vnd > 0 ? (
                <Row label="Loyalty discount" value={`−${formatVnd(quote.discount_loyalty_vnd)}`} />
              ) : null}
              <Row label="Delivery fee" value={formatVnd(quote.delivery_fee_vnd)} />
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-fg">
                <span>Total</span>
                <span>{formatVnd(quote.total_vnd)}</span>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Choose a ward to see the delivery fee and total.</p>
          )}
          <p className="text-xs text-muted">Payment: Cash on Delivery (COD)</p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || !quote}
            className="btn-primary block w-full px-5 py-3 disabled:opacity-50"
          >
            {submitting ? "Placing order…" : "Place COD Order"}
          </button>
        </aside>
      </form>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </div>
  );
}
