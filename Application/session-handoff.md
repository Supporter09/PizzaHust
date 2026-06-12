# session-handoff.md

**Current state:** `A5/A6/A7` admin ops expansion on branch `feat/admin-A5-A7-A8-A9`, now merged with main (U7 + U16 done — public track endpoint + `/track` page with polling).

**Next feature:** `U11` View Order History (`depends_on` U6, U9) or kitchen spine `K1` — check `feature_list.json` deps and `session-handoff` priority with team.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend
git checkout feat/admin-A5-A7-A8-A9 && git pull
# Merge PR #25 to main when ready; next branch e.g. u11-order-history
```

**State:** Monitor Orders now defaults to the current day and opens a detail dialog that shows phase-by-phase tracking notes plus order-item option snapshots. Customer detail now exposes order history, tier/points signals, and richer prospect tracking. Reports now match the dashboard mockup with the 4 KPI cards, daily charts, and top-selling items table.

**Relation notes:** the only new model/table relation introduced for this batch is the `OrderItem` -> `order_item_options` snapshot path, sourced from the generic option catalog (`OptionGroup`, `Option`, `ProductOption`). Customer and report work reused existing relations; no separate customer/report schema was added.

**Verification:** backend lint/type/tests/alembic passed, OpenAPI drift passed, frontend typecheck/lint/tests/build passed.

**Blockers:** None. `TRACK_RATE_LIMIT_PER_MINUTE` in `.env` (default 5).

**Notes:** Track e2e uses `Order Received` (timeline label). Rebuild frontend after track UI changes before e2e.
