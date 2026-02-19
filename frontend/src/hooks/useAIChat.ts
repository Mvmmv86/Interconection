import { useState, useCallback } from 'react';
import { AIMessage, PortfolioContext } from '@/types/ai';
import { useAllPositions } from './useAllPositions';
import { usePortfolioRisk } from './usePortfolioRisk';

export function useAIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { positions, summary, distributionByType, distributionByChain } = useAllPositions();
  const { metrics } = usePortfolioRisk(positions, summary);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build full context from portfolio data
      const context: PortfolioContext = {
        summary,
        topPositions: positions.slice(0, 10),
        riskMetrics: metrics,
        distributionByType,
        distributionByChain,
        totalValue: summary.totalValue,
        positionCount: summary.totalPositionCount,
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], context }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';

      const aiMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Stream response
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        aiContent += chunk;

        setMessages(prev =>
          prev.map(m => (m.id === aiMessage.id ? { ...m, content: aiContent } : m))
        );
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Verifique suas configurações de API.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, positions, summary, metrics, distributionByType, distributionByChain]);

  const clearMessages = () => setMessages([]);

  return { messages, sendMessage, isLoading, clearMessages };
}
