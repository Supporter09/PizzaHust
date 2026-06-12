"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { TopNav } from "@/components/top-nav";

/**
 * Customer chrome (top nav + centered main + footer) for public/customer routes.
 * The `/admin/*` subtree renders its own full-bleed shell (app/admin/layout.tsx),
 * so we suppress the public chrome there instead of nesting two layouts.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </>
  );
}
