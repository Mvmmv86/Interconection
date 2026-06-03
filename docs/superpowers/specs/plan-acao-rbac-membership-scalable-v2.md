# Especificação Técnica — Plano de Ação v2
## RBAC por Membership, Admin de Conta, Escopo por Carteira e Proteção de Corrida/N+1

**Projeto:** Interconection / Connectcoin  
**Data de criação:** 2026-06-02  
**Status:** Ajustado com base em validação do código-fonte atual  
**Objetivo:** Habilitar modelo SaaS de equipe e contas por permissão, com autorização consistente, compatível com a base existente e preparado para crescimento (300+ usuários), sem regressão de funcionamento.

---

## 1) Decisões de arquitetura já consolidadas

1. `subconta` = **usuário da equipe**.  
   O vínculo usuário ↔ organização não será apenas por coluna única em `users`; será por `memberships`.

2. `admin` da conta = papel funcional da organização (`owner/admin/manager/viewer` por tenant).  
   `superadmin` da plataforma = operador da operação (flag `is_superuser`), com trilha administrativa separada.

3. Permissões precisam ser **granulares por módulo/ação** e com **escopo por client**.

4. Um mesmo usuário pode pertencer a múltiplas organizações (contas principais).

5. Mantemos `Client` como entidade de negócio de carteira/portfólio no backend (evita quebra imediata), e a UI passa a tratar `Conta` como tenant e `Cliente` como carteira.

6. As mudanças devem ser feitas em modo de **dupla escrita/compatibilidade** na Fase 0/1 para não parar operação.

---

## 2) Situação real observada no código atual (pontos de partida)

- Dependência `require_role` existe em `backend/app/api/deps.py`, mas não é aplicada de forma consistente.
- A maioria das rotas usa apenas `get_current_user`, com filtro manual por `organization_id`.
- Não existe fluxo completo de convite/gestão de equipe nem tela de administração de membros.
- `User.organization_id` não suporta N:N nativamente (limitação principal para escala de equipes multi-org).
- Há riscos já presentes de:
  - **N+1** em serviços de resumo/agregação.
  - **Race** em operações de sync/conversão de dados sem travamento/serialização.
- `exchange.py` possui TODOs de autenticação, indicando lacunas em enforce.
- O token atual carrega só user id; sem `token_version` para revogação imediata.

---

## 3) Meta da implementação

Entregar a evolução em 5 fases:

1. Fundação (compatível com a base atual).
2. Enforcement de permissão com `membership` + `X-Account-Id`.
3. Administração de equipe na conta (convites, papéis, escopo).
4. Escopo por carteira (`membership_clients`).
5. Super-admin plataforma + hardening (audit + race/N+1 + revogação).

---

## 4) Modelo de dados proposto

### 4.1 Mudanças de compatibilidade

- `User`
  - manter coluna `organization_id` inicialmente por compatibilidade de negócio legado.
  - remover restrição de unicidade (`UNIQUE user_id + organization_id`) quando existir.
  - novos campos recomendados:
    - `is_superuser bool default false`
    - `token_version int default 0`
    - `status` opcional (`active`, `inactive`) se ainda não houver.

### 4.2 Novas tabelas

- `memberships`
  - `id`, `user_id`, `organization_id`, `role_id`, `status` (`active|invited|suspended`)
  - `client_access_mode` (`all|specific`)
  - `invited_by_user_id`, `accepted_at`, `invited_at`
  - `created_at`, `updated_at`
  - Unique: `(user_id, organization_id)`

- `roles`
  - `id`, `organization_id nullable`, `name`, `is_system`, `description`
  - Unique: `(organization_id, name)`; e `system` sem organization_id pode ser global.

- `role_permissions`
  - `role_id`, `permission_key` (ex.: `clients:view`, `wallets:edit`, `members:invite`, `exchanges:sync`)
  - Unique: `(role_id, permission_key)`

- `membership_permission_overrides`
  - `membership_id`, `permission_key`, `effect` (`grant|deny`)
  - Unique: `(membership_id, permission_key)`

