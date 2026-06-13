"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { BasicsEditor } from "@/components/admin/basics-editor";
import Breadcrumb from "@/components/admin/Breadcrumb";
import { ImageGallery } from "@/components/admin/image-gallery";
import { OptionsEditor } from "@/components/admin/options-editor";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemDetailOut"];
type CategoryOut = components["schemas"]["CategoryOut"];

export default function AdminItemEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [item, setItem] = useState<ItemOut | null>(null);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setError("Item not found.");
      return;
    }
    try {
      const loaded = await apiFetch<ItemOut>(`/admin/items/${numericId}`);
      setItem(loaded);
      // Categories feed the basics-editor dropdown; a failure leaves it empty
      // but the rest of the editor keeps working.
      apiFetch<CategoryOut[]>(`/admin/categories`)
        .then((cats) => setCategories(cats))
        .catch(() => undefined);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : String(e));
    }
  }, [numericId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Menu Items", href: "/admin/items" },
          { label: item?.name ?? `#${id}` },
        ]}
      />

      <Link
        href="/admin/items"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        ← Back to Menu Management
      </Link>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      {item && (
        <>
          <h1 className="mb-4 text-2xl font-semibold text-fg">Edit Dish</h1>

          <BasicsEditor item={item} categories={categories} onSaved={setItem} />

          <div className="mb-6 rounded-xl border border-line bg-surface p-4">
            <ImageGallery ownerKind="items" ownerId={item.product_id} initial={item.images ?? []} />
          </div>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-4 text-lg font-semibold text-fg">Options</h2>
            <OptionsEditor productId={item.product_id} />
          </section>
        </>
      )}
    </div>
  );
}
