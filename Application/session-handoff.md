# session-handoff.md

**Current state:** `A10` Combo Choice-Slots and Component Picker — **done** on branch
`a10-combo-choice-slots` (open PR to `main`; `./verify.sh` green).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend && ./verify.sh
```

**State:** Combos support fixed products and category **choice-slots** (`combo_items`
product XOR category, migration `0006_combo_choice_slots`). Domain pricing in
`combo_slots.py`; `slot_availability` in `combo_queries.py`. Admin: card grid,
`/admin/combos/new` + `/admin/combos/[id]` editor with component picker, combo
images. Public: slot-aware `GET /api/combos`, customizer source `GET /api/combos/{id}`.
Cart quote prices resolved combo lines (surcharges + A8 option deltas + combo discount).
Seeds include `Pick-Any Feast` slot combo; Playwright `admin-combo-editor.spec.ts`.

**Next feature:** `U15` Customize Combo (`depends_on`: U4, A8, A10 — all done). Reuse
`GET /api/combos/{id}`, cart combo line shape, `OptionGroupSelector`, `composeLineText`.

**U6 follow-up (not U15):** `POST /api/orders` must persist resolved combo picks;
`order_items` XOR product/combo may need extension (spec §1).

**Known follow-ups (non-blocking):**
- `redeem_points` inert until U13/U14.
- Docker `backend` image: rebuild after code changes (`docker compose build backend`);
  Dockerfile now upgrades pip before `pip install -e`.
- A9 multi-image deferred.