- `membership_clients`
  - `membership_id`, `client_id`
  - Unique: `(membership_id, client_id)`

- `invitations`
  - `organization_id`, `email`, `role_id`, `token unique`, `status`, `expires_at`, `invited_by_user_id`, optional `notes`

- `audit_logs` já existe e começa a receber gravação obrigatória para ações mutáveis e de segurança.

### 4.3 Permissões padrão de sistema

Definir em código (registry), não em dados:
- `dashboard:view`
- `clients:list`, `clients:create`, `clients:edit`, `clients:delete`
- `wallets:view`, `wallets:create`, `wallets:edit`, `wallets:delete`
- `exchanges:view`, `exchanges:create`, `exchanges:edit`, `exchanges:delete`, `exchanges:sync`
- `manual_assets:view`, `manual_assets:create`, `manual_assets:edit`, `manual_assets:delete`
- `members:view`, `members:invite`, `members:edit`, `members:revoke`, `members:set_scope`
- `scopes:all`, `scopes:specific`
- `audit:view`
- `admin:system`, `admin:organization`
- `roles:view`, `roles:edit`

Regra de resolução:
- `role_permissions` + `membership overrides` (`grant/deny`)
- Deny explícito vence grant.

---

## 5) Estratégia de autorização por request

### 5.1 Dependências novas (backend)

- `require_membership`:
  - valida `X-Account-Id`
  - carrega membership ativa do usuário no tenant do header
  - valida `status != suspended`, `expires` etc.
  - injeta contexto de autorização (`tenant`, `membership`, `role`, `permissions`).

- `require_permission("module:action")`
  - consulta cache em memória/Redis por `(user_id, organization_id, scope_client?)`
  - fallback para DB com select otimizada (eager loading dos relacionamentos).

### 5.2 JWT

- Manter token enxuto para `user_id`
- `token_version` e versionamento de sessão adicionados para revogação.
- `X-Account-Id` NÃO substitui validação no backend (somente UX/contexto de request).

### 5.3 Cache

- Cache de permissões por membership por alguns segundos.
- Invalidar explicitamente em mudanças de role, overrides, status de membership, ou convite aceito.

---

## 6) Plano em fases

### Fase 0 — Fundação (compatibilidade e base relacional)

Objetivo: preparar plataforma sem quebrar fluxo atual.

- Criar migrations:
  - remover unicidade de `users.organization_id` (se existir)
  - `is_superuser`, `token_version`
  - criar `memberships`, `roles`, `role_permissions`, `membership_permission_overrides`, `membership_clients`, `invitations`
  - índices e constraints de integridade.
- Seed inicial:
  - `roles` padrão do sistema.
  - para cada usuário existente, criar membership ativa na organização existente.
- Ajustar nomenclatura em docs/menus (opcional): `Conta` = organização / `Cliente` = carteira.
- Entrega mínima esperada:
  - login e operações atuais continuam funcionais.
  - nenhum endpoint novo necessário para manter produção.

### Fase 1 — Enforcement core (sem buracos de autorização)

Objetivo: eliminar lacunas reais de autorização.

- Criar contexto `AuthContext` no backend (`MembershipContext`) com dependências novas.
- Migrar rotas críticas para `require_permission(...)`:
  - clientes, wallets, exchanges, manual assets, posições sensíveis, settings.
- Remover TODOs e rotas sem check real em exchanges.
- Trocar uso de `CurrentUser` por `require_permission` nos endpoints de escrita e consulta.
- Implementar filtro por membership + `client_access_mode`:
  - `all` -> acesso global do tenant
  - `specific` -> validar em `membership_clients`.
- Iniciar gravação de `audit_logs` em actions de mutação.
- Critério de aceite:
  - usuário `viewer` sem permissão não consegue criar/editar/deletar.
  - um usuário inativo/suspenso perde acesso imediatamente via middleware.

### Fase 2 — Admin da conta (MVP de equipe)

