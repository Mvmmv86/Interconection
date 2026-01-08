# Regras de Negócio - Interconection Treasury MGMT

## Documento de Especificação de Regras de Negócio
**Versão:** 1.0
**Data:** Janeiro 2026
**Última Atualização:** Janeiro 2026

---

## 1. VISÃO GERAL DO NEGÓCIO

### 1.1 Definição do Produto

**Interconection Treasury MGMT** é uma plataforma SaaS B2B de gestão de tesouraria corporativa em criptoativos (Treasury Management as a Service).

### 1.2 Proposta de Valor

A plataforma resolve os seguintes problemas do mercado:

| Problema | Solução Interconection |
|----------|------------------------|
| Fragmentação de posições em múltiplas exchanges e wallets | Dashboard consolidado com visão unificada |
| Dificuldade em rastrear rendimentos DeFi | Detecção automática de posições de staking/LP |
| Falta de visibilidade de P&L em tempo real | Cálculos automáticos de performance |
| Compliance e auditoria complexos | Relatórios automatizados e trilha de auditoria |
| Gestão manual de múltiplos clientes | Sistema multi-tenant com isolamento de dados |

### 1.3 Modelo de Receita

| Componente | Valor | Descrição |
|------------|-------|-----------|
| **Management Fee** | 0,5% - 1% a.a. | Calculado sobre o AUM (Assets Under Management) |
| **Performance Fee** | 10% - 20% | Sobre rendimentos acima do benchmark definido |
| **Setup & Integração** | R$ 50.000 - R$ 200.000 | Taxa única de onboarding e personalização |

---

## 2. ENTIDADES DO SISTEMA

### 2.1 Hierarquia de Entidades

```
Organization (Empresa/Tenant)
├── Users (Usuários da organização)
├── Clients (Clientes gerenciados)
│   ├── Wallets (Carteiras conectadas)
│   ├── Exchanges (Contas em exchanges)
│   ├── ManualAssets (Ativos manuais)
│   └── DetectedPositions (Posições detectadas automaticamente)
├── Integrations (Integrações ativas)
├── Alerts (Alertas configurados)
└── Strategies (Estratégias de investimento)
```

### 2.2 Cliente (Client)

Um **Cliente** representa uma entidade (pessoa física, fundo, empresa) cujo portfólio é gerenciado na plataforma.

**Atributos:**
- `id`: Identificador único (UUID)
- `name`: Nome do cliente (obrigatório)
- `email`: Email de contato (opcional)
- `notes`: Observações/notas (opcional)
- `color`: Cor para identificação visual no UI
- `createdAt`: Data de criação
- `updatedAt`: Data de última atualização

**Regras de Negócio:**
1. **RN-CLI-001**: Todo cliente deve ter um nome único dentro da organização
2. **RN-CLI-002**: A exclusão de um cliente remove todas as wallets, exchanges e ativos associados
3. **RN-CLI-003**: Clientes podem ter múltiplas wallets em diferentes redes (EVM, Solana, Bitcoin)
4. **RN-CLI-004**: Clientes podem ter múltiplas contas em exchanges
5. **RN-CLI-005**: A cor do cliente é atribuída automaticamente se não especificada

### 2.3 Wallet

Uma **Wallet** representa uma carteira de criptomoedas conectada ao sistema.

**Atributos:**
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `address`: Endereço público da wallet
- `network`: Tipo de rede (`evm` ou `solana`)
- `chain`: Rede específica (ethereum, arbitrum, solana, etc.)
- `label`: Nome/rótulo da wallet
- `isActive`: Status de ativação
- `addedAt`: Data de adição

**Regras de Negócio:**
1. **RN-WAL-001**: Wallets são identificadas apenas pelo endereço público (read-only)
2. **RN-WAL-002**: O sistema detecta automaticamente tokens e NFTs na wallet
3. **RN-WAL-003**: Wallets EVM suportam múltiplas chains (Ethereum, Arbitrum, Optimism, Polygon, Base, BSC, Avalanche)
4. **RN-WAL-004**: Wallets Solana suportam chains Solana e Eclipse
5. **RN-WAL-005**: Uma mesma wallet não pode ser adicionada duas vezes ao mesmo cliente

### 2.4 Exchange

Uma **Exchange** representa uma conta em exchange centralizada.

**Atributos:**
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `exchange`: Nome da exchange (binance, coinbase, kraken, etc.)
- `label`: Nome/rótulo da conta
- `apiKeyMasked`: Últimos 4 caracteres da API key (para identificação)
- `isActive`: Status de ativação
- `addedAt`: Data de adição
- `lastSync`: Última sincronização

