---
name: matching-design-mockups
description: Use when implementing or reviewing any frontend screen that has a mockup in Design/ — before claiming UI work is done, when a feature passed code review but was never visually compared to the design, or when asked about visual fidelity, "does it look like the design", pixel parity, or mockup compliance.
---

# Matching Design Mockups

## Overview

`Design/*.html` is the UX source of truth (DESIGN_BRIEF.md §8 maps screens to mockups).
Code review verifies behavior; it says nothing about whether the screen *looks like the
design*. **A UI feature is not done until its rendered output has been compared
side-by-side against its mockup.** Where mockups and API contracts disagree, contracts
win on payloads; mockups win on UX (PRODUCT.md "v2 Design Additions").

## When to Use

- Building any page/component whose screen exists in `Design/` (check DESIGN_BRIEF.md §8 inventory)
- Reviewing a "done" UI feature — if no mockup comparison happened, it isn't done
- Symptoms: plain text where the mockup shows cards/images, missing step numbers or
  progress counters, missing summary panels, generic labels where the mockup names things

**Not for:** screens with no mockup (admin utilities), backend work, or pixel-perfect
font metrics — match structure, components, and hierarchy, not exact pixels.

## Process

1. **Locate the mockup.** `ls Design/*.html`; match via DESIGN_BRIEF.md §8. Open as
   `file:///…/Design/<screen>.html`.
2. **Render both at the same viewport** (1440×1000 desktop first) with chrome-devtools
   MCP: `new_page` → `resize_page` → `take_screenshot {fullPage: true, filePath: …}`.
   For the implementation, drive it to the *populated* state the mockup shows (make
   picks, fill forms) before shooting — empty states hide most deviations.
3. **Diff structurally, top to bottom.** For each mockup region record: present /
   different / missing. Check at minimum:

   | Region | Look for |
   |---|---|
   | Layout | column count, sticky panels, section order |
   | Components | cards vs chips, images, radio/check affordances |
   | Wayfinding | numbered steps, progress counters ("2 of 2 selected") |
   | Naming | panels that name their subject ("Options for {item}") vs generic labels |
   | Money | price placement, struck-through reference, savings badges |
   | CTAs | primary buttons present, placement, copy |
   | Copy | headings, microcopy, duplicated/garbled text |

4. **Classify every delta** before fixing:
   - **Must-match** — fix it.
   - **Accepted deviation** — write WHY in the PR/plan (e.g. CTA's feature is a later
     use case; render it disabled or omit it, but say so).
   - **Data-driven** — seed data differs from mockup content; not a bug, don't "fix".
5. **Fix, re-shoot, re-diff.** Loop until every delta is fixed or classified.
6. **Verify the additive invariants survived** (see below), then attach the final
   screenshots to the PR.

## Invariants — never sacrificed to match a mockup

Mockups are light-only, desktop-only, mouse-only static HTML. The implementation keeps:

- **Dark mode** — map mockup colors to theme tokens (`bg-card`, `text-muted`, `brand`…),
  never hardcode hex from the mockup. Screenshot dark mode too.
- **Mobile** — re-shoot at 390×844; mockup layout may collapse, structure must survive.
- **A11y** — 44px targets, roles/aria, heading hierarchy, focus visibility. If the
  mockup's pattern conflicts (e.g. div-cards), implement it accessibly.
- **Server-authoritative pricing** — mockup prices are illustrative; every number still
  comes from the API. Never copy amounts or compute client-side.

## Common Mistakes

| Mistake | Reality |
|---|---|
| "Code review passed, so it's done" | Review never opened the mockup. Compare renders. |
| Diffing JSX against mockup HTML | Diff *rendered screenshots*; DOM similarity lies. |
| Copying mockup hex/px values | Use theme tokens; hardcoding breaks dark mode. |
| "Mockup has X items, we show 3" | Data-driven delta. Classify, don't fix. |
| Skipping populated state | Empty screens hide the deviations that matter. |
| Faking out-of-scope CTAs as live | Render disabled + document, or omit + document. |

## Quick Reference

```bash
ls Design/*.html                          # mockup inventory (DESIGN_BRIEF.md §8 maps screens)
# chrome-devtools MCP: new_page(file:///…/Design/x.html) → resize_page(1440,1000)
#   → take_screenshot(fullPage, filePath)  — repeat for http://localhost:3000/…
# app up: cd Application && docker compose up -d --build frontend backend
```

Screenshots land next to the work (e.g. `Application/docs/superpowers/`), never committed.
