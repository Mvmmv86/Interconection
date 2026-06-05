# Especificacao Tecnica - Plano de Acao Futuro
## Bots, Estrategias, Indicadores e Backtesting - BC Futuros

**Projeto:** Interconection / Connectcoin  
**Status:** Backlog futuro, bloqueado ate finalizar RBAC, permissoes e admin de equipe  
**Objetivo:** Criar uma infraestrutura escalavel para automacao operacional baseada na metodologia BC Futuros, com abas dedicadas de Bots e Estrategias, sem execucao financeira insegura, sem race condition, sem N+1 e com isolamento por tenant.

---

## 1) Decisao de ordem de execucao

Este plano **nao deve ser implementado agora**.

Pre-requisitos obrigatorios:

- Fase 1 do RBAC concluida e validada.
- Fase 2 de admin de equipe, convites, roles e escopos concluida.
- Escopo por carteira funcionando no backend.
- Permissoes granulares disponiveis para novos modulos.
- Audit logs prontos para acoes sensiveis.

Somente depois disso a plataforma deve iniciar o modulo de Bots/Estrategias.

---

## 2) Visao do produto

A plataforma tera duas areas principais:

### 2.1 Aba Bots

Area operacional onde o usuario cria, configura, acompanha e controla bots.

Funcionalidades esperadas:

- Criar bot vinculado a conta/organizacao, carteira (`Client`) e exchange.
- Selecionar estrategia previamente criada.
- Configurar modo:
  - `backtest`
  - `paper_trading`
  - `live_paused`
  - `live_running`
- Definir limites de risco do bot.
- Ativar/desativar bot conforme permissao.
- Pausar por kill switch.
- Acompanhar sinais, ordens, posicoes e performance.
- Visualizar eventos/auditoria do bot.

### 2.2 Aba Estrategias

Area de pesquisa, criacao e validacao de estrategias.

Funcionalidades esperadas:

- Criar estrategias.
- Criar/configurar indicadores.
- Compor estrategia com indicadores, regras de entrada, saida e stop.
- Rodar backtests por ativo, timeframe e periodo.
- Comparar resultados.
- Versionar estrategias para evitar que alteracoes mudem historico de bots existentes.
- Publicar estrategia para uso em bots.

---

## 3) Principio arquitetural

O bot nao deve ser um processo monolitico que "ve sinal e manda ordem".

A arquitetura deve ser composta por motores separados:

- `MarketDataIngestion`
- `IndicatorEngine`
- `SignalEngine`
- `RiskEngine`
- `ExecutionEngine`
- `ReconciliationWorker`
- `BotScheduler`
- `Audit/EventLog`

Cada motor deve ter responsabilidade unica e estado persistido.

---

## 4) Componentes recomendados

### 4.1 MarketDataIngestion

Responsavel por coletar e normalizar dados de mercado.

Regras:

- Persistir candles normalizados.
- Unique por `exchange`, `symbol`, `timeframe`, `close_time`.
- Nunca recalcular estrategia com candle duplicado.
- Marcar candle como fechado/confirmado.
- Tratar gaps de dados e dados atrasados.

### 4.2 IndicatorEngine

Responsavel por calcular indicadores.

Indicadores iniciais:

- ATR
- MFI
- RSI
- AlphaTrend adaptado da metodologia BC Futuros

Regras:

- Calculo em batch por ativo/timeframe.
- Cache incremental quando possivel.
- Nenhum loop N+1 por bot.
- Resultado persistido ou memoizado por `indicator_config_hash`.

### 4.3 SignalEngine

Responsavel por transformar indicadores em sinais.

Sinais possiveis:

- `buy`
- `sell`
- `exit`
- `update_stop`
- `no_action`

Regra de idempotencia:

- Unique por `bot_id`, `symbol`, `timeframe`, `candle_close_time`, `signal_type`.

### 4.4 RiskEngine

Responsavel por decidir se um sinal pode virar operacao.

Validacoes:

- Risco maximo por trade.
- Exposicao maxima por operacao.
- Exposicao maxima por ativo.
- Exposicao total.
- Risco simultaneo maximo.
- Correlacao entre ativos.
- Alavancagem maxima permitida.
- Stop valido.
- Tamanho minimo e maximo de ordem.

Regra central:

- A automacao nao pergunta "quanto comprar?".
- A automacao pergunta "quanto posso perder?".

### 4.5 ExecutionEngine

Responsavel por enviar ordens.

Regras:

- Nunca enviar ordem dentro do request HTTP.
- Ordem sempre nasce de um `trade_intent` persistido.
- Toda ordem deve ter `idempotency_key`.
- Retry nao pode duplicar ordem.
- Falha de exchange nao pode corromper estado local.

### 4.6 ReconciliationWorker

Responsavel por reconciliar estado local com exchange.

Regras:

- Conferir ordens, fills, posicoes e saldos reais.
- Corrigir estados divergentes.
- Rodar periodicamente e tambem apos execucoes.
- Banco local nunca e fonte absoluta de verdade para ordem executada.

### 4.7 BotScheduler

Responsavel por orquestrar execucoes por timeframe.

Regras:

- Nao criar um cron por usuario.
- Rodar por grupos de `exchange`, `symbol`, `timeframe`.
- Avaliar bots ativos em lote.
- Respeitar locks por bot/simbolo/timeframe.

### 4.8 Audit/EventLog

Responsavel por trilha de auditoria.

Eventos obrigatorios:

- Criacao/edicao de bot.
- Publicacao de estrategia.
- Mudanca de risco.
- Ativacao live.
- Pausa/desativacao.
- Geracao de sinal.
- Decisao do risk engine.
- Envio de ordem.
- Erro de exchange.
- Reconciliation divergente.

---

## 5) Modelo de dados inicial

Tabelas sugeridas:

- `trading_bots`
- `bot_strategy_versions`
- `bot_risk_configs`
- `strategy_definitions`
- `indicator_definitions`
- `indicator_runs`
- `market_candles`
- `bot_signals`
- `bot_trade_intents`
- `bot_orders`
- `bot_positions`
- `bot_risk_snapshots`
- `bot_backtests`
- `bot_backtest_results`
- `bot_events`

Regras de modelagem:

- Todas as tabelas operacionais devem ter `organization_id`.
- Entidades de execucao devem ter `client_id` quando forem vinculadas a carteira.
- Configuracoes sensiveis devem ser versionadas.
- Nunca alterar estrategia historica ja usada por bot ou backtest; criar nova versao.

---

## 6) Permissoes RBAC futuras

Adicionar ao registry de permissoes depois que RBAC/admin estiver finalizado:

- `bots:view`
- `bots:create`
- `bots:edit`
- `bots:delete`
- `bots:enable_live`
- `bots:disable`
- `bots:backtest`
- `bots:paper_trade`
- `strategies:view`
- `strategies:create`
- `strategies:edit`
- `strategies:delete`
- `strategies:publish`
- `indicators:view`
- `indicators:create`
- `indicators:edit`
- `indicators:delete`
- `orders:view`
- `orders:cancel`
- `trading:execute`
- `risk:view`
- `risk:edit`

Regras:

- `viewer` pode visualizar, mas nunca ativar live trading.
- Ativacao live exige permissao forte (`bots:enable_live` e/ou `trading:execute`).
- Edicao de risco exige `risk:edit`.
- Toda acao live precisa de audit log.

---

## 7) Concorrencia e idempotencia

Obrigatorio:

- Lock por `bot_id + symbol + timeframe` durante avaliacao.
- Unique constraint em `bot_signals`.
- Unique constraint em `bot_orders.idempotency_key`.
- `SELECT FOR UPDATE` nos agregados de risco antes de criar trade intent.
- Transactional outbox para envio de ordem.
- Jobs idempotentes.
- Reconciliation obrigatorio.

Fluxo ideal:

