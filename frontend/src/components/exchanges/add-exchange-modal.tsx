'use client';

import { useState } from 'react';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { api } from '@/lib/api/client';

// Supported exchanges with their info
const EXCHANGES = [
  {
    id: 'bybit',
    name: 'Bybit',
    logo: 'BY',
    color: '#F7A600',
    supportsSpot: true,
    supportsFutures: true,
    supportsMargin: true,
    requiresPassphrase: false,
    enabled: true,
    apiGuideUrl: 'https://www.bybit.com/app/user/api-management',
  },
  {
    id: 'bingx',
    name: 'BingX',
    logo: 'BX',
    color: '#111827',
    supportsSpot: true,
    supportsFutures: true,
    supportsMargin: false,
    requiresPassphrase: false,
    enabled: true,
    apiGuideUrl: 'https://bingx.com/en/accounts/api',
  },
  {
    id: 'binance',
    name: 'Binance',
    logo: 'BN',
    color: '#F3BA2F',
    supportsSpot: true,
    supportsFutures: true,
    supportsMargin: true,
    requiresPassphrase: false,
    enabled: false, // Coming soon
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: 'CB',
    color: '#0052FF',
    supportsSpot: true,
    supportsFutures: false,
    supportsMargin: false,
    requiresPassphrase: false,
    enabled: false,
  },
  {
    id: 'kraken',
    name: 'Kraken',
    logo: 'KR',
    color: '#5741D9',
    supportsSpot: true,
    supportsFutures: false,
    supportsMargin: true,
    requiresPassphrase: false,
    enabled: false,
  },
  {
    id: 'okx',
    name: 'OKX',
    logo: 'OK',
    color: '#000000',
    supportsSpot: true,
    supportsFutures: true,
    supportsMargin: true,
    requiresPassphrase: true,
    enabled: false,
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    logo: 'KC',
    color: '#23AF91',
    supportsSpot: true,
    supportsFutures: false,
    supportsMargin: false,
    requiresPassphrase: true,
    enabled: false,
  },
];

interface AddExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onSuccess: () => void;
}

type Step = 'select' | 'credentials' | 'testing' | 'success' | 'error';

