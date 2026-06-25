"use client";

import { useEffect, useState } from "react";

interface Product {
  product_id: number;
  name: string;
  base_price_vnd: number;
  is_pizza: boolean;
}

interface ComboItemIn {
  product_id: number;
  quantity: number;
}

interface ComboItemOut extends ComboItemIn {
  combo_item_id: number;
  product_name: string;
}

interface Combo {
  combo_id: number;
  name: string;
  description: string | null;
  combo_price_vnd: number;
  target_group: number | null;
  validity_start: string | null;
  validity_end: string | null;
  items: ComboItemOut[];
}

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toUtcIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

const EMPTY_FORM = {
  name: "",
  description: "",
  combo_price_vnd: 0,
  target_group: "",
  validity_start: "",
  validity_end: "",
  items: [] as ComboItemIn[],
};

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  function getCsrf() {
    const m = document.cookie.match(/csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [cRes, pRes, sRes] = await Promise.all([
        fetch("/api/admin/combos", { credentials: "include" }),
        fetch("/api/admin/pizzas", { credentials: "include" }),
        fetch("/api/admin/side-dishes", { credentials: "include" }),
      ]);
      if (!cRes.ok || !pRes.ok || !sRes.ok) throw new Error("Fetch failed");
      const [combosData, pizzas, sides] = await Promise.all([cRes.json(), pRes.json(), sRes.json()]);
      setCombos(combosData);
      setProducts([...pizzas, ...sides]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(combo: Combo) {
    setEditing(combo);
    setForm({
      name: combo.name,
      description: combo.description ?? "",
      combo_price_vnd: combo.combo_price_vnd,
      target_group: combo.target_group != null ? String(combo.target_group) : "",
      validity_start: toLocalDatetime(combo.validity_start),
      validity_end: toLocalDatetime(combo.validity_end),
      items: combo.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    });
    setFormError("");
    setShowForm(true);
  }

  function addItem() {
    if (products.length === 0) return;
    const firstProduct = products[0];
    setForm((f) => ({ ...f, items: [...f.items, { product_id: firstProduct.product_id, quantity: 1 }] }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function updateItem(idx: number, field: keyof ComboItemIn, value: number) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }

  function computeItemsTotal() {
    return form.items.reduce((sum, item) => {
      const p = products.find((pr) => pr.product_id === item.product_id);
      return sum + (p ? p.base_price_vnd * item.quantity : 0);
    }, 0);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Tên combo không được để trống"); return; }
    if (form.combo_price_vnd <= 0) { setFormError("Giá combo phải lớn hơn 0"); return; }

    // Client-side price validation
    const itemsTotal = computeItemsTotal();
    if (form.items.length > 0 && form.combo_price_vnd > itemsTotal) {
      setFormError(`Giá combo (${formatVND(form.combo_price_vnd)}) không được vượt quá tổng items (${formatVND(itemsTotal)})`);
      return;
    }

    // Validity window
    if (form.validity_start && form.validity_end) {
      if (new Date(form.validity_end) <= new Date(form.validity_start)) {
        setFormError("validity_end phải sau validity_start");
        return;
      }
    }

    // Warn about inactive pizzas in items
    const inactiveNames = form.items
      .map((i) => products.find((p) => p.product_id === i.product_id))
      .filter(Boolean)
      .filter((p) => !(p as Product & { is_active?: boolean }).is_active)
      .map((p) => p!.name);
    if (inactiveNames.length > 0) {
      if (!confirm(`⚠ Cảnh báo: Combo chứa item đang inactive: ${inactiveNames.join(", ")}.\nBạn có muốn tiếp tục?`)) return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        combo_price_vnd: form.combo_price_vnd,
        target_group: form.target_group ? Number(form.target_group) : null,
        validity_start: toUtcIso(form.validity_start),
        validity_end: toUtcIso(form.validity_end),
        items: form.items,
      };
      const url = editing ? `/api/admin/combos/${editing.combo_id}` : "/api/admin/combos";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.detail ?? `HTTP ${res.status}`);
      }
      setShowForm(false);
      await fetchData();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(combo: Combo) {
    if (!confirm(`Xóa combo "${combo.name}"? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(combo.combo_id);
    try {
      const res = await fetch(`/api/admin/combos/${combo.combo_id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrf() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch (e) {
      alert(`Lỗi: ${e}`);
    } finally {
      setDeleting(null);
    }
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("vi-VN");
  }

  const itemsTotal = computeItemsTotal();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý Combo Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">A4 – Tạo, sửa, xóa combo khuyến mãi</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a83218] transition-colors"
        >
          + Tạo Combo
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Tên Combo", "Giá", "Items", "Đối tượng", "Hiệu lực", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Đang tải…</td></tr>
            )}
            {!loading && combos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có combo nào</td></tr>
            )}
            {!loading && combos.map((combo) => (
              <tr key={combo.combo_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{combo.name}</div>
                  {combo.description && <div className="text-xs text-gray-400 mt-0.5">{combo.description}</div>}
                </td>
                <td className="px-4 py-3 font-medium text-[#C73E1D]">{formatVND(combo.combo_price_vnd)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {combo.items.length === 0 ? "—" : combo.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {combo.target_group ? `${combo.target_group} người` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {combo.validity_start ? `${fmtDate(combo.validity_start)} → ${fmtDate(combo.validity_end)}` : "—"}
                </td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button
                    onClick={() => openEdit(combo)}
                    className="rounded px-2.5 py-1 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => void handleDelete(combo)}
                    disabled={deleting === combo.combo_id}
                    className="rounded px-2.5 py-1 text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deleting === combo.combo_id ? "…" : "Xóa"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              {editing ? `Sửa combo: ${editing.name}` : "Tạo Combo mới"}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên combo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  placeholder="VD: Lunch Duo for 2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá combo (VND) *</label>
                <input
                  type="number"
                  value={form.combo_price_vnd}
                  onChange={(e) => setForm({ ...form, combo_price_vnd: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  min={0}
                  step={1000}
                />
                {form.items.length > 0 && (
                  <p className={`mt-1 text-xs ${form.combo_price_vnd > itemsTotal ? "text-red-600" : "text-green-600"}`}>
                    Tổng items: {formatVND(itemsTotal)}{" "}
                    {form.combo_price_vnd > itemsTotal ? "⚠ Vượt quá!" : "✓"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đối tượng (số người)</label>
                <input
                  type="number"
                  value={form.target_group}
                  onChange={(e) => setForm({ ...form, target_group: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  min={1}
                  placeholder="VD: 2, 4…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu lực từ</label>
                <input
                  type="datetime-local"
                  value={form.validity_start}
                  onChange={(e) => setForm({ ...form, validity_start: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu lực đến</label>
                <input
                  type="datetime-local"
                  value={form.validity_end}
                  onChange={(e) => setForm({ ...form, validity_end: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                />
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Items trong combo</label>
                <button
                  onClick={addItem}
                  className="text-xs text-[#C73E1D] hover:underline font-medium"
                >
                  + Thêm item
                </button>
              </div>

              {form.items.length === 0 && (
                <p className="text-sm text-gray-400 italic py-2">Chưa có item nào. Nhấn "+ Thêm item" để bắt đầu.</p>
              )}

              <div className="space-y-2">
                {form.items.map((item, idx) => {
                  const selectedProduct = products.find((p) => p.product_id === item.product_id);
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(idx, "product_id", Number(e.target.value))}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#C73E1D]"
                      >
                        {products.map((p) => (
                          <option key={p.product_id} value={p.product_id}>
                            {p.name} ({formatVND(p.base_price_vnd)})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">×</span>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                          className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#C73E1D]"
                          min={1}
                        />
                      </div>
                      {selectedProduct && (
                        <span className="text-xs text-gray-400 w-24 text-right shrink-0">
                          {formatVND(selectedProduct.base_price_vnd * item.quantity)}
                        </span>
                      )}
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-gray-400 hover:text-red-600 text-lg leading-none px-1"
                        title="Xóa item"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              {form.items.length > 0 && (
                <div className="mt-2 text-right text-xs text-gray-500">
                  Tổng items: <span className="font-semibold">{formatVND(itemsTotal)}</span>
                </div>
              )}
            </div>

            {formError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo Combo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
