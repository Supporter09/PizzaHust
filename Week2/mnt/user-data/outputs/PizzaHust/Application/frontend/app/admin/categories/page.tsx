"use client";

import { useEffect, useState } from "react";

interface Category {
  category_id: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM = { name: "", description: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);

  function getCsrf() {
    const m = document.cookie.match(/csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  async function fetchCategories() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/categories", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Category[] = await res.json();
      setCategories(data.sort((a, b) => a.sort_order - b.sort_order));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchCategories(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description ?? "" });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Tên category không được để trống"); return; }
    setSaving(true);
    setFormError("");
    try {
      const url = editing ? `/api/admin/categories/${editing.category_id}` : "/api/admin/categories";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? body.detail ?? `HTTP ${res.status}`);
      }
      setShowForm(false);
      await fetchCategories();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(cat: Category) {
    setToggling(cat.category_id);
    try {
      const res = await fetch(`/api/admin/categories/${cat.category_id}/toggle-active`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrf() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchCategories();
    } catch (e) {
      alert(`Lỗi: ${e}`);
    } finally {
      setToggling(null);
    }
  }

  async function moveRow(idx: number, dir: -1 | 1) {
    const newCats = [...categories];
    const target = idx + dir;
    if (target < 0 || target >= newCats.length) return;
    [newCats[idx], newCats[target]] = [newCats[target], newCats[idx]];
    setCategories(newCats);

    // Persist order
    try {
      await fetch("/api/admin/categories/reorder", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
        body: JSON.stringify({ order: newCats.map((c) => c.category_id) }),
      });
    } catch {
      // non-critical; UI already updated optimistically
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">A3 – Thứ tự hiển thị, active/inactive</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-md bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a83218] transition-colors"
        >
          + Thêm Category
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Thứ tự", "Tên", "Mô tả", "Trạng thái", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Đang tải…</td></tr>
            )}
            {!loading && categories.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Chưa có category nào</td></tr>
            )}
            {!loading && categories.map((cat, idx) => (
              <tr key={cat.category_id} className={`hover:bg-gray-50 ${!cat.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => void moveRow(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30"
                      title="Lên"
                    >↑</button>
                    <button
                      onClick={() => void moveRow(idx, 1)}
                      disabled={idx === categories.length - 1}
                      className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30"
                      title="Xuống"
                    >↓</button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[240px] truncate">{cat.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    cat.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {cat.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <button
                    onClick={() => openEdit(cat)}
                    className="rounded px-2.5 py-1 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => void handleToggle(cat)}
                    disabled={toggling === cat.category_id}
                    className={`rounded px-2.5 py-1 text-xs font-medium border disabled:opacity-50 ${
                      cat.is_active
                        ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {toggling === cat.category_id ? "…" : cat.is_active ? "Ẩn" : "Hiện"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? `Sửa: ${editing.name}` : "Thêm Category mới"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]"
                  placeholder="VD: Pizza, Drinks…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D] resize-none"
                />
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
                {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
