"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { OptionsEditor } from "@/components/admin/options-editor";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemOut"];
type CategoryOut = components["schemas"]["CategoryOut"];

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;

export default function AdminItemEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [item, setItem] = useState<ItemOut | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setError("Item not found.");
      return;
    }
    let cancelled = false;
    apiFetch<ItemOut>(`/admin/items/${numericId}`)
      .then((loaded) => {
        if (cancelled) return;
        setItem(loaded);
        // Category name lives on a separate endpoint; resolve it for the subtitle.
        // Failures are deliberately swallowed: the name is decorative, so the
        // subtitle just omits it and the editor keeps working.
        apiFetch<CategoryOut[]>(`/admin/categories`)
          .then((cats) => {
            if (cancelled) return;
            setCategoryName(cats.find((c) => c.category_id === loaded.category_id)?.name ?? null);
          })
          .catch(() => undefined);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiClientError ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const t = setTimeout(() => {
      cleanup = load();
    }, 0);
    return () => {
      clearTimeout(t);
      cleanup?.();
    };
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
          {/* DEFERRED (full dish editor in mockup, out of scope here): Basics form
              (name/category/base-price/prep-time/description), Visibility toggles,
              Danger Zone / delete-dish, and multi-image uploader (A9 unbuilt).
              This page stays an options-only editor; basics are edited in the items list. */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-fg">Edit Dish</h1>
              <p className="mt-1 text-sm text-muted">
                {item.name}
                {categoryName ? ` · ${categoryName}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                Base price {vnd(item.base_price_vnd)} ·{" "}
                {item.is_active ? "Active" : "Inactive"} ·{" "}
                <Link href="/admin/items" className="text-brand hover:underline">
                  edit basics in the items list
                </Link>
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-4 text-lg font-semibold text-fg">Options</h2>
            <OptionsEditor productId={item.product_id} itemName={item.name} />
          </section>
        </>
      )}
    </div>
  );
}
