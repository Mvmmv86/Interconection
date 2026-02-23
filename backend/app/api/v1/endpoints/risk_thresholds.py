"""Risk threshold endpoints."""

from uuid import uuid4

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.risk_threshold import RiskThreshold
from app.schemas.risk_threshold import RiskThresholdUpdate, RiskThresholdResponse

router = APIRouter()


@router.get("", response_model=RiskThresholdResponse)
async def get_risk_thresholds(
    current_user: CurrentUser,
    db: DBSession,
) -> RiskThresholdResponse:
    """Get risk thresholds for current organization.

    Creates default thresholds if none exist.
    """
    result = await db.execute(
        select(RiskThreshold).where(
            RiskThreshold.organization_id == current_user.organization_id,
        )
    )
    thresholds = result.scalar_one_or_none()

    # Create default thresholds if none exist
    if not thresholds:
        thresholds = RiskThreshold(
            id=uuid4(),
            organization_id=current_user.organization_id,
        )
        db.add(thresholds)
        await db.flush()
        await db.refresh(thresholds)

    return RiskThresholdResponse.model_validate(thresholds)


@router.patch("", response_model=RiskThresholdResponse)
async def update_risk_thresholds(
    data: RiskThresholdUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> RiskThresholdResponse:
    """Update risk thresholds for current organization."""
    result = await db.execute(
        select(RiskThreshold).where(
            RiskThreshold.organization_id == current_user.organization_id,
        )
    )
    thresholds = result.scalar_one_or_none()

    if not thresholds:
        thresholds = RiskThreshold(
            id=uuid4(),
            organization_id=current_user.organization_id,
        )
        db.add(thresholds)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(thresholds, field, value)

    await db.flush()
    await db.refresh(thresholds)

    return RiskThresholdResponse.model_validate(thresholds)
