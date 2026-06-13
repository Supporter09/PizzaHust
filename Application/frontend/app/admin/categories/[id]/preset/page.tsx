"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type CategoryOut = components["schemas"]["CategoryOut"];
type GroupOut = components["schemas"]["GroupOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

export default function CategoryPresetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const categoryId = Number(id);

  const [category, setCategory] = useState<CategoryOut | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cat, allGroups, preset] = await Promise.all([
        apiFetch<CategoryOut>(`/admin/categories/${categoryId}`),
        apiFetch<GroupOut[]>(`/admin/option-groups`),
        apiFetch<GroupOut[]>(`/admin/categories/${categoryId}/preset`),
      ]);
      setCategory(cat);
      setGroups(allGroups);
      setSelected(new Set(preset.map((g) => g.group_id)));
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function toggle(groupId: number) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      // Preserve group display order so the preset applies predictably.
      const group_ids = groups.filter((g) => selected.has(g.group_id)).map((g) => g.group_id);
      await apiFetch(`/admin/categories/${categoryId}/preset`, {
        method: "PUT",
        body: JSON.stringify({ group_ids }),
      });
      setSaved(true);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Categories", href: "/admin/categories" },
          { label: `${category?.name ?? `#${id}`} preset` },
        ]}
      />
      <Link
        href="/admin/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        ← Back to Categories
      </Link>

      <h1 className="text-2xl font-semibold text-fg">
        {category ? `${category.name} preset` : "Category preset"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Option groups checked here are enabled automatically on dishes <strong>created</strong> in
        this category. Editing the preset does not change existing dishes.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-muted">Loading…</p>}

      {!loading && (
        <>
          <ul className="mb-6 max-w-xl divide-y divide-line rounded-xl border border-line bg-card">
            {groups.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">No option groups yet.</li>
            )}
            {groups.map((g) => (
              <li key={g.group_id} className="flex items-center gap-3 px-4 py-3">
                <input
                  id={`group-${g.group_id}`}
                  type="checkbox"
                  checked={selected.has(g.group_id)}
                  onChange={() => toggle(g.group_id)}
                />
                <label htmlFor={`group-${g.group_id}`} className="text-sm text-fg">
                  {g.name}
                  <span className="ml-2 text-xs text-muted">
                    {g.select_type === "single" ? "single-choice" : "multi-choice"}
                    {g.required ? " · required" : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Save preset
            </button>
            {saved && <span className="text-sm text-success">Saved.</span>}
          </div>
        </>
      )}
    </div>
  );
}
