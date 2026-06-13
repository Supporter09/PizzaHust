"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const authorized = !loading && user?.role === "kitchen";

  useEffect(() => {
    if (!loading && user?.role !== "kitchen") {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-muted">
        {loading ? "Checking access…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/kitchen" className="text-lg font-extrabold tracking-tight text-fg">
            Pizza<span className="text-brand-fg">Hust</span>
          </Link>
          <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-fg">
            Kitchen
          </span>
          <div
            className="ml-auto flex items-center gap-2 text-sm text-muted"
            data-testid="kitchen-poll-indicator"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-success motion-safe:animate-pulse" />
            Auto-refresh · 3s
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md px-3 py-2 text-sm font-medium text-fg hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