**Exchanges Suportadas:**
- Binance
- Coinbase
- Kraken
- Bybit
- OKX
- KuCoin
- Gate.io
- MEXC

**Regras de Negócio:**
1. **RN-EXC-001**: Conexões com exchanges são realizadas via API Key + Secret
2. **RN-EXC-002**: Permissões de API devem ser apenas read-only na Fase 1
3. **RN-EXC-003**: Credenciais são armazenadas de forma criptografada
4. **RN-EXC-004**: Sincronização de saldos é automática em intervalos configuráveis
5. **RN-EXC-005**: Erros de sincronização geram alertas e logs

### 2.5 Ativo Manual (ManualAsset)

Um **Ativo Manual** representa uma posição inserida manualmente pelo usuário.

**Atributos:**
- `id`: Identificador único
- `clientId`: Referência ao cliente
- `token`: Símbolo do token (ETH, BTC, SOL)
- `tokenName`: Nome completo do token
- `network`: Rede do token
- `quantity`: Quantidade
- `purchasePrice`: Preço de compra por unidade
- `purchaseDate`: Data de compra
- `currentPrice`: Preço atual (atualizado automaticamente)
- `type`: Tipo de posição (`holding`, `staking`, `lending`, `lp`)
- `stakingProvider`: Provedor de staking (se aplicável)
- `apy`: APY estimado (se aplicável)
- `notes`: Observações

**Regras de Negócio:**
1. **RN-MAN-001**: Preço atual é atualizado automaticamente via feeds de preço
2. **RN-MAN-002**: P&L é calculado como: (currentPrice - purchasePrice) × quantity
3. **RN-MAN-003**: Ativos do tipo `staking` devem especificar o provedor
4. **RN-MAN-004**: APY é usado para projeção de rendimentos futuros

---

## 3. POSIÇÕES DETECTADAS AUTOMATICAMENTE

### 3.1 Staking Positions

O sistema detecta automaticamente posições de staking nas wallets conectadas.

**Protocolos Suportados - EVM:**
| Protocolo | Token | Tipo |
|-----------|-------|------|
| Lido | stETH | Liquid Staking |
| Rocket Pool | rETH | Liquid Staking |
| Coinbase | cbETH | Liquid Staking |
| Frax | sfrxETH | Liquid Staking |

**Protocolos Suportados - Solana:**
| Protocolo | Token | Tipo |
|-----------|-------|------|
| Marinade | mSOL | Liquid Staking |
| Jito | JitoSOL | Liquid Staking |
| BlazeStake | bSOL | Liquid Staking |
| Sanctum | INF | Liquid Staking |
| Jupiter | JUP | Staking |
| Kamino | KMNO | Lending |
| Meteora | MET | LP |

**Regras de Negócio:**
1. **RN-STK-001**: Posições são detectadas automaticamente ao escanear wallets
2. **RN-STK-002**: APY é obtido diretamente dos contratos/protocolos
3. **RN-STK-003**: Rewards pendentes são calculados e exibidos
4. **RN-STK-004**: Posições podem ser `liquid` (resgatáveis) ou `locked` (travadas)
5. **RN-STK-005**: Auto-compound é detectado quando habilitado no protocolo

### 3.2 Pool Positions (DeFi LP)

O sistema detecta posições em pools de liquidez.

**Protocolos EVM:**
- Uniswap V2/V3
- SushiSwap
- Curve Finance
- Balancer
- PancakeSwap
- Camelot
- Aerodrome
- Velodrome

**Protocolos Solana:**
- Raydium / Raydium CLMM
- Orca / Orca Whirlpool
- Meteora / Meteora DLMM
- Lifinity
- Phoenix

**Atributos de Pool Position:**
- Par de tokens (token0, token1)
- Fee tier
- Liquidez fornecida
- Range de preços (para concentrated liquidity)
- Status (in-range, out-of-range, closed)
- Fees acumuladas
- Impermanent Loss calculado
- APR/APY

**Regras de Negócio:**
1. **RN-POOL-001**: Posições concentrated liquidity têm range de preços definido
2. **RN-POOL-002**: Status `in-range` indica que a posição está gerando fees
3. **RN-POOL-003**: Impermanent Loss é calculado comparando com HODL
4. **RN-POOL-004**: Fees não coletadas são exibidas separadamente
5. **RN-POOL-005**: % de tempo in-range é rastreado historicamente

---

## 4. CÁLCULOS FINANCEIROS

### 4.1 Cálculo de Portfolio Value

