'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Building2,
  Wallet,
  Layers,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  id: string;
  asset: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
  location: string;
  locationType: 'exchange' | 'defi' | 'wallet' | 'staking';
  chain: string;
}

const mockPositions: Position[] = [
  { id: '1', asset: 'Bitcoin', symbol: 'BTC', quantity: 5.5, avgPrice: 85000, currentPrice: 105000, value: 577500, pnl: 110000, pnlPercent: 23.5, allocation: 23.5, location: 'Binance', locationType: 'exchange', chain: 'Bitcoin' },
  { id: '2', asset: 'Ethereum', symbol: 'ETH', quantity: 120, avgPrice: 3200, currentPrice: 4000, value: 480000, pnl: 96000, pnlPercent: 25.0, allocation: 19.5, location: 'Aave V3', locationType: 'defi', chain: 'Ethereum' },
  { id: '3', asset: 'Ethereum', symbol: 'ETH', quantity: 50, avgPrice: 3100, currentPrice: 4000, value: 200000, pnl: 45000, pnlPercent: 29.0, allocation: 8.1, location: 'Lido Staking', locationType: 'staking', chain: 'Ethereum' },
  { id: '4', asset: 'Solana', symbol: 'SOL', quantity: 1500, avgPrice: 180, currentPrice: 220, value: 330000, pnl: 60000, pnlPercent: 22.2, allocation: 13.4, location: 'Coinbase', locationType: 'exchange', chain: 'Solana' },
  { id: '5', asset: 'USDC', symbol: 'USDC', quantity: 250000, avgPrice: 1, currentPrice: 1, value: 250000, pnl: 0, pnlPercent: 0, allocation: 10.2, location: 'Cold Wallet', locationType: 'wallet', chain: 'Ethereum' },
  { id: '6', asset: 'Arbitrum', symbol: 'ARB', quantity: 80000, avgPrice: 1.8, currentPrice: 2.2, value: 176000, pnl: 32000, pnlPercent: 22.2, allocation: 7.2, location: 'Uniswap V3', locationType: 'defi', chain: 'Arbitrum' },
  { id: '7', asset: 'Chainlink', symbol: 'LINK', quantity: 5000, avgPrice: 22, currentPrice: 28, value: 140000, pnl: 30000, pnlPercent: 27.3, allocation: 5.7, location: 'Kraken', locationType: 'exchange', chain: 'Ethereum' },
  { id: '8', asset: 'Aave', symbol: 'AAVE', quantity: 400, avgPrice: 280, currentPrice: 320, value: 128000, pnl: 16000, pnlPercent: 14.3, allocation: 5.2, location: 'Aave Staking', locationType: 'staking', chain: 'Ethereum' },
  { id: '9', asset: 'Uniswap', symbol: 'UNI', quantity: 8000, avgPrice: 12, currentPrice: 14.5, value: 116000, pnl: 20000, pnlPercent: 20.8, allocation: 4.7, location: 'Binance', locationType: 'exchange', chain: 'Ethereum' },
  { id: '10', asset: 'Polygon', symbol: 'MATIC', quantity: 120000, avgPrice: 0.85, currentPrice: 0.95, value: 114000, pnl: 12000, pnlPercent: 11.8, allocation: 4.6, location: 'Ledger', locationType: 'wallet', chain: 'Polygon' },
  { id: '11', asset: 'Curve DAO', symbol: 'CRV', quantity: 150000, avgPrice: 0.65, currentPrice: 0.72, value: 108000, pnl: 10500, pnlPercent: 10.8, allocation: 4.4, location: 'Curve Pool', locationType: 'defi', chain: 'Ethereum' },
  { id: '12', asset: 'Maker', symbol: 'MKR', quantity: 35, avgPrice: 2800, currentPrice: 3100, value: 108500, pnl: 10500, pnlPercent: 10.7, allocation: 4.4, location: 'MakerDAO', locationType: 'defi', chain: 'Ethereum' },
];

const locationIcons = {
  exchange: Building2,
  defi: Layers,
  wallet: Wallet,
  staking: Coins,
};

const locationColors = {
  exchange: 'bg-accent-blue/10 text-accent-blue',
  defi: 'bg-accent-purple/10 text-accent-purple',
  wallet: 'bg-accent-orange/10 text-accent-orange',
  staking: 'bg-status-success/10 text-status-success',
};

type SortField = 'value' | 'pnl' | 'pnlPercent' | 'allocation' | 'quantity';
type FilterType = 'all' | 'exchange' | 'defi' | 'wallet' | 'staking';

