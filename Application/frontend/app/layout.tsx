import type { Metadata } from "next";
import localFont from "next/font/local";

import { AuthProvider } from "@/components/auth-provider";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { TopNav } from "@/components/top-nav";
import { bootstrapTheme } from "@/lib/theme";

import "./globals.css";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "PizzaHUST",
  description: "Web-only pizza ordering MVP",
};

const themeScript = `(${bootstrapTheme.toString()})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen bg-surface text-fg ${poppins.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeBootstrap />
        <AuthProvider>
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}