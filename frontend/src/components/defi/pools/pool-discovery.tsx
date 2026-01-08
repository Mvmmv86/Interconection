'use client';

import { useState } from 'react';
import {
  Search,
  Droplets,
  ExternalLink,
  Plus,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { PoolInfo, PoolProtocol, PoolChain, NetworkType, PROTOCOL_CONFIG, CHAIN_CONFIG } from './types';

interface PoolDiscoveryProps {
  pools: PoolInfo[];
  onAddPosition?: (pool: PoolInfo) => void;
}

export function PoolDiscovery({ pools, onAddPosition }: PoolDiscoveryProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<PoolProtocol | 'all'>('all');
  const [selectedChain, setSelectedChain] = useState<PoolChain | 'all'>('all');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'tvl' | 'apr' | 'volume'>('tvl');

  const protocols = Object.keys(PROTOCOL_CONFIG) as PoolProtocol[];
  const chains = Object.keys(CHAIN_CONFIG) as PoolChain[];

  // Filter protocols by selected network
  const filteredProtocols = selectedNetwork === 'all'
    ? protocols
    : protocols.filter(p => PROTOCOL_CONFIG[p].networkType === selectedNetwork);

  // Filter chains by selected network
  const filteredChains = selectedNetwork === 'all'
    ? chains
    : chains.filter(c => CHAIN_CONFIG[c].networkType === selectedNetwork);

  const filteredPools = pools
    .filter((pool) => {
      if (selectedNetwork !== 'all' && pool.networkType !== selectedNetwork) return false;
      if (selectedProtocol !== 'all' && pool.protocol !== selectedProtocol) return false;
      if (selectedChain !== 'all' && pool.chain !== selectedChain) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          pool.token0.symbol.toLowerCase().includes(query) ||
          pool.token1.symbol.toLowerCase().includes(query) ||
          pool.token0.name.toLowerCase().includes(query) ||
          pool.token1.name.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'tvl') return b.tvl - a.tvl;
      if (sortBy === 'apr') return b.metrics.apr7d - a.metrics.apr7d;
      return b.metrics.volume24h - a.metrics.volume24h;
    });

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div
      className={cn(
        "backdrop-blur-md rounded-xl p-4",
        isDark ? "border border-white/[0.06]" : "border border-slate-200/60"
      )}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between pb-3 mb-4 border-b",
        isDark ? "border-white/[0.06]" : "border-gray-200"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className={cn(
              "text-[12px] font-semibold uppercase tracking-wider",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Discover Pools
            </h3>
            <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Find and add new liquidity positions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Network Type Filter */}
        <div className={cn(
          "flex items-center gap-1 p-1 rounded-lg border",
          isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-gray-100 border-gray-200"
        )}>
          <button
            onClick={() => {
              setSelectedNetwork('all');
              setSelectedProtocol('all');
              setSelectedChain('all');
            }}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              selectedNetwork === 'all'
                ? 'bg-accent-blue/20 text-accent-blue'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            All Networks
          </button>
          <button
            onClick={() => {
              setSelectedNetwork('evm');
              setSelectedProtocol('all');
              setSelectedChain('all');
            }}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              selectedNetwork === 'evm'
                ? 'bg-accent-blue/20 text-accent-blue'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            EVM
          </button>
          <button
            onClick={() => {
              setSelectedNetwork('solana');
              setSelectedProtocol('all');
              setSelectedChain('all');
            }}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              selectedNetwork === 'solana'
                ? 'bg-accent-purple/20 text-accent-purple'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            Solana
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
          <input
            type="text"
            placeholder="Search by token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-[11px] focus:outline-none focus:border-accent-blue/30",
              isDark
                ? "bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30"
                : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400"
            )}
          />
        </div>

        {/* Protocol Filter */}
        <div className="relative">
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as PoolProtocol | 'all')}
            className={cn(
              "h-9 pl-3 pr-8 rounded-lg text-[11px] appearance-none cursor-pointer focus:outline-none focus:border-accent-blue/30",
              isDark
                ? "bg-white/[0.03] border border-white/[0.06] text-white"
                : "bg-gray-50 border border-gray-200 text-gray-900"
            )}
          >
            <option value="all">All Protocols</option>
            {filteredProtocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {PROTOCOL_CONFIG[protocol].name}
              </option>
            ))}
          </select>
          <ChevronDown className={cn("absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none", isDark ? "text-white/30" : "text-gray-400")} />
        </div>

        {/* Chain Filter */}
        <div className="relative">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value as PoolChain | 'all')}
            className={cn(
              "h-9 pl-3 pr-8 rounded-lg text-[11px] appearance-none cursor-pointer focus:outline-none focus:border-accent-blue/30",
              isDark
                ? "bg-white/[0.03] border border-white/[0.06] text-white"
                : "bg-gray-50 border border-gray-200 text-gray-900"
            )}
          >
            <option value="all">All Chains</option>
            {filteredChains.map((chain) => (
              <option key={chain} value={chain}>
                {CHAIN_CONFIG[chain].name}
              </option>
            ))}
          </select>
          <ChevronDown className={cn("absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none", isDark ? "text-white/30" : "text-gray-400")} />
        </div>

        {/* Sort By */}
        <div className={cn("flex items-center gap-1 p-1 rounded-lg", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
          <button
            onClick={() => setSortBy('tvl')}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              sortBy === 'tvl'
                ? 'bg-accent-purple/20 text-accent-purple'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            TVL
          </button>
          <button
            onClick={() => setSortBy('apr')}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              sortBy === 'apr'
                ? 'bg-accent-purple/20 text-accent-purple'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            APR
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              sortBy === 'volume'
                ? 'bg-accent-purple/20 text-accent-purple'
                : isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-600'
            )}
          >
            Volume
          </button>
        </div>
      </div>

      {/* Pool List */}
      <div className="space-y-2">
        {filteredPools.map((pool) => {
          const protocol = PROTOCOL_CONFIG[pool.protocol];
          const chain = CHAIN_CONFIG[pool.chain];

          return (
            <div
              key={pool.address}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer group",
                isDark ? "bg-white/[0.02] hover:bg-white/[0.04]" : "bg-gray-50 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Token Pair */}
                <div className="relative">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold border",
                    isDark ? "bg-white/[0.08] text-white border-white/[0.1]" : "bg-gray-200 text-gray-900 border-gray-300"
                  )}>
                    {pool.token0.symbol}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border",
                    isDark ? "bg-white/[0.08] text-white/70 border-white/[0.1]" : "bg-gray-200 text-gray-600 border-gray-300"
                  )}>
                    {pool.token1.symbol.slice(0, 3)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                      {pool.token0.symbol}/{pool.token1.symbol}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-medium",
                      isDark ? "bg-white/[0.05] text-white/70" : "bg-gray-100 text-gray-600"
                    )}>
                      {pool.feeTier}%
                    </span>
                    {protocol.isConcentrated && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent-cyan/10 text-accent-cyan">
                        <Zap className="w-2.5 h-2.5" />
                        CL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>{chain.name}</span>
                    <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                    <span className={cn("text-[9px]", isDark ? "text-white/70" : "text-gray-600")}>{protocol.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Metrics */}
                <div className="text-right">
                  <p className={cn("text-[9px] uppercase", isDark ? "text-white/30" : "text-gray-500")}>TVL</p>
                  <p className={cn("text-[11px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                    {formatNumber(pool.tvl)}
                  </p>
                </div>

                <div className="text-right">
                  <p className={cn("text-[9px] uppercase", isDark ? "text-white/30" : "text-gray-500")}>Volume 24h</p>
                  <p className={cn("text-[11px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                    {formatNumber(pool.metrics.volume24h)}
                  </p>
                </div>

                <div className="text-right">
                  <p className={cn("text-[9px] uppercase", isDark ? "text-white/30" : "text-gray-500")}>APR 7d</p>
                  <p className="text-[11px] font-medium text-status-success tabular-nums">
                    {pool.metrics.apr7d.toFixed(2)}%
                  </p>
                </div>

                <div className="text-right">
                  <p className={cn("text-[9px] uppercase", isDark ? "text-white/30" : "text-gray-500")}>Fees 24h</p>
                  <p className={cn("text-[11px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                    {formatNumber(pool.metrics.fees24h)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onAddPosition?.(pool)}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg bg-accent-purple/10 text-accent-purple text-[10px] font-medium hover:bg-accent-purple/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                  <a
                    href={`${chain.explorer}/address/${pool.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                      isDark
                        ? "bg-white/[0.05] text-white/30 hover:text-white hover:bg-white/[0.08]"
                        : "bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                    )}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {filteredPools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className={cn("w-8 h-8 mb-2", isDark ? "text-white/30" : "text-gray-400")} />
            <p className={cn("text-[12px]", isDark ? "text-white/70" : "text-gray-600")}>No pools found</p>
            <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Supported Protocols */}
      <div className={cn("mt-4 pt-4 border-t", isDark ? "border-white/[0.03]" : "border-gray-100")}>
        <p className={cn("text-[9px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Supported Protocols</p>
        <div className="flex flex-wrap items-center gap-2">
          {protocols.map((protocol) => (
            <div
              key={protocol}
              className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md", isDark ? "bg-white/[0.02]" : "bg-gray-50")}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PROTOCOL_CONFIG[protocol].color }}
              />
              <span className={cn("text-[9px]", isDark ? "text-white/70" : "text-gray-600")}>{PROTOCOL_CONFIG[protocol].name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
