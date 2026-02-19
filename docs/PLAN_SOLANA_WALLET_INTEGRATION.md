# Plano: Integração Completa de Wallets Solana

## Visão Geral

Implementar suporte completo para wallets Solana na plataforma, incluindo:
- Conexão de wallets (Phantom, Solflare, Backpack)
- Token balances via Helius API
- DeFi positions (Marinade, Raydium, Orca)
- Histórico de transações

**Decisões tomadas:**
- ✅ Usar **Helius API** para dados de tokens e transações
- ✅ Incluir **DeFi positions** dos protocolos principais

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                    WALLET CONNECT MODAL                          │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   EVM Tab ✅    │    │   Solana Tab    │                     │
│  │   (MetaMask)    │    │   (Phantom)     │                     │
│  └─────────────────┘    └─────────────────┘                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    WALLET CONTEXT                                │
│  evmWallet (wagmi) ✅    │    solanaWallet (wallet-adapter)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    REACT QUERY HOOKS                             │
│  useWalletBalances ✅     │    useSolanaWalletBalances          │
│  useWalletTransactions ✅ │    useSolanaTransactions            │
│  usePoolPositions ✅      │    useSolanaDeFiPositions           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    DATA SERVICES                                 │
│  Zerion API ✅            │    Helius API                       │
│  Moralis API ✅           │    Solana RPC                       │
│                           │    Protocol-specific APIs            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 1: Conexão de Wallet Solana
**Objetivo:** Permitir que usuários conectem Phantom, Solflare, Backpack

#### 1.1 Reescrever solana-config.tsx
**Arquivo:** `frontend/src/lib/wallet/solana-config.tsx`

```tsx
// Configuração dos adaptadores de wallet Solana
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
  GlowWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

export const SOLANA_NETWORK = WalletAdapterNetwork.Mainnet;
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  || clusterApiUrl(SOLANA_NETWORK);

export const SOLANA_WALLETS = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
  new GlowWalletAdapter(),
];
```

#### 1.2 Atualizar web3-provider.tsx
**Arquivo:** `frontend/src/contexts/web3-provider.tsx`

- Adicionar `ConnectionProvider` do `@solana/web3.js`
- Adicionar `WalletProvider` do `@solana/wallet-adapter-react`
- Garantir que seja client-side only (SSR safe)

#### 1.3 Implementar connectSolanaWallet()
**Arquivo:** `frontend/src/contexts/wallet-context.tsx`

- Usar hooks do `@solana/wallet-adapter-react`:
  - `useWallet()` - estado da wallet
  - `useConnection()` - conexão RPC
- Implementar `connectSolanaWallet(walletType)`:
  - Selecionar adaptador por tipo
  - Chamar `wallet.connect()`
  - Atualizar estado `solanaWallet`
  - Auto-salvar no backend

#### 1.4 Testar conexão
- [ ] Phantom no Chrome
- [ ] Solflare no Chrome
- [ ] Backpack no Chrome

---

### Fase 2: Token Balances via Helius
**Objetivo:** Buscar todos os tokens SPL de uma wallet Solana

#### 2.1 Criar serviço Helius
**Arquivo:** `frontend/src/lib/solana/helius-service.ts`

```typescript
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Método 1: getAssetsByOwner (DAS API)
export async function getSolanaTokens(address: string): Promise<SolanaToken[]> {
  const response = await fetch(HELIUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-assets',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: address,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true,
        },
      },
    }),
  });

  const data = await response.json();
  return normalizeHeliusTokens(data.result.items);
}

// Método 2: Enhanced Transactions API
export async function getSolanaTransactions(
  address: string,
  limit: number = 50
): Promise<SolanaTransaction[]> {
  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
  );

  const data = await response.json();
  return normalizeHeliusTransactions(data);
}
```

#### 2.2 Criar tipos Solana
**Arquivo:** `frontend/src/lib/solana/solana-types.ts`

```typescript
export interface SolanaToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  logoUrl?: string;
  isNative: boolean; // true for SOL
}

export interface SolanaTransaction {
  signature: string;
  timestamp: number;
  type: 'TRANSFER' | 'SWAP' | 'STAKE' | 'UNSTAKE' | 'NFT_SALE' | 'UNKNOWN';
  fee: number;
  status: 'success' | 'failed';
  description: string;
  tokenTransfers: TokenTransfer[];
}

export interface SolanaDeFiPosition {
  protocol: string;
  protocolLogo: string;
  type: 'staking' | 'liquidity' | 'lending';
  tokens: SolanaToken[];
  valueUsd: number;
  apy?: number;
  rewards?: SolanaToken[];
}
```

