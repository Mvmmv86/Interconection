'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAIChat } from '@/hooks/useAIChat';
import { useAISettings } from '@/contexts/ai-settings-context';
import ReactMarkdown from 'react-markdown';

export function AIChat() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { messages, sendMessage, isLoading, clearMessages } = useAIChat();
  const { isConfigured } = useAISettings();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  if (!isConfigured) {
    return (
      <div
        className={cn(
          'rounded-2xl p-8 text-center border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-gray-50 border-gray-200'
        )}
      >
        <Sparkles className={cn('w-12 h-12 mx-auto mb-4', isDark ? 'text-white/20' : 'text-gray-300')} />
        <h3 className={cn('text-base font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          Configure sua API Key
        </h3>
        <p className={cn('text-[13px]', isDark ? 'text-white/60' : 'text-gray-600')}>
          Vá para a aba &ldquo;Configurações&rdquo; para adicionar sua chave da Anthropic ou OpenAI.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border flex flex-col',
        isDark
          ? 'bg-white/[0.02] border-white/[0.06]'
          : 'bg-white border-gray-200'
      )}
      style={{ height: 'calc(100vh - 280px)' }}
    >
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Sparkles className={cn('w-16 h-16 mx-auto mb-4', isDark ? 'text-white/20' : 'text-gray-300')} />
              <h3 className={cn('text-base font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                AI Portfolio Analyst
              </h3>
              <p className={cn('text-[13px] mb-4', isDark ? 'text-white/60' : 'text-gray-600')}>
                Especialista em gestão de tesouraria cripto. Faça perguntas sobre seu portfólio, estratégias e riscos.
              </p>
              <div className={cn('text-[11px] space-y-1', isDark ? 'text-white/40' : 'text-gray-500')}>
                <p>• &ldquo;Qual é o meu AUM total?&rdquo;</p>
                <p>• &ldquo;Quais são os maiores riscos do meu portfólio?&rdquo;</p>
                <p>• &ldquo;Como posso diversificar melhor?&rdquo;</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      isDark ? 'bg-accent-purple/20' : 'bg-accent-purple/10'
                    )}
                  >
                    <Sparkles className="w-4 h-4 text-accent-purple" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3 border',
                    message.role === 'user'
                      ? isDark
                        ? 'bg-accent-purple/10 border-accent-purple/20 text-white'
                        : 'bg-accent-purple/5 border-accent-purple/20 text-gray-900'
                      : isDark
                      ? 'bg-white/[0.03] border-white/[0.06] text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div
                      className={cn(
                        'prose prose-sm max-w-none',
                        isDark ? 'prose-invert' : ''
                      )}
                    >
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px]">{message.content}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      isDark ? 'bg-white/10' : 'bg-gray-200'
                    )}
                  >
                    <span className="text-[13px] font-semibold">U</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          'p-4 border-t',
          isDark ? 'border-white/[0.06]' : 'border-gray-200'
        )}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta sobre seu portfólio..."
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-[13px] border transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent-purple/50',
              isDark
                ? 'bg-white/[0.03] border-white/[0.06] text-white placeholder-white/40'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'px-4 py-2.5 rounded-xl transition-all text-[13px] font-medium',
              'flex items-center gap-2 shrink-0',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDark
                ? 'bg-accent-purple hover:bg-accent-purple/90 text-white'
                : 'bg-accent-purple hover:bg-accent-purple/90 text-white'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisando...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </>
            )}
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearMessages}
            className={cn(
              'text-[11px] mt-2 transition-colors',
              isDark
                ? 'text-white/40 hover:text-white/60'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            Limpar conversa
          </button>
        )}
      </form>
    </div>
  );
}
