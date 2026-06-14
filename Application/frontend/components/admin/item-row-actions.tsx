"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { components } from "@/lib/api/types";

type ItemOut = components["schemas"]["ItemOut"];

type Props = {
  item: ItemOut;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (hard: boolean) => Promise<void>;
  onRestore: () => Promise<void>;
};

const ICON_BTN =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";
const TEXT_BTN = "inline-flex h-11 items-center justify-center rounded-lg px-3 text-xs font-medium";

export function ItemRowActions({ item, busy, onUpload, onDelete, onRestore }: Props) {
  const [confirm, setConfirm] = useState<"none" | "soft" | "hard">("none");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/items/${item.product_id}`}
        aria-label={`Edit ${item.name}`}
        className={`${ICON_BTN} text-muted hover:bg-surface-hover hover:text-fg`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </Link>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy || uploading}
        aria-label={`Change image for ${item.name}`}
        className={`${ICON_BTN} text-muted hover:bg-surface-hover hover:text-fg disabled:opacity-50`}
      >
        {uploading ? (
          <span className="text-xs">…</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {item.is_active ? (
        confirm === "soft" ? (
          <>
            <button type="button" onClick={() => void onDelete(false)} disabled={busy || uploading} className={`${TEXT_BTN} bg-danger-solid text-on-brand hover:opacity-90 disabled:opacity-50`}>
              Confirm
            </button>
            <button type="button" onClick={() => setConfirm("none")} className={`${TEXT_BTN} text-muted hover:bg-surface-hover`}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm("soft")}
            aria-label={`Delete ${item.name}`}
            className={`${ICON_BTN} text-danger hover:bg-danger-subtle`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )
      ) : confirm === "hard" ? (
        <>
          <button type="button" onClick={() => void onDelete(true)} disabled={busy || uploading} className={`${TEXT_BTN} bg-danger-solid text-on-brand hover:opacity-90 disabled:opacity-50`}>
            Delete forever
          </button>
          <button type="button" onClick={() => setConfirm("none")} className={`${TEXT_BTN} text-muted hover:bg-surface-hover`}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => void onRestore()} disabled={busy || uploading} className={`${TEXT_BTN} text-brand-fg hover:bg-surface-hover disabled:opacity-50`}>
            Restore
          </button>
          <button type="button" onClick={() => setConfirm("hard")} className={`${TEXT_BTN} text-danger hover:bg-danger-subtle`}>
            Delete forever
          </button>
        </>
      )}
    </div>
  );
}
