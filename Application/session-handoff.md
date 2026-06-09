# session-handoff.md

**Current feature:** `U4` View Combo Promotions — **done** on branch `u4-view-combos` @ `30f0ffd` (push/PR when requested).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d --build backend frontend && ./verify.sh
```

**State:** Public `GET /api/combos` lists Active-only combos with server-computed `items_total_vnd` / `savings_vnd` (domain `combo_savings_vnd`); excludes scheduled/expired windows and combos with inactive component products. Frontend: `fetchCombos`, `/combos` page + `ComboCard`, nav link. OpenAPI + `types.ts` regenerated; `CONTRACTS.md` schema example added. Cart/order combo support **not** implemented (U5). `verify.sh` green at `30f0ffd`.

**Next feature:** `U5` Manage Cart (`depends_on`: `U3`, `U4` — both done).

> U5 natural extension: wire `kind="combo"` into `POST /api/cart/quote` (resolve combo by id, apply `combo_discount_vnd` via existing `compute_order_total`); multi-line cart persistence per use case.

**Known follow-ups (non-blocking, recorded in `progress.md`):**
- `redeem_points` inert until U13/U14.
- Pre-existing: leftover `*.sqlite3` under `backend/tests/`; seed tests need admin/kitchen seed passwords under verify env.
- Public combos router loads all combos then filters in Python — fine for MVP.

**PR (when user asks):**

```bash
git push -u origin u4-view-combos
gh pr create --base main --title "feat(U4): view combo promotions (public combos API + /combos page)" \
  --body "GET /api/combos lists Active combos with server-computed savings; /combos page + combo card + nav link. Domain savings helper; OpenAPI + FE types; CONTRACTS updated. Cart/order combos deferred to U5. verify.sh green."
```