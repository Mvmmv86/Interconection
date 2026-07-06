"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Interconection"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/interconection"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Security
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:3003"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    # Bot scheduler
    bot_scheduler_enabled: bool = False
    bot_scheduler_interval_seconds: int = 60
    bot_scheduler_batch_limit: int = 50
    bot_scheduler_candle_limit: int = 300
    bot_market_scanner_enabled: bool = False
    bot_market_scanner_interval_seconds: int = 900
    bot_market_scanner_exchange: str = "bingx"
    bot_market_scanner_market_type: str = "futures"
    bot_market_scanner_quote_asset: str = "USDT"
    bot_market_scanner_universe_limit: int = 120
    bot_market_scanner_candle_symbol_limit: int = 120
    bot_market_scanner_top_n: int = 50

    # External APIs
    coingecko_api_key: str = ""
    infura_api_key: str = ""
    alchemy_api_key: str = ""
    helius_api_key: str = ""
    zerion_api_key: str = ""

    # Email
    mail_server: str = ""
    mail_port: int = 587
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""

    # Encryption
    encryption_key: str = ""

    # RBAC rollout flags
    # Legacy flow is active while these are false.
    # Turn on only after endpoint-by-endpoint validation.
    rbac_enforcement_v1: bool = False
    rbac_scope_specific: bool = False
    # Optional comma-separated endpoint keys enabled for each flag.
    # Example: "exchanges,clients,wallets"
    rbac_enforcement_v1_endpoints: str = ""
    rbac_scope_specific_endpoints: str = ""

    @property
    def rbac_enforcement_v1_routes(self) -> set[str]:
        """Return normalized route keys enabled for RBAC enforcement."""
        raw = self.rbac_enforcement_v1_endpoints or ""
        return {route.strip().lower() for route in raw.split(",") if route.strip()}

    @property
    def rbac_scope_specific_routes(self) -> set[str]:
        """Return normalized route keys enabled for scope-specific enforcement."""
        raw = self.rbac_scope_specific_endpoints or ""
        return {route.strip().lower() for route in raw.split(",") if route.strip()}

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
