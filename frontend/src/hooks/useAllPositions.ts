'use client';

import { useMemo } from 'react';
import { useMultiWalletDeFiPositions } from './defi';
import { useExchangePositions } from './useExchangePositions';
import { useExchangeLivePositions } from './useExchangeLivePositions';
import type { ExchangeLiveData } from './useExchangeDetail';
import { useSolanaWalletBalances } from './useSolanaWalletBalances';
import { useWallet, formatAddress } from '@/contexts/wallet-context';
import {
  UnifiedPosition,
  PositionsSummary,
  DistributionByType,
  DistributionByChain,
  ExchangeData,
  ProtocolData,
  WalletData,
  StakingData,
  AllPositionsData,
  PositionCategory,
  PositionLocationType,
  CHAIN_COLORS,
  CATEGORY_COLORS,
} from '@/types/positions';
import { NormalizedDeFiPosition } from '@/lib/defi';

/**
 * Map DeFi position category to unified category
 */
function mapDeFiCategoryToUnified(
  category: string,
  _positionType?: string // eslint-disable-line @typescript-eslint/no-unused-vars
): PositionCategory {
  switch (category) {
    case 'lending':
    case 'yield':
      return 'defi';
    case 'lp':
      return 'pools';
    case 'staking':
      return 'staking';
    case 'wallet':
      return 'spot';
    default:
      return 'other';
  }
}

/**
 * Convert DeFi position to unified position format
 */
function convertDeFiToUnified(
  position: NormalizedDeFiPosition,
  totalValue: number
): UnifiedPosition {
  return {
    id: position.id,
    asset: position.asset.name,
    symbol: position.asset.symbol,
    icon: position.asset.icon,
    quantity: position.quantity,
    currentPrice: position.priceUsd,
    value: position.valueUsd,
    allocation: totalValue > 0 ? (position.valueUsd / totalValue) * 100 : 0,
    location: position.protocol,
    locationType: position.category === 'staking' ? 'staking' : 'defi',
    chain: position.chain,
    chainId: position.chainId,
    category: mapDeFiCategoryToUnified(position.category, position.positionType),
    protocol: position.protocol,
    protocolIcon: position.protocolIcon,
    positionType: position.positionType,
    apy: position.apy?.total,
    pnl: position.change24h?.absolute,
    pnlPercent: position.change24h?.percent,
    updatedAt: position.updatedAt,
  };
}

/**
 * Get chain color from chain name
 */
function getChainColor(chain: string): string {
  const normalizedChain = chain.toLowerCase();
  return CHAIN_COLORS[normalizedChain] || CHAIN_COLORS['default'];
}

/**
 * Hook to aggregate all positions from different sources
 * Combines DeFi positions (EVM + Solana), Solana wallet tokens, and Exchange positions
 */
