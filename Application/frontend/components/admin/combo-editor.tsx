"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import ComboBasicsSection from "@/components/admin/combo-basics-section";
import ComboComponentsPanel, {
  comboItemToRow,
  sameComponent,
  type EditorRow,
} from "@/components/admin/combo-components-panel";
import ComboPricingColumn from "@/components/admin/combo-pricing-column";
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
import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemOut"];

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
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
        <div>
          <h1 className="text-2xl font-semibold text-fg">{isCreate ? "New Combo" : "Edit Combo"}</h1>
          {!isCreate && loaded ? (
            <p className="mt-0.5 text-sm text-muted">{loaded.name}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link href="/admin/combos" className="rounded-lg border border-line px-4 py-2 text-sm">
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void onSave()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50"
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
          <ComboBasicsSection
            name={name}
            onName={setName}
            description={description}
            onDescription={setDescription}
            showImage={!isCreate}
            imageUrl={imageUrl}
            onImagePick={(f) => void onImagePick(f)}
            onImageRemove={() => void onImageRemove()}
          />

          <ComboComponentsPanel
            rows={rows}
            sumQty={sumQty}
            pickerOpen={pickerOpen}
            onTogglePicker={() => setPickerOpen((o) => !o)}
            onClosePicker={() => setPickerOpen(false)}
            onAdd={addRow}
            onBumpQty={bumpQty}
            onRemove={removeRow}
          />

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
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm text-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-danger"
                >
                  Delete combo
                </button>
              )}
            </div>
          )}
        </div>

        <ComboPricingColumn
          componentsTotal={componentsTotal}
          comboPrice={comboPrice}
          onComboPrice={setComboPrice}
          priceNum={priceNum}
          savings={savings}
          validityStart={validityStart}
          onValidityStart={setValidityStart}
          validityEnd={validityEnd}
          onValidityEnd={setValidityEnd}
          status={loaded?.status ?? null}
        />
      </div>
    </div>
  );
}
