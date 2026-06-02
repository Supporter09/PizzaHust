from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

logger = logging.getLogger("pizzahust")


def _session_secret() -> str:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        # Fail closed: a missing secret would silently fall back to a known
        # value, making session cookies forgeable.
        raise RuntimeError("SESSION_SECRET must be set")
    return secret

from app.api.admin.customers import router as admin_customers_router
from app.api.admin.orders import router as admin_orders_router
from app.api.auth import router as auth_router
from app.api.webhooks import router as webhooks_router

app = FastAPI(
    title="PizzaHUST API",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=_session_secret(),
    session_cookie="pizzahust_session",
    https_only=os.environ.get("HTTPS_ONLY", "0") == "1",
    same_site="lax",
)


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log the detail server-side; never leak internal exception text to clients.
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {"code": "INTERNAL_ERROR", "message": "Internal server error."},
            "request_id": "",
        },
    )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(admin_customers_router)
app.include_router(admin_orders_router)
app.include_router(webhooks_router)
