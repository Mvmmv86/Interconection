"""Analytics endpoints."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    apply_client_scope_filter,
    ensure_client_scope,
    rbac_route_guard,
    require_permission,
)
from app.models.position import Position, PositionType
from app.schemas.analytics import (
    PerformanceMetrics,
    RiskMetrics,
    PnLBreakdown,
    YieldAnalysis,
    AnalyticsDashboard,
)

router = APIRouter(dependencies=[Depends(rbac_route_guard("analytics"))])


@router.get("/performance", response_model=PerformanceMetrics)
async def get_performance_metrics(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="analytics")),
    ],
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y)$"),
    client_id: Optional[UUID] = None,
) -> PerformanceMetrics:
    """Get performance metrics for the portfolio."""
    if client_id:
        ensure_client_scope(permission_ctx, client_id, "analytics")

    # TODO: Implement actual performance calculations from historical data
    # This requires portfolio snapshots and price history

    return PerformanceMetrics(
        period=period,
        start_value=Decimal("0"),
        end_value=Decimal("0"),
        absolute_return=Decimal("0"),
        percent_return=Decimal("0"),
        best_day=Decimal("0"),
        worst_day=Decimal("0"),
        positive_days=0,
        negative_days=0,
        win_rate=Decimal("0"),
    )


@router.get("/risk", response_model=RiskMetrics)
async def get_risk_metrics(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="analytics")),
    ],
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y)$"),
    client_id: Optional[UUID] = None,
) -> RiskMetrics:
    """Get risk metrics for the portfolio."""
    if client_id:
        ensure_client_scope(permission_ctx, client_id, "analytics")

    # TODO: Implement actual risk calculations
    # VaR, Sharpe ratio, Sortino ratio, drawdown, etc.

    return RiskMetrics(
        period=period,
        volatility_daily=Decimal("0"),
        volatility_annualized=Decimal("0"),
        var_95=Decimal("0"),
        var_99=Decimal("0"),
        max_drawdown=Decimal("0"),
        max_drawdown_duration_days=0,
        sharpe_ratio=Decimal("0"),
        sortino_ratio=Decimal("0"),
    )


@router.get("/pnl", response_model=PnLBreakdown)
async def get_pnl_breakdown(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="analytics")),
    ],
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y)$"),
    client_id: Optional[UUID] = None,
) -> PnLBreakdown:
    """Get P&L breakdown for the portfolio."""
    org_id = permission_ctx.organization_id

    query = select(Position).where(Position.organization_id == org_id)
    query = apply_client_scope_filter(
        permission_ctx, query, Position.client_id, "analytics", client_id
    )

    result = await db.execute(query)
    positions = result.scalars().all()

    total_unrealized_pnl = sum(pos.unrealized_pnl for pos in positions)
    pending_rewards = sum(pos.pending_rewards_usd or Decimal("0") for pos in positions)
    il_losses = sum(
        (pos.impermanent_loss or Decimal("0")) * pos.current_value_usd / 100
        for pos in positions
        if pos.position_type == PositionType.LP
    )

    # Group by type
    pnl_by_type = {}
    for pos in positions:
        key = pos.position_type.value
        pnl_by_type[key] = pnl_by_type.get(key, Decimal("0")) + pos.unrealized_pnl

    return PnLBreakdown(
        period=period,
        total_pnl=total_unrealized_pnl + pending_rewards - il_losses,
        realized_pnl=Decimal("0"),  # TODO: Calculate from transactions
        unrealized_pnl=total_unrealized_pnl,
        fees_paid=Decimal("0"),  # TODO: Calculate from transactions
        rewards_earned=pending_rewards,
        il_losses=il_losses,
        net_pnl=total_unrealized_pnl + pending_rewards - il_losses,
        pnl_by_type=pnl_by_type,
        pnl_by_chain={},  # TODO: Group by chain
        pnl_by_asset={},  # TODO: Group by asset
    )


@router.get("/yield", response_model=YieldAnalysis)
async def get_yield_analysis(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="analytics")),
    ],
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> YieldAnalysis:
    """Get yield analysis for the portfolio."""
    org_id = permission_ctx.organization_id

    query = select(Position).where(Position.organization_id == org_id)
    query = apply_client_scope_filter(
        permission_ctx, query, Position.client_id, "analytics", client_id
    )

    result = await db.execute(query)
    positions = result.scalars().all()

    total_staking = Decimal("0")
    total_lending = Decimal("0")
    total_lp = Decimal("0")
    pending_rewards = Decimal("0")
    weighted_apy_sum = Decimal("0")
    yield_value = Decimal("0")
    protocol_data = {}

    for pos in positions:
        if pos.position_type == PositionType.STAKING:
            total_staking += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LENDING:
            total_lending += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LP:
            total_lp += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd

        if pos.pending_rewards_usd:
            pending_rewards += pos.pending_rewards_usd

        # Group by protocol
        if pos.protocol:
            if pos.protocol not in protocol_data:
                protocol_data[pos.protocol] = {
                    "protocol": pos.protocol,
                    "value": Decimal("0"),
                    "apy_weighted": Decimal("0"),
                    "rewards": Decimal("0"),
                }
            protocol_data[pos.protocol]["value"] += pos.current_value_usd
            if pos.apy:
                protocol_data[pos.protocol]["apy_weighted"] += pos.apy * pos.current_value_usd
            if pos.pending_rewards_usd:
                protocol_data[pos.protocol]["rewards"] += pos.pending_rewards_usd

    avg_apy = (weighted_apy_sum / yield_value) if yield_value > 0 else Decimal("0")
    projected_yearly = yield_value * avg_apy / 100 if avg_apy > 0 else Decimal("0")

    yield_by_protocol = []
    for proto, data in protocol_data.items():
        proto_apy = (data["apy_weighted"] / data["value"]) if data["value"] > 0 else Decimal("0")
        yield_by_protocol.append({
            "protocol": proto,
            "value": data["value"],
            "apy": proto_apy,
            "rewards": data["rewards"],
        })

    return YieldAnalysis(
        total_staked_value=total_staking,
        total_lending_value=total_lending,
        total_lp_value=total_lp,
        weighted_average_apy=avg_apy,
        projected_daily_yield=projected_yearly / 365,
        projected_weekly_yield=projected_yearly / 52,
        projected_monthly_yield=projected_yearly / 12,
        projected_yearly_yield=projected_yearly,
        pending_rewards_total=pending_rewards,
        yield_by_protocol=yield_by_protocol,
    )


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="analytics")),
    ],
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y)$"),
    client_id: Optional[UUID] = None,
) -> AnalyticsDashboard:
    """Get complete analytics dashboard."""
    performance = await get_performance_metrics(permission_ctx, db, period, client_id)
    risk = await get_risk_metrics(permission_ctx, db, period, client_id)
    pnl = await get_pnl_breakdown(permission_ctx, db, period, client_id)
    yield_analysis = await get_yield_analysis(permission_ctx, db, client_id)

    return AnalyticsDashboard(
        performance=performance,
        risk=risk,
        pnl=pnl,
        yield_analysis=yield_analysis,
        top_correlations=[],  # TODO: Calculate correlations
        generated_at=datetime.now(timezone.utc),
    )
