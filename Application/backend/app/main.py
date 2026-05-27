from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

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
    secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-in-prod"),
    session_cookie="pizzahust_session",
    https_only=os.environ.get("HTTPS_ONLY", "0") == "1",
    same_site="lax",
)


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": str(exc)}, "request_id": ""},
    )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(admin_customers_router)
app.include_router(admin_orders_router)
app.include_router(webhooks_router)
