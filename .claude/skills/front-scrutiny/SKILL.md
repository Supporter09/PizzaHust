---                                                                                                                                                                                                                                                                                                                         
name: front-scrutiny                                                                                                                                                                                                                                                                                                        
description: Frontend code scrutiny and review. Use this skill for reviewing frontend code quality, identifying issues, and suggesting improvements.                                                                                                                                                                        
---                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                            
## Frontend Code Scrutiny (SvelteKit + Tailwind)

### 1) Code Hygiene
- MUST keep components under 400 lines when responsibilities are separable (hard max: 500).
- MUST keep functions single-purpose and obvious; no premature abstractions.
- NEVER commit `console.log`, `console.debug`, or `debugger`.
- SHOULD allow one `console.error` in `catch` only, with explicit user-facing error handling.
- MUST remove commented-out/dead code before merge.
- MUST resolve `TODO/FIXME` or replace with linked issue IDs.
- NEVER duplicate template blocks/styles; extract components or shared utilities.
- MUST remove anything your change made unused.

### 2) Svelte/SvelteKit Data & State
- MUST fetch data in `load` (`+page/+layout`, server-first when possible), not `onMount` unless client-only.
- MUST avoid duplicate fetches across components; lift to layout/store.
- MUST keep initial render network calls minimal (target: <=2).
- SHOULD aggregate bootstrap data (e.g., `/api/init`) when it reduces request fan-out.
- SHOULD use `data-sveltekit-preload-data="hover"` for likely next navigation.
- MUST show loading UI (skeleton/placeholder) when data blocks rendering.
- SHOULD use form actions + `use:enhance` for mutations and progressive enhancement.

### 3) Semantic HTML & Accessibility
- MUST use `<a href>` for navigation and `<button>` for in-place actions.
- NEVER use clickable `<div>/<span>` for interactive controls.
- MUST implement toggles with `<input type="checkbox">` or correct ARIA checkbox semantics.
- MUST provide `aria-label` for icon-only buttons.
- MUST use landmarks: `<header> <nav> <main> <aside> <footer>`.
- MUST keep visible focus states and full keyboard operability.
- MUST keep `role="menu"` only for action menus; never for navigation/content lists.
- MUST place `role="menuitem"` only inside `role="menu"`.
- MUST meet contrast >= 4.5:1 for body text.
- MUST show errors near the triggering control (and announce when appropriate).
- NEVER block paste in inputs/textareas.

### 4) Tailwind & Styling
- MUST prefer Tailwind defaults (spacing/radius/shadow/scale) before custom tokens.
- SHOULD use a class merge helper (`cn`/`clsx` + `tailwind-merge`) for conditional classes.
- MUST keep component `<style>` blocks under 50 lines; extract shared CSS.
- SHOULD use inline utility classes for one-off styling.
- MUST avoid duplicated CSS; centralize shared styles/tokens.
- MUST use a fixed z-index scale (no arbitrary `z-[9999]` patterns).
- SHOULD use `size-*` for square elements instead of paired `w-* h-*`.

### 5) Mobile Responsiveness
- MUST build mobile-first and verify at small widths (including 320px).
- NEVER use `h-screen`; use `h-dvh`/`min-h-dvh`.
- MUST account for safe areas on fixed/sticky UI (`env(safe-area-inset-*)`).
- MUST keep touch targets >= 44x44 px.
- MUST prevent horizontal overflow and accidental sideways scroll.
- SHOULD use `text-balance` for headings, `text-pretty` for paragraphs, `line-clamp`/`truncate` for dense UI.
- MUST use `tabular-nums` for numeric data.

### 6) Interaction & Motion
- MUST use an accessible confirm/alert dialog for destructive/irreversible actions.
- NEVER add motion unless it improves clarity/feedback.
- MUST animate compositor properties only (`transform`, `opacity`).
- NEVER animate layout properties (`width/height/top/left/margin/padding`).
- SHOULD keep interaction feedback <= 200ms.
- MUST respect `prefers-reduced-motion`.
- MUST pause/disable looping animations off-screen.
- NEVER introduce custom easing curves unless explicitly requested.

### 7) Performance
- MUST avoid duplicate requests and redundant client re-fetch after SSR data is available.
- SHOULD lazy-load non-critical components/routes/assets.
- MUST audit bundle impact before adding dependencies.
- NEVER import whole libraries when one function/module is enough.
- NEVER keep `will-change` active outside active animation windows.
- NEVER animate large `blur()`/`backdrop-filter` surfaces.
- SHOULD virtualize long lists and defer non-critical work.
- MUST set timeouts and explicit failure paths for external calls.

### 8) Component Primitives & Assets
- MUST use existing project primitives first for keyboard/focus-heavy UI.
- NEVER mix multiple primitive systems within one interaction surface.
- MUST keep one icon system across the app (sprite OR inline OR icon font).
- SHOULD add new icons to the existing system, not as one-off inline SVGs.
- Exception: brand logos/complex illustrations may be inline with a short comment.

### 9) PR Gate (Required Checks)
- Lint, type-check, test pass.
- Search for `console.*`, `debugger`, `TODO`, `FIXME`, commented-out code.
- Keyboard-only walkthrough passes.
- Screen reader labels/roles valid.
- Light/dark + mobile layouts verified.
- Initial request count and duplicate fetches reviewed.
