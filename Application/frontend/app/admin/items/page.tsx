"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";
import SearchBar from "@/components/admin/SearchBar";

type ItemOut = components["schemas"]["ItemOut"];
type CategoryOut = components["schemas"]["CategoryOut"];
type Kind = "pizza" | "side";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const ASSET_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
const imageSrc = (url: string) => (url.startsWith("http") ? url : `${ASSET_ORIGIN}${url}`);
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;
const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

const EMPTY = { name: "", category_id: "", base_price_vnd: "" };

export default function ItemsPage() {
  const [kind, setKind] = useState<Kind>("pizza");
  const [items, setItems] = useState<ItemOut[]>([]);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [its, cats] = await Promise.all([
        apiFetch<ItemOut[]>(`/admin/items?kind=${kind}`),
        apiFetch<CategoryOut[]>(`/admin/categories`),
      ]);
      setItems(its);
      setCategories(cats);
    } catch (e) {
      setError(msg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    // Defer to a macrotask so the loader's setState is not called synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const activeCategories = categories.filter((c) => c.is_active);
  const catName = (id: number) => categories.find((c) => c.category_id === id)?.name ?? `#${id}`;

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setEditActive(true);
    setShowForm(false);
  }

  function startEdit(it: ItemOut) {
    setEditingId(it.product_id);
    setEditActive(it.is_active);
    setForm({
      name: it.name,
      category_id: String(it.category_id),
      base_price_vnd: String(it.base_price_vnd),
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const category_id = Number(form.category_id);
    const base_price_vnd = Number(form.base_price_vnd);
    try {
      if (editingId === null) {
        await apiFetch("/admin/items", {
          method: "POST",
          body: JSON.stringify({ name: form.name, category_id, base_price_vnd, kind }),
        });
      } else {
        await apiFetch(`/admin/items/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, category_id, base_price_vnd, is_active: editActive }),
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/items/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  async function uploadImage(id: number, file: File) {
    setUploadingId(id);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      await apiFetch(`/admin/items/${id}/image`, { method: "POST", body: fd });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setUploadingId(null);
    }
  }

  const visible = items.filter((it) => it.name.toLowerCase().includes(search.toLowerCase()));
  const noCategories = activeCategories.length === 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Menu Management" }]} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-fg">Menu Management</h1>
          <span className="text-sm text-muted">{visible.length} shown</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setEditingId(null);
              setForm(EMPTY);
              setEditActive(true);
              setShowForm(true);
            }
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Item
        </button>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-line bg-card p-0.5" role="tablist">
        {(["pizza", "side"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              resetForm();
              setSearch("");
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              kind === k ? "bg-brand text-on-brand" : "text-muted hover:text-fg"
            }`}
          >
            {k === "pizza" ? "Pizzas" : "Side Dishes"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Category</label>
          <select
            required
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="" disabled>
              Select…
            </option>
            {activeCategories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Price (VND)</label>
          <input
            required
            type="number"
            min={0}
            value={form.base_price_vnd}
            onChange={(e) => setForm({ ...form, base_price_vnd: e.target.value })}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          {editingId !== null && (
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              Active
            </label>
          )}
          <button
            type="submit"
            disabled={busy || noCategories}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            {editingId === null ? `Add ${kind === "pizza" ? "pizza" : "side dish"}` : "Save changes"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-surface"
          >
            Cancel
          </button>
          {noCategories && (
            <span className="text-sm text-warning">Add an active category first.</span>
          )}
        </div>
        </form>
      )}

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search items…" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Image", "Name", "Category", "Price", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No items
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((it) => (
                <tr key={it.product_id} className={it.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    {it.image_url ? (
                      <Image
                        src={imageSrc(it.image_url)}
                        alt={it.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-hover text-xs text-muted">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/items/${it.product_id}`}
                      className="text-brand hover:underline"
                    >
                      {it.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand-fg">
                      {catName(it.category_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg">{vnd(it.base_price_vnd)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        it.is_active ? "bg-success-subtle text-success" : "bg-surface-hover text-muted"
                      }`}
                    >
                      {it.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(it)}
                        aria-label={`Edit ${it.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      <label
                        aria-label={`Change image for ${it.name}`}
                        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-within:outline-none focus-within:ring-2 focus-within:ring-brand/40"
                      >
                        {uploadingId === it.product_id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadImage(it.product_id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {confirmId === it.product_id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void remove(it.product_id)}
                            disabled={busy}
                            className="inline-flex h-11 items-center justify-center rounded-lg bg-danger-solid px-3 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="inline-flex h-11 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(it.product_id)}
                          aria-label={`Delete ${it.name}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
