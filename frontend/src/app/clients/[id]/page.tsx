'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import {
  ClientWallet,
  ClientExchange,
  ManualAsset,
  DetectedStakingPosition,
  SUPPORTED_EXCHANGES,
  UnifiedPosition,
} from '@/types/client-portfolio';

// Add Wallet Modal with Web3 Connection Support
function AddWalletModal({
  isOpen,
  onClose,
  onSave,
  isLoading,
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  isLoading: boolean;
  isDark: boolean;
}) {
  const [mode, setMode] = useState<'select' | 'manual' | 'web3'>('select');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'evm' | 'solana'>('evm');
  const [chain, setChain] = useState('ethereum');
  const [label, setLabel] = useState('');
  const [isConnectingWeb3, setIsConnectingWeb3] = useState(false);
  const [web3Error, setWeb3Error] = useState<string | null>(null);

  // Chain ID to chain name mapping
  const chainIdToName: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    8453: 'base',
  };

  if (!isOpen) return null;

  const handleWeb3Connect = async () => {
    setIsConnectingWeb3(true);
    setWeb3Error(null);

    try {
      // Check if MetaMask or other wallet is available
      const ethereum = (window as unknown as { ethereum?: {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        on: (event: string, handler: (args: unknown) => void) => void;
      } }).ethereum;

      if (!ethereum) {
        throw new Error('Nenhuma wallet encontrada. Instale MetaMask ou outra wallet EVM.');
      }

      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('Nenhuma conta encontrada. Por favor, conecte sua wallet.');
      }

      const connectedAddress = accounts[0];

      // Get chain ID
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' }) as string;
      const chainId = parseInt(chainIdHex, 16);
      const detectedChain = chainIdToName[chainId] || 'ethereum';

      // Auto-fill the form
      setAddress(connectedAddress);
      setChain(detectedChain);
      setNetwork('evm');
      setLabel('MetaMask Wallet');
      setMode('web3');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao conectar wallet';
      setWeb3Error(errorMessage);
      console.error('Web3 connection error:', error);
    } finally {
      setIsConnectingWeb3(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      address,
      network,
      chain: network === 'evm' ? chain : undefined,
      label,
      isActive: true,
    });
    // Reset form
    setAddress('');
    setLabel('');
    setMode('select');
    setWeb3Error(null);
    onClose();
  };

  const handleClose = () => {
    setMode('select');
    setAddress('');
    setLabel('');
    setWeb3Error(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={cn(
        "absolute inset-0 backdrop-blur-sm",
        isDark ? "bg-black/60" : "bg-black/40"
      )} onClick={handleClose} />
      <div
        className="relative rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.98) 0%, rgba(18, 21, 30, 0.98) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <div className={cn(
          "px-6 py-4 border-b",
          isDark ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <h2 className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>Conectar Wallet</h2>
          <p className={cn(
            "text-xs mt-1",
            isDark ? "text-white/50" : "text-gray-500"
          )}>
            {mode === 'select'
              ? 'Escolha como deseja adicionar a wallet'
              : mode === 'web3'
                ? 'Wallet conectada via MetaMask'
                : 'Digite o endereço da wallet manualmente'}
          </p>
        </div>

        {/* Selection Mode */}
        {mode === 'select' && (
          <div className="p-6 space-y-3">
            {/* MetaMask Connection Button */}
            <button
              type="button"
              onClick={handleWeb3Connect}
              disabled={isConnectingWeb3}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl transition-all",
                isDark
                  ? "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 hover:border-orange-500/40"
                  : "bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 hover:border-orange-300",
                isConnectingWeb3 && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-xl">
                🦊
              </div>
              <div className="flex-1 text-left">
                <p className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {isConnectingWeb3 ? 'Conectando...' : 'Conectar MetaMask'}
                </p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-white/50" : "text-gray-500"
                )}>
                  Conecte automaticamente sua wallet
                </p>
              </div>
              {isConnectingWeb3 && <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />}
            </button>

            {/* Manual Input Button */}
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl transition-all",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                  : "bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isDark ? "bg-white/[0.05]" : "bg-gray-100"
              )}>
                <Wallet className={cn("w-5 h-5", isDark ? "text-white/70" : "text-gray-600")} />
              </div>
              <div className="flex-1 text-left">
                <p className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  Inserir Manualmente
                </p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-white/50" : "text-gray-500"
                )}>
                  Digite o endereço para monitorar
                </p>
              </div>
            </button>

            {/* Error message */}
            {web3Error && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/20">
                <p className="text-xs text-status-error">{web3Error}</p>
              </div>
            )}

            {/* Cancel button */}
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "w-full mt-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                isDark
                  ? "text-white/50 hover:text-white/70"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Web3 Connected or Manual Mode - Show Form */}
        {(mode === 'web3' || mode === 'manual') && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Connected indicator for Web3 mode */}
            {mode === 'web3' && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg",
                isDark ? "bg-status-success/10" : "bg-green-50"
              )}>
                <Check className="w-4 h-4 text-status-success" />
                <span className={cn(
                  "text-xs font-medium",
                  isDark ? "text-status-success" : "text-green-700"
                )}>
                  Wallet conectada via MetaMask
                </span>
              </div>
            )}

            {/* Network selection - only show in manual mode */}
            {mode === 'manual' && (
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  isDark ? "text-white/70" : "text-gray-700"
                )}>
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
                        : isDark
                          ? 'bg-white/[0.02] text-white/70 border border-white/[0.06] hover:bg-white/[0.04]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
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
                        : isDark
                          ? 'bg-white/[0.02] text-white/70 border border-white/[0.06] hover:bg-white/[0.04]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    Solana
                  </button>
                </div>
              </div>
            )}

            {/* Chain selection */}
            {network === 'evm' && (
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  isDark ? "text-white/70" : "text-gray-700"
                )}>
                  Chain {mode === 'web3' && <span className="text-status-success">(detectada)</span>}
                </label>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  disabled={mode === 'web3'}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                    isDark
                      ? "bg-white/[0.02] border border-white/[0.06] text-white"
                      : "bg-white border border-gray-200 text-gray-900",
                    mode === 'web3' && "opacity-70"
                  )}
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="polygon">Polygon</option>
                  <option value="base">Base</option>
                </select>
              </div>
            )}

            {/* Address input */}
            <div>
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Endereço {mode === 'web3' && <span className="text-status-success">(conectado)</span>}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={network === 'evm' ? '0x...' : 'Solana address...'}
                required
                readOnly={mode === 'web3'}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50 font-mono",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400",
                  mode === 'web3' && "opacity-70"
                )}
              />
            </div>

            {/* Label input */}
            <div>
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Main Wallet"
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('select');
                  setAddress('');
                  setLabel('');
                }}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isDark
                    ? "text-white/70 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                    : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                )}
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={!address || isLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Adicionar Wallet
              </button>
            </div>
          </form>
        )}
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
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exchange: { exchange: string; label: string; apiKey: string; apiSecret: string }) => Promise<void>;
  isLoading: boolean;
  isDark: boolean;
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
      apiKey,
      apiSecret,
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
      <div className={cn(
        "absolute inset-0 backdrop-blur-sm",
        isDark ? "bg-black/60" : "bg-black/40"
      )} onClick={onClose} />
      <div
        className="relative rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.98) 0%, rgba(18, 21, 30, 0.98) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <div className={cn(
          "px-6 py-4 border-b",
          isDark ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <h2 className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>Conectar Exchange</h2>
          <p className={cn(
            "text-xs mt-1",
            isDark ? "text-white/50" : "text-gray-500"
          )}>
            Adicione uma API de exchange para rastrear saldos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
              Exchange *
            </label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as typeof SUPPORTED_EXCHANGES[number])}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] text-white"
                  : "bg-white border border-gray-200 text-gray-900"
              )}
            >
              {SUPPORTED_EXCHANGES.map((ex) => (
                <option key={ex} value={ex}>
                  {exchangeNames[ex] || ex}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Binance Principal"
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                  : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
              )}
            />
          </div>

          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
              API Key *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua API Key"
              required
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                  : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
              )}
            />
          </div>

          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
              API Secret *
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Sua API Secret"
              required
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                  : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
              )}
            />
          </div>

          <p className={cn(
            "text-[10px] p-2 rounded",
            isDark ? "text-white/50 bg-white/[0.02]" : "text-gray-500 bg-gray-50"
          )}>
            Use permissões apenas de leitura na sua API. Nunca habilite trading ou saque.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                isDark
                  ? "text-white/70 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                  : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
              )}
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
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  isLoading: boolean;
  isDark: boolean;
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
      <div className={cn(
        "absolute inset-0 backdrop-blur-sm",
        isDark ? "bg-black/60" : "bg-black/40"
      )} onClick={onClose} />
      <div
        className="relative rounded-xl shadow-2xl w-full max-w-lg mx-4 my-8 overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.98) 0%, rgba(18, 21, 30, 0.98) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <div className={cn(
          "px-6 py-4 border-b",
          isDark ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <h2 className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>Adicionar Ativo</h2>
          <p className={cn(
            "text-xs mt-1",
            isDark ? "text-white/50" : "text-gray-500"
          )}>
            Adicione um ativo manualmente para rastrear PnL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Token Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Token *
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="ETH"
                required
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                )}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {commonTokens.slice(0, 5).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToken(t)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] rounded",
                      isDark
                        ? "bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Nome
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Ethereum"
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>
          </div>

          {/* Network */}
          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
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
                      : isDark
                        ? 'bg-white/[0.02] text-white/70 border border-white/[0.06] hover:bg-white/[0.04]'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {n.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
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
                      : isDark
                        ? 'bg-white/[0.02] text-white/70 border border-white/[0.06] hover:bg-white/[0.04]'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
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
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Quantidade *
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                required
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "block text-xs font-medium mb-1.5",
                isDark ? "text-white/70" : "text-gray-700"
              )}>
                Preço de Compra (USD) *
              </label>
              <input
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                required
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                  isDark
                    ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                    : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className={cn(
              "block text-xs font-medium mb-1.5",
              isDark ? "text-white/70" : "text-gray-700"
            )}>
              Data da Compra *
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                isDark
                  ? "bg-white/[0.02] border border-white/[0.06] text-white"
                  : "bg-white border border-gray-200 text-gray-900"
              )}
            />
          </div>

          {/* Staking fields */}
          {(type === 'staking' || type === 'lending') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  isDark ? "text-white/70" : "text-gray-700"
                )}>
                  Provedor
                </label>
                <input
                  type="text"
                  value={stakingProvider}
                  onChange={(e) => setStakingProvider(e.target.value)}
                  placeholder="Lido, Marinade..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                    isDark
                      ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                      : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                  )}
                />
              </div>
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  isDark ? "text-white/70" : "text-gray-700"
                )}>
                  APY (%)
                </label>
                <input
                  type="number"
                  step="any"
                  value={apy}
                  onChange={(e) => setApy(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-blue/50",
                    isDark
                      ? "bg-white/[0.02] border border-white/[0.06] text-white placeholder:text-white/30"
                      : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400"
                  )}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                isDark
                  ? "text-white/70 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                  : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
              )}
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
  isDark,
}: {
  wallet: ClientWallet;
  onRemove: () => void;
  isDark: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg transition-colors",
      isDark
        ? "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08]"
        : "bg-gray-50 border border-gray-200 hover:border-gray-300"
    )}>
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
          <p className={cn(
            "text-sm font-medium",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {wallet.label || shortAddress}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-mono",
              isDark ? "text-white/50" : "text-gray-500"
            )}>{shortAddress}</span>
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
          className={cn(
            "p-1.5 rounded transition-colors",
            isDark
              ? "text-white/50 hover:text-white hover:bg-white/[0.04]"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onRemove}
          className={cn(
            "p-1.5 rounded hover:text-status-error hover:bg-status-error/5 transition-colors",
            isDark ? "text-white/50" : "text-gray-400"
          )}
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
  isDark,
}: {
  exchange: ClientExchange;
  onRemove: () => void;
  isDark: boolean;
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
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg transition-colors",
      isDark
        ? "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08]"
        : "bg-gray-50 border border-gray-200 hover:border-gray-300"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-orange/10 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-accent-orange" />
        </div>
        <div>
          <p className={cn(
            "text-sm font-medium",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {exchange.label || exchangeNames[exchange.exchange]}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs",
              isDark ? "text-white/50" : "text-gray-500"
            )}>
              {exchangeNames[exchange.exchange]}
            </span>
            <span className={cn(
              "text-[10px] font-mono",
              isDark ? "text-white/50" : "text-gray-500"
            )}>
              API: {exchange.apiKeyMasked}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {exchange.lastSync && (
          <span className={cn(
            "text-[10px] mr-2",
            isDark ? "text-white/50" : "text-gray-500"
          )}>
            Sync: {new Date(exchange.lastSync).toLocaleDateString()}
          </span>
        )}
        <button
          onClick={onRemove}
          className={cn(
            "p-1.5 rounded hover:text-status-error hover:bg-status-error/5 transition-colors",
            isDark ? "text-white/50" : "text-gray-400"
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Detected Position Card
function DetectedPositionCard({
  position,
  isDark,
}: {
  position: DetectedStakingPosition;
  isDark: boolean;
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className={cn(
      "p-4 rounded-lg transition-colors",
      isDark
        ? "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08]"
        : "bg-gray-50 border border-gray-200 hover:border-gray-300"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-purple/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>{position.protocol}</p>
            <p className={cn("text-xs", isDark ? "text-white/50" : "text-gray-500")}>{position.stakedToken}</p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-status-success/10 text-status-success capitalize">
          {position.type}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>Staked</p>
          <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>{position.amount.toLocaleString()} {position.token}</p>
          <p className={cn("text-xs", isDark ? "text-white/50" : "text-gray-500")}>{formatCurrency(position.valueUsd)}</p>
        </div>
        <div>
          <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>APY</p>
          <p className="text-sm font-semibold text-accent-purple">{position.apy.toFixed(2)}%</p>
        </div>
        <div>
          <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>Pending Rewards</p>
          <p className="text-sm font-semibold text-status-success">
            {position.rewards.pending.toFixed(4)} {position.token}
          </p>
          <p className={cn("text-xs", isDark ? "text-white/50" : "text-gray-500")}>{formatCurrency(position.rewards.pendingUsd)}</p>
        </div>
      </div>
    </div>
  );
}

// Helper function to combine all positions into a unified list
function combineAllPositions(
  wallets: ClientWallet[],
  exchanges: ClientExchange[],
  manualAssets: ManualAsset[]
): UnifiedPosition[] {
  const positions: UnifiedPosition[] = [];

  // Add wallet tokens
  for (const wallet of wallets) {
    if (wallet.tokens) {
      for (const token of wallet.tokens) {
        positions.push({
          id: `wallet-${wallet.id}-${token.symbol}`,
          symbol: token.symbol,
          name: token.name,
          quantity: token.balance,
          valueUsd: token.balanceUsd,
          priceUsd: token.priceUsd,
          priceChange24h: token.priceChange24h,
          source: 'wallet',
          sourceId: wallet.id,
          sourceName: wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`,
          type: 'holding',
          logoUrl: token.logoUrl,
        });
      }
    }
  }

  // Add exchange balances
  for (const exchange of exchanges) {
    if (exchange.balances) {
      for (const balance of exchange.balances) {
        // Use PnL from backend if available, otherwise calculate from 24h change
        let pnl = balance.unrealizedPnl !== 0 ? balance.unrealizedPnl : undefined;
        let pnlPercent = balance.unrealizedPnlPercent !== 0 ? balance.unrealizedPnlPercent : undefined;

        // Fallback: Calculate estimated PnL from 24h price change when no cost basis available
        if (pnl === undefined && balance.change24h !== 0 && balance.valueUsd > 0.01) {
          // Calculate estimated PnL based on 24h price change
          // If change_24h = -5%, yesterday_value = today_value / 0.95
          const changeFactor = 1 + (balance.change24h / 100);
          if (changeFactor > 0) {
            const estimatedYesterdayValue = balance.valueUsd / changeFactor;
            pnl = balance.valueUsd - estimatedYesterdayValue;
            pnlPercent = balance.change24h;
          }
        }

        positions.push({
          id: `exchange-${exchange.id}-${balance.asset}`,
          symbol: balance.asset,
          name: balance.asset,
          quantity: balance.total,
          valueUsd: balance.valueUsd,
          priceUsd: balance.priceUsd,
          priceChange24h: balance.change24h,
          source: 'exchange',
          sourceId: exchange.id,
          sourceName: exchange.label || exchange.exchange,
          type: (balance.positionType as 'holding' | 'staking' | 'lending' | 'lp') || 'holding',
          pnl,
          pnlPercent,
          // Include APY from earn/staking positions
          apy: balance.apy || undefined,
        });
      }
    }
  }

  // Add manual assets
  for (const asset of manualAssets) {
    const currentValue = asset.quantity * (asset.currentPrice || asset.purchasePrice);
    const costBasis = asset.quantity * asset.purchasePrice;
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    positions.push({
      id: `manual-${asset.id}`,
      symbol: asset.token,
      name: asset.tokenName || asset.token,
      quantity: asset.quantity,
      valueUsd: currentValue,
      priceUsd: asset.currentPrice || asset.purchasePrice,
      priceChange24h: 0,
      source: 'manual',
      sourceId: asset.id,
      sourceName: 'Manual',
      type: asset.type,
      pnl,
      pnlPercent,
      apy: asset.apy,
    });
  }

  // Sort by value descending
  positions.sort((a, b) => b.valueUsd - a.valueUsd);

  return positions;
}

// Unified Position Row component
function PositionRow({
  position,
  onRemove,
  isDark,
}: {
  position: UnifiedPosition;
  onRemove?: () => void;
  isDark: boolean;
}) {
  const isProfitable = (position.pnl ?? 0) >= 0;
  const hasChange = position.priceChange24h !== 0;
  const isPositiveChange = position.priceChange24h > 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatQuantity = (value: number) => {
    if (value < 0.0001) return value.toExponential(2);
    if (value < 1) return value.toFixed(6);
    if (value < 1000) return value.toFixed(4);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const sourceColors = {
    wallet: 'bg-accent-blue/10 text-accent-blue',
    exchange: 'bg-accent-orange/10 text-accent-orange',
    manual: 'bg-accent-cyan/10 text-accent-cyan',
  };

  const sourceLabels = {
    wallet: 'Wallet',
    exchange: 'Exchange',
    manual: 'Manual',
  };

  return (
    <tr className={cn(
      "border-b transition-colors",
      isDark
        ? "border-white/[0.04] hover:bg-white/[0.01]"
        : "border-gray-100 hover:bg-gray-50/50"
    )}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {position.logoUrl ? (
            <img
              src={position.logoUrl}
              alt={position.symbol}
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
              isDark
                ? "bg-white/[0.04] text-white"
                : "bg-gray-100 text-gray-900"
            )}>
              {position.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>{position.symbol}</p>
            <p className={cn("text-xs", isDark ? "text-white/50" : "text-gray-500")}>{position.name}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            sourceColors[position.source]
          )}>
            {sourceLabels[position.source]}
          </span>
          <span className={cn("text-xs", isDark ? "text-white/50" : "text-gray-500")}>
            {position.sourceName}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>{formatQuantity(position.quantity)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <p className={cn("text-sm", isDark ? "text-white" : "text-gray-900")}>{formatCurrency(position.priceUsd)}</p>
        {hasChange && (
          <p className={cn(
            "text-xs",
            isPositiveChange ? "text-status-success" : "text-status-error"
          )}>
            {isPositiveChange ? '+' : ''}{position.priceChange24h.toFixed(2)}%
          </p>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>{formatCurrency(position.valueUsd)}</p>
      </td>
      <td className="py-3 px-4 text-right">
        {position.pnl !== undefined ? (
          <div className="flex items-center justify-end gap-2">
            <span className={cn(
              'text-sm font-medium',
              isProfitable ? 'text-status-success' : 'text-status-error'
            )}>
              {formatCurrency(position.pnl)}
            </span>
            {position.pnlPercent !== undefined && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                isProfitable ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
              )}>
                {isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%
              </span>
            )}
          </div>
        ) : (
          <span className={cn("text-xs", isDark ? "text-white/30" : "text-gray-400")}>-</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {position.apy !== undefined ? (
          <span className="text-sm text-accent-purple">{position.apy.toFixed(1)}%</span>
        ) : (
          <span className={cn("text-xs", isDark ? "text-white/30" : "text-gray-400")}>-</span>
        )}
      </td>
      <td className="py-3 px-4">
        {position.source === 'manual' && onRemove && (
          <button
            onClick={onRemove}
            className={cn(
              "p-1.5 rounded hover:text-status-error hover:bg-status-error/5 transition-colors",
              isDark ? "text-white/50" : "text-gray-400"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { isAuthenticated: isAuthed, isLoading: isAuthLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isAuthed && !isAuthLoading) {
      router.push('/login');
    }
  }, [isAuthed, isAuthLoading, router]);

  const {
    getClientPortfolio,
    selectClient,
    isLoadingPortfolio,
    addWallet,
    removeWallet,
    addExchange,
    removeExchange,
    addManualAsset,
    removeManualAsset,
    refreshClientData,
    error: clientError,
  } = useClients();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showAddExchange, setShowAddExchange] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);

  // Select client on mount to trigger portfolio fetch
  useEffect(() => {
    if (clientId) {
      selectClient(clientId);
    }
    return () => {
      selectClient(null);
    };
  }, [clientId, selectClient]);

  const portfolio = getClientPortfolio(clientId);

  if (isLoadingPortfolio && !portfolio) {
    return (
      <div
        className="min-h-screen transition-colors duration-300"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
            : '#ffffff',
        }}
      >
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
            <div className="flex items-center gap-4 mb-8">
              <Link
                href="/clients"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isDark
                    ? "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>Carregando conta...</h1>
            </div>
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-accent-blue animate-spin" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div
        className="min-h-screen transition-colors duration-300"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
            : '#ffffff',
        }}
      >
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
            <div className="text-center py-16">
              <h2 className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>Conta não encontrada</h2>
              <p className={cn(
                "text-sm mb-4",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
                {clientError || 'A conta solicitada não existe ou foi removida.'}
              </p>
              <p className={cn(
                "text-xs mb-4 font-mono",
                isDark ? "text-white/30" : "text-gray-400"
              )}>
                ID: {clientId}
              </p>
              <Link
                href="/clients"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/90 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Contas
              </Link>
            </div>
          </main>
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

  // Shared card style for summary cards and section cards
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

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
          : '#ffffff',
      }}
    >
      {/* Futuristic gradient overlays - only for dark mode */}
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

        <main className="p-5 space-y-5">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/clients"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isDark
                    ? "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                )}
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
                  <h1 className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>{client.name}</h1>
                  <p className={cn(
                    "text-[11px]",
                    isDark ? "text-white/50" : "text-gray-500"
                  )}>
                    {client.email || 'Sem email'} {client.notes && `• ${client.notes}`}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex items-center gap-2 h-9 px-4 text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50",
                isDark
                  ? "text-white/70 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                  : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Atualizar Dados
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
                <DollarSign className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Total Portfolio</span>
              </div>
              <p className={cn(
                "text-[18px] font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>{formatCurrency(summary.totalValueUsd)}</p>
            </div>

            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
                <Coins className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Staked</span>
              </div>
              <p className="text-[18px] font-bold text-accent-purple">{formatCurrency(summary.totalStakedUsd)}</p>
            </div>

            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
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
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider">Rewards Pendentes</span>
              </div>
              <p className="text-[18px] font-bold text-status-success">{formatCurrency(summary.pendingRewardsUsd)}</p>
            </div>

            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isDark ? "text-white/50" : "text-gray-500"
              )}>
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
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-accent-blue" />
                  <h2 className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>Wallets Conectadas</h2>
                  <span className={cn(
                    "text-xs",
                    isDark ? "text-white/50" : "text-gray-500"
                  )}>({wallets.length})</span>
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
                  <p className={cn(
                    "text-sm text-center py-6",
                    isDark ? "text-white/50" : "text-gray-500"
                  )}>
                    Nenhuma wallet conectada
                  </p>
                ) : (
                  wallets.map((wallet) => (
                    <WalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onRemove={() => removeWallet(wallet.id)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Exchanges */}
            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent-orange" />
                  <h2 className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>Exchanges Conectadas</h2>
                  <span className={cn(
                    "text-xs",
                    isDark ? "text-white/50" : "text-gray-500"
                  )}>({exchanges.length})</span>
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
                  <p className={cn(
                    "text-sm text-center py-6",
                    isDark ? "text-white/50" : "text-gray-500"
                  )}>
                    Nenhuma exchange conectada
                  </p>
                ) : (
                  exchanges.map((exchange) => (
                    <ExchangeCard
                      key={exchange.id}
                      exchange={exchange}
                      onRemove={() => removeExchange(exchange.id)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* All Positions */}
          {(() => {
            const allPositions = combineAllPositions(wallets, exchanges, manualAssets);
            return (
              <div
                className="rounded-xl overflow-hidden"
                style={cardStyle}
              >
                <div className={cn(
                  "flex items-center justify-between p-4 border-b",
                  isDark ? "border-white/[0.06]" : "border-gray-200"
                )}>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-accent-cyan" />
                    <h2 className={cn(
                      "text-sm font-semibold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>All Positions</h2>
                    <span className={cn(
                      "text-xs",
                      isDark ? "text-white/50" : "text-gray-500"
                    )}>({allPositions.length})</span>
                  </div>
                  <button
                    onClick={() => setShowAddAsset(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-cyan bg-accent-cyan/10 rounded-lg hover:bg-accent-cyan/15 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Manual
                  </button>
                </div>

                {allPositions.length === 0 ? (
                  <div className="text-center py-12">
                    <Coins className={cn(
                      "w-10 h-10 mx-auto mb-3",
                      isDark ? "text-white/30" : "text-gray-400"
                    )} />
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-white/50" : "text-gray-500"
                    )}>Nenhum ativo encontrado</p>
                    <p className={cn(
                      "text-xs mt-1",
                      isDark ? "text-white/30" : "text-gray-400"
                    )}>
                      Conecte uma wallet ou exchange para ver posições
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          "border-b",
                          isDark
                            ? "border-white/[0.04] bg-white/[0.01]"
                            : "border-gray-200 bg-gray-50/50"
                        )}>
                          <th className={cn("py-2 px-4 text-left text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>Token</th>
                          <th className={cn("py-2 px-4 text-left text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>Origem</th>
                          <th className={cn("py-2 px-4 text-right text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>Quantidade</th>
                          <th className={cn("py-2 px-4 text-right text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>Preço</th>
                          <th className={cn("py-2 px-4 text-right text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>Valor</th>
                          <th className={cn("py-2 px-4 text-right text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>PnL</th>
                          <th className={cn("py-2 px-4 text-right text-xs font-medium", isDark ? "text-white/50" : "text-gray-500")}>APY</th>
                          <th className="py-2 px-4 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPositions.map((position) => (
                          <PositionRow
                            key={position.id}
                            position={position}
                            onRemove={position.source === 'manual' ? () => removeManualAsset(position.sourceId) : undefined}
                            isDark={isDark}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Detected Staking Positions */}
          {detectedPositions.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={cardStyle}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-accent-purple" />
                <h2 className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>Posições de Staking Detectadas</h2>
                <span className={cn(
                  "text-xs",
                  isDark ? "text-white/50" : "text-gray-500"
                )}>({detectedPositions.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detectedPositions.map((position) => (
                  <DetectedPositionCard
                    key={position.id}
                    position={position}
                    isDark={isDark}
                  />
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
            isDark={isDark}
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
            isDark={isDark}
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
            isDark={isDark}
          />
        </main>
      </div>
    </div>
  );
}
