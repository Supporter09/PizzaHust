"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { OptionsEditor } from "@/components/admin/options-editor";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemOut"];

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;

export default function AdminItemEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [item, setItem] = useState<ItemOut | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setError("Item not found.");
      return;
    }
    apiFetch<ItemOut>(`/admin/items/${numericId}`)
      .then(setItem)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : String(e)));
  }, [numericId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
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

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      {item && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-fg">{item.name}</h1>
              <p className="mt-1 text-sm text-muted">
                Base price {vnd(item.base_price_vnd)} ·{" "}
                {item.is_active ? "Active" : "Inactive"} ·{" "}
                <Link href="/admin/items" className="text-brand hover:underline">
                  edit basics in the items list
                </Link>
              </p>
            </div>
          </div>

          <OptionsEditor productId={item.product_id} itemName={item.name} />
        </>
      )}
    </div>
  );
}
