from __future__ import annotations

import ulid
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.admin.catalog import router as admin_catalog_router
from app.api.admin.customers import router as admin_customers_router
from app.api.admin.orders import router as admin_orders_router
from app.api.auth import router as auth_router
from app.api.errors import (
    APIError,
    handle_api_error,
    handle_http_exception,
    handle_validation_error,
)
from app.api.loyalty import router as loyalty_router
from app.api.webhooks import router as webhooks_router
from app.infra.config import get_settings

settings = get_settings()

app = FastAPI(
    title="PizzaHUST API",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie=settings.session_cookie_name,
    max_age=settings.session_max_age_seconds,
    same_site=settings.session_same_site,
    https_only=settings.session_https_only,
    path="/",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(APIError, handle_api_error)
app.add_exception_handler(HTTPException, handle_http_exception)
app.add_exception_handler(RequestValidationError, handle_validation_error)
app.include_router(auth_router)
app.include_router(loyalty_router)
app.include_router(admin_orders_router)
app.include_router(admin_customers_router)
app.include_router(admin_catalog_router)
app.include_router(webhooks_router)


@app.middleware("http")
async def add_request_id(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(ulid.ULID()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
