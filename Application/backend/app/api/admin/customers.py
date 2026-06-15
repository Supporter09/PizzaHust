"""A6 - Manage Customer Accounts (admin only)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import Session

from app.infra import settings_service
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Cart, MembershipTier, Order, OrderStatus, User, UserRole

router = APIRouter(prefix="/api/admin/customers", tags=["admin-customers"])

require_admin = require_role(UserRole.ADMIN)

SortBy = Literal["tier", "points", "orders", "name"]
SortDir = Literal["asc", "desc"]


class CustomerOut(BaseModel):
    user_id: int
    full_name: str
    phone_number: str
    email: str | None
    is_locked: bool
    current_points: int
    total_points_earned: int
    membership_tier: str
    order_count: int
    last_order_at: datetime | None
    total_spend_vnd: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerOrderOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str
    total_amount_vnd: int
    created_at: datetime
    promised_at: datetime
    delivery_address: str


class CustomerStatsOut(BaseModel):
    total_orders: int
    delivered_orders: int
    total_spend_vnd: int
    average_order_value_vnd: int
    last_order_at: datetime | None


class CustomerLoyaltyOut(BaseModel):
    current_points: int
    total_points_earned: int
    membership_tier: str
    accrual_rate_vnd: int
    redeem_value_vnd: int
    max_redeem_pct: float
    current_balance_value_vnd: int


class CustomerDetailOut(CustomerOut):
    address: str | None
    stats: CustomerStatsOut
    loyalty: CustomerLoyaltyOut
    recent_orders: list[CustomerOrderOut]
    top_orders: list[CustomerOrderOut]


class LockIn(BaseModel):
    reason: str | None = None


def _tier_rank_expr() -> case:
    return case(
        (User.membership_tier == MembershipTier.GOLD, 3),
        (User.membership_tier == MembershipTier.SILVER, 2),
        else_=1,
    )


def _total_spend_expr():
    """Sum of delivered-order totals; mirrors CustomerStatsOut.total_spend_vnd."""
    return func.coalesce(
        func.sum(
            case(
                (Order.current_status == OrderStatus.DELIVERED, Order.total_amount_vnd),
                else_=0,
            )
        ),
        0,
    )


def _sort_clauses(
    sort_by: SortBy,
    sort_dir: SortDir,
    order_count_expr,
):
    direction = desc if sort_dir == "desc" else asc
    tier_rank_expr = _tier_rank_expr()

    if sort_by == "tier":
        return (
            direction(tier_rank_expr),
            desc(order_count_expr),
            asc(User.full_name),
        )
    if sort_by == "orders":
        return (
            direction(order_count_expr),
            desc(User.current_points),
            asc(User.full_name),
        )
    if sort_by == "name":
        return (
            direction(User.full_name),
            desc(User.current_points),
            desc(order_count_expr),
        )
    if sort_by == "points":
        return (
            direction(User.current_points),
            desc(order_count_expr),
            asc(User.full_name),
        )
    return (
        desc(User.current_points),
        desc(order_count_expr),
        asc(User.full_name),
    )


def _customer_payload(
    user: User,
    order_count: int,
    last_order_at: datetime | None,
    total_spend_vnd: int,
) -> dict[str, object]:
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "email": user.email,
        "is_locked": user.is_locked,
        "current_points": user.current_points,
        "total_points_earned": user.total_points_earned,
        "membership_tier": user.membership_tier.value,
        "order_count": order_count,
        "last_order_at": last_order_at,
        "total_spend_vnd": total_spend_vnd,
        "created_at": user.created_at,
    }


def _order_payload(order: Order) -> dict[str, object]:
    return {
        "order_id": order.order_id,
        "order_code": order.order_code,
        "current_status": order.current_status.value,
        "total_amount_vnd": order.total_amount_vnd,
        "created_at": order.created_at,
        "promised_at": order.promised_at,
        "delivery_address": order.delivery_address,
    }


def _customer_stats_payload(
    orders: list[Order],
) -> tuple[CustomerStatsOut, list[Order], list[Order]]:
    delivered_orders = [order for order in orders if order.current_status == OrderStatus.DELIVERED]
    total_spend_vnd = sum(order.total_amount_vnd for order in delivered_orders)
    average_order_value_vnd = total_spend_vnd // len(delivered_orders) if delivered_orders else 0
    stats = CustomerStatsOut(
        total_orders=len(orders),
        delivered_orders=len(delivered_orders),
        total_spend_vnd=total_spend_vnd,
        average_order_value_vnd=average_order_value_vnd,
        last_order_at=orders[0].created_at if orders else None,
    )
    top_orders = sorted(
        delivered_orders,
        key=lambda order: order.total_amount_vnd,
        reverse=True,
    )[:3]
    return stats, orders[:5], top_orders


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    tier: MembershipTier | None = None,
    locked: bool | None = None,
    sort_by: SortBy = Query("points"),
    sort_dir: SortDir = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> list[CustomerOut]:
    order_count_expr = func.count(Order.order_id)
    last_order_at_expr = func.max(Order.created_at)
    total_spend_expr = _total_spend_expr()
    stmt = (
        select(
            User,
            order_count_expr.label("order_count"),
            last_order_at_expr.label("last_order_at"),
            total_spend_expr.label("total_spend_vnd"),
        )
        .outerjoin(Order, Order.user_id == User.user_id)
        .where(User.role == UserRole.CUSTOMER)
        .group_by(User.user_id)
    )

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                User.phone_number.like(pattern),
                User.email.like(pattern),
                User.full_name.like(pattern),
            )
        )
    if tier is not None:
        stmt = stmt.where(User.membership_tier == tier)
    if locked is not None:
        stmt = stmt.where(User.is_locked.is_(locked))

    stmt = (
        stmt.order_by(*_sort_clauses(sort_by, sort_dir, order_count_expr))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = db.execute(stmt).all()
    result = []
    for user, order_count, last_order_at, total_spend_vnd in rows:
        result.append(
            CustomerOut.model_validate(
                _customer_payload(user, int(order_count), last_order_at, int(total_spend_vnd))
            )
        )
    return result


@router.get("/{user_id}", response_model=CustomerDetailOut)
def get_customer(
    user_id: int,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> CustomerDetailOut:
    order_count_expr = func.count(Order.order_id)
    last_order_at_expr = func.max(Order.created_at)
    row = db.execute(
        select(
            User,
            order_count_expr.label("order_count"),
            last_order_at_expr.label("last_order_at"),
        )
        .outerjoin(Order, Order.user_id == User.user_id)
        .where(User.user_id == user_id, User.role == UserRole.CUSTOMER)
        .group_by(User.user_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    user, order_count, last_order_at = row
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.user_id == user.user_id)
            .order_by(Order.created_at.desc(), Order.order_id.desc())
        ).all()
    )
    stats, recent_orders, top_orders = _customer_stats_payload(orders)
    s = settings_service.get_business_settings(db)
    current_balance_value_vnd = user.current_points * s.loyalty_redeem_value_vnd
    return CustomerDetailOut.model_validate(
        {
            **_customer_payload(user, int(order_count), last_order_at, stats.total_spend_vnd),
            "address": user.address,
            "stats": stats.model_dump(),
            "loyalty": CustomerLoyaltyOut(
                current_points=user.current_points,
                total_points_earned=user.total_points_earned,
                membership_tier=user.membership_tier.value,
                accrual_rate_vnd=s.loyalty_accrual_rate,
                redeem_value_vnd=s.loyalty_redeem_value_vnd,
                max_redeem_pct=s.loyalty_max_redeem_pct,
                current_balance_value_vnd=current_balance_value_vnd,
            ).model_dump(),
            "recent_orders": [
                CustomerOrderOut.model_validate(_order_payload(order)) for order in recent_orders
            ],
            "top_orders": [
                CustomerOrderOut.model_validate(_order_payload(order)) for order in top_orders
            ],
        }
    )


@router.post("/{user_id}/lock", status_code=status.HTTP_204_NO_CONTENT)
def lock_customer(
    user_id: int,
    body: LockIn,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> None:
    user: User | None = db.get(User, user_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    user.is_locked = True


@router.post("/{user_id}/unlock", status_code=status.HTTP_204_NO_CONTENT)
def unlock_customer(
    user_id: int,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> None:
    user: User | None = db.get(User, user_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    user.is_locked = False


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    user_id: int,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> None:
    """Permanently delete a customer with no order history.

    Orders/carts reference users with no DB cascade, so a customer who has
    ordered cannot be hard-deleted (history must survive); the admin should
    Lock instead. A transient cart is deleted along with the user.
    """
    user: User | None = db.get(User, user_id)
    if user is None or user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    order_count = db.scalar(select(func.count(Order.order_id)).where(Order.user_id == user_id))
    if order_count:
        raise HTTPException(status_code=409, detail="HAS_ORDERS")

    cart = db.scalar(select(Cart).where(Cart.user_id == user_id))
    if cart is not None:
        _ = cart.lines  # trigger lazy-load so ORM cascade deletes lines before cart
        db.delete(cart)  # cart_lines cascade (ORM all,delete-orphan + DB ON DELETE CASCADE)
        db.flush()  # materialise cart+lines DELETE before user DELETE (no ORM User→Cart rel)
    db.delete(user)
