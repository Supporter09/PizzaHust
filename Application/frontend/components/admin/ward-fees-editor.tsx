"use client";

import { useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { putWardFees, type WardFeesOut } from "@/lib/api/admin-settings";

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

// Rows hold strings so the inputs stay controlled while empty/mid-edit;
// we convert fee to a number only on submit (mirrors basics-editor's price).
type Row = { ward: string; fee: string };

const toRows = (data: WardFeesOut): Row[] =>
  data.wards.map((w) => ({ ward: w.ward, fee: String(w.fee_vnd) }));

export function WardFeesEditor({ initial }: { initial: WardFeesOut }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function addRow() {
    setRows((prev) => [...prev, { ward: "", fee: "" }]);
    setSaved(false);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const wards = rows.map((r) => ({ ward: r.ward.trim(), fee_vnd: Number(r.fee) }));
      const result = await putWardFees({ wards });
      setRows(toRows(result));
      setSaved(true);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Delivery fees by ward</h2>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-hover"
        >
          Add ward
        </button>
      </div>

      <ul aria-label="Ward delivery fees" className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label
                htmlFor={`ward-name-${i}`}
                className="mb-1 block text-xs font-medium text-muted"
              >
                Ward name
              </label>
              <input
                id={`ward-name-${i}`}
                value={row.ward}
                onChange={(e) => update(i, { ward: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label
                htmlFor={`ward-fee-${i}`}
                className="mb-1 block text-xs font-medium text-muted"
              >
                {row.ward ? `Fee for ${row.ward}` : "Fee (VND)"}
              </label>
              <input
                id={`ward-fee-${i}`}
                aria-label={row.ward ? `Fee for ${row.ward}` : "Fee (VND)"}
                type="number"
                min={0}
                value={row.fee}
                onChange={(e) => update(i, { fee: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 sm:w-40"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove ${row.ward || "ward"}`}
              className="h-11 rounded-lg border border-line px-3 text-sm font-medium text-danger hover:bg-surface-hover"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          Save delivery fees
        </button>
        {saved && !error && <span className="text-sm text-muted">Saved</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </section>
  );
}
