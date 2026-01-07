'use client';

import { Building2, Wallet, Layers, Coins, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface LocationGroup {
  id: string;
  name: string;
  type: 'exchange' | 'defi' | 'wallet' | 'staking';
  value: number;
  positions: number;
  change24h: number;
  topAssets: string[];
}

const locationGroups: LocationGroup[] = [
  { id: '1', name: 'Binance', type: 'exchange', value: 456000, positions: 12, change24h: 2.3, topAssets: ['BTC', 'ETH', 'UNI'] },
  { id: '2', name: 'Aave V3', type: 'defi', value: 350000, positions: 5, change24h: 3.8, topAssets: ['ETH', 'USDC', 'WBTC'] },
  { id: '3', name: 'Coinbase', type: 'exchange', value: 234000, positions: 8, change24h: 1.8, topAssets: ['SOL', 'ETH', 'BTC'] },
  { id: '4', name: 'Lido', type: 'staking', value: 200000, positions: 2, change24h: 4.2, topAssets: ['stETH'] },
  { id: '5', name: 'Ledger Nano', type: 'wallet', value: 180000, positions: 6, change24h: 2.1, topAssets: ['BTC', 'ETH', 'MATIC'] },
  { id: '6', name: 'Uniswap V3', type: 'defi', value: 176000, positions: 4, change24h: 5.2, topAssets: ['ARB/ETH', 'USDC/ETH'] },
  { id: '7', name: 'Kraken', type: 'exchange', value: 140000, positions: 5, change24h: -0.5, topAssets: ['LINK', 'DOT', 'XRP'] },
  { id: '8', name: 'Eigenlayer', type: 'staking', value: 80000, positions: 1, change24h: 6.8, topAssets: ['ETH'] },
];

const typeConfig = {
  exchange: { icon: Building2, color: 'text-accent-blue', bg: 'bg-accent-blue/10', link: '/positions/exchanges' },
  defi: { icon: Layers, color: 'text-accent-purple', bg: 'bg-accent-purple/10', link: '/positions/defi' },
  wallet: { icon: Wallet, color: 'text-accent-orange', bg: 'bg-accent-orange/10', link: '/positions/wallets' },
  staking: { icon: Coins, color: 'text-status-success', bg: 'bg-status-success/10', link: '/positions/staking' },
};

export function PositionsByLocation() {
  const groupedByType = locationGroups.reduce((acc, loc) => {
    if (!acc[loc.type]) acc[loc.type] = [];
    acc[loc.type].push(loc);
    return acc;
  }, {} as Record<string, LocationGroup[]>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {(['exchange', 'defi', 'staking', 'wallet'] as const).map((type) => {
        const config = typeConfig[type];
        const Icon = config.icon;
        const locations = groupedByType[type] || [];
        const totalValue = locations.reduce((sum, l) => sum + l.value, 0);

        return (
          <div
            key={type}
            className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', config.bg)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div>
                  <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider capitalize">
                    {type === 'defi' ? 'DeFi Protocols' : type === 'staking' ? 'Staking' : type === 'exchange' ? 'Exchanges' : 'Wallets'}
                  </h3>
                  <p className="text-[10px] text-text-muted">{locations.length} connected</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-semibold text-text-primary tabular-nums">
                  ${(totalValue / 1000).toFixed(0)}K
                </p>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {locations.slice(0, 3).map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[9px] font-bold text-text-secondary">
                      {location.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-text-primary">{location.name}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                        <span>{location.positions} positions</span>
                        <span>·</span>
                        <span className="text-text-secondary">{location.topAssets.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-text-primary tabular-nums">
                      ${(location.value / 1000).toFixed(0)}K
                    </p>
                    <span
                      className={cn(
                        'text-[9px] font-medium tabular-nums',
                        location.change24h >= 0 ? 'text-status-success' : 'text-status-error'
                      )}
                    >
                      {location.change24h >= 0 ? '+' : ''}{location.change24h}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-white/[0.03]">
              <Link
                href={config.link}
                className="flex items-center justify-center gap-1.5 text-[10px] text-accent-blue hover:underline"
              >
                View all {type === 'defi' ? 'protocols' : type + 's'}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
