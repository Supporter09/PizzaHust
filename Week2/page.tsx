"use client";

import { useEffect, useState, useRef } from "react";

interface Pizza {
  product_id: number;
  name: string;
  category_id: number;
  base_price_vnd: number;
  is_pizza: boolean;
  image_url: string | null;
  is_active: boolean;
}

interface Category {
  category_id: number;
  name: string;
}

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

const EMPTY_FORM = { name: "", category_id: 0, base_price_vnd: 0 };

export default function AdminPizzasPage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Pizza | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/pizzas", { credentials: "include" }),
        fetch("/api/admin/categories", { credentials: "include" }),
      ]);
      if (!pRes.ok || !cRes.ok) throw new Error("Fetch failed");
      setPizzas(await pRes.json());
      setCategories(await cRes.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.category_id ?? 0 });
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(pizza: Pizza) {
    setEditing(pizza);
    setForm({ name: pizza.name, category_id: pizza.category_id, base_price_vnd: pizza.base_price_vnd });
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  }

  function getCsrf(): string {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Tên pizza không được để trống"); return; }
    if (form.base_price_vnd <= 0) { setFormError("Giá phải lớn hơn 0"); return; }
    setSaving(true);
    setFormError("");
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("category_id", String(form.category_id));
      fd.append("base_price_vnd", String(form.base_price_vnd));
      if (imageFile) fd.append("image", imageFile);

      const url = editing ? `/api/admin/pizzas/${editing.product_id}` : "/api/admin/pizzas";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrf() },
        body: fd,
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

  async function handleDeactivate(pizza: Pizza) {
    const inCombos = false; // server will tell us
    if (!confirm(`Deactivate "${pizza.name}"? Pizza sẽ không còn hiển thị trên menu.`)) return;
    setDeactivating(pizza.product_id);
    try {
      const res = await fetch(`/api/admin/pizzas/${pizza.product_id}/deactivate`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrf() },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail: string = body.detail ?? "";
        if (detail.startsWith("PIZZA_IN_COMBOS:")) {
          const comboNames = detail.replace("PIZZA_IN_COMBOS:", "");
          alert(`⚠ Cảnh báo: Pizza này đang có trong combo: ${comboNames}.\nHãy cập nhật combo trước khi deactivate.`);
          return;
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      await fetchData();
    } catch (e) {
      alert(`Lỗi: ${e}`);
    } finally {
      setDeactivating(null);
    }
  }

  const catName = (id: number) => categories.find((c) => c.category_id === id)?.name ?? "-";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý Pizza</h1>
          <p className="text-sm text-gray-500 mt-0.5">A1 – Thêm, sửa, deactivate pizza trong menu</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a83218] transition-colors"
        >
          + Thêm Pizza
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["ID", "Tên", "Category", "Giá", "Trạng thái", ""].map((h) => (
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
            {!loading && pizzas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có pizza nào</td></tr>
            )}
            {!loading && pizzas.map((p) => (
              <tr key={p.product_id} className={`hover:bg-gray-50 ${!p.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.product_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{catName(p.category_id)}</td>
                <td className="px-4 py-3 font-medium">{formatVND(p.base_price_vnd)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded px-2.5 py-1 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  {p.is_active && (
                    <button
                      onClick={() => void handleDeactivate(p)}
                      disabled={deactivating === p.product_id}
                      className="rounded px-2.5 py-1 text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deactivating === p.product_id ? "…" : "Deactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? `Sửa: ${editing.name}` : "Thêm Pizza mới"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên pizza *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  placeholder="VD: Margherita Classic"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá cơ bản (VND) *</label>
                <input
                  type="number"
                  value={form.base_price_vnd}
                  onChange={(e) => setForm({ ...form, base_price_vnd: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  min={0}
                  step={1000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ảnh {editing ? "(để trống nếu không đổi)" : "(tùy chọn, tối đa 5MB)"}
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
                />
                {imageFile && (
                  <p className="mt-1 text-xs text-gray-400">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>
            </div>

            {formError && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
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
                {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo Pizza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
