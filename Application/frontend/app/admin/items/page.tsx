"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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
  }

  function startEdit(it: ItemOut) {
    setEditingId(it.product_id);
    setEditActive(it.is_active);
    setForm({
      name: it.name,
      category_id: String(it.category_id),
      base_price_vnd: String(it.base_price_vnd),
    });
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
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Menu Items" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Menu Items</h1>
        <span className="text-sm text-gray-400">{visible.length} shown</span>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="tablist">
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
              kind === k ? "bg-[#C73E1D] text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {k === "pizza" ? "Pizzas" : "Side Dishes"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Category</label>
          <select
            required
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
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
          <label className="mb-1 block text-xs font-medium text-gray-500">Price (VND)</label>
          <input
            required
            type="number"
            min={0}
            value={form.base_price_vnd}
            onChange={(e) => setForm({ ...form, base_price_vnd: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          {editingId !== null && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
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
            className="rounded-lg bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a93217] disabled:opacity-50"
          >
            {editingId === null ? `Add ${kind === "pizza" ? "pizza" : "side dish"}` : "Save changes"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          {noCategories && (
            <span className="text-sm text-amber-600">Add an active category first.</span>
          )}
        </div>
      </form>

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search items…" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Image", "Name", "Category", "Price", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-300">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{it.name}</td>
                  <td className="px-4 py-3 text-gray-700">{catName(it.category_id)}</td>
                  <td className="px-4 py-3 text-gray-700">{vnd(it.base_price_vnd)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        it.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {it.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(it)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <label className="cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                        {uploadingId === it.product_id ? "…" : "Image"}
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
                            onClick={() => void remove(it.product_id)}
                            disabled={busy}
                            className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmId(it.product_id)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
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
