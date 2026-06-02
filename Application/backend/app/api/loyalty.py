from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.infra.auth import get_current_user
from app.infra.db.models import User

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])


class LoyaltyMeResponse(BaseModel):
    current_points: int
    total_points_earned: int


@router.get("/me", response_model=LoyaltyMeResponse)
async def loyalty_me(user: Annotated[User, Depends(get_current_user)]) -> LoyaltyMeResponse:
    return LoyaltyMeResponse(
        current_points=user.current_points,
        total_points_earned=user.total_points_earned,
    )
