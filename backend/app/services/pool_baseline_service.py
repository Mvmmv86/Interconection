"""Service for pool position baselines (IL/HODL fallback)."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pool_position_baseline import PoolPositionBaseline, BaselineSource
from app.schemas.pool_baseline import PoolBaselineUpsert


# A re-snapshot is triggered when the absolute USD value changes by more
# than this fraction (5%) from the stored baseline. This catches the
# case where the user adds liquidity to an existing position, which
# would otherwise show as a fake gain.
RESNAPSHOT_THRESHOLD = Decimal("0.05")


class PoolBaselineService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_wallet(
        self,
        organization_id: UUID,
        wallet_address: Optional[str] = None,
    ) -> List[PoolPositionBaseline]:
        """Return baselines scoped to the org, optionally filtered by wallet."""
        query = select(PoolPositionBaseline).where(
            PoolPositionBaseline.organization_id == organization_id
        )
        if wallet_address:
            query = query.where(PoolPositionBaseline.wallet_address == wallet_address)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_one(
        self,
        organization_id: UUID,
        wallet_address: str,
        position_key: str,
    ) -> Optional[PoolPositionBaseline]:
        result = await self.db.execute(
            select(PoolPositionBaseline).where(
                PoolPositionBaseline.organization_id == organization_id,
                PoolPositionBaseline.wallet_address == wallet_address,
                PoolPositionBaseline.position_key == position_key,
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        organization_id: UUID,
        payload: PoolBaselineUpsert,
    ) -> tuple[PoolPositionBaseline, str]:
        """Insert if missing; update if existing baseline differs by > 5%
        OR if the new entry has higher-quality source than the stored one
        (e.g., subgraph_history overrides first_observed).

        Returns (row, action) where action is one of:
        - 'created'
        - 'updated_resnapshot' (value drifted >5%)
        - 'updated_upgraded'   (better source replaced weaker one)
        - 'unchanged'
        """
        existing = await self.get_one(
            organization_id, payload.wallet_address, payload.position_key
        )

        # Source priority — higher number wins
        source_rank = {
            BaselineSource.FIRST_OBSERVED: 1,
            BaselineSource.MANUAL: 2,
            BaselineSource.SUBGRAPH_HISTORY: 3,
        }

        if existing is None:
            row = PoolPositionBaseline(
                id=uuid4(),
                organization_id=organization_id,
                wallet_address=payload.wallet_address,
                position_key=payload.position_key,
                protocol=payload.protocol,
                chain=payload.chain,
                token0_symbol=payload.token0_symbol,
                token1_symbol=payload.token1_symbol,
                token0_amount=payload.token0_amount,
                token1_amount=payload.token1_amount,
                token0_price_usd=payload.token0_price_usd,
                token1_price_usd=payload.token1_price_usd,
                baseline_value_usd=payload.baseline_value_usd,
                baseline_at=payload.baseline_at,
                source=payload.source,
                resnapshot_count=0,
            )
            self.db.add(row)
            await self.db.flush()
            return row, "created"

        # Upgrade if incoming source is strictly better
        incoming_rank = source_rank.get(payload.source, 0)
        existing_rank = source_rank.get(existing.source, 0)
        if incoming_rank > existing_rank:
            existing.token0_amount = payload.token0_amount
            existing.token1_amount = payload.token1_amount
            existing.token0_price_usd = payload.token0_price_usd
            existing.token1_price_usd = payload.token1_price_usd
            existing.baseline_value_usd = payload.baseline_value_usd
            existing.baseline_at = payload.baseline_at
            existing.source = payload.source
            await self.db.flush()
            return existing, "updated_upgraded"

        # Re-snapshot if value drifted more than threshold (e.g., user
        # added liquidity). Only meaningful when source quality is equal
        # — never overwrite a subgraph-derived baseline with first-observed.
        if incoming_rank == existing_rank and existing.baseline_value_usd > 0:
            drift = abs(payload.baseline_value_usd - existing.baseline_value_usd) / existing.baseline_value_usd
            if drift > RESNAPSHOT_THRESHOLD:
                existing.token0_amount = payload.token0_amount
                existing.token1_amount = payload.token1_amount
                existing.token0_price_usd = payload.token0_price_usd
                existing.token1_price_usd = payload.token1_price_usd
                existing.baseline_value_usd = payload.baseline_value_usd
                existing.baseline_at = payload.baseline_at
                existing.resnapshot_count = (existing.resnapshot_count or 0) + 1
                await self.db.flush()
                return existing, "updated_resnapshot"

        return existing, "unchanged"
