"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError } from "@/lib/api/client";
import { trackOrder } from "@/lib/api/orders";
import type { components } from "@/lib/api/types";
import { etaMinutes } from "@/lib/eta";

type TrackOut = components["schemas"]["TrackOut"];

const TERMINAL = new Set(["Delivered", "DeliveryFailed", "Cancelled"]);
const POLL_MS = 15_000;

function formatCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z-]/g, "");
}

export function TrackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const codeFromUrl = searchParams.get("code")?.trim() ?? "";

  const [draftCode, setDraftCode] = useState("");
  const [track, setTrack] = useState<TrackOut | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeCode = codeFromUrl ? formatCodeInput(codeFromUrl) : "";

  /* eslint-disable react-hooks/set-state-in-effect -- fetch + loading flags when ?code= changes */
  useEffect(() => {
    if (!activeCode) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void trackOrder(activeCode)
      .then((data) => {
        if (!cancelled) setTrack(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setTrack(null);
        if (e instanceof ApiClientError && e.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!activeCode || !track || TERMINAL.has(track.status)) return;
    const id = window.setInterval(() => {
      void trackOrder(activeCode)
        .then(setTrack)
        .catch((e) => {
          if (e instanceof ApiClientError && e.status === 429) return;
        });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeCode, track]);

  const eta = useMemo(() => {
    if (!track?.promised_at || TERMINAL.has(track.status)) return null;
    return etaMinutes(track.promised_at, new Date());
  }, [track]);

  const submitLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const next = formatCodeInput(draftCode);
    if (!next) return;
    router.replace(`/track?code=${encodeURIComponent(next)}`);
  };

  const clearTrack = () => {
    setDraftCode("");
    setTrack(null);
    setNotFound(false);
    router.replace("/track");
  };

  const returnTo = activeCode
    ? `/track?code=${encodeURIComponent(activeCode)}`
    : "/track";

  const displayTrack = activeCode ? track : null;
  const displayNotFound = activeCode && notFound;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <h1 className="text-3xl font-bold text-fg">Track Your Order</h1>

      <div className="rounded-2xl border border-line bg-card p-6">
        <form onSubmit={submitLookup}>
          <label htmlFor="track-code" className="block text-base font-bold text-fg">
            Enter your order code
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="track-code"
              type="text"
              value={activeCode && draftCode === "" ? activeCode : draftCode}
              onChange={(e) => setDraftCode(formatCodeInput(e.target.value))}
              placeholder="e.g. PIZZ-7K2M9Q"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-sm uppercase text-fg"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary h-11 shrink-0 px-6 font-semibold">
              Track Order
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            Find your code on the order confirmation screen after checkout.
          </p>
        </form>
      </div>

      {loading && activeCode ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface-active" />
      ) : null}

      {displayNotFound ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-fg" role="alert">
          We couldn&apos;t find that order code.
        </p>
      ) : null}

      {displayTrack ? (
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-fg">Order {displayTrack.order_code}</h2>
                <StatusBadge status={displayTrack.status} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {displayTrack.recipient_first_name} · phone ending •••{displayTrack.phone_last4}
                <br />
                {displayTrack.address_masked}
              </p>
              {displayTrack.delivery_note ? (
                <p className="mt-2 border-l-2 border-dashed border-line pl-3 text-sm text-muted">
                  Delivery note: &ldquo;{displayTrack.delivery_note}&rdquo;
                </p>
              ) : null}
              {!user ? (
                <p className="mt-3">
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Guest view — sign in for full order history
                  </Link>
                </p>
              ) : null}
            </div>
            {eta !== null ? (
              <div className="text-right">
                <p className="text-sm text-muted">Estimated Time</p>
                <p className="text-2xl font-extrabold text-brand">~{eta} min</p>
                <p className="mt-2 flex items-center justify-end gap-2 text-xs text-muted motion-safe:animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                  auto-updating
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <OrderTimeline
              currentStatus={displayTrack.status}
              timeline={displayTrack.timeline.map((e) => ({ status: e.status, at: e.at }))}
            />
          </div>

          <button
            type="button"
            onClick={clearTrack}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-full border border-line text-sm font-semibold text-fg hover:bg-surface-hover"
          >
            Track Another Order
          </button>
        </div>
      ) : null}
    </div>
  );
}