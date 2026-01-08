'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  Layers,
  TrendingUp,
  Shield,
  AlertTriangle,
  Plus,
  ChevronRight,
  Droplets,
  Percent,
  LayoutGrid,
  Globe,
  Wallet,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PoolPositionCard,
  PoolsSummary,
  PoolDiscovery,
  mockAvailablePools,
} from '@/components/defi/pools';
import type { NetworkType } from '@/components/defi/pools/types';
import { useWallet, formatAddress } from '@/contexts/wallet-context';
import { usePoolPositions } from '@/hooks/usePoolPositions';
import { WalletConnectModal } from '@/components/wallet';
import { useTheme } from '@/contexts/theme-context';

type ViewTab = 'pools' | 'protocols' | 'discover';

interface DeFiProtocol {
  id: string;
  name: string;
  logo: string;
  chain: string;
  chainColor: string;
  category: 'lending' | 'dex' | 'yield' | 'derivatives';
  tvl: number;
  userValue: number;
  supplied: number;
  borrowed: number;
  netApy: number;
  healthFactor?: number;
  rewards: number;
  positions: { asset: string; type: string; value: number; apy: number }[];
}

const mockProtocols: DeFiProtocol[] = [
  {
    id: '1',
    name: 'Aave V3',
    logo: 'AA',
    chain: 'Ethereum',
    chainColor: '#627eea',
    category: 'lending',
    tvl: 12500000000,
    userValue: 350000,
    supplied: 450000,
    borrowed: 100000,
    netApy: 2.8,
    healthFactor: 1.85,
    rewards: 1200,
    positions: [
      { asset: 'ETH', type: 'Supply', value: 200000, apy: 2.1 },
      { asset: 'USDC', type: 'Supply', value: 150000, apy: 3.8 },
      { asset: 'WBTC', type: 'Supply', value: 100000, apy: 0.5 },
      { asset: 'USDC', type: 'Borrow', value: -100000, apy: -4.2 },
    ],
  },
  {
    id: '2',
    name: 'Compound V3',
    logo: 'CO',
    chain: 'Ethereum',
    chainColor: '#627eea',
    category: 'lending',
    tvl: 3200000000,
    userValue: 120000,
    supplied: 120000,
    borrowed: 0,
    netApy: 3.2,
    rewards: 350,
    positions: [
      { asset: 'USDC', type: 'Supply', value: 120000, apy: 3.2 },
    ],
  },
  {
    id: '3',
    name: 'GMX',
    logo: 'GMX',
    chain: 'Arbitrum',
    chainColor: '#28a0f0',
    category: 'derivatives',
    tvl: 680000000,
    userValue: 85000,
    supplied: 85000,
    borrowed: 0,
    netApy: 12.5,
    rewards: 420,
    positions: [
      { asset: 'GLP', type: 'Staking', value: 85000, apy: 12.5 },
    ],
  },
];

const categoryConfig = {
  lending: { label: 'Lending', color: 'text-accent-blue', bg: 'bg-accent-blue/10', icon: Percent },
  dex: { label: 'DEX/LP', color: 'text-accent-purple', bg: 'bg-accent-purple/10', icon: Droplets },
  yield: { label: 'Yield', color: 'text-status-success', bg: 'bg-status-success/10', icon: TrendingUp },
  derivatives: { label: 'Derivatives', color: 'text-accent-orange', bg: 'bg-accent-orange/10', icon: Layers },
};

