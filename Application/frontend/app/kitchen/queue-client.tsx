"use client";

import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { getBusinessConfig } from "@/lib/api/config";
import { listKitchenOrders, type KitchenTicket } from "@/lib/api/kitchen";
import { DEFAULT_BUSINESS_TZ } from "@/lib/business-time";

import { Ticket } from "./ticket";

const POLL_MS = 3_000;

export function QueueClient() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [deferred, setDeferred] = useState<string | null>(null);
  // Absolute step times render in the admin-configured business timezone, not
  // the browser's local zone (GET /api/config/business is the authority).
  const [timeZone, setTimeZone] = useState(DEFAULT_BUSINESS_TZ);
  const hasLoaded = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    getBusinessConfig()
      .then((config) => {
        if (active) setTimeZone(config.timezone);
      })
      .catch(() => {
        /* keep the default zone if config is unavailable */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await listKitchenOrders();
        if (cancelled) return;
        setTickets(data);
        hasLoaded.current = true;
        setError(false);
        setStale(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 429) return; // transient — keep last data
        if (!hasLoaded.current) setError(true);
        else setStale(true);
      }
    };
    refreshRef.current = () => {
      void refresh();
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const counts = {
    Received: tickets?.filter((t) => t.status === "Received").length ?? 0,
    Preparing: tickets?.filter((t) => t.status === "Preparing").length ?? 0,
    ReadyForDispatch: tickets?.filter((t) => t.status === "ReadyForDispatch").length ?? 0,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Incoming Orders</h1>
        <p className="mt-1.5 text-sm text-muted">
          Live queue of orders being received, prepared, and awaiting dispatch.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3.5 text-sm font-semibold text-fg">
        <span className="flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2">
          <b className="text-base">{counts.Received}</b> New
        </span>
        <span className="flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2">
          <b className="text-base">{counts.Preparing}</b> Preparing
        </span>
        <span className="flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2">
          <b className="text-base">{counts.ReadyForDispatch}</b> Ready for dispatch
        </span>
      </div>

      {error && <p className="text-sm text-danger">Couldn&rsquo;t load the queue. Retrying&hellip;</p>}
      {stale && !error && (
        <p
          role="status"
          data-testid="kitchen-stale"
          className="mb-6 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm font-semibold text-warning"
        >
          Couldn&rsquo;t refresh just now — showing the last loaded queue. Retrying&hellip;
        </p>
      )}
      {deferred && (
        <p
          role="status"
          data-testid="kitchen-dispatch-deferred"
          className="mb-6 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm font-semibold text-warning"
        >
          {deferred}
        </p>
      )}
      {!error && tickets !== null && tickets.length === 0 && (
        <p className="text-sm text-muted" data-testid="kitchen-empty">
          No incoming orders.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tickets?.map((t) => (
          <Ticket
            key={t.order_id}
            ticket={t}
            onChanged={() => refreshRef.current()}
            onDeferred={setDeferred}
            timeZone={timeZone}
          />
        ))}
      </div>
    </div>
  );
}
