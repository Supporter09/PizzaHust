"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold text-fg">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">An unexpected error occurred. Please try again.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6 px-5 py-2.5">
        Try again
      </button>
    </div>
  );
}