"""AI reports and settings endpoints."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func

from app.api.deps import CurrentUser, DBSession
from app.models.ai import AIReport, AISettings, AIProvider, ReportType
from app.schemas.ai import (
    AIReportCreate,
    AIReportResponse,
    AIReportListItem,
    AISettingsUpdate,
    AISettingsResponse,
)
from app.schemas.common import SuccessResponse

router = APIRouter()


# --- AI Reports ---

@router.get("/reports", response_model=List[AIReportListItem])
async def list_reports(
    current_user: CurrentUser,
    db: DBSession,
    report_type: Optional[str] = None,
    client_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> List[AIReportListItem]:
    """List AI reports for current organization."""
    query = select(AIReport).where(
        AIReport.organization_id == current_user.organization_id,
    )

    if report_type:
        query = query.where(AIReport.report_type == report_type)
    if client_id:
        query = query.where(AIReport.client_id == client_id)

    query = query.offset(skip).limit(limit).order_by(AIReport.generated_at.desc())

    result = await db.execute(query)
    reports = result.scalars().all()

    return [AIReportListItem.model_validate(r) for r in reports]


@router.post("/reports", response_model=AIReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    data: AIReportCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> AIReportResponse:
    """Save an AI-generated report."""
    report = AIReport(
        id=uuid4(),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        client_id=data.client_id,
        report_type=ReportType(data.report_type) if data.report_type in [e.value for e in ReportType] else ReportType.CUSTOM,
        title=data.title,
        content=data.content,
        summary=data.summary,
        portfolio_context=data.portfolio_context,
        risk_metrics=data.risk_metrics,
        model_used=data.model_used,
        tokens_used=data.tokens_used,
        generation_time_ms=data.generation_time_ms,
        generated_at=datetime.now(timezone.utc),
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return AIReportResponse.model_validate(report)


@router.get("/reports/{report_id}", response_model=AIReportResponse)
async def get_report(
    report_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AIReportResponse:
    """Get a specific AI report."""
    result = await db.execute(
        select(AIReport).where(
            AIReport.id == report_id,
            AIReport.organization_id == current_user.organization_id,
        )
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    return AIReportResponse.model_validate(report)


@router.delete("/reports/{report_id}", response_model=SuccessResponse)
async def delete_report(
    report_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete an AI report."""
    result = await db.execute(
        select(AIReport).where(
            AIReport.id == report_id,
            AIReport.organization_id == current_user.organization_id,
        )
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    await db.delete(report)
    await db.flush()

    return SuccessResponse(message="Report deleted successfully")


# --- AI Settings ---

@router.get("/settings", response_model=AISettingsResponse)
async def get_ai_settings(
    current_user: CurrentUser,
    db: DBSession,
) -> AISettingsResponse:
    """Get AI settings for current organization."""
    result = await db.execute(
        select(AISettings).where(
            AISettings.organization_id == current_user.organization_id,
        )
    )
    settings = result.scalar_one_or_none()

    # Create default settings if none exist
    if not settings:
        settings = AISettings(
            id=uuid4(),
            organization_id=current_user.organization_id,
            provider=AIProvider.ANTHROPIC,
            use_platform_key=True,
            is_configured=True,
        )
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    return AISettingsResponse.model_validate(settings)


@router.patch("/settings", response_model=AISettingsResponse)
async def update_ai_settings(
    data: AISettingsUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> AISettingsResponse:
    """Update AI settings for current organization."""
    result = await db.execute(
        select(AISettings).where(
            AISettings.organization_id == current_user.organization_id,
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = AISettings(
            id=uuid4(),
            organization_id=current_user.organization_id,
        )
        db.add(settings)

    if data.provider is not None:
        settings.provider = AIProvider(data.provider)

    if data.api_key is not None:
        # TODO: Encrypt the API key before storing
        settings.api_key_encrypted = data.api_key
        settings.api_key_masked = data.api_key[:4] + "..." + data.api_key[-4:] if len(data.api_key) > 8 else "****"
        settings.is_configured = True
        settings.use_platform_key = False

    if data.use_platform_key is not None:
        settings.use_platform_key = data.use_platform_key
        if data.use_platform_key:
            settings.is_configured = True

    await db.flush()
    await db.refresh(settings)

    return AISettingsResponse.model_validate(settings)
