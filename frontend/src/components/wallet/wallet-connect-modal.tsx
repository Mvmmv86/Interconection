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
import { useTheme } from '@/contexts/theme-context';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
        className={cn(
          "absolute inset-0 backdrop-blur-sm",
          isDark ? "bg-black/60" : "bg-black/40"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.98) 0%, rgba(18, 20, 28, 0.98) 100%)'
            : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(203, 213, 225, 0.6)',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-4 border-b",
          isDark ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-accent-purple" />
            </div>
            <div>
              <h2 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                Connect Wallet
              </h2>
              <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>
                Connect your wallets to track positions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isDark
                ? "hover:bg-white/[0.05] text-white/50 hover:text-white"
                : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Tabs */}
        <div className={cn(
          "flex p-2 gap-2 border-b",
          isDark ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <button
            onClick={() => setActiveTab('evm')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-medium transition-colors',
              activeTab === 'evm'
                ? 'bg-[#627eea]/15 text-[#627eea]'
                : isDark
                  ? 'bg-white/[0.03] text-white/50 hover:text-white/70'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
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
                : isDark
                  ? 'bg-white/[0.03] text-white/50 hover:text-white/70'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
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
                        <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                          {evmWallet.label}
                        </p>
                        <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>
                          Connected
                        </p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-status-success" />
                  </div>
                  <div className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg",
                    isDark ? "bg-white/[0.03]" : "bg-gray-100"
                  )}>
                    <code className={cn("text-[11px] font-mono", isDark ? "text-white/70" : "text-gray-600")}>
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
                  <p className={cn("text-[10px] mb-3", isDark ? "text-white/50" : "text-gray-500")}>
                    Connect an EVM wallet to track positions on Ethereum, Arbitrum, Base, and more
                  </p>
                  {Object.entries(EVM_WALLETS).map(([type, wallet]) => (
                    <button
                      key={type}
                      onClick={() => handleEVMConnect(type as EVMWalletType)}
                      disabled={isConnecting}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                        isDark
                          ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300',
                        isConnecting && connectingWallet === type && 'border-accent-purple/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <span className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                          {wallet.name}
                        </span>
                      </div>
                      {isConnecting && connectingWallet === type ? (
                        <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                      ) : (
                        <ChevronRight className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
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
                        <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                          {solanaWallet.label}
                        </p>
                        <p className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-500")}>
                          Connected
                        </p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-status-success" />
                  </div>
                  <div className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg",
                    isDark ? "bg-white/[0.03]" : "bg-gray-100"
                  )}>
                    <code className={cn("text-[11px] font-mono", isDark ? "text-white/70" : "text-gray-600")}>
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
                  <p className={cn("text-[10px] mb-3", isDark ? "text-white/50" : "text-gray-500")}>
                    Connect a Solana wallet to track positions on Orca, Raydium, Meteora, and more
                  </p>
                  {Object.entries(SOLANA_WALLETS).map(([type, wallet]) => (
                    <button
                      key={type}
                      onClick={() => handleSolanaConnect(type as SolanaWalletType)}
                      disabled={isConnecting}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                        isDark
                          ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300',
                        isConnecting && connectingWallet === type && 'border-accent-purple/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <span className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                          {wallet.name}
                        </span>
                      </div>
                      {isConnecting && connectingWallet === type ? (
                        <Loader2 className="w-4 h-4 text-accent-purple animate-spin" />
                      ) : (
                        <ChevronRight className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "p-4 border-t",
          isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-gray-200 bg-gray-50/50"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn("text-[9px]", isDark ? "text-white/50" : "text-gray-500")}>
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
