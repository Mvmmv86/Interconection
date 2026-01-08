'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Search, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface Holding {
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
}

const mockHoldings: Holding[] = [
  { id: '1', asset: 'Bitcoin', symbol: 'BTC', quantity: 5.5, avgPrice: 85000, currentPrice: 105000, value: 577500, pnl: 110000, pnlPercent: 23.5, allocation: 23.5, location: 'Binance', locationType: 'exchange' },
  { id: '2', asset: 'Ethereum', symbol: 'ETH', quantity: 120, avgPrice: 3200, currentPrice: 4000, value: 480000, pnl: 96000, pnlPercent: 25.0, allocation: 19.5, location: 'Aave', locationType: 'defi' },
  { id: '3', asset: 'Ethereum', symbol: 'ETH', quantity: 50, avgPrice: 3100, currentPrice: 4000, value: 200000, pnl: 45000, pnlPercent: 29.0, allocation: 8.1, location: 'Lido Staking', locationType: 'staking' },
  { id: '4', asset: 'Solana', symbol: 'SOL', quantity: 1500, avgPrice: 180, currentPrice: 220, value: 330000, pnl: 60000, pnlPercent: 22.2, allocation: 13.4, location: 'Coinbase', locationType: 'exchange' },
  { id: '5', asset: 'USDC', symbol: 'USDC', quantity: 250000, avgPrice: 1, currentPrice: 1, value: 250000, pnl: 0, pnlPercent: 0, allocation: 10.2, location: 'Cold Wallet', locationType: 'wallet' },
  { id: '6', asset: 'Arbitrum', symbol: 'ARB', quantity: 80000, avgPrice: 1.8, currentPrice: 2.2, value: 176000, pnl: 32000, pnlPercent: 22.2, allocation: 7.2, location: 'Uniswap LP', locationType: 'defi' },
  { id: '7', asset: 'Chainlink', symbol: 'LINK', quantity: 5000, avgPrice: 22, currentPrice: 28, value: 140000, pnl: 30000, pnlPercent: 27.3, allocation: 5.7, location: 'Kraken', locationType: 'exchange' },
  { id: '8', asset: 'Aave', symbol: 'AAVE', quantity: 400, avgPrice: 280, currentPrice: 320, value: 128000, pnl: 16000, pnlPercent: 14.3, allocation: 5.2, location: 'Aave Staking', locationType: 'staking' },
];

const locationColors = {
  exchange: 'bg-accent-blue/10 text-accent-blue',
  defi: 'bg-accent-purple/10 text-accent-purple',
  wallet: 'bg-accent-cyan/10 text-accent-cyan',
  staking: 'bg-status-success/10 text-status-success',
};

export function TopHoldings() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'allocation'>('value');

  const filteredHoldings = mockHoldings
    .filter((h) =>
      h.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className={cn(
        'flex items-center justify-between pb-3 mb-4 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'text-[12px] font-semibold uppercase tracking-wider',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Top Holdings
        </h3>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3',
              isDark ? 'text-white/30' : 'text-gray-400'
            )} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-32 h-7 pl-7 pr-2 rounded-md text-[10px] focus:outline-none transition-colors',
                isDark
                  ? 'bg-white/[0.03] border border-white/[0.03] text-white placeholder:text-white/30 focus:border-white/[0.06]'
                  : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300'
              )}
            />
          </div>

          {/* Sort */}
          <div className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded-md',
            isDark
              ? 'bg-white/[0.03] border border-white/[0.03]'
              : 'bg-gray-100 border border-gray-200'
          )}>
            <ArrowUpDown className={cn('w-3 h-3', isDark ? 'text-white/30' : 'text-gray-400')} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'value' | 'pnl' | 'allocation')}
              className={cn(
                'bg-transparent text-[10px] focus:outline-none cursor-pointer',
                isDark ? 'text-white/70' : 'text-gray-700'
              )}
            >
              <option value="value">Value</option>
              <option value="pnl">P&L</option>
              <option value="allocation">Allocation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn('border-b', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
              <th className={cn('text-left py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Asset</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Quantity</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Avg Price</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Current</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Value</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>P&L</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Alloc.</th>
              <th className={cn('text-left py-2 text-[9px] font-medium uppercase tracking-wider pl-3', isDark ? 'text-white/30' : 'text-gray-500')}>Location</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding) => (
              <tr
                key={holding.id}
                className={cn(
                  'border-b transition-colors',
                  isDark
                    ? 'border-white/[0.02] hover:bg-white/[0.02]'
                    : 'border-gray-50 hover:bg-gray-50'
                )}
              >
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold',
                      isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                    )}>
                      {holding.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{holding.symbol}</p>
                      <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>{holding.asset}</p>
                    </div>
                  </div>
                </td>
                <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                  {holding.quantity.toLocaleString()}
                </td>
                <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white/30' : 'text-gray-500')}>
                  ${holding.avgPrice.toLocaleString()}
                </td>
                <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                  ${holding.currentPrice.toLocaleString()}
                </td>
                <td className={cn('text-right py-2.5 text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                  ${holding.value.toLocaleString()}
                </td>
                <td className="text-right py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {holding.pnl >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-status-success" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-status-error" />
                    )}
                    <span
                      className={cn(
                        'text-[11px] font-medium tabular-nums',
                        holding.pnl >= 0 ? 'text-status-success' : 'text-status-error'
                      )}
                    >
                      {holding.pnl >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                  {holding.allocation.toFixed(1)}%
                </td>
                <td className="py-2.5 pl-3">
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded text-[9px] font-medium',
                      locationColors[holding.locationType]
                    )}
                  >
                    {holding.location}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className={cn(
        'flex items-center justify-between mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
          Showing {filteredHoldings.length} of {mockHoldings.length} holdings
        </span>
        <button className="text-[10px] text-accent-blue hover:underline">View all positions →</button>
      </div>
    </div>
  );
}
