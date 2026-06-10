# session-handoff.md

**Current state:** `A8` Generic Options Model — **done** on branch `a8-generic-options`
@ `9ed8bae` (PR #19 open; all review findings resolved, `verify.sh` green, backfill
evidence posted on the PR). Merge when approved.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d --build backend frontend && ./verify.sh
```

**State:** Admin-defined `option_groups`/`options` (deltas shared) with per-dish
enablement (`product_options`) and order-history snapshots (`order_item_options`).
Migration `0005_generic_options` is clean-cut (transforms data, backfills history,
drops `pizza_sizes`/`pizza_crusts`/`toppings`/`order_item_toppings`). Cart quote takes
`{kind: item|combo, item_id, option_ids, quantity}`. Customizer renders generic chip
groups; admin dish editor lives at `/admin/items/[id]` (standalone pizza-options page
removed). Cross-cutting: all routers use `Depends(get_db, scope="function")` — FastAPI
0.118+ otherwise commits after the response and rapid sequential requests read stale data.

**Deploy note (env hardening, PR #19):** backend now **requires**
`ADMIN_SEED_PASSWORD`, `KITCHEN_SEED_PASSWORD`, `DELIVERY_WEBHOOK_SECRET` at startup
(no in-code fallbacks). The GCP startup template already injects all of them from
Secret Manager (`infra/terraform/deploy/templates/startup.sh.tftpl`) — verified, no
infra change needed. Local stacks need them in `Application/.env` plus the new
`E2E_*` vars and (optional) `AUTH_RATE_LIMIT_PER_MINUTE=60` for parallel Playwright.

**Next feature:** `A10` Combo Choice-Slots and Component Picker (`depends_on`: A4, A8 —
both done). Then `U15` Customize Combo rides on A10 + the A8 option chips
(`OptionGroupSelector`, `composeLineText` are reusable as-is). Brainstorm/plan A10 first;
design slot lines together with the U5 cart shape (see `DESIGN_BRIEF.md` §6 and
`Design/combo-customize.html` / `Design/admin-combo-edit.html`).

**Known follow-ups (non-blocking):**
- `redeem_points` inert until U13/U14.
- Pre-existing: leftover `*.sqlite3` under `backend/tests/`.
- Public combos router loads all combos then filters in Python — fine for MVP.
- A9 multi-image deferred; dish editor keeps the single image field.
