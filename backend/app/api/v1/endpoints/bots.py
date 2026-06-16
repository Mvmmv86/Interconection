"""Bot catalog and customer activation endpoints."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    SuperUser,
    apply_client_scope_filter,
    is_scope_specific_enforcement_enabled,
    rbac_route_guard,
    require_permission,
    require_superuser,
)
from app.models.audit_log import AuditAction
from app.models.bot import (
    BotBacktest,
    BotIndicator,
    BotInstance,
    BotInstanceMode,
    BotInstanceStatus,
    BotRun,
    BotSignal,
    BotStrategy,
    BotStrategyStatus,
    BotTemplate,
    BotTemplateParameter,
    BotTemplateStatus,
)
from app.models.client import Client
from app.models.exchange import Exchange
from app.models.organization import Organization, PlanType
from app.schemas.bot import (
    AdminBotInstanceUpdate,
    AdminBotTemplateCreate,
    AdminBotTemplateUpdate,
    BotBacktestCreate,
    BotBacktestResponse,
    BotIndicatorResponse,
    BotInstanceCreate,
    BotInstanceResponse,
    BotInstanceUpdate,
    BotLiveEnableRequest,
    BotRunRequest,
    BotRunResponse,
    BotSignalResponse,
    BotStrategyCreate,
    BotStrategyResponse,
    BotStrategyUpdate,
    BotTemplateParameterCreate,
    BotTemplateParameterResponse,
    BotTemplateResponse,
)
from app.services.audit_service import record_audit_event, record_audit_event_immediate
from app.services.bot_engine_service import BotEngineService
from app.services.plan_limits import enforce_plan_limit

router = APIRouter(dependencies=[Depends(rbac_route_guard("bots"))])
admin_router = APIRouter(dependencies=[Depends(require_superuser)])

PLAN_RANK = {
    PlanType.FREE: 0,
    PlanType.PRO: 1,
    PlanType.ENTERPRISE: 2,
}


def _enum_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _template_parameter_response(parameter: BotTemplateParameter) -> BotTemplateParameterResponse:
    return BotTemplateParameterResponse(
        id=parameter.id,
        template_id=parameter.template_id,
        key=parameter.key,
        label=parameter.label,
        type=parameter.type,
        required=parameter.required,
        default_value=parameter.default_value,
        min_value=parameter.min_value,
        max_value=parameter.max_value,
        options=parameter.options,
        help_text=parameter.help_text,
        created_at=parameter.created_at,
        updated_at=parameter.updated_at,
    )


def _template_response(
    template: BotTemplate,
    *,
    active_instance_count: int = 0,
    total_instance_count: int = 0,
) -> BotTemplateResponse:
    parameters = [_template_parameter_response(parameter) for parameter in template.parameters]
    return BotTemplateResponse(
        id=template.id,
        name=template.name,
        slug=template.slug,
        description=template.description,
        type=_enum_value(template.type),
        status=_enum_value(template.status),
        required_plan=_enum_value(template.required_plan),
        requires_trade_permission=template.requires_trade_permission,
        supported_exchanges=list(template.supported_exchanges or []),
        supported_assets=list(template.supported_assets or []),
        default_parameters=dict(template.default_parameters or {}),
        risk_notes=template.risk_notes,
        strategy_id=template.strategy_id,
        strategy_name=template.strategy.name if template.strategy else None,
        parameter_count=len(parameters),
        active_instance_count=active_instance_count,
        total_instance_count=total_instance_count,
        parameters=parameters,
        created_by_user_id=template.created_by_user_id,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _instance_response(instance: BotInstance) -> BotInstanceResponse:
    return BotInstanceResponse(
        id=instance.id,
        template_id=instance.template_id,
        template_name=instance.template.name if instance.template else None,
        template_type=_enum_value(instance.template.type) if instance.template else None,
        organization_id=instance.organization_id,
        organization_name=instance.organization.name if instance.organization else None,
        client_id=instance.client_id,
        client_name=instance.client.name,
        exchange_id=instance.exchange_id,
        exchange_name=instance.exchange.label if instance.exchange else None,
        strategy_id=instance.strategy_id,
        strategy_name=instance.strategy.name if instance.strategy else None,
        name=instance.name,
        mode=_enum_value(instance.mode),
        status=_enum_value(instance.status),
        live_enabled=instance.live_enabled,
        parameters=dict(instance.parameters or {}),
        risk_config=dict(instance.risk_config or {}),
        last_error=instance.last_error,
        last_heartbeat_at=instance.last_heartbeat_at,
        last_run_at=instance.last_run_at,
        started_at=instance.started_at,
        paused_at=instance.paused_at,
        disabled_at=instance.disabled_at,
        created_by_user_id=instance.created_by_user_id,
        created_at=instance.created_at,
        updated_at=instance.updated_at,
    )


def _apply_status_timestamps(instance: BotInstance, status_value: BotInstanceStatus) -> None:
    now = datetime.now(timezone.utc)
    if status_value == BotInstanceStatus.ACTIVE:
        instance.started_at = instance.started_at or now
        instance.paused_at = None
        instance.disabled_at = None
    elif status_value == BotInstanceStatus.PAUSED:
        instance.paused_at = now
    elif status_value == BotInstanceStatus.DISABLED:
        instance.disabled_at = now


def _merge_parameters(template: BotTemplate, overrides: dict) -> dict:
    parameters = dict(template.default_parameters or {})
    parameters.update(overrides or {})
    missing_required = [
        parameter.key
        for parameter in template.parameters
        if parameter.required and parameters.get(parameter.key) in (None, "")
    ]
    if missing_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Missing required bot parameters", "keys": missing_required},
        )
    return parameters


async def _get_customer_client(
    db: DBSession,
    permission_ctx: MembershipAuthContext,
    client_id: UUID,
) -> Client:
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    client = await db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == permission_ctx.organization_id,
        )
    )
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


async def _get_customer_exchange(
    db: DBSession,
    client_id: UUID,
    exchange_id: UUID | None,
) -> Exchange | None:
    if exchange_id is None:
        return None
    exchange = await db.scalar(
        select(Exchange).where(
            Exchange.id == exchange_id,
            Exchange.client_id == client_id,
        )
    )
    if exchange is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exchange not found")
    return exchange


async def _get_organization(db: DBSession, organization_id: UUID) -> Organization:
    organization = await db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


def _ensure_plan_allows_template(organization: Organization, template: BotTemplate) -> None:
    if PLAN_RANK[organization.plan] < PLAN_RANK[template.required_plan]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Bot requires a higher plan",
                "required_plan": template.required_plan.value,
                "current_plan": organization.plan.value,
            },
        )


def _ensure_exchange_supported(template: BotTemplate | None, exchange: Exchange | None) -> None:
    if template is None:
        return
    supported = [item.lower() for item in (template.supported_exchanges or [])]
    if supported and exchange is not None and exchange.exchange.lower() not in supported:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected exchange is not supported by this bot",
        )


def _replace_template_parameters(template: BotTemplate, parameters: list[BotTemplateParameterCreate]) -> None:
    template.parameters.clear()
    for parameter in parameters:
        if not isinstance(parameter, BotTemplateParameterCreate):
            parameter = BotTemplateParameterCreate(**parameter)
        template.parameters.append(BotTemplateParameter(id=uuid4(), **parameter.model_dump()))


async def _load_instance_for_response(db: DBSession, instance_id: UUID) -> BotInstance:
    instance = await db.scalar(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.id == instance_id)
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    return instance


async def _load_template_for_response(db: DBSession, template_id: UUID) -> BotTemplate:
    template = await db.scalar(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.id == template_id)
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot template not found")
    return template


def _strategy_response(
    strategy: BotStrategy,
    *,
    template_count: int = 0,
    instance_count: int = 0,
    backtest_count: int = 0,
) -> BotStrategyResponse:
    return BotStrategyResponse(
        id=strategy.id,
        name=strategy.name,
        slug=strategy.slug,
        description=strategy.description,
        type=_enum_value(strategy.type),
        status=_enum_value(strategy.status),
        version=strategy.version,
        market_config=dict(strategy.market_config or {}),
        indicator_config=dict(strategy.indicator_config or {}),
        rule_config=dict(strategy.rule_config or {}),
        risk_defaults=dict(strategy.risk_defaults or {}),
        template_count=template_count,
        instance_count=instance_count,
        backtest_count=backtest_count,
        created_by_user_id=strategy.created_by_user_id,
        created_at=strategy.created_at,
        updated_at=strategy.updated_at,
    )


def _run_response(run: BotRun) -> BotRunResponse:
    return BotRunResponse(
        id=run.id,
        instance_id=run.instance_id,
        organization_id=run.organization_id,
        client_id=run.client_id,
        exchange_id=run.exchange_id,
        strategy_id=run.strategy_id,
        mode=_enum_value(run.mode),
        status=_enum_value(run.status),
        cycle_key=run.cycle_key,
        input_snapshot=dict(run.input_snapshot or {}),
        decision_snapshot=dict(run.decision_snapshot or {}),
        risk_snapshot=dict(run.risk_snapshot or {}),
        error=run.error,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _signal_response(signal: BotSignal) -> BotSignalResponse:
    return BotSignalResponse(
        id=signal.id,
        instance_id=signal.instance_id,
        run_id=signal.run_id,
        organization_id=signal.organization_id,
        client_id=signal.client_id,
        exchange_id=signal.exchange_id,
        strategy_id=signal.strategy_id,
        action=_enum_value(signal.action),
        status=_enum_value(signal.status),
        symbol=signal.symbol,
        confidence=float(signal.confidence) if signal.confidence is not None else None,
        price_usd=float(signal.price_usd) if signal.price_usd is not None else None,
        quantity=float(signal.quantity) if signal.quantity is not None else None,
        notional_usd=float(signal.notional_usd) if signal.notional_usd is not None else None,
        reason=signal.reason,
        input_snapshot=dict(signal.input_snapshot or {}),
        risk_snapshot=dict(signal.risk_snapshot or {}),
        generated_at=signal.generated_at,
        created_at=signal.created_at,
        updated_at=signal.updated_at,
    )


def _backtest_response(backtest) -> BotBacktestResponse:
    return BotBacktestResponse(
        id=backtest.id,
        strategy_id=backtest.strategy_id,
        template_id=backtest.template_id,
        organization_id=backtest.organization_id,
        name=backtest.name,
        symbol=backtest.symbol,
        timeframe=backtest.timeframe,
        status=_enum_value(backtest.status),
        period_start=backtest.period_start,
        period_end=backtest.period_end,
        initial_capital_usd=float(backtest.initial_capital_usd),
        result_summary=dict(backtest.result_summary or {}),
        metrics=dict(backtest.metrics or {}),
        logs=list(backtest.logs or []),
        error=backtest.error,
        created_by_user_id=backtest.created_by_user_id,
        started_at=backtest.started_at,
        completed_at=backtest.completed_at,
        created_at=backtest.created_at,
        updated_at=backtest.updated_at,
    )


def _indicator_response(indicator: BotIndicator) -> BotIndicatorResponse:
    return BotIndicatorResponse(
        id=indicator.id,
        key=indicator.key,
        name=indicator.name,
        category=indicator.category,
        description=indicator.description,
        status=indicator.status,
        parameter_schema=dict(indicator.parameter_schema or {}),
        output_schema=dict(indicator.output_schema or {}),
        default_parameters=dict(indicator.default_parameters or {}),
        supported_timeframes=list(indicator.supported_timeframes or []),
        required_inputs=list(indicator.required_inputs or []),
        engine_handler=indicator.engine_handler,
        sort_order=indicator.sort_order,
        created_at=indicator.created_at,
        updated_at=indicator.updated_at,
    )


def _extract_strategy_indicator_keys(indicator_config: dict) -> set[str]:
    indicators = indicator_config.get("indicators")
    if not isinstance(indicators, list):
        return set()
    keys: set[str] = set()
    for item in indicators:
        if isinstance(item, dict) and item.get("key"):
            keys.add(str(item["key"]).strip().lower())
    return keys


async def _ensure_strategy_indicators_exist(db: DBSession, indicator_config: dict) -> None:
    keys = _extract_strategy_indicator_keys(indicator_config)
    if not keys:
        return
    result = await db.execute(
        select(BotIndicator.key).where(
            BotIndicator.key.in_(keys),
            BotIndicator.status == "active",
        )
    )
    existing_keys = {str(key) for key in result.scalars().all()}
    missing = sorted(keys - existing_keys)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Unknown or inactive strategy indicators", "keys": missing},
        )


@router.get("/templates", response_model=list[BotTemplateResponse])
async def list_available_bot_templates(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotTemplateResponse]:
    """List bot products published by the platform."""
    result = await db.execute(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.status == BotTemplateStatus.PUBLISHED)
        .order_by(BotTemplate.name)
    )
    return [_template_response(template) for template in result.scalars().unique().all()]


@router.get("/strategies", response_model=list[BotStrategyResponse])
async def list_available_bot_strategies(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("strategies:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotStrategyResponse]:
    """List published platform strategies visible to customer accounts."""
    result = await db.execute(
        select(BotStrategy)
        .where(BotStrategy.status == BotStrategyStatus.PUBLISHED)
        .order_by(BotStrategy.name)
    )
    return [_strategy_response(strategy) for strategy in result.scalars().all()]


@router.get("/indicators", response_model=list[BotIndicatorResponse])
async def list_available_bot_indicators(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("strategies:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    category: Optional[str] = Query(default=None),
) -> list[BotIndicatorResponse]:
    """List active technical indicators available to customer-readable strategies."""
    query = (
        select(BotIndicator)
        .where(BotIndicator.status == "active")
        .order_by(BotIndicator.category, BotIndicator.sort_order, BotIndicator.name)
    )
    if category:
        query = query.where(BotIndicator.category == category)
    result = await db.execute(query)
    return [_indicator_response(indicator) for indicator in result.scalars().all()]


@router.get("/instances", response_model=list[BotInstanceResponse])
async def list_bot_instances(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotInstanceResponse]:
    """List bot instances in the active tenant."""
    query = (
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.organization_id == permission_ctx.organization_id)
        .order_by(BotInstance.created_at.desc())
    )
    query = apply_client_scope_filter(permission_ctx, query, BotInstance.client_id, "bots")
    result = await db.execute(query)
    instances = result.scalars().unique().all()
    return [_instance_response(instance) for instance in instances]


@router.post("/instances", response_model=BotInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_bot_instance(
    data: BotInstanceCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:activate", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Activate a published bot template for a customer portfolio."""
    if data.mode == BotInstanceMode.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live bot mode is not enabled in this foundation release",
        )
    template = await db.scalar(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(
            BotTemplate.id == data.template_id,
            BotTemplate.status == BotTemplateStatus.PUBLISHED,
        )
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published bot template not found")
    selected_strategy = template.strategy
    if data.strategy_id is not None:
        selected_strategy = await db.get(BotStrategy, data.strategy_id)
        if selected_strategy is None or selected_strategy.status != BotStrategyStatus.PUBLISHED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published strategy not found")

    organization = await _get_organization(db, permission_ctx.organization_id)
    _ensure_plan_allows_template(organization, template)
    await enforce_plan_limit(db, permission_ctx.organization_id, "bots")
    client = await _get_customer_client(db, permission_ctx, data.client_id)
    exchange = await _get_customer_exchange(db, data.client_id, data.exchange_id)
    _ensure_exchange_supported(template, exchange)

    instance = BotInstance(
        id=uuid4(),
        template_id=template.id,
        organization_id=permission_ctx.organization_id,
        client_id=client.id,
        exchange_id=exchange.id if exchange else None,
        strategy_id=selected_strategy.id if selected_strategy else None,
        name=data.name or template.name,
        mode=data.mode,
        status=BotInstanceStatus.CONFIGURED,
        parameters=_merge_parameters(template, data.parameters),
        risk_config={**(selected_strategy.risk_defaults if selected_strategy else {}), **data.risk_config},
        created_by_user_id=permission_ctx.user.id,
    )
    db.add(instance)
    await db.flush()
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.CREATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer activated bot instance",
        metadata={"template_id": template.id, "client_id": client.id, "exchange_id": data.exchange_id},
        request=request,
    )
    return _instance_response(await _load_instance_for_response(db, instance.id))


