'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  KeyRound,
  Layers3,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, type AccountTeam, type ClientListItem, type TeamMember, type TeamRole } from '@/lib/api/client';
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

const roleDescriptions: Record<string, string> = {
  owner: 'Acesso total a conta, equipe, carteiras e operacoes criticas.',
  admin: 'Administra operacao e membros, sem ser operador global da plataforma.',
  manager: 'Opera carteiras e dados do dia a dia com menos poderes administrativos.',
  viewer: 'Leitura e acompanhamento, sem criar, editar ou excluir recursos.',
};

function formatRoleName(roleName: string): string {
  return roleLabels[roleName] || roleName;
}

function getInitials(name?: string, email?: string): string {
  const source = name || email || '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function TeamSettingsPage() {
  const { user, activeMembership, can, refreshMemberships } = useAuth();
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<AccountTeam[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamMembersByTeam, setTeamMembersByTeam] = useState<Record<string, TeamMember[]>>({});
  const [teamMemberSelection, setTeamMemberSelection] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role_id: '',
    team_id: '',
    notes: '',
    expires_in_days: 7,
  });
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    role_id: '',
    client_access_mode: 'all' as 'all' | 'specific',
    client_ids: [] as string[],
  });

  const canViewMembers = can('members:view');
  const canInvite = can('members:invite');
  const canEdit = can('members:edit');
  const canRevoke = can('members:revoke');
  const canSetScope = can('members:set_scope');
  const canViewTeams = can('teams:view');
  const canCreateTeams = can('teams:create');
  const canEditTeams = can('teams:edit');
  const canDeleteTeams = can('teams:delete');
  const canManageTeamMembers = can('teams:members');

  const roleOptions = useMemo(
    () => roles.map((role) => ({
      value: role.id,
      label: formatRoleName(role.name),
    })),
    [roles]
  );

  const selectedInviteRole = roles.find((role) => role.id === inviteForm.role_id);

  const teamStats = useMemo(() => {
    const activeCount = members.filter((member) => member.status === 'active').length;
    const scopedCount = members.filter((member) => member.client_access_mode === 'specific').length;
    return {
      activeCount,
      scopedCount,
      totalCount: members.length,
      teamCount: teams.filter((team) => team.status === 'active').length,
      walletCount: clients.length,
    };
  }, [clients.length, members, teams]);

  const loadTeam = useCallback(async () => {
    if (!canViewMembers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const [rolesResult, membersResult, clientsResult, teamsResult] = await Promise.all([
      api.getTeamRoles(),
      api.getTeamMembers(),
      api.getClients(),
      canViewTeams
        ? api.getAccountTeams()
        : Promise.resolve({ success: true, data: [] as AccountTeam[], error: undefined }),
    ]);

    if (!rolesResult.success || !membersResult.success || !teamsResult.success) {
      setError(rolesResult.error || membersResult.error || teamsResult.error || 'Nao foi possivel carregar a equipe');
      setIsLoading(false);
      return;
    }

    const loadedRoles = rolesResult.data || [];
    setRoles(loadedRoles);
    setMembers(membersResult.data || []);
    setClients(clientsResult.success && clientsResult.data ? clientsResult.data : []);
    setTeams(teamsResult.data || []);
    setInviteForm((current) => ({
      ...current,
      role_id: current.role_id || loadedRoles.find((role) => role.name === 'viewer')?.id || loadedRoles[0]?.id || '',
    }));
    setTeamForm((current) => ({
      ...current,
      role_id: current.role_id || loadedRoles.find((role) => role.name === 'viewer')?.id || loadedRoles[0]?.id || '',
    }));
    setIsLoading(false);
  }, [canViewMembers, canViewTeams]);

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
      team_id: inviteForm.team_id || undefined,
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

  const handleCreateTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateTeams || !teamForm.name.trim()) return;
    if (teamForm.client_access_mode === 'specific' && teamForm.client_ids.length === 0) {
      setError('Selecione pelo menos uma carteira para escopo especifico.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await api.createAccountTeam({
      name: teamForm.name.trim(),
      description: teamForm.description || undefined,
      color: teamForm.color,
      role_id: teamForm.role_id || null,
      client_access_mode: teamForm.client_access_mode,
      client_ids: teamForm.client_access_mode === 'specific' ? teamForm.client_ids : [],
    });
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel criar a equipe');
      setIsSubmitting(false);
      return;
    }
    setTeams((current) => [...current, result.data!]);
    setTeamForm((current) => ({ ...current, name: '', description: '', client_ids: [] }));
    setSuccess('Equipe criada com sucesso.');
    setIsSubmitting(false);
  };

  const updateTeam = async (
    team: AccountTeam,
    data: {
      role_id?: string | null;
      client_access_mode?: 'all' | 'specific';
      client_ids?: string[];
      status?: 'active' | 'archived';
    }
  ) => {
    if (!canEditTeams) return;
    if (data.client_access_mode === 'specific' && (!data.client_ids || data.client_ids.length === 0)) {
      setError('Selecione pelo menos uma carteira para escopo especifico.');
      return;
    }
    setError(null);
    const result = await api.updateAccountTeam(team.id, data);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel atualizar a equipe');
      return;
    }
    setTeams((current) => current.map((item) => item.id === team.id ? result.data! : item));
    await refreshMemberships();
  };

  const archiveTeam = async (team: AccountTeam) => {
    if (!canDeleteTeams) return;
    const confirmed = window.confirm(`Arquivar a equipe ${team.name}?`);
    if (!confirmed) return;
    setError(null);
    const result = await api.archiveAccountTeam(team.id);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel arquivar a equipe');
      return;
    }
    setTeams((current) => current.map((item) => item.id === team.id ? { ...item, status: 'archived' } : item));
    await refreshMemberships();
  };

  const toggleTeamMembers = async (team: AccountTeam) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    if (teamMembersByTeam[team.id]) return;
    const result = await api.getAccountTeamMembers(team.id);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel carregar membros da equipe');
      return;
    }
    setTeamMembersByTeam((current) => ({ ...current, [team.id]: result.data || [] }));
  };

  const addMemberToTeam = async (team: AccountTeam) => {
    if (!canManageTeamMembers) return;
    const membershipId = teamMemberSelection[team.id];
    if (!membershipId) return;
    setError(null);
    const result = await api.addAccountTeamMember(team.id, membershipId);
    if (!result.success || !result.data) {
      setError(result.error || 'Nao foi possivel adicionar membro a equipe');
      return;
    }
    setTeams((current) => current.map((item) => item.id === team.id ? result.data! : item));
    const membersResult = await api.getAccountTeamMembers(team.id);
    if (membersResult.success) {
      setTeamMembersByTeam((current) => ({ ...current, [team.id]: membersResult.data || [] }));
    }
    setTeamMemberSelection((current) => ({ ...current, [team.id]: '' }));
    await refreshMemberships();
  };

  const removeMemberFromTeam = async (team: AccountTeam, member: TeamMember) => {
    if (!canManageTeamMembers) return;
    setError(null);
    const result = await api.removeAccountTeamMember(team.id, member.id);
    if (!result.success) {
      setError(result.error || 'Nao foi possivel remover membro da equipe');
      return;
    }
    setTeams((current) => current.map((item) => (
      item.id === team.id ? { ...item, member_count: Math.max(0, item.member_count - 1) } : item
    )));
    setTeamMembersByTeam((current) => ({
      ...current,
      [team.id]: (current[team.id] || []).filter((item) => item.id !== member.id),
    }));
    await refreshMemberships();
  };

  if (!canViewMembers) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h1 className="text-heading-md text-text-primary">Acesso restrito</h1>
            <p className="mt-2 text-body-sm text-text-secondary">
              Sua permissao atual nao permite visualizar a equipe desta conta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-overline uppercase tracking-[0.22em] text-text-muted">Settings</p>
          <h1 className="mt-1 text-heading-lg text-text-primary">Team</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Gerencie membros da conta, convites, papeis e escopo por carteira. Grupos nomeados
            de equipe ainda nao existem nesta fase; hoje o acesso e configurado por membro.
          </p>
        </div>
        <Badge variant="blue" className="self-start lg:self-auto">
          {activeMembership?.organization.name || 'Conta ativa'}
        </Badge>
      </div>

      {(error || success) && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-body-sm',
            error
              ? 'border-status-error/30 bg-status-error/10 text-status-error'
              : 'border-status-success/30 bg-status-success/10 text-status-success'
          )}
        >
          {error || success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="glass" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-text-muted">Membros ativos</p>
              <p className="mt-2 text-heading-md text-text-primary">{teamStats.activeCount}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                {teamStats.totalCount} membros vinculados a conta.
              </p>
            </div>
            <Users className="h-5 w-5 text-accent-blue" />
          </div>
        </Card>
        <Card variant="glass" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-text-muted">Equipes ativas</p>
              <p className="mt-2 text-heading-md text-text-primary">{teamStats.teamCount}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                Grupos com acesso herdado por membros.
              </p>
            </div>
            <Users className="h-5 w-5 text-accent-cyan" />
          </div>
        </Card>
        <Card variant="glass" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-text-muted">Escopo especifico</p>
              <p className="mt-2 text-heading-md text-text-primary">{teamStats.scopedCount}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                Pessoas limitadas a carteiras selecionadas.
              </p>
            </div>
            <Layers3 className="h-5 w-5 text-accent-purple" />
          </div>
        </Card>
        <Card variant="glass" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-text-muted">Carteiras disponiveis</p>
              <p className="mt-2 text-heading-md text-text-primary">{teamStats.walletCount}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                Base usada no controle de acesso por carteira.
              </p>
            </div>
            <KeyRound className="h-5 w-5 text-accent-orange" />
          </div>
        </Card>
      </div>

      <Card variant="glass">
        <CardHeader className="items-start gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-accent-blue" />
              Convidar membro
            </CardTitle>
            <p className="mt-1 text-caption text-text-tertiary">
              O convite adiciona a pessoa a conta ativa. Se o email ja existir, ele ganha uma
              membership nesta conta sem criar outra organizacao.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid gap-4 xl:grid-cols-[1fr_220px_220px_150px_auto] xl:items-end">
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
              className="h-10 py-0 text-body-sm"
              onChange={(event) => setInviteForm((current) => ({ ...current, role_id: event.target.value }))}
            />
            <Select
              label="Equipe"
              value={inviteForm.team_id}
              options={[
                { value: '', label: 'Sem equipe' },
                ...teams
                  .filter((team) => team.status === 'active')
                  .map((team) => ({ value: team.id, label: team.name })),
              ]}
              disabled={!canInvite || isSubmitting}
              className="h-10 py-0 text-body-sm"
              onChange={(event) => setInviteForm((current) => ({ ...current, team_id: event.target.value }))}
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
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <Input
              label="Notas internas"
              placeholder="Opcional"
              value={inviteForm.notes}
              disabled={!canInvite || isSubmitting}
              onChange={(event) => setInviteForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-3">
              <p className="text-caption font-medium text-text-secondary">
                {selectedInviteRole ? formatRoleName(selectedInviteRole.name) : 'Papel'}
              </p>
              <p className="mt-1 text-caption text-text-tertiary">
                {selectedInviteRole
                  ? roleDescriptions[selectedInviteRole.name] || selectedInviteRole.description || 'Permissao customizada.'
                  : 'Escolha um papel para ver o nivel de acesso.'}
              </p>
            </div>
          </div>
          {inviteLink && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border-subtle bg-background-secondary/60 p-3 sm:flex-row sm:items-center">
              <code className="flex-1 truncate text-caption text-text-secondary">{inviteLink}</code>
              <Button type="button" variant="secondary" size="sm" onClick={copyInviteLink}>
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canViewTeams && (
        <Card variant="glass">
          <CardHeader className="items-start gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-accent-cyan" />
                Equipes
              </CardTitle>
              <p className="mt-1 text-caption text-text-tertiary">
                Crie equipes reais dentro da conta e aplique papel/escopo em lote para os membros
                adicionados. Membros owner/admin com acesso direto total continuam com acesso total.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleCreateTeam} className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_220px_220px_120px_auto] xl:items-end">
                <Input
                  label="Nome da equipe"
                  placeholder="Ex: Trading, Financeiro, Operacoes"
                  value={teamForm.name}
                  disabled={!canCreateTeams || isSubmitting}
                  onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
                <Select
                  label="Papel herdado"
                  value={teamForm.role_id}
                  options={roleOptions}
                  disabled={!canCreateTeams || isSubmitting}
                  className="h-10 py-0 text-body-sm"
                  onChange={(event) => setTeamForm((current) => ({ ...current, role_id: event.target.value }))}
                />
                <Select
                  label="Escopo da equipe"
                  value={teamForm.client_access_mode}
                  options={[
                    { value: 'all', label: 'Todas as carteiras' },
                    { value: 'specific', label: 'Carteiras especificas' },
                  ]}
                  disabled={!canCreateTeams || isSubmitting}
                  className="h-10 py-0 text-body-sm"
                  onChange={(event) => setTeamForm((current) => ({
                    ...current,
                    client_access_mode: event.target.value as 'all' | 'specific',
                    client_ids: event.target.value === 'all' ? [] : current.client_ids,
                  }))}
                />
                <Input
                  label="Cor"
                  type="color"
                  value={teamForm.color}
                  disabled={!canCreateTeams || isSubmitting}
                  onChange={(event) => setTeamForm((current) => ({ ...current, color: event.target.value }))}
                />
                <Button type="submit" isLoading={isSubmitting} disabled={!canCreateTeams || !teamForm.name.trim()}>
                  Criar equipe
                </Button>
              </div>
              <div className="mt-4">
                <Input
                  label="Descricao"
                  placeholder="Opcional"
                  value={teamForm.description}
                  disabled={!canCreateTeams || isSubmitting}
                  onChange={(event) => setTeamForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              {teamForm.client_access_mode === 'specific' && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {clients.map((client) => {
                    const checked = teamForm.client_ids.includes(client.id);
                    return (
                      <label
                        key={client.id}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-caption transition-colors',
                          checked
                            ? 'border-accent-purple/40 bg-accent-purple/10 text-text-primary'
                            : 'border-border-subtle bg-background-primary/40 text-text-secondary'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canCreateTeams || isSubmitting}
                          className="h-4 w-4 accent-purple-600"
                          onChange={(event) => setTeamForm((current) => ({
                            ...current,
                            client_ids: event.target.checked
                              ? [...current.client_ids, client.id]
                              : current.client_ids.filter((id) => id !== client.id),
                          }))}
                        />
                        <span className="truncate">{client.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </form>

            <div className="space-y-4">
              {teams.map((team) => {
                const teamMembers = teamMembersByTeam[team.id] || [];
                const availableMembers = members.filter((member) => (
                  member.status === 'active'
                  && !teamMembers.some((teamMember) => teamMember.id === member.id)
                ));
                return (
                  <div
                    key={team.id}
                    className={cn(
                      'rounded-xl border border-border-subtle bg-background-secondary/60 p-4',
                      team.status === 'archived' && 'opacity-60'
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <p className="text-heading-sm text-text-primary">{team.name}</p>
                          <Badge variant={team.status === 'active' ? 'success' : 'default'} size="sm">
                            {team.status === 'active' ? 'Ativa' : 'Arquivada'}
                          </Badge>
                          <Badge variant="blue" size="sm">{team.member_count} membros</Badge>
                        </div>
                        <p className="mt-1 text-caption text-text-tertiary">
                          {team.description || 'Sem descricao'}
                        </p>
                      </div>
                      <div className="grid w-full gap-3 md:grid-cols-3 xl:max-w-3xl">
                        <Select
                          label="Papel herdado"
                          value={team.role_id || ''}
                          options={[{ value: '', label: 'Sem papel herdado' }, ...roleOptions]}
                          disabled={!canEditTeams || team.status === 'archived'}
                          className="h-10 py-0 text-body-sm"
                          onChange={(event) => updateTeam(team, { role_id: event.target.value || null })}
                        />
                        <Select
                          label="Escopo"
                          value={team.client_access_mode}
                          options={[
                            { value: 'all', label: 'Todas as carteiras' },
                            { value: 'specific', label: 'Carteiras especificas' },
                          ]}
                          disabled={!canEditTeams || team.status === 'archived'}
                          className="h-10 py-0 text-body-sm"
                          onChange={(event) => updateTeam(team, {
                            client_access_mode: event.target.value as 'all' | 'specific',
                            client_ids: event.target.value === 'specific' ? team.client_ids : [],
                          })}
                        />
                        <div className="flex items-end gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => toggleTeamMembers(team)}>
                            {expandedTeamId === team.id ? 'Ocultar membros' : 'Ver membros'}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={!canDeleteTeams || team.status === 'archived'}
                            onClick={() => archiveTeam(team)}
                          >
                            Arquivar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {team.client_access_mode === 'specific' && (
                      <div className="mt-4 rounded-xl border border-border-subtle bg-background-primary/40 p-3">
                        <p className="mb-3 text-caption font-medium text-text-secondary">
                          Carteiras da equipe
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {clients.map((client) => {
                            const checked = team.client_ids.includes(client.id);
                            return (
                              <label
                                key={client.id}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-caption transition-colors',
                                  checked
                                    ? 'border-accent-purple/40 bg-accent-purple/10 text-text-primary'
                                    : 'border-border-subtle bg-background-secondary/50 text-text-secondary'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canEditTeams || team.status === 'archived'}
                                  className="h-4 w-4 accent-purple-600"
                                  onChange={(event) => {
                                    const nextIds = event.target.checked
                                      ? [...team.client_ids, client.id]
                                      : team.client_ids.filter((id) => id !== client.id);
                                    updateTeam(team, { client_access_mode: 'specific', client_ids: nextIds });
                                  }}
                                />
                                <span className="truncate">{client.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {expandedTeamId === team.id && (
                      <div className="mt-4 rounded-xl border border-border-subtle bg-background-primary/40 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_auto]">
                            <Select
                              label="Adicionar membro"
                              value={teamMemberSelection[team.id] || ''}
                              options={[
                                { value: '', label: 'Selecione um membro ativo' },
                                ...availableMembers.map((member) => ({
                                  value: member.id,
                                  label: `${member.user.name} - ${member.user.email}`,
                                })),
                              ]}
                              disabled={!canManageTeamMembers || team.status === 'archived'}
                              className="h-10 py-0 text-body-sm"
                              onChange={(event) => setTeamMemberSelection((current) => ({
                                ...current,
                                [team.id]: event.target.value,
                              }))}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!canManageTeamMembers || !teamMemberSelection[team.id] || team.status === 'archived'}
                              onClick={() => addMemberToTeam(team)}
                            >
                              Adicionar
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {teamMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-background-secondary/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-body-sm font-medium text-text-primary">{member.user.name}</p>
                                <p className="text-caption text-text-muted">{member.user.email}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!canManageTeamMembers || team.status === 'archived'}
                                onClick={() => removeMemberFromTeam(team, member)}
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                          {teamMembers.length === 0 && (
                            <p className="text-caption text-text-muted">Nenhum membro carregado nesta equipe.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {teams.length === 0 && (
                <div className="rounded-xl border border-border-subtle bg-background-secondary/60 p-6 text-center text-body-sm text-text-muted">
                  Nenhuma equipe criada ainda.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="glass">
        <CardHeader className="items-start gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent-purple" />
              Membros e acessos
            </CardTitle>
            <p className="mt-1 text-caption text-text-tertiary">
              Configure papel, status e escopo de carteiras por pessoa. Para limitar acesso,
              escolha &quot;Carteiras especificas&quot; e marque as carteiras permitidas.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-body-sm text-text-muted">Carregando equipe...</div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => {
                const isSelf = member.user_id === user?.id;
                const currentRole = roles.find((role) => role.id === member.role_id);
                const checkedClients = new Set(member.client_ids);
                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-border-subtle bg-background-secondary/60 p-4"
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.45fr)]">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-caption font-semibold text-white">
                          {getInitials(member.user.name, member.user.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-heading-sm text-text-primary">{member.user.name}</p>
                            {isSelf && <Badge variant="purple" size="sm">Voce</Badge>}
                            <Badge
                              variant={member.status === 'active' ? 'success' : member.status === 'suspended' ? 'error' : 'yellow'}
                              size="sm"
                            >
                              {statusLabels[member.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-caption text-text-muted">{member.user.email}</p>
                          <p className="mt-3 text-caption text-text-tertiary">
                            {currentRole
                              ? roleDescriptions[currentRole.name] || currentRole.description || 'Permissao customizada.'
                              : 'Papel nao encontrado.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Select
                            label="Papel"
                            value={member.role_id}
                            options={roleOptions}
                            disabled={!canEdit}
                            className="h-10 py-0 text-body-sm"
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
                            className="h-10 py-0 text-body-sm"
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
                            className="h-10 py-0 text-body-sm"
                            onChange={(event) => updateScope(
                              member,
                              event.target.value as 'all' | 'specific',
                              event.target.value === 'specific' ? member.client_ids : []
                            )}
                          />
                        </div>

                        {member.client_access_mode === 'specific' ? (
                          <div className="rounded-xl border border-border-subtle bg-background-primary/40 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-caption font-medium text-text-secondary">Carteiras permitidas</p>
                                <p className="text-caption text-text-tertiary">
                                  {member.client_ids.length} de {clients.length} selecionadas
                                </p>
                              </div>
                              {clients.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canSetScope}
                                  onClick={() => updateScope(member, 'specific', [])}
                                >
                                  Limpar
                                </Button>
                              )}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {clients.map((client) => {
                                const checked = checkedClients.has(client.id);
                                return (
                                  <label
                                    key={client.id}
                                    className={cn(
                                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-caption transition-colors',
                                      checked
                                        ? 'border-accent-purple/40 bg-accent-purple/10 text-text-primary'
                                        : 'border-border-subtle bg-background-secondary/50 text-text-secondary'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!canSetScope}
                                      className="h-4 w-4 accent-purple-600"
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
                                <p className="text-caption text-text-muted">
                                  Nenhuma carteira cadastrada nesta conta.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border-subtle bg-background-primary/30 px-3 py-2">
                            <p className="text-caption text-text-tertiary">
                              Este membro tem acesso a todas as carteiras da conta ativa.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end">
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
                    </div>
                  </div>
                );
              })}
              {members.length === 0 && (
                <div className="py-10 text-center text-body-sm text-text-muted">
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
