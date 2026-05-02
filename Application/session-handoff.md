# session-handoff.md

**Current feature:** `infra-003` — Schema from ERD: dbml + initial Alembic migration
**Branch:** `main`
**Resume command:**

```
cd Application && ./init.sh && ./verify.sh
```

**Top blocker:** Need authoritative ERD translation to `schema.dbml` and initial migration details (including `kitchen_queue_view`) before auth/domain features can proceed.

**Next feature after this:** `infra-004` (auth + role guards) once `infra-003` is complete.
