# Plano de Integração: Wallets + DeFi LP Positions

## Resumo Executivo

Este documento detalha o plano de implementação para:
1. **Conexão de Wallets** - EVM (MetaMask, WalletConnect) e Solana (Phantom)
2. **Extração de LP Positions** - Similar ao Revert Finance com dados completos
3. **Redes Suportadas** - Base, Ethereum, Arbitrum, Solana

---

## PARTE 1: EVM (Ethereum Virtual Machine)

### 1.1 Stack Tecnológica Recomendada

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Wallet Connection | **Wagmi v2 + Viem** | Padrão da indústria, TypeScript nativo, suporte multi-chain |
| WalletConnect | **WalletConnect v2** | Suporte mobile, 300+ wallets |
| RPC Batching | **Viem Multicall3** | Reduz 80% das chamadas RPC |
| LP Data (EVM) | **Uniswap V3 Subgraph** | Dados históricos, fees accrued |
| LP Data (Base) | **Aerodrome API + QuickNode** | Principal DEX na Base |
| Price Data | **CoinGecko/DeFiLlama** | Preços em USD |

### 1.2 Pacotes NPM Necessários

```bash
# Wallet Connection
npm install wagmi viem @tanstack/react-query

# WalletConnect
npm install @walletconnect/modal @walletconnect/ethereum-provider

# Connectors
npm install @wagmi/connectors
```

### 1.3 Arquitetura de Conexão EVM

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │  WagmiProvider  │────▶│  QueryProvider  │                    │
│  └────────┬────────┘     └─────────────────┘                    │
│           │                                                      │
│  ┌────────▼────────┐     ┌─────────────────┐                    │
│  │ Connect Button  │────▶│   useAccount()  │                    │
│  │ (MetaMask/WC)   │     │   useChainId()  │                    │
│  └─────────────────┘     └────────┬────────┘                    │
│                                   │                              │
│  ┌────────────────────────────────▼───────────────────────────┐ │
│  │              LP Position Fetcher Component                  │ │
│  │  - useUniswapV3Positions(address)                          │ │
│  │  - useAerodromePositions(address)                          │ │
│  │  - useSushiPositions(address)                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                                 │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Uniswap V3  │  │  Aerodrome   │  │  RPC Nodes   │           │
│  │  Subgraph    │  │  API/Graph   │  │  (Multicall) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### 1.4 Configuração Wagmi (Código Base)

```typescript
// frontend/src/lib/wallet/wagmi-config.ts
import { createConfig, http } from 'wagmi'
import { mainnet, base, arbitrum } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!

export const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum],
  connectors: [
    injected(), // MetaMask, Coinbase Wallet, etc.
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http('https://mainnet.base.org'),
    [arbitrum.id]: http(),
  },
  // Enable multicall batching for performance
  batch: {
    multicall: {
      wait: 16, // 16ms batching window
    },
  },
})
```

### 1.5 Extração de LP Positions - Uniswap V3

#### 1.5.1 Como Funciona (Similar ao Revert Finance)

1. **Position NFTs**: Cada posição Uniswap V3 é um NFT
2. **NonfungiblePositionManager**: Contrato que gerencia os NFTs
3. **Subgraph**: Índice GraphQL com dados históricos

#### 1.5.2 Dados Disponíveis por Posição

| Campo | Descrição | Fonte |
|-------|-----------|-------|
| `tokenId` | ID único da posição NFT | On-chain |
| `token0/token1` | Par de tokens | On-chain |
| `tickLower/tickUpper` | Range de preço | On-chain |
| `liquidity` | Liquidez atual | On-chain |
| `feeGrowthInside` | Fees acumulados | On-chain |
| `tokensOwed0/1` | Fees coletáveis | On-chain |
| `depositedToken0/1` | Valor depositado | Subgraph |
| `collectedFeesToken0/1` | Fees já coletados | Subgraph |

#### 1.5.3 Query GraphQL - Subgraph

```graphql
# Buscar todas as posições de um endereço
query GetPositions($owner: String!) {
  positions(
    where: { owner: $owner, liquidity_gt: 0 }
    orderBy: id
    orderDirection: desc
  ) {
    id
    owner
    pool {
      id
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      feeTier
      tick
      sqrtPrice
      liquidity
    }
    tickLower { tickIdx }
    tickUpper { tickIdx }
    liquidity
    depositedToken0
    depositedToken1
    withdrawnToken0
    withdrawnToken1
    collectedFeesToken0
    collectedFeesToken1
  }
}
```

