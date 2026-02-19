'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  Wallet,
  Copy,
  ExternalLink,
  CheckCircle2,
  Plus,
  ChevronRight,
  Loader2,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useWallet, formatAddress } from '@/contexts/wallet-context';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useSolanaWalletBalances } from '@/hooks/useSolanaWalletBalances';
import { WalletConnectModal } from '@/components/wallet';

// Chain colors mapping
const CHAIN_COLORS: Record<string, string> = {
  'ethereum': '#627eea',
  'base': '#0052ff',
  'arbitrum-one': '#28a0f0',
  'optimism': '#ff0420',
  'polygon': '#8247e5',
  'avalanche': '#e84142',
  'binance-smart-chain': '#f3ba2f',
  'solana': '#9945ff',
  'bitcoin': '#f7931a',
};

// Explorer URLs
const CHAIN_EXPLORERS: Record<string, string> = {
  'ethereum': 'https://etherscan.io/address/',
  'base': 'https://basescan.org/address/',
  'arbitrum-one': 'https://arbiscan.io/address/',
  'optimism': 'https://optimistic.etherscan.io/address/',
  'polygon': 'https://polygonscan.com/address/',
  'avalanche': 'https://snowtrace.io/address/',
  'binance-smart-chain': 'https://bscscan.com/address/',
  'solana': 'https://solscan.io/account/',
};

const typeConfig = {
  hot: { label: 'Hot Wallet', color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
  cold: { label: 'Cold Storage', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  hardware: { label: 'Hardware', color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
  connected: { label: 'Connected', color: 'text-status-success', bg: 'bg-status-success/10' },
};

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatBalance(balance: number): string {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(2)}M`;
  } else if (balance >= 1000) {
    return balance.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (balance >= 1) {
    return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else if (balance >= 0.0001) {
    return balance.toFixed(4);
  }
  return balance.toFixed(6);
}

export default function WalletsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Wallet connections
  const { evmWallet, solanaWallet, isEVMConnected, isSolanaConnected, isAnyConnected } = useWallet();

  // EVM Wallet balances from Zerion
  const { balances: evmBalances, isLoading: evmLoading, isError: evmError, refetch: refetchEvm } = useWalletBalances();

  // Solana Wallet balances from Helius
  const { balances: solanaBalances, defiPositions, isLoading: solanaLoading, isError: solanaError, refetch: refetchSolana } = useSolanaWalletBalances();

  const isLoading = evmLoading || solanaLoading;

  // Calculate combined totals
  const totalValueUsd = evmBalances.totalValueUsd + solanaBalances.totalValueUsd;
  const totalTokens = evmBalances.totalTokens + solanaBalances.totalTokens;
  const walletsConnected = (isEVMConnected ? 1 : 0) + (isSolanaConnected ? 1 : 0);

  // Combine all tokens
  const allTokens = [...evmBalances.tokens, ...solanaBalances.tokens].sort((a, b) => b.valueUsd - a.valueUsd);

  // Combined chain breakdown
  const chainBreakdown = [...evmBalances.chainBreakdown, ...solanaBalances.chainBreakdown].sort((a, b) => b.valueUsd - a.valueUsd);

  const handleCopy = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getExplorerUrl = (chainId: string, address: string) => {
    const baseUrl = CHAIN_EXPLORERS[chainId] || CHAIN_EXPLORERS['ethereum'];
    return `${baseUrl}${address}`;
  };

  // Filter tokens by search
  const filteredTokens = allTokens.filter((t) =>
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.chain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const refetchAll = () => {
    if (isEVMConnected) refetchEvm();
    if (isSolanaConnected) refetchSolana();
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
                <span className={isDark ? "text-white/50" : "text-gray-600"}>Wallets</span>
              </div>
              <h1 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>Wallet Positions</h1>
              <p className={cn("text-[11px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>
                Monitore todas as suas carteiras em diferentes blockchains
              </p>
            </div>
            <button
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Wallet
            </button>
          </div>

          {/* Not Connected State */}
          {!isAnyConnected && (
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
                Conecte sua Wallet
              </h3>
              <p className={cn("text-[11px] max-w-md mx-auto mb-4", isDark ? "text-white/30" : "text-gray-500")}>
                Conecte sua wallet para visualizar todos os seus tokens e balances em tempo real.
              </p>
              <button
                onClick={() => setShowWalletModal(true)}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-lg bg-accent-purple text-white text-[12px] font-medium hover:bg-accent-purple/90 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Connect Wallet
              </button>
            </div>
          )}

          {/* Connected State */}
          {isAnyConnected && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: 'Total Value',
                    value: isLoading ? '...' : formatValue(totalValueUsd),
                    icon: Wallet,
                    color: 'text-accent-orange',
                    bg: 'bg-accent-orange/10'
                  },
                  {
                    label: 'Wallets Connected',
                    value: walletsConnected.toString(),
                    icon: Wallet,
                    color: 'text-accent-blue',
                    bg: 'bg-accent-blue/10'
                  },
                  {
                    label: 'Total Tokens',
                    value: isLoading ? '...' : totalTokens.toString(),
                    icon: Wallet,
                    color: 'text-accent-purple',
                    bg: 'bg-accent-purple/10'
                  },
                  {
                    label: 'Chains Used',
                    value: isLoading ? '...' : chainBreakdown.length.toString(),
                    icon: Wallet,
                    color: 'text-accent-cyan',
                    bg: 'bg-accent-cyan/10'
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{
                      background: isDark
                        ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                        : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                    }}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                      <card.icon className={cn('w-4 h-4', card.color)} />
                    </div>
                    <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                    <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* EVM Wallet Card */}
              {isEVMConnected && evmWallet && (
                <div
                  className="rounded-xl p-4 relative overflow-hidden mb-5"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                  }}
                >
                  {/* Wallet Header */}
                  <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#627eea20' }}
                      >
                        <Wallet className="w-5 h-5" style={{ color: '#627eea' }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                            {evmWallet.label || 'MetaMask'}
                          </h3>
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-medium', typeConfig.connected.bg, typeConfig.connected.color)}>
                            {typeConfig.connected.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#627eea' }} />
                          <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                            {evmWallet.chainName || 'Ethereum'}
                          </span>
                          <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                          <span className={cn("text-[10px] font-mono", isDark ? "text-white/50" : "text-gray-600")}>
                            {formatAddress(evmWallet.address, 6)}
                          </span>
                          <button
                            onClick={() => handleCopy('evm', evmWallet.address)}
                            className={cn("p-1 rounded transition-colors", isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100")}
                          >
                            {copiedId === 'evm' ? (
                              <CheckCircle2 className="w-3 h-3 text-status-success" />
                            ) : (
                              <Copy className={cn("w-3 h-3", isDark ? "text-white/30" : "text-gray-500")} />
                            )}
                          </button>
                          <a
                            href={getExplorerUrl('ethereum', evmWallet.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("p-1 rounded transition-colors", isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100")}
                          >
                            <ExternalLink className={cn("w-3 h-3", isDark ? "text-white/30" : "text-gray-500")} />
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => refetchEvm()}
                        disabled={evmLoading}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100"
                        )}
                      >
                        <RefreshCw className={cn("w-4 h-4", evmLoading && "animate-spin", isDark ? "text-white/30" : "text-gray-500")} />
                      </button>
                      <div className="text-right">
                        <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          {evmLoading ? '...' : formatValue(evmBalances.totalValueUsd)}
                        </p>
                        <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                          {evmBalances.totalTokens} tokens
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Loading State */}
                  {evmLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className={cn("w-6 h-6 animate-spin", isDark ? "text-white/30" : "text-gray-400")} />
                    </div>
                  )}

                  {/* Top Assets */}
                  {!evmLoading && evmBalances.topAssets.length > 0 && (
                    <div>
                      <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>
                        Top Holdings
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {evmBalances.topAssets.map((asset) => (
                          <div
                            key={`${asset.symbol}-${asset.chainId}`}
                            className={cn(
                              "p-2.5 rounded-lg transition-colors cursor-pointer",
                              isDark ? "bg-white/[0.02] hover:bg-white/[0.03]" : "bg-gray-50 hover:bg-gray-100"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {asset.icon && (
                                <img src={asset.icon} alt={asset.symbol} className="w-4 h-4 rounded-full" />
                              )}
                              <span className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                                {asset.symbol}
                              </span>
                            </div>
                            <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
                              {formatBalance(asset.balance)}
                            </p>
                            <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                              {formatValue(asset.valueUsd)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Solana Wallet Card */}
              {isSolanaConnected && solanaWallet && (
                <div
                  className="rounded-xl p-4 relative overflow-hidden mb-5"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                  }}
                >
                  {/* Wallet Header */}
                  <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#9945ff20' }}
                      >
                        <Wallet className="w-5 h-5" style={{ color: '#9945ff' }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                            {solanaWallet.label || 'Phantom'}
                          </h3>
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-medium', typeConfig.connected.bg, typeConfig.connected.color)}>
                            {typeConfig.connected.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9945ff' }} />
                          <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                            Solana
                          </span>
                          <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                          <span className={cn("text-[10px] font-mono", isDark ? "text-white/50" : "text-gray-600")}>
                            {formatAddress(solanaWallet.address, 6)}
                          </span>
                          <button
                            onClick={() => handleCopy('solana', solanaWallet.address)}
                            className={cn("p-1 rounded transition-colors", isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100")}
                          >
                            {copiedId === 'solana' ? (
                              <CheckCircle2 className="w-3 h-3 text-status-success" />
                            ) : (
                              <Copy className={cn("w-3 h-3", isDark ? "text-white/30" : "text-gray-500")} />
                            )}
                          </button>
                          <a
                            href={getExplorerUrl('solana', solanaWallet.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("p-1 rounded transition-colors", isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100")}
                          >
                            <ExternalLink className={cn("w-3 h-3", isDark ? "text-white/30" : "text-gray-500")} />
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => refetchSolana()}
                        disabled={solanaLoading}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isDark ? "hover:bg-white/[0.05]" : "hover:bg-gray-100"
                        )}
                      >
                        <RefreshCw className={cn("w-4 h-4", solanaLoading && "animate-spin", isDark ? "text-white/30" : "text-gray-500")} />
                      </button>
                      <div className="text-right">
                        <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          {solanaLoading ? '...' : formatValue(solanaBalances.totalValueUsd)}
                        </p>
                        <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                          {solanaBalances.totalTokens} tokens
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Loading State */}
                  {solanaLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className={cn("w-6 h-6 animate-spin", isDark ? "text-white/30" : "text-gray-400")} />
                    </div>
                  )}

                  {/* Top Assets */}
                  {!solanaLoading && solanaBalances.topAssets.length > 0 && (
                    <div>
                      <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>
                        Top Holdings
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {solanaBalances.topAssets.map((asset) => (
                          <div
                            key={`${asset.symbol}-${asset.chainId}`}
                            className={cn(
                              "p-2.5 rounded-lg transition-colors cursor-pointer",
                              isDark ? "bg-white/[0.02] hover:bg-white/[0.03]" : "bg-gray-50 hover:bg-gray-100"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {asset.icon && (
                                <img src={asset.icon} alt={asset.symbol} className="w-4 h-4 rounded-full" />
                              )}
                              <span className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                                {asset.symbol}
                              </span>
                            </div>
                            <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
                              {formatBalance(asset.balance)}
                            </p>
                            <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                              {formatValue(asset.valueUsd)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DeFi Positions (Staking) */}
                  {!solanaLoading && defiPositions.length > 0 && (
                    <div className="mt-4">
                      <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>
                        Staking Positions
                      </p>
                      <div className="space-y-2">
                        {defiPositions.map((position, index) => (
                          <div
                            key={index}
                            className={cn(
                              "p-3 rounded-lg",
                              isDark ? "bg-white/[0.02]" : "bg-gray-50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                                  {position.protocol}
                                </p>
                                <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                                  {position.tokens[0]?.symbol} · {position.type}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-[11px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                                  {formatValue(position.valueUsd)}
                                </p>
                                {position.apy && (
                                  <p className="text-[9px] text-status-success">
                                    {position.apy.toFixed(1)}% APY
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chain Breakdown */}
              {!isLoading && chainBreakdown.length > 0 && (
                <div
                  className="rounded-xl p-4 relative overflow-hidden mb-5"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                  }}
                >
                  <p className={cn("text-[10px] uppercase tracking-wider mb-3", isDark ? "text-white/30" : "text-gray-500")}>
                    Balance by Chain
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {chainBreakdown.map((chain) => (
                      <div
                        key={chain.chainId}
                        className={cn(
                          "p-3 rounded-lg",
                          isDark ? "bg-white/[0.02]" : "bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CHAIN_COLORS[chain.chainId] || '#888' }}
                          />
                          <span className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                            {chain.chain}
                          </span>
                        </div>
                        <p className={cn("text-[12px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          {formatValue(chain.valueUsd)}
                        </p>
                        <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                          {chain.tokenCount} tokens
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Tokens Table */}
              {!isLoading && allTokens.length > 0 && (
                <div
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>
                      All Tokens ({filteredTokens.length})
                    </p>
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] border-0 outline-none w-40",
                        isDark
                          ? "bg-white/[0.03] text-white placeholder:text-white/30"
                          : "bg-gray-100 text-gray-900 placeholder:text-gray-400"
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    {filteredTokens.map((token) => (
                      <div
                        key={`${token.symbol}-${token.chainId}`}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                            {token.icon ? (
                              <img src={token.icon} alt={token.symbol} className="w-6 h-6" />
                            ) : (
                              <span className={cn("text-[10px] font-bold", isDark ? "text-white/50" : "text-gray-500")}>
                                {token.symbol.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                              {token.symbol}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: CHAIN_COLORS[token.chainId] || '#888' }}
                              />
                              <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                                {token.chain}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                            {formatValue(token.valueUsd)}
                          </p>
                          <p className={cn("text-[9px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
                            {formatBalance(token.balance)} {token.symbol}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && allTokens.length === 0 && (
                <div
                  className="rounded-xl p-8 text-center"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 100%)'
                      : 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
                  }}
                >
                  <Wallet className={cn("w-10 h-10 mx-auto mb-3", isDark ? "text-white/20" : "text-gray-300")} />
                  <p className={cn("text-[12px]", isDark ? "text-white/50" : "text-gray-600")}>
                    No tokens found
                  </p>
                  <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                    This wallet doesn&apos;t have any token balances
                  </p>
                </div>
              )}

              {/* Error State */}
              {(evmError || solanaError) && (
                <div
                  className="rounded-xl p-4 mb-5"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #fecaca',
                  }}
                >
                  <p className="text-[12px] text-status-error font-medium">Failed to load balances</p>
                  <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                    Check your connection and try again
                  </p>
                  <button
                    onClick={refetchAll}
                    className="mt-2 px-3 py-1 rounded-lg bg-status-error/20 text-status-error text-[10px] font-medium"
                  >
                    Retry
                  </button>
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
      />
    </div>
  );
}
