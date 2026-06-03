# EspecificaÃ§Ã£o TÃ©cnica â€” Plano de AÃ§Ã£o v3
## RBAC por Membership, Admin de Conta e Escopo por Carteira com MigraÃ§Ã£o Segura

**Projeto:** Interconection / Connectcoin  
**Data de criaÃ§Ã£o:** 2026-06-02  
**Objetivo:** Implementar RBAC de equipe multi-tenant com autorizaÃ§Ã£o de verdade, sem regressÃ£o e sem buracos de seguranÃ§a, sem perder dados durante migraÃ§Ã£o.

## 1) Ajustes crÃ­ticos incorporados nesta versÃ£o (v3)

Esta versÃ£o corrige quatro inconsistÃªncias importantes detectadas na revisÃ£o do plano anterior:

`exchange.py` possui endpoints de escrita ainda sem autenticaÃ§Ã£o (`# TODO: Re-enable auth`), hoje. Isso Ã© P0 e precisa de hotfix antes de qualquer fase de RBAC.

`users.organization_id` existe com `ondelete=CASCADE`, o que cria risco de perda de usuÃ¡rios se uma organizaÃ§Ã£o for removida em cenÃ¡rio multi-org.

`users.role` (enum legado) e novos roles via `memberships.role_id` coexistem no modelo atual. Sem decidir fonte da verdade, hÃ¡ split-brain.

O fluxo de aceite de convite precisa tratar e-mail existente (nÃ£o pode gerar organizaÃ§Ã£o nova por erro no register).

## 2) DecisÃµes de arquitetura

Subconta = usuÃ¡rio da equipe (`memberships`), nÃ£o uma nova entidade de cliente.
`admin` da conta = owner/admin/manager/viewer por tenant com `memberships`.
`superadmin` da plataforma = `is_superuser`, trilha e rotas separadas.
PermissÃµes granulares por `module:action` e escopo por carteira (`Client`) com modo all/specific.
UsuÃ¡rio pode pertencer a vÃ¡rias organizaÃ§Ãµes.
Compatibilidade de operaÃ§Ã£o mantida com fase de migraÃ§Ã£o dual-context (`organization_id` legado + `membership`).

## 3) SituaÃ§Ã£o atual de baseline (o que jÃ¡ existe)

`require_role` existe em backend, porÃ©m pouco aplicado.
Maioria dos endpoints usa apenas `get_current_user`.
Sem fluxo completo de equipe (convites, gestÃ£o e escopos).
N+1 jÃ¡ existente em resumo de clientes.
Race jÃ¡ existente em sync de exchange.
Token hoje depende sÃ³ de user id, sem `token_version`.
Front ainda nÃ£o tem contexto de memberships + seletor de conta ativa.

## 4) Modelo de dados

### 4.1 User

Manter `organization_id` inicialmente para compatibilidade operacional.
`organization_id` nÃ£o deve ser Ãºnico e deve sair da lÃ³gica de â€œdonaâ€ do relacionamento para evitar cascata.
Adicionar:
`is_superuser bool default false`
`token_version int default 0`
`last_login_at` pode continuar.

`role` legado permanece apenas como fallback de leitura (`deprecated`) atÃ© remoÃ§Ã£o completa.

### 4.2 Migrar relaÃ§Ã£o de posse com seguranÃ§a

Alterar `ForeignKey`/relationship de `User.organization_id` para `ondelete=SET NULL` (ou equivalente nÃ£o-cascata) conforme modelagem final.
Isso Ã© obrigatÃ³rio para prevenir perda de usuÃ¡rio em exclusÃ£o de organizaÃ§Ã£o no modelo multi-tenant.

### 4.3 Novas entidades

`memberships` com `(user_id, organization_id)` Ãºnico.
`roles` com escopo global e/ou por organizaÃ§Ã£o.
`role_permissions`.
`membership_permission_overrides` com efeito `grant/deny`.
`membership_clients`.
`invitations`.
`audit_logs` passa a ser obrigatÃ³rio em aÃ§Ãµes crÃ­ticas.

ObservaÃ§Ã£o de integridade: `users.role` nÃ£o Ã© substituto de `membership.role_id`.

### 4.4 Registry de permissÃµes

PermissÃµes em cÃ³digo:
`dashboard:view`
`clients:list|create|edit|delete`
`wallets:view|create|edit|delete`
`exchanges:view|create|edit|delete|sync`
`manual_assets:view|create|edit|delete`
`members:view|invite|edit|revoke|set_scope`
`scopes:all|specific`
`roles:view|edit`
`audit:view`
`admin:organization|system`

Regra: deny explÃ­cito vence grant explÃ­cito.

## 5) Ordem de execuÃ§Ã£o (fases)

### 0a â€” HOTFIX (semÃ¢ntica de seguranÃ§a e estabilidade)

Ativar autenticaÃ§Ã£o nas rotas com TODO em produÃ§Ã£o antes de qualquer mudanÃ§a de autorizaÃ§Ã£o funcional.
Finalizar `exchange` endpoints sem `current_user` em operaÃ§Ãµes sensÃ­veis.
Adicionar proteÃ§Ã£o de autenticaÃ§Ã£o para chamadas existentes que estÃ£o executando escrita sem validaÃ§Ã£o.
Priorizar estes pontos jÃ¡ confirmados no cÃ³digo atual:
- `backend/app/api/v1/endpoints/exchanges.py`
  - `POST /api/v1/exchanges/test-connection` agora exige usuÃ¡rio autenticado antes de prosseguir para RBAC.
- `frontend/src/hooks/useExchangeTransactions.ts`
  - remover chamadas de transaÃ§Ã£o sem `Authorization`.
- `frontend/src/hooks/useExchangePositions.ts`
  - remover `client_id` fantasma em sync (`00000000-0000-0000-0000-000000000001`) e validar escopo por carteira antes de chamar `POST /clients/{client_id}/exchanges/{exchange_id}/sync`.
- `frontend/src/lib/api/client.ts` + hook pattern
  - padronizar chamadas sensÃ­veis por `api.request()`/`api.authHeaders()` para evitar drift de token entre componentes.

CritÃ©rio de aceite:
Nenhuma rota de escrita de resource crÃ­tico sem autenticaÃ§Ã£o.

### 0b â€” FundaÃ§Ã£o e compatibilidade de dados

Implementar migraÃ§Ã£o inicial das novas tabelas e campos.
Backfill:
criar `membership` ativa para cada usuÃ¡rio legando existente na sua organizaÃ§Ã£o atual.
seed de roles/policies padrÃ£o.
Mapeamento de role legado:
`admin` â†’ owner (ou admin full), `manager` â†’ manager, `viewer` â†’ viewer.

MigraÃ§Ã£o de relaÃ§Ã£o org:
`User.organization_id` nÃ£o pode quebrar dados legado.
nÃ£o remover imediatamente leitura legacy de `organization_id`.

CritÃ©rio de aceite:
Login continua funcionando com dados atuais.
Sem perda de usuÃ¡rios na reorganizaÃ§Ã£o.

### 1 â€” Enforcement de autenticaÃ§Ã£o e autorizaÃ§Ã£o core

Introduzir context object de autorizaÃ§Ã£o com:
`require_membership(active, account_id_header)`
`require_permission(permission_key)`

Substituir por permission checks em endpoints crÃ­ticos:
Clientes, wallets, exchanges, manual assets, settings, profile.
Implementar invariante de escopo para sub-recursos:
qualquer acesso a wallet/exchange deve validar cadeia `organization_id do client` e `membership scope`.
Filtrar pelo `membership` e `membership_clients` quando `specific`.

Implementar resoluÃ§Ã£o com cache `memory first`.
Redis Ã© opcional e nÃ£o pode travar authz: falha de Redis cai para DB e continua.

CritÃ©rio de aceite:
Viewer sem permissÃ£o nÃ£o cria/edita/deleta.
UsuÃ¡rio suspenso perde acesso imediato (token_version + role check).

### 2 â€” Admin da Conta (equipe e convites)

Criar APIs de equipe:
`GET /api/v1/team/members`
`POST /api/v1/team/invitations`
`POST /api/v1/team/invitations/{token}/accept`
`PATCH /api/v1/team/members/{id}`
`DELETE /api/v1/team/members/{id}`
`GET /api/v1/team/roles`
`PATCH /api/v1/team/members/{id}/scope`

Regra de accept:
Se e-mail existente, apenas cria/ativa `membership`.
Se e-mail nÃ£o existe, cria usuÃ¡rio com token de convite e sÃ³ atribui membership correta sem criar org nova.

Endpoint de aceite (`accept`) Ã© pÃºblico (sem membership ativa prÃ©via).

CritÃ©rio de aceite:
Convite/aceitaÃ§Ã£o nÃ£o gera organizaÃ§Ã£o fantasma.

### 3 â€” Escopo por carteira + UI de acesso

Completar filtros por `client_access_mode` em backend e frontend.
Implementar pÃ¡gina de seleÃ§Ã£o de conta ativa, `GET /api/v1/me/memberships`, `POST /api/v1/me/active-account`.
Adicionar proteÃ§Ã£o visual e funcional de menu por `can(permission)`.

CritÃ©rio de aceite:
`specific` nÃ£o visualiza nem altera client fora do escopo.

### 4 â€” Super-admin de plataforma

Criar rota `/api/v1/admin/*` com guard `is_superuser`.
Incluir operaÃ§Ãµes de gestÃ£o de organizaÃ§Ã£o, usuÃ¡rio, status e auditoria global.

### 5 â€” Hardening: concorrÃªncia e performance

Corrigir N+1 em:
`client_service` resumo por clientes com agregaÃ§Ã£o por grupo no mesmo query.
`exchange_service` resumo por exchange/posiÃ§Ã£o com agregaÃ§Ã£o em batch.

Corrigir race em sync:
`SELECT FOR UPDATE`/lock por operaÃ§Ã£o crÃ­tica.
IdempotÃªncia onde possÃ­vel para operaÃ§Ãµes repetidas.

RevogaÃ§Ã£o imediata:
logout e suspensÃ£o incrementam `token_version`.
checagem de version no middleware/token decode.

CritÃ©rio de aceite:
operaÃ§Ãµes concorrentes nÃ£o corrompem estado.
reduÃ§Ã£o comprovÃ¡vel de queries por listagem/summary.

## 6) Rollout e compatibilidade

Fase 0 e 1 com feature flags:
`RBAC_ENFORCEMENT_V1`
`RBAC_SCOPE_SPECIFIC`

`organization_id` legado e `active membership` coexistem atÃ© 100% dos caminhos crÃ­ticos migrados.
AtÃ© esse ponto, UI mostra conta ativa inicial como organization legado.
SÃ³ depois de migrado, liberar contexto multi-org no fluxo normal da UI.

## 7) Regras de aceitaÃ§Ã£o para revisÃ£o do Claude

Nenhum endpoint de escrita sem `require_auth`.
Nenhum endpoint de leitura sensÃ­vel sem `require_membership`.
Nenhum caminho de seguranÃ§a depende apenas de lÃ³gica de frontend.
Audit log obrigatÃ³rio em operaÃ§Ãµes crÃ­ticas e permissÃ£o.
Sem perda de dados em migraÃ§Ã£o de `organization_id`.
`exchange` e demais recursos com bypass de auth corrigidos antes do rollout.

## 8) EstratÃ©gia de testes obrigatÃ³ria

Testes de controle de acesso por role e por membership.
Testes de escopo org + specific/all.
Testes de split-brain:
`users.role` e `membership.role_id` consistentes por endpoint.
Testes de convite: usuÃ¡rio existente e nÃ£o existente.
Testes de concorrÃªncia em convite/seat e sync.
Testes de token_version para logout e suspensÃ£o.
Testes de fallback Redis indisponÃ­vel (deve continuar com DB).

## 9) Riscos remanescentes

Requisito de limpeza de nomenclatura `Client` x `Conta` pode pedir ajustes de UX.
Plano de assento por plano permanece recomendaÃ§Ã£o de etapa posterior se nÃ£o aplicar lock transacional forte.
MigraÃ§Ã£o de `organization_id` precisa janela com backup e observabilidade.

## 10) Resultado esperado

VersÃ£o pronta para backlog PR by PR:
0a-hotfix â†’ 0b-fundaÃ§Ã£o â†’ 1-enforcement â†’ 2-team â†’ 3-scopes â†’ 4-super-admin â†’ 5-hardening.

