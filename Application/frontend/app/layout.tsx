import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk, Work_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "PizzaHUST | Web MVP",
  description: "PizzaHUST App Router shell and design system foundation",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${displayFont.variable} ${bodyFont.variable} app-bg`}>
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-20 sm:px-6 sm:pb-8 lg:px-10">
          <header className="sticky top-0 z-30 mt-4 border border-[color:var(--ghost-border)] bg-white/92 shadow-[var(--shadow-soft)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <Link href="/" className="flex items-center gap-3">
                <span className="logo-wrap inline-flex items-center justify-center p-1.5">
                  <Image
                    src="/brand/pizzahust-mark.svg"
                    alt="PizzaHUST logo"
                    width={42}
                    height={42}
                    priority
                  />
                </span>
                <Image
                  src="/brand/pizzahust-wordmark.svg"
                  alt="PizzaHUST wordmark"
                  width={162}
                  height={44}
                  className="h-10 w-auto"
                  priority
                />
              </Link>

              <button
                type="button"
                className="shell-action inline-flex h-11 w-11 items-center justify-center md:hidden"
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[color:var(--ink)]">
                  <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>

              <nav className="hidden items-center gap-5 md:flex">
                <Link href="/menu" className="nav-link text-[13px] font-semibold text-[color:var(--ink-soft)]">
                  Menu
                </Link>
                <Link href="/promotions" className="nav-link text-[13px] font-semibold text-[color:var(--ink-soft)]">
                  Promotions
                </Link>
                <Link href="/track" className="nav-link text-[13px] font-semibold text-[color:var(--ink-soft)]">
                  Track
                </Link>
                <Link href="/orders" className="nav-link text-[13px] font-semibold text-[color:var(--ink-soft)]">
                  Orders
                </Link>
              </nav>

              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  className="shell-action inline-flex h-11 w-11 items-center justify-center"
                  aria-label="View cart"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[color:var(--ink)]">
                    <path
                      d="M3 4H5L7.4 14.6C7.6 15.4 8.3 16 9.1 16H18.4C19.1 16 19.8 15.6 20 14.9L22 8H6.3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="20" r="1.5" fill="currentColor" />
                    <circle cx="18" cy="20" r="1.5" fill="currentColor" />
                  </svg>
                </button>
                <Link
                  href="/login"
                  className="shell-action signal-action inline-flex h-11 w-11 items-center justify-center"
                  aria-label="User account"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                    <path
                      d="M12 12C14.5 12 16.5 10 16.5 7.5C16.5 5 14.5 3 12 3C9.5 3 7.5 5 7.5 7.5C7.5 10 9.5 12 12 12Z"
                      fill="currentColor"
                    />
                    <path
                      d="M4 21C4.8 17.8 7.6 15.5 11 15.5H13C16.4 15.5 19.2 17.8 20 21"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
                <span className="shell-chip px-3 py-2 text-[12px] font-semibold">0 đ</span>
              </div>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-[color:var(--ghost-border)] px-4 py-3 md:hidden">
              <Link href="/menu" className="shell-chip whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Menu
              </Link>
              <Link href="/promotions" className="shell-chip whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Promotions
              </Link>
              <Link href="/track" className="shell-chip whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Track
              </Link>
              <Link href="/orders" className="shell-chip whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]">
                Orders
              </Link>
            </div>
          </header>

          <main className="flex-1 py-8 sm:py-10">{children}</main>

          <footer className="mb-6 border-t border-[color:var(--ghost-border)] py-6 text-sm text-[color:var(--ink-muted)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Image src="/brand/pizzahust-mark.svg" alt="PizzaHUST icon" width={26} height={26} />
                <p className="font-medium">PizzaHUST MVP Shell</p>
              </div>
              <p>App Router • Tailwind • Mobile-ready layout baseline</p>
            </div>
          </footer>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--ghost-border)] bg-white/96 px-4 py-2 backdrop-blur-sm sm:hidden">
          <ul className="grid grid-cols-4 gap-2">
            <li>
              <Link href="/menu" className="shell-action inline-flex w-full items-center justify-center rounded-md px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">
                Menu
              </Link>
            </li>
            <li>
              <Link href="/promotions" className="shell-action inline-flex w-full items-center justify-center rounded-md px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">
                Deals
              </Link>
            </li>
            <li>
              <Link href="/track" className="shell-action inline-flex w-full items-center justify-center rounded-md px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">
                Track
              </Link>
            </li>
            <li>
              <Link href="/login" className="shell-action signal-action inline-flex w-full items-center justify-center rounded-md px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">
                Login
              </Link>
            </li>
          </ul>
        </nav>
      </body>
    </html>
  );
}
