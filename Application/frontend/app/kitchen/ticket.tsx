"use client";

import { useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import {
  acceptKitchenOrder,
  addKitchenOrderNote,
  confirmKitchenPickup,
  markKitchenOrderReady,
  type KitchenItem,
  type KitchenTicket,
} from "@/lib/api/kitchen";
import { formatInBusinessTz } from "@/lib/business-time";
import { ageMinutes, isUrgent, statusLabel } from "@/lib/kitchen-queue";

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

const TRACKING_SOURCE_LABEL: Record<string, string> = {
  system: "System",
  kitchen: "Kitchen",
  transport: "Transport",
  customer: "Customer",
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

function TruckIcon({ className = "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 4h13v11H1z" />
      <path d="M14 8h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
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

function TrackingNote({
  source,
  note,
  createdAt,
  timeZone,
}: {
  source: string;
  note: string;
  createdAt: string;
  timeZone: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-muted">
          {TRACKING_SOURCE_LABEL[source] ?? source}
        </span>
        <span className="text-muted">
          {formatInBusinessTz(createdAt, timeZone, {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      </div>
      <p className="mt-2 text-sm text-fg">{note}</p>
    </div>
  );
}

export function Ticket({
  ticket,
  onChanged,
  onDeferred,
  timeZone,
}: {
  ticket: KitchenTicket;
  onChanged: () => void;
  onDeferred: (message: string) => void;
  timeZone: string;
}) {
  const urgent = isUrgent(ticket.status, ticket.created_at);
  const noteId = `kitchen-note-${ticket.order_id}`;
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const pickup = async () => {
    setPending(true);
    setActionError(null);
    try {
      await confirmKitchenPickup(ticket.order_id);
      onChanged(); // success → card leaves the queue (now Delivering)
    } catch (e) {
      setConfirming(false);
      if (e instanceof ApiClientError && e.status === 409) {
        onChanged(); // someone/T2 advanced it — the refetched queue is the truth
      } else {
        setActionError("Couldn't confirm pickup — try again."); // 5xx/network: leave the card
      }
    } finally {
      setPending(false);
    }
  };

  const accept = async () => {
    setPending(true);
    setActionError(null);
    try {
      await acceptKitchenOrder(ticket.order_id);
      onChanged(); // success → refetch shows the advanced card
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        onChanged(); // someone else advanced it — the refetched queue is the truth
      } else {
        setActionError("Couldn't accept — try again."); // 5xx/network: leave the card, no refetch
      }
    } finally {
      setPending(false);
    }
  };

  const markReady = async () => {
    setPending(true);
    setActionError(null);
    try {
      const result = await markKitchenOrderReady(ticket.order_id);
      if (result.status === "DispatchPending") {
        onDeferred(`${ticket.order_code}: provider busy — sent to admin for retry.`);
      }
      onChanged(); // Ready or Pending — refetch reconciles (card may drop out)
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        onChanged();
      } else {
        setActionError("Couldn't dispatch — try again."); // 5xx/network: leave the card
      }
    } finally {
      setPending(false);
    }
  };

  const saveNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setNoteError("Enter a note first.");
      return;
    }
    setNotePending(true);
    setNoteError(null);
    try {
      await addKitchenOrderNote(ticket.order_id, trimmed);
      setNote("");
      onChanged();
    } catch (e) {
      setNoteError(e instanceof ApiClientError ? e.message : "Couldn't save note.");
    } finally {
      setNotePending(false);
    }
  };

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
      {ticket.tracking.filter((event) => event.note).length > 0 && (
        <div className="space-y-2 rounded-lg border border-line bg-surface px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Kitchen steps</p>
          <div className="grid gap-2">
            {ticket.tracking
              .filter((event) => event.note)
              .map((event) => (
                <TrackingNote
                  key={event.tracking_id}
                  source={event.note_source}
                  note={event.note as string}
                  createdAt={event.created_at}
                  timeZone={timeZone}
                />
              ))}
          </div>
        </div>
      )}
      <div className="space-y-2 rounded-lg border border-line bg-surface px-3 py-3">
        <label htmlFor={noteId} className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Kitchen note
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Add a prep note for the timeline..."
          className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void saveNote()}
            disabled={notePending}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-fg hover:bg-surface-hover disabled:opacity-50"
          >
            {notePending ? "Saving…" : "Add Note"}
          </button>
          {noteError && <p className="text-xs text-danger">{noteError}</p>}
        </div>
      </div>
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
      {ticket.status === "Received" && (
        <button
          type="button"
          data-testid="kitchen-accept"
          onClick={accept}
          disabled={pending}
          aria-busy={pending}
          className="min-h-11 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60"
        >
          {pending ? "Accepting…" : "Accept Order"}
        </button>
      )}
      {ticket.status === "Preparing" && (
        <button
          type="button"
          data-testid="kitchen-mark-ready"
          onClick={markReady}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface disabled:opacity-60"
        >
          <CheckIcon />
          {pending ? "Marking…" : "Mark Ready for Dispatch"}
        </button>
      )}
      {ticket.status === "ReadyForDispatch" && (
        <div className="flex flex-col gap-2">
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="kitchen-pickup-yes"
                onClick={pickup}
                disabled={pending}
                aria-busy={pending}
                className="min-h-11 flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60"
              >
                {pending ? "Confirming…" : "Yes, picked up"}
              </button>
              <button
                type="button"
                data-testid="kitchen-pickup-cancel"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="min-h-11 flex-1 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="kitchen-confirm-pickup"
              onClick={() => setConfirming(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface"
            >
              <TruckIcon className="h-4 w-4 shrink-0" />
              Confirm Pickup
            </button>
          )}
          <p className="text-center text-xs text-muted">
            Usually auto-confirmed when the courier scans the order
          </p>
        </div>
      )}
      {actionError && (
        <p
          role="alert"
          data-testid="kitchen-action-error"
          className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger"
        >
          {actionError}
        </p>
      )}
    </article>
  );
}