1. Worker recebe candle fechado.
2. Abre transacao.
3. Aplica lock no bot/simbolo/timeframe.
4. Verifica se sinal do candle ja existe.
5. Calcula indicador.
6. Calcula risco.
7. Cria `trade_intent`.
8. Cria `bot_order` com `idempotency_key`.
9. Commit.
10. Worker de execucao envia ordem.
11. Reconciliation confirma estado real.

---

## 8) Performance e N+1

Regras:

- Buscar bots ativos em batch.
- Buscar candles em batch por `symbol/timeframe`.
- Agregar exposicao com `GROUP BY`, nao em loop por bot.
- Precomputar snapshots de risco.
- Evitar lazy loading em workers.
- Separar calculo pesado de request HTTP.
- Usar indices em `organization_id`, `client_id`, `bot_id`, `symbol`, `timeframe`, `close_time`, `status`.

Meta inicial:

- Suportar 300+ usuarios sem criar jobs individuais excessivos.
- Scheduler deve agrupar trabalho por mercado/timeframe.

---

## 9) Seguranca

Obrigatorio:

- API keys criptografadas.
- Nunca retornar secret/API key para frontend.
- Kill switch por organizacao, bot, exchange e plataforma.
- Feature flag para live trading.
- Live trading inicialmente desabilitado por padrao.
- Rate limit em acoes sensiveis.
- Audit log completo.
- Escopo por carteira aplicado em bots e estrategias vinculadas a carteira.
- Superadmin nao deve executar trade em tenant sem trilha especial de auditoria.

---

## 10) Fases de implementacao futura

### Fase Bot 0 - Fundacao

- Criar models/migrations principais.
- Adicionar permissoes ao RBAC.
- Criar audit events.
- Criar feature flags:
  - `BOTS_MODULE_ENABLED`
  - `BOTS_LIVE_TRADING_ENABLED`

### Fase Bot 1 - Estrategias e Indicadores

- Aba Estrategias.
- CRUD de estrategias.
- CRUD/config de indicadores.
- AlphaTrend, ATR, MFI, RSI.
- Versionamento de estrategia.

### Fase Bot 2 - Backtesting

- Rodar backtests por ativo/timeframe/periodo.
- Persistir resultados.
- Exibir metricas:
  - retorno acumulado
  - drawdown
  - profit factor
  - win rate
  - expectativa matematica
  - risco-retorno

### Fase Bot 3 - Paper Trading

- Criar bots usando estrategia publicada.
- Simular ordens sem executar na exchange.
- Registrar sinais, intents, posicoes simuladas e PnL.

### Fase Bot 4 - Live Trading Controlado

- Execution engine.
- Reconciliation worker.
- Kill switch.
- Rollout por feature flag.
- Validacao manual antes de liberar por organizacao.

### Fase Bot 5 - Risco Avancado

- Controle de correlacao.
- Exposicao agregada multi-bot.
- Alertas de risco.
- Bloqueios automaticos por drawdown.

### Fase Bot 6 - Analytics e Operacao

- Dashboard de performance por bot.
- Performance por estrategia.
- Performance por ativo/timeframe.
- Logs operacionais.

---

## 11) Criterios globais de aceite

- Nenhuma ordem duplicada por retry.
- Nenhum bot executa fora do tenant/carteira autorizada.
- Viewer nao ativa live trading.
- Backtest e paper trading nao usam fluxo de ordem real.
- Toda ordem live possui `idempotency_key`.
- Toda decisao de risco fica auditavel.
- Reconciliation corrige divergencias com exchange.
- Jobs concorrentes nao duplicam sinal nem ordem.
- Listagens e dashboards sem N+1.

---

## 12) Observacao final

O modulo de Bots/Estrategias deve ser tratado como uma plataforma de automacao financeira, nao como simples gerador de sinais.

A implementacao correta precisa preservar:

- Gestao de risco.
- Estado persistido.
- Idempotencia.
- Reconciliation.
- Auditabilidade.
- Escalabilidade por tenant.

Este plano fica guardado para execucao somente depois do fechamento do plano de permissoes e admin.