#### 2.3 Criar hook useSolanaWalletBalances
**Arquivo:** `frontend/src/hooks/useSolanaWalletBalances.ts`

```typescript
export function useSolanaWalletBalances() {
  const { solanaWallet, isSolanaConnected } = useWallet();

  return useQuery({
    queryKey: ['solana-balances', solanaWallet?.address],
    queryFn: () => getSolanaTokens(solanaWallet!.address),
    enabled: isSolanaConnected && !!solanaWallet?.address,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
```

---

### Fase 3: DeFi Positions
**Objetivo:** Buscar posições em Marinade, Raydium, Orca

#### 3.1 Marinade Finance (Staking Líquido)
**Arquivo:** `frontend/src/lib/solana/protocols/marinade.ts`

Marinade usa o token mSOL que representa SOL em staking.

```typescript
// Método simples: verificar balance de mSOL
const MSOL_MINT = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';

export async function getMarinadePosition(address: string): Promise<SolanaDeFiPosition | null> {
  // 1. Buscar balance de mSOL via Helius (já vem no getAssetsByOwner)
  // 2. Buscar stake accounts nativas
  // 3. Calcular valor total em staking
  // 4. Buscar APY atual via Marinade API
}
```

#### 3.2 Raydium (LP Positions)
**Arquivo:** `frontend/src/lib/solana/protocols/raydium.ts`

```typescript
// Raydium LP tokens têm estrutura específica
export async function getRaydiumPositions(address: string): Promise<SolanaDeFiPosition[]> {
  // 1. Buscar LP tokens do usuário
  // 2. Para cada LP token, buscar pool info via Raydium API
  // 3. Calcular valor das posições
  // 4. Incluir farming rewards se houver
}
```

#### 3.3 Orca (Whirlpools)
**Arquivo:** `frontend/src/lib/solana/protocols/orca.ts`

```typescript
// Orca usa concentrated liquidity (Whirlpools)
export async function getOrcaPositions(address: string): Promise<SolanaDeFiPosition[]> {
  // 1. Buscar NFT positions (Whirlpool positions são NFTs)
  // 2. Para cada position, buscar pool data
  // 3. Calcular liquidity e fees acumulados
}
```

#### 3.4 Criar hook unificado
**Arquivo:** `frontend/src/hooks/useSolanaDeFiPositions.ts`

```typescript
export function useSolanaDeFiPositions() {
  const { solanaWallet, isSolanaConnected } = useWallet();

  return useQuery({
    queryKey: ['solana-defi', solanaWallet?.address],
    queryFn: async () => {
      const [marinade, raydium, orca] = await Promise.all([
        getMarinadePosition(solanaWallet!.address),
        getRaydiumPositions(solanaWallet!.address),
        getOrcaPositions(solanaWallet!.address),
      ]);

      return {
        marinade,
        raydium,
        orca,
        totalValueUsd: calculateTotalValue([marinade, ...raydium, ...orca]),
      };
    },
    enabled: isSolanaConnected && !!solanaWallet?.address,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 120 * 1000,
  });
}
```

---

### Fase 4: Atualizar UI
**Objetivo:** Mostrar dados Solana na página de wallets

#### 4.1 Atualizar wallets/page.tsx
**Arquivo:** `frontend/src/app/positions/wallets/page.tsx`

- Adicionar suporte para múltiplas wallets (EVM + Solana)
- Combinar totais nos cards de summary
- Adicionar seção específica para wallet Solana
- Chain "solana" com cor #00FFA3

#### 4.2 Criar componente SolanaWalletCard
**Arquivo:** `frontend/src/components/wallet/solana-wallet-card.tsx`

```tsx
export function SolanaWalletCard() {
  const { solanaWallet, disconnectSolanaWallet } = useWallet();
  const { data: balances, isLoading } = useSolanaWalletBalances();
  const { data: defi } = useSolanaDeFiPositions();

  return (
    <div className="wallet-card">
      <WalletHeader
        wallet={solanaWallet}
        onDisconnect={disconnectSolanaWallet}
      />
      <TopHoldings tokens={balances?.tokens} />
      <DeFiPositions positions={defi} />
      <AllTokensList tokens={balances?.tokens} />
    </div>
  );
}
```