#### 1.5.4 Endpoints Subgraph por Rede

| Rede | Subgraph URL |
|------|--------------|
| Ethereum | `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3` |
| Base | `https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest` |
| Arbitrum | `https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-arbitrum-one` |

### 1.6 Cálculos de LP Position (Estilo Revert Finance)

#### 1.6.1 Valor Total da Posição

```typescript
interface LPPositionData {
  // Identificação
  tokenId: string;
  poolAddress: string;

  // Tokens
  token0: { symbol: string; decimals: number; price: number };
  token1: { symbol: string; decimals: number; price: number };

  // Amounts
  amount0: bigint;  // Token0 na posição
  amount1: bigint;  // Token1 na posição

  // Valores USD
  value0Usd: number;
  value1Usd: number;
  totalValueUsd: number;

  // Fees
  uncollectedFees0: bigint;
  uncollectedFees1: bigint;
  uncollectedFeesUsd: number;
  collectedFeesUsd: number;  // Histórico

  // P&L
  depositedValueUsd: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;

  // Range
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  inRange: boolean;

  // APR estimado
  feeApr: number;  // Baseado em fees/TVL
}
```

#### 1.6.2 Fórmulas de Cálculo

```typescript
// Calcular amounts de token na posição
function getPositionAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): { amount0: bigint; amount1: bigint } {
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);

  // Lógica Uniswap V3 para calcular amounts
  // ... (usar @uniswap/v3-sdk)
}

// Calcular fees não coletados
async function getUncollectedFees(
  positionId: bigint,
  positionManager: Address
): Promise<{ fees0: bigint; fees1: bigint }> {
  // Chamar collect() com simulate para obter fees
  const result = await publicClient.simulateContract({
    address: positionManager,
    abi: nonfungiblePositionManagerABI,
    functionName: 'collect',
    args: [{
      tokenId: positionId,
      recipient: owner,
      amount0Max: MaxUint128,
      amount1Max: MaxUint128,
    }],
  });
  return { fees0: result.amount0, fees1: result.amount1 };
}
```

### 1.7 Aerodrome (Base Network)

#### 1.7.1 Diferenças do Uniswap V3

- Aerodrome é fork do Velodrome (Optimism)
- Usa ve(3,3) tokenomics
- Pools podem ser Stable ou Volatile
- Suporta Concentrated Liquidity (CL) e Legacy pools

#### 1.7.2 Endpoints de API

```typescript
// APIs Aerodrome
const AERODROME_API = {
  pools: 'https://api.aerodrome.finance/pools',
  positions: 'https://api.aerodrome.finance/positions/{address}',
  // Ou usar Bitquery/QuickNode para dados mais completos
};

// QuickNode Aerodrome Integration
const quicknodeEndpoint = `https://api.quicknode.com/functions/rest/v1/functions/...`;
```

### 1.8 Otimização com Multicall

```typescript
// Batch múltiplas chamadas em uma única request
import { multicall } from 'viem/actions'

async function fetchMultiplePositions(
  client: PublicClient,
  positionIds: bigint[]
) {
  const calls = positionIds.map(id => ({
    address: POSITION_MANAGER_ADDRESS,
    abi: nonfungiblePositionManagerABI,
    functionName: 'positions',
    args: [id],
  }));

  // Uma única chamada RPC para todas as posições!
  const results = await multicall(client, { contracts: calls });
  return results;
}
```

---

## PARTE 2: SOLANA

### 2.1 Stack Tecnológica Recomendada

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Wallet Connection | **@solana/wallet-adapter-react** | Padrão oficial, suporta 20+ wallets |
| Principal Wallet | **Phantom** | Mais popular, melhor UX |
| RPC | **@solana/web3.js** | SDK oficial |
| Raydium LP | **@raydium-io/raydium-sdk-V2** | SDK oficial CLMM |
| Orca LP | **@orca-so/whirlpools** | SDK oficial Whirlpools |

### 2.2 Pacotes NPM Necessários

```bash
# Wallet Adapter Core
npm install @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui

