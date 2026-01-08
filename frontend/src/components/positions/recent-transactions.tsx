'use client';

import { ArrowUpRight, ArrowDownLeft, RefreshCw, Coins, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'swap' | 'stake' | 'unstake' | 'claim';
  asset: string;
  symbol: string;
  amount: number;
  value: number;
  timestamp: string;
  location: string;
  status: 'confirmed' | 'pending';
}

const mockTransactions: Transaction[] = [
  { id: '1', type: 'buy', asset: 'Ethereum', symbol: 'ETH', amount: 10, value: 40000, timestamp: '2 min ago', location: 'Binance', status: 'confirmed' },
  { id: '2', type: 'stake', asset: 'Ethereum', symbol: 'ETH', amount: 5, value: 20000, timestamp: '15 min ago', location: 'Lido', status: 'confirmed' },
  { id: '3', type: 'swap', asset: 'USDC → ETH', symbol: 'SWAP', amount: 5000, value: 5000, timestamp: '1 hour ago', location: 'Uniswap', status: 'confirmed' },
  { id: '4', type: 'claim', asset: 'Aave Rewards', symbol: 'AAVE', amount: 2.5, value: 800, timestamp: '2 hours ago', location: 'Aave', status: 'confirmed' },
  { id: '5', type: 'transfer_in', asset: 'Bitcoin', symbol: 'BTC', amount: 0.5, value: 52500, timestamp: '3 hours ago', location: 'Cold Wallet', status: 'confirmed' },
  { id: '6', type: 'sell', asset: 'Solana', symbol: 'SOL', amount: 100, value: 22000, timestamp: '5 hours ago', location: 'Coinbase', status: 'pending' },
];

const typeConfig = {
  buy: { icon: ArrowDownLeft, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Buy' },
  sell: { icon: ArrowUpRight, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Sell' },
  transfer_in: { icon: ArrowDownLeft, color: 'text-accent-blue', bg: 'bg-accent-blue/10', label: 'Transfer In' },
  transfer_out: { icon: ArrowUpRight, color: 'text-accent-orange', bg: 'bg-accent-orange/10', label: 'Transfer Out' },
  swap: { icon: RefreshCw, color: 'text-accent-purple', bg: 'bg-accent-purple/10', label: 'Swap' },
  stake: { icon: Coins, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10', label: 'Stake' },
  unstake: { icon: Coins, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Unstake' },
  claim: { icon: Droplets, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Claim' },
};

export function RecentTransactions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4"
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
      {/* Header */}
      <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
        <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
          Recent Transactions
        </h3>
        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Last 24 hours</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockTransactions.map((tx) => {
          const config = typeConfig[tx.type];
          const Icon = config.icon;

          return (
            <div
              key={tx.id}
              className={cn(
                'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{tx.asset}</p>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-medium',
                      config.bg, config.color
                    )}>
                      {config.label}
                    </span>
                    {tx.status === 'pending' && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent-yellow/10 text-accent-yellow">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                    <span>{tx.timestamp}</span>
                    <span>·</span>
                    <span>{tx.location}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                  {tx.type === 'sell' || tx.type === 'transfer_out' ? '-' : '+'}{tx.amount.toLocaleString()} {tx.symbol !== 'SWAP' ? tx.symbol : ''}
                </p>
                <p className={cn('text-[9px] tabular-nums', isDark ? 'text-white/30' : 'text-gray-500')}>
                  ${tx.value.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={cn('flex items-center justify-between mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
          {mockTransactions.length} transactions
        </span>
        <button className="text-[10px] text-accent-blue hover:underline">View all transactions →</button>
      </div>
    </div>
  );
}
