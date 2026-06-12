# session-handoff.md

**Current state:** U6 **done** on `u6-place-order` (`verify.sh` green at `524c882`). Checkout + COD place order + combo parent/child persistence shipped.

**Next feature:** `U7` Track Order (+U16 tracking display) — plan Branch 5, Task 5.1 in
`docs/superpowers/plans/2026-06-12-u5-u9-ordering-spine.md`.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend
git checkout u6-place-order && git pull   # or merge PR to main first
git checkout -b u7-track-order
# Mark U7 in_progress in feature_list.json; start plan Task 5.1
```

**Blockers:** Run `alembic upgrade head` (0008) on any env predating U6. Rebuild frontend container after checkout UI changes before e2e.

**Notes:** E2e ward select uses ASCII label `Ba Dinh` (browser option text). First `verify.sh` e2e after frontend rebuild may need one retry while Next warms.