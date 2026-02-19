"""Alert endpoints."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.alert import Alert
from app.schemas.alert import (
    AlertCreate,
    AlertUpdate,
    AlertResponse,
    AlertHistory,
    AlertTestResult,
)
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    current_user: CurrentUser,
    db: DBSession,
    is_active: bool = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> List[AlertResponse]:
    """List all alerts for current user."""
    query = select(Alert).where(
        Alert.organization_id == current_user.organization_id,
        Alert.user_id == current_user.id,
    )

    if is_active is not None:
        query = query.where(Alert.is_active == is_active)

    query = query.offset(skip).limit(limit).order_by(Alert.created_at.desc())

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [AlertResponse.model_validate(a) for a in alerts]


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    data: AlertCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertResponse:
    """Create a new alert."""
    alert = Alert(
        id=uuid4(),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        name=data.name,
        type=data.type,
        condition=data.condition.model_dump(),
        channels=data.channels.model_dump(),
        is_recurring=data.is_recurring,
        cooldown_minutes=data.cooldown_minutes,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)

    return AlertResponse.model_validate(alert)


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertResponse:
    """Get a specific alert."""
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.organization_id == current_user.organization_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return AlertResponse.model_validate(alert)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: UUID,
    data: AlertUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertResponse:
    """Update an alert."""
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.organization_id == current_user.organization_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "condition" in update_data:
        update_data["condition"] = update_data["condition"].model_dump()
    if "channels" in update_data:
        update_data["channels"] = update_data["channels"].model_dump()

    for field, value in update_data.items():
        setattr(alert, field, value)

    await db.flush()
    await db.refresh(alert)

    return AlertResponse.model_validate(alert)


@router.delete("/{alert_id}", response_model=SuccessResponse)
async def delete_alert(
    alert_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete an alert."""
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.organization_id == current_user.organization_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    await db.delete(alert)
    await db.flush()

    return SuccessResponse(message="Alert deleted successfully")


@router.post("/{alert_id}/test", response_model=AlertTestResult)
async def test_alert(
    alert_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AlertTestResult:
    """Test an alert to see if it would trigger."""
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.organization_id == current_user.organization_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    # TODO: Implement actual alert testing
    # This would check the current value against the condition

    return AlertTestResult(
        alert_id=alert_id,
        would_trigger=False,
        current_value=Decimal("0"),
        threshold=Decimal(alert.condition.get("threshold", 0)),
        condition_met=False,
        message="Alert test completed",
    )


@router.get("/history", response_model=List[AlertHistory])
async def get_alert_history(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AlertHistory]:
    """Get history of triggered alerts."""
    # TODO: Implement alert history storage and retrieval
    # This would require an AlertHistory model and storing triggered events

    return []
