# CLAUDE.md - Interconection Treasury MGMT

> Instruções de desenvolvimento para o assistente de IA

---

## REGRA FUNDAMENTAL DE DESENVOLVIMENTO

**SEMPRE revisar cada task completada antes de passar para a próxima.**

Antes de marcar uma task como concluída e iniciar outra:
1. Verificar se o código está funcionando corretamente
2. Testar a funcionalidade implementada
3. Garantir que segue os padrões do Design System
4. Confirmar que não há erros de lint/typescript
5. Validar que a estrutura de arquivos está correta

**Não avançar para a próxima task sem revisão completa da anterior.**

---

## Visão Geral do Projeto

**Interconection Treasury MGMT** é uma plataforma de gestão de tesouraria corporativa em criptoativos (Treasury Management as a Service).

**Objetivo:** Consolidar todas as posições (wallets, exchanges, DeFi, staking) em um único dashboard com visibilidade total sobre rendimentos e riscos.

**Documentação completa:** [docs/PRD.md](docs/PRD.md)

---

## Stack Tecnológica

### Frontend
- **Framework:** Next.js 14+ com App Router
- **UI:** React 18+, TypeScript 5+
- **Styling:** TailwindCSS 3.4+
- **Gráficos:** ApexCharts
- **Animações:** Framer Motion
- **Ícones:** Lucide React
- **State:** Zustand
- **Data Fetching:** React Query (TanStack Query)
- **Forms:** React Hook Form + Zod
- **Tabelas:** TanStack Table

### Backend
- **Framework:** FastAPI 0.100+
- **Python:** 3.11+
- **ORM:** SQLAlchemy 2.0+
- **Migrations:** Alembic
- **Validação:** Pydantic 2.5+
- **Background Tasks:** Celery
- **Cache:** Redis

### Database
- **Principal:** PostgreSQL 15+
- **Time-series:** TimescaleDB
- **Cache:** Redis

### Real-time
- WebSockets (FastAPI native)

---

## Configuração de Portas

> **IMPORTANTE:** As portas 3000, 3001, 3002, 8000 e 8001 estão ocupadas por outro projeto.

| Serviço | Portas Disponíveis |
|---------|--------------------|
| Frontend (Next.js) | **3003**, 3004, 3005 |
| Backend (FastAPI) | **8002** |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Comandos Essenciais

### Frontend
```bash
cd frontend
npm install                    # Instalar dependências
npm run dev -- -p 3003         # Desenvolvimento (localhost:3003)
npm run build                  # Build de produção
npm run lint                   # Verificar linting
npm run test                   # Rodar testes
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Linux/Mac
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002  # Desenvolvimento (localhost:8002)
```

### Database
```bash
# Migrations
cd backend
alembic upgrade head          # Aplicar migrations
alembic revision --autogenerate -m "description"  # Criar migration
```

---

## Design System - Referência Rápida

### Cores Principais
```css
/* Brand */
--accent-purple: #a855f7;     /* Primária */
--accent-blue: #3b82f6;       /* Secundária */
--accent-orange: #f97316;     /* Destaque */
--accent-yellow: #eab308;     /* Avisos */

/* Background (tema escuro) */
--bg-primary: #0d0d12;
--bg-secondary: #13131a;
--bg-tertiary: #1a1a24;
--bg-elevated: #22222e;

/* Status */
--status-success: #22c55e;
--status-error: #ef4444;
--status-warning: #eab308;
--status-info: #3b82f6;

/* Texto */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-tertiary: rgba(255, 255, 255, 0.5);
```

### Gradiente Principal
```css
--gradient-brand: linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #f97316 100%);
```

### Glassmorphism
```css
.glass-card {
  background: rgba(26, 26, 36, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
}
```

### Tipografia
- **Fonte:** Inter
- **Display:** 48px/36px (bold)
- **Heading:** 30px/24px/20px/16px (semibold)
- **Body:** 18px/16px/14px (regular)
- **Caption:** 12px/11px

---

## Estrutura de Pastas

### Frontend (src/)
```
src/
├── app/                    # App Router - páginas
│   ├── (auth)/            # Rotas de autenticação
│   └── (dashboard)/       # Rotas do dashboard
├── components/
│   ├── ui/                # Componentes base (button, input, etc.)
│   ├── layout/            # Sidebar, header, page containers
│   ├── charts/            # Gráficos ApexCharts
│   ├── cards/             # Cards especializados
│   ├── tables/            # Tabelas de dados
│   ├── forms/             # Formulários
│   ├── modals/            # Modais
│   └── shared/            # Componentes compartilhados
├── hooks/                 # Custom hooks
├── lib/
│   ├── api/               # Funções de API
│   ├── utils/             # Utilitários
│   ├── charts/            # Config ApexCharts
│   └── constants/         # Constantes
├── stores/                # Zustand stores
├── types/                 # TypeScript types
└── styles/                # CSS global e tokens
```

### Backend (app/)
```
app/
├── api/v1/endpoints/      # Endpoints REST
├── core/                  # Config, security, exceptions
├── db/                    # Database session e init
├── models/                # SQLAlchemy models
├── schemas/               # Pydantic schemas
├── services/              # Business logic
├── integrations/          # Exchanges, wallets, DeFi
├── workers/               # Celery tasks
├── websocket/             # WebSocket handlers
└── utils/                 # Utilitários
```

---

## Convenções de Código

### TypeScript/React

```tsx
// Componente padrão
import { type FC } from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export const Component: FC<ComponentProps> = ({ className, children }) => {
  return (
    <div className={cn('base-styles', className)}>
      {children}
    </div>
  );
};
```

