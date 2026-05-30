from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.errors import APIError
from app.infra.auth import (
    clear_authenticated_session,
    hash_password,
    needs_rehash,
    set_authenticated_session,
    verify_password,
)
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.models import User, UserRole
from app.infra.db.session import get_db_session

router = APIRouter(prefix="/api/auth", tags=["auth"])
DBSession = Annotated[Session, Depends(get_db_session)]
AppSettings = Annotated[Settings, Depends(get_settings_dependency)]


class AuthUserDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    phone_number: str
    address: str | None
    role: UserRole


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=8, max_length=15)
    password: str = Field(min_length=8, max_length=72)
    address: str | None = Field(default=None, max_length=255)


class RegisterResponse(BaseModel):
    user: AuthUserDTO


class LoginRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=15)
    password: str = Field(min_length=8, max_length=72)


class LoginResponse(BaseModel):
    user: AuthUserDTO
    csrf_token: str


class MessageResponse(BaseModel):
    message: str


def _set_csrf_cookie(response: Response, settings: Settings, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_max_age_seconds,
        secure=settings.session_https_only,
        httponly=False,
        samesite=settings.session_same_site,
        path="/",
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: RegisterRequest, db: DBSession) -> RegisterResponse:
    new_user = User(
        full_name=payload.full_name.strip(),
        phone_number=payload.phone_number.strip(),
        password_hash=hash_password(payload.password),
        address=payload.address.strip() if payload.address else None,
        role=UserRole.CUSTOMER,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise APIError(
            code="CONFLICT",
            message="Phone number is already registered.",
            status_code=status.HTTP_409_CONFLICT,
        ) from None

    db.refresh(new_user)
    return RegisterResponse(user=AuthUserDTO.model_validate(new_user))


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DBSession,
    settings: AppSettings,
) -> LoginResponse:
    user = db.scalar(select(User).where(User.phone_number == payload.phone_number.strip()))
    is_valid = bool(
        user and user.password_hash and verify_password(user.password_hash, payload.password)
    )
    if not is_valid:
        raise APIError(
            code="UNAUTHENTICATED",
            message="Invalid phone number or password.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    assert user is not None
    assert user.password_hash is not None

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.add(user)
        db.commit()

    csrf_token = set_authenticated_session(request, user)
    _set_csrf_cookie(response, settings, csrf_token)
    return LoginResponse(user=AuthUserDTO.model_validate(user), csrf_token=csrf_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    settings: AppSettings,
) -> MessageResponse:
    clear_authenticated_session(request)
    response.delete_cookie(key=settings.csrf_cookie_name, path="/")
    return MessageResponse(message="Logged out")