@router.patch("/instances/{instance_id}", response_model=BotInstanceResponse)
async def update_bot_instance(
    instance_id: UUID,
    data: BotInstanceUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:edit", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Update a customer bot instance configuration or lifecycle state."""
    result = await db.execute(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
        .with_for_update()
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    update_data = data.model_dump(exclude_unset=True)
    if "mode" in update_data and update_data["mode"] == BotInstanceMode.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live bot mode is not enabled in this foundation release",
        )
    if "client_id" in update_data and update_data["client_id"] is not None:
        client = await _get_customer_client(db, permission_ctx, update_data["client_id"])
        instance.client_id = client.id
        if instance.exchange_id is not None:
            exchange = await _get_customer_exchange(db, client.id, instance.exchange_id)
            _ensure_exchange_supported(instance.template, exchange)
    if "exchange_id" in update_data:
        exchange = await _get_customer_exchange(db, instance.client_id, update_data["exchange_id"])
        _ensure_exchange_supported(instance.template, exchange)
        instance.exchange_id = exchange.id if exchange else None
    if "strategy_id" in update_data:
        if update_data["strategy_id"] is None:
            instance.strategy_id = None
        else:
            strategy = await db.get(BotStrategy, update_data["strategy_id"])
            if strategy is None or strategy.status != BotStrategyStatus.PUBLISHED:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published strategy not found")
            instance.strategy_id = strategy.id
    if "parameters" in update_data and update_data["parameters"] is not None:
        instance.parameters = _merge_parameters(instance.template, update_data["parameters"])
    if "risk_config" in update_data and update_data["risk_config"] is not None:
        instance.risk_config = update_data["risk_config"]
    if "status" in update_data and update_data["status"] is not None:
        status_value = update_data["status"]
        _apply_status_timestamps(instance, status_value)
        instance.status = status_value
    if "name" in update_data and update_data["name"] is not None:
        instance.name = update_data["name"]
    if "mode" in update_data and update_data["mode"] is not None:
        instance.mode = update_data["mode"]

    await db.flush()
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer updated bot instance",
        metadata={"updated_fields": list(update_data.keys())},
        request=request,
    )
    return _instance_response(await _load_instance_for_response(db, instance.id))


