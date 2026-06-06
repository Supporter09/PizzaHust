"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";

type CategoryOut = components["schemas"]["CategoryOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));
const EMPTY = { name: "", description: "" };

export default function CategoriesPage() {
  const [cats, setCats] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCats(await apiFetch<CategoryOut[]>("/admin/categories"));
    } catch (e) {
      setError(msg(e));
      setCats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to a macrotask so the loader's setState is not called synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setEditActive(true);
  }

  function startEdit(c: CategoryOut) {
    setEditingId(c.category_id);
    setEditActive(c.is_active);
    setForm({ name: c.name, description: c.description ?? "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const description = form.description.trim() || null;
    try {
      if (editingId === null) {
        await apiFetch("/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: form.name, description, sort_order: cats.length }),
        });
      } else {
        await apiFetch(`/admin/categories/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, description, is_active: editActive }),
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
      await apiFetch(`/admin/categories/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  // Reorder by reassigning sort_order to the array index. On failure we surface
  // the error and reload so the UI snaps back to server truth (CodeRabbit ③).
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const next = [...cats];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setError("");
    try {
      await Promise.all(
        next.map((c, i) =>
          c.sort_order === i
            ? Promise.resolve()
            : apiFetch(`/admin/categories/${c.category_id}`, {
                method: "PATCH",
                body: JSON.stringify({ sort_order: i }),
              }),
        ),
      );
      await load();
    } catch (e) {
      setError(`Reorder failed: ${msg(e)}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Categories" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>
        <span className="text-sm text-gray-400">{cats.length} categories</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-3">
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
            disabled={busy}
            className="rounded-lg bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a93217] disabled:opacity-50"
          >
            {editingId === null ? "Add category" : "Save changes"}
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
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Order", "Name", "Description", "Status", ""].map((h) => (
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
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && cats.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No categories
                </td>
              </tr>
            )}
            {!loading &&
              cats.map((c, i) => (
                <tr key={c.category_id} className={c.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void move(i, -1)}
                        disabled={busy || i === 0}
                        aria-label="Move up"
                        className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => void move(i, 1)}
                        disabled={busy || i === cats.length - 1}
                        aria-label="Move down"
                        className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(c)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      {confirmId === c.category_id ? (
                        <>
                          <button
                            onClick={() => void remove(c.category_id)}
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
                          onClick={() => setConfirmId(c.category_id)}
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
