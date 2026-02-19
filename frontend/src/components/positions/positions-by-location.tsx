'use client';

import { Building2, Wallet, Layers, Coins, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAllPositions } from '@/hooks/useAllPositions';
import Link from 'next/link';

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(2)}`;
}

const typeConfig = {
  exchange: { icon: Building2, color: 'text-accent-blue', bg: 'bg-accent-blue/10', link: '/positions/exchanges' },
  defi: { icon: Layers, color: 'text-accent-purple', bg: 'bg-accent-purple/10', link: '/positions/defi' },
  wallet: { icon: Wallet, color: 'text-accent-orange', bg: 'bg-accent-orange/10', link: '/positions/wallets' },
  staking: { icon: Coins, color: 'text-status-success', bg: 'bg-status-success/10', link: '/positions/staking' },
};

export function PositionsByLocation() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    exchanges,
    protocols,
    wallets,
    stakingPositions,
    isLoading,
  } = useAllPositions();

  const cardStyle = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(203, 213, 225, 0.6)',
    boxShadow: isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="backdrop-blur-sm rounded-xl p-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/30' : 'text-gray-400')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate totals for each section
  const exchangesTotal = exchanges.reduce((sum, e) => sum + e.totalValue, 0);
  const protocolsTotal = protocols.reduce((sum, p) => sum + p.totalValue, 0);
  const walletsTotal = wallets.reduce((sum, w) => sum + w.totalValue, 0);
  const stakingTotal = stakingPositions.reduce((sum, s) => sum + s.stakedValue, 0);

  // Empty state component
  const EmptyState = ({ message, link, linkLabel }: { message: string; link: string; linkLabel: string }) => (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <AlertCircle className={cn('w-8 h-8 mb-2', isDark ? 'text-white/20' : 'text-gray-300')} />
      <p className={cn('text-[11px] mb-3', isDark ? 'text-white/40' : 'text-gray-500')}>
        {message}
      </p>
      <Link
        href={link}
        className="text-[10px] text-accent-blue hover:underline"
      >
        {linkLabel} →
      </Link>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Exchanges Card */}
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', typeConfig.exchange.bg)}>
              <Building2 className={cn('w-4 h-4', typeConfig.exchange.color)} />
            </div>
            <div>
              <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
                Exchanges
              </h3>
              <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                {exchanges.length} connected
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
              {formatCurrency(exchangesTotal)}
            </p>
          </div>
        </div>

        {exchanges.length > 0 ? (
          <div className="space-y-2">
            {exchanges.slice(0, 3).map((exchange) => (
              <div
                key={exchange.id}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                  isDark ? 'bg-white/[0.02] hover:bg-white/[0.04]' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold',
                    isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                  )}>
                    {exchange.logo || exchange.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{exchange.name}</p>
                    <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{exchange.positionCount} positions</span>
                      {exchange.topAssets.length > 0 && (
                        <>
                          <span>·</span>
                          <span className={isDark ? 'text-white/70' : 'text-gray-700'}>
                            {exchange.topAssets.slice(0, 3).map(a => a.symbol).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {formatCurrency(exchange.totalValue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No exchanges connected"
            link="/positions/exchanges"
            linkLabel="Add exchange"
          />
        )}

        <div className={cn('mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <Link
            href={typeConfig.exchange.link}
            className="flex items-center justify-center gap-1.5 text-[10px] text-accent-blue hover:underline"
          >
            View all exchanges
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* DeFi Protocols Card */}
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', typeConfig.defi.bg)}>
              <Layers className={cn('w-4 h-4', typeConfig.defi.color)} />
            </div>
            <div>
              <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
                DeFi Protocols
              </h3>
              <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                {protocols.length} protocol{protocols.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
              {formatCurrency(protocolsTotal)}
            </p>
          </div>
        </div>

        {protocols.length > 0 ? (
          <div className="space-y-2">
            {protocols.slice(0, 3).map((protocol) => (
              <div
                key={protocol.id}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                  isDark ? 'bg-white/[0.02] hover:bg-white/[0.04]' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {protocol.icon ? (
                    <img
                      src={protocol.icon}
                      alt={protocol.name}
                      className="w-8 h-8 rounded-lg"
                    />
                  ) : (
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold',
                      isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                    )}>
                      {protocol.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{protocol.name}</p>
                    <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{protocol.positionCount} position{protocol.positionCount !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span className={isDark ? 'text-white/70' : 'text-gray-700'}>
                        {protocol.chains.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {formatCurrency(protocol.totalValue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No DeFi positions"
            link="/positions/defi"
            linkLabel="View DeFi"
          />
        )}

        <div className={cn('mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <Link
            href={typeConfig.defi.link}
            className="flex items-center justify-center gap-1.5 text-[10px] text-accent-blue hover:underline"
          >
            View all protocols
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Staking Card */}
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', typeConfig.staking.bg)}>
              <Coins className={cn('w-4 h-4', typeConfig.staking.color)} />
            </div>
            <div>
              <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
                Staking
              </h3>
              <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                {stakingPositions.length} position{stakingPositions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
              {formatCurrency(stakingTotal)}
            </p>
          </div>
        </div>

        {stakingPositions.length > 0 ? (
          <div className="space-y-2">
            {stakingPositions.slice(0, 3).map((staking) => (
              <div
                key={staking.id}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                  isDark ? 'bg-white/[0.02] hover:bg-white/[0.04]' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {staking.protocolIcon ? (
                    <img
                      src={staking.protocolIcon}
                      alt={staking.protocol}
                      className="w-8 h-8 rounded-lg"
                    />
                  ) : (
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold',
                      isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                    )}>
                      {staking.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {staking.symbol} on {staking.protocol}
                    </p>
                    <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{staking.stakedAmount.toLocaleString()} staked</span>
                      {staking.apy && (
                        <>
                          <span>·</span>
                          <span className="text-status-success">{staking.apy.toFixed(1)}% APY</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {formatCurrency(staking.stakedValue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No staking positions"
            link="/positions/staking"
            linkLabel="View staking"
          />
        )}

        <div className={cn('mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <Link
            href={typeConfig.staking.link}
            className="flex items-center justify-center gap-1.5 text-[10px] text-accent-blue hover:underline"
          >
            View all staking
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Wallets Card */}
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <div className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', typeConfig.wallet.bg)}>
              <Wallet className={cn('w-4 h-4', typeConfig.wallet.color)} />
            </div>
            <div>
              <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
                Wallets
              </h3>
              <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                {wallets.length} connected
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
              {formatCurrency(walletsTotal)}
            </p>
          </div>
        </div>

        {wallets.length > 0 ? (
          <div className="space-y-2">
            {wallets.slice(0, 3).map((wallet) => (
              <div
                key={wallet.id}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                  isDark ? 'bg-white/[0.02] hover:bg-white/[0.04]' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold',
                    isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                  )}>
                    {wallet.name?.slice(0, 2) || wallet.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {wallet.name || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                    </p>
                    <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{wallet.positionCount} position{wallet.positionCount !== 1 ? 's' : ''}</span>
                      {wallet.topAssets.length > 0 && (
                        <>
                          <span>·</span>
                          <span className={isDark ? 'text-white/70' : 'text-gray-700'}>
                            {wallet.topAssets.slice(0, 3).map(a => a.symbol).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {formatCurrency(wallet.totalValue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No wallets tracked"
            link="/positions/wallets"
            linkLabel="Add wallet"
          />
        )}

        <div className={cn('mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <Link
            href={typeConfig.wallet.link}
            className="flex items-center justify-center gap-1.5 text-[10px] text-accent-blue hover:underline"
          >
            View all wallets
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