## 11) Impacto e prontidão (itens que não podem ser esquecidos)

Antes de avançar para mudanças de rota por fase:

- [ ] Revisar dependências de `organization_id` em todos os pontos de exchange (`backend/app/api/v1/endpoints/exchanges.py`, `backend/app/services/exchange_service.py`, `backend/app/models/*`) antes de trocar `CurrentUser` por `require_membership`.
- [ ] Fechar integrações sem proteção explícita: chamadas sem token, `client_id` placeholder e endpoints de exchange ainda sem validação de usuário.
- [ ] Definir rollback por endpoint durante rollout (`RBAC_ENFORCEMENT_V1` e `RBAC_SCOPE_SPECIFIC`) para evitar bloqueio de produção por regressão de autorização.
- [ ] Validar fallback de UI durante a migração (especialmente `frontend/src/hooks/useExchangePositions.ts`, `frontend/src/app/positions/exchanges/page.tsx`, `frontend/src/contexts/client-context.tsx`).
- [ ] Incluir no checklist de revisão: se houver mudança por `organization_id` legado, confirmar que não há perda de usuários por `ON DELETE CASCADE` e que `accept` de convite não cria organização fantasma.

Critério de aceitação adicional para este pacote:
- Nenhum PR da fase 0a/0b fecha sem evidência de mitigação para cada risco desta seção.

## 11.b) AvanÃ§o do pacote item1/2 (execuÃ§Ã£o em curso)

- [x] `frontend/src/hooks/useExchangeLivePositions.ts`:
  - MigraÃ§Ã£o para `api.request()` em vez de `fetch` cru.
  - Garante autorizaÃ§Ã£o e refresh automÃ¡ticos via helper de auth.
- [x] `frontend/src/hooks/useExchangeDetail.ts`:
  - MigraÃ§Ã£o para `api.request()` em vez de `fetch` cru.
  - PadronizaÃ§Ã£o de erro/sucesso via ApiResponse.
- [x] `backend/app/api/v1/endpoints/exchanges.py`:
  - `POST /api/v1/exchanges/test-connection` sem `client_id` placeholder.
  - ValidaÃ§Ã£o via mÃ©todo novo no service com credenciais recebidas.
- [x] `backend/app/services/exchange_service.py`:
  - Adicionado `test_connection_with_credentials()` para testes de conexÃ£o com credenciais sem objeto de Exchange persistido.
- [ ] Revisar `organization_id` em todos os pontos crÃ­ticos (`exchanges.py` e `exchange_service.py`) para a fase de `require_membership`.

ObservaÃ§Ã£o: manter como risco aberto este pacote atÃ© validaÃ§Ã£o manual do Claude e execuÃ§Ã£o do checklist de rollback por endpoint (RBAC_ENFORCEMENT_V1 / RBAC_SCOPE_SPECIFIC).

## 11.c) Resultado do pacote item1/item2 (revisao de integracao exchange)

- [x] Exchange endpoints criticos revisados para manter organization_id do Client na cadeia de autorizacao:
  - backend/app/api/v1/endpoints/exchanges.py: list_exchanges, create_exchange, get_exchange, delete_exchange, sync_exchange, get_exchange_positions, get_exchange_transactions, get_single_exchange_transactions, get_exchange_live_data e test-connection.
- [x] Service layer ajustado para validar organizacao do dono do exchange antes de ler dados do adapter:
  - backend/app/services/exchange_service.py: sync_exchange, get_exchange_account_data, get_exchange_live_data, get_exchange_transactions.
- [x] Frontend hooks de exchange migrados para helper autenticado (api.request) sem chamadas crus sem auth:
  - frontend/src/hooks/useExchangeLivePositions.ts
  - frontend/src/hooks/useExchangeDetail.ts
  - frontend/src/hooks/useExchangeTransactions.ts
  - frontend/src/hooks/useExchangePositions.ts
- [x] Rollback por endpoint com flags (RBAC_ENFORCEMENT_V1, RBAC_SCOPE_SPECIFIC) preparado no backend para rollout seguro em fase 1.

## 11.d) Rollout e rollback por endpoint (RBAC)