# Wallet Adapters (específicos)
npm install @solana/wallet-adapter-phantom @solana/wallet-adapter-solflare

# Solana Web3
npm install @solana/web3.js @solana/spl-token

# DEX SDKs
npm install @raydium-io/raydium-sdk-v2
npm install @orca-so/whirlpools
```

### 2.3 Arquitetura de Conexão Solana

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │               ConnectionProvider (RPC)                       ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              WalletProvider (Adapters)                   │││
│  │  │  ┌─────────────────────────────────────────────────────┐│││
│  │  │  │          WalletModalProvider (UI)                    ││││
│  │  │  │                                                      ││││
│  │  │  │  ┌──────────────┐  ┌──────────────────────────────┐ ││││
│  │  │  │  │WalletMulti   │  │  useWallet() Hook            │ ││││
│  │  │  │  │Button        │  │  - publicKey                 │ ││││
│  │  │  │  │              │  │  - connected                 │ ││││
│  │  │  │  └──────────────┘  │  - signTransaction()         │ ││││
│  │  │  │                    └──────────────────────────────┘ ││││
│  │  │  └─────────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                                 │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Raydium    │  │    Orca      │  │   Helius/    │           │
│  │   SDK V2     │  │  Whirlpools  │  │   QuickNode  │           │
│  │   CLMM       │  │    SDK       │  │   (DAS RPC)  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### 2.4 Configuração Wallet Adapter

```typescript
// frontend/src/lib/wallet/solana-config.tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('mainnet-beta');

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### 2.5 Raydium CLMM - Extração de Posições

#### 2.5.1 Estrutura de Dados

```typescript
interface RaydiumCLMMPosition {
  // Identificação
  nftMint: PublicKey;      // NFT que representa a posição
  poolId: PublicKey;       // Pool address

  // Tokens
  tokenMint0: PublicKey;
  tokenMint1: PublicKey;

  // Posição
  liquidity: BN;
  tickLower: number;
  tickUpper: number;

  // Rewards
  feeGrowthInside0: BN;
  feeGrowthInside1: BN;
  tokenFeesOwed0: BN;
  tokenFeesOwed1: BN;

  // Calculados
  amount0: BN;
  amount1: BN;
  valueUsd: number;
  feesUsd: number;
}
```

#### 2.5.2 Buscar Posições do Usuário

```typescript
import { Raydium } from '@raydium-io/raydium-sdk-v2';

async function fetchRaydiumPositions(
  connection: Connection,
  owner: PublicKey
): Promise<RaydiumCLMMPosition[]> {
  const raydium = await Raydium.load({
    connection,
    owner,
    // cluster: 'mainnet',
  });

  // Buscar todas as posições CLMM do owner
  const positions = await raydium.clmm.getOwnerPositionInfo({
    programId: CLMM_PROGRAM_ID,
  });

  return positions.map(pos => ({
    nftMint: pos.nftMint,
    poolId: pos.poolId,
    liquidity: pos.liquidity,
    tickLower: pos.tickLower,
    tickUpper: pos.tickUpper,
    // ... mapear outros campos
  }));
}
```

#### 2.5.3 Usando getProgramAccounts (Alternativa)

```typescript
// Buscar posições diretamente via RPC (mais controle)
async function fetchPositionsViaRPC(
  connection: Connection,
  owner: PublicKey
) {
  // CLMM Position Account Layout
  const CLMM_PROGRAM_ID = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');

  const accounts = await connection.getProgramAccounts(CLMM_PROGRAM_ID, {
    filters: [
      { dataSize: POSITION_LAYOUT_SIZE },
      { memcmp: { offset: OWNER_OFFSET, bytes: owner.toBase58() } },
    ],
  });

  return accounts.map(acc => parsePositionAccount(acc.account.data));
}
```

### 2.6 Orca Whirlpools - Extração de Posições

#### 2.6.1 SDK Moderno (Web3.js v2)

```typescript
import { createSolanaRpc, address } from '@solana/web3.js';
import { fetchAllPositionByOwner, setWhirlpoolsConfig } from '@orca-so/whirlpools';

async function fetchOrcaPositions(ownerAddress: string) {
  const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');

  // Configurar para mainnet
  await setWhirlpoolsConfig('solanaMainnet');

  // Buscar todas as posições do owner
  const positions = await fetchAllPositionByOwner(
    rpc,
    address(ownerAddress)
  );

  return positions;
}
```

