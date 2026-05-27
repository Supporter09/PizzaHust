from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.infra.auth.passwords import hash_password, verify_password
from app.infra.db.models import User

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    phone_number: str = Field(min_length=9, max_length=15)
    password: str = Field(min_length=8, max_length=255)
    address: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    phone_number: str = Field(min_length=9, max_length=15)
    password: str = Field(min_length=1, max_length=255)


class AuthUserResponse(BaseModel):
    user_id: int
    full_name: str
    phone_number: str
    role: str
    membership_tier: str
    current_points: int
    total_points_earned: int


class AuthResponse(BaseModel):
    message: str
    user: AuthUserResponse


def normalize_phone(value: str) -> str:
    return value.strip().replace(" ", "")


def build_auth_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        role=user.role.value,
        membership_tier=user.membership_tier.value,
        current_points=user.current_points,
        total_points_earned=user.total_points_earned,
    )


@router.post("/auth/register", response_model=AuthResponse, summary="Register")
@router.post(
    "/api/auth/register",
    response_model=AuthResponse,
    include_in_schema=False,
)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    phone_number = normalize_phone(payload.phone_number)
    existing = session.execute(
        select(User).where(User.phone_number == phone_number)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already exists.",
        )

    new_user = User(
        full_name=payload.full_name.strip(),
        phone_number=phone_number,
        password_hash=hash_password(payload.password),
        address=payload.address.strip() if payload.address else None,
    )

    session.add(new_user)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already exists.",
        ) from exc
    session.refresh(new_user)

    return AuthResponse(message="Registered successfully.", user=build_auth_user(new_user))


@router.post("/auth/login", response_model=AuthResponse, summary="Login")
@router.post(
    "/api/auth/login",
    response_model=AuthResponse,
    include_in_schema=False,
)
def login(payload: LoginRequest, session: Session = Depends(get_db_session)) -> AuthResponse:
    phone_number = normalize_phone(payload.phone_number)
    user = session.execute(
        select(User).where(User.phone_number == phone_number)
    ).scalar_one_or_none()
    if user is None or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    return AuthResponse(message="Login successful.", user=build_auth_user(user))
