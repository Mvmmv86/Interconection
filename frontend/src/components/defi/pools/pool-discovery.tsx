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
import { PoolInfo, PoolProtocol, PoolChain, NetworkType, PROTOCOL_CONFIG, CHAIN_CONFIG } from './types';

interface PoolDiscoveryProps {
  pools: PoolInfo[];
  onAddPosition?: (pool: PoolInfo) => void;
}

export function PoolDiscovery({ pools, onAddPosition }: PoolDiscoveryProps) {
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
      className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
              Discover Pools
            </h3>
            <p className="text-[10px] text-text-muted">Find and add new liquidity positions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Network Type Filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
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
                : 'text-text-muted hover:text-text-secondary'
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
                : 'text-text-muted hover:text-text-secondary'
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
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Solana
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/30"
          />
        </div>

        {/* Protocol Filter */}
        <div className="relative">
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as PoolProtocol | 'all')}
            className="h-9 pl-3 pr-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-accent-blue/30"
          >
            <option value="all">All Protocols</option>
            {filteredProtocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {PROTOCOL_CONFIG[protocol].name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>

        {/* Chain Filter */}
        <div className="relative">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value as PoolChain | 'all')}
            className="h-9 pl-3 pr-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-accent-blue/30"
          >
            <option value="all">All Chains</option>
            {filteredChains.map((chain) => (
              <option key={chain} value={chain}>
                {CHAIN_CONFIG[chain].name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03]">
          <button
            onClick={() => setSortBy('tvl')}
            className={cn(
              'px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
              sortBy === 'tvl'
                ? 'bg-accent-purple/20 text-accent-purple'
                : 'text-text-muted hover:text-text-secondary'
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
                : 'text-text-muted hover:text-text-secondary'
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
                : 'text-text-muted hover:text-text-secondary'
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
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                {/* Token Pair */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center text-[9px] font-bold text-text-primary border border-white/[0.1]">
                    {pool.token0.symbol}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-[7px] font-bold text-text-secondary border border-white/[0.1]">
                    {pool.token1.symbol.slice(0, 3)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-text-primary">
                      {pool.token0.symbol}/{pool.token1.symbol}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-white/[0.05] text-text-secondary">
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
                    <span className="text-[9px] text-text-muted">{chain.name}</span>
                    <span className="text-[9px] text-text-muted">·</span>
                    <span className="text-[9px] text-text-secondary">{protocol.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Metrics */}
                <div className="text-right">
                  <p className="text-[9px] text-text-muted uppercase">TVL</p>
                  <p className="text-[11px] font-medium text-text-primary tabular-nums">
                    {formatNumber(pool.tvl)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] text-text-muted uppercase">Volume 24h</p>
                  <p className="text-[11px] font-medium text-text-primary tabular-nums">
                    {formatNumber(pool.metrics.volume24h)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] text-text-muted uppercase">APR 7d</p>
                  <p className="text-[11px] font-medium text-status-success tabular-nums">
                    {pool.metrics.apr7d.toFixed(2)}%
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] text-text-muted uppercase">Fees 24h</p>
                  <p className="text-[11px] font-medium text-text-primary tabular-nums">
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
                    className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.05] text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-colors"
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
            <Search className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-[12px] text-text-secondary">No pools found</p>
            <p className="text-[10px] text-text-muted">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Supported Protocols */}
      <div className="mt-4 pt-4 border-t border-white/[0.03]">
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Supported Protocols</p>
        <div className="flex flex-wrap items-center gap-2">
          {protocols.map((protocol) => (
            <div
              key={protocol}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PROTOCOL_CONFIG[protocol].color }}
              />
              <span className="text-[9px] text-text-secondary">{PROTOCOL_CONFIG[protocol].name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