Durante a fase 1, a troca por `require_membership` deve entrar por rota, com bloqueio controlado por flags no backend:

- `RBAC_ENFORCEMENT_V1`: ativa/desativa enforcement global inicial (padrão OFF).
- `RBAC_ENFORCEMENT_V1_ENDPOINTS`: CSV de chaves de rota ativas para enforcement.
- `RBAC_SCOPE_SPECIFIC`: ativa/desativa enforcement de escopo `specific` (padrão OFF).
- `RBAC_SCOPE_SPECIFIC_ENDPOINTS`: CSV de chaves de rota ativas para escopo específico.

Condição de segurança:

- Em rollback, manter `RBAC_*_ENDPOINTS` vazio e ambos os flags desligados.
- Não subir commit de fase 1 sem validação por rota:
  - `exchange`: `/clients/{client_id}/exchanges`, `/exchanges/*`, `/positions/exchanges/*`.
  - `wallet`: `/clients/{client_id}/wallets/*`.
  - `manual-assets`: `/clients/{client_id}/manual-assets/*`.
  - `clients`: `/clients/*`.
  - `positions`: `/positions/*`.
  - `settings`: `/users/me` (endpoint `/users/me/scope` não existe ainda e fica para criação/integração no pacote de rollout de settings).

Estado atual do rollout:

- [x] No backend: feature flags e allowlist de rotas adicionadas em `backend/app/core/config.py` e `.env/.env.example`.
- [x] No backend: helpers de decisão por rota adicionados em `backend/app/api/deps.py`.
- [x] No plano: mapear endpoints de cada fase em ordem de produção e registrar evidência de smoke por rota antes de habilitar flag.
- [x] No código de exchange: rollout guard aplicado com `rbac_route_guard("exchange")` em todos os endpoints dos routers `router` e `exchange_positions_router`.
- [x] No código de clients: rollout guard aplicado com `rbac_route_guard("clients")` em `backend/app/api/v1/endpoints/clients.py`.
- [x] No código de wallets: rollout guard aplicado com `rbac_route_guard("wallets")` em `backend/app/api/v1/endpoints/wallets.py`.
- [x] No código de manual-assets: rollout guard aplicado com `rbac_route_guard("manual-assets")` em `backend/app/api/v1/endpoints/manual_assets.py`.
- [x] No código de positions: rollout guard aplicado com `rbac_route_guard("positions")` em `backend/app/api/v1/endpoints/positions.py`.
- [x] No código de settings (usuário): rollout guard aplicado com `rbac_route_guard("settings")` em `backend/app/api/v1/endpoints/users.py` (`/users/me*`).
- [x] No código de clients: enforcement inicial por `require_permission(...)` aplicada em todos os endpoints com `route_key="clients"` no `backend/app/api/v1/endpoints/clients.py`.
- [x] No código de wallets: enforcement inicial por `require_permission(...)` aplicada em endpoints com `route_key="wallets"` no `backend/app/api/v1/endpoints/wallets.py`.

## 11.f) Proof de enforcement por módulo (clients)

Escopo deste corte:

- Módulo: `clients`
- Flags:
  - `RBAC_ENFORCEMENT_V1=true`
  - `RBAC_ENFORCEMENT_V1_ENDPOINTS=clients`
  - `RBAC_SCOPE_SPECIFIC` opcional (padrão `false` para validação inicial)
- Prova mínima com DB real:
  - `GET /api/v1/clients` com token `owner`: `200`
  - `GET /api/v1/clients` com token `viewer`: `200` (regra `clients:list`, leitura permitida)
  - `POST /api/v1/clients` com token `viewer`: `403` (regra `clients:create`)
- Escopo (opcional nesta etapa): com `RBAC_SCOPE_SPECIFIC=true` e `RBAC_SCOPE_SPECIFIC_ENDPOINTS=clients`, validar:
  - membro `SCOPE: SPECIFIC` sem `client_id` no membership recebe `403` em `GET /api/v1/clients/{id}` e `DELETE /api/v1/clients/{id}` fora da lista permitida.
- Rollback:
  - manter flags OFF e `RBAC_ENFORCEMENT_V1_ENDPOINTS` vazio para restaurar comportamento legado sem alterar código.

