import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth-provider";
import { TopNav } from "@/components/top-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "PizzaHUST",
  description: "Web-only pizza ordering MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--surface-bg)] text-slate-900">
        <AuthProvider>
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
