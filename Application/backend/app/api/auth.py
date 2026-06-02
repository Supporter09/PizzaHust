"""Auth routes: register, login, logout, me. (infra-004 / U8 / U9 / U12)"""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import (
    clear_session,
    get_current_user,
    hash_password,
    set_session,
    verify_password,
)
from app.infra.db.deps import get_db
from app.infra.db.models import User, UserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])

_VN_PHONE_RE = re.compile(r"^(0|\+84)[3-9]\d{8}$")


def _validate_phone(v: str) -> str:
    if not _VN_PHONE_RE.match(v):
        raise ValueError("invalid Vietnamese phone number")
    return v


class RegisterIn(BaseModel):
    full_name: str
    phone_number: str
    email: EmailStr | None = None
    password: str

    @field_validator("phone_number")
    @classmethod
    def check_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginIn(BaseModel):
    phone_number: str
    password: str


class ProfileOut(BaseModel):
    user_id: int
    full_name: str
    phone_number: str
    email: str | None
    role: str
    current_points: int
    membership_tier: str
    is_locked: bool

    model_config = {"from_attributes": True}


class ProfilePatchIn(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    address: str | None = None


@router.post("/register", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)) -> ProfileOut:
    existing = db.scalar(select(User).where(User.phone_number == body.phone_number))
    if existing:
        raise HTTPException(status_code=409, detail="CONFLICT")
    if body.email:
        if db.scalar(select(User).where(User.email == body.email)):
            raise HTTPException(status_code=409, detail="CONFLICT")

    user = User(
        full_name=body.full_name,
        phone_number=body.phone_number,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.CUSTOMER,
    )
    db.add(user)
    db.flush()
    # Refresh so server-side defaults (current_points, membership_tier,
    # is_locked) are populated before serializing ProfileOut.
    db.refresh(user)
    set_session(request, user)
    return ProfileOut.model_validate(user)


@router.post("/login", response_model=ProfileOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> ProfileOut:
    user: User | None = db.scalar(select(User).where(User.phone_number == body.phone_number))
    if user is None or user.password_hash is None:
        raise HTTPException(status_code=401, detail="UNAUTHENTICATED")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="UNAUTHENTICATED")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    set_session(request, user)
    return ProfileOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    clear_session(request)


@router.get("/me", response_model=ProfileOut)
def me(request: Request, db: Session = Depends(get_db)) -> ProfileOut:
    user = get_current_user(request, db)
    return ProfileOut.model_validate(user)


@router.patch("/me", response_model=ProfileOut)
def update_me(
    body: ProfilePatchIn, request: Request, db: Session = Depends(get_db)
) -> ProfileOut:
    user = get_current_user(request, db)
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        if db.scalar(select(User).where(User.email == body.email, User.user_id != user.user_id)):
            raise HTTPException(status_code=409, detail="CONFLICT")
        user.email = body.email
    if body.address is not None:
        user.address = body.address
    return ProfileOut.model_validate(user)
