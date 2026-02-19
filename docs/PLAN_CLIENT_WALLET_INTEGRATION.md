# Plano: Integração de Wallet Automática na Área do Cliente

## Situação Atual

### O que existe:
1. **Modal de conexão manual**: Pede endereço da wallet manualmente
2. **Backend completo**:
   - Modelo Wallet no banco
   - Endpoint `/wallets/{id}/scan` que usa Zerion API
   - Serviço `wallet_scan_service.py` que busca posições e salva no banco
3. **Frontend com Web3**:
   - wagmi + viem configurados
   - WalletContext com conexão MetaMask/WalletConnect
   - Hooks `useWalletBalances` e `useWalletTransactions`

### O problema:
- Na área do cliente, o modal pede endereço **manualmente**
- Não usa a conexão automática Web3 (MetaMask popup)
- Não está usando o scan do backend para buscar posições

---

## Plano de Implementação

### Fase 1: Atualizar Modal de Conexão de Wallet

**Arquivo**: `frontend/src/app/clients/[id]/page.tsx` (AddWalletModal)

**Mudanças**:
1. Adicionar botão "Conectar via MetaMask" que usa `WalletContext`
2. Quando conectar via Web3:
   - Pegar o endereço automaticamente
   - Preencher o campo de endereço
   - Detectar a chain (Ethereum, Arbitrum, Base)
3. Manter opção de inserir endereço manualmente (para wallets que o usuário quer monitorar sem ter acesso)

```tsx
// Novo fluxo:
// 1. Usuário clica "Conectar via MetaMask"
// 2. WalletContext.connectEVMWallet() abre popup
// 3. Após conexão, preenche address automaticamente
// 4. Usuário pode editar label e confirmar
// 5. Salva wallet no backend
// 6. Dispara scan automático
```

### Fase 2: Integrar Scan Automático

**Fluxo após adicionar wallet**:
1. `api.createWallet()` - salva no banco
2. `api.scanWallet()` - dispara scan via Zerion
3. `fetchPortfolio()` - recarrega dados do cliente

**Mudança no `client-context.tsx`**:
```tsx
const addWallet = async (clientId, wallet) => {
  const result = await api.createWallet(...);
  if (result.success && result.data) {
    // Auto-scan após criar
    await api.scanWallet(clientId, result.data.id);
  }
  // Recarrega portfolio
  await fetchPortfolio(clientId);
};
```

### Fase 3: Exibir Posições da Wallet

**Já funciona parcialmente**:
- `client_service.py` já busca posições da wallet (linhas 197-237)
- Transforma em `WalletTokenBalance` com dados

**Verificar**:
- Se o scan está salvando `unrealized_pnl` corretamente
- Se os tokens estão aparecendo na tabela unificada

### Fase 4: Calcular PnL de Wallets

**Problema**: Wallets não têm histórico de trades como exchanges

**Soluções possíveis**:
1. **Usar histórico de transações**: Buscar transações via Zerion/Moralis e calcular cost basis
2. **Usar preço de entrada manual**: Pedir ao usuário o preço médio de compra
3. **Usar primeira transação detectada**: Como aproximação do cost basis

**Implementação recomendada** (similar ao exchange):
```python
# backend/app/services/wallet_scan_service.py
# Após buscar posições, buscar histórico de transações
# Calcular cost basis usando FIFO
# Salvar entry_price e unrealized_pnl na Position
```

---

## Arquivos a Modificar

### Frontend:

| Arquivo | Mudança |
|---------|---------|
| `app/clients/[id]/page.tsx` | Atualizar AddWalletModal com botão Web3 |
| `contexts/client-context.tsx` | Já está ok (auto-scan após criar) |
| `lib/api/client.ts` | Verificar se scanWallet retorna dados corretos |

### Backend:

| Arquivo | Mudança |
|---------|---------|
| `services/wallet_scan_service.py` | Adicionar cálculo de PnL via histórico |
| `api/v1/endpoints/wallets.py` | Verificar endpoint de scan |

---

## Tarefas Detalhadas

### Task 1: Atualizar Modal de Wallet (Frontend)
- [ ] Importar `useWalletContext` no page.tsx
- [ ] Adicionar estado para conexão Web3
- [ ] Criar botão "Conectar MetaMask" no modal
- [ ] Auto-preencher endereço após conexão
- [ ] Detectar chain automaticamente

### Task 2: Verificar Scan de Wallet (Backend)
- [ ] Testar endpoint `/wallets/{id}/scan`
- [ ] Verificar se Zerion API key está configurada
- [ ] Confirmar que posições são salvas corretamente

### Task 3: Implementar PnL para Wallets
- [ ] Buscar histórico de transações da wallet
- [ ] Calcular cost basis por token
- [ ] Salvar entry_price e unrealized_pnl
- [ ] Atualizar frontend para exibir PnL de wallets

### Task 4: Testar Fluxo Completo
- [ ] Conectar wallet via MetaMask
- [ ] Verificar se wallet é salva no banco
- [ ] Verificar se scan busca tokens
- [ ] Verificar se posições aparecem na tabela
- [ ] Verificar se PnL é calculado

---

## Estimativa de Complexidade

| Fase | Complexidade | Prioridade |
|------|--------------|------------|
| Fase 1 - Modal Web3 | Média | Alta |
| Fase 2 - Auto Scan | Baixa | Alta |
| Fase 3 - Exibir Posições | Baixa | Alta |
| Fase 4 - PnL de Wallets | Alta | Média |

---

## Dependências

1. **Zerion API Key**: Necessária para scan funcionar
2. **WalletContext**: Já existe e funciona
3. **Backend scan service**: Já existe, pode precisar ajustes

---

## Próximos Passos

1. Começar pela **Fase 1** - Atualizar o modal
2. Testar o scan existente para ver se funciona
3. Implementar PnL depois que o básico estiver funcionando