@router.post("/instances/{instance_id}/run-paper", response_model=BotRunResponse)
async def run_bot_instance_paper_cycle(
    instance_id: UUID,
    data: BotRunRequest,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:run", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotRunResponse:
    """Run one idempotent paper cycle and persist the generated signal."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    engine = BotEngineService(db)
    run = await engine.run_paper_cycle(
        instance_id=instance_id,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        cycle_key=data.cycle_key,
    )
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_run",
        resource_id=run.id,
        description="Customer ran bot paper cycle",
        metadata={"instance_id": instance_id, "cycle_key": run.cycle_key},
        request=request,
    )
    return _run_response(run)


@router.get("/instances/{instance_id}/runs", response_model=list[BotRunResponse])
async def list_bot_instance_runs(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> list[BotRunResponse]:
    """List recent paper cycles for one customer bot instance."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    result = await db.execute(
        select(BotRun)
        .where(BotRun.instance_id == instance_id)
        .order_by(BotRun.created_at.desc())
        .limit(limit)
    )
    return [_run_response(run) for run in result.scalars().all()]


@router.get("/instances/{instance_id}/signals", response_model=list[BotSignalResponse])
async def list_bot_instance_signals(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> list[BotSignalResponse]:
    """List recent generated signals for one customer bot instance."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    result = await db.execute(
        select(BotSignal)
        .where(BotSignal.instance_id == instance_id)
        .order_by(BotSignal.generated_at.desc())
        .limit(limit)
    )
    return [_signal_response(signal) for signal in result.scalars().all()]


@router.post("/instances/{instance_id}/live/enable", response_model=BotInstanceResponse)
async def request_live_bot_enable(
    instance_id: UUID,
    data: BotLiveEnableRequest,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:activate", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Guarded live-mode request.

    Live trading remains blocked until the dedicated executor, order
    reconciliation, and kill-switch flow are implemented and approved.
    """
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    await record_audit_event_immediate(
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer requested live bot enable but live trading is gated",
        metadata={"confirm_risk": data.confirm_risk, "reason": data.reason},
        request=request,
    )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Live trading is gated until executor, reconciliation and kill-switch are approved",
    )


