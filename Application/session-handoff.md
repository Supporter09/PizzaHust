# session-handoff.md

**Current feature:** `U1` Browse Menus — **done** on branch `u1-browse-menus` @ `3f857a7` (PR pending).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend && ./verify.sh
```

**State:** Public `GET /api/categories` + `GET /api/items`; `/menu` with category chips, item cards, VND via `formatVnd`; CONTRACTS reconciled (veg/kids/description deferred). Theme hydration fix for Playwright system-dark. `verify.sh` green.

**Next feature:** `U2` View Item Details (`depends_on`: `U1`).

**PR:**

```bash
git push -u origin u1-browse-menus
gh pr create --title "feat(U1): browse menus (public menu API + /menu page)" \
  --body "Public GET /api/categories + /api/items; /menu page with category filter + VND prices. verify.sh green at 3f857a7."
```