```
Total Portfolio Value =
  Σ (Wallet Balances) +
  Σ (Exchange Balances) +
  Σ (Manual Assets × Current Price) +
  Σ (Staking Positions Value) +
  Σ (LP Positions Value) +
  Σ (Pending Rewards)
```

### 4.2 Cálculo de P&L

**P&L Não Realizado (Unrealized):**
```
Unrealized P&L = Current Value - Cost Basis
```

**P&L Realizado (Realized):**
```
Realized P&L = Sell Value - Buy Value (para transações fechadas)
```

**P&L Total:**
```
Total P&L = Unrealized P&L + Realized P&L
```

**Regras de Negócio:**
1. **RN-PNL-001**: P&L é calculado em USD como moeda base
2. **RN-PNL-002**: Cost basis considera preço médio ponderado de compra
3. **RN-PNL-003**: Fees de transação são descontadas do P&L
4. **RN-PNL-004**: P&L de posições DeFi inclui IL (Impermanent Loss)
5. **RN-PNL-005**: Rewards de staking são contabilizados como receita

### 4.3 Cálculo de APY Médio

```
APY Médio = Σ (Position APY × Position Value) / Total Staked Value
```

### 4.4 Cálculo de Impermanent Loss

```
IL = 2 × √(price_ratio) / (1 + price_ratio) - 1

Onde:
price_ratio = current_price / initial_price
```

**Regras de Negócio:**
1. **RN-IL-001**: IL é calculado comparando valor atual com HODL value
2. **RN-IL-002**: IL é expresso em percentual e valor USD
3. **RN-IL-003**: IL negativo indica perda vs HODL, positivo indica ganho

---

## 5. MÉTRICAS DE RISCO

### 5.1 Exposição por Tipo

O portfolio é categorizado por tipo de posição:

| Tipo | Descrição |
|------|-----------|
| **Holding** | Ativos mantidos sem rendimento |
| **Staking** | Ativos em staking (liquid ou locked) |
| **Lending** | Ativos emprestados em protocolos |
| **LP** | Liquidez fornecida em pools |
| **Derivatives** | Posições em derivativos |

### 5.2 Exposição por Chain

Distribuição do portfolio por blockchain:
- Ethereum
- Arbitrum
- Optimism
- Polygon
- Base
- BSC
- Avalanche
- Solana
- Bitcoin

### 5.3 Métricas de Risco Calculadas

| Métrica | Descrição | Cálculo |
|---------|-----------|---------|
| **VaR (95%)** | Value at Risk | Perda máxima esperada com 95% de confiança |
| **Drawdown** | Queda máxima do pico | (Peak Value - Current Value) / Peak Value |
| **Volatilidade** | Desvio padrão dos retornos | σ dos retornos diários × √252 |
| **Sharpe Ratio** | Retorno ajustado ao risco | (Return - Risk Free) / Volatility |
| **Sortino Ratio** | Sharpe com downside | (Return - Risk Free) / Downside Deviation |

**Regras de Negócio:**
1. **RN-RISK-001**: VaR é calculado com janela de 30 dias
2. **RN-RISK-002**: Drawdown considera todo o histórico disponível
3. **RN-RISK-003**: Risk-free rate default é 0% (configurável)
4. **RN-RISK-004**: Métricas são recalculadas diariamente

---

## 6. SISTEMA DE ALERTAS

### 6.1 Tipos de Alertas

| Tipo | Trigger | Exemplo |
|------|---------|---------|
| **Preço** | Ativo atinge preço alvo | BTC > $100,000 |
| **Variação %** | Ativo varia X% em período | ETH -10% em 24h |
| **Valor Portfolio** | Portfolio atinge valor | Total > $5M |
| **Drawdown** | Drawdown excede limite | Drawdown > 15% |
| **Health Factor** | HF abaixo de threshold | HF < 1.5 (Aave) |
| **Yield** | APY cai abaixo de limite | Staking APY < 3% |
| **Out of Range** | LP position sai do range | Uniswap position out |

### 6.2 Canais de Notificação

- In-app (notificações no dashboard)
- Email
- Webhook (integração com sistemas externos)

### 6.3 Configuração de Alertas

**Atributos:**
- Nome do alerta
- Tipo de condição
- Valor/threshold
- Canais de notificação
- Frequência (única ou recorrente)
- Expiração (opcional)
- Status (ativo/inativo)

**Regras de Negócio:**
1. **RN-ALR-001**: Alertas são avaliados em tempo real para preços
2. **RN-ALR-002**: Alertas de métricas são avaliados a cada 5 minutos
3. **RN-ALR-003**: Alertas únicos são desativados após disparo
4. **RN-ALR-004**: Alertas recorrentes têm cooldown de 1 hora
5. **RN-ALR-005**: Máximo de 50 alertas ativos por organização (plano base)

---

## 7. INTEGRAÇÕES

### 7.1 Fontes de Dados de Preço

| Fonte | Uso | Prioridade |
|-------|-----|------------|
| CoinGecko | Preços de ativos | Primária |
| Chainlink | Preços on-chain | Secundária |
| DEX Pools | Preços de tokens menores | Terciária |

### 7.2 APIs de DeFi

| API | Funcionalidade |
|-----|----------------|
| DeFiLlama | TVL, yields, APY histórico |
| Bitquery | Dados de pools, volume |
| Jupiter | Aggregator Solana |
| 1inch | Aggregator multi-chain |
| LI.FI | Bridge e DEX aggregation |

### 7.3 Blockchain RPCs

| Chain | RPC |
|-------|-----|
| Ethereum | Infura/Alchemy |
| Arbitrum | Arbitrum RPC |
| Optimism | Optimism RPC |
| Polygon | Polygon RPC |
| Base | Base RPC |
| BSC | BSC RPC |
| Solana | Helius/Quicknode |

**Regras de Negócio:**
1. **RN-INT-001**: Sincronização de preços a cada 30 segundos
2. **RN-INT-002**: Sincronização de posições a cada 5 minutos
3. **RN-INT-003**: Fallback para fonte secundária em caso de erro
4. **RN-INT-004**: Cache de dados com TTL de 60 segundos
5. **RN-INT-005**: Rate limiting conforme limites de cada API

---

## 8. REGRAS DE DASHBOARD

### 8.1 Home Dashboard

**Componentes Principais:**
1. **Portfolio Overview**: Valor total, P&L 24h, P&L mensal
2. **Asset Allocation**: Donut chart com distribuição
3. **Portfolio Chart**: Evolução histórica (24h, 7d, 30d, 90d, 1y)
4. **Recent Activity**: Últimas 10 transações
5. **Pending Alerts**: Top 5 alertas ativos
6. **Active Strategies**: Estratégias em execução

### 8.2 Portfolio Page

**Componentes:**
1. **Summary Cards**: AUM, P&L Unrealized, P&L Realized, Yield, Positions
2. **Allocation by Type**: Holding, Staking, Lending, LP
3. **Allocation by Chain**: Distribuição por blockchain
4. **Risk Exposure**: Métricas de risco
5. **Exchange Positions**: Saldos por exchange
6. **DeFi Positions**: Posições em protocolos
7. **Staking Positions**: Posições de staking
8. **Liquidity Positions**: Posições em pools LP
9. **Top Holdings**: Maiores posições

### 8.3 Clients Page

**Funcionalidades:**
1. Lista de clientes com cards
2. Busca por nome/email/notas
3. Criação de novo cliente (modal)
4. Edição de cliente (modal)
5. Exclusão de cliente (confirmação)
6. Summary stats agregados (Total AUM, Staked, PnL, Rewards, APY)

### 8.4 Client Detail Page

**Seções:**
1. **Header**: Info do cliente, stats principais
2. **Wallets Tab**: Lista de wallets, adicionar nova
3. **Exchanges Tab**: Lista de exchanges, adicionar nova
4. **Assets Tab**: Ativos manuais, posições detectadas
5. **DeFi Tab**: Posições em pools LP

### 8.5 Positions Pages

**Visões Disponíveis:**
1. **All Positions**: Tabela consolidada
2. **By Exchange**: Agrupado por exchange
3. **By Wallet**: Agrupado por wallet
4. **DeFi**: Posições em protocolos DeFi
5. **Staking**: Posições de staking

---

## 9. REGRAS DE ACESSO E PERMISSÕES

### 9.1 Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| **Admin** | Administrador da organização | Acesso total |
| **Manager** | Gestor de portfólio | CRUD clientes, view/edit posições |
| **Viewer** | Visualizador | Apenas leitura |

### 9.2 Permissões por Recurso

| Recurso | Admin | Manager | Viewer |
|---------|-------|---------|--------|
| Dashboard | View | View | View |
| Clientes | CRUD | CRUD | Read |
| Wallets | CRUD | CRUD | Read |
| Exchanges | CRUD | CRUD | Read |
| Ativos | CRUD | CRUD | Read |
| Alertas | CRUD | CRUD | Read |
| Integrações | CRUD | Read | Read |
| Settings | CRUD | Read | - |
| Billing | CRUD | - | - |

### 9.3 Multi-Tenancy

