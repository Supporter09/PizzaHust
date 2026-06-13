"use client";

import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { listKitchenOrders, type KitchenItem, type KitchenTicket } from "@/lib/api/kitchen";
import { ageMinutes, isUrgent, statusLabel } from "@/lib/kitchen-queue";

const POLL_MS = 3_000;

// Repo theme tokens (see globals.css @theme). The mockup maps Received=blue,
// Preparing=amber, ReadyForDispatch=cyan onto info/warning/success. The base
// info/warning/success tokens already flip to light values in dark mode (unlike
// `brand`, which needs `brand-fg`), so they read as text on the subtle bg in
// both themes — no `*-fg` variant needed.
const BADGE: Record<string, string> = {
  Received: "bg-info-subtle text-info border border-info",
  Preparing: "bg-warning-subtle text-warning border border-warning",
  ReadyForDispatch: "bg-success-subtle text-success border border-success",
};

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
      aria-hidden="true"
    >
      <path d="M1 4h13v11H1z" />
      <path d="M14 8h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </svg>
  );
}

function ItemLine({ item, depth = 0 }: { item: KitchenItem; depth?: number }) {
  return (
    <li className={depth > 0 ? "ml-5 border-l border-line pl-3" : ""}>
      <div className="flex gap-2.5 text-sm text-fg">
        <span className="min-w-6 font-extrabold text-brand">{item.quantity}×</span>
        <span>
          {item.display_name}
          {item.options.length > 0 && (
            <span className="mt-0.5 block text-xs text-muted">
              {item.options.map((o) => o.option_name).join(" · ")}
            </span>
          )}
          {item.note && (
            <span className="mt-1 inline-block rounded-full border border-warning bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning">
              Note: {item.note}
            </span>
          )}
        </span>
      </div>
      {item.children.length > 0 && (
        <ul className="mt-2 grid gap-2">
          {item.children.map((child, i) => (
            <ItemLine key={i} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Ticket({ ticket }: { ticket: KitchenTicket }) {
  const urgent = isUrgent(ticket.status, ticket.created_at);
  return (
    <article
      data-testid="kitchen-ticket"
      data-order-code={ticket.order_code}
      className={`flex flex-col gap-3.5 rounded-xl border bg-card p-5 shadow-sm ${
        urgent ? "border-brand ring-2 ring-brand/30" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold tracking-tight text-fg">{ticket.order_code}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            BADGE[ticket.status] ?? "bg-surface text-fg"
          }`}
        >
          {statusLabel(ticket.status)}
        </span>
      </div>
      <p
        className={`flex items-center gap-1.5 text-xs font-semibold ${
          urgent ? "text-brand" : "text-muted"
        }`}
      >
        <ClockIcon />
        placed {ageMinutes(ticket.created_at)} min ago
      </p>
      <ul className="grid gap-2 border-y border-line py-3">
        {ticket.items.map((item, i) => (
          <ItemLine key={i} item={item} />
        ))}
      </ul>
      {ticket.status === "ReadyForDispatch" && ticket.delivery_note && (
        <p
          data-testid="kitchen-delivery-note"
          className="flex items-start gap-2 rounded-md border border-dashed border-line bg-surface px-3 py-2 text-xs text-muted"
        >
          <TruckIcon />
          <span>
            <b className="text-fg">Delivery note</b> — for the courier: &ldquo;{ticket.delivery_note}
            &rdquo;
          </span>
        </p>
      )}
      {/* K2/K3/K4 action buttons attach here. */}
    </article>
  );
}

export function QueueClient() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [error, setError] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await listKitchenOrders();
        if (cancelled) return;
        setTickets(data);
        hasLoaded.current = true;
        setError(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 429) return; // transient — keep last data
        if (!hasLoaded.current) setError(true); // only a failed *initial* load surfaces an error
      }
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
      {!error && tickets !== null && tickets.length === 0 && (
        <p className="text-sm text-muted" data-testid="kitchen-empty">
          No incoming orders.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tickets?.map((ticket) => (
          <Ticket key={ticket.order_id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}