export function useAllPositions(): AllPositionsData {
  // Wallet context for Solana wallet info
  const { solanaWallet, isSolanaConnected } = useWallet();

  // ═══════════════════════════════════════════
  // DeFi positions from all wallets (EVM via Zerion + Solana via Zerion + Helius fallback)
  // ═══════════════════════════════════════════
  const {
    positions: defiPositions,
    summary: defiSummary,
    solanaPositions: solanaDeFiPositions,
    isLoading: isLoadingDefi,
    isError,
    error,
    refetch: refetchDefi,
  } = useMultiWalletDeFiPositions();

  // ═══════════════════════════════════════════
  // Solana wallet token balances (spot holdings on Solana)
  // ═══════════════════════════════════════════
  const {
    balances: solanaBalances,
    isLoading: isLoadingSolanaBalances,
    refetch: refetchSolanaBalances,
  } = useSolanaWalletBalances();

  // ═══════════════════════════════════════════
  // Exchange positions summary from backend
  // ═══════════════════════════════════════════
  const {
    exchanges: exchangeAccounts,
    isLoading: isLoadingExchanges,
    refresh: refreshExchanges,
  } = useExchangePositions();

  // Live detailed data from each exchange (futures with P&L, spot with qty/price)
  const {
    liveDataByExchange,
    isLoading: isLoadingLive,
    refresh: refreshLive,
  } = useExchangeLivePositions(exchangeAccounts);

  // ═══════════════════════════════════════════
  // Convert Solana wallet tokens to unified positions (spot on Solana)
  // Exclude tokens that are already DeFi positions (e.g., mSOL, bSOL)
  // ═══════════════════════════════════════════
  const solanaWalletPositions = useMemo<UnifiedPosition[]>(() => {
    if (!isSolanaConnected || !solanaWallet || solanaBalances.tokens.length === 0) {
      return [];
    }

    // Build set of symbols already in Solana DeFi positions to avoid duplicates
    const defiSymbols = new Set(
      solanaDeFiPositions.map(p => p.asset.symbol.toLowerCase())
    );

    const walletLabel = solanaWallet.label || formatAddress(solanaWallet.address);

    return solanaBalances.tokens
      .filter(token => {
        // Skip tokens already tracked as DeFi positions
        if (defiSymbols.has(token.symbol.toLowerCase())) return false;
        // Skip dust (< $1)
        if (token.valueUsd < 1) return false;
        return true;
      })
      .map(token => ({
        id: `solana-wallet-${token.symbol}-${token.address || 'native'}`,
        asset: token.name,
        symbol: token.symbol,
        icon: token.icon,
        quantity: token.balance,
        currentPrice: token.priceUsd,
        value: token.valueUsd,
        allocation: 0, // Will be recalculated below
        location: walletLabel,
        locationType: 'wallet' as PositionLocationType,
        chain: 'Solana',
        chainId: 'solana',
        category: 'spot' as PositionCategory,
        pnlPercent: token.change24h,
        updatedAt: new Date().toISOString(),
      }));
  }, [isSolanaConnected, solanaWallet, solanaBalances.tokens, solanaDeFiPositions]);

  // Total value of Solana wallet spot tokens (excluding DeFi)
  const solanaWalletTotal = useMemo(() => {
    return solanaWalletPositions.reduce((sum, p) => sum + p.value, 0);
  }, [solanaWalletPositions]);

  // Per-exchange decision: should we use live data or fall back to cached summary?
  // Treat live as broken when it returns essentially $0 but the cached summary
  // shows real value — happens when API keys expire/get revoked. Centralizing
  // this here ensures effectiveExchangeTotal and exchangeUnifiedPositions never
  // diverge (which would silently miscalculate allocation percentages).
  const effectiveByExchange = useMemo(() => {
    const map = new Map<string, { effectiveValue: number; liveData: ExchangeLiveData | undefined }>();
    for (const exchange of exchangeAccounts) {
      const liveDataRaw = liveDataByExchange.get(exchange.id);
      const liveDataIsBroken =
        liveDataRaw !== undefined &&
        liveDataRaw.totalValueUsd < 1 &&
        exchange.totalValue > 100;
      const liveData = liveDataIsBroken ? undefined : liveDataRaw;
      const effectiveValue = liveData?.totalValueUsd ?? exchange.totalValue;
      map.set(exchange.id, { effectiveValue, liveData });
    }
    return map;
  }, [exchangeAccounts, liveDataByExchange]);

  // Convert exchange live data to unified positions
  const exchangeUnifiedPositions = useMemo<UnifiedPosition[]>(() => {
    const positions: UnifiedPosition[] = [];

    for (const exchange of exchangeAccounts) {
      const decision = effectiveByExchange.get(exchange.id);
      const liveData = decision?.liveData;

      if (liveData) {
        // === SPOT BALANCES (with real quantity, price, 24h change) ===
        for (const bal of liveData.spotBalances) {
          if (bal.valueUsd < 1) continue;
          positions.push({
            id: `exchange-${exchange.id}-spot-${bal.asset}`,
            asset: bal.asset,
            symbol: bal.asset,
            quantity: bal.total,
            currentPrice: bal.priceUsd,
            value: bal.valueUsd,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'spot',
            accountType: 'spot',
            pnlPercent: bal.change24h,
            updatedAt: liveData.lastSync,
          });
        }

        const hasFuturesAccountBalance = liveData.futuresBalances.length > 0;

        // === FUTURES ACCOUNT BALANCES (real account equity) ===
        for (const bal of liveData.futuresBalances) {
          if (bal.valueUsd < 1) continue;
          positions.push({
            id: `exchange-${exchange.id}-${bal.accountType || 'futures-balance'}-${bal.asset}`,
            asset: bal.asset,
            symbol: bal.asset,
            quantity: bal.total,
            currentPrice: bal.priceUsd,
            value: bal.valueUsd,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'futures',
            accountType: bal.accountType || 'futures_balance',
            updatedAt: liveData.lastSync,
          });
        }

        // === FUTURES POSITIONS (with entry price, P&L, leverage, side) ===
        for (const fut of liveData.futuresPositions) {
          const futuresEquityValue = Math.max((fut.margin || 0) + (fut.unrealizedPnl || 0), 0);
          positions.push({
            id: `exchange-${exchange.id}-futures-${fut.symbol}`,
            asset: fut.symbol,
            symbol: fut.symbol.replace('USDT', '').replace('USD', '').replace('PERP', ''),
            quantity: fut.size,
            currentPrice: fut.markPrice,
            entryPrice: fut.entryPrice,
            value: hasFuturesAccountBalance ? 0 : futuresEquityValue,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'futures',
            accountType: 'futures',
            side: fut.side === 'Buy' ? 'long' : 'short',
            leverage: fut.leverage,
            unrealizedPnl: fut.unrealizedPnl,
            pnl: fut.unrealizedPnl,
            pnlPercent: fut.unrealizedPnlPercent,
            liquidationPrice: fut.liquidationPrice,
            updatedAt: liveData.lastSync,
          });
        }

        // === FUNDING BALANCES ===
        for (const bal of liveData.fundingBalances) {
          if (bal.valueUsd < 1) continue;
          positions.push({
            id: `exchange-${exchange.id}-funding-${bal.asset}`,
            asset: bal.asset,
            symbol: bal.asset,
            quantity: bal.total,
            currentPrice: bal.priceUsd,
            value: bal.valueUsd,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'funding',
            accountType: 'funding',
            updatedAt: liveData.lastSync,
          });
        }

        // === MARGIN BALANCES ===
        for (const bal of liveData.marginBalances) {
          if (bal.valueUsd < 1) continue;
          positions.push({
            id: `exchange-${exchange.id}-margin-${bal.asset}`,
            asset: bal.asset,
            symbol: bal.asset,
            quantity: bal.total,
            currentPrice: bal.priceUsd,
            value: bal.valueUsd,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'margin',
            accountType: 'margin',
            pnlPercent: bal.change24h,
            updatedAt: liveData.lastSync,
          });
        }

        // === EARN POSITIONS ===
        for (const earn of liveData.earnPositions) {
          if (earn.valueUsd < 1) continue;
          positions.push({
            id: `exchange-${exchange.id}-earn-${earn.productId}`,
            asset: earn.coin,
            symbol: earn.coin,
            quantity: earn.amount,
            currentPrice: earn.valueUsd / (earn.amount || 1),
            value: earn.valueUsd,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'earn',
            accountType: 'earn',
            apy: earn.apy,
            pnl: earn.totalPnl,
            positionType: earn.productType,
            updatedAt: liveData.lastSync,
          });
        }
      } else {
        // No live data yet - use summary data as fallback
        for (const asset of exchange.topAssets) {
          positions.push({
            id: `exchange-${exchange.id}-${asset.symbol}`,
            asset: asset.symbol,
            symbol: asset.symbol,
            quantity: 0,
            currentPrice: 0,
            value: asset.value,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'spot',
            accountType: 'spot',
            pnlPercent: asset.change,
            updatedAt: exchange.lastSync,
          });
        }

        const topAssetsValue = exchange.topAssets.reduce((sum, a) => sum + a.value, 0);
        const remainingSpot = exchange.spotValue - topAssetsValue;
        if (remainingSpot > 10) {
          positions.push({
            id: `exchange-${exchange.id}-other-spot`,
            asset: 'Other Assets',
            symbol: 'OTHER',
            quantity: 0,
            currentPrice: 0,
            value: remainingSpot,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'spot',
            accountType: 'spot',
          });
        }

        if (exchange.futuresValue > 0) {
          positions.push({
            id: `exchange-${exchange.id}-futures`,
            asset: 'Futures Positions',
            symbol: 'FUTURES',
            quantity: 0,
            currentPrice: 0,
            value: exchange.futuresValue,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'futures',
            accountType: 'futures',
          });
        }

        if (exchange.marginValue > 0) {
          positions.push({
            id: `exchange-${exchange.id}-margin`,
            asset: 'Margin Positions',
            symbol: 'MARGIN',
            quantity: 0,
            currentPrice: 0,
            value: exchange.marginValue,
            allocation: 0,
            location: exchange.name,
            locationType: 'exchange',
            chain: 'CEX',
            category: 'margin',
            accountType: 'margin',
          });
        }
      }
    }

    return positions;
  }, [exchangeAccounts, effectiveByExchange]);

  // Sum per-exchange effective values from the same decision used to build
  // exchangeUnifiedPositions. This guarantees the displayed total and the
  // sum of position values are always consistent, so allocation percentages
  // never miscalculate when one exchange has a broken API key and another
  // is healthy.
  const effectiveExchangeTotal = useMemo(() => {
    let total = 0;
    effectiveByExchange.forEach(({ effectiveValue }) => {
      total += effectiveValue;
    });
    return total;
  }, [effectiveByExchange]);

  // Calculate unified positions
  const positions = useMemo<UnifiedPosition[]>(() => {
    const totalDefiValue = defiSummary.totalValueUsd;
    const totalValue = totalDefiValue + effectiveExchangeTotal + solanaWalletTotal;

    // Convert DeFi positions (EVM + Solana DeFi)
    const defiUnified = defiPositions.map((p) =>
      convertDeFiToUnified(p, totalValue)
    );

    // Recalculate allocations for exchange positions
    const exchangeWithAllocations = exchangeUnifiedPositions.map((p) => ({
      ...p,
      allocation: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
    }));

    // Recalculate allocations for Solana wallet positions
    const solanaWalletWithAllocations = solanaWalletPositions.map((p) => ({
      ...p,
      allocation: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
    }));

    // Combine and sort
    const unified = [...defiUnified, ...exchangeWithAllocations, ...solanaWalletWithAllocations];
    return unified.sort((a, b) => b.value - a.value);
  }, [defiPositions, defiSummary.totalValueUsd, exchangeUnifiedPositions, effectiveExchangeTotal, solanaWalletPositions, solanaWalletTotal]);

  // Calculate summary
  const summary = useMemo<PositionsSummary>(() => {
    const totalDefiValue = defiSummary.totalValueUsd;
    const totalValue = totalDefiValue + effectiveExchangeTotal + solanaWalletTotal;

    const defiValue =
      defiSummary.lendingSupplyUsd +
      defiSummary.lpValueUsd +
      defiSummary.yieldValueUsd +
      (defiSummary.otherValueUsd ?? 0);

    const stakingValue = defiSummary.stakingValueUsd;

    const protocolSet = new Set(
      positions.filter((p) => p.protocol).map((p) => p.protocol)
    );

    return {
      totalValue,
      exchangeHoldings: effectiveExchangeTotal,
      defiPositions: defiValue,
      stakingAndYield: stakingValue + defiSummary.yieldValueUsd,
      coldWallets: solanaWalletTotal,
      totalPositionCount: positions.length,
      exchangeCount: exchangeAccounts.length,
      protocolCount: protocolSet.size,
      walletCount: isSolanaConnected ? 1 : 0,
      avgApy: defiSummary.weightedAvgApy,
    };
  }, [defiSummary, positions, effectiveExchangeTotal, exchangeAccounts.length, solanaWalletTotal, isSolanaConnected]);

  // Calculate distribution by type
  const distributionByType = useMemo<DistributionByType[]>(() => {
    const totalValue = summary.totalValue;
    if (totalValue === 0) return [];

    const typeValues: Record<string, number> = {
      spot: 0, defi: 0, staking: 0, pools: 0, futures: 0,
      earn: 0, funding: 0, margin: 0, other: 0,
    };

    for (const position of positions) {
      const cat = position.category;
      if (cat in typeValues) {
        typeValues[cat] += position.value;
      } else {
        typeValues['other'] += position.value;
      }
    }

    const labelMap: Record<string, string> = {
      spot: 'Spot Holdings', defi: 'DeFi/Lending', staking: 'Staking',
      pools: 'Liquidity Pools', futures: 'Futures', earn: 'Earn/Yield',
      funding: 'Funding', margin: 'Margin', other: 'Others',
    };

    return Object.entries(typeValues)
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) => ({
        label: labelMap[key] || key,
        value: (amount / totalValue) * 100,
        amount,
        color: CATEGORY_COLORS[key as PositionCategory] || CATEGORY_COLORS.other,
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, summary.totalValue]);

  // Calculate distribution by chain
  const distributionByChain = useMemo<DistributionByChain[]>(() => {
    const totalValue = summary.totalValue;
    if (totalValue === 0) return [];

    const chainValues: Record<string, { amount: number; chainId: string }> = {};

    for (const position of positions) {
      const chain = position.chain;
      if (!chainValues[chain]) {
        chainValues[chain] = { amount: 0, chainId: position.chainId || chain };
      }
      chainValues[chain].amount += position.value;
    }

    return Object.entries(chainValues)
      .map(([chain, data]) => ({
        label: chain,
        chainId: data.chainId,
        value: (data.amount / totalValue) * 100,
        amount: data.amount,
        color: getChainColor(chain),
      }))
      .sort((a, b) => b.value - a.value);
  }, [positions, summary.totalValue]);

  // Group by protocol for DeFi protocols card
  const protocols = useMemo<ProtocolData[]>(() => {
    const protocolMap = new Map<string, ProtocolData>();

    for (const position of positions) {
      if (position.locationType === 'defi' || position.locationType === 'staking') {
        const protocol = position.protocol || position.location;

        if (!protocolMap.has(protocol)) {
          protocolMap.set(protocol, {
            id: protocol, name: protocol, icon: position.protocolIcon,
            chains: [], totalValue: 0, positionCount: 0, positions: [],
          });
        }

        const data = protocolMap.get(protocol)!;
        data.totalValue += position.value;
        data.positionCount += 1;

        if (position.chain && !data.chains.includes(position.chain)) {
          data.chains.push(position.chain);
        }

        data.positions.push({
          type: position.positionType || position.category,
          asset: position.symbol,
          value: position.value,
          apy: position.apy,
        });
      }
    }

    return Array.from(protocolMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [positions]);

  // Staking positions
  const stakingPositions = useMemo<StakingData[]>(() => {
    return positions
      .filter((p) => p.category === 'staking')
      .map((p) => ({
        id: p.id,
        protocol: p.protocol || p.location,
        protocolIcon: p.protocolIcon,
        source: (p.locationType === 'exchange' ? 'exchange' : 'dex') as 'exchange' | 'dex' | 'native',
        asset: p.asset,
        symbol: p.symbol,
        stakedAmount: p.quantity,
        stakedValue: p.value,
        apy: p.apy,
        chain: p.chain,
      }));
  }, [positions]);

  // Build exchange data for the Exchanges card
  const exchanges = useMemo<ExchangeData[]>(() => {
    return exchangeAccounts.map((ex) => {
      const liveData = liveDataByExchange.get(ex.id);
      return {
        id: ex.id,
        name: ex.name,
        logo: ex.logo,
        status: ex.status === 'pending' ? 'disconnected' as const : ex.status as ExchangeData['status'],
        lastSync: ex.lastSync,
        totalValue: liveData?.totalValueUsd ?? ex.totalValue,
        spotValue: liveData?.totalSpotUsd ?? ex.spotValue,
        marginValue: liveData?.totalMarginUsd ?? ex.marginValue,
        futuresValue: liveData?.totalFuturesUsd ?? ex.futuresValue,
        fundingValue: liveData?.totalFundingUsd,
        earnValue: liveData?.totalEarnUsd,
        positionCount: ex.positions,
        hasSubaccounts: liveData ? liveData.subaccounts.length > 0 : undefined,
        subaccountsCount: liveData?.subaccounts.length,
        subaccountsValue: liveData?.totalSubaccountsValue,
        topAssets: ex.topAssets.map((a) => ({ symbol: a.symbol, value: a.value })),
      };
    });
  }, [exchangeAccounts, liveDataByExchange]);

  // Build wallets data (Solana wallet + future EVM wallets)
  const wallets = useMemo<WalletData[]>(() => {
    const result: WalletData[] = [];

    if (isSolanaConnected && solanaWallet && solanaBalances.totalValueUsd > 0) {
      result.push({
        id: solanaWallet.address,
        address: solanaWallet.address,
        name: solanaWallet.label || 'Solana Wallet',
        type: 'hot',
        chain: 'Solana',
        totalValue: solanaBalances.totalValueUsd,
        positionCount: solanaBalances.totalTokens,
        topAssets: solanaBalances.topAssets.map(a => ({
          symbol: a.symbol,
          value: a.valueUsd,
        })),
      });
    }

    return result;
  }, [isSolanaConnected, solanaWallet, solanaBalances]);

  const filterByType = (type: PositionCategory | 'all'): UnifiedPosition[] => {
    if (type === 'all') return positions;
    return positions.filter((p) => p.category === type);
  };

  const filterByChain = (chain: string | 'all'): UnifiedPosition[] => {
    if (chain === 'all') return positions;
    return positions.filter((p) => p.chain.toLowerCase() === chain.toLowerCase());
  };

  const filterByLocation = (locationType: PositionLocationType | 'all'): UnifiedPosition[] => {
    if (locationType === 'all') return positions;
    return positions.filter((p) => p.locationType === locationType);
  };

  const refetch = () => {
    refetchDefi();
    refetchSolanaBalances();
    refreshExchanges();
    refreshLive();
  };

  return {
    positions,
    summary,
    distributionByType,
    distributionByChain,
    exchanges,
    protocols,
    wallets,
    stakingPositions,
    isLoading: isLoadingDefi || isLoadingExchanges,
    isLoadingExchanges: isLoadingExchanges || isLoadingLive,
    isLoadingDefi,
    isLoadingWallets: isLoadingSolanaBalances,
    error: isError ? (error as Error) : null,
    refetch,
    filterByType,
    filterByChain,
    filterByLocation,
  };
}

export default useAllPositions;
