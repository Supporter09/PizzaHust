# session-handoff.md

**Current state:** `A13` Admin Business Settings **done and verified** on branch `feat/admin-business-settings` at `86a8581`. The branch now stacks **A11** (Admin Menu Management Overhaul) + **A12** (per-category options) + **A13** (admin business settings) — none are on `main` yet. Business config (timezone, **per-ward delivery fees**, loyalty rules) is admin-editable from `/admin/settings`, replacing static constants; the UTC-vs-+07 date-window bug that had kept `admin-orders.spec.ts:28` red since A11 is **fixed**.

**Verification (the headline):** **`./verify.sh` EXIT 0 at `86a8581`, `2026-06-14T12:34Z` — the first clean exit-0 in the whole A11→A12→A13 lineage.** Backend **387 passed/1 skipped** (ruff, mypy domain, lint-imports, alembic-drift all clean); frontend tsc/eslint clean, **80 vitest**, `next build` ok (`/admin/settings` route present); OpenAPI↔types parity clean; smoke 1 passed/1 skipped; Playwright **44 passed/4 skipped/0 FAILED**. The prior sole red gate `admin-orders.spec.ts:28` now **passes** (the timezone fix), and both new A13 e2e specs pass (settings page renders; editing a ward's fee is reflected in `GET /api/config/delivery`). `cart.spec.ts:4` (combo parallel-load flake) passed in the same run.

**What shipped in A13** (design + 11-task TDD plan, executed via subagent-driven-development — fresh implementer per task → spec review → quality review → commit; commits `4a0525f..86a8581`):
- **Two typed tables** behind `infra/settings_service.py` — `business_settings` (singleton id=1) + `delivery_ward_fees` (ward→fee map), migration `0015_business_settings`. The service falls back to domain constants when unseeded (51 inner-Hanoi wards @ 22000 + loyalty defaults), so zero rows = legacy behavior.
- **Domain purity preserved:** `pricing`/`loyalty`/`service_area` take injected data params that default to the module constants; the API/service layer loads live values and injects them. No `app.infra` import in `app.domain` (`lint-imports` 2 kept/0 broken).
- **Per-ward delivery** is a pure `ward→fee` map (rows ARE the service area; absent ward → 422 out-of-area). Cart **quote** and order **placement** load the identical map — no quote↔charge mismatch.
- **Timezone fix:** `infra/timezone.py` converts business-tz day windows → UTC bounds; `admin/orders.py` + `admin/reports.py` (list + overview buckets) compute "today"/buckets in the configured tz. `GET /api/config/business` exposes it; admin Orders/Reports default ranges computed in business tz.
- **Endpoints:** read — `GET /api/config/{delivery (ward_fees map),loyalty,business}` served from the store. Admin write — `GET/PUT /api/admin/settings` + `GET/PUT /api/admin/settings/ward-fees`, validated (IANA tz, loyalty rates >0, max-redeem ∈ (0,1], non-empty ward set, dup-folded-ward → 409), admin no-CSRF convention. Validation surfaces as **400 `VALIDATION_FAILED`** (app-wide handler), not 422.
- **Frontend:** `/admin/settings` page (`app/admin/settings/page.tsx` + `components/admin/ward-fees-editor.tsx` + typed `lib/api/admin-settings.ts` + nav gear icon), reusing `basics-editor` styling, light/dark + responsive via theme tokens. Contract regenerated (`openapi.json` + `types.ts`), `CONTRACTS.md` updated.

**Known follow-ups** (out of scope, pre-existing — NOT introduced by A13):
- Loyalty **accrual** is still not wired to order placement (`compute_accrual_points` has no production caller); the injectable `accrual_rate` param is ready for when accrual-on-order lands.
- A whitespace-only ward name passes `min_length=1` but `_fold`s to an empty `ward_normalized` (degenerate; not reachable via the seeded UI). A strip-then-nonempty validator would close it.

**Next options (in priority order):**

1. **Whole-branch code review → `superpowers:finishing-a-development-branch`.** A13's clean `verify.sh` exit 0 removes the long-standing `admin-orders:28` blocker on merging this lineage. The branch carries A11 + A12 + A13.
2. **Open the PR `feat/admin-business-settings → main`** (or rebase/merge the menu-overhaul lineage first, depending on branch strategy). Address CodeRabbit feedback, then merge.
3. **Next feature** per `feature_list.json` (e.g. `K2` Update Preparation Status, `depends_on: ["K1"]`).

**Resume command:**

```bash
git checkout feat/admin-business-settings
cd Application && ./init.sh && docker compose up -d --build backend frontend   # rebuild picks up A13 code (baked images)
# ./verify.sh   # expect EXIT 0 at/after 86a8581
```

**Blockers:** None. The previously sole red gate (`admin-orders.spec.ts:28`) is fixed by this feature.
