"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { CategoryOptionsEditor } from "@/components/admin/category-options-editor";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type CategoryOut = components["schemas"]["CategoryOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

export default function CategoryPresetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const categoryId = Number(id);

  const [category, setCategory] = useState<CategoryOut | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setCategory(await apiFetch<CategoryOut>(`/admin/categories/${categoryId}`));
    } catch (e) {
      setError(msg(e));
    }
  }, [categoryId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="pb-24">
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
        Option groups defined here are enabled automatically on dishes <strong>created</strong> in
        this category. Editing the preset does not change existing dishes.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <CategoryOptionsEditor categoryId={categoryId} />
    </div>
  );
}
