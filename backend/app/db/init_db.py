"""Database initialization utilities."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.session import engine


async def create_tables() -> None:
    """Create all database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables() -> None:
    """Drop all database tables (use with caution!)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def init_db(db: AsyncSession) -> None:
    """Initialize database with required data."""
    # Add any initial data seeding here
    pass