**Regras de Negócio:**
1. **RN-TEN-001**: Dados são completamente isolados entre organizações
2. **RN-TEN-002**: Usuário pertence a uma única organização
3. **RN-TEN-003**: Credenciais são criptografadas por organização
4. **RN-TEN-004**: Logs de auditoria são segregados por organização
5. **RN-TEN-005**: Limites de uso são definidos por plano

---

## 10. REGRAS DE SINCRONIZAÇÃO

### 10.1 Frequências de Atualização

| Dado | Frequência | Método |
|------|------------|--------|
| Preços de ativos | 30 segundos | WebSocket/Polling |
| Saldos de exchanges | 5 minutos | API polling |
| Saldos de wallets | 5 minutos | RPC calls |
| Posições DeFi | 5 minutos | Subgraph/RPC |
| Métricas de risco | 1 hora | Batch calculation |
| Snapshots | Diário | Scheduled job |

### 10.2 Tratamento de Erros

| Erro | Ação | Retry |
|------|------|-------|
| API timeout | Usar cache | 3x com backoff |
| Rate limit | Aguardar cooldown | Exponential backoff |
| Invalid credentials | Marcar como erro | Notificar usuário |
| Data inconsistency | Log + alerta | Manual review |

**Regras de Negócio:**
1. **RN-SYN-001**: Dados em cache têm validade máxima de 5 minutos
2. **RN-SYN-002**: Erros persistentes (3+ falhas) geram alerta
3. **RN-SYN-003**: Sincronização pode ser forçada manualmente
4. **RN-SYN-004**: Última sincronização é exibida por integração
5. **RN-SYN-005**: Logs de sincronização são mantidos por 30 dias

---

## 11. REGRAS DE COMPLIANCE E AUDITORIA

### 11.1 Audit Log

Todo evento relevante é registrado:

| Evento | Dados Registrados |
|--------|-------------------|
| Login/Logout | User, IP, timestamp, device |
| CRUD de entidades | User, entity, old/new values, timestamp |
| Alteração de configurações | User, setting, old/new values |
| Erros de sincronização | Integration, error, timestamp |
| Alertas disparados | Alert, trigger value, timestamp |

### 11.2 Relatórios de Compliance

**Relatórios Disponíveis:**
1. Extrato de posições por período
2. Histórico de transações
3. Evolução patrimonial
4. Performance por ativo/estratégia
5. Registro de acessos

### 11.3 Retenção de Dados

| Dado | Retenção |
|------|----------|
| Transações | Indefinido |
| Snapshots | 5 anos |
| Audit logs | 2 anos |
| Logs de erro | 90 dias |
| Cache | 24 horas |

---

## 12. LIMITES E QUOTAS

### 12.1 Limites por Plano

| Recurso | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Clientes | 5 | 50 | Ilimitado |
| Wallets por cliente | 10 | 50 | Ilimitado |
| Exchanges por cliente | 3 | 10 | Ilimitado |
| Alertas ativos | 10 | 50 | Ilimitado |
| Histórico | 90 dias | 2 anos | Ilimitado |
| API requests/min | 60 | 300 | Ilimitado |
| Usuários | 2 | 10 | Ilimitado |

### 12.2 Rate Limiting

**Regras de Negócio:**
1. **RN-LIM-001**: API pública limitada a 60 req/min (Free), 300 req/min (Pro)
2. **RN-LIM-002**: WebSocket connections limitadas a 5 por organização
3. **RN-LIM-003**: Bulk operations limitadas a 100 items por request
4. **RN-LIM-004**: Export de dados limitado a 10.000 registros por arquivo

---

## 13. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **AUM** | Assets Under Management - Total de ativos sob gestão |
| **APY** | Annual Percentage Yield - Rendimento anual percentual |
| **APR** | Annual Percentage Rate - Taxa anual percentual (sem composição) |
| **IL** | Impermanent Loss - Perda impermanente em pools de liquidez |
| **LP** | Liquidity Provider - Provedor de liquidez |
| **CLMM** | Concentrated Liquidity Market Maker - AMM com liquidez concentrada |
| **TVL** | Total Value Locked - Valor total bloqueado em protocolo |
| **VaR** | Value at Risk - Valor em risco |
| **HF** | Health Factor - Fator de saúde em posições de lending |
| **Drawdown** | Queda percentual do valor máximo atingido |

---

## 14. VERSIONAMENTO DO DOCUMENTO

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Jan/2026 | Equipe Produto | Versão inicial baseada no frontend implementado |

---

**Documento gerado com base na análise do frontend Interconection Treasury MGMT.**

**Próximas Revisões:**
- Após implementação do backend
- Após integração com exchanges reais
- Após fase de testes com usuários beta
