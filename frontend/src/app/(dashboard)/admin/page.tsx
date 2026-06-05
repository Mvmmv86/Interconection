'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Shield, Users } from 'lucide-react';
import { api, type AdminOrganization, type AdminUser } from '@/lib/api/client';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

export default function PlatformAdminPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = useCallback(async (organizationId?: string) => {
    if (!user?.is_superuser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const [orgsResult, usersResult] = await Promise.all([
      api.getAdminOrganizations(),
      api.getAdminUsers(organizationId),
    ]);
    if (!orgsResult.success || !usersResult.success) {
      setError(orgsResult.error || usersResult.error || 'Nao foi possivel carregar o admin');
      setIsLoading(false);
      return;
    }
    setOrganizations(orgsResult.data || []);
    setUsers(usersResult.data || []);
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
      <div className="p-6">
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <Shield className="w-10 h-10 mx-auto text-text-muted mb-4" />
            <h1 className="text-xl font-semibold text-text-primary">Acesso restrito</h1>
            <p className="text-sm text-text-secondary mt-2">
              Esta area e exclusiva para operadores da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Platform</p>
        <h1 className="text-2xl font-semibold text-text-primary mt-1">Super Admin</h1>
        <p className="text-sm text-text-secondary mt-2">
          Governanca global de tenants e usuarios, separada do RBAC de cada conta.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      )}

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent-blue" />
            Organizacoes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-muted">Carregando tenants...</div>
          ) : (
            <div className="space-y-3">
              {organizations.map((organization) => (
                <div key={organization.id} className="rounded-xl border border-border-subtle bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text-primary">{organization.name}</p>
                        <Badge variant={organization.is_active ? 'success' : 'error'} size="sm">
                          {organization.is_active ? 'Ativa' : 'Suspensa'}
                        </Badge>
                        <Badge variant="blue" size="sm">{organization.plan}</Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        {organization.user_count} usuarios · {organization.client_count} carteiras
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

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-purple" />
            Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Filtrar por organizacao"
            value={selectedOrganizationId}
            options={[
              { value: '', label: 'Todas' },
              ...organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            ]}
            onChange={(event) => setSelectedOrganizationId(event.target.value)}
          />
          <div className="space-y-3">
            {users.map((targetUser) => (
              <div key={targetUser.id} className="rounded-xl border border-border-subtle bg-white/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text-primary">{targetUser.name}</p>
                      <Badge variant={targetUser.is_active ? 'success' : 'error'} size="sm">
                        {targetUser.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {targetUser.is_superuser && <Badge variant="purple" size="sm">Superuser</Badge>}
                    </div>
                    <p className="text-xs text-text-muted mt-1">{targetUser.email}</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