#### 2.6.2 SDK Legacy (Web3.js v1 - Recomendado se já usa v1)

```typescript
import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk';
import { Wallet } from '@coral-xyz/anchor';

async function fetchOrcaPositionsLegacy(
  connection: Connection,
  wallet: Wallet,
  owner: PublicKey
) {
  const ctx = WhirlpoolContext.from(connection, wallet, ORCA_WHIRLPOOL_PROGRAM_ID);
  const client = buildWhirlpoolClient(ctx);

  // Buscar todas as posições
  const positions = await client.getAllPositionsByOwner(owner);

  return Promise.all(positions.map(async pos => {
    const positionData = pos.getData();
    const whirlpool = await client.getPool(positionData.whirlpool);
    const poolData = whirlpool.getData();

    return {
      positionMint: positionData.positionMint,
      liquidity: positionData.liquidity,
      tickLowerIndex: positionData.tickLowerIndex,
      tickUpperIndex: positionData.tickUpperIndex,
      pool: {
        tokenMintA: poolData.tokenMintA,
        tokenMintB: poolData.tokenMintB,
        tickCurrentIndex: poolData.tickCurrentIndex,
        sqrtPrice: poolData.sqrtPrice,
      },
    };
  }));
}
```

### 2.7 Cálculo de Valores USD (Solana)

```typescript
// Usar Jupiter Price API para preços
async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  const params = mints.join(',');
  const response = await fetch(
    `https://price.jup.ag/v4/price?ids=${params}`
  );
  const data = await response.json();

  const prices: Record<string, number> = {};
  for (const mint of mints) {
    prices[mint] = data.data[mint]?.price || 0;
  }
  return prices;
}
```

---

## PARTE 3: ARQUITETURA UNIFICADA

### 3.1 Estrutura de Arquivos Proposta

```
frontend/src/
├── lib/
│   └── wallet/
│       ├── evm/
│       │   ├── wagmi-config.ts        # Configuração Wagmi
│       │   ├── connectors.ts          # MetaMask, WalletConnect
│       │   └── chains.ts              # Chains suportadas
│       ├── solana/
│       │   ├── wallet-config.tsx      # Provider Solana
│       │   └── adapters.ts            # Phantom, Solflare
│       └── unified-provider.tsx       # Provider que engloba ambos
│
├── hooks/
│   └── defi/
│       ├── useWalletConnection.ts     # Hook unificado de conexão
│       ├── useEVMLPPositions.ts       # LP positions EVM
│       ├── useSolanaLPPositions.ts    # LP positions Solana
│       ├── useUniswapV3Positions.ts   # Uniswap específico
│       ├── useAerodromePositions.ts   # Aerodrome específico
│       ├── useRaydiumPositions.ts     # Raydium específico
│       └── useOrcaPositions.ts        # Orca específico
│
├── components/
│   └── defi/
│       ├── wallet-connect-modal.tsx   # Modal unificado de conexão
│       ├── network-selector.tsx       # Seletor EVM/Solana
│       ├── lp-positions-table.tsx     # Tabela de posições
│       ├── lp-position-card.tsx       # Card individual
│       └── position-details-modal.tsx # Detalhes expandidos
│
└── types/
    └── defi.ts                        # Types unificados
```

### 3.2 Types Unificados

```typescript
// frontend/src/types/defi.ts

export type NetworkType = 'evm' | 'solana';
export type EVMChain = 'ethereum' | 'base' | 'arbitrum';
export type SolanaCluster = 'mainnet-beta' | 'devnet';

export interface UnifiedWalletState {
  // EVM
  evmConnected: boolean;
  evmAddress?: string;
  evmChainId?: number;

  // Solana
  solanaConnected: boolean;
  solanaAddress?: string;
}

export interface LPPosition {
  // Identificação
  id: string;
  network: NetworkType;
  chain?: EVMChain;
  protocol: 'uniswap-v3' | 'aerodrome' | 'raydium' | 'orca';
  poolAddress: string;

  // Tokens
  token0: TokenInfo;
  token1: TokenInfo;

  // Valores
  amount0: string;
  amount1: string;
  totalValueUsd: number;

  // Fees
  uncollectedFees0: string;
  uncollectedFees1: string;
  uncollectedFeesUsd: number;

  // Range (para concentrated liquidity)
  tickLower?: number;
  tickUpper?: number;
  priceLower?: number;
  priceUpper?: number;
  inRange: boolean;

  // Performance
  depositedValueUsd?: number;
  pnlUsd?: number;
  pnlPercent?: number;
  feeApr?: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  priceUsd: number;
}

export interface DeFiPositionsSummary {
  totalValueUsd: number;
  totalFeesUsd: number;
  totalPnlUsd: number;
  positionsCount: number;
  positions: LPPosition[];
}
```

### 3.3 Hook Unificado de Conexão

```typescript
// frontend/src/hooks/defi/useWalletConnection.ts

export function useWalletConnection() {
  // EVM (Wagmi)
  const { address: evmAddress, isConnected: evmConnected, chainId } = useAccount();
  const { connect: connectEVM, connectors } = useConnect();
  const { disconnect: disconnectEVM } = useDisconnect();

  // Solana
  const { publicKey, connected: solanaConnected, connect: connectSolana, disconnect: disconnectSolana } = useWallet();

  return {
    // Estado unificado
    state: {
      evmConnected,
      evmAddress: evmAddress || undefined,
      evmChainId: chainId,
      solanaConnected,
      solanaAddress: publicKey?.toBase58(),
    },

    // Ações
    connectEVM: (connectorId: string) => {
      const connector = connectors.find(c => c.id === connectorId);
      if (connector) connectEVM({ connector });
    },
    disconnectEVM,
    connectSolana,
    disconnectSolana,

    // Helpers
    isAnyConnected: evmConnected || solanaConnected,
    connectedNetworks: [
      ...(evmConnected ? ['evm'] : []),
      ...(solanaConnected ? ['solana'] : []),
    ] as NetworkType[],
  };
}
```

---

## PARTE 4: PLANO DE IMPLEMENTAÇÃO

### Fase 1: Infraestrutura Base (2-3 dias)

#### 1.1 Setup Providers
- [ ] Criar `wagmi-config.ts` com chains (Ethereum, Base, Arbitrum)
- [ ] Criar `solana-config.tsx` com wallet adapters
- [ ] Criar `unified-provider.tsx` que engloba ambos
- [ ] Testar conexão básica com MetaMask e Phantom

#### 1.2 UI de Conexão
- [ ] Criar `wallet-connect-modal.tsx` com tabs EVM/Solana
- [ ] Integrar com página DeFi Positions existente
- [ ] Mostrar endereço conectado e botão disconnect

### Fase 2: LP Positions EVM (3-4 dias)

#### 2.1 Uniswap V3 Integration
- [ ] Criar `useUniswapV3Positions.ts` hook
- [ ] Implementar query GraphQL para Subgraph
- [ ] Calcular valores USD usando Viem multicall para preços
- [ ] Calcular fees não coletados (simulate collect)

#### 2.2 Aerodrome Integration (Base)
- [ ] Pesquisar API/Subgraph específico Aerodrome
- [ ] Criar `useAerodromePositions.ts` hook
- [ ] Adaptar para estrutura unificada

#### 2.3 UI de Posições EVM
- [ ] Criar `lp-position-card.tsx` com dados
- [ ] Criar `lp-positions-table.tsx` para listagem
- [ ] Integrar com página existente

### Fase 3: LP Positions Solana (3-4 dias)

#### 3.1 Raydium CLMM
- [ ] Configurar Raydium SDK V2
- [ ] Criar `useRaydiumPositions.ts` hook
- [ ] Mapear dados para estrutura unificada

#### 3.2 Orca Whirlpools
- [ ] Configurar Orca SDK
- [ ] Criar `useOrcaPositions.ts` hook
- [ ] Mapear dados para estrutura unificada

#### 3.3 UI de Posições Solana
- [ ] Reutilizar componentes da Fase 2
- [ ] Adicionar ícones/logos específicos Solana

### Fase 4: Agregação e Polish (2-3 dias)

#### 4.1 Agregação de Dados
- [ ] Criar `useDeFiPositionsSummary.ts` que agrega todas as fontes
- [ ] Implementar cache com React Query
- [ ] Adicionar refresh automático

#### 4.2 UI Final
- [ ] Cards de resumo no topo (Total Value, Total Fees, etc.)
- [ ] Filtros por network/protocol
- [ ] Modal de detalhes expandidos
- [ ] Loading states e error handling

#### 4.3 Performance
- [ ] Implementar lazy loading de posições
- [ ] Otimizar queries com batching
- [ ] Adicionar skeleton loaders

---

## PARTE 5: APIs E ENDPOINTS EXTERNOS

### 5.1 Subgraphs Uniswap V3

| Rede | URL |
|------|-----|
| Ethereum | `https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3` |
| Base | `https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest` |
| Arbitrum | `https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-arbitrum-one` |

### 5.2 Price APIs

| Serviço | Endpoint | Uso |
|---------|----------|-----|
| CoinGecko | `api.coingecko.com/api/v3/simple/price` | EVM tokens |
| Jupiter | `price.jup.ag/v4/price` | Solana tokens |
| DeFiLlama | `coins.llama.fi/prices/current/{chain}:{address}` | Multi-chain |

### 5.3 RPC Endpoints Recomendados

| Rede | Provider | Notas |
|------|----------|-------|
| Ethereum | Alchemy/Infura | Multicall suportado |
| Base | Base RPC / QuickNode | Boa performance |
| Arbitrum | Alchemy | Multicall suportado |
| Solana | Helius / QuickNode | DAS API para NFTs |

### 5.4 Contratos Importantes

```typescript
// EVM - Uniswap V3
export const UNISWAP_V3_CONTRACTS = {
  ethereum: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  base: {
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  },
  arbitrum: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
};

