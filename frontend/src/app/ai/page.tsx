'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import { AIChat, AISettings, ReportsHistory } from '@/components/ai';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-purple" />
              <h1 className={cn('text-lg font-semibold', isDark ? 'text-text-primary' : 'text-slate-900')}>
                AI Portfolio Analyst
              </h1>
            </div>
            <p className={cn('text-[11px] mt-0.5', isDark ? 'text-text-muted' : 'text-slate-500')}>
              Analista especializado em gestão de tesouraria cripto
            </p>
          </div>

          <Tabs defaultValue="chat">
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="reports">Relatórios</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <AIChat />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsHistory />
            </TabsContent>

            <TabsContent value="settings">
              <AISettings />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
