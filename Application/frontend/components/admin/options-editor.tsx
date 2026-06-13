"use client";

import { useCallback, useEffect, useState } from "react";

import { OptionRow } from "@/components/admin/option-row";
import { ApiClientError } from "@/lib/api/client";
import {
  createGroup,
  createOption,
  deleteGroup,
  deleteOption,
  listItemOptions,
  patchGroup,
  patchOption,
  replaceItemOptions,
  type AdminItemOptionGroup,
} from "@/lib/api/admin-options";
const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

const enabledIds = (groups: AdminItemOptionGroup[]) =>
  groups.flatMap((g) => g.options.filter((o) => o.enabled).map((o) => o.option_id));

type Props = { productId: number };

export function OptionsEditor({ productId }: Props) {
  const [groups, setGroups] = useState<AdminItemOptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [confirmGroupId, setConfirmGroupId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { name: string; delta: string }>>({});

  const refresh = useCallback(async () => {
    setError("");
    try {
      setGroups(await listItemOptions(productId));
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleOption = (optionId: number, enabled: boolean) =>
    run(() => {
      const ids = new Set(enabledIds(groups));
      if (enabled) ids.add(optionId);
      else ids.delete(optionId);
      return replaceItemOptions(productId, [...ids]);
    });

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-muted">Loading options…</p>}

      {groups.map((g) => (
        <div key={g.group_id} className="rounded-xl border border-line bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <input
              aria-label={`${g.name} category name`}
              defaultValue={g.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== g.name) void run(() => patchGroup(g.group_id, { name: v }));
              }}
              className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-fg outline-none hover:border-line focus:border-brand"
            />
            <div
              role="radiogroup"
              aria-label={`${g.name} selection type`}
              className="inline-flex rounded-lg border border-line p-0.5"
            >
              {(["single", "multi"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={g.select_type === t}
                  disabled={busy}
                  onClick={() =>
                    g.select_type !== t &&
                    void run(() => patchGroup(g.group_id, { select_type: t }))
                  }
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    g.select_type === t ? "bg-brand text-on-brand" : "text-muted hover:text-fg"
                  }`}
                >
                  {t === "single" ? "Single" : "Multi"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={g.required}
                disabled={busy}
                onChange={(e) => void run(() => patchGroup(g.group_id, { required: e.target.checked }))}
              />
              Required
            </label>
            {confirmGroupId === g.group_id ? (
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmGroupId(null);
                    void run(() => deleteGroup(g.group_id));
                  }}
                  className="rounded bg-danger-solid px-2.5 py-1 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmGroupId(null)}
                  className="rounded px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmGroupId(g.group_id)}
                className="ml-auto rounded px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-subtle"
              >
                Delete category
              </button>
            )}
          </div>

          <ul className="divide-y divide-line">
            {g.options.map((o) => (
              <OptionRow
                key={o.option_id}
                option={o}
                busy={busy}
                onCommit={(patch) => void run(() => patchOption(o.option_id, patch))}
                onToggle={(enabled) => void toggleOption(o.option_id, enabled)}
                onDelete={() => void run(() => deleteOption(o.option_id))}
              />
            ))}
            {g.options.length === 0 && <li className="py-2 text-sm text-muted">No options yet</li>}
          </ul>

          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const draft = drafts[g.group_id];
              if (!draft?.name.trim()) return;
              void run(async () => {
                const created = await createOption(g.group_id, {
                  name: draft.name.trim(),
                  price_delta_vnd: Number(draft.delta || 0),
                  sort_order: g.options.length + 1,
                });
                await replaceItemOptions(productId, [...enabledIds(groups), created.option_id]);
                setDrafts((p) => ({ ...p, [g.group_id]: { name: "", delta: "" } }));
              });
            }}
          >
            <input
              aria-label={`New option name for ${g.name}`}
              placeholder="New option"
              value={drafts[g.group_id]?.name ?? ""}
              onChange={(e) =>
                setDrafts((p) => ({
                  ...p,
                  [g.group_id]: { name: e.target.value, delta: p[g.group_id]?.delta ?? "" },
                }))
              }
              className="w-40 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <input
              aria-label={`New option price delta for ${g.name}`}
              type="number"
              min={0}
              placeholder="Delta (VND)"
              value={drafts[g.group_id]?.delta ?? ""}
              onChange={(e) =>
                setDrafts((p) => ({
                  ...p,
                  [g.group_id]: { name: p[g.group_id]?.name ?? "", delta: e.target.value },
                }))
              }
              className="w-32 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg hover:bg-surface disabled:opacity-50"
            >
              + Add option
            </button>
          </form>

          <p className="mt-3 text-xs text-muted">
            Shared across all dishes — name and price changes apply everywhere. The toggle only
            affects this dish.
          </p>
        </div>
      ))}

      {newCategory === null ? (
        <button
          type="button"
          onClick={() => setNewCategory("")}
          className="rounded-lg border border-dashed border-line px-4 py-2 text-sm font-medium text-muted hover:border-brand hover:text-fg"
        >
          + Add Category
        </button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCategory.trim()) return;
            void run(() =>
              createGroup({
                name: newCategory.trim(),
                select_type: "multi",
                required: false,
                sort_order: groups.length + 1,
              }),
            );
            setNewCategory(null);
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted" htmlFor="new-category">
              Category name
            </label>
            <input
              id="new-category"
              autoFocus
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-48 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setNewCategory(null)}
            className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:bg-surface"
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
