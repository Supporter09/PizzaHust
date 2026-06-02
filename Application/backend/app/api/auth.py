from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import (
    clear_authenticated_session,
    enforce_auth_rate_limit,
    enforce_csrf,
    ensure_csrf_token,
    get_current_user,
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

# Verified against on login miss to equalize response time and prevent
# timing-based account enumeration. The plaintext is arbitrary and never matches.
_DUMMY_PASSWORD_HASH = hash_password("timing-equalizer-not-a-real-password")


def _stripped_nonblank(value: str) -> str:
    # min_length runs on the raw value, so "   " slips through; strip and reject
    # so we never store an empty name/phone.
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


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

    @field_validator("full_name", "phone_number")
    @classmethod
    def _no_blank(cls, v: str) -> str:
        return _stripped_nonblank(v)


class RegisterResponse(BaseModel):
    user: AuthUserDTO


class LoginRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=15)
    password: str = Field(min_length=8, max_length=72)


class LoginResponse(BaseModel):
    user: AuthUserDTO
    csrf_token: str


class MeResponse(BaseModel):
    user: AuthUserDTO
    csrf_token: str


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    address: str | None = Field(default=None, max_length=255)

    @field_validator("full_name")
    @classmethod
    def _no_blank_name(cls, v: str | None) -> str | None:
        return _stripped_nonblank(v) if v is not None else None


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
    dependencies=[Depends(enforce_auth_rate_limit)],
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


@router.post(
    "/login",
    response_model=LoginResponse,
    dependencies=[Depends(enforce_auth_rate_limit)],
)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DBSession,
    settings: AppSettings,
) -> LoginResponse:
    user = db.scalar(select(User).where(User.phone_number == payload.phone_number.strip()))
    if user and user.password_hash:
        is_valid = verify_password(user.password_hash, payload.password)
    else:
        # Equalize timing against a constant hash so a missing account costs the
        # same as a wrong password — prevents account enumeration via response time.
        verify_password(_DUMMY_PASSWORD_HASH, payload.password)
        is_valid = False
    if not is_valid:
        raise APIError(
            code="UNAUTHENTICATED",
            message="Invalid phone number or password.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    assert user is not None
    assert user.password_hash is not None

    if user.is_locked:
        # A6 account lock: refuse to issue a session to a locked account.
        raise APIError(
            code="FORBIDDEN",
            message="This account is locked.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

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
    _: Annotated[None, Depends(enforce_csrf)],
    __: Annotated[User, Depends(get_current_user)],
    settings: AppSettings,
) -> MessageResponse:
    clear_authenticated_session(request)
    response.delete_cookie(key=settings.csrf_cookie_name, path="/")
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    settings: AppSettings,
) -> MeResponse:
    csrf_token = ensure_csrf_token(request)
    _set_csrf_cookie(response, settings, csrf_token)
    return MeResponse(user=AuthUserDTO.model_validate(user), csrf_token=csrf_token)


@router.patch("/me", response_model=AuthUserDTO)
async def update_me(
    payload: UpdateProfileRequest,
    _: Annotated[None, Depends(enforce_csrf)],
    user: Annotated[User, Depends(get_current_user)],
    db: DBSession,
) -> AuthUserDTO:
    has_changes = False
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
        has_changes = True
    if payload.address is not None:
        user.address = payload.address.strip() if payload.address else None
        has_changes = True

    if has_changes:
        db.add(user)
        db.commit()
        db.refresh(user)

    return AuthUserDTO.model_validate(user)
