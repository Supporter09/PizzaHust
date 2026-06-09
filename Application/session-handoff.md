# session-handoff.md

**Current feature:** `U2` View Item Details — **done** on branch `u2-view-item-details` @ `ebc115b` (PR pending).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d --build backend frontend && ./verify.sh
```

> Note: the compose `frontend` service serves a built bundle, so rebuild it (`--build`) to pick up new routes like `/menu/[id]`.

**State:** Public `GET /api/items/{id}` embeds global pizza options (`sizes` ordered by price modifier, `crusts` by id, `toppings` by name); 404 on missing/inactive, 400 on bad id. `/menu/[id]` client page unwraps `params` via `use()`, holds size/crust/topping + quantity selection, and renders a **display-only, non-authoritative** per-item price preview via `lib/pricing.ts` (`computePizzaLineTotal`). Non-pizzas show image/name/price only. U1 menu cards link in (with `aria-label` for an accessible link name). No add-to-cart. `verify.sh` green at `ebc115b`.

**Next feature:** `U3` Customize Pizza (`depends_on`: `U2`).

> U3's first job is to replace the client-side price preview (`lib/pricing.ts` `computePizzaLineTotal`, the documented U2 deviation) with the authoritative backend `POST /api/cart/quote`.

**Known follow-ups (non-blocking, recorded in `progress.md`):**
- `/menu/[id]` and `/menu` fetch on mount without an in-flight cancellation guard (mirrors the U1 pattern); a rapid param change could race. Add an `AbortController`/cancelled flag if it becomes an issue.
- The size/crust radiogroups are button-based and lack arrow-key roving-tabindex (deliberate; APG radiogroup keyboard nav not implemented).

**PR:**

```bash
git push -u origin u2-view-item-details
gh pr create --title "feat(U2): view item details (detail API + /menu/[id] customizer)" \
  --body "GET /api/items/{id} embeds global pizza options; /menu/[id] detail page with size/crust/topping + quantity selectors and a display-only per-item price preview (deviation: client-side, non-authoritative — U5 replaces with the cart quote). Cards link in. verify.sh green."
```