// Solana - Program IDs
export const SOLANA_PROGRAMS = {
  raydium: {
    clmm: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
    amm: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  },
  orca: {
    whirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  },
};
```

---

## PARTE 6: CONSIDERAÇÕES TÉCNICAS

### 6.1 Performance

1. **Multicall (EVM)**: Sempre usar para batch de chamadas
2. **getProgramAccounts (Solana)**: Usar filters para reduzir dados
3. **React Query**: Cache de 30s-1min para dados de posição
4. **Lazy Loading**: Carregar detalhes apenas quando expandir

### 6.2 Segurança

1. **Read-Only**: Apenas leitura, nunca assinar transações sem confirmação
2. **RPC Privados**: Usar endpoints privados em produção
3. **Rate Limiting**: Implementar retry com backoff
4. **Validação**: Validar todos os dados externos

### 6.3 UX

1. **Loading States**: Skeleton loaders durante fetch
2. **Error Handling**: Mensagens claras de erro
3. **Empty States**: Guiar usuário se não houver posições
4. **Refresh**: Botão manual + auto-refresh a cada 60s

### 6.4 Limitações Conhecidas

| Item | Limitação | Workaround |
|------|-----------|------------|
| Subgraph | Pode ter delay de 1-5 min | Usar RPC para dados real-time |
| getProgramAccounts | Pode ser lento em RPC públicos | Usar Helius/QuickNode |
| Multicall | Limite de gas por call | Dividir em batches menores |
| Price APIs | Rate limits | Cache agressivo |

---

## RESUMO EXECUTIVO

### Prioridade de Implementação

1. **EVM First** - Maior adoção, mais pools, Base como foco
2. **Solana Second** - Crescendo rapidamente, Raydium/Orca dominantes

### Estimativa de Tempo

| Fase | Duração | Entregável |
|------|---------|------------|
| Setup + Conexão | 2-3 dias | Wallets conectando |
| LP Positions EVM | 3-4 dias | Uniswap V3 + Aerodrome |
| LP Positions Solana | 3-4 dias | Raydium + Orca |
| Agregação + Polish | 2-3 dias | Dashboard completo |
| **Total** | **10-14 dias** | Feature completa |

### Dependências Externas

- WalletConnect Project ID (gratuito)
- RPC endpoints (Alchemy/Infura/Helius)
- The Graph API key (para Subgraphs)

---

*Documento criado em: Janeiro 2026*
*Última atualização: Janeiro 2026*
