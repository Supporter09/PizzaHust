"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import ComboComponentPicker from "@/components/admin/combo-component-picker";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  createCombo,
  deleteCombo,
  deleteComboImage,
  getCombo,
  patchCombo,
  uploadComboImage,
  type AdminCombo,
  type AdminComboItemIn,
} from "@/lib/api/admin-combos";
import { formatVnd } from "@/lib/format";
import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemOut"];
type ComboItemOut = components["schemas"]["ComboItemOut"];

interface EditorRow {
  item: AdminComboItemIn;
  label: string;
  unitPrice: number;
}

function sameComponent(a: AdminComboItemIn, b: AdminComboItemIn): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "product" && b.kind === "product") return a.product_id === b.product_id;
  if (a.kind === "category" && b.kind === "category") return a.category_id === b.category_id;
  return false;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function comboItemToRow(it: ComboItemOut, priceByProduct: Map<number, number>): EditorRow {
  if (it.kind === "category") {
    return {
      item: { kind: "category", category_id: it.category_id!, quantity: it.quantity },
      label: it.name,
      unitPrice: it.from_price_vnd ?? 0,
    };
  }
  return {
    item: { kind: "product", product_id: it.product_id!, quantity: it.quantity },
    label: it.name,
    unitPrice: priceByProduct.get(it.product_id!) ?? 0,
  };
}

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

