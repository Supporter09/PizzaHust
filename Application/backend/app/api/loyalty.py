from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.infra import settings_service
from app.infra.auth import get_current_user
from app.infra.db.deps import get_db
from app.infra.db.models import User

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])


class LoyaltyMeResponse(BaseModel):
    current_points: int
    total_points_earned: int
    redeemable_value_vnd: int


@router.get("/me", response_model=LoyaltyMeResponse)
async def loyalty_me(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> LoyaltyMeResponse:
    redeem_value = settings_service.get_business_settings(db).loyalty_redeem_value_vnd
    return LoyaltyMeResponse(
        current_points=user.current_points,
        total_points_earned=user.total_points_earned,
        redeemable_value_vnd=user.current_points * redeem_value,
    )