@admin_router.get("/strategies", response_model=list[BotStrategyResponse])
async def list_admin_bot_strategies(
    _superuser: SuperUser,
    db: DBSession,
    status_filter: Optional[BotStrategyStatus] = Query(default=None, alias="status"),
) -> list[BotStrategyResponse]:
    """List platform strategies with aggregate usage counts."""
    template_counts = (
        select(BotTemplate.strategy_id, func.count(BotTemplate.id).label("template_count"))
        .where(BotTemplate.strategy_id.is_not(None))
        .group_by(BotTemplate.strategy_id)
        .subquery()
    )
    instance_counts = (
        select(BotInstance.strategy_id, func.count(BotInstance.id).label("instance_count"))
        .where(BotInstance.strategy_id.is_not(None))
        .group_by(BotInstance.strategy_id)
        .subquery()
    )
    backtest_counts = (
        select(BotBacktest.strategy_id, func.count(BotBacktest.id).label("backtest_count"))
        .group_by(BotBacktest.strategy_id)
        .subquery()
    )
    query = (
        select(
            BotStrategy,
            func.coalesce(template_counts.c.template_count, 0),
            func.coalesce(instance_counts.c.instance_count, 0),
            func.coalesce(backtest_counts.c.backtest_count, 0),
        )
        .outerjoin(template_counts, template_counts.c.strategy_id == BotStrategy.id)
        .outerjoin(instance_counts, instance_counts.c.strategy_id == BotStrategy.id)
        .outerjoin(backtest_counts, backtest_counts.c.strategy_id == BotStrategy.id)
        .order_by(BotStrategy.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(BotStrategy.status == status_filter)
    result = await db.execute(query)
    return [
        _strategy_response(
            strategy,
            template_count=int(template_count or 0),
            instance_count=int(instance_count or 0),
            backtest_count=int(backtest_count or 0),
        )
        for strategy, template_count, instance_count, backtest_count in result.all()
    ]


@admin_router.get("/indicators", response_model=list[BotIndicatorResponse])
async def list_admin_bot_indicators(
    _superuser: SuperUser,
    db: DBSession,
    category: Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
) -> list[BotIndicatorResponse]:
    """List technical indicators available to the admin strategy builder."""
    query = select(BotIndicator).order_by(BotIndicator.category, BotIndicator.sort_order, BotIndicator.name)
    if category:
        query = query.where(BotIndicator.category == category)
    if active_only:
        query = query.where(BotIndicator.status == "active")
    result = await db.execute(query)
    return [_indicator_response(indicator) for indicator in result.scalars().all()]


@admin_router.post("/strategies", response_model=BotStrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_bot_strategy(
    data: BotStrategyCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotStrategyResponse:
    """Create a reusable strategy for bot products."""
    await _ensure_strategy_indicators_exist(db, data.indicator_config)
    strategy = BotStrategy(
        id=uuid4(),
        name=data.name,
        slug=data.slug.strip().lower(),
        description=data.description,
        type=data.type,
        status=data.status,
        market_config=data.market_config,
        indicator_config=data.indicator_config,
        rule_config=data.rule_config,
        risk_defaults=data.risk_defaults,
        created_by_user_id=superuser.id,
    )
    db.add(strategy)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot strategy slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_strategy",
        resource_id=strategy.id,
        description="Platform admin created bot strategy",
        metadata={"slug": strategy.slug, "status": strategy.status.value},
        request=request,
    )
    return _strategy_response(strategy)


@admin_router.patch("/strategies/{strategy_id}", response_model=BotStrategyResponse)
async def update_admin_bot_strategy(
    strategy_id: UUID,
    data: BotStrategyUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotStrategyResponse:
    """Update a reusable strategy."""
    result = await db.execute(select(BotStrategy).where(BotStrategy.id == strategy_id).with_for_update())
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    update_data = data.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"] is not None:
        update_data["slug"] = update_data["slug"].strip().lower()
    if "indicator_config" in update_data and update_data["indicator_config"] is not None:
        await _ensure_strategy_indicators_exist(db, update_data["indicator_config"])
    for field, value in update_data.items():
        setattr(strategy, field, value)
    if update_data:
        strategy.version += 1
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot strategy slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_strategy",
        resource_id=strategy.id,
        description="Platform admin updated bot strategy",
        metadata={"updated_fields": list(update_data.keys()), "version": strategy.version},
        request=request,
    )
    return _strategy_response(strategy)


@admin_router.post("/strategies/{strategy_id}/backtests", response_model=BotBacktestResponse)
async def run_admin_bot_strategy_backtest(
    strategy_id: UUID,
    data: BotBacktestCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotBacktestResponse:
    """Run a strategy backtest against stored price history."""
    strategy = await db.get(BotStrategy, strategy_id)
    if strategy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    engine = BotEngineService(db)
    backtest = await engine.run_backtest(
        strategy=strategy,
        name=data.name or f"{strategy.name} - {data.symbol.upper()}",
        symbol=data.symbol,
        timeframe=data.timeframe,
        initial_capital_usd=Decimal(str(data.initial_capital_usd)),
        period_start=data.period_start,
        period_end=data.period_end,
        user_id=superuser.id,
    )
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_backtest",
        resource_id=backtest.id,
        description="Platform admin ran bot strategy backtest",
        metadata={"strategy_id": strategy_id, "symbol": data.symbol.upper(), "status": backtest.status.value},
        request=request,
    )
    return _backtest_response(backtest)


@admin_router.get("/backtests", response_model=list[BotBacktestResponse])
async def list_admin_bot_backtests(
    _superuser: SuperUser,
    db: DBSession,
    strategy_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
) -> list[BotBacktestResponse]:
    """List recent platform backtests."""
    query = select(BotBacktest).order_by(BotBacktest.created_at.desc()).limit(limit)
    if strategy_id is not None:
        query = query.where(BotBacktest.strategy_id == strategy_id)
    result = await db.execute(query)
    return [_backtest_response(backtest) for backtest in result.scalars().all()]


@admin_router.get("/templates", response_model=list[BotTemplateResponse])
async def list_admin_bot_templates(
    _superuser: SuperUser,
    db: DBSession,
    status_filter: Optional[BotTemplateStatus] = Query(default=None, alias="status"),
) -> list[BotTemplateResponse]:
    """List platform bot products with aggregate usage counts."""
    active_counts = (
        select(BotInstance.template_id, func.count(BotInstance.id).label("active_count"))
        .where(BotInstance.status == BotInstanceStatus.ACTIVE)
        .group_by(BotInstance.template_id)
        .subquery()
    )
    total_counts = (
        select(BotInstance.template_id, func.count(BotInstance.id).label("total_count"))
        .group_by(BotInstance.template_id)
        .subquery()
    )
    query = (
        select(
            BotTemplate,
            func.coalesce(active_counts.c.active_count, 0),
            func.coalesce(total_counts.c.total_count, 0),
        )
        .outerjoin(active_counts, active_counts.c.template_id == BotTemplate.id)
        .outerjoin(total_counts, total_counts.c.template_id == BotTemplate.id)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .order_by(BotTemplate.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(BotTemplate.status == status_filter)
    result = await db.execute(query)
    return [
        _template_response(
            template,
            active_instance_count=int(active_count or 0),
            total_instance_count=int(total_count or 0),
        )
        for template, active_count, total_count in result.all()
    ]


@admin_router.post("/templates", response_model=BotTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_bot_template(
    data: AdminBotTemplateCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotTemplateResponse:
    """Create a bot product in the platform catalog."""
    if data.strategy_id is not None:
        strategy = await db.get(BotStrategy, data.strategy_id)
        if strategy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    template = BotTemplate(
        id=uuid4(),
        name=data.name,
        slug=data.slug.strip().lower(),
        description=data.description,
        type=data.type,
        status=data.status,
        required_plan=data.required_plan,
        requires_trade_permission=data.requires_trade_permission,
        supported_exchanges=data.supported_exchanges,
        supported_assets=data.supported_assets,
        default_parameters=data.default_parameters,
        risk_notes=data.risk_notes,
        strategy_id=data.strategy_id,
        created_by_user_id=superuser.id,
    )
    _replace_template_parameters(template, data.parameters)
    db.add(template)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot template slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_template",
        resource_id=template.id,
        description="Platform admin created bot template",
        metadata={"slug": template.slug, "status": template.status.value},
        request=request,
    )
    return _template_response(await _load_template_for_response(db, template.id))


@admin_router.patch("/templates/{template_id}", response_model=BotTemplateResponse)
async def update_admin_bot_template(
    template_id: UUID,
    data: AdminBotTemplateUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotTemplateResponse:
    """Update a platform bot product."""
    result = await db.execute(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.id == template_id)
        .with_for_update()
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot template not found")

    update_data = data.model_dump(exclude_unset=True)
    parameters = update_data.pop("parameters", None)
    affected_instance_count = 0
    if "slug" in update_data and update_data["slug"] is not None:
        update_data["slug"] = update_data["slug"].strip().lower()
    if "strategy_id" in update_data and update_data["strategy_id"] is not None:
        strategy = await db.get(BotStrategy, update_data["strategy_id"])
        if strategy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    for field, value in update_data.items():
        setattr(template, field, value)
    if parameters is not None:
        affected_instance_count = int(
            await db.scalar(
                select(func.count(BotInstance.id)).where(
                    BotInstance.template_id == template.id,
                    BotInstance.status != BotInstanceStatus.DISABLED,
                )
            )
            or 0
        )
        _replace_template_parameters(template, parameters)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot template slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_template",
        resource_id=template.id,
        description="Platform admin updated bot template",
        metadata={
            "updated_fields": list(update_data.keys()) + (["parameters"] if parameters is not None else []),
            "parameter_replacement": parameters is not None,
            "affected_instances": affected_instance_count,
            "parameter_keys": [
                parameter.key if isinstance(parameter, BotTemplateParameterCreate) else parameter.get("key")
                for parameter in parameters
            ]
            if parameters is not None
            else None,
        },
        request=request,
    )
    return _template_response(await _load_template_for_response(db, template.id))


@admin_router.get("/instances", response_model=list[BotInstanceResponse])
async def list_admin_bot_instances(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> list[BotInstanceResponse]:
    """List customer bot activations across the platform."""
    query = (
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .order_by(BotInstance.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(BotInstance.organization_id == organization_id)
    result = await db.execute(query)
    return [_instance_response(instance) for instance in result.scalars().unique().all()]


@admin_router.patch("/instances/{instance_id}", response_model=BotInstanceResponse)
async def update_admin_bot_instance(
    instance_id: UUID,
    data: AdminBotInstanceUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Operationally pause, disable, or mark a customer bot instance."""
    result = await db.execute(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.id == instance_id)
        .with_for_update()
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        _apply_status_timestamps(instance, update_data["status"])
        instance.status = update_data["status"]
    if "last_error" in update_data:
        instance.last_error = update_data["last_error"]
    await db.flush()
    await record_audit_event(
        db,
        organization_id=instance.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Platform admin updated bot instance",
        metadata={"updated_fields": list(update_data.keys())},
        request=request,
    )
    return _instance_response(instance)
