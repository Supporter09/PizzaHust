---
name: front-scrutiny
description: Use when reviewing frontend code in Application/frontend — before merging UI changes, after implementing a screen, or when asked to scrutinize React components, pages, hooks, or styling for quality issues.
---

## Frontend Code Scrutiny (Next.js App Router + Tailwind 4, this repo)

Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 (CSS-first
`@theme inline` tokens in `app/globals.css`), REST via `lib/api/client.ts`.

### 1) Project Invariants (load-bearing — check these first)
- MUST keep pricing server-authoritative: render `*_vnd` fields from the API and
  totals from `POST /api/cart/quote` only. NEVER sum option deltas, savings, or
  totals client-side.
- MUST use generated contract types (`lib/api/types.ts` via `npm run gen:types`,
  `components["schemas"][...]`). NEVER hand-declare interfaces that shadow API
  schemas — `verify.sh` fails on drift.
- MUST style with semantic tokens (`bg-card`, `text-muted`, `text-brand-fg`,
  `border-line`, `bg-surface-active`, `btn-primary`…). NEVER hardcode hex or
  Tailwind palette colors (`red-600`) — it breaks dark mode.
- MUST confirm any token class used is defined in BOTH the light and `.dark`
  variable blocks of `globals.css`.
- MUST route mutations through `apiFetch` (CSRF double-submit header lives
  there). NEVER raw `fetch` to the backend.
- Features gated on unbuilt use cases (cart U5/U6, track U7, kitchen K-series):
  render the control disabled with a "coming soon" hint, or omit it — never fake
  it live. UI screens with a `Design/*.html` mockup are not done until compared
  (see matching-design-mockups skill).

### 2) Next.js Data & Components
- MUST mark interactive components `"use client"`; keep the directive at the
  smallest subtree that needs it. Prefer server components for static content.
- Dynamic route params are async: `({ params }: { params: Promise<{id: string}> })`
  + `use(params)`. MUST validate params before fetching (`Number.isInteger` +
  bounds at minimum; SHOULD prefer canonical `/^\d+$/` — `Number()` accepts
  `0x10`/`1e2`).
- Client fetches follow the house pattern: `lib/api/*` fetcher + `useState`
  status (`"loading" | "ready" | "notfound" | "error"`) + skeleton while loading
  + error state with a Try-again that calls the loader.
- MUST guard async continuations against unmount (alive ref/`cancelled` flag in
  effect cleanup) — React strict mode double-invokes effects.
- MUST debounce request-per-keystroke/selection effects (quote calls use 250ms)
  and cancel stale ones via the cleanup flag.
- MUST avoid duplicate fetches across components; lift shared data up or pass it down.
- Navigation uses `next/link`. `<img>` needs an eslint-disable comment matching
  existing usage (no `next/image` infra yet) — flag new undocumented disables.

### 3) Semantic HTML & Accessibility
- MUST use `<a href>`/`<Link>` for navigation and `<button type="button">` for
  in-place actions. NEVER clickable `<div>/<span>`; NEVER nest interactive
  elements (no buttons inside link-wrapped cards — split the card instead).
- MUST provide `aria-label` for icon-only controls; `aria-hidden` on decorative
  glyphs/SVGs; correct roles for custom widgets (`radiogroup`/`radio`,
  `group`/`checkbox`, `switch` with `aria-checked`).
- MUST announce live money/status updates (`aria-live="polite"` on the estimate).
- MUST keep visible focus states and full keyboard operability; heading
  hierarchy intact (one `h1` per page). Browser-default outlines count as a
  pass; explicit `focus-visible:ring` is preferred on brand-colored surfaces
  where the default outline is low-contrast.
- MUST meet contrast >= 4.5:1 — watch brand-on-brand (e.g. `text-brand-fg` on
  `bg-brand` is invisible; use `text-on-brand`).
- MUST show errors near the triggering control. NEVER block paste.

### 4) Tailwind & Styling
- Tokens first (section 1). Tailwind defaults only for spacing/layout, never color.
- Shared component classes (`btn-primary`, `auth-card`, `input-field`,
  `cover-stripe`) live in `globals.css` — reuse before inventing variants.
- Gotcha: Turbopack dev has failed to generate utilities for token colors first
  used in a new file (`text-brand` computing to inherited color). If a token
  utility doesn't render, verify in the browser; inline `style={{color:
  "var(--token)"}}` is the accepted fallback — confirm against `npm run build`.
- MUST use a fixed z-index scale; no `z-[9999]`.
- SHOULD use `size-*` for square elements instead of paired `w-* h-*`.

### 5) Mobile Responsiveness
- MUST build mobile-first and verify at 390px (and 320px for dense screens).
- NEVER `h-screen`; use `h-dvh`/`min-h-dvh`. Safe areas on fixed/sticky UI.
- MUST keep touch targets >= 44px (`h-11`).
- MUST prevent horizontal overflow; tables get `overflow-x-auto`.
- SHOULD use `text-balance` for headings, `line-clamp`/`truncate` in dense UI,
  `tabular-nums` for numeric/money columns.

### 6) Interaction & Motion
- Destructive actions use the inline Confirm/Cancel two-step pattern (see
  category/combo deletes) — match it, don't invent dialogs.
- MUST animate compositor properties only (`transform`, `opacity`); keep
  feedback <= 200ms; respect `prefers-reduced-motion`.
- NEVER decorative motion without clarity/feedback value.

### 7) Performance
- MUST avoid redundant re-fetches; validate the loading→ready state machine
  renders each state exactly once.
- MUST audit bundle impact before adding dependencies (project has NO icon lib,
  NO clsx/tailwind-merge, NO SWR — inline SVGs and template classes are the
  house style; don't add deps in a review fix).
- SHOULD lazy-load non-critical assets; `loading="lazy"` on list images.
- External calls need explicit failure paths; silent catches require a comment
  stating why ignoring is safe. No `console.*` in frontend code.

### 8) PR Gate (Required Checks)
- `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npm run build` pass;
  e2e (`npx playwright test`, env from `Application/.env`) when behavior changed.
- Search diff for `console.*`, `debugger`, `TODO/FIXME`, commented-out code,
  hardcoded hex, hand-written API types.
- Light/dark + 390px mobile verified by rendering, not by reading classes.
- Mockup comparison done for screens in `Design/` (matching-design-mockups).
