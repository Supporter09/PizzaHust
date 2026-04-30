# session-handoff.md

**Current feature:** `infra-001` — Application/ wrapper + harness scaffolding
**Branch:** `main`
**Resume command:**

```
cd Application && ./init.sh && ./verify.sh
```

**Top blocker:** Six assumptions in `PRODUCT.md` (loyalty rates, service area details, order code format, promised-time default) need team confirmation before `U13` / `infra-loyalty` work begins. Hieu's ERD-to-DBML translation (`infra-003`) blocks `infra-004` onward.

**Next feature after this:** `infra-002` (compose stack green end-to-end).