## 11.e) Prova de rollout 0b (sem Docker)

Decisão: **Não usar Docker no fluxo de desenvolvimento local**.

Validação real com Postgres local:

- Ajustar `DATABASE_URL` para o Postgres de desenvolvimento local em `.env`.
- `cd backend`
- `DEBUG=true APP_ENV=development venv\\Scripts\\python.exe -m alembic upgrade head`
- Inserir 2 usuários de cenário legado e validar backfill (admin/viewer) com `SELECT`.
- Conferir schema de fundação:
  - `users.is_superuser` existe e `users.token_version` existe.
  - `roles` = 4 registros e `role_permissions` populado.
  - `memberships` criadas para cada usuário legado (`admin` -> `owner`, `viewer` -> `viewer`).
  - `organization_id` em `users` nullable.
- `cd backend; DEBUG=true APP_ENV=development venv\\Scripts\\python.exe -c "from app.main import app; print('OK')"`
- Executar uma query autenticada de smoke (`GET /api/v1/users/me`) com token válido.
- Validação extra de schema/seed sem Docker com script:
  - `cd ..`
  - `py -3 scripts/rbac_migration_smoke.py`
  - (o script exige `DATABASE_URL` resolvido em `backend/.env` ou no ambiente atual)

Regra:
- Nenhum PR da fase 0a/0b é considerado concluído sem estas evidências no ambiente local.

Próximo passo operacional (sem Docker):

- 1) Rodar a upgrade e smoke da foundation em banco de staging/dev (com dados reais de teste):
  - `cd backend`
  - `DEBUG=true APP_ENV=development venv\\Scripts\\python.exe -m alembic upgrade head`
  - `py -3 ..\\scripts\\rbac_migration_smoke.py`
- 2) Validar `GET /api/v1/users/me` com token válido no mesmo ambiente.
- 3) Só então, em etapa de rollout controlado, habilitar por ambiente:
  - `RBAC_ENFORCEMENT_V1=true`
  - `RBAC_ENFORCEMENT_V1_ENDPOINTS=exchange,clients,wallets,manual-assets,positions,settings`

### 11.f) Fechamento técnico do ponto 11.e (next-step pronto p/ review)

- [x] Corrigido mapeamento ambíguo de `User` ↔ `Membership`:
  - `backend/app/models/user.py`:
    - `memberships` com `foreign_keys=[Membership.user_id]`
    - `invited_memberships` com `foreign_keys=[Membership.invited_by_user_id]`
  - `backend/app/models/membership.py`:
    - `user` com `foreign_keys=[user_id]`
- [x] Validado que os mappers carregam sem `AmbiguousForeignKeysError`:
  - `from sqlalchemy.orm import configure_mappers`  
    `MAPPERS_OK`
- [x] Validação de boot local sem auth stack:
  - `DEBUG=true APP_ENV=development venv\\Scripts\\python.exe -c "from app.main import app; print('OK')"`
  - Resultado: `OK`
- [ ] Pendência de infraestrutura para fechar a trilha final do rollout:
  - `GET /api/v1/users/me` com token válido ainda depende de Postgres local disponível no ambiente do usuário (sem Docker).

### 11.g) Correção crítica de enum da migration 0b

- [x] Ajuste aplicado na migration `backend/alembic/versions/20260603_rbac_membership_foundation.py` para casar com os enums dos models (valores MAIÚSCULOS):
  - `membershipstatus`: `ACTIVE | INVITED | SUSPENDED`, default `INVITED`
  - `membershipclientaccessmode`: `ALL | SPECIFIC`, default `ALL`
  - `membershippermissioneffect`: `GRANT | DENY`, default `GRANT`
  - `invitationstatus`: `PENDING | ACCEPTED | REVOKED | EXPIRED`, default `PENDING`
  - Índice parcial ajustado para `WHERE status = 'PENDING'`
  - Backfill de memberships agora usa `status='ACTIVE'` e `client_access_mode='ALL'`
- [ ] Executar prova real no Postgres com dados migrados para confirmar:
  - `SELECT` de `Membership` / `Invitation`
  - `AUTH_QUERY_PATH_OK` com `GET /api/v1/users/me` autenticado