---

## Arquivos a Criar/Modificar

### Criar (novos)
| Arquivo | Descrição |
|---------|-----------|
| `lib/solana/index.ts` | Exports do módulo Solana |
| `lib/solana/helius-service.ts` | API Helius para tokens e transações |
| `lib/solana/solana-types.ts` | Tipos TypeScript |
| `lib/solana/protocols/marinade.ts` | Integração Marinade |
| `lib/solana/protocols/raydium.ts` | Integração Raydium |
| `lib/solana/protocols/orca.ts` | Integração Orca |
| `hooks/useSolanaWalletBalances.ts` | Hook de balances |
| `hooks/useSolanaDeFiPositions.ts` | Hook de DeFi |
| `hooks/useSolanaTransactions.ts` | Hook de transações |
| `components/wallet/solana-wallet-card.tsx` | Card de wallet Solana |

### Modificar (existentes)
| Arquivo | Mudança |
|---------|---------|
| `lib/wallet/solana-config.tsx` | Reescrever com adaptadores reais |
| `contexts/web3-provider.tsx` | Adicionar SolanaWalletProvider |
| `contexts/wallet-context.tsx` | Implementar connectSolanaWallet |
| `app/positions/wallets/page.tsx` | Adicionar suporte Solana |
| `.env.local` | Adicionar NEXT_PUBLIC_HELIUS_API_KEY |

---

## Variáveis de Ambiente

Adicionar ao `.env.local`:

```env
# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_API_KEY=your-helius-api-key

# Obter chave em: https://dev.helius.xyz/dashboard/app
# Tier gratuito: 100k requests/mês
```

---

## Ordem de Implementação

```
Semana 1: Conexão de Wallet
├── 1.1 Reescrever solana-config.tsx
├── 1.2 Atualizar web3-provider.tsx
├── 1.3 Implementar connectSolanaWallet
└── 1.4 Testar com Phantom

Semana 2: Token Balances
├── 2.1 Criar helius-service.ts
├── 2.2 Criar solana-types.ts
├── 2.3 Criar useSolanaWalletBalances
└── 2.4 Mostrar tokens na UI

Semana 3: DeFi Positions
├── 3.1 Integrar Marinade (staking)
├── 3.2 Integrar Raydium (LP)
├── 3.3 Integrar Orca (Whirlpools)
└── 3.4 Criar useSolanaDeFiPositions

Semana 4: UI & Polish
├── 4.1 Combinar dados EVM + Solana
├── 4.2 Criar componentes específicos
├── 4.3 Testar fluxo completo
└── 4.4 Error handling & edge cases
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Helius API rate limit | Baixa | Tier gratuito é 100k/mês, suficiente |
| SSR issues com wallet-adapter | Média | Usar dynamic imports e 'use client' |
| Raydium/Orca APIs instáveis | Média | Implementar fallbacks e cache agressivo |
| Wallet não detectada | Baixa | Mostrar link para instalar extensão |

---

## Critérios de Aceite

### Fase 1 - Conexão
- [ ] Usuário consegue conectar Phantom
- [ ] Endereço é salvo no backend com network='solana'
- [ ] UI mostra wallet conectada com indicador verde
- [ ] Disconnect funciona corretamente

### Fase 2 - Tokens
- [ ] Lista todos os tokens SPL da wallet
- [ ] Mostra SOL balance (nativo)
- [ ] Preços em USD corretos
- [ ] Total value calculado corretamente

### Fase 3 - DeFi
- [ ] Mostra mSOL em staking (Marinade)
- [ ] Mostra LP positions (Raydium)
- [ ] Mostra Whirlpool positions (Orca)
- [ ] APY mostrado quando disponível

### Fase 4 - UI
- [ ] Cards de summary combinam EVM + Solana
- [ ] Chain "solana" aparece no breakdown
- [ ] Transições suaves entre wallets
- [ ] Loading states corretos

---

## Próximos Passos

1. **Aprovar este plano**
2. Obter API key da Helius (https://dev.helius.xyz)
3. Começar pela Fase 1 - Conexão de Wallet
4. Testar incrementalmente cada fase

---

*Criado em: 05/02/2026*
*Última atualização: 05/02/2026*