**Regras:**
- Componentes funcionais com hooks
- Named exports para componentes
- Props tipadas com interface
- Custom hooks começam com "use"
- Arquivos de componente: PascalCase
- Arquivos de utilitários: kebab-case

### Python/FastAPI

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.example import ExampleResponse
from app.services.example_service import ExampleService

router = APIRouter()

@router.get("/", response_model=list[ExampleResponse])
async def list_examples(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
) -> list[ExampleResponse]:
    """Lista todos os exemplos."""
    service = ExampleService(db)
    return await service.list_all(current_user.organization_id)
```

**Regras:**
- Type hints em todas as funções
- Docstrings em classes e funções públicas
- Async/await para operações I/O
- Pydantic para validação de schemas

---

## Fluxo de Desenvolvimento - Fase 1 (MVP)

### Sprint 1-2: Setup e Auth
- [ ] Configurar repositório
- [ ] Setup Next.js com TailwindCSS
- [ ] Implementar Design System (tokens, componentes base)
- [ ] Layout principal (sidebar, header)
- [ ] Páginas de autenticação (login, register, forgot)

### Sprint 3-4: Dashboard
- [ ] Dashboard layout
- [ ] Stat cards com dados mock
- [ ] Gráficos de evolução (ApexCharts)
- [ ] Donut de alocação
- [ ] Atividade recente

### Sprint 5-6: Posições
- [ ] Tabela de posições
- [ ] Filtros e busca
- [ ] Detalhe de posição
- [ ] Visualização por exchange/wallet/protocol
- [ ] Empty states

### Sprint 7-8: Analytics
- [ ] Performance charts
- [ ] Risk metrics (VaR, drawdown)
- [ ] Correlation heatmap
- [ ] P&L breakdown

### Sprint 9-10: Integrações e Alertas
- [ ] Wizard de conexão de exchanges
- [ ] Cards de integrações
- [ ] Status de sincronização
- [ ] Sistema de alertas
- [ ] Centro de notificações

### Sprint 11-12: Polish e Testes
- [ ] Responsividade
- [ ] Tema claro
- [ ] Acessibilidade
- [ ] Testes E2E
- [ ] Performance optimization

---

## Variáveis de Ambiente

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8002
NEXT_PUBLIC_WS_URL=ws://localhost:8002
```

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/interconection
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## Git Workflow

- **main:** produção
- **develop:** desenvolvimento
- **feature/*:** novas features
- **fix/*:** correções

**Commits:** Conventional Commits
```
feat: adiciona componente de gráfico de portfolio
fix: corrige cálculo de P&L
docs: atualiza documentação de API
style: ajusta espaçamento do card
refactor: reorganiza estrutura de hooks
test: adiciona testes para auth service
chore: atualiza dependências
```

---

## Padrões de Componentes

### Stat Card
```tsx
<StatCard
  label="Total Portfolio"
  value="$2,450,000"
  change={12.5}
  changeType="positive"
  icon={<Wallet />}
/>
```

### Gráfico Area
```tsx
<AreaChart
  data={portfolioHistory}
  xField="date"
  yField="value"
  period="30d"
  showTooltip
/>
```

### Tabela de Posições
```tsx
<PositionsTable
  data={positions}
  columns={['asset', 'quantity', 'value', 'pnl', 'location']}
  sortable
  filterable
  searchable
/>
```

---

## APIs Principais

### Autenticação
```
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
```

### Portfolio
```
GET /api/v1/portfolio
GET /api/v1/portfolio/summary
GET /api/v1/portfolio/allocation
GET /api/v1/portfolio/history
```

### Posições
```
GET /api/v1/positions
GET /api/v1/positions/:id
GET /api/v1/positions/by-exchange
GET /api/v1/positions/by-wallet
GET /api/v1/positions/by-protocol
```

### Analytics
```
GET /api/v1/analytics/performance
GET /api/v1/analytics/risk
GET /api/v1/analytics/pnl
```

### Integrações
```
GET /api/v1/integrations
POST /api/v1/integrations
POST /api/v1/integrations/:id/sync
```

### Alertas
```
GET /api/v1/alerts
POST /api/v1/alerts
PATCH /api/v1/alerts/:id
```

---

## WebSocket Events

### Subscrever
```javascript
socket.emit('subscribe:prices', { assets: ['BTC', 'ETH'] });
socket.emit('subscribe:portfolio');
socket.emit('subscribe:alerts');
```

### Receber
```javascript
socket.on('price:update', (data) => { /* atualiza preço */ });
socket.on('portfolio:update', (data) => { /* atualiza portfolio */ });
socket.on('alert:triggered', (data) => { /* mostra notificação */ });
```

---

## Checklist de Qualidade

### Antes de cada PR
- [ ] Código segue as convenções
- [ ] Types estão corretos
- [ ] Não há console.log
- [ ] Componentes são acessíveis
- [ ] Responsividade testada
- [ ] Testes passando
- [ ] Lint sem erros

### Performance
- [ ] Imagens otimizadas
- [ ] Lazy loading onde necessário
- [ ] Memoização de componentes pesados
- [ ] Bundle size razoável

### Segurança
- [ ] Inputs sanitizados
- [ ] Auth verificada em rotas protegidas
- [ ] Dados sensíveis não expostos
- [ ] CORS configurado corretamente

---

## Recursos Úteis

- **PRD Completo:** [docs/PRD.md](docs/PRD.md)
- **API Docs:** http://localhost:8002/docs (Swagger)
- **Design Figma:** [link quando disponível]

---

## Contato e Suporte

Para dúvidas sobre o projeto, consulte primeiro o PRD e esta documentação.

---

*Última atualização: Janeiro 2026*
