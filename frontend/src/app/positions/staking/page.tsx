'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import {
  Coins,
  TrendingUp,
  Clock,
  Gift,
  ChevronRight,
  Lock,
  Unlock,
  Timer,
  Zap,
  Users,
  ChevronDown,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClients } from '@/contexts/client-context';

interface StakingPosition {
  id: string;
  clientId?: string;
  asset: string;
  symbol: string;
  protocol: string;
  chain: string;
  chainColor: string;
  type: 'liquid' | 'locked' | 'validator';
  stakedAmount: number;
  stakedValue: number;
  apy: number;
  rewards: number;
  rewardsValue: number;
  lockPeriod?: string;
  unlockDate?: string;
  autoCompound: boolean;
}

// Mock staking positions linked to clients
const mockStakingPositions: StakingPosition[] = [
  {
    id: '1',
    clientId: 'client-1',
    asset: 'Ethereum',
    symbol: 'ETH',
    protocol: 'Lido',
    chain: 'Ethereum',
    chainColor: '#627eea',
    type: 'liquid',
    stakedAmount: 45.5,
    stakedValue: 159250,
    apy: 4.2,
    rewards: 1.92,
    rewardsValue: 6720,
    autoCompound: true,
  },
  {
    id: '2',
    clientId: 'client-1',
    asset: 'Solana',
    symbol: 'SOL',
    protocol: 'Marinade',
    chain: 'Solana',
    chainColor: '#9945ff',
    type: 'liquid',
    stakedAmount: 850,
    stakedValue: 127500,
    apy: 7.8,
    rewards: 66.3,
    rewardsValue: 9945,
    autoCompound: true,
  },
  {
    id: '3',
    clientId: 'client-3',
    asset: 'Cosmos',
    symbol: 'ATOM',
    protocol: 'Stride',
    chain: 'Cosmos',
    chainColor: '#2e3148',
    type: 'locked',
    stakedAmount: 5000,
    stakedValue: 45000,
    apy: 18.5,
    rewards: 925,
    rewardsValue: 8325,
    lockPeriod: '21 days',
    unlockDate: '2024-02-15',
    autoCompound: false,
  },
  {
    id: '4',
    clientId: 'client-2',
    asset: 'Solana',
    symbol: 'SOL',
    protocol: 'Jito',
    chain: 'Solana',
    chainColor: '#9945ff',
    type: 'liquid',
    stakedAmount: 1200,
    stakedValue: 180000,
    apy: 8.5,
    rewards: 102,
    rewardsValue: 15300,
    autoCompound: true,
  },
  {
    id: '5',
    clientId: 'client-1',
    asset: 'Ethereum',
    symbol: 'ETH',
    protocol: 'Rocket Pool',
    chain: 'Ethereum',
    chainColor: '#627eea',
    type: 'validator',
    stakedAmount: 32,
    stakedValue: 112000,
    apy: 4.8,
    rewards: 1.54,
    rewardsValue: 5390,
    autoCompound: false,
  },
  {
    id: '6',
    clientId: 'client-2',
    asset: 'Ethereum',
    symbol: 'ETH',
    protocol: 'Lido',
    chain: 'Ethereum',
    chainColor: '#627eea',
    type: 'liquid',
    stakedAmount: 25,
    stakedValue: 87500,
    apy: 4.2,
    rewards: 1.05,
    rewardsValue: 3675,
    autoCompound: true,
  },
];

const typeConfig = {
  liquid: { label: 'Liquid', color: 'text-status-success', bg: 'bg-status-success/10', icon: Unlock },
  locked: { label: 'Locked', color: 'text-accent-orange', bg: 'bg-accent-orange/10', icon: Lock },
  validator: { label: 'Validator', color: 'text-accent-purple', bg: 'bg-accent-purple/10', icon: Zap },
};

