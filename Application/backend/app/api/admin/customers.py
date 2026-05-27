"""A6 – Manage Customer Accounts (admin only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.infra.auth import get_current_user
from app.infra.db.deps import get_db
from app.infra.db.models import Order, User, UserRole

router = APIRouter(prefix="/api/admin/customers", tags=["admin-customers"])


def _require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    return user


class CustomerOut(BaseModel):
    user_id: int
    full_name: str
    phone_number: str
    email: str | None
    is_locked: bool
    current_points: int
    membership_tier: str
    order_count: int

    model_config = {"from_attributes": True}


class CustomerDetailOut(CustomerOut):
    address: str | None


class LockIn(BaseModel):
    reason: str | None = None


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
) -> list[CustomerOut]:
    stmt = select(
        User,
        func.count(Order.order_id).label("order_count"),
    ).outerjoin(Order, Order.user_id == User.user_id).where(
        User.role == UserRole.CUSTOMER
    ).group_by(User.user_id)

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.phone_number.like(pattern),
                User.email.like(pattern),
                User.full_name.like(pattern),
            )
        )

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = db.execute(stmt).all()

    result = []
    for user, order_count in rows:
        out = CustomerOut.model_validate({
            **{c.key: getattr(user, c.key) for c in User.__table__.columns},
            "order_count": order_count,
        })
        result.append(out)
    return result


@router.get("/{user_id}", response_model=CustomerDetailOut)
def get_customer(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
) -> CustomerDetailOut:
    row = db.execute(
        select(User, func.count(Order.order_id).label("order_count"))
        .outerjoin(Order, Order.user_id == User.user_id)
        .where(User.user_id == user_id, User.role == UserRole.CUSTOMER)
        .group_by(User.user_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    user, order_count = row
    return CustomerDetailOut.model_validate({
        **{c.key: getattr(user, c.key) for c in User.__table__.columns},
        "order_count": order_count,
    })


@router.post("/{user_id}/lock", status_code=status.HTTP_204_NO_CONTENT)
def lock_customer(
    user_id: int,
    body: LockIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
) -> None:
    user: User | None = db.get(User, user_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    user.is_locked = True


@router.post("/{user_id}/unlock", status_code=status.HTTP_204_NO_CONTENT)
def unlock_customer(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin),
) -> None:
    user: User | None = db.get(User, user_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    user.is_locked = False
