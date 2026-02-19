'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  Layers,
  TrendingUp,
  AlertTriangle,
  Plus,
  ChevronRight,
  Droplets,
  LayoutGrid,
  Globe,
  Wallet,
  RefreshCw,
  Loader2,
  CheckCircle,
  Link2,
  ExternalLink,
  Landmark,
  Gift,
  ChartLine,
  Percent,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Activity,
  SortAsc,
  SortDesc,
  Search,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoolDiscovery } from '@/components/defi/pools';
import { useWallet, formatAddress } from '@/contexts/wallet-context';
import { useMultiWalletDeFiPositions, usePoolDiscovery } from '@/hooks/defi';
import { WalletConnectModal } from '@/components/wallet';
import { useTheme } from '@/contexts/theme-context';
import type { NormalizedDeFiPosition, DeFiCategory } from '@/lib/defi';
import { formatApy } from '@/lib/defi';

type ViewTab = 'all' | 'lending' | 'lp' | 'staking' | 'yield' | 'other' | 'discover';
type SortOption = 'value' | 'apy' | 'name';
type SortDirection = 'asc' | 'desc';

// Chain colors
const CHAIN_COLORS: Record<string, string> = {
  'ethereum': '#627eea',
  'base': '#0052ff',
  'arbitrum-one': '#28a0f0',
  'optimism': '#ff0420',
  'polygon': '#8247e5',
  'avalanche': '#e84142',
  'binance-smart-chain': '#f3ba2f',
};

// Category config
const categoryConfig: Record<DeFiCategory | 'all', { label: string; color: string; bg: string; icon: typeof Layers }> = {
  all: { label: 'All', color: 'text-white', bg: 'bg-white/10', icon: Globe },
  lending: { label: 'Lending', color: 'text-accent-blue', bg: 'bg-accent-blue/10', icon: Landmark },
  lp: { label: 'LP Pools', color: 'text-accent-purple', bg: 'bg-accent-purple/10', icon: Droplets },
  staking: { label: 'Staking', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10', icon: Layers },
  yield: { label: 'Yield', color: 'text-status-success', bg: 'bg-status-success/10', icon: TrendingUp },
  derivatives: { label: 'Derivatives', color: 'text-accent-orange', bg: 'bg-accent-orange/10', icon: ChartLine },
  claimable: { label: 'Claimable', color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', icon: Gift },
  other: { label: 'Other', color: 'text-white/50', bg: 'bg-white/5', icon: Layers },
};

function ApyBadge({ apy, isDark }: { apy?: NormalizedDeFiPosition['apy']; isDark: boolean }) {
  if (!apy || !apy.total) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 px-2 py-1 rounded-lg",
      apy.total > 20 ? "bg-status-success/15" : apy.total > 5 ? "bg-accent-purple/15" : "bg-white/5"
    )}>
      <Percent className={cn(
        "w-3 h-3",
        apy.total > 20 ? "text-status-success" : apy.total > 5 ? "text-accent-purple" : isDark ? "text-white/50" : "text-gray-500"
      )} />
      <span className={cn(
        "text-[11px] font-semibold tabular-nums",
        apy.total > 20 ? "text-status-success" : apy.total > 5 ? "text-accent-purple" : isDark ? "text-white" : "text-gray-900"
      )}>
        {formatApy(apy.total)}
      </span>
      {apy.hasRewards && (
        <Sparkles className="w-2.5 h-2.5 text-accent-yellow" />
      )}
    </div>
  );
}

