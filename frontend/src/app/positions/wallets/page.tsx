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
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  chain: string;
  chainColor: string;
  type: 'hot' | 'cold' | 'hardware';
  totalValue: number;
  tokens: number;
  nfts: number;
  topAssets: { symbol: string; balance: number; value: number }[];
}

const mockWallets: WalletAccount[] = [
  {
    id: '1',
    name: 'Main ETH Wallet',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE24',
    chain: 'Ethereum',
    chainColor: '#627eea',
    type: 'hot',
    totalValue: 280000,
    tokens: 15,
    nfts: 3,
    topAssets: [
      { symbol: 'ETH', balance: 45.5, value: 182000 },
      { symbol: 'USDC', balance: 50000, value: 50000 },
      { symbol: 'LINK', balance: 1500, value: 42000 },
    ],
  },
  {
    id: '2',
    name: 'Ledger Nano X',
    address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
    chain: 'Ethereum',
    chainColor: '#627eea',
    type: 'hardware',
    totalValue: 180000,
    tokens: 8,
    nfts: 0,
    topAssets: [
      { symbol: 'ETH', balance: 30, value: 120000 },
      { symbol: 'WBTC', balance: 0.5, value: 52500 },
      { symbol: 'UNI', balance: 500, value: 7500 },
    ],
  },
  {
    id: '3',
    name: 'Solana Treasury',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    chain: 'Solana',
    chainColor: '#00ffa3',
    type: 'hot',
    totalValue: 150000,
    tokens: 6,
    nfts: 12,
    topAssets: [
      { symbol: 'SOL', balance: 500, value: 110000 },
      { symbol: 'JTO', balance: 10000, value: 25000 },
      { symbol: 'BONK', balance: 50000000, value: 15000 },
    ],
  },
  {
    id: '4',
    name: 'Cold Storage BTC',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    chain: 'Bitcoin',
    chainColor: '#f7931a',
    type: 'cold',
    totalValue: 315000,
    tokens: 1,
    nfts: 0,
    topAssets: [
      { symbol: 'BTC', balance: 3, value: 315000 },
    ],
  },
  {
    id: '5',
    name: 'Arbitrum Operations',
    address: '0x4E5B2e1dc63F6b91cb6Cd759936495434C7e972F',
    chain: 'Arbitrum',
    chainColor: '#28a0f0',
    type: 'hot',
    totalValue: 95000,
    tokens: 10,
    nfts: 0,
    topAssets: [
      { symbol: 'ETH', balance: 12, value: 48000 },
      { symbol: 'ARB', balance: 20000, value: 44000 },
      { symbol: 'GMX', balance: 50, value: 3000 },
    ],
  },
];

const typeConfig = {
  hot: { label: 'Hot Wallet', color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
  cold: { label: 'Cold Storage', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  hardware: { label: 'Hardware', color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
};

export default function WalletsPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalValue = mockWallets.reduce((sum, w) => sum + w.totalValue, 0);
  const totalTokens = mockWallets.reduce((sum, w) => sum + w.tokens, 0);
  const totalNfts = mockWallets.reduce((sum, w) => sum + w.nfts, 0);

  const handleCopy = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredWallets = mockWallets.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.chain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)',
      }}
    >
      {/* Futuristic gradient overlays */}
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

      <Sidebar />

      <div className="pl-[200px] transition-all duration-300 relative z-10">
        <Header />

        <main className="p-5">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
                <span>Positions</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-text-secondary">Wallets</span>
              </div>
              <h1 className="text-lg font-semibold text-text-primary">Wallet Positions</h1>
              <p className="text-[11px] text-text-muted mt-0.5">
                Monitore todas as suas carteiras em diferentes blockchains
              </p>
            </div>
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors">
              <Plus className="w-4 h-4" />
              Add Wallet
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Value', value: `$${(totalValue / 1000).toFixed(0)}K`, icon: Wallet, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
              { label: 'Wallets Connected', value: mockWallets.length.toString(), icon: Wallet, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
              { label: 'Total Tokens', value: totalTokens.toString(), icon: Wallet, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
              { label: 'NFTs Held', value: totalNfts.toString(), icon: Wallet, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[1px]"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)' }}
                />
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                  <card.icon className={cn('w-4 h-4', card.color)} />
                </div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">{card.label}</p>
                <p className="text-[20px] font-semibold text-text-primary tabular-nums">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Wallet Cards */}
          <div className="space-y-3">
            {filteredWallets.map((wallet) => {
              const type = typeConfig[wallet.type];

              return (
                <div
                  key={wallet.id}
                  className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)' }}
                  />
                  {/* Wallet Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${wallet.chainColor}20` }}
                      >
                        <Wallet className="w-5 h-5" style={{ color: wallet.chainColor }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-text-primary">{wallet.name}</h3>
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-medium', type.bg, type.color)}>
                            {type.label}
                          </span>
                          {wallet.type === 'hardware' && (
                            <Shield className="w-3.5 h-3.5 text-accent-purple" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: wallet.chainColor }}
                          />
                          <span className="text-[10px] text-text-muted">{wallet.chain}</span>
                          <span className="text-[10px] text-text-muted">·</span>
                          <span className="text-[10px] text-text-secondary font-mono">
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                          </span>
                          <button
                            onClick={() => handleCopy(wallet.id, wallet.address)}
                            className="p-1 hover:bg-white/[0.05] rounded transition-colors"
                          >
                            {copiedId === wallet.id ? (
                              <CheckCircle2 className="w-3 h-3 text-status-success" />
                            ) : (
                              <Copy className="w-3 h-3 text-text-muted" />
                            )}
                          </button>
                          <a
                            href="#"
                            className="p-1 hover:bg-white/[0.05] rounded transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 text-text-muted" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-semibold text-text-primary tabular-nums">
                        ${wallet.totalValue.toLocaleString()}
                      </p>
                      <span className="text-[10px] text-text-muted">
                        {wallet.tokens} tokens · {wallet.nfts} NFTs
                      </span>
                    </div>
                  </div>

                  {/* Top Assets */}
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Holdings</p>
                    <div className="grid grid-cols-3 gap-2">
                      {wallet.topAssets.map((asset) => (
                        <div
                          key={asset.symbol}
                          className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium text-text-primary">{asset.symbol}</span>
                          </div>
                          <p className="text-[10px] text-text-muted tabular-nums">
                            {asset.balance.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-text-secondary tabular-nums">
                            ${(asset.value / 1000).toFixed(1)}K
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
