# session-handoff.md

**Current state:** `A12` Per-Category Option Ownership done and verified on branch `feat/admin-menu-overhaul` at `6464fd0`. The branch now carries **both** `A11` (Admin Menu Management Overhaul) and `A12` (per-category options) — neither is on `main` yet. Each `Category` owns its option groups + options (a category's groups ARE its preset); `CategoryPresetGroup` is gone; the preset page is the rich option editor; dishes seed/reseed their options from their category.

**Verification:** all feature gates green at `6464fd0`, `2026-06-13T19:57Z` — backend 351 passed/1 skipped (ruff, mypy domain, lint-imports, alembic-drift clean); fresh `alembic upgrade head` on a wiped schema reaches `0014` with 0 errors (migration's prod backfill empirically verified zero-deletion on a populated-from-0013 MySQL copy); frontend tsc/eslint clean, 76 vitest, `next build` ok; OpenAPI↔types parity clean; smoke 1/1-skip; Playwright 41 passed/4 skipped/1 fail. Whole-branch review: no Critical issues, migration production-safe, one Important regression found and fixed (`6464fd0`, dish-category-change reseed). Contained-ripple proof: cart/menu/pricing/kitchen/orders backend tests (80) green unmodified.

**Sole red gate (pre-existing, unrelated):** `tests/e2e/admin-orders.spec.ts:28` fails because the admin "today" orders view is empty — the order-placement smoke is `@pytest.mark.skip` and the timezone bug (orders placed 00:00–07:00 +07 store on the prior UTC date) means even a freshly-placed order can miss the "today" filter. This branch has **zero diff** in the orders domain — it fails the same way on `main`. `cart.spec.ts:4` is a known combo parallel-load flake (passed on rerun). `verify.sh` exits 1 only because this env lacks `~/.local/bin/open-chrome-debug` (its flake-retry path). **Do NOT touch `admin-orders.spec.ts` until the order-placement smoke is un-skipped.**

**Next options (in priority order):**

1. **Resolve the `admin-orders.spec.ts:28` data dependency, then merge/PR `feat/admin-menu-overhaul → main`.** The clean fix is to un-skip the order-placement smoke (now that U6 checkout + K1 kitchen exist, `POST /api/orders` works — `checkout.spec.ts`/`track.spec.ts` pass) and/or seed a today-order in e2e setup, and consider the timezone policy (store/compare "today" consistently). That gives a clean `verify.sh` exit 0 for the whole branch.
2. **Open the PR now with the documented caveat** — A11+A12 are feature-complete and gate-green except the one pre-existing, unrelated orders fail (same precedent as A11 at `63ae5b8`). Address CodeRabbit feedback, then merge.
3. **`K2` Update Preparation Status** (`depends_on: ["K1"]`, owner Hung) — kitchen Accept→Preparing + Mark Ready action buttons. Attach point in `frontend/app/kitchen/queue-client.tsx`; transitions in `backend/app/domain/order_state.py`.

**Resume command:**

```bash
git checkout feat/admin-menu-overhaul
cd Application && ./init.sh && docker compose up -d backend frontend
# Open PR for feat/admin-menu-overhaul → main when ready; next branch e.g. k2-prep-status
```

**What shipped in A12** (12 commits `2715c04..6464fd0`, on top of A11's `0e884d1`): migration `0014_option_groups_per_category` (drops `CategoryPresetGroup`, `OptionGroup.category_id` NOT-NULL FK, name unique per category, tested backfill with fresh-replay orphan-drop); category-scoped option-groups admin API (`?category_id=` filter, cross-category 409 guards); `GET /api/admin/categories/{id}/option-groups` replacing the old `/preset` routes; `_apply_category_preset` + `patch_item` category-change reseed; seeds reworked to per-category groups; `category-options-editor.tsx` rich preset editor + `categoryId` plumbing through `options-editor`/dish editor + New-Item preset link; the original UI fixes (dish-editor select sizing, sticky Active+Save bar); OpenAPI + TS types regenerated, `CONTRACTS.md` updated; e2e proving per-category ownership.

**Blockers:** None on the feature. The sole red gate is the pre-existing `admin-orders` data dependency described above.
