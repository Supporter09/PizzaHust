"use client";

import { useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";

type ImportSummary = components["schemas"]["ImportSummary"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

interface ImportCardProps {
  title: string;
  endpoint: string;
  columns: string;
}

function ImportCard({ title, endpoint, columns }: ImportCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      setSummary(await apiFetch<ImportSummary>(endpoint, { method: "POST", body: fd }));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-xs text-muted">
        CSV columns: <code className="font-mono">{columns}</code>
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-hover file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg hover:file:bg-surface-active"
        />
        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-fg">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-3 text-sm text-fg">
          <div className="flex gap-4">
            <span className="text-success">Created: {summary.created}</span>
            <span className="text-info">Updated: {summary.updated}</span>
            <span className="text-muted">Skipped: {summary.skipped}</span>
          </div>
          {summary.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-warning">
              {summary.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function ImportPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Bulk Import" }]} />
      <h1 className="mb-2 text-2xl font-semibold text-fg">Bulk Import</h1>
      <p className="mb-6 text-sm text-muted">
        Upload a CSV to upsert records by name. Rows with an unknown category are reported and
        skipped — categories are never created automatically.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ImportCard
          title="Pizzas & Side Dishes"
          endpoint="/admin/import/pizzas"
          columns="name, category_name, base_price_vnd, is_pizza"
        />
        <ImportCard
          title="Toppings"
          endpoint="/admin/import/toppings"
          columns="name, price_vnd"
        />
      </div>
    </div>
  );
}