// Client Filter Dropdown Component
function ClientFilter({
  selectedClientId,
  onSelect,
}: {
  selectedClientId: string | null;
  onSelect: (clientId: string | null) => void;
}) {
  const { clients } = useClients();
  const [isOpen, setIsOpen] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-lg border transition-colors',
          selectedClientId
            ? 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
            : 'bg-white/[0.03] border-white/[0.06] text-text-secondary hover:bg-white/[0.05]'
        )}
      >
        <Users className="w-4 h-4" />
        <span className="text-[11px] font-medium">
          {selectedClient ? selectedClient.name : 'Todos Clientes'}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-56 bg-bg-secondary border border-white/[0.06] rounded-xl shadow-xl overflow-hidden">
            {/* All Clients Option */}
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors',
                !selectedClientId
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-white/[0.04]'
              )}
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Users className="w-3 h-3" />
              </div>
              <span>Todos Clientes</span>
            </button>

            <div className="border-t border-white/[0.04] my-1" />

            {/* Client List */}
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  onSelect(client.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors',
                  selectedClientId === client.id
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-secondary hover:bg-white/[0.04]'
                )}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold"
                  style={{ backgroundColor: client.color + '20', color: client.color }}
                >
                  {client.name.slice(0, 2).toUpperCase()}
                </div>
                <span>{client.name}</span>
              </button>
            ))}

            <div className="border-t border-white/[0.04] my-1" />

            {/* Add New Client Link */}
            <Link
              href="/clients"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-accent-blue hover:bg-accent-blue/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gerenciar Clientes</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function StakingPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { clients } = useClients();
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Filter positions based on client and type
  const filteredPositions = useMemo(() => {
    let positions = mockStakingPositions;

    if (selectedClientId) {
      positions = positions.filter((p) => p.clientId === selectedClientId);
    }

    if (filterType !== 'all') {
      positions = positions.filter((p) => p.type === filterType);
    }

    return positions;
  }, [selectedClientId, filterType]);

  // Calculate stats based on filtered positions
  const stats = useMemo(() => {
    const totalStaked = filteredPositions.reduce((sum, p) => sum + p.stakedValue, 0);
    const totalRewards = filteredPositions.reduce((sum, p) => sum + p.rewardsValue, 0);
    const avgApy = filteredPositions.length > 0
      ? filteredPositions.reduce((sum, p) => sum + p.apy, 0) / filteredPositions.length
      : 0;
    const liquidStaked = filteredPositions
      .filter((p) => p.type === 'liquid')
      .reduce((sum, p) => sum + p.stakedValue, 0);

    return { totalStaked, totalRewards, avgApy, liquidStaked };
  }, [filteredPositions]);

  const getClientById = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find((c) => c.id === clientId);
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
                <span className={isDark ? "text-white/50" : "text-gray-600"}>Staking</span>
              </div>
              <h1 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>Staking Positions</h1>
              <p className={cn("text-[11px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>
                Gerencie suas posições de staking, delegações e validadores
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ClientFilter
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
              />
              <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors">
                <Coins className="w-4 h-4" />
                Stake Assets
              </button>
            </div>
          </div>

          {/* Selected Client Banner */}
          {selectedClientId && (
            <div className="mb-5">
              {(() => {
                const client = getClientById(selectedClientId);
                if (!client) return null;
                return (
                  <div
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{
                      backgroundColor: client.color + '10',
                      borderColor: client.color + '30',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: client.color + '20', color: client.color }}
                      >
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>{client.name}</p>
                        <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                          {filteredPositions.length} posições de staking
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/clients/${client.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
                      style={{ backgroundColor: client.color + '20', color: client.color }}
                    >
                      Ver Portfolio
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Staked', value: stats.totalStaked, icon: Coins, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
              { label: 'Liquid Staking', value: stats.liquidStaked, icon: Unlock, color: 'text-status-success', bg: 'bg-status-success/10' },
              { label: 'Pending Rewards', value: stats.totalRewards, icon: Gift, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
              { label: 'Average APY', value: stats.avgApy, icon: TrendingUp, color: 'text-accent-orange', bg: 'bg-accent-orange/10', isPercentage: true },
            ].map((card) => (
              <div
                key={card.label}
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
                  style={{
                    background: isDark
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                  }}
                />
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                  <card.icon className={cn('w-4 h-4', card.color)} />
                </div>
                <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {card.isPercentage ? `${card.value.toFixed(1)}%` : `$${card.value.toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 mb-4">
            <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Type:</span>
            {['all', 'liquid', 'locked', 'validator'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-colors',
                  filterType === type
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'bg-white/[0.03] text-text-secondary hover:bg-white/[0.05]'
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Empty State */}
          {filteredPositions.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center relative overflow-hidden"
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
              <Coins className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-white/30" : "text-gray-500")} />
              <h3 className={cn("text-sm font-semibold mb-1", isDark ? "text-white" : "text-gray-900")}>
                Nenhuma posição encontrada
              </h3>
              <p className={cn("text-[11px] mb-4", isDark ? "text-white/30" : "text-gray-500")}>
                {selectedClientId
                  ? 'Este cliente não possui posições de staking'
                  : 'Não há posições de staking com os filtros selecionados'}
              </p>
              {selectedClientId && (
                <Link
                  href={`/clients/${selectedClientId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-purple text-white text-[11px] font-medium rounded-lg hover:bg-accent-purple/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Staking
                </Link>
              )}
            </div>
          ) : (
            /* Staking Cards */
            <div className="space-y-3">
              {filteredPositions.map((position) => {
                const typeInfo = typeConfig[position.type];
                const TypeIcon = typeInfo.icon;
                const client = getClientById(position.clientId);

                return (
                  <div
                    key={position.id}
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
                      style={{
                        background: isDark
                          ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                          : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                      }}
                    />
                    {/* Position Header */}
                    <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold", isDark ? "bg-white/[0.05] text-white/50" : "bg-gray-100 text-gray-600")}>
                          {position.symbol}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>{position.asset}</h3>
                            <span className={cn('px-2 py-0.5 rounded text-[9px] font-medium', typeInfo.bg, typeInfo.color)}>
                              <TypeIcon className="w-3 h-3 inline mr-1" />
                              {typeInfo.label}
                            </span>
                            {/* Client Badge */}
                            {client && !selectedClientId && (
                              <Link
                                href={`/clients/${client.id}`}
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-colors hover:opacity-80"
                                style={{ backgroundColor: client.color + '15', color: client.color }}
                              >
                                <Users className="w-2.5 h-2.5" />
                                {client.name}
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: position.chainColor }}
                            />
                            <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>{position.chain}</span>
                            <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                            <span className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-600")}>{position.protocol}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          ${position.stakedValue.toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[11px] font-medium text-status-success tabular-nums">
                            +{position.apy}% APY
                          </span>
                          {position.autoCompound && (
                            <span className="text-[9px] text-accent-cyan">Auto-compound</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Position Details */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                        <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Staked Amount</p>
                        <p className={cn("text-[13px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          {position.stakedAmount.toLocaleString()} {position.symbol}
                        </p>
                      </div>
                      <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                        <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Pending Rewards</p>
                        <p className="text-[13px] font-medium text-status-success tabular-nums">
                          +{position.rewards.toLocaleString()} {position.symbol}
                        </p>
                        <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>${position.rewardsValue.toLocaleString()}</p>
                      </div>
                      {position.type === 'locked' ? (
                        <>
                          <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                            <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Lock Period</p>
                            <div className="flex items-center gap-1.5">
                              <Timer className="w-3 h-3 text-accent-orange" />
                              <p className={cn("text-[13px] font-medium", isDark ? "text-white" : "text-gray-900")}>{position.lockPeriod}</p>
                            </div>
                          </div>
                          <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                            <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Unlock Date</p>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-accent-yellow" />
                              <p className={cn("text-[13px] font-medium", isDark ? "text-white" : "text-gray-900")}>{position.unlockDate}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                            <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Est. Yearly</p>
                            <p className={cn("text-[13px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                              ${((position.stakedValue * position.apy) / 100).toLocaleString()}
                            </p>
                          </div>
                          <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                            <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Est. Monthly</p>
                            <p className={cn("text-[13px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                              ${Math.round((position.stakedValue * position.apy) / 100 / 12).toLocaleString()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className={cn("mt-3 pt-3 border-t flex items-center justify-between", isDark ? "border-white/[0.03]" : "border-gray-100")}>
                      <div className="flex items-center gap-2">
                        {position.type === 'liquid' && (
                          <span className="text-[9px] text-status-success flex items-center gap-1">
                            <Unlock className="w-3 h-3" />
                            Instantly withdrawable
                          </span>
                        )}
                        {position.type === 'locked' && (
                          <span className="text-[9px] text-accent-orange flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Unbonding required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {position.rewardsValue > 0 && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan text-[10px] font-medium hover:bg-accent-cyan/20 transition-colors">
                            <Gift className="w-3 h-3" />
                            Claim ${position.rewardsValue.toLocaleString()}
                          </button>
                        )}
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-text-secondary text-[10px] font-medium hover:bg-white/[0.08] transition-colors">
                          <Coins className="w-3 h-3" />
                          Stake More
                        </button>
                        {position.type === 'liquid' && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-text-secondary text-[10px] font-medium hover:bg-white/[0.08] transition-colors">
                            <Unlock className="w-3 h-3" />
                            Unstake
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Staking Summary */}
          {filteredPositions.length > 0 && (
            <div
              className="mt-5 rounded-xl p-4 relative overflow-hidden"
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
                style={{
                  background: isDark
                    ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                    : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                }}
              />
              <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                <h3 className={cn("text-[12px] font-semibold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
                  Staking Rewards Summary
                  {selectedClientId && (
                    <span className={cn("font-normal ml-2", isDark ? "text-white/30" : "text-gray-500")}>
                      • {getClientById(selectedClientId)?.name}
                    </span>
                  )}
                </h3>
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className={cn("text-[10px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Total Earned</p>
                  <p className="text-[16px] font-semibold text-status-success tabular-nums">
                    +${Math.round(stats.totalRewards * 1.2).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={cn("text-[10px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Claimed</p>
                  <p className={cn("text-[16px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                    ${Math.round(stats.totalRewards * 0.4).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={cn("text-[10px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Pending</p>
                  <p className="text-[16px] font-semibold text-accent-cyan tabular-nums">
                    ${stats.totalRewards.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={cn("text-[10px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Auto-Compounded</p>
                  <p className="text-[16px] font-semibold text-accent-purple tabular-nums">
                    ${Math.round(stats.totalRewards * 0.3).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