export default function ComboEditor({ comboId }: { comboId: number | null }) {
  const router = useRouter();
  const isCreate = comboId === null;

  const [loaded, setLoaded] = useState<AdminCombo | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [comboPrice, setComboPrice] = useState("");
  const [validityStart, setValidityStart] = useState("");
  const [validityEnd, setValidityEnd] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (comboId === null || !Number.isInteger(comboId) || comboId < 1) return;
    setError("");
    try {
      const [combo, items] = await Promise.all([
        getCombo(comboId),
        apiFetch<ItemOut[]>("/admin/items"),
      ]);
      const priceByProduct = new Map(items.map((i) => [i.product_id, i.base_price_vnd]));
      setLoaded(combo);
      setName(combo.name);
      setDescription(combo.description ?? "");
      setComboPrice(String(combo.combo_price_vnd));
      setValidityStart(toDateInput(combo.validity_start));
      setValidityEnd(toDateInput(combo.validity_end));
      setImageUrl(combo.image_url ?? null);
      setRows(combo.items.map((it) => comboItemToRow(it, priceByProduct)));
    } catch (e) {
      setError(msg(e));
    }
  }, [comboId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const componentsTotal = useMemo(
    () => rows.reduce((s, r) => s + r.unitPrice * r.item.quantity, 0),
    [rows],
  );
  const priceNum = Number(comboPrice.replace(/\D/g, "")) || 0;
  const savings = componentsTotal - priceNum;
  const sumQty = rows.reduce((s, r) => s + r.item.quantity, 0);
  const canSave = name.trim().length > 0 && sumQty >= 2 && priceNum > 0 && !busy;

  const addRow = (item: AdminComboItemIn, label: string, unitPrice: number) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => sameComponent(r.item, item));
      if (idx >= 0) {
        const next = [...prev];
        const row = next[idx];
        next[idx] = {
          ...row,
          item: { ...row.item, quantity: row.item.quantity + 1 },
        };
        return next;
      }
      return [...prev, { item, label, unitPrice }];
    });
    setPickerOpen(false);
  };

  const bumpQty = (index: number, delta: number) => {
    setRows((prev) =>
      prev
        .map((r, i) =>
          i === index
            ? { ...r, item: { ...r.item, quantity: Math.max(1, r.item.quantity + delta) } }
            : r,
        )
        .filter((r) => r.item.quantity >= 1),
    );
  };

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const buildPayload = () => ({
    name: name.trim(),
    description: description.trim() || null,
    combo_price_vnd: priceNum,
    validity_start: validityStart ? `${validityStart}T00:00:00` : null,
    validity_end: validityEnd ? `${validityEnd}T23:59:59` : null,
    items: rows.map((r) => r.item),
  });

  const onSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      if (isCreate) {
        const created = await createCombo(buildPayload());
        router.replace(`/admin/combos/${created.combo_id}`);
      } else {
        await patchCombo(comboId!, buildPayload());
        await load();
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete || comboId === null) return;
    setBusy(true);
    setError("");
    try {
      await deleteCombo(comboId);
      router.push("/admin/combos");
    } catch (e) {
      setError(msg(e));
      setBusy(false);
    }
  };

  const onImagePick = async (file: File) => {
    if (comboId === null) return;
    setBusy(true);
    setError("");
    try {
      const { image_url } = await uploadComboImage(comboId, file);
      setImageUrl(image_url);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const onImageRemove = async () => {
    if (comboId === null) return;
    setBusy(true);
    setError("");
    try {
      await deleteComboImage(comboId);
      setImageUrl(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const title = isCreate ? "New Combo" : (loaded?.name ?? "Edit Combo");

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Combos", href: "/admin/combos" },
          { label: title },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        <div className="flex gap-2">
          <Link href="/admin/combos" className="rounded-lg border border-line px-4 py-2 text-sm">
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void onSave()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
          >
            Save Combo
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold text-fg">Basics</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="combo-name" className="mb-1 block text-sm font-medium text-fg">
                  Combo name
                </label>
                <input
                  id="combo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="combo-desc" className="mb-1 block text-sm font-medium text-fg">
                  Description
                </label>
                <textarea
                  id="combo-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                />
              </div>
              {!isCreate && (
                <div>
                  <span className="mb-2 block text-sm font-medium text-fg">Image</span>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="mb-2 aspect-[16/6] w-full max-w-md rounded-lg object-cover" />
                  ) : (
                    <div className="mb-2 aspect-[16/6] w-full max-w-md rounded-lg bg-surface-hover" />
                  )}
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onImagePick(f);
                        }}
                      />
                    </label>
                    {imageUrl && (
                      <button type="button" onClick={() => void onImageRemove()} className="text-sm text-brand">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-fg">Components</h2>
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                Add Component
              </button>
            </div>
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li
                  key={`${r.item.kind}-${r.item.kind === "product" ? r.item.product_id : r.item.category_id}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <span className="text-sm font-medium text-fg">{r.label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => bumpQty(i, -1)}
                      className="h-8 w-8 rounded-full border border-line text-sm"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm">{r.item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => bumpQty(i, 1)}
                      className="h-8 w-8 rounded-full border border-line text-sm"
                    >
                      +
                    </button>
                    <button type="button" onClick={() => removeRow(i)} className="text-sm text-brand">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {pickerOpen && <ComboComponentPicker onAdd={addRow} onClose={() => setPickerOpen(false)} />}
            <p className="mt-3 text-xs text-muted">
              A combo needs at least 2 component items (sum of quantities).
              {sumQty < 2 ? " Add more to enable save." : null}
            </p>
          </section>

          {!isCreate && (
            <div>
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-danger">Delete this combo permanently?</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDelete()}
                    className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white"
                  >
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-muted">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-danger">
                  Delete combo
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold text-fg">Pricing</h2>
            <div className="flex justify-between text-sm text-muted">
              <span>Components total</span>
              <span className="font-medium text-fg">{formatVnd(componentsTotal)}</span>
            </div>
            <div className="mt-3">
              <label htmlFor="combo-price" className="mb-1 block text-sm font-medium text-fg">
                Combo price
              </label>
              <input
                id="combo-price"
                inputMode="numeric"
                value={comboPrice}
                onChange={(e) => setComboPrice(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              />
            </div>
            {savings > 0 && priceNum <= componentsTotal && (
              <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm font-semibold text-fg">
                <span>Customer saves</span>
                <span>{formatVnd(savings)}</span>
              </div>
            )}
            {priceNum > componentsTotal && componentsTotal > 0 && (
              <p className="mt-3 rounded-lg border border-line bg-surface-hover px-3 py-2 text-xs text-muted">
                This combo costs more than its components bought separately. It can still be saved,
                but customers won&apos;t see a savings badge.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold text-fg">Validity</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="valid-start" className="mb-1 block text-sm font-medium text-fg">
                  Starts
                </label>
                <input
                  id="valid-start"
                  type="date"
                  value={validityStart}
                  onChange={(e) => setValidityStart(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="valid-end" className="mb-1 block text-sm font-medium text-fg">
                  Ends
                </label>
                <input
                  id="valid-end"
                  type="date"
                  value={validityEnd}
                  onChange={(e) => setValidityEnd(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                />
              </div>
            </div>
            {loaded?.status && (
              <p className="mt-2 text-xs text-muted">Status: {loaded.status}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}