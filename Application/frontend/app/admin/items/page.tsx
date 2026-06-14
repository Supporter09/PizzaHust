"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { resolveImageUrl } from "@/lib/image-url";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";
import SearchBar from "@/components/admin/SearchBar";
import { ItemRowActions } from "@/components/admin/item-row-actions";
import { imageSrc } from "@/lib/api/asset-url";

type ItemOut = components["schemas"]["ItemOut"];
type CategoryOut = components["schemas"]["CategoryOut"];

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;
const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

export default function ItemsPage() {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [items, setItems] = useState<ItemOut[]>([]);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (!showInactive) params.set("active", "true");
    if (categoryId !== null) params.set("category_id", String(categoryId));
    const qs = params.toString();
    try {
      const [its, cats] = await Promise.all([
        apiFetch<ItemOut[]>(`/admin/items${qs ? `?${qs}` : ""}`),
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
  }, [categoryId, showInactive]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const activeCategories = categories.filter((c) => c.is_active);
  const catName = (id: number) => categories.find((c) => c.category_id === id)?.name ?? `#${id}`;

  async function remove(id: number, hard: boolean) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/items/${id}${hard ? "?hard=true" : ""}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: number) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(id: number, file: File) {
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      await apiFetch(`/admin/items/${id}/image`, { method: "POST", body: fd });
      await load();
    } catch (e) {
      setError(msg(e));
    }
  }

  const visible = items.filter((it) => it.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Menu Management" }]} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-fg">Menu Management</h1>
          <span className="text-sm text-muted">{visible.length} shown</span>
        </div>
        <Link
          href="/admin/items/new"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Item
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-card p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={categoryId === null}
            onClick={() => {
              setCategoryId(null);
              setSearch("");
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              categoryId === null ? "bg-brand text-on-brand" : "text-muted hover:text-fg"
            }`}
          >
            All
          </button>
          {activeCategories.map((c) => (
            <button
              key={c.category_id}
              type="button"
              role="tab"
              aria-selected={categoryId === c.category_id}
              onClick={() => {
                setCategoryId(c.category_id);
                setSearch("");
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                categoryId === c.category_id ? "bg-brand text-on-brand" : "text-muted hover:text-fg"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search items…" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Image", "Name", "Category", "Price", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
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
                        src={resolveImageUrl(it.image_url)}
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
                    <Link href={`/admin/items/${it.product_id}`} className="text-brand hover:underline">
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
                    <ItemRowActions
                      item={it}
                      busy={busy}
                      onUpload={(f) => uploadImage(it.product_id, f)}
                      onDelete={(hard) => remove(it.product_id, hard)}
                      onRestore={() => restore(it.product_id)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