export default function DeFiPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<ViewTab>('pools');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [networkFilter, setNetworkFilter] = useState<NetworkType | 'all'>('all');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState<'evm' | 'solana'>('evm');

  // Wallet & Positions hooks
  const { evmWallet, solanaWallet, isEVMConnected, isSolanaConnected, isAnyConnected } = useWallet();
  const {
    positions,
    evmPositions,
    solanaPositions,
    fetchState,
    isLoading,
    isLoadingEVM,
    isLoadingSolana,
    refreshPositions,
  } = usePoolPositions();

  // Filter positions by network
  const filteredPoolPositions = useMemo(() => {
    if (networkFilter === 'all') return positions;
    return positions.filter(p => p.networkType === networkFilter);
  }, [networkFilter, positions]);

  // Network counts
  const evmCount = evmPositions.length;
  const solanaCount = solanaPositions.length;

  // Protocol totals
  const protocolTotalValue = mockProtocols.reduce((sum, p) => sum + p.userValue, 0);
  const totalSupplied = mockProtocols.reduce((sum, p) => sum + p.supplied, 0);
  const totalBorrowed = mockProtocols.reduce((sum, p) => sum + p.borrowed, 0);
  const totalRewards = mockProtocols.reduce((sum, p) => sum + p.rewards, 0);

  const filteredProtocols = filterCategory === 'all'
    ? mockProtocols
    : mockProtocols.filter((p) => p.category === filterCategory);

  const openWalletModal = (tab: 'evm' | 'solana') => {
    setWalletModalTab(tab);
    setShowWalletModal(true);
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
      {/* Futuristic gradient overlays */}
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.02) 0%, transparent 40%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, transparent 30%)
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
                Gerencie suas posições em protocolos DeFi, lending e liquidity pools
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Tabs */}
              <div className={cn("flex items-center gap-1 p-1 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                <button
                  onClick={() => setActiveTab('pools')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                    activeTab === 'pools'
                      ? 'bg-accent-purple/20 text-accent-purple'
                      : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                  )}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  LP Pools
                </button>
                <button
                  onClick={() => setActiveTab('protocols')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                    activeTab === 'protocols'
                      ? 'bg-accent-purple/20 text-accent-purple'
                      : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Protocols
                </button>
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
              <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors">
                <Plus className="w-4 h-4" />
                Add Position
              </button>
            </div>
          </div>

          {/* LP Pools Tab */}
          {activeTab === 'pools' && (
            <div className="space-y-5">
              {/* Wallet Connection Status Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* EVM Wallet Card */}
                <div
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[1px]"
                    style={{ background: isDark
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)'
                    }}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#627eea]/10 flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-[#627eea]" />
                      </div>
                      <div>
                        <h3 className={cn("text-[12px] font-semibold", isDark ? "text-white" : "text-gray-900")}>EVM Networks</h3>
                        <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>Ethereum, Arbitrum, Base, Polygon...</p>
                      </div>
                    </div>
                    {isEVMConnected ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success text-[9px] font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => openWalletModal('evm')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#627eea]/10 text-[#627eea] text-[10px] font-medium hover:bg-[#627eea]/20 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect Wallet
                      </button>
                    )}
                  </div>

                  {isEVMConnected && evmWallet && (
                    <div className="space-y-2">
                      <div className={cn("flex items-center justify-between p-2.5 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{evmWallet.icon}</span>
                          <div>
                            <p className={cn("text-[10px] font-medium", isDark ? "text-white" : "text-gray-900")}>{evmWallet.label}</p>
                            <code className={cn("text-[9px] font-mono", isDark ? "text-white/30" : "text-gray-500")}>
                              {formatAddress(evmWallet.address, 6)}
                            </code>
                          </div>
                        </div>
                        <button
                          onClick={() => openWalletModal('evm')}
                          className={cn("text-[9px]", isDark ? "text-white/30 hover:text-white" : "text-gray-500 hover:text-gray-900")}
                        >
                          Change
                        </button>
                      </div>

                      {/* EVM Fetch Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isLoadingEVM ? (
                            <>
                              <Loader2 className="w-3 h-3 text-accent-blue animate-spin" />
                              <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>Fetching positions...</span>
                            </>
                          ) : fetchState.evm.status === 'success' ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-status-success" />
                              <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                                {evmCount} positions found
                              </span>
                            </>
                          ) : fetchState.evm.status === 'error' ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-status-error" />
                              <span className="text-[9px] text-status-error">Failed to fetch</span>
                            </>
                          ) : null}
                        </div>
                        {fetchState.evm.lastFetched && (
                          <div className={cn("flex items-center gap-1 text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                            <Clock className="w-3 h-3" />
                            {fetchState.evm.lastFetched.toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Solana Wallet Card */}
                <div
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[1px]"
                    style={{ background: isDark
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)'
                    }}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#9945ff]/10 flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-[#9945ff]" />
                      </div>
                      <div>
                        <h3 className={cn("text-[12px] font-semibold", isDark ? "text-white" : "text-gray-900")}>Solana Network</h3>
                        <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>Orca, Raydium, Meteora, Jupiter...</p>
                      </div>
                    </div>
                    {isSolanaConnected ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10 text-status-success text-[9px] font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => openWalletModal('solana')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9945ff]/10 text-[#9945ff] text-[10px] font-medium hover:bg-[#9945ff]/20 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect Wallet
                      </button>
                    )}
                  </div>

                  {isSolanaConnected && solanaWallet && (
                    <div className="space-y-2">
                      <div className={cn("flex items-center justify-between p-2.5 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{solanaWallet.icon}</span>
                          <div>
                            <p className={cn("text-[10px] font-medium", isDark ? "text-white" : "text-gray-900")}>{solanaWallet.label}</p>
                            <code className={cn("text-[9px] font-mono", isDark ? "text-white/30" : "text-gray-500")}>
                              {formatAddress(solanaWallet.address, 6)}
                            </code>
                          </div>
                        </div>
                        <button
                          onClick={() => openWalletModal('solana')}
                          className={cn("text-[9px]", isDark ? "text-white/30 hover:text-white" : "text-gray-500 hover:text-gray-900")}
                        >
                          Change
                        </button>
                      </div>

                      {/* Solana Fetch Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isLoadingSolana ? (
                            <>
                              <Loader2 className="w-3 h-3 text-accent-purple animate-spin" />
                              <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>Fetching positions...</span>
                            </>
                          ) : fetchState.solana.status === 'success' ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-status-success" />
                              <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                                {solanaCount} positions found
                              </span>
                            </>
                          ) : fetchState.solana.status === 'error' ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-status-error" />
                              <span className="text-[9px] text-status-error">Failed to fetch</span>
                            </>
                          ) : null}
                        </div>
                        {fetchState.solana.lastFetched && (
                          <div className={cn("flex items-center gap-1 text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                            <Clock className="w-3 h-3" />
                            {fetchState.solana.lastFetched.toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Not Connected State */}
              {!isAnyConnected && (
                <div
                  className="rounded-xl p-8 relative overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-4">
                      <Wallet className="w-8 h-8 text-accent-purple" />
                    </div>
                    <h3 className={cn("text-[14px] font-semibold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      Connect Your Wallets
                    </h3>
                    <p className={cn("text-[11px] max-w-md mb-4", isDark ? "text-white/30" : "text-gray-500")}>
                      Connect your EVM and Solana wallets to automatically discover and track your
                      liquidity positions across all supported protocols
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openWalletModal('evm')}
                        className="flex items-center gap-2 h-10 px-5 rounded-lg bg-[#627eea]/10 text-[#627eea] text-[11px] font-medium hover:bg-[#627eea]/20 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#627eea]" />
                        Connect EVM Wallet
                      </button>
                      <button
                        onClick={() => openWalletModal('solana')}
                        className="flex items-center gap-2 h-10 px-5 rounded-lg bg-[#9945ff]/10 text-[#9945ff] text-[11px] font-medium hover:bg-[#9945ff]/20 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#9945ff]" />
                        Connect Solana Wallet
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isAnyConnected && isLoading && positions.length === 0 && (
                <div
                  className="rounded-xl p-8 relative overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                    boxShadow: isDark
                      ? '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-10 h-10 text-accent-purple animate-spin mb-4" />
                    <h3 className={cn("text-[14px] font-semibold mb-1", isDark ? "text-white" : "text-gray-900")}>
                      Fetching Your Positions
                    </h3>
                    <p className={cn("text-[11px] max-w-md", isDark ? "text-white/30" : "text-gray-500")}>
                      Scanning protocols for your liquidity positions...
                    </p>
                    <div className="flex items-center gap-4 mt-4">
                      {isLoadingEVM && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#627eea]/10">
                          <Loader2 className="w-3 h-3 text-[#627eea] animate-spin" />
                          <span className="text-[10px] text-[#627eea]">Scanning EVM...</span>
                        </div>
                      )}
                      {isLoadingSolana && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#9945ff]/10">
                          <Loader2 className="w-3 h-3 text-[#9945ff] animate-spin" />
                          <span className="text-[10px] text-[#9945ff]">Scanning Solana...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Positions Loaded */}
              {isAnyConnected && positions.length > 0 && (
                <>
                  {/* Pools Summary */}
                  <PoolsSummary positions={filteredPoolPositions} />

                  {/* Pool Positions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h2 className={cn("text-[12px] font-semibold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                          Your LP Positions ({filteredPoolPositions.length})
                        </h2>
                        {/* Network Filter */}
                        <div className={cn("flex items-center gap-1 p-1 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
                          <button
                            onClick={() => setNetworkFilter('all')}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-colors',
                              networkFilter === 'all'
                                ? 'bg-accent-blue/20 text-accent-blue'
                                : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                            )}
                          >
                            <Globe className="w-3 h-3" />
                            All ({positions.length})
                          </button>
                          <button
                            onClick={() => setNetworkFilter('evm')}
                            className={cn(
                              'px-2 py-1 rounded-md text-[9px] font-medium transition-colors',
                              networkFilter === 'evm'
                                ? 'bg-[#627eea]/20 text-[#627eea]'
                                : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                            )}
                          >
                            EVM ({evmCount})
                          </button>
                          <button
                            onClick={() => setNetworkFilter('solana')}
                            className={cn(
                              'px-2 py-1 rounded-md text-[9px] font-medium transition-colors',
                              networkFilter === 'solana'
                                ? 'bg-[#9945ff]/20 text-[#9945ff]'
                                : isDark ? 'text-white/30 hover:text-white/50' : 'text-gray-500 hover:text-gray-600'
                            )}
                          >
                            Solana ({solanaCount})
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={refreshPositions}
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
                    <div className="space-y-3">
                      {filteredPoolPositions.map((position) => (
                        <PoolPositionCard
                          key={position.id}
                          position={position}
                          onCollectFees={(p) => console.log('Collect fees:', p.id)}
                          onManage={(p) => console.log('Manage:', p.id)}
                          onRemoveLiquidity={(p) => console.log('Remove:', p.id)}
                        />
                      ))}
                      {filteredPoolPositions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Droplets className={cn("w-10 h-10 mb-3", isDark ? "text-white/30" : "text-gray-400")} />
                          <p className={cn("text-[12px]", isDark ? "text-white/50" : "text-gray-600")}>No positions found</p>
                          <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                            {networkFilter !== 'all'
                              ? `No ${networkFilter === 'solana' ? 'Solana' : 'EVM'} positions yet`
                              : 'Add your first liquidity position'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Protocols Tab */}
          {activeTab === 'protocols' && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Net Value', value: protocolTotalValue, icon: Layers, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
                  { label: 'Total Supplied', value: totalSupplied, icon: TrendingUp, color: 'text-status-success', bg: 'bg-status-success/10' },
                  { label: 'Total Borrowed', value: totalBorrowed, icon: Percent, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
                  { label: 'Pending Rewards', value: totalRewards, icon: Droplets, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="backdrop-blur-md rounded-xl p-4"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
                        : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(203, 213, 225, 0.6)',
                      boxShadow: isDark
                        ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                        : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                      <card.icon className={cn('w-4 h-4', card.color)} />
                    </div>
                    <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                    <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      ${card.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Category:</span>
                {['all', 'lending', 'dex', 'yield', 'derivatives'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-colors',
                      filterCategory === cat
                        ? 'bg-accent-purple/20 text-accent-purple'
                        : isDark
                          ? 'bg-white/[0.03] text-white/50 hover:bg-white/[0.05]'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {cat === 'dex' ? 'DEX/LP' : cat}
                  </button>
                ))}
              </div>

              {/* Protocol Cards */}
              <div className="space-y-3">
                {filteredProtocols.map((protocol) => {
                  const category = categoryConfig[protocol.category];

                  return (
                    <div
                      key={protocol.id}
                      className="backdrop-blur-md rounded-xl p-4"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
                          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(203, 213, 225, 0.6)',
                        boxShadow: isDark
                          ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                      }}
                    >
                      {/* Protocol Header */}
                      <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold", isDark ? "bg-white/[0.05] text-white/50" : "bg-gray-100 text-gray-600")}>
                            {protocol.logo}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>{protocol.name}</h3>
                              <span className={cn('px-2 py-0.5 rounded text-[9px] font-medium', category.bg, category.color)}>
                                {category.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: protocol.chainColor }}
                              />
                              <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>{protocol.chain}</span>
                              <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                              <span className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-600")}>
                                TVL: ${(protocol.tvl / 1000000000).toFixed(1)}B
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                            ${protocol.userValue.toLocaleString()}
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={cn(
                                'text-[11px] font-medium tabular-nums',
                                protocol.netApy >= 0 ? 'text-status-success' : 'text-status-error'
                              )}
                            >
                              {protocol.netApy >= 0 ? '+' : ''}{protocol.netApy}% APY
                            </span>
                            {protocol.healthFactor && (
                              <div className="flex items-center gap-1">
                                {protocol.healthFactor < 1.5 ? (
                                  <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                                ) : (
                                  <Shield className="w-3 h-3 text-status-success" />
                                )}
                                <span
                                  className={cn(
                                    'text-[10px] font-medium tabular-nums',
                                    protocol.healthFactor < 1.5 ? 'text-accent-yellow' : 'text-status-success'
                                  )}
                                >
                                  HF: {protocol.healthFactor.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Positions */}
                      <div>
                        <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Active Positions</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {protocol.positions.map((pos, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "p-2.5 rounded-lg transition-colors cursor-pointer",
                                isDark ? "bg-white/[0.02] hover:bg-white/[0.03]" : "bg-gray-50 hover:bg-gray-100"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn("text-[10px] font-medium", isDark ? "text-white" : "text-gray-900")}>{pos.asset}</span>
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[8px] font-medium',
                                    pos.type === 'Borrow'
                                      ? 'bg-accent-orange/10 text-accent-orange'
                                      : pos.type === 'LP'
                                      ? 'bg-accent-purple/10 text-accent-purple'
                                      : 'bg-status-success/10 text-status-success'
                                  )}
                                >
                                  {pos.type}
                                </span>
                              </div>
                              <p className={cn("text-[11px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                                ${Math.abs(pos.value).toLocaleString()}
                              </p>
                              <span
                                className={cn(
                                  'text-[9px] font-medium tabular-nums',
                                  pos.apy >= 0 ? 'text-status-success' : 'text-status-error'
                                )}
                              >
                                {pos.apy >= 0 ? '+' : ''}{pos.apy}% APY
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rewards */}
                      {protocol.rewards > 0 && (
                        <div className={cn("mt-3 pt-3 border-t flex items-center justify-between", isDark ? "border-white/[0.03]" : "border-gray-200")}>
                          <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Pending Rewards</span>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan text-[10px] font-medium hover:bg-accent-cyan/20 transition-colors">
                            <Droplets className="w-3 h-3" />
                            Claim ${protocol.rewards.toLocaleString()}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Discover Tab */}
          {activeTab === 'discover' && (
            <PoolDiscovery
              pools={mockAvailablePools}
              onAddPosition={(pool) => console.log('Add position to:', pool.address)}
            />
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
