// components/admin/image-gallery.tsx
"use client";

import { useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type ImageOut = components["schemas"]["ImageOut"];

const MAX_IMAGES = 8;

// Inline SVGs match the repo's 24x24 stroke icon convention (see admin/layout.tsx).
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

export function ImageGallery({
  ownerKind,
  ownerId,
  initial,
}: {
  ownerKind: "items" | "combos";
  ownerId: number;
  initial: ImageOut[];
}) {
  const [images, setImages] = useState<ImageOut[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const base = `/admin/${ownerKind}/${ownerId}/images`;

  async function reload() {
    const detail = await apiFetch<{ images: ImageOut[] }>(`/admin/${ownerKind}/${ownerId}`);
    setImages(detail.images ?? []);
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    void run(() => apiFetch(base, { method: "POST", body: fd }));
  }

  return (
    <section className="space-y-3" aria-label="Images">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Images</h2>
        <span className="text-xs text-muted">{images.length} / {MAX_IMAGES}</span>
      </div>
      <p className="text-xs text-muted">
        Up to {MAX_IMAGES} images. The cover shows on menu cards; the rest appear in the photo
        gallery.
      </p>

      {error && (
        <div className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img) => (
          <div
            key={img.image_id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {img.is_cover && (
              <span className="absolute bottom-2 left-2 rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                Cover
              </span>
            )}
            <div className="absolute right-2 top-2 flex gap-1.5">
              {!img.is_cover && (
                <button
                  type="button"
                  aria-label="Set as cover"
                  title="Set as cover"
                  disabled={busy}
                  onClick={() =>
                    void run(() => apiFetch(`${base}/${img.image_id}/cover`, { method: "POST" }))
                  }
                  className="grid h-11 w-11 place-items-center rounded-full bg-card/90 text-fg shadow hover:bg-card focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <StarIcon />
                </button>
              )}
              <button
                type="button"
                aria-label="Remove image"
                title="Remove"
                disabled={busy}
                onClick={() =>
                  void run(() => apiFetch(`${base}/${img.image_id}`, { method: "DELETE" }))
                }
                className="grid h-11 w-11 place-items-center rounded-full bg-card/90 text-danger shadow hover:bg-card focus:outline-none focus:ring-2 focus:ring-danger"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="grid aspect-square place-items-center rounded-lg border border-dashed border-line bg-surface text-sm text-muted hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
          >
            + Add image
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </section>
  );
}