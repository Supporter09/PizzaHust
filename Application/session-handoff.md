# session-handoff.md

**Current state:** U7 + U16 **done** on `u7-track-order` (`./verify.sh` green). Public track endpoint + `/track` page with polling.

**Next feature:** `U11` View Order History (`depends_on` U6, U9) or kitchen spine `K1` — check `feature_list.json` deps and `session-handoff` priority with team.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend
git checkout u7-track-order && git pull
# Merge PR to main when ready; next branch e.g. u11-order-history
```

**Blockers:** None. `TRACK_RATE_LIMIT_PER_MINUTE` in `.env` (default 5).

**Notes:** Track e2e uses `Order Received` (timeline label). Rebuild frontend after track UI changes before e2e.