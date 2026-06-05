'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api, type ClientListItem, type TeamMember, type TeamRole } from '@/lib/api/client';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const statusLabels: Record<TeamMember['status'], string> = {
  active: 'Ativo',
  invited: 'Convidado',
  suspended: 'Suspenso',
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

function formatRoleName(roleName: string): string {
  return roleLabels[roleName] || roleName;
}

export default function TeamSettingsPage() {
  const { user, activeMembership, can, refreshMemberships } = useAuth();
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role_id: '',
    notes: '',
    expires_in_days: 7,
  });

  const canViewMembers = can('members:view');
  const canInvite = can('members:invite');
  const canEdit = can('members:edit');
  const canRevoke = can('members:revoke');
  const canSetScope = can('members:set_scope');

  const roleOptions = useMemo(
    () => roles.map((role) => ({
      value: role.id,
      label: formatRoleName(role.name),
    })),
    [roles]
  );

  const loadTeam = useCallback(async () => {
    if (!canViewMembers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const [rolesResult, membersResult, clientsResult] = await Promise.all([
      api.getTeamRoles(),
      api.getTeamMembers(),
      api.getClients(),
    ]);

    if (!rolesResult.success || !membersResult.success) {
      setError(rolesResult.error || membersResult.error || 'Nao foi possivel carregar a equipe');
      setIsLoading(false);
      return;
    }

    const loadedRoles = rolesResult.data || [];
    setRoles(loadedRoles);
    setMembers(membersResult.data || []);
    setClients(clientsResult.success && clientsResult.data ? clientsResult.data : []);
    setInviteForm((current) => ({
      ...current,
      role_id: current.role_id || loadedRoles.find((role) => role.name === 'viewer')?.id || loadedRoles[0]?.id || '',
    }));
    setIsLoading(false);
  }, [canViewMembers]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInvite || !inviteForm.role_id) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setInviteLink(null);

    const result = await api.createTeamInvitation({
      email: inviteForm.email,
      role_id: inviteForm.role_id,
      notes: inviteForm.notes || undefined,
      expires_in_days: inviteForm.expires_in_days,
    });

    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel criar o convite');
      setIsSubmitting(false);
      return;
    }

    const link = `${window.location.origin}/invite/${result.data.token}`;
    setInviteLink(link);
    setSuccess('Convite criado. Copie o link e envie para o membro.');
    setInviteForm((current) => ({ ...current, email: '', notes: '' }));
    await loadTeam();
    setIsSubmitting(false);
  };

  const updateMember = async (
    member: TeamMember,
    data: { role_id?: string; status?: TeamMember['status'] }
  ) => {
    if (!canEdit) return;
    setError(null);
    const result = await api.updateTeamMember(member.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar o membro');
      return;
    }
    setMembers((current) => current.map((item) => item.id === member.id ? result.data! : item));
    if (member.user_id === user?.id) {
      await refreshMemberships();
    }
  };

  const updateScope = async (
    member: TeamMember,
    clientAccessMode: 'all' | 'specific',
    clientIds: string[]
  ) => {
    if (!canSetScope) return;
    setError(null);
    const result = await api.updateTeamMemberScope(member.id, {
      client_access_mode: clientAccessMode,
      client_ids: clientIds,
    });
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar o escopo');
      return;
    }
    setMembers((current) => current.map((item) => item.id === member.id ? result.data! : item));
  };

  const revokeMember = async (member: TeamMember) => {
    if (!canRevoke) return;
    const confirmed = window.confirm(`Revogar acesso de ${member.user.email}?`);
    if (!confirmed) return;

    setError(null);
    const result = await api.revokeTeamMember(member.id);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel revogar o membro');
      return;
    }
    await loadTeam();
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setSuccess('Link copiado para a area de transferencia.');
  };

  if (!canViewMembers) {
    return (
      <div className="p-6">
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-text-muted mb-4" />
            <h1 className="text-xl font-semibold text-text-primary">Acesso restrito</h1>
            <p className="text-sm text-text-secondary mt-2">
              Sua permissao atual nao permite visualizar a equipe desta conta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Settings</p>
          <h1 className="text-2xl font-semibold text-text-primary mt-1">Team</h1>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl">
            Gerencie membros, convites, papeis e escopo de carteiras da conta ativa.
          </p>
        </div>
        <Badge variant="blue">
          {activeMembership?.organization.name || 'Conta ativa'}
        </Badge>
      </div>

      {(error || success) && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            error
              ? 'border-status-error/30 bg-status-error/10 text-status-error'
              : 'border-status-success/30 bg-status-success/10 text-status-success'
          )}
        >
          {error || success}
        </div>
      )}

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-accent-blue" />
            Convidar membro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_0.7fr_auto] lg:items-end">
            <Input
              label="Email"
              type="email"
              placeholder="membro@empresa.com"
              value={inviteForm.email}
              disabled={!canInvite || isSubmitting}
              onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <Select
              label="Papel"
              value={inviteForm.role_id}
              options={roleOptions}
              disabled={!canInvite || isSubmitting}
              onChange={(event) => setInviteForm((current) => ({ ...current, role_id: event.target.value }))}
            />
            <Input
              label="Expira em dias"
              type="number"
              min={1}
              max={30}
              value={inviteForm.expires_in_days}
              disabled={!canInvite || isSubmitting}
              onChange={(event) => setInviteForm((current) => ({
                ...current,
                expires_in_days: Number(event.target.value),
              }))}
            />
            <Button type="submit" isLoading={isSubmitting} disabled={!canInvite || !inviteForm.role_id}>
              Convidar
            </Button>
          </form>
          <div className="mt-4">
            <Input
              label="Notas internas"
              placeholder="Opcional"
              value={inviteForm.notes}
              disabled={!canInvite || isSubmitting}
              onChange={(event) => setInviteForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          {inviteLink && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border-subtle bg-white/5 p-3 sm:flex-row sm:items-center">
              <code className="flex-1 truncate text-xs text-text-secondary">{inviteLink}</code>
              <Button type="button" variant="secondary" size="sm" onClick={copyInviteLink}>
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-purple" />
            Membros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-text-muted">Carregando equipe...</div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => {
                const isSelf = member.user_id === user?.id;
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-border-subtle bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text-primary">{member.user.name}</p>
                          {isSelf && <Badge variant="purple" size="sm">Voce</Badge>}
                          <Badge variant={member.status === 'active' ? 'success' : member.status === 'suspended' ? 'error' : 'yellow'} size="sm">
                            {statusLabels[member.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-muted mt-1">{member.user.email}</p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3 xl:min-w-[620px]">
                        <Select
                          label="Papel"
                          value={member.role_id}
                          options={roleOptions}
                          disabled={!canEdit}
                          onChange={(event) => updateMember(member, { role_id: event.target.value })}
                        />
                        <Select
                          label="Status"
                          value={member.status}
                          options={[
                            { value: 'active', label: 'Ativo' },
                            { value: 'suspended', label: 'Suspenso' },
                          ]}
                          disabled={!canEdit || isSelf}
                          onChange={(event) => updateMember(member, {
                            status: event.target.value as TeamMember['status'],
                          })}
                        />
                        <Select
                          label="Escopo"
                          value={member.client_access_mode}
                          options={[
                            { value: 'all', label: 'Todas as carteiras' },
                            { value: 'specific', label: 'Carteiras especificas' },
                          ]}
                          disabled={!canSetScope}
                          onChange={(event) => updateScope(
                            member,
                            event.target.value as 'all' | 'specific',
                            event.target.value === 'specific' ? member.client_ids : []
                          )}
                        />
                      </div>
                    </div>

                    {member.client_access_mode === 'specific' && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {clients.map((client) => {
                          const checked = member.client_ids.includes(client.id);
                          return (
                            <label
                              key={client.id}
                              className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs text-text-secondary"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canSetScope}
                                onChange={(event) => {
                                  const nextIds = event.target.checked
                                    ? [...member.client_ids, client.id]
                                    : member.client_ids.filter((id) => id !== client.id);
                                  updateScope(member, 'specific', nextIds);
                                }}
                              />
                              <span className="truncate">{client.name}</span>
                            </label>
                          );
                        })}
                        {clients.length === 0 && (
                          <p className="text-xs text-text-muted">Nenhuma carteira cadastrada nesta conta.</p>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={!canRevoke || isSelf || member.status === 'suspended'}
                        onClick={() => revokeMember(member)}
                      >
                        Revogar acesso
                      </Button>
                    </div>
                  </div>
                );
              })}
              {members.length === 0 && (
                <div className="py-10 text-center text-sm text-text-muted">
                  Nenhum membro encontrado para esta conta.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
