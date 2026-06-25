"use client";

import { useRef, useState } from "react";
import Breadcrumb from "@/components/admin/Breadcrumb";

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type ImportType = "pizzas" | "toppings";

const TEMPLATES: Record<ImportType, { header: string; example: string }> = {
  pizzas: {
    header: "name,category_name,base_price_vnd",
    example: "Margherita Classic,Pizza,125000\nPepperoni Fire,Pizza,145000\nGarlic Cheese Bites,Side Dishes,45000",
  },
  toppings: {
    header: "name,price_vnd",
    example: "Extra Cheese,15000\nJalapeño,10000\nShrimp,22000",
  },
};

function downloadTemplate(type: ImportType) {
  const { header, example } = TEMPLATES[type];
  const content = `${header}\n${example}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template_${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getCsrf() {
  const m = document.cookie.match(/csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function ImportSection({ type, label }: { type: ImportType; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/import/${type}`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrf() },
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
      setResult(body as ImportSummary);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{label}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Columns: <code className="bg-gray-100 px-1 rounded">{TEMPLATES[type].header}</code>
          </p>
        </div>
        <button
          onClick={() => downloadTemplate(type)}
          className="text-xs text-[#C73E1D] hover:underline font-medium"
        >
          ⬇ Tải template CSV
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(""); }}
          className="text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        <button
          onClick={() => void handleUpload()}
          disabled={!file || uploading}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-[#C73E1D] text-white hover:bg-[#a83218] disabled:opacity-40"
        >
          {uploading ? "Đang import…" : "Import"}
        </button>
      </div>

      {file && !result && (
        <p className="mt-2 text-xs text-gray-400">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
          <div className="flex gap-6 text-sm mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.created}</div>
              <div className="text-xs text-gray-500">Tạo mới</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
              <div className="text-xs text-gray-500">Cập nhật</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{result.skipped}</div>
              <div className="text-xs text-gray-500">Bỏ qua</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-orange-700 mb-1">Lỗi từng dòng:</p>
              <ul className="text-xs text-orange-600 space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminImportPage() {
  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Bulk Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">A1·A2 – Import hàng loạt pizza và topping từ file CSV</p>
      </div>

      <div className="space-y-6">
        <ImportSection type="pizzas" label="Import Pizzas" />
        <ImportSection type="toppings" label="Import Toppings" />
      </div>

      <div className="mt-8 rounded-xl bg-blue-50 border border-blue-200 p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Hướng dẫn</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• File CSV phải có hàng đầu tiên là tên cột (header), tối đa 500 dòng, 2MB.</li>
          <li>• Nếu <strong>name</strong> đã tồn tại → giá và category sẽ được <strong>cập nhật</strong> (không tạo trùng).</li>
          <li>• <code>category_name</code> không tồn tại sẽ được <strong>tạo tự động</strong>.</li>
          <li>• Nhấn "Tải template CSV" để lấy file mẫu với đúng định dạng.</li>
        </ul>
      </div>
    </div>
  );
}