- Endpoints novos:
  - `POST /api/v1/team/invitations`
  - `POST /api/v1/team/invitations/{token}/accept`
  - `GET /api/v1/team/members`
  - `PATCH /api/v1/team/members/{id}`
  - `DELETE /api/v1/team/members/{id}`
  - `GET /api/v1/team/roles`
  - `PATCH /api/v1/team/members/{id}/scope`
- Frontend:
  - completar `Settings -> Team`
  - fluxo de convite, alteração de papel e revogação.
- Escopo:
  - setar `client_access_mode`, incluir/excluir `client_ids`.
- Critério de aceite:
  - fluxo de convite → aceitação → membership ativa com permissão correta.

### Fase 3 — Escopo por carteira

- Implementar enforcement por `client_id`/escopo no backend:
  - leitura de listas e ações de client-specific.
- UI:
  - mostrar somente clientes/ações permitidas por escopo.
- Critério de aceite:
  - membro com escopo `specific` não vê nem altera clientes fora da lista.

### Fase 4 — Super-admin e governança

- Grupo admin plataforma:
  - endpoints separados (`/api/v1/admin/*`) com guard `is_superuser`.
  - listagem global de tenants, usuários, status, suspensão de conta.
- Auditoria:
  - padrão obrigatório de registro de eventos críticos.
- Critério de aceite:
  - superuser consegue governar sem misturar regra de tenant.

### Fase 5 — Hardening de concorrência/perf (obrigatório)

- Corrigir N+1 identificados:
  - `client_service` resumo por clients (agregação em lote)
  - `exchange_service` resumo de posições (group by em lote)
- Corrigir race no sync:
  - bloqueios por transação/lock de sync por exchange+client.
  - operação idempotente quando aplicável.
- Segurança de sessão:
  - logout e suspensão incrementam `token_version`.
  - endpoints checam versão no `get_current_user`.
- Critério de aceite:
  - operações concorrentes repetidas não corrompem histórico/saldos.
  - redução de carga por consulta em rotas de lista/summary.

---

## 7) Estratégia de rollout (sem parar operação)

1. Fase 0 e 1 em feature flags:
   - `RBAC_ENFORCEMENT_V1`
   - `RBAC_SCOPE_SPECIFIC`
2. Compatibilidade temporal:
   - aceitar `organization_id` legado enquanto não migrado 100% das chamadas.
3. Backfill gradativo:
   - jobs de validação de membership por organização.
4. Métrica de sucesso:
   - zero 500 por permissão mal resolvida.
   - redução de `403` indevidos (falso positivo) após testes com usuários reais.

---

## 8) Critérios globais de aceite

- Nenhum endpoint que escreve dado sem permissão.
- Nenhum caminho de admin/visualização dependente de condição só no frontend.
- 1 usuário com múltiplas organizações funciona.
- Convida/aceita/edita acesso por tenant sem apagar usuários.
- Audit logs existentes passam a ser realmente escritos em operações de permissão, sync, convite e dados sensíveis.
- Segurança sem regressão para token e sessão.
- N+1 e race dos pontos críticos com evidência de redução.

---

## 9) Riscos e mitigação

- **Risco de migração de schema grande:** mitigação com fase 0 semântica compatível e script de backfill transacional.
- **Risco de enum role inconsistent (`Admin/ADMIN`):** normalizar antes de Fase 1.
- **Risco de UX confusa por contexto de conta:** persistir seleção de conta e mostrar identidade de ativo na UI.
- **Risco de performance durante enforcement inicial:** cache de permissões com TTL curto e invalidação por evento.

---

## 10) Próximos passos para o Claude revisar

1. Validar esse plano contra os arquivos de schema/migrations já existentes.
2. Confirmar nome oficial de rotas (`/team`, `/admin`, `/me/active-org` etc.) antes do primeiro PR.
3. Aprovar decisão de:
   - renomear UI `Client` para `Carteira` e preservar backend.
   - manter superadmin via `is_superuser`.
   - impor limite por plano já na Fase 0/1 (recomendado: sim).

> Plano preparado para converter em backlog por PRs incrementais na ordem:
> 0-fundation → 1-core-enforcement → 2-team-admin → 3-scopes → 4-superadmin → 5-hardening.
