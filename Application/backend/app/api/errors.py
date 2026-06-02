from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from app.core.errors import APIError

logger = logging.getLogger("pizzahust")

# Maps raw HTTP status codes to the CONTRACTS.md error-code set + a fixed,
# client-safe message. Raw HTTPException.detail is logged, never returned, so an
# HTTPException raised outside the APIError path can't leak internal detail.
_STATUS_TO_CODE: dict[int, tuple[str, str]] = {
    status.HTTP_400_BAD_REQUEST: ("VALIDATION_FAILED", "Invalid request."),
    status.HTTP_401_UNAUTHORIZED: ("UNAUTHENTICATED", "Authentication required."),
    status.HTTP_403_FORBIDDEN: ("FORBIDDEN", "You do not have permission."),
    status.HTTP_404_NOT_FOUND: ("NOT_FOUND", "Resource not found."),
    status.HTTP_409_CONFLICT: ("CONFLICT", "Request conflicts with current state."),
    status.HTTP_429_TOO_MANY_REQUESTS: ("RATE_LIMITED", "Too many requests."),
}


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def error_payload(
    request: Request,
    *,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        },
        "request_id": _request_id(request),
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


async def handle_api_error(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(
            request,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        ),
    )


async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    code, message = _STATUS_TO_CODE.get(
        exc.status_code, ("INTERNAL_ERROR", "Internal server error.")
    )
    # Keep the raw detail server-side only.
    logger.warning("HTTPException %s on %s: %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(request, code=code, message=message),
    )


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=error_payload(
            request,
            code="VALIDATION_FAILED",
            message="Input failed schema validation.",
            details={"errors": jsonable_encoder(exc.errors())},
        ),
    )
