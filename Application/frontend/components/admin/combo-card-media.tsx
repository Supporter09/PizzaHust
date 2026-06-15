"use client";

import { useState } from "react";

import { CoverFallback } from "@/components/cover-fallback";
import { resolveImageUrl } from "@/lib/image-url";

/**
 * Fixed 16:9 media box for combo cards. The wrapper owns the height, so a
 * missing or broken image can never blow the card out; a failed load swaps
 * to the branded placeholder.
 */
export function ComboCardMedia({ url, label }: { url: string | null | undefined; label: string }) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(url) && !errored;

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveImageUrl(url!)}
          alt=""
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <CoverFallback label={label} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
