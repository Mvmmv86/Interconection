"""Main API v1 router."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    team,
    clients,
    wallets,
    exchanges,
    positions,
    portfolio,
    analytics,
    alerts,
    assets,
    manual_assets,
    staking_positions,
    pool_positions,
    pool_baselines,
    ai,
    risk_thresholds,
    notifications,
    wallet_data,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(team.router, prefix="/team", tags=["Team"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(wallets.router, prefix="/clients/{client_id}/wallets", tags=["Wallets"])
api_router.include_router(exchanges.router, prefix="/clients/{client_id}/exchanges", tags=["Exchanges"])
api_router.include_router(exchanges.exchange_positions_router, prefix="/exchanges", tags=["Exchange Positions"])
api_router.include_router(manual_assets.router, prefix="/clients/{client_id}/manual-assets", tags=["Manual Assets"])
api_router.include_router(positions.router, prefix="/positions", tags=["Positions"])
api_router.include_router(staking_positions.router, prefix="/staking", tags=["Staking Positions"])
api_router.include_router(pool_positions.router, prefix="/pools", tags=["Pool Positions"])
api_router.include_router(pool_baselines.router, prefix="/pool-baselines", tags=["Pool Baselines"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
# New endpoints
api_router.include_router(ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(risk_thresholds.router, prefix="/risk-thresholds", tags=["Risk Thresholds"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(wallet_data.router, prefix="/wallets", tags=["Wallet Data"])
