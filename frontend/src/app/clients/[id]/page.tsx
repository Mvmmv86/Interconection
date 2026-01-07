'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Wallet,
  Building2,
  TrendingUp,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Coins,
  Percent,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import { useClients } from '@/contexts/client-context';
import {
  ClientWallet,
  ClientExchange,
  ManualAsset,
  DetectedStakingPosition,
  SUPPORTED_EXCHANGES,
} from '@/types/client-portfolio';

// Add Wallet Modal
function AddWalletModal({
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  isLoading: boolean;
}) {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'evm' | 'solana'>('evm');
  const [chain, setChain] = useState('ethereum');
  const [label, setLabel] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      address,
      network,
      chain: network === 'evm' ? chain : undefined,
      label,
      isActive: true,
    });
    setAddress('');
    setLabel('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-text-primary">Conectar Wallet</h2>
          <p className="text-xs text-text-muted mt-1">
            Adicione uma wallet para rastrear ativos e staking
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Rede *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNetwork('evm')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  network === 'evm'
                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30'
                    : 'bg-white/[0.02] text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]'
                )}
              >
                EVM
              </button>
              <button
                type="button"
                onClick={() => setNetwork('solana')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  network === 'solana'
                    ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/30'
                    : 'bg-white/[0.02] text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]'
                )}
              >
                Solana
              </button>
            </div>
          </div>

          {network === 'evm' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Chain
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue/50"
              >
                <option value="ethereum">Ethereum</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="polygon">Polygon</option>
                <option value="base">Base</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Endereço *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={network === 'evm' ? '0x...' : 'Solana address...'}
              required
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Main Wallet"
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!address || isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Conectar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Exchange Modal
function AddExchangeModal({
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exchange: Omit<ClientExchange, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  isLoading: boolean;
}) {
  const [exchange, setExchange] = useState<typeof SUPPORTED_EXCHANGES[number]>('binance');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      exchange,
      label,
      apiKeyMasked: `****${apiKey.slice(-4)}`,
      isActive: true,
    });
    setLabel('');
    setApiKey('');
    setApiSecret('');
    onClose();
  };

  const exchangeNames: Record<string, string> = {
    binance: 'Binance',
    coinbase: 'Coinbase',
    kraken: 'Kraken',
    bybit: 'Bybit',
    okx: 'OKX',
    kucoin: 'KuCoin',
    gateio: 'Gate.io',
    mexc: 'MEXC',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-text-primary">Conectar Exchange</h2>
          <p className="text-xs text-text-muted mt-1">
            Adicione uma API de exchange para rastrear saldos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Exchange *
            </label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as typeof SUPPORTED_EXCHANGES[number])}
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue/50"
            >
              {SUPPORTED_EXCHANGES.map((ex) => (
                <option key={ex} value={ex}>
                  {exchangeNames[ex] || ex}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Binance Principal"
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              API Key *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua API Key"
              required
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              API Secret *
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Sua API Secret"
              required
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          <p className="text-[10px] text-text-muted bg-white/[0.02] p-2 rounded">
            Use permissões apenas de leitura na sua API. Nunca habilite trading ou saque.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!apiKey || !apiSecret || isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Conectar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Manual Asset Modal
function AddAssetModal({
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  isLoading: boolean;
}) {
  const [token, setToken] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [network, setNetwork] = useState<'evm' | 'solana' | 'bitcoin' | 'other'>('evm');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [type, setType] = useState<'holding' | 'staking' | 'lending' | 'lp'>('holding');
  const [stakingProvider, setStakingProvider] = useState('');
  const [apy, setApy] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      token,
      tokenName,
      network,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      purchaseDate: new Date(purchaseDate).toISOString(),
      type,
      stakingProvider: stakingProvider || undefined,
      apy: apy ? parseFloat(apy) : undefined,
    });
    // Reset form
    setToken('');
    setTokenName('');
    setQuantity('');
    setPurchasePrice('');
    setPurchaseDate('');
    setStakingProvider('');
    setApy('');
    onClose();
  };

  const commonTokens = ['ETH', 'BTC', 'SOL', 'USDC', 'USDT', 'ATOM', 'DOT', 'MATIC', 'ARB', 'OP'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-lg mx-4 my-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-text-primary">Adicionar Ativo</h2>
          <p className="text-xs text-text-muted mt-1">
            Adicione um ativo manualmente para rastrear PnL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Token Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Token *
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="ETH"
                required
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {commonTokens.slice(0, 5).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToken(t)}
                    className="px-2 py-0.5 text-[10px] bg-white/[0.02] text-text-muted rounded hover:bg-white/[0.04]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Nome
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Ethereum"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
              />
            </div>
          </div>

          {/* Network */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Rede
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['evm', 'solana', 'bitcoin', 'other'] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNetwork(n)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    network === n
                      ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30'
                      : 'bg-white/[0.02] text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]'
                  )}
                >
                  {n.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Tipo *
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['holding', 'staking', 'lending', 'lp'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                    type === t
                      ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/30'
                      : 'bg-white/[0.02] text-text-secondary border border-white/[0.06] hover:bg-white/[0.04]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Quantidade *
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Preço de Compra (USD) *
              </label>
              <input
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Data da Compra *
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          {/* Staking fields */}
          {(type === 'staking' || type === 'lending') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Provedor
                </label>
                <input
                  type="text"
                  value={stakingProvider}
                  onChange={(e) => setStakingProvider(e.target.value)}
                  placeholder="Lido, Marinade..."
                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  APY (%)
                </label>
                <input
                  type="number"
                  step="any"
                  value={apy}
                  onChange={(e) => setApy(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!token || !quantity || !purchasePrice || !purchaseDate || isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Wallet Card
function WalletCard({
  wallet,
  onRemove,
}: {
  wallet: ClientWallet;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg hover:border-white/[0.08] transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          wallet.network === 'evm' ? 'bg-accent-blue/10' : 'bg-accent-purple/10'
        )}>
          <Wallet className={cn(
            'w-4 h-4',
            wallet.network === 'evm' ? 'text-accent-blue' : 'text-accent-purple'
          )} />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {wallet.label || shortAddress}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-mono">{shortAddress}</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              wallet.network === 'evm' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-accent-purple/10 text-accent-purple'
            )}>
              {wallet.network.toUpperCase()}
              {wallet.chain && ` - ${wallet.chain}`}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={copyAddress}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Exchange Card
function ExchangeCard({
  exchange,
  onRemove,
}: {
  exchange: ClientExchange;
  onRemove: () => void;
}) {
  const exchangeNames: Record<string, string> = {
    binance: 'Binance',
    coinbase: 'Coinbase',
    kraken: 'Kraken',
    bybit: 'Bybit',
    okx: 'OKX',
    kucoin: 'KuCoin',
    gateio: 'Gate.io',
    mexc: 'MEXC',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg hover:border-white/[0.08] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-orange/10 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-accent-orange" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {exchange.label || exchangeNames[exchange.exchange]}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {exchangeNames[exchange.exchange]}
            </span>
            <span className="text-[10px] text-text-muted font-mono">
              API: {exchange.apiKeyMasked}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {exchange.lastSync && (
          <span className="text-[10px] text-text-muted mr-2">
            Sync: {new Date(exchange.lastSync).toLocaleDateString()}
          </span>
        )}
        <button
          onClick={onRemove}
          className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Asset Row
function AssetRow({
  asset,
  onRemove,
}: {
  asset: ManualAsset;
  onRemove: () => void;
}) {
  const currentValue = asset.quantity * (asset.currentPrice || asset.purchasePrice);
  const costBasis = asset.quantity * asset.purchasePrice;
  const pnl = currentValue - costBasis;
  const pnlPercent = (pnl / costBasis) * 100;
  const isProfitable = pnl >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.01] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-xs font-bold text-text-primary">
            {asset.token.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{asset.token}</p>
            <p className="text-xs text-text-muted">{asset.tokenName || asset.token}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
          asset.type === 'holding' && 'bg-accent-blue/10 text-accent-blue',
          asset.type === 'staking' && 'bg-accent-purple/10 text-accent-purple',
          asset.type === 'lending' && 'bg-accent-orange/10 text-accent-orange',
          asset.type === 'lp' && 'bg-accent-cyan/10 text-accent-cyan'
        )}>
          {asset.type}
        </span>
        {asset.stakingProvider && (
          <span className="text-xs text-text-muted ml-2">{asset.stakingProvider}</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-text-primary">{asset.quantity.toLocaleString()}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-text-primary">{formatCurrency(asset.purchasePrice)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm text-text-primary">{formatCurrency(asset.currentPrice || asset.purchasePrice)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm font-medium text-text-primary">{formatCurrency(currentValue)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={cn(
            'text-sm font-medium',
            isProfitable ? 'text-status-success' : 'text-status-error'
          )}>
            {formatCurrency(pnl)}
          </span>
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            isProfitable ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
          )}>
            {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        {asset.apy && (
          <span className="text-sm text-accent-purple">{asset.apy.toFixed(1)}%</span>
        )}
      </td>
      <td className="py-3 px-4">
        <button
          onClick={onRemove}
          className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// Detected Position Card
function DetectedPositionCard({ position }: { position: DetectedStakingPosition }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-lg hover:border-white/[0.08] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-purple/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{position.protocol}</p>
            <p className="text-xs text-text-muted">{position.stakedToken}</p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-status-success/10 text-status-success capitalize">
          {position.type}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-text-muted">Staked</p>
          <p className="text-sm font-semibold text-text-primary">{position.amount.toLocaleString()} {position.token}</p>
          <p className="text-xs text-text-muted">{formatCurrency(position.valueUsd)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">APY</p>
          <p className="text-sm font-semibold text-accent-purple">{position.apy.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Pending Rewards</p>
          <p className="text-sm font-semibold text-status-success">
            {position.rewards.pending.toFixed(4)} {position.token}
          </p>
          <p className="text-xs text-text-muted">{formatCurrency(position.rewards.pendingUsd)}</p>
        </div>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;

  const {
    getClientPortfolio,
    addWallet,
    removeWallet,
    addExchange,
    removeExchange,
    addManualAsset,
    removeManualAsset,
    refreshClientData,
  } = useClients();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showAddExchange, setShowAddExchange] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);

  const portfolio = getClientPortfolio(clientId);

  if (!portfolio) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Cliente não encontrado</h2>
          <p className="text-sm text-text-muted mb-4">O cliente solicitado não existe ou foi removido.</p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Clientes
          </Link>
        </div>
      </div>
    );
  }

  const { client, wallets, exchanges, manualAssets, detectedPositions, summary } = portfolio;
  const isProfitable = summary.totalPnlUsd >= 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshClientData(clientId);
    setIsRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

        <main className="p-5 space-y-5">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/clients"
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: client.color + '20', color: client.color }}
                >
                  {client.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-text-primary">{client.name}</h1>
                  <p className="text-[11px] text-text-muted">
                    {client.email || 'Sem email'} {client.notes && `• ${client.notes}`}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 h-9 px-4 text-[11px] font-medium text-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Atualizar Dados
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Total Portfolio</span>
              </div>
              <p className="text-[18px] font-bold text-text-primary">{formatCurrency(summary.totalValueUsd)}</p>
            </div>

            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Coins className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Staked</span>
              </div>
              <p className="text-[18px] font-bold text-accent-purple">{formatCurrency(summary.totalStakedUsd)}</p>
            </div>

            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">PnL Total</span>
              </div>
              <p className={cn('text-[18px] font-bold', isProfitable ? 'text-status-success' : 'text-status-error')}>
                {formatCurrency(summary.totalPnlUsd)}
              </p>
              <span className={cn('text-[10px]', isProfitable ? 'text-status-success' : 'text-status-error')}>
                {isProfitable ? '+' : ''}{summary.totalPnlPercent.toFixed(2)}%
              </span>
            </div>

            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Rewards Pendentes</span>
              </div>
              <p className="text-[18px] font-bold text-status-success">{formatCurrency(summary.pendingRewardsUsd)}</p>
            </div>

            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Percent className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">APY Médio</span>
              </div>
              <p className="text-[18px] font-bold text-accent-cyan">{summary.averageApy.toFixed(1)}%</p>
            </div>
          </div>

          {/* Connections Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Wallets */}
            <div
              className="rounded-xl border border-white/[0.08] p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              }}
            >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-accent-blue" />
              <h2 className="text-sm font-semibold text-text-primary">Wallets Conectadas</h2>
              <span className="text-xs text-text-muted">({wallets.length})</span>
            </div>
            <button
              onClick={() => setShowAddWallet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-blue bg-accent-blue/10 rounded-lg hover:bg-accent-blue/15 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {wallets.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">
                Nenhuma wallet conectada
              </p>
            ) : (
              wallets.map((wallet) => (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  onRemove={() => removeWallet(wallet.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Exchanges */}
        <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-orange" />
              <h2 className="text-sm font-semibold text-text-primary">Exchanges Conectadas</h2>
              <span className="text-xs text-text-muted">({exchanges.length})</span>
            </div>
            <button
              onClick={() => setShowAddExchange(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-orange bg-accent-orange/10 rounded-lg hover:bg-accent-orange/15 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {exchanges.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">
                Nenhuma exchange conectada
              </p>
            ) : (
              exchanges.map((exchange) => (
                <ExchangeCard
                  key={exchange.id}
                  exchange={exchange}
                  onRemove={() => removeExchange(exchange.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Manual Assets */}
      <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-sm font-semibold text-text-primary">Ativos Manuais</h2>
            <span className="text-xs text-text-muted">({manualAssets.length})</span>
          </div>
          <button
            onClick={() => setShowAddAsset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-cyan bg-accent-cyan/10 rounded-lg hover:bg-accent-cyan/15 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Ativo
          </button>
        </div>

        {manualAssets.length === 0 ? (
          <div className="text-center py-12">
            <Coins className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">Nenhum ativo adicionado manualmente</p>
            <button
              onClick={() => setShowAddAsset(true)}
              className="mt-3 text-xs text-accent-blue hover:underline"
            >
              Adicionar primeiro ativo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="py-2 px-4 text-left text-xs font-medium text-text-muted">Token</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-text-muted">Tipo</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">Quantidade</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">Preço Compra</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">Preço Atual</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">Valor</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">PnL</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-text-muted">APY</th>
                  <th className="py-2 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {manualAssets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onRemove={() => removeManualAsset(asset.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detected Staking Positions */}
      {detectedPositions.length > 0 && (
        <div className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent-purple" />
            <h2 className="text-sm font-semibold text-text-primary">Posições de Staking Detectadas</h2>
            <span className="text-xs text-text-muted">({detectedPositions.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedPositions.map((position) => (
              <DetectedPositionCard key={position.id} position={position} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddWalletModal
        isOpen={showAddWallet}
        onClose={() => setShowAddWallet(false)}
        onSave={async (wallet) => {
          setIsActionLoading(true);
          await addWallet(clientId, wallet);
          setIsActionLoading(false);
        }}
        isLoading={isActionLoading}
      />

      <AddExchangeModal
        isOpen={showAddExchange}
        onClose={() => setShowAddExchange(false)}
        onSave={async (exchange) => {
          setIsActionLoading(true);
          await addExchange(clientId, exchange);
          setIsActionLoading(false);
        }}
        isLoading={isActionLoading}
      />

          <AddAssetModal
            isOpen={showAddAsset}
            onClose={() => setShowAddAsset(false)}
            onSave={async (asset) => {
              setIsActionLoading(true);
              await addManualAsset(clientId, asset);
              setIsActionLoading(false);
            }}
            isLoading={isActionLoading}
          />
        </main>
      </div>
    </div>
  );
}
