'use client';

import { ArrowUpRight, ArrowDownLeft, RefreshCw, Coins, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div
      className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
          Recent Transactions
        </h3>
        <span className="text-[10px] text-text-muted">Last 24 hours</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockTransactions.map((tx) => {
          const config = typeConfig[tx.type];
          const Icon = config.icon;

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bg)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-medium text-text-primary">{tx.asset}</p>
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
                  <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                    <span>{tx.timestamp}</span>
                    <span>·</span>
                    <span>{tx.location}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-text-primary tabular-nums">
                  {tx.type === 'sell' || tx.type === 'transfer_out' ? '-' : '+'}{tx.amount.toLocaleString()} {tx.symbol !== 'SWAP' ? tx.symbol : ''}
                </p>
                <p className="text-[9px] text-text-muted tabular-nums">
                  ${tx.value.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
        <span className="text-[10px] text-text-muted">
          {mockTransactions.length} transactions
        </span>
        <button className="text-[10px] text-accent-blue hover:underline">View all transactions →</button>
      </div>
    </div>
  );
}
