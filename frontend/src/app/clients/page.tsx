'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import { useClients } from '@/contexts/client-context';
import { Client, ClientPortfolioSummary } from '@/types/client-portfolio';

// Create/Edit Client Modal
function ClientModal({
  isOpen,
  onClose,
  client,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  onSave: (data: { name: string; email?: string; notes?: string }) => Promise<void>;
  isLoading: boolean;
}) {
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [notes, setNotes] = useState(client?.notes || '');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name, email: email || undefined, notes: notes || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-text-primary">
            {client ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <p className="text-xs text-text-muted mt-1">
            {client ? 'Atualize as informações do cliente' : 'Adicione um novo cliente ao sistema'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Fundo Alpha"
              required
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o cliente..."
              rows={3}
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 resize-none"
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
              disabled={!name || isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              {client ? 'Salvar' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  clientName: string;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-status-error/10 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-status-error" />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-2">
            Excluir Cliente
          </h3>
          <p className="text-sm text-text-muted mb-6">
            Tem certeza que deseja excluir <span className="text-text-primary font-medium">{clientName}</span>? Esta ação não pode ser desfeita e todos os dados serão perdidos.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-status-error rounded-lg hover:bg-status-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client Card Component
function ClientCard({
  client,
  summary,
  onEdit,
  onDelete,
}: {
  client: Client;
  summary: ClientPortfolioSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isProfitable = summary.totalPnlUsd >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="group relative bg-white/[0.02] border border-white/[0.04] rounded-xl hover:border-white/[0.08] hover:bg-white/[0.03] transition-all duration-200">
      {/* Color indicator */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
        style={{ backgroundColor: client.color }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: client.color + '20', color: client.color }}
            >
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <Link
                href={`/clients/${client.id}`}
                className="text-sm font-semibold text-text-primary hover:text-accent-blue transition-colors flex items-center gap-1"
              >
                {client.name}
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <p className="text-xs text-text-muted">
                {client.email || 'Sem email'}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-bg-secondary border border-white/[0.06] rounded-lg shadow-xl py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.04] flex items-center gap-2 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-xs text-status-error/80 hover:text-status-error hover:bg-status-error/5 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          {/* Total Value */}
          <div>
            <p className="text-xs text-text-muted mb-0.5">Total Portfolio</p>
            <p className="text-lg font-bold text-text-primary">
              {formatCurrency(summary.totalValueUsd)}
            </p>
          </div>

          {/* PnL */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
              isProfitable ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
            )}>
              {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatCurrency(Math.abs(summary.totalPnlUsd))}
            </div>
            <span className={cn(
              'text-xs font-medium',
              isProfitable ? 'text-status-success' : 'text-status-error'
            )}>
              {formatPercent(summary.totalPnlPercent)}
            </span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.04]">
            <div>
              <div className="flex items-center gap-1 text-text-muted mb-0.5">
                <Wallet className="w-3 h-3" />
                <span className="text-[10px]">Wallets</span>
              </div>
              <p className="text-sm font-semibold text-text-primary">{summary.walletCount}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-text-muted mb-0.5">
                <Building2 className="w-3 h-3" />
                <span className="text-[10px]">Exchanges</span>
              </div>
              <p className="text-sm font-semibold text-text-primary">{summary.exchangeCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">APY Médio</p>
              <p className="text-sm font-semibold text-accent-purple">
                {summary.averageApy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Notes preview */}
        {client.notes && (
          <p className="mt-3 pt-3 border-t border-white/[0.04] text-xs text-text-muted line-clamp-2">
            {client.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// Summary Stats Component
function SummaryStats({ summaries }: { summaries: ClientPortfolioSummary[] }) {
  const totalValue = summaries.reduce((sum, s) => sum + s.totalValueUsd, 0);
  const totalPnl = summaries.reduce((sum, s) => sum + s.totalPnlUsd, 0);
  const totalStaked = summaries.reduce((sum, s) => sum + s.totalStakedUsd, 0);
  const totalRewards = summaries.reduce((sum, s) => sum + s.pendingRewardsUsd, 0);
  const avgApy = summaries.length > 0
    ? summaries.reduce((sum, s) => sum + s.averageApy, 0) / summaries.length
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const stats = [
    { label: 'Total AUM', value: formatCurrency(totalValue), color: 'text-text-primary' },
    { label: 'Total Staked', value: formatCurrency(totalStaked), color: 'text-accent-blue' },
    { label: 'PnL Total', value: formatCurrency(totalPnl), color: totalPnl >= 0 ? 'text-status-success' : 'text-status-error' },
    { label: 'Rewards Pendentes', value: formatCurrency(totalRewards), color: 'text-accent-purple' },
    { label: 'APY Médio', value: `${avgApy.toFixed(1)}%`, color: 'text-accent-cyan' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="text-xs text-text-muted mb-0.5">{stat.label}</p>
          <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function ClientsPage() {
  const {
    clients,
    createClient,
    updateClient,
    deleteClient,
    getAllPortfoliosSummary,
  } = useClients();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const summaries = getAllPortfoliosSummary();
  const summaryMap = new Map(summaries.map(s => [s.clientId, s]));

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (data: { name: string; email?: string; notes?: string }) => {
    setIsLoading(true);
    try {
      await createClient(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (data: { name: string; email?: string; notes?: string }) => {
    if (!editingClient) return;
    setIsLoading(true);
    try {
      await updateClient(editingClient.id, data);
      setEditingClient(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setIsLoading(true);
    try {
      await deleteClient(deletingClient.id);
      setDeletingClient(null);
    } finally {
      setIsLoading(false);
    }
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

        <main className="p-5">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Clientes</h1>
              <p className="text-[11px] text-text-muted mt-0.5">
                Gerencie carteiras e portfolios de clientes
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-blue text-white text-[11px] font-medium hover:bg-accent-blue/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>

          {/* Summary Stats */}
          <SummaryStats summaries={summaries} />

          {/* Search */}
          <div className="relative max-w-md mt-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clientes..."
              className="w-full h-9 pl-10 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          {/* Clients Grid */}
          <div className="mt-5">
            {filteredClients.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.02] flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-text-muted" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                </h3>
                <p className="text-sm text-text-muted mb-4">
                  {searchQuery
                    ? 'Tente buscar com outros termos'
                    : 'Comece adicionando seu primeiro cliente ao sistema'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Cliente
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    summary={summaryMap.get(client.id)!}
                    onEdit={() => setEditingClient(client)}
                    onDelete={() => setDeletingClient(client)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Modals */}
          <ClientModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSave={handleCreate}
            isLoading={isLoading}
          />

          <ClientModal
            isOpen={!!editingClient}
            onClose={() => setEditingClient(null)}
            client={editingClient || undefined}
            onSave={handleUpdate}
            isLoading={isLoading}
          />

          <DeleteModal
            isOpen={!!deletingClient}
            onClose={() => setDeletingClient(null)}
            onConfirm={handleDelete}
            clientName={deletingClient?.name || ''}
            isLoading={isLoading}
          />
        </main>
      </div>
    </div>
  );
}