// Health Factor indicator for lending positions
function HealthFactorBar({ ltv, isDark }: { ltv: number; isDark: boolean }) {
  // ltv is 0-1, we show health as inverse (higher ltv = lower health)
  // Health Factor simulation: if LTV is 0.8 (80%), health is low
  const healthPercent = Math.max(0, Math.min(100, (1 - ltv) * 100));
  const healthStatus = healthPercent > 50 ? 'healthy' : healthPercent > 25 ? 'warning' : 'danger';

  const colors = {
    healthy: { bar: 'bg-status-success', text: 'text-status-success' },
    warning: { bar: 'bg-accent-yellow', text: 'text-accent-yellow' },
    danger: { bar: 'bg-status-error', text: 'text-status-error' },
  };

  return (
    <div className="flex items-center gap-2 flex-1">
      <Shield className={cn("w-3 h-3", colors[healthStatus].text)} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>Health</span>
          <span className={cn("text-[9px] font-medium", colors[healthStatus].text)}>
            {healthPercent.toFixed(0)}%
          </span>
        </div>
        <div className={cn("h-1 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-gray-200")}>
          <div
            className={cn("h-full rounded-full transition-all", colors[healthStatus].bar)}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PositionCard({ position, isDark }: { position: NormalizedDeFiPosition; isDark: boolean }) {
  const category = categoryConfig[position.category] || categoryConfig.other;
  const chainColor = CHAIN_COLORS[position.chainId] || '#888';

  const annualYield = position.apy?.total
    ? (position.valueUsd * position.apy.total) / 100
    : null;

  return (
    <div
      className="rounded-xl p-4 transition-all hover:scale-[1.01]"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Protocol Icon */}
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
            {position.protocolIcon ? (
              <img src={position.protocolIcon} alt={position.protocol} className="w-6 h-6" />
            ) : (
              <span className={cn("text-[11px] font-bold", isDark ? "text-white/50" : "text-gray-500")}>
                {position.protocol.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn("text-[13px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                {position.protocol}
              </h3>
              <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-medium', category.bg, category.color)}>
                {category.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chainColor }} />
              <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>{position.chain}</span>
              {position.protocolUrl && (
                <a
                  href={position.protocolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("text-[10px] flex items-center gap-0.5", isDark ? "text-white/30 hover:text-white/50" : "text-gray-500 hover:text-gray-700")}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
            ${position.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {position.change24h && position.change24h.percent !== 0 && (
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums flex items-center justify-end gap-0.5',
                position.change24h.percent >= 0 ? 'text-status-success' : 'text-status-error'
              )}
            >
              {position.change24h.percent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(position.change24h.percent).toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Position Details */}
      <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {position.asset.icon && (
              <img src={position.asset.icon} alt={position.asset.symbol} className="w-5 h-5 rounded-full" />
            )}
            <div>
              <p className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                {position.positionName || position.asset.symbol}
              </p>
              <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {position.asset.symbol}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ApyBadge apy={position.apy} isDark={isDark} />
            {position.positionType === 'loan' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-error/10 text-status-error font-medium">
                Borrowed
              </span>
            )}
            {position.positionType === 'reward' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow font-medium">
                Claimable
              </span>
            )}
          </div>
        </div>

        {/* APY Breakdown (if available) */}
        {position.apy && position.apy.total > 0 && (
          <div className={cn("mt-2 pt-2 border-t flex items-center gap-4", isDark ? "border-white/5" : "border-gray-200")}>
            {position.apy.base > 0 && (
              <div className="flex items-center gap-1">
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>Base</span>
                <span className={cn("text-[9px] font-medium tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                  {formatApy(position.apy.base)}
                </span>
              </div>
            )}
            {position.apy.reward > 0 && (
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-accent-yellow" />
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>Rewards</span>
                <span className={cn("text-[9px] font-medium tabular-nums text-accent-yellow")}>
                  {formatApy(position.apy.reward)}
                </span>
              </div>
            )}
            {annualYield && annualYield > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>Est. Annual</span>
                <span className="text-[9px] font-medium tabular-nums text-status-success">
                  +${annualYield.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* LP specific data */}
        {position.lp && (
          <div className={cn("mt-2 pt-2 border-t flex items-center gap-4", isDark ? "border-white/5" : "border-gray-200")}>
            {position.lp.tvlUsd && (
              <div className="flex items-center gap-1">
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>TVL</span>
                <span className={cn("text-[9px] font-medium tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                  ${(position.lp.tvlUsd / 1e6).toFixed(2)}M
                </span>
              </div>
            )}
            {position.lp.volume24h && (
              <div className="flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 text-accent-blue" />
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>24h Vol</span>
                <span className={cn("text-[9px] font-medium tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                  ${(position.lp.volume24h / 1e3).toFixed(1)}K
                </span>
              </div>
            )}
            {position.lp.il7d !== undefined && position.lp.il7d !== null && (
              <div className="flex items-center gap-1">
                <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>IL 7d</span>
                <span className={cn(
                  "text-[9px] font-medium tabular-nums",
                  position.lp.il7d < 0 ? "text-status-error" : "text-status-success"
                )}>
                  {position.lp.il7d.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lending specific data */}
        {position.lending && (
          <div className={cn("mt-2 pt-2 border-t", isDark ? "border-white/5" : "border-gray-200")}>
            <div className="flex items-center gap-4">
              {position.lending.ltv !== undefined && position.lending.ltv !== null && (
                <HealthFactorBar ltv={position.lending.ltv} isDark={isDark} />
              )}
              {position.lending.ltv !== undefined && position.lending.ltv !== null && (
                <div className="flex items-center gap-1">
                  <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>LTV</span>
                  <span className={cn("text-[9px] font-medium tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                    {(position.lending.ltv * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {position.lending.borrowApy !== undefined && position.lending.borrowApy !== null && (
                <div className="flex items-center gap-1">
                  <span className={cn("text-[8px] uppercase", isDark ? "text-white/30" : "text-gray-400")}>Borrow APY</span>
                  <span className="text-[9px] font-medium tabular-nums text-status-error">
                    {formatApy(position.lending.borrowApy)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeFiPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState<'evm' | 'solana'>('evm');
  const [sortBy, setSortBy] = useState<SortOption>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Wallet hook
  const { evmWallet, solanaWallet, isEVMConnected, isSolanaConnected } = useWallet();

  // Check if any wallet is connected
  const hasAnyWallet = isEVMConnected || isSolanaConnected;

  // DeFi Positions from multiple wallets (EVM + Solana)
  const {
    positions,
    lendingPositions,
    lpPositions,
    stakingPositions,
    yieldPositions,
    otherPositions,
    summary,
    connectedWallets,
    isLoading,
    isLoadingApy,
    isError,
    error,
    refetch,
  } = useMultiWalletDeFiPositions();

  // Fetch real pool discovery data from DeFiLlama
  const { pools: discoveryPools, isLoading: isLoadingDiscovery } = usePoolDiscovery({
    minTvl: 100000, // Only pools with >$100k TVL
  });

  // Get positions based on active tab
  const getFilteredPositions = () => {
    let filtered: NormalizedDeFiPosition[] = [];

    switch (activeTab) {
      case 'lending':
        filtered = lendingPositions;
        break;
      case 'lp':
        filtered = lpPositions;
        break;
      case 'staking':
        filtered = stakingPositions;
        break;
      case 'yield':
        filtered = yieldPositions;
        break;
      case 'other':
        filtered = otherPositions ?? [];
        break;
      case 'all':
      default:
        filtered = positions;
    }

    // Apply chain filter
    if (chainFilter !== 'all') {
      filtered = filtered.filter(p => p.chainId === chainFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.protocol.toLowerCase().includes(query) ||
        p.asset.symbol.toLowerCase().includes(query) ||
        p.asset.name.toLowerCase().includes(query) ||
        p.chain.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'value':
          comparison = b.valueUsd - a.valueUsd;
          break;
        case 'apy':
          comparison = (b.apy?.total || 0) - (a.apy?.total || 0);
          break;
        case 'name':
          comparison = a.protocol.localeCompare(b.protocol);
          break;
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredPositions = getFilteredPositions();

  const openWalletModal = (tab: 'evm' | 'solana') => {
    setWalletModalTab(tab);
    setShowWalletModal(true);
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
          : '#ffffff',
      }}
    >
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.02) 0%, transparent 40%)
            `,
          }}
        />
      )}

      <Sidebar />

      <div className="pl-[200px] transition-all duration-300 relative z-10">
        <Header />

        <main className="p-5">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className={cn("flex items-center gap-2 text-[11px] mb-1", isDark ? "text-white/30" : "text-gray-500")}>
                <span>Positions</span>
                <ChevronRight className="w-3 h-3" />
                <span className={isDark ? "text-white/50" : "text-gray-600"}>DeFi</span>
              </div>
              <h1 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>DeFi Positions</h1>
              <p className={cn("text-[11px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>
                Todas suas posições em protocolos DeFi, lending, LP pools e staking
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors">
                <Plus className="w-4 h-4" />
                Add Position
              </button>
            </div>
          </div>

          {/* Wallet Connection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {/* EVM Wallet Card */}
            <div
              className="rounded-xl p-4"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                  : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#627eea]/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#627eea]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("text-[12px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                        EVM Wallet
                      </h3>
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded", isDark ? "bg-white/5 text-white/30" : "bg-gray-100 text-gray-500")}>
                        ETH, Base, Arbitrum...
                      </span>
                    </div>
                    {isEVMConnected && evmWallet ? (
                      <code className={cn("text-[10px] font-mono", isDark ? "text-white/30" : "text-gray-500")}>
                        {formatAddress(evmWallet.address, 8)}
                      </code>
                    ) : (
                      <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                        Zerion + 8000+ protocolos
                      </p>
                    )}
                  </div>
                </div>
                {isEVMConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success text-[9px] font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                    <button
                      onClick={() => openWalletModal('evm')}
                      className={cn("text-[10px]", isDark ? "text-white/30 hover:text-white" : "text-gray-500 hover:text-gray-900")}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openWalletModal('evm')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#627eea] text-white text-[10px] font-medium hover:bg-[#627eea]/90 transition-colors"
                  >
                    <Link2 className="w-3 h-3" />
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Solana Wallet Card */}
            <div
              className="rounded-xl p-4"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                  : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#9945FF]/10 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 128 128" fill="none">
                      <path d="M93.94 42.63a3.22 3.22 0 0 0-2.28-.94H24.28a1.61 1.61 0 0 0-1.14 2.75l13.13 13.13a3.22 3.22 0 0 0 2.28.94h67.38a1.61 1.61 0 0 0 1.14-2.75L93.94 42.63z" fill="url(#solana-gradient-1)"/>
                      <path d="M36.27 69.45a3.22 3.22 0 0 1 2.28-.94h67.38a1.61 1.61 0 0 1 1.14 2.75L93.94 84.39a3.22 3.22 0 0 1-2.28.94H24.28a1.61 1.61 0 0 1-1.14-2.75l13.13-13.13z" fill="url(#solana-gradient-2)"/>
                      <path d="M93.94 96.2a3.22 3.22 0 0 1-2.28.95H24.28a1.61 1.61 0 0 1-1.14-2.75l13.13-13.13a3.22 3.22 0 0 1 2.28-.94h67.38a1.61 1.61 0 0 1 1.14 2.75L93.94 96.2z" fill="url(#solana-gradient-3)"/>
                      <defs>
                        <linearGradient id="solana-gradient-1" x1="22" y1="58" x2="106" y2="42" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#00FFA3"/>
                          <stop offset="1" stopColor="#DC1FFF"/>
                        </linearGradient>
                        <linearGradient id="solana-gradient-2" x1="22" y1="85" x2="106" y2="69" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#00FFA3"/>
                          <stop offset="1" stopColor="#DC1FFF"/>
                        </linearGradient>
                        <linearGradient id="solana-gradient-3" x1="22" y1="97" x2="106" y2="81" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#00FFA3"/>
                          <stop offset="1" stopColor="#DC1FFF"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("text-[12px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                        Solana Wallet
                      </h3>
                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded", isDark ? "bg-white/5 text-white/30" : "bg-gray-100 text-gray-500")}>
                        Marinade, Jito, Raydium...
                      </span>
                    </div>
                    {isSolanaConnected && solanaWallet ? (
                      <code className={cn("text-[10px] font-mono", isDark ? "text-white/30" : "text-gray-500")}>
                        {formatAddress(solanaWallet.address, 8)}
                      </code>
                    ) : (
                      <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                        Staking SOL + DeFi
                      </p>
                    )}
                  </div>
                </div>
                {isSolanaConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success text-[9px] font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                    <button
                      onClick={() => openWalletModal('solana')}
                      className={cn("text-[10px]", isDark ? "text-white/30 hover:text-white" : "text-gray-500 hover:text-gray-900")}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openWalletModal('solana')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00FFA3] to-[#DC1FFF] text-white text-[10px] font-medium hover:opacity-90 transition-opacity"
                  >
                    <Link2 className="w-3 h-3" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connected Wallets Summary */}
          {connectedWallets.length > 0 && (
            <div className={cn("flex items-center gap-4 mb-4 px-3 py-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
              <span className={cn("text-[10px] font-medium", isDark ? "text-white/50" : "text-gray-600")}>
                {connectedWallets.length} wallet{connectedWallets.length > 1 ? 's' : ''} conectada{connectedWallets.length > 1 ? 's' : ''}:
              </span>
              {connectedWallets.map((w) => (
                <div key={w.address} className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    w.type === 'evm' ? "bg-[#627eea]" : "bg-[#9945FF]"
                  )} />
                  <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                    {w.label}: {w.positionCount} posições (${w.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Not Connected State */}
          {!hasAnyWallet && (
            <div
              className="rounded-xl p-12 text-center"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 100%)'
                  : 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
              }}
            >
              <Wallet className={cn("w-12 h-12 mx-auto mb-4", isDark ? "text-white/20" : "text-gray-300")} />
              <h3 className={cn("text-[14px] font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>
                Conecte suas Wallets
              </h3>
              <p className={cn("text-[11px] max-w-md mx-auto mb-4", isDark ? "text-white/30" : "text-gray-500")}>
                Conecte suas wallets EVM e/ou Solana para visualizar todas as suas posições DeFi,
                incluindo Aerodrome, Uniswap, Aave, Marinade, Jito e 8000+ outros protocolos.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => openWalletModal('evm')}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#627eea] text-white text-[11px] font-medium hover:bg-[#627eea]/90 transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  EVM Wallet
                </button>
                <button
                  onClick={() => openWalletModal('solana')}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-[#00FFA3] to-[#DC1FFF] text-white text-[11px] font-medium hover:opacity-90 transition-opacity"
                >
                  <Wallet className="w-4 h-4" />
                  Solana Wallet
                </button>
              </div>
            </div>
          )}

          {/* Connected - Show Positions */}
          {hasAnyWallet && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
                {[
                  { label: 'Total Value', value: summary.totalValueUsd, format: 'currency', icon: Layers, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
                  { label: 'Avg APY', value: summary.weightedAvgApy, format: 'percent', icon: Percent, color: 'text-status-success', bg: 'bg-status-success/10' },
                  { label: 'Est. Annual Yield', value: summary.totalAnnualYield, format: 'currency', icon: DollarSign, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
                  { label: 'Lending', value: summary.lendingSupplyUsd, format: 'currency', icon: Landmark, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
                  { label: 'LP Pools', value: summary.lpValueUsd, format: 'currency', icon: Droplets, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
                  { label: 'Other', value: summary.otherValueUsd, format: 'currency', icon: Layers, color: 'text-white/50', bg: 'bg-white/5' },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="backdrop-blur-md rounded-xl p-4"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
                        : 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(203, 213, 225, 0.6)',
                    }}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                      <card.icon className={cn('w-4 h-4', card.color)} />
                    </div>
                    <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                    <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {card.format === 'percent'
                        ? `${(card.value ?? 0).toFixed(2)}%`
                        : `$${(card.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                    </p>
                    {isLoadingApy && card.label === 'Avg APY' && (
                      <span className={cn("text-[8px]", isDark ? "text-white/20" : "text-gray-400")}>Loading APY...</span>
                    )}
                  </div>
                ))}
              </div>

              {/* APY enrichment indicator */}
              {isLoadingApy && (
                <div className={cn("flex items-center gap-2 mb-4 p-3 rounded-lg", isDark ? "bg-accent-purple/10" : "bg-purple-50")}>
                  <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                  <span className="text-[11px] text-accent-purple font-medium">
                    Buscando APY de 14,000+ pools via DeFiLlama...
                  </span>
                </div>
              )}

              {/* Borrowed indicator if any */}
              {summary.lendingBorrowUsd > 0 && (
                <div className={cn("flex items-center gap-2 mb-4 p-3 rounded-lg", isDark ? "bg-status-error/10" : "bg-red-50")}>
                  <AlertTriangle className="w-4 h-4 text-status-error" />
                  <span className="text-[11px] text-status-error font-medium">
                    Total Borrowed: ${summary.lendingBorrowUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Category Tabs + Sorting */}
              <div className="flex items-center justify-between mb-4">
                <div className={cn("flex items-center gap-1 p-1 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                  {(['all', 'lending', 'lp', 'staking', 'yield', 'other'] as const).map((tab) => {
                    const config = categoryConfig[tab];
                    const count = tab === 'all' ? positions.length
                      : tab === 'lending' ? lendingPositions.length
                      : tab === 'lp' ? lpPositions.length
                      : tab === 'staking' ? stakingPositions.length
                      : tab === 'yield' ? yieldPositions.length
                      : (otherPositions?.length ?? 0);

                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                          activeTab === tab
                            ? `${config.bg} ${config.color}`
                            : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                        )}
                      >
                        <config.icon className="w-3.5 h-3.5" />
                        {config.label} ({count})
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setActiveTab('discover')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                      activeTab === 'discover'
                        ? 'bg-accent-purple/20 text-accent-purple'
                        : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Discover
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort options */}
                  <div className={cn("flex items-center gap-1 p-1 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                    {[
                      { key: 'value' as SortOption, label: 'Value' },
                      { key: 'apy' as SortOption, label: 'APY' },
                      { key: 'name' as SortOption, label: 'Name' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() => toggleSort(option.key)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors",
                          sortBy === option.key
                            ? isDark ? "bg-white/10 text-white" : "bg-gray-200 text-gray-900"
                            : isDark ? "text-white/30 hover:text-white/50" : "text-gray-500 hover:text-gray-600"
                        )}
                      >
                        {option.label}
                        {sortBy === option.key && (
                          sortDirection === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className={cn(
                      "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
                      isDark ? "text-white/30" : "text-gray-400"
                    )} />
                    <input
                      type="text"
                      placeholder="Search protocol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={cn(
                        "pl-8 pr-3 py-1.5 rounded-lg text-[10px] font-medium border-0 outline-none w-40",
                        isDark
                          ? "bg-white/[0.03] text-white placeholder:text-white/30"
                          : "bg-gray-100 text-gray-900 placeholder:text-gray-400"
                      )}
                    />
                  </div>

                  {/* Chain filter */}
                  {summary.chainsUsed.length > 1 && (
                    <select
                      value={chainFilter}
                      onChange={(e) => setChainFilter(e.target.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-medium border-0 outline-none cursor-pointer",
                        isDark ? "bg-white/[0.03] text-white/50" : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <option value="all">All Chains</option>
                      {summary.chainsUsed.map((chain) => (
                        <option key={chain} value={chain}>{chain}</option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50",
                      isDark
                        ? "bg-white/[0.03] text-white/30 hover:text-white hover:bg-white/[0.05]"
                        : "bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                    )}
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && positions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 text-accent-purple animate-spin mb-4" />
                  <p className={cn("text-[12px]", isDark ? "text-white/50" : "text-gray-600")}>
                    Buscando suas posições DeFi...
                  </p>
                  <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                    Escaneando Aerodrome, Uniswap, Aave e 8000+ protocolos
                  </p>
                </div>
              )}

              {/* Error State */}
              {isError && (
                <div className={cn("flex items-center gap-3 p-4 rounded-xl mb-4", isDark ? "bg-status-error/10" : "bg-red-50")}>
                  <AlertTriangle className="w-5 h-5 text-status-error" />
                  <div>
                    <p className="text-[12px] text-status-error font-medium">Erro ao buscar posições</p>
                    <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                      {error?.message || 'Tente novamente mais tarde'}
                    </p>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-status-error/20 text-status-error text-[10px] font-medium hover:bg-status-error/30"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Discover Tab */}
              {activeTab === 'discover' && (
                isLoadingDiscovery ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-accent-purple mr-2" />
                    <span className={cn("text-sm", isDark ? "text-white/50" : "text-gray-500")}>
                      Carregando pools...
                    </span>
                  </div>
                ) : (
                  <PoolDiscovery
                    pools={discoveryPools}
                    onAddPosition={(pool) => console.log('Add position to:', pool.address)}
                  />
                )
              )}

              {/* Positions List */}
              {activeTab !== 'discover' && !isLoading && (
                <>
                  {filteredPositions.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {filteredPositions.map((position) => (
                        <PositionCard key={position.id} position={position} isDark={isDark} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Droplets className={cn("w-10 h-10 mb-3", isDark ? "text-white/20" : "text-gray-300")} />
                      <p className={cn("text-[12px]", isDark ? "text-white/50" : "text-gray-600")}>
                        Nenhuma posição encontrada
                      </p>
                      <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                        {activeTab !== 'all'
                          ? `Você não tem posições de ${categoryConfig[activeTab].label}`
                          : 'Suas wallets conectadas não possuem posições DeFi'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Protocols Used */}
              {positions.length > 0 && activeTab !== 'discover' && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>
                      Protocolos Detectados ({summary.protocolsUsed.length})
                    </p>
                    {summary.positionsWithApy > 0 && (
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded", isDark ? "bg-status-success/10 text-status-success" : "bg-green-100 text-green-700")}>
                        {summary.positionsWithApy}/{summary.totalPositions} com APY
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summary.protocolsUsed.map((protocol) => (
                      <span
                        key={protocol}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-medium",
                          isDark ? "bg-white/[0.03] text-white/50" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {protocol}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        initialTab={walletModalTab}
      />
    </div>
  );
}