export function PositionsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredPositions = mockPositions
    .filter((p) => {
      const matchesSearch =
        p.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || p.locationType === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * multiplier;
    });

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalValue = filteredPositions.reduce((sum, p) => sum + p.value, 0);
  const totalPnl = filteredPositions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div
      className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
            All Positions
          </h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            {filteredPositions.length} positions · ${(totalValue / 1000000).toFixed(2)}M total
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-40 h-8 pl-8 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple/50"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-8 px-3 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors',
              showFilters
                ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple'
                : 'bg-white/[0.03] border-white/[0.06] text-text-secondary hover:bg-white/[0.05]'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* Sort */}
          <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-transparent text-[11px] text-text-secondary focus:outline-none cursor-pointer"
            >
              <option value="value">Value</option>
              <option value="pnl">P&L</option>
              <option value="pnlPercent">P&L %</option>
              <option value="allocation">Allocation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      {showFilters && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.03]">
          <span className="text-[10px] text-text-muted">Type:</span>
          {(['all', 'exchange', 'defi', 'wallet', 'staking'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-medium capitalize transition-colors',
                filterType === type
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'bg-white/[0.03] text-text-secondary hover:bg-white/[0.05]'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.03]">
              <th className="text-left py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">Asset</th>
              <th className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">Quantity</th>
              <th className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">Avg Price</th>
              <th className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">Current</th>
              <th
                className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary"
                onClick={() => handleSort('value')}
              >
                <span className="flex items-center justify-end gap-1">
                  Value
                  {sortBy === 'value' && <ArrowUpDown className="w-2.5 h-2.5" />}
                </span>
              </th>
              <th
                className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary"
                onClick={() => handleSort('pnlPercent')}
              >
                <span className="flex items-center justify-end gap-1">
                  P&L
                  {sortBy === 'pnlPercent' && <ArrowUpDown className="w-2.5 h-2.5" />}
                </span>
              </th>
              <th
                className="text-right py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary"
                onClick={() => handleSort('allocation')}
              >
                <span className="flex items-center justify-end gap-1">
                  Alloc.
                  {sortBy === 'allocation' && <ArrowUpDown className="w-2.5 h-2.5" />}
                </span>
              </th>
              <th className="text-left py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider pl-3">Location</th>
              <th className="text-left py-2.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">Chain</th>
            </tr>
          </thead>
          <tbody>
            {filteredPositions.map((position) => {
              const LocationIcon = locationIcons[position.locationType];
              return (
                <tr
                  key={position.id}
                  className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-text-secondary">
                        {position.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-text-primary">{position.symbol}</p>
                        <p className="text-[9px] text-text-muted">{position.asset}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 text-[11px] text-text-secondary tabular-nums">
                    {position.quantity.toLocaleString()}
                  </td>
                  <td className="text-right py-3 text-[11px] text-text-muted tabular-nums">
                    ${position.avgPrice.toLocaleString()}
                  </td>
                  <td className="text-right py-3 text-[11px] text-text-primary tabular-nums">
                    ${position.currentPrice.toLocaleString()}
                  </td>
                  <td className="text-right py-3 text-[12px] font-medium text-text-primary tabular-nums">
                    ${position.value.toLocaleString()}
                  </td>
                  <td className="text-right py-3">
                    <div className="flex items-center justify-end gap-1">
                      {position.pnl !== 0 && (
                        position.pnl >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-status-success" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-status-error" />
                        )
                      )}
                      <span
                        className={cn(
                          'text-[11px] font-medium tabular-nums',
                          position.pnl >= 0 ? 'text-status-success' : 'text-status-error',
                          position.pnl === 0 && 'text-text-muted'
                        )}
                      >
                        {position.pnl >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-3 text-[11px] text-text-secondary tabular-nums">
                    {position.allocation.toFixed(1)}%
                  </td>
                  <td className="py-3 pl-3">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center', locationColors[position.locationType])}>
                        <LocationIcon className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] text-text-secondary">{position.location}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-[10px] text-text-muted">{position.chain}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.03]">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-text-muted">
            Total: <span className="text-text-primary font-medium">${(totalValue / 1000000).toFixed(2)}M</span>
          </span>
          <span className="text-[10px] text-text-muted">
            P&L:{' '}
            <span className={cn('font-medium', totalPnl >= 0 ? 'text-status-success' : 'text-status-error')}>
              {totalPnl >= 0 ? '+' : ''}${(totalPnl / 1000).toFixed(0)}K
            </span>
          </span>
        </div>
        <button className="text-[10px] text-accent-blue hover:underline">Export CSV →</button>
      </div>
    </div>
  );
}
