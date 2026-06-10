# session-handoff.md

**Current state:** `U4` View Combo Promotions — **merged to `main`** (PR #18, `49c037f`). v2 docs sync
(`DESIGN_BRIEF.md` + canonical docs) merged via PR #17.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d --build backend frontend && ./verify.sh
```

**State:** Public `GET /api/combos` lists Active-only combos with server-computed `items_total_vnd` / `savings_vnd` (domain `combo_savings_vnd`); excludes scheduled/expired windows and combos with inactive component products. Frontend: `fetchCombos`, `/combos` page + `ComboCard`, nav link. OpenAPI + `types.ts` regenerated; `CONTRACTS.md` schema example added. Cart/order combo support **not** implemented (lands with `U5`/`U15`). `verify.sh` green at `30f0ffd` (pre-merge head of `u4-view-combos`).

**Next feature:** the **combo cluster** (v2). Docs synced to `DESIGN_BRIEF.md` v2 on 2026-06-10;
feature rows in `feature_list.json`: `A8` generic options (foundational), `A9` multi-image,
`A10` combo choice-slots, `U15` customize combo, `U16` order notes, `K4` confirm-pickup.
Recommended sequence: **A8 → A10 → U15** (each behind `verify.sh`). `/combos` (U4, merged) is the
customizer's entry page.

> `A8` (generic `OptionGroup`+`Option` replacing the fixed sizes/crusts/toppings tables) is the
> prerequisite: it reworks the U3 customizer + `app/api/cart.py` pricing resolver + `order_item`
> FKs, and its option chips power the combo customizer (U15). Brainstorm/plan A8 first.
>
> `U5` Manage Cart (`depends_on`: `U3`, `U4` — both done) follows the cluster: wire `kind="combo"`
> into `POST /api/cart/quote` (resolve combo by id, apply discount via existing
> `compute_order_total`); multi-line cart persistence per use case. U15 choice-slot lines will
> ride on the same cart shape — design them together when planning A10/U15.

**Known follow-ups (non-blocking, recorded in `progress.md`):**
- `redeem_points` inert until U13/U14.
- Pre-existing: leftover `*.sqlite3` under `backend/tests/`; seed tests need admin/kitchen seed passwords under verify env.
- Public combos router loads all combos then filters in Python — fine for MVP.
