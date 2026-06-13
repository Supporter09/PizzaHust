"use client";

import { useState } from "react";

import { CoverFallback } from "@/components/cover-fallback";
import type { components } from "@/lib/api/types";

type ImageOut = components["schemas"]["ImageOut"];

export function ImageViewer({ images, name }: { images: ImageOut[]; name: string }) {
  const ordered = images;
  const [active, setActive] = useState(ordered[0]?.url ?? null);

  if (!active) {
    return <CoverFallback label={name} className="h-72 w-full sm:h-96" />;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active} alt={name} className="h-72 w-full object-cover sm:h-96" />
      </div>
      {ordered.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {ordered.map((img) => (
            <button
              key={img.image_id}
              type="button"
              aria-label={`Show image ${img.image_id}`}
              aria-pressed={active === img.url}
              onClick={() => setActive(img.url)}
              className={`aspect-square overflow-hidden rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand ${
                active === img.url ? "border-brand ring-2 ring-brand" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}