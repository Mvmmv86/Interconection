'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { AIConfig } from '@/types/ai';
import { AI_STORAGE_KEY } from '@/lib/ai/ai-constants';

interface AISettingsContextType {
  config: AIConfig | null;
  isConfigured: boolean;
  updateConfig: (provider: 'anthropic' | 'openai', apiKey: string) => Promise<void>;
  clearConfig: () => void;
  isLoading: boolean;
}

const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);

export function AISettingsProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(AI_STORAGE_KEY);
      if (stored) {
        setConfig(JSON.parse(stored));
      }
      setIsLoading(false);
    }
  }, []);

  const updateConfig = async (provider: 'anthropic' | 'openai', apiKey: string) => {
    // Test API key first
    const response = await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });

    if (!response.ok) {
      throw new Error('Invalid API key or connection failed');
    }

    const masked = apiKey.slice(0, 7) + '...' + apiKey.slice(-4);
    const newConfig: AIConfig = { provider, apiKey: masked, isConfigured: true };

    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const clearConfig = () => {
    localStorage.removeItem(AI_STORAGE_KEY);
    setConfig(null);
  };

  return (
    <AISettingsContext.Provider
      value={{
        config,
        isConfigured: !!config?.isConfigured,
        updateConfig,
        clearConfig,
        isLoading,
      }}
    >
      {children}
    </AISettingsContext.Provider>
  );
}

export const useAISettings = () => {
  const context = useContext(AISettingsContext);
  if (!context) throw new Error('useAISettings must be used within AISettingsProvider');
  return context;
};
