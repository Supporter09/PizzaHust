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
  // Create form is hidden by default so the list is the default view; the
  // top-right "Add Category" button toggles it open.
  const [showForm, setShowForm] = useState(false);

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
    setShowForm(false);
  }

  function startEdit(c: CategoryOut) {
    setEditingId(c.category_id);
    setEditActive(c.is_active);
    setForm({ name: c.name, description: c.description ?? "" });
    setShowForm(true);
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Menu Categories</h1>
          <p className="mt-1 text-sm text-muted">
            Organize how items are grouped on the customer menu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          aria-expanded={showForm}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M10 4v12M4 10h12"
            />
          </svg>
          Add Category
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-3">
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
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
            >
              {editingId === null ? "Add category" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Order", "Name", "Description", "Status", ""].map((h) => (
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
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && cats.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
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
                        className="rounded px-1.5 py-0.5 text-muted hover:bg-surface-hover disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => void move(i, 1)}
                        disabled={busy || i === cats.length - 1}
                        aria-label="Move down"
                        className="rounded px-1.5 py-0.5 text-muted hover:bg-surface-hover disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-fg">{c.name}</td>
                  <td className="px-4 py-3 text-muted">{c.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active ? "bg-success-subtle text-success" : "bg-surface-hover text-muted"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(c)}
                        aria-label={`Edit ${c.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 3.5l3 3-9 9H4.5v-3l9-9zM12 5l3 3"
                          />
                        </svg>
                      </button>
                      {confirmId === c.category_id ? (
                        <>
                          <button
                            onClick={() => void remove(c.category_id)}
                            disabled={busy}
                            className="inline-flex h-11 items-center rounded-lg bg-danger-solid px-3 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmId(c.category_id)}
                          aria-label={`Delete ${c.name}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 6h12M8 6V4.5h4V6m-6 0v9.5a1 1 0 001 1h6a1 1 0 001-1V6M8.5 9v5M11.5 9v5"
                            />
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
