# infra-006 Order Domain Design

## Goal

Build the pure backend domain modules for order state transitions, pricing, loyalty, and service-area validation, then route existing order status writes through the state machine.

## Approach

Use pure Python modules under `backend/app/domain/` as the single source of truth:

- `order_state.py` owns the closed transition graph, terminal checks, and delivery webhook state mapping.
- `pricing.py` owns the configured delivery fee and quote calculation order.
- `loyalty.py` owns canonical accrual and redemption constants.
- `service_area.py` owns the 2025 post-reorganization Hanoi ward whitelist and normalization.

Persistence keeps using `app.infra.db.models.OrderStatus`. The domain layer accepts enum-like values by string to avoid importing infra models and preserve the existing import-linter boundary.

## Route Reconciliation

Existing admin order routes and the delivery webhook currently assign `order.current_status` directly. They will call domain transition helpers first and only persist the returned status. Illegal transitions map to HTTP `409 CONFLICT`, while idempotent duplicate webhooks stay no-op as they do today.

For infra-005 retry-dispatch, the current committed contract says success advances `DispatchPending -> Delivering`; infra-006 preserves that behavior and makes it explicit in the state machine.

## Testing

TDD order:

1. Domain state-machine tests for valid transitions, invalid transitions, terminal states, and delivery webhook mappings.
2. Domain pricing, loyalty, and service-area tests for documented constants, 2025 Hanoi ward coverage, and calculations.
3. Route tests adjusted/extended to prove admin cancel, retry-dispatch, and delivery webhook use the domain state machine.

`./verify.sh` remains the final acceptance gate.
