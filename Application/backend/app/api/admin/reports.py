"""A7 – Sales & Order Reports (admin only).

Realized revenue is computed from Delivered orders; the status breakdown spans
all orders in the window. Also exposes a CSV export for the daily revenue table.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, OrderStatus, Product, User, UserRole

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])

require_admin = require_role(UserRole.ADMIN)

_REALIZED = OrderStatus.DELIVERED


class DayRevenueOut(BaseModel):
    day: str
    revenue_vnd: int
    order_count: int


class StatusCountOut(BaseModel):
    status: str
    count: int


class TopItemOut(BaseModel):
    name: str
    quantity_sold: int
    revenue_vnd: int


class SalesReportOut(BaseModel):
    date_from: str
    date_to: str
    total_revenue_vnd: int
    delivered_order_count: int
    total_order_count: int
    average_order_value_vnd: int
    revenue_by_day: list[DayRevenueOut]
    orders_by_status: list[StatusCountOut]
    top_items: list[TopItemOut]


def _window(date_from: date | None, date_to: date | None) -> tuple[datetime, datetime]:
    today = datetime.utcnow().date()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    return datetime.combine(start, time.min), datetime.combine(end, time.max)


def _build_report(db: Session, date_from: date | None, date_to: date | None) -> SalesReportOut:
    start, end = _window(date_from, date_to)
    in_window = (Order.created_at >= start) & (Order.created_at <= end)
    delivered = in_window & (Order.current_status == _REALIZED)

    total_revenue = (
        db.scalar(select(func.coalesce(func.sum(Order.total_amount_vnd), 0)).where(delivered)) or 0
    )
    delivered_count = db.scalar(select(func.count()).select_from(Order).where(delivered)) or 0
    total_count = db.scalar(select(func.count()).select_from(Order).where(in_window)) or 0

    day_col = func.date(Order.created_at)
    day_rows = db.execute(
        select(
            day_col.label("day"),
            func.coalesce(func.sum(Order.total_amount_vnd), 0),
            func.count(),
        )
        .where(delivered)
        .group_by(day_col)
        .order_by(day_col)
    ).all()
    revenue_by_day = [
        DayRevenueOut(day=str(row[0]), revenue_vnd=int(row[1]), order_count=int(row[2]))
        for row in day_rows
    ]

    status_rows = db.execute(
        select(Order.current_status, func.count())
        .where(in_window)
        .group_by(Order.current_status)
    ).all()
    orders_by_status = [
        StatusCountOut(status=row[0].value, count=int(row[1])) for row in status_rows
    ]

    top_rows = db.execute(
        select(
            Product.name,
            func.coalesce(func.sum(OrderItem.quantity), 0),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_price_vnd), 0),
        )
        .join(Order, Order.order_id == OrderItem.order_id)
        .join(Product, Product.product_id == OrderItem.product_id)
        .where(delivered)
        .group_by(Product.product_id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
    ).all()
    top_items = [
        TopItemOut(name=row[0], quantity_sold=int(row[1]), revenue_vnd=int(row[2]))
        for row in top_rows
    ]

    aov = total_revenue // delivered_count if delivered_count else 0
    return SalesReportOut(
        date_from=start.date().isoformat(),
        date_to=end.date().isoformat(),
        total_revenue_vnd=int(total_revenue),
        delivered_order_count=int(delivered_count),
        total_order_count=int(total_count),
        average_order_value_vnd=int(aov),
        revenue_by_day=revenue_by_day,
        orders_by_status=orders_by_status,
        top_items=top_items,
    )


@router.get("/sales", response_model=SalesReportOut)
def sales_report(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> SalesReportOut:
    return _build_report(db, date_from, date_to)


@router.get("/sales.csv")
def sales_report_csv(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> StreamingResponse:
    report = _build_report(db, date_from, date_to)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["day", "revenue_vnd", "order_count"])
    for row in report.revenue_by_day:
        writer.writerow([row.day, row.revenue_vnd, row.order_count])
    writer.writerow([])
    writer.writerow(["total_revenue_vnd", report.total_revenue_vnd])
    writer.writerow(["delivered_order_count", report.delivered_order_count])
    buffer.seek(0)
    filename = f"sales_{report.date_from}_{report.date_to}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