export function AddExchangeModal({ isOpen, onClose, clientId, onSuccess }: AddExchangeModalProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>('select');
  const [selectedExchange, setSelectedExchange] = useState<typeof EXCHANGES[0] | null>(null);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    assetsFound: number;
    totalValue: number;
  } | null>(null);

  const resetState = () => {
    setStep('select');
    setSelectedExchange(null);
    setLabel('');
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
    setShowSecret(false);
    setIsLoading(false);
    setError(null);
    setTestResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelectExchange = (exchange: typeof EXCHANGES[0]) => {
    if (!exchange.enabled) return;
    setSelectedExchange(exchange);
    setLabel(`${exchange.name} Account`);
    setStep('credentials');
  };

  const handleTestConnection = async () => {
    if (!selectedExchange) return;

    setIsLoading(true);
    setError(null);
    setStep('testing');

    try {
      const result = await api.testExchangeConnection({
        exchange: selectedExchange.id,
        api_key: apiKey,
        api_secret: apiSecret,
      });

      if (result.success && result.data?.success) {
        setTestResult({
          assetsFound: result.data.assets_found,
          totalValue: Number(result.data.total_value_usd),
        });
        setStep('success');
      } else {
        setError(result.data?.message || result.error || 'Connection test failed');
        setStep('error');
      }
    } catch {
      setError('Failed to connect to server');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExchange = async () => {
    if (!selectedExchange) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.createClientExchange(clientId, {
        exchange: selectedExchange.id,
        label,
        api_key: apiKey,
        api_secret: apiSecret,
      });

      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        setError(result.error || 'Failed to save exchange');
      }
    } catch {
      setError('Failed to save exchange');
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'select' ? 'Add Exchange' : selectedExchange?.name}
      size="lg"
    >
      {/* Step 1: Select Exchange */}
      {step === 'select' && (
        <div className="space-y-4">
          <p className={cn("text-sm", isDark ? "text-white/60" : "text-gray-600")}>
            Select an exchange to connect. We only request read-only access to view your balances.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EXCHANGES.map((exchange) => (
              <button
                key={exchange.id}
                onClick={() => handleSelectExchange(exchange)}
                disabled={!exchange.enabled}
                className={cn(
                  'p-4 rounded-xl border transition-all text-left',
                  isDark
                    ? 'bg-[rgba(22,25,35,0.95)] border-[rgba(255,255,255,0.08)]'
                    : 'bg-white border-gray-200 shadow-sm',
                  exchange.enabled
                    ? isDark
                      ? 'hover:border-accent-purple cursor-pointer hover:scale-[1.02]'
                      : 'hover:border-accent-purple hover:shadow-md cursor-pointer hover:scale-[1.02]'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: exchange.color }}
                  >
                    {exchange.logo}
                  </div>
                  <div>
                    <div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>
                      {exchange.name}
                    </div>
                    {!exchange.enabled && (
                      <div className={cn("text-xs", isDark ? "text-white/40" : "text-gray-400")}>
                        Coming soon
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {exchange.supportsSpot && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isDark
                        ? "bg-status-success/20 text-status-success"
                        : "bg-green-100 text-green-700"
                    )}>
                      Spot
                    </span>
                  )}
                  {exchange.supportsFutures && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isDark
                        ? "bg-accent-purple/20 text-accent-purple"
                        : "bg-purple-100 text-purple-700"
                    )}>
                      Futures
                    </span>
                  )}
                  {exchange.supportsMargin && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isDark
                        ? "bg-accent-orange/20 text-accent-orange"
                        : "bg-orange-100 text-orange-700"
                    )}>
                      Margin
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Enter Credentials */}
      {step === 'credentials' && selectedExchange && (
        <div className="space-y-6">
          <div className={cn(
            "flex items-center gap-3 p-4 rounded-xl border",
            isDark
              ? "bg-accent-blue/10 border-accent-blue/20"
              : "bg-blue-50 border-blue-200"
          )}>
            <AlertCircle className={cn("w-5 h-5 flex-shrink-0", isDark ? "text-accent-blue" : "text-blue-600")} />
            <p className={cn("text-sm", isDark ? "text-white/70" : "text-blue-800")}>
              We recommend creating a <strong>read-only</strong> API key for security.
              Never share your API secret with anyone.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
                Label
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Main Trading Account"
              />
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
                API Key
              </label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
                API Secret
              </label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter your API secret"
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
                    isDark
                      ? "text-white/40 hover:text-white"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {selectedExchange.requiresPassphrase && (
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
                  Passphrase (if set)
                </label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter your passphrase"
                />
              </div>
            )}
          </div>

          {selectedExchange.apiGuideUrl && (
            <a
              href={selectedExchange.apiGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 text-sm hover:underline",
                isDark ? "text-accent-blue" : "text-blue-600"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              How to create an API key on {selectedExchange.name}
            </a>
          )}

          <ModalFooter>
            <Button variant="secondary" onClick={() => setStep('select')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={!apiKey || !apiSecret || apiKey.length < 10 || apiSecret.length < 10}
            >
              Test Connection
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </ModalFooter>
        </div>
      )}

      {/* Step 3: Testing Connection */}
      {step === 'testing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-accent-purple animate-spin mb-4" />
          <p className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>
            Testing connection...
          </p>
          <p className={cn("text-sm mt-1", isDark ? "text-white/60" : "text-gray-500")}>
            Verifying your API credentials with {selectedExchange?.name}
          </p>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && testResult && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4",
              isDark ? "bg-status-success/20" : "bg-green-100"
            )}>
              <Check className={cn("w-8 h-8", isDark ? "text-status-success" : "text-green-600")} />
            </div>
            <p className={cn("font-medium text-lg", isDark ? "text-white" : "text-gray-900")}>
              Connection Successful!
            </p>
            <p className={cn("text-sm mt-1", isDark ? "text-white/60" : "text-gray-500")}>
              Found {testResult.assetsFound} assets worth ${testResult.totalValue.toLocaleString()}
            </p>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setStep('credentials')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleSaveExchange} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Exchange
            </Button>
          </ModalFooter>
        </div>
      )}

      {/* Step 5: Error */}
      {step === 'error' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4",
              isDark ? "bg-status-error/20" : "bg-red-100"
            )}>
              <AlertCircle className={cn("w-8 h-8", isDark ? "text-status-error" : "text-red-600")} />
            </div>
            <p className={cn("font-medium text-lg", isDark ? "text-white" : "text-gray-900")}>
              Connection Failed
            </p>
            <p className={cn("text-sm mt-2 text-center max-w-md", isDark ? "text-status-error" : "text-red-600")}>
              {error || 'Unable to connect to the exchange. Please check your credentials.'}
            </p>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setStep('credentials')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}
