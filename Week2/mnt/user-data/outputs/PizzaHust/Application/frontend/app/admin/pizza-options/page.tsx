"use client";

import { useEffect, useState } from "react";

/* ─── Types ─────────────────────────────────────────── */

interface Size { size_id: number; name: string; price_modifier_vnd: number; }
interface Crust { crust_id: number; name: string; }
interface Topping { topping_id: number; name: string; price_vnd: number; }
interface SideDish {
  product_id: number; name: string; category_id: number; base_price_vnd: number;
  is_pizza: boolean; image_url: string | null; is_active: boolean;
}
interface Category { category_id: number; name: string; }

type Tab = "sizes" | "crusts" | "toppings" | "sides";

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function getCsrf() {
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/* ─── Generic small CRUD table ───────────────────────── */

function CrudTable<T extends Record<string, unknown>>({
  rows, columns, onEdit, onDelete, deletingId, idKey,
}: {
  rows: T[];
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  deletingId: number | null;
  idKey: keyof T;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {c.label}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
          )}
          {rows.map((row) => (
            <tr key={String(row[idKey])} className="hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 text-gray-700">
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
              <td className="px-4 py-3 flex gap-2 justify-end">
                <button onClick={() => onEdit(row)} className="rounded px-2.5 py-1 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">Sửa</button>
                <button
                  onClick={() => onDelete(row)}
                  disabled={deletingId === Number(row[idKey])}
                  className="rounded px-2.5 py-1 text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingId === Number(row[idKey]) ? "…" : "Xóa"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Sizes section ───────────────────────────────────── */

function SizesSection() {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Size | null>(null);
  const [form, setForm] = useState({ name: "", price_modifier_vnd: 0 });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function fetch_() {
    setLoading(true);
    const res = await fetch("/api/admin/pizza-sizes", { credentials: "include" });
    if (res.ok) setSizes(await res.json());
    setLoading(false);
  }
  useEffect(() => { void fetch_(); }, []);

  function openAdd() { setEditing(null); setForm({ name: "", price_modifier_vnd: 0 }); setFormErr(""); setShowForm(true); }
  function openEdit(s: Size) { setEditing(s); setForm({ name: s.name, price_modifier_vnd: s.price_modifier_vnd }); setFormErr(""); setShowForm(true); }

  async function save() {
    if (!form.name.trim()) { setFormErr("Tên size không được trống"); return; }
    setSaving(true); setFormErr("");
    const url = editing ? `/api/admin/pizza-sizes/${editing.size_id}` : "/api/admin/pizza-sizes";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); await fetch_(); }
    else { const b = await res.json().catch(() => ({})); setFormErr(b.detail ?? `HTTP ${res.status}`); }
    setSaving(false);
  }

  async function del(s: Size) {
    if (!confirm(`Xóa size "${s.name}"?`)) return;
    setDeletingId(s.size_id);
    const res = await fetch(`/api/admin/pizza-sizes/${s.size_id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": getCsrf() } });
    if (!res.ok) alert(`Lỗi HTTP ${res.status}`);
    else await fetch_();
    setDeletingId(null);
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Đang tải…</p>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="rounded-md bg-[#C73E1D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a83218]">+ Thêm Size</button>
      </div>
      <CrudTable
        rows={sizes as unknown as Record<string, unknown>[]}
        idKey="size_id"
        deletingId={deletingId}
        onEdit={(r) => openEdit(r as unknown as Size)}
        onDelete={(r) => void del(r as unknown as Size)}
        columns={[
          { key: "size_id", label: "ID" },
          { key: "name", label: "Tên" },
          { key: "price_modifier_vnd", label: "Phụ thu", render: (r) => formatVND(Number((r as unknown as Size).price_modifier_vnd)) },
        ]}
      />
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Sửa Size" : "Thêm Size"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" placeholder="S / M / L…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phụ thu (VND)</label>
                <input type="number" value={form.price_modifier_vnd} onChange={(e) => setForm({ ...form, price_modifier_vnd: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" step={1000} />
              </div>
            </div>
            {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm border border-gray-200 text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={() => void save()} disabled={saving} className="rounded-lg px-4 py-2 text-sm bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Crusts section ───────────────────────────────────── */

function CrustsSection() {
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Crust | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function fetch_() {
    setLoading(true);
    const res = await fetch("/api/admin/pizza-crusts", { credentials: "include" });
    if (res.ok) setCrusts(await res.json());
    setLoading(false);
  }
  useEffect(() => { void fetch_(); }, []);

  function openAdd() { setEditing(null); setName(""); setFormErr(""); setShowForm(true); }
  function openEdit(c: Crust) { setEditing(c); setName(c.name); setFormErr(""); setShowForm(true); }

  async function save() {
    if (!name.trim()) { setFormErr("Tên crust không được trống"); return; }
    setSaving(true); setFormErr("");
    const url = editing ? `/api/admin/pizza-crusts/${editing.crust_id}` : "/api/admin/pizza-crusts";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) { setShowForm(false); await fetch_(); }
    else { const b = await res.json().catch(() => ({})); setFormErr(b.detail ?? `HTTP ${res.status}`); }
    setSaving(false);
  }

  async function del(c: Crust) {
    if (!confirm(`Xóa crust "${c.name}"?`)) return;
    setDeletingId(c.crust_id);
    const res = await fetch(`/api/admin/pizza-crusts/${c.crust_id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": getCsrf() } });
    if (!res.ok) alert(`Lỗi HTTP ${res.status}`);
    else await fetch_();
    setDeletingId(null);
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Đang tải…</p>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="rounded-md bg-[#C73E1D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a83218]">+ Thêm Crust</button>
      </div>
      <CrudTable
        rows={crusts as unknown as Record<string, unknown>[]}
        idKey="crust_id"
        deletingId={deletingId}
        onEdit={(r) => openEdit(r as unknown as Crust)}
        onDelete={(r) => void del(r as unknown as Crust)}
        columns={[
          { key: "crust_id", label: "ID" },
          { key: "name", label: "Tên" },
        ]}
      />
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Sửa Crust" : "Thêm Crust"}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" placeholder="thin / cheese-stuffed…" />
            </div>
            {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm border border-gray-200 text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={() => void save()} disabled={saving} className="rounded-lg px-4 py-2 text-sm bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Toppings section ───────────────────────────────── */

function ToppingsSection() {
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Topping | null>(null);
  const [form, setForm] = useState({ name: "", price_vnd: 0 });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function fetch_() {
    setLoading(true);
    const res = await fetch("/api/admin/toppings", { credentials: "include" });
    if (res.ok) setToppings(await res.json());
    setLoading(false);
  }
  useEffect(() => { void fetch_(); }, []);

  function openAdd() { setEditing(null); setForm({ name: "", price_vnd: 0 }); setFormErr(""); setShowForm(true); }
  function openEdit(t: Topping) { setEditing(t); setForm({ name: t.name, price_vnd: t.price_vnd }); setFormErr(""); setShowForm(true); }

  async function save() {
    if (!form.name.trim()) { setFormErr("Tên topping không được trống"); return; }
    setSaving(true); setFormErr("");
    const url = editing ? `/api/admin/toppings/${editing.topping_id}` : "/api/admin/toppings";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify({ name: form.name.trim(), price_vnd: form.price_vnd }),
    });
    if (res.ok) { setShowForm(false); await fetch_(); }
    else { const b = await res.json().catch(() => ({})); setFormErr(b.detail ?? `HTTP ${res.status}`); }
    setSaving(false);
  }

  async function del(t: Topping) {
    if (!confirm(`Xóa topping "${t.name}"?`)) return;
    setDeletingId(t.topping_id);
    const res = await fetch(`/api/admin/toppings/${t.topping_id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": getCsrf() } });
    if (!res.ok) alert(`Lỗi HTTP ${res.status}`);
    else await fetch_();
    setDeletingId(null);
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Đang tải…</p>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="rounded-md bg-[#C73E1D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a83218]">+ Thêm Topping</button>
      </div>
      <CrudTable
        rows={toppings as unknown as Record<string, unknown>[]}
        idKey="topping_id"
        deletingId={deletingId}
        onEdit={(r) => openEdit(r as unknown as Topping)}
        onDelete={(r) => void del(r as unknown as Topping)}
        columns={[
          { key: "topping_id", label: "ID" },
          { key: "name", label: "Tên" },
          { key: "price_vnd", label: "Giá", render: (r) => formatVND(Number((r as unknown as Topping).price_vnd)) },
        ]}
      />
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Sửa Topping" : "Thêm Topping"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VND) *</label>
                <input type="number" value={form.price_vnd} onChange={(e) => setForm({ ...form, price_vnd: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" step={1000} />
              </div>
            </div>
            {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm border border-gray-200 text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={() => void save()} disabled={saving} className="rounded-lg px-4 py-2 text-sm bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Side Dishes section ─────────────────────────────── */

function SideDishesSection() {
  const [sides, setSides] = useState<SideDish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SideDish | null>(null);
  const [form, setForm] = useState({ name: "", category_id: 0, base_price_vnd: 0 });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function fetch_() {
    setLoading(true);
    const [sRes, cRes] = await Promise.all([
      fetch("/api/admin/side-dishes", { credentials: "include" }),
      fetch("/api/admin/categories", { credentials: "include" }),
    ]);
    if (sRes.ok) setSides(await sRes.json());
    if (cRes.ok) setCategories(await cRes.json());
    setLoading(false);
  }
  useEffect(() => { void fetch_(); }, []);

  function openAdd() { setEditing(null); setForm({ name: "", category_id: categories[0]?.category_id ?? 0, base_price_vnd: 0 }); setFormErr(""); setShowForm(true); }
  function openEdit(s: SideDish) { setEditing(s); setForm({ name: s.name, category_id: s.category_id, base_price_vnd: s.base_price_vnd }); setFormErr(""); setShowForm(true); }

  async function save() {
    if (!form.name.trim()) { setFormErr("Tên không được trống"); return; }
    setSaving(true); setFormErr("");
    const url = editing ? `/api/admin/side-dishes/${editing.product_id}` : "/api/admin/side-dishes";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrf() },
      body: JSON.stringify({ name: form.name.trim(), category_id: form.category_id, base_price_vnd: form.base_price_vnd }),
    });
    if (res.ok) { setShowForm(false); await fetch_(); }
    else { const b = await res.json().catch(() => ({})); setFormErr(b.detail ?? `HTTP ${res.status}`); }
    setSaving(false);
  }

  async function del(s: SideDish) {
    if (!confirm(`Xóa "${s.name}"?`)) return;
    setDeletingId(s.product_id);
    const res = await fetch(`/api/admin/side-dishes/${s.product_id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": getCsrf() } });
    if (!res.ok) alert(`Lỗi HTTP ${res.status}`);
    else await fetch_();
    setDeletingId(null);
  }

  const catName = (id: number) => categories.find((c) => c.category_id === id)?.name ?? "-";

  if (loading) return <p className="text-sm text-gray-400 py-4">Đang tải…</p>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="rounded-md bg-[#C73E1D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a83218]">+ Thêm Side Dish</button>
      </div>
      <CrudTable
        rows={sides as unknown as Record<string, unknown>[]}
        idKey="product_id"
        deletingId={deletingId}
        onEdit={(r) => openEdit(r as unknown as SideDish)}
        onDelete={(r) => void del(r as unknown as SideDish)}
        columns={[
          { key: "product_id", label: "ID" },
          { key: "name", label: "Tên" },
          { key: "category_id", label: "Category", render: (r) => catName(Number((r as unknown as SideDish).category_id)) },
          { key: "base_price_vnd", label: "Giá", render: (r) => formatVND(Number((r as unknown as SideDish).base_price_vnd)) },
        ]}
      />
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Sửa Side Dish" : "Thêm Side Dish"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]">
                  {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VND) *</label>
                <input type="number" value={form.base_price_vnd} onChange={(e) => setForm({ ...form, base_price_vnd: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C73E1D]" step={1000} />
              </div>
            </div>
            {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm border border-gray-200 text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={() => void save()} disabled={saving} className="rounded-lg px-4 py-2 text-sm bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main page ───────────────────────────────────────── */

const TABS: { id: Tab; label: string }[] = [
  { id: "sizes", label: "Pizza Sizes" },
  { id: "crusts", label: "Pizza Crusts" },
  { id: "toppings", label: "Toppings" },
  { id: "sides", label: "Side Dishes" },
];

export default function AdminPizzaOptionsPage() {
  const [tab, setTab] = useState<Tab>("sizes");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Pizza Options</h1>
        <p className="text-sm text-gray-500 mt-0.5">A2 – Quản lý sizes, crusts, toppings và side dishes</p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === t.id
                ? "bg-white border border-b-white border-gray-200 text-[#C73E1D] -mb-px"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sizes" && <SizesSection />}
      {tab === "crusts" && <CrustsSection />}
      {tab === "toppings" && <ToppingsSection />}
      {tab === "sides" && <SideDishesSection />}
    </div>
  );
}
