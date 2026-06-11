"use client";

import { useEffect, useRef, useState } from "react";

import { OptionGroupSelector } from "@/components/menu/option-group-selector";
import { fetchItem, type MenuItemDetail } from "@/lib/api/menu";
import { defaultOptionSelections } from "@/lib/option-defaults";

type Props = {
  productId: number;
  options: Record<number, number[]> | null;
  onOptionsChange: (options: Record<number, number[]>) => void;
};

const detailCache = new Map<number, MenuItemDetail>();

export function PickOptions({ productId, options, onOptionsChange }: Props) {
  const [detail, setDetail] = useState<MenuItemDetail | null>(detailCache.get(productId) ?? null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(productId);

  useEffect(() => {
    latest.current = productId;
    const cached = detailCache.get(productId);
    if (cached) {
      setDetail(cached);
      return;
    }
    setDetail(null);
    setFailed(false);
    fetchItem(productId)
      .then((d) => {
        detailCache.set(productId, d);
        if (latest.current === productId) setDetail(d);
      })
      .catch(() => {
        if (latest.current === productId) setFailed(true);
      });
  }, [productId]);

  useEffect(() => {
    if (detail && options === null) {
      onOptionsChange(defaultOptionSelections(detail.option_groups));
    }
  }, [detail, options, onOptionsChange]);

  if (failed) {
    return <p className="text-sm text-danger">Couldn&apos;t load options for this dish.</p>;
  }
  if (!detail || options === null) {
    return <div className="h-6 w-40 animate-pulse rounded bg-surface-active" />;
  }
  if (detail.option_groups.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3 border-l-2 border-line pl-4">
      {detail.option_groups.map((g) => (
        <div key={g.group_id} className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted">
            {g.name}
            {g.select_type === "multi" ? " (Optional)" : ""}
          </h4>
          <OptionGroupSelector
            group={g}
            selectedIds={options[g.group_id] ?? []}
            onChange={(ids) => onOptionsChange({ ...options, [g.group_id]: ids })}
          />
        </div>
      ))}
    </div>
  );
}