import { Suspense } from "react";

import { TrackClient } from "./track-client";

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface-active" />}>
      <TrackClient />
    </Suspense>
  );
}