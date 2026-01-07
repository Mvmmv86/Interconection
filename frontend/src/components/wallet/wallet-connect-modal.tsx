'use client';

import { useState } from 'react';
import {
  X,
  Wallet,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWallet,
  EVM_WALLETS,
  SOLANA_WALLETS,
  formatAddress,
  type EVMWalletType,
  type SolanaWalletType,
} from '@/contexts/wallet-context';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'evm' | 'solana';
}

export function WalletConnectModal({ isOpen, onClose, initialTab = 'evm' }: WalletConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'evm' | 'solana'>(initialTab);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const {
    evmWallet,
    solanaWallet,
    isConnecting,
    connectionError,
    connectEVMWallet,
    connectSolanaWallet,
    disconnectEVMWallet,
    disconnectSolanaWallet,
  } = useWallet();

  if (!isOpen) return null;

  const handleEVMConnect = async (type: EVMWalletType) => {
    setConnectingWallet(type);
    await connectEVMWallet(type);
    setConnectingWallet(null);
  };

  const handleSolanaConnect = async (type: SolanaWalletType) => {
    setConnectingWallet(type);
    await connectSolanaWallet(type);
    setConnectingWallet(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.98) 0%, rgba(18, 20, 28, 0.98) 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-accent-purple" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-text-primary">Connect Wallet</h2>
              <p className="text-[10px] text-text-muted">Connect your wallets to track positions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Tabs */}
        <div className="flex p-2 gap-2 border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab('evm')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-medium transition-colors',
              activeTab === 'evm'
                ? 'bg-[#627eea]/15 text-[#627eea]'
                : 'bg-white/[0.03] text-text-muted hover:text-text-secondary'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-[#627eea]" />
            EVM Networks
            {evmWallet && <CheckCircle className="w-3.5 h-3.5 text-status-success" />}
          </button>
          <button
            onClick={() => setActiveTab('solana')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-medium transition-colors',
              activeTab === 'solana'
                ? 'bg-[#9945ff]/15 text-[#9945ff]'
                : 'bg-white/[0.03] text-text-muted hover:text-text-secondary'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-[#9945ff]" />
            Solana
            {solanaWallet && <CheckCircle className="w-3.5 h-3.5 text-status-success" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Connection Error */}
          {connectionError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-status-error/10 border border-status-error/20">
              <AlertCircle className="w-4 h-4 text-status-error shrink-0" />
              <p className="text-[11px] text-status-error">{connectionError}</p>
            </div>
          )}

          {/* EVM Wallets */}
          {activeTab === 'evm' && (
            <div className="space-y-2">
              {evmWallet ? (
                <div className="p-4 rounded-xl bg-status-success/5 border border-status-success/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{evmWallet.icon}</span>
                      <div>
                        <p className="text-[12px] font-medium text-text-primary">{evmWallet.label}</p>
                        <p className="text-[10px] text-text-muted">Connected</p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-status-success" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03]">
                    <code className="text-[11px] text-text-secondary font-mono">
                      {formatAddress(evmWallet.address, 6)}
                    </code>
                    <button
                      onClick={disconnectEVMWallet}
                      className="text-[10px] text-status-error hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-text-muted mb-3">
                    Connect an EVM wallet to track positions on Ethereum, Arbitrum, Base, and more
                  </p>
                  {Object.entries(EVM_WALLETS).map(([type, wallet]) => (
                    <button
                      key={type}
                      onClick={() => handleEVMConnect(type as EVMWalletType)}
                      disabled={isConnecting}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                        'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]',
                        isConnecting && connectingWallet === type && 'border-accent-purple/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <span className="text-[12px] font-medium text-text-primary">{wallet.name}</span>
                      </div>
                      {isConnecting && connectingWallet === type ? (
                        <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Solana Wallets */}
          {activeTab === 'solana' && (
            <div className="space-y-2">
              {solanaWallet ? (
                <div className="p-4 rounded-xl bg-status-success/5 border border-status-success/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{solanaWallet.icon}</span>
                      <div>
                        <p className="text-[12px] font-medium text-text-primary">{solanaWallet.label}</p>
                        <p className="text-[10px] text-text-muted">Connected</p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-status-success" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03]">
                    <code className="text-[11px] text-text-secondary font-mono">
                      {formatAddress(solanaWallet.address, 6)}
                    </code>
                    <button
                      onClick={disconnectSolanaWallet}
                      className="text-[10px] text-status-error hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-text-muted mb-3">
                    Connect a Solana wallet to track positions on Orca, Raydium, Meteora, and more
                  </p>
                  {Object.entries(SOLANA_WALLETS).map(([type, wallet]) => (
                    <button
                      key={type}
                      onClick={() => handleSolanaConnect(type as SolanaWalletType)}
                      disabled={isConnecting}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                        'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]',
                        isConnecting && connectingWallet === type && 'border-accent-purple/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <span className="text-[12px] font-medium text-text-primary">{wallet.name}</span>
                      </div>
                      {isConnecting && connectingWallet === type ? (
                        <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-text-muted">
              By connecting, you agree to our Terms of Service
            </p>
            <a
              href="#"
              className="flex items-center gap-1 text-[9px] text-accent-blue hover:underline"
            >
              Learn more
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
