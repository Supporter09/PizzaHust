"""A7 - Sales and order reports (admin only)."""

from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, OrderStatus, User, UserRole

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])
require_admin = require_role(UserRole.ADMIN)


class TopItemOut(BaseModel):
    name: str
    count: int


class SalesReportRowOut(BaseModel):
    date: str
    order_count: int
    revenue_vnd: int
    top_items: list[TopItemOut]


class ReportSummaryOut(BaseModel):
    total_revenue_vnd: int
    total_orders: int
    avg_order_value_vnd: int
    active_customers: int


class ReportSeriesOut(BaseModel):
    date: str
    revenue_vnd: int
    order_count: int


class ReportTopItemOut(BaseModel):
    name: str
    order_count: int
    revenue_vnd: int


class ReportOverviewOut(BaseModel):
    summary: ReportSummaryOut
    series: list[ReportSeriesOut]
    top_items: list[ReportTopItemOut]


def _date_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(start, time.min),
        datetime.combine(end + timedelta(days=1), time.min),
    )


def _item_name(item: OrderItem) -> str:
    if item.product is not None:
        return item.product.name
    if item.combo is not None:
        return item.combo.name
    return "Unknown item"


def _bucket_key(value: datetime, group_by: Literal["day", "week"]) -> str:
    day = value.date()
    if group_by == "week":
        day = day - timedelta(days=day.weekday())
    return day.isoformat()


def _date_iter(start: date, end: date) -> list[date]:
    days: list[date] = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def _sales_rows(
    db: Session, start: date, end: date, group_by: Literal["day", "week"]
) -> list[SalesReportRowOut]:
    start_dt, end_dt = _date_bounds(start, end)
    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
        )
        .where(
            Order.current_status == OrderStatus.DELIVERED,
            Order.created_at >= start_dt,
            Order.created_at < end_dt,
        )
        .order_by(Order.created_at)
    ).all()

    buckets: dict[str, dict[str, object]] = defaultdict(
        lambda: {"order_count": 0, "revenue_vnd": 0, "items": Counter()}
    )
    for order in orders:
        key = _bucket_key(order.created_at, group_by)
        bucket = buckets[key]
        bucket["order_count"] = int(bucket["order_count"]) + 1
        bucket["revenue_vnd"] = int(bucket["revenue_vnd"]) + order.total_amount_vnd
        item_counter = bucket["items"]
        assert isinstance(item_counter, Counter)
        for item in order.items:
            item_counter[_item_name(item)] += item.quantity

    rows: list[SalesReportRowOut] = []
    for key in sorted(buckets):
        bucket = buckets[key]
        item_counter = bucket["items"]
        assert isinstance(item_counter, Counter)
        rows.append(
            SalesReportRowOut(
                date=key,
                order_count=int(bucket["order_count"]),
                revenue_vnd=int(bucket["revenue_vnd"]),
                top_items=[
                    TopItemOut(name=name, count=count)
                    for name, count in item_counter.most_common(5)
                ],
            )
        )
    return rows


def _overview_payload(db: Session, start: date, end: date) -> ReportOverviewOut:
    start_dt, end_dt = _date_bounds(start, end)
    orders = db.scalars(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
        )
        .where(
            Order.current_status == OrderStatus.DELIVERED,
            Order.created_at >= start_dt,
            Order.created_at < end_dt,
        )
        .order_by(Order.created_at)
    ).all()

    daily: dict[str, dict[str, int]] = {
        day.isoformat(): {"order_count": 0, "revenue_vnd": 0} for day in _date_iter(start, end)
    }
    active_customers = set()
    top_item_totals: dict[str, dict[str, int]] = defaultdict(
        lambda: {"order_count": 0, "revenue_vnd": 0}
    )

    for order in orders:
        key = order.created_at.date().isoformat()
        bucket = daily.setdefault(key, {"order_count": 0, "revenue_vnd": 0})
        bucket["order_count"] += 1
        bucket["revenue_vnd"] += order.total_amount_vnd
        if order.user_id is not None:
            active_customers.add(order.user_id)
        for item in order.items:
            name = _item_name(item)
            item_bucket = top_item_totals[name]
            item_bucket["order_count"] += item.quantity
            item_bucket["revenue_vnd"] += item.unit_price_vnd * item.quantity

    total_revenue_vnd = sum(bucket["revenue_vnd"] for bucket in daily.values())
    total_orders = sum(bucket["order_count"] for bucket in daily.values())
    avg_order_value_vnd = total_revenue_vnd // total_orders if total_orders else 0

    series = [
        ReportSeriesOut(date=day.isoformat(), **daily[day.isoformat()])
        for day in _date_iter(start, end)
    ]
    top_items = [
        ReportTopItemOut(name=name, **values)
        for name, values in sorted(
            top_item_totals.items(),
            key=lambda item: (-item[1]["revenue_vnd"], -item[1]["order_count"], item[0]),
        )[:5]
    ]
    return ReportOverviewOut(
        summary=ReportSummaryOut(
            total_revenue_vnd=total_revenue_vnd,
            total_orders=total_orders,
            avg_order_value_vnd=avg_order_value_vnd,
            active_customers=len(active_customers),
        ),
        series=series,
        top_items=top_items,
    )


def _to_csv(rows: list[SalesReportRowOut]) -> str:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["date", "order_count", "revenue_vnd", "top_items"])
    for row in rows:
        writer.writerow(
            [
                row.date,
                row.order_count,
                row.revenue_vnd,
                "; ".join(f"{item.name}:{item.count}" for item in row.top_items),
            ]
        )
    return output.getvalue()


@router.get("/sales", response_model=list[SalesReportRowOut])
def sales_report(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    group_by: Literal["day", "week"] = "day",
    response_format: Literal["json", "csv"] = Query("json", alias="format"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[SalesReportRowOut] | Response:
    rows = _sales_rows(db, from_date, to_date, group_by)
    if response_format == "csv":
        return Response(
            content=_to_csv(rows),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="sales-report.csv"'},
        )
    return rows


@router.get("/overview", response_model=ReportOverviewOut)
def sales_overview(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ReportOverviewOut:
    return _overview_payload(db, from_date, to_date)
