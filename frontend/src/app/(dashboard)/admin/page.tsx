'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Building2,
  CreditCard,
  FileText,
  Layers3,
  LineChart,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  api,
  type AdminAuditLog,
  type AdminClient,
  type AdminOrganization,
  type AdminOverview,
  type AdminUser,
} from '@/lib/api/client';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AdminTab =
  | 'overview'
  | 'accounts'
  | 'users'
  | 'clients'
  | 'strategies'
  | 'bots'
  | 'finance'
  | 'plans'
  | 'audit'
  | 'system';

const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Dashboard', icon: Activity },
  { id: 'accounts', label: 'Contas', icon: Building2 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'clients', label: 'Clientes', icon: Layers3 },
  { id: 'strategies', label: 'Estrategias', icon: LineChart },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'finance', label: 'Financeiro', icon: CreditCard },
  { id: 'plans', label: 'Planos', icon: Sparkles },
  { id: 'audit', label: 'Auditoria', icon: FileText },
  { id: 'system', label: 'Sistema', icon: Shield },
];

const emptyOverview: AdminOverview = {
  organization_count: 0,
  active_organization_count: 0,
  user_count: 0,
  active_user_count: 0,
  client_count: 0,
  audit_event_count: 0,
  bot_count: 0,
  strategy_count: 0,
  plan_count: 3,
};

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <Card variant="glass">
      <CardContent className="py-12 text-center">
        <Sparkles className="mx-auto mb-4 h-10 w-10 text-text-muted" />
        <h2 className="text-heading-md text-text-primary">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-body-sm text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function PlatformAdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organizationOptions = useMemo(
    () => [
      { value: '', label: 'Todas as contas' },
      ...organizations.map((organization) => ({
        value: organization.id,
        label: organization.name,
      })),
    ],
    [organizations]
  );

  const loadAdminData = useCallback(async (organizationId?: string) => {
    if (!user?.is_superuser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const [
      overviewResult,
      orgsResult,
      usersResult,
      clientsResult,
      auditResult,
    ] = await Promise.all([
      api.getAdminOverview(),
      api.getAdminOrganizations(),
      api.getAdminUsers(organizationId),
      api.getAdminClients(organizationId),
      api.getAdminAuditLogs(organizationId),
    ]);

    if (
      !overviewResult.success
      || !orgsResult.success
      || !usersResult.success
      || !clientsResult.success
      || !auditResult.success
    ) {
      setError(
        overviewResult.error
        || orgsResult.error
        || usersResult.error
        || clientsResult.error
        || auditResult.error
        || 'Nao foi possivel carregar o admin'
      );
      setIsLoading(false);
      return;
    }

    setOverview(overviewResult.data || emptyOverview);
    setOrganizations(orgsResult.data || []);
    setUsers(usersResult.data || []);
    setClients(clientsResult.data || []);
    setAuditLogs(auditResult.data || []);
    setIsLoading(false);
  }, [user?.is_superuser]);

  useEffect(() => {
    loadAdminData(selectedOrganizationId || undefined);
  }, [loadAdminData, selectedOrganizationId]);

  const updateOrganization = async (
    organization: AdminOrganization,
    data: { is_active?: boolean; plan?: AdminOrganization['plan'] }
  ) => {
    const result = await api.updateAdminOrganization(organization.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar a organizacao');
      return;
    }
    setOrganizations((current) => current.map((item) => item.id === organization.id ? result.data! : item));
  };

  const updateUser = async (
    targetUser: AdminUser,
    data: { is_active?: boolean; is_superuser?: boolean }
  ) => {
    const result = await api.updateAdminUser(targetUser.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar o usuario');
      return;
    }
    setUsers((current) => current.map((item) => item.id === targetUser.id ? result.data! : item));
  };

  if (!user?.is_superuser) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h1 className="text-heading-md text-text-primary">Acesso restrito</h1>
            <p className="mt-2 text-body-sm text-text-secondary">
              Esta area e exclusiva para operadores da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-overline uppercase tracking-[0.22em] text-text-muted">Platform</p>
          <h1 className="mt-1 text-heading-lg text-text-primary">Admin Console</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-text-secondary">
            Operacao global da plataforma: contas, usuarios, clientes, auditoria e modulos
            futuros de bots, estrategias, financeiro e planos.
          </p>
        </div>
        <Select
          value={selectedOrganizationId}
          options={organizationOptions}
          onChange={(event) => setSelectedOrganizationId(event.target.value)}
          className="h-10 min-w-[240px] py-0 text-body-sm"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-body-sm text-status-error">
          {error}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-border-subtle bg-background-secondary/60 p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-caption font-medium transition-colors',
                active
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Contas', overview.organization_count, `${overview.active_organization_count} ativas`],
            ['Usuarios', overview.user_count, `${overview.active_user_count} ativos`],
            ['Clientes', overview.client_count, 'carteiras/clientes de negocio'],
            ['Auditoria', overview.audit_event_count, 'eventos registrados'],
          ].map(([label, value, caption]) => (
            <Card key={label} variant="glass" className="p-5">
              <p className="text-caption text-text-muted">{label}</p>
              <p className="mt-2 text-heading-md text-text-primary">{value}</p>
              <p className="mt-1 text-caption text-text-tertiary">{caption}</p>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'accounts' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Contas da plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-body-sm text-text-muted">Carregando contas...</div>
            ) : (
              <div className="space-y-3">
                {organizations.map((organization) => (
                  <div key={organization.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-heading-sm text-text-primary">{organization.name}</p>
                          <Badge variant={organization.is_active ? 'success' : 'error'} size="sm">
                            {organization.is_active ? 'Ativa' : 'Suspensa'}
                          </Badge>
                          <Badge variant="blue" size="sm">{organization.plan}</Badge>
                        </div>
                        <p className="mt-1 text-caption text-text-muted">
                          {organization.user_count} usuarios - {organization.client_count} clientes/carteiras
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={organization.plan}
                          options={[
                            { value: 'free', label: 'Free' },
                            { value: 'pro', label: 'Pro' },
                            { value: 'enterprise', label: 'Enterprise' },
                          ]}
                          className="h-9 min-w-[150px] py-0 text-body-sm"
                          onChange={(event) => updateOrganization(organization, {
                            plan: event.target.value as AdminOrganization['plan'],
                          })}
                        />
                        <Button
                          type="button"
                          variant={organization.is_active ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => updateOrganization(organization, {
                            is_active: !organization.is_active,
                          })}
                        >
                          {organization.is_active ? 'Suspender' : 'Reativar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Usuarios globais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((targetUser) => (
              <div key={targetUser.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-heading-sm text-text-primary">{targetUser.name}</p>
                      <Badge variant={targetUser.is_active ? 'success' : 'error'} size="sm">
                        {targetUser.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {targetUser.is_superuser && <Badge variant="purple" size="sm">Superuser</Badge>}
                    </div>
                    <p className="mt-1 text-caption text-text-muted">{targetUser.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={targetUser.is_active ? 'danger' : 'secondary'}
                      size="sm"
                      disabled={targetUser.id === user.id}
                      onClick={() => updateUser(targetUser, { is_active: !targetUser.is_active })}
                    >
                      {targetUser.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateUser(targetUser, { is_superuser: !targetUser.is_superuser })}
                    >
                      {targetUser.is_superuser ? 'Remover superuser' : 'Tornar superuser'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'clients' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Clientes e carteiras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clients.map((client) => (
              <div key={client.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: client.color }} />
                    <div>
                      <p className="text-heading-sm text-text-primary">{client.name}</p>
                      <p className="text-caption text-text-muted">{client.organization_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="blue" size="sm">{client.wallet_count} wallets</Badge>
                    <Badge variant="purple" size="sm">{client.exchange_count} exchanges</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Auditoria global</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default" size="sm">{log.action}</Badge>
                      <p className="text-body-sm font-medium text-text-primary">{log.resource_type}</p>
                    </div>
                    <p className="mt-1 text-caption text-text-secondary">{log.description || 'Evento sem descricao'}</p>
                    <p className="mt-1 text-caption text-text-muted">
                      {log.organization_name || log.organization_id} - {log.user_email || 'system'}
                    </p>
                  </div>
                  <p className="text-caption text-text-muted">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'strategies' && (
        <PlaceholderSection
          title="Estrategias"
          description="Espaco reservado para catalogar estrategias, indicadores e backtests quando o modulo de bots entrar."
        />
      )}
      {activeTab === 'bots' && (
        <PlaceholderSection
          title="Bots"
          description="Painel global futuro para acompanhar bots ativos, filas, sinais, locks e falhas por conta."
        />
      )}
      {activeTab === 'finance' && (
        <PlaceholderSection
          title="Financeiro"
          description="Futuro modulo para assinaturas, invoices, inadimplencia, limites e conciliacao de pagamentos."
        />
      )}
      {activeTab === 'plans' && (
        <PlaceholderSection
          title="Planos"
          description="Aqui vamos evoluir o enum free/pro/enterprise para planos configuraveis com features e limites."
        />
      )}
      {activeTab === 'system' && (
        <PlaceholderSection
          title="Sistema"
          description="Area futura para health checks, filas, workers, cache, migrations e integracoes operacionais."
        />
      )}
    </div>
  );
}
