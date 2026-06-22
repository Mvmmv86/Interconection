# Plano Tecnico - Bot BC Futuros

## Objetivo

Implementar a automacao BC Futuros como estrategia oficial do motor de bots da Connectcoin, com foco em tendencia, gestao de risco, position sizing, exposicao agregada e execucao auditavel.

Este bot nao deve nascer como um simples sinal de compra/venda. A entrada e apenas o gatilho inicial; a decisao operacional precisa passar por risco, exposicao, alavancagem, idempotencia e reconciliacao.

## Principios

- Paper/backtest antes de qualquer ordem real.
- Indicadores calculados em batch, nunca por usuario individual.
- Sinais determinismos por bot, ativo, timeframe e candle fechado.
- Uma operacao nasce do risco maximo permitido, nao de quantidade fixa.
- Stop nunca pode ser afastado para aumentar risco inicial.
- Execucao real so depois de executor e reconciliation worker dedicados.

## Fase 1 - Indicador nativo

Status: iniciada.

Criar `bc_alpha_trend` no catalogo de indicadores e no `BotEngineService`.

Entradas:
- OHLC.
- Volume quando confiavel.
- RSI como fallback quando volume nao for confiavel.
- O fallback para RSI deve ser por serie inteira quando a cobertura de volume for insuficiente, inclusive se `flow_source=mfi`, para evitar MFI artificialmente bullish em candles sem volume.
- `signal`, `long_signal` e `short_signal` so devem ser emitidos apos a tendencia anterior ja estar definida, evitando sinal espurio no primeiro candle valido pos-warmup.

Parametros:
- `atr_length`.
- `atr_multiplier`.
- `flow_source`: `auto`, `mfi`, `rsi`.
- `flow_length`.
- `flow_threshold`.
- `trend_offset`.

Saidas:
- `value`: linha AlphaTrend.
- `trend`: `1` alta, `-1` baixa, `0` neutro.
- `signal`: `1` long, `-1` short, `0` sem novo sinal.
- `long_signal`.
- `short_signal`.
- `stop`.
- `atr`.
- `flow`.

## Fase 2 - Template BC Futuros no Strategy Builder

Status: iniciada.

Criar um template orientado de estrategia:

- Mercado e ativos.
- Timeframe.
- Modo de entrada: fechamento ou rompimento.
- Stop: ATR, estrutural ou AlphaTrend.
- Trailing stop.
- Breakeven.
- Take profit.
- Cooldown.
- Limite diario de sinais.

O builder deve permitir configurar a estrategia sem expor detalhes perigosos de execucao real.

Entrega inicial:
- Estrategia publicada `BC Futuros Trend Long-Only`.
- Bot produto publicado `BC Futuros Paper Bot Long-Only`.
- Catalogo do cliente passa a puxar o produto pela aba Bots.
- Home troca o bloco mock de estrategias por ativacao de bots reais.
- O play/pause da Home altera status de instancias ja configuradas na aba Bots; criacao/configuracao continua na aba Bots.
- Esta fase e intencionalmente long-only/paper. Entrada short, reduce-only, margem e reconciliacao futures entram na Fase 3+ antes de qualquer execucao real.

## Fase 3 - Backtest BC Futuros

O backtest precisa simular:

- Long e short.
- Entrada por fechamento.
- Entrada por rompimento da maxima/minima do candle de confirmacao.
- Stop ATR.
- Stop estrutural.
- Stop AlphaTrend.
- Trailing stop.
- Breakeven.
- Take profit.
- Fees e slippage configuraveis.
- Capital inicial.
- Risco percentual por trade.
- Tamanho da posicao calculado por distancia ate o stop.

Metricas:
- Retorno acumulado.
- Drawdown maximo.
- Profit Factor.
- Win Rate.
- Expectativa matematica.
- Risco-retorno medio.
- Tempo medio em trade.
- Exposicao media.
- Eficiencia por ativo.
- Eficiencia por timeframe.

## Fase 4 - Paper trading escalavel

Scheduler:
- Agrupar por exchange, symbol, timeframe e hash de configuracao.
- Buscar candles uma vez por grupo.
- Calcular indicadores uma vez por grupo.
- Distribuir sinais para bots interessados.

Idempotencia:
- `bot_runs(instance_id, cycle_key)`.
- `bot_signals(bot_id, symbol, timeframe, candle_close_time, signal_type)`.
- `bot_trade_intents(bot_id, symbol, candle_close_time, intent_type)`.

Risco:
- Validar posicao atual antes de criar novo intent.
- Bloquear duplicidade de posicao por bot/simbolo quando a estrategia nao permite piramidagem.
- Registrar snapshot de risco em toda decisao.

## Fase 5 - Risk Engine profissional

Calcular:
- Perda maxima por trade.
- Distancia percentual ate o stop.
- Tamanho notional da posicao.
- Exposicao maxima por operacao.
- Exposicao maxima por ativo.
- Exposicao maxima total.
- Risco simultaneo maximo.
- Alavancagem necessaria.
- Limite por grupo correlacionado.

Decisoes:
- `allow`.
- `reduce`.
- `block`.

## Fase 6 - Execucao real

Somente depois de paper/backtest aprovados.

Exigir:
- Executor por exchange.
- Idempotency key por ordem.
- `reduce_only` em saidas.
- Retry seguro.
- ReconciliationWorker.
- Verificacao de fills.
- Verificacao de posicao real.
- Divergence alert quando estado local e exchange divergirem.
- Audit log tecnico completo.

## Riscos conhecidos

- Dados atuais de `price_history` podem nao ser OHLCV real por candle; indicadores de range/volume ficam degradados sem feed normalizado.
- Futuros exigem suporte formal para long/short, margem, alavancagem, reduce-only e liquidacao.
- Correlacao precisa comecar simples por grupo e evoluir para modelo estatistico.
- Em ambiente multi-worker, cache de permissoes e estado operacional precisa Redis ou invalidacao distribuida.
