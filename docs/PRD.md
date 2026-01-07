# PRD - Interconection Treasury MGMT
## Product Requirements Document - Versão 1.0

---

## 1. VISÃO GERAL DO PRODUTO

### 1.1 Nome do Produto
**Interconection - Treasury MGMT**

### 1.2 Descrição
Plataforma de gestão de tesouraria corporativa em criptoativos (Treasury Management as a Service), permitindo gerenciamento interno das operações da própria mesa e oferta da mesma plataforma para clientes externos B2B (gestoras, fundos, empresas).

### 1.3 Proposta de Valor
- Consolidação de todas as posições (wallets, exchanges, DeFi, staking) em um único dashboard
- Visibilidade total sobre rendimentos e riscos
- Relatórios automatizados para compliance e auditoria
- Gestão multi-tenant para atender múltiplos clientes

### 1.4 Público-Alvo

| Tipo | Descrição |
|------|-----------|
| Primário | Equipe interna de tesouraria (dogfooding) |
| Secundário | Gestoras de investimentos em cripto |
| Terciário | Fundos, family offices, empresas com treasury em cripto |

### 1.5 Modelo de Negócio

| Item | Valor |
|------|-------|
| Management Fee | 0,5-1% a.a. sobre AUM |
| Performance Fee | 10-20% sobre rendimentos acima de benchmark |
| Setup e Integração | R$ 50.000 - R$ 200.000 |

---

## 2. STACK TECNOLÓGICA

### 2.0 Configuração de Portas (Ambiente Local)

> **IMPORTANTE:** As portas 3000, 3001, 3002, 8000 e 8001 estão ocupadas por outro projeto. Use as portas alternativas abaixo.

| Serviço | Porta Padrão | Portas Alternativas | Status |
|---------|--------------|---------------------|--------|
| Frontend (Next.js) | 3000 | **3003**, 3004, 3005 | Usar 3003 |
| Backend (FastAPI) | 8000 | **8002** | Usar 8002 |
| PostgreSQL | 5432 | - | Padrão |
| Redis | 6379 | - | Padrão |

**Para iniciar o frontend na porta 3003:**
```bash
cd frontend
npm run dev -- -p 3003
# ou
PORT=3003 npm run dev
```

**Para iniciar o backend na porta 8002:**
```bash
cd backend
uvicorn app.main:app --reload --port 8002
```

### 2.1 Visão Geral da Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│         Next.js 14+ │ React 18+ │ TypeScript 5+             │
│         TailwindCSS │ ApexCharts │ Framer Motion            │
├─────────────────────────────────────────────────────────────┤
│                      BACKEND                                 │
│              Python 3.11+ │ FastAPI 0.100+                  │
│              Pydantic │ SQLAlchemy │ Alembic                │
├─────────────────────────────────────────────────────────────┤
│                     DATABASE                                 │
│         PostgreSQL 15+ │ TimescaleDB (time-series)          │
│                    Redis (cache)                             │
├─────────────────────────────────────────────────────────────┤
│                    REAL-TIME                                 │
│              WebSockets (FastAPI native)                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend - Dependências Principais

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "apexcharts": "^3.45.0",
    "react-apexcharts": "^1.4.1",
    "framer-motion": "^10.16.0",
    "lucide-react": "^0.300.0",
    "zustand": "^4.4.0",
    "react-query": "^5.0.0",
    "@tanstack/react-table": "^8.10.0",
    "date-fns": "^3.0.0",
    "socket.io-client": "^4.6.0",
    "axios": "^1.6.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.49.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

### 2.3 Backend - Dependências Principais

```
fastapi>=0.100.0
uvicorn[standard]>=0.24.0
python-dotenv>=1.0.0
pydantic>=2.5.0
sqlalchemy>=2.0.0
alembic>=1.13.0
asyncpg>=0.29.0
psycopg2-binary>=2.9.0
redis>=5.0.0
httpx>=0.25.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.0
websockets>=12.0
celery>=5.3.0
```

---

## 3. DESIGN SYSTEM - INTERCONECTION

### 3.1 Paleta de Cores

#### Tema Escuro (Principal)

**Background**

| Variável | Hex | Uso |
|----------|-----|-----|
| --bg-primary | #0d0d12 | Fundo principal da aplicação |
| --bg-secondary | #13131a | Fundo de seções/containers |
| --bg-tertiary | #1a1a24 | Fundo de cards |
| --bg-elevated | #22222e | Elementos elevados/hover |
| --bg-gradient | linear-gradient(135deg, #0d0d12 0%, #1a1525 50%, #1c1a20 100%) | Gradiente principal |

**Cores de Acento (Brand)**

| Variável | Hex | RGB | Uso |
|----------|-----|-----|-----|
| --accent-purple | #a855f7 | 168, 85, 247 | Cor principal da marca |
| --accent-blue | #3b82f6 | 59, 130, 246 | Ações secundárias, links |
| --accent-orange | #f97316 | 249, 115, 22 | Destaques, alertas |
| --accent-yellow | #eab308 | 234, 179, 8 | Avisos, progresso |

**Gradientes de Acento**

```css
/* Gradiente Principal (bordas especiais, CTAs) */
--gradient-brand: linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #f97316 100%);

/* Gradiente Secundário */
--gradient-secondary: linear-gradient(135deg, #3b82f6 0%, #a855f7 100%);

/* Gradiente de Destaque */
--gradient-highlight: linear-gradient(135deg, #f97316 0%, #eab308 100%);

/* Gradiente Sutil (backgrounds) */
--gradient-subtle: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
```

**Cores de Status**

| Status | Hex | Uso |
|--------|-----|-----|
| --status-success | #22c55e | Sucesso, positivo, lucro |
| --status-error | #ef4444 | Erro, negativo, perda |
| --status-warning | #eab308 | Aviso, atenção |
| --status-info | #3b82f6 | Informativo |

**Texto**

| Variável | Valor | Uso |
|----------|-------|-----|
| --text-primary | #ffffff | Texto principal |
| --text-secondary | rgba(255, 255, 255, 0.7) | Texto secundário |
| --text-tertiary | rgba(255, 255, 255, 0.5) | Labels, hints |
| --text-muted | rgba(255, 255, 255, 0.3) | Texto desabilitado |

**Bordas e Divisores**

| Variável | Valor |
|----------|-------|
| --border-subtle | rgba(255, 255, 255, 0.06) |
| --border-default | rgba(255, 255, 255, 0.1) |
| --border-strong | rgba(255, 255, 255, 0.15) |
| --border-accent | var(--gradient-brand) |

#### Tema Claro (Secundário)

| Variável | Hex |
|----------|-----|
| --bg-primary-light | #ffffff |
| --bg-secondary-light | #f8fafc |
| --bg-tertiary-light | #f1f5f9 |
| --text-primary-light | #0f172a |
| --text-secondary-light | #475569 |
| --border-light | #e2e8f0 |

### 3.2 Tipografia

**Fonte Principal**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Escala Tipográfica**

| Nome | Tamanho | Peso | Line-Height | Uso |
|------|---------|------|-------------|-----|
| display-xl | 48px | 700 | 1.1 | Títulos de página |
| display-lg | 36px | 700 | 1.2 | Seções principais |
| heading-xl | 30px | 600 | 1.25 | Títulos de seção |
| heading-lg | 24px | 600 | 1.3 | Subtítulos |
| heading-md | 20px | 600 | 1.4 | Cards headers |
| heading-sm | 16px | 600 | 1.4 | Labels importantes |
| body-lg | 18px | 400 | 1.6 | Texto de destaque |
| body-md | 16px | 400 | 1.5 | Texto padrão |
| body-sm | 14px | 400 | 1.5 | Texto secundário |
| caption | 12px | 400 | 1.4 | Legendas, hints |
| overline | 11px | 500 | 1.3 | Labels uppercase |

**Números e Dados**
```css
/* Para valores monetários e métricas */
font-feature-settings: 'tnum' on, 'lnum' on;
font-variant-numeric: tabular-nums;
```

### 3.3 Espaçamento

**Sistema de Grid**
```css
--spacing-unit: 4px;

--space-1: 4px;    /* 0.25rem */
--space-2: 8px;    /* 0.5rem */
--space-3: 12px;   /* 0.75rem */
--space-4: 16px;   /* 1rem */
--space-5: 20px;   /* 1.25rem */
--space-6: 24px;   /* 1.5rem */
--space-8: 32px;   /* 2rem */
--space-10: 40px;  /* 2.5rem */
--space-12: 48px;  /* 3rem */
--space-16: 64px;  /* 4rem */
--space-20: 80px;  /* 5rem */
```

**Layout Grid**
```css
/* Container máximo */
--container-max: 1440px;

/* Sidebar */
--sidebar-width: 260px;
--sidebar-collapsed: 72px;

/* Header */
--header-height: 64px;

/* Gaps */
--grid-gap: 24px;
--card-gap: 16px;
```

### 3.4 Efeitos e Animações

**Glassmorphism**
```css
/* Card Glassmorphism Padrão */
.glass-card {
  background: rgba(26, 26, 36, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
}

/* Card Glassmorphism Elevado */
.glass-card-elevated {
  background: rgba(34, 34, 46, 0.8);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Card com Borda Gradiente */
.glass-card-gradient {
  position: relative;
  background: rgba(26, 26, 36, 0.6);
  backdrop-filter: blur(20px);
  border-radius: 16px;
}
.glass-card-gradient::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, #a855f7, #3b82f6, #f97316);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
```

**Sombras**
```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.5);

/* Glow Effects */
--glow-purple: 0 0 20px rgba(168, 85, 247, 0.3);
--glow-blue: 0 0 20px rgba(59, 130, 246, 0.3);
--glow-orange: 0 0 20px rgba(249, 115, 22, 0.3);
```

**Transições**
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
--transition-slower: 500ms ease;

/* Curvas de animação */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
```

**Border Radius**
```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
--radius-full: 9999px;
```

### 3.5 Componentes UI

#### 3.5.1 Buttons

**Primary Button**
- Background: var(--gradient-brand)
- Texto: #ffffff, font-weight: 600
- Padding: 12px 24px
- Border-radius: 8px
- Hover: brightness(1.1) + box-shadow: var(--glow-purple)
- Active: scale(0.98)
- Disabled: opacity: 0.5, cursor: not-allowed

**Secondary Button**
- Background: transparent
- Border: 1px solid rgba(255, 255, 255, 0.15)
- Texto: var(--text-primary)
- Hover: background rgba(255, 255, 255, 0.05)

**Ghost Button**
- Background: transparent
- Border: none
- Texto: var(--text-secondary)
- Hover: texto var(--text-primary), background rgba(255, 255, 255, 0.05)

**Icon Button**
- Tamanho: 40px x 40px (md), 32px x 32px (sm)
- Border-radius: 8px
- Background: rgba(255, 255, 255, 0.05)
- Hover: rgba(255, 255, 255, 0.1)

#### 3.5.2 Inputs

**Text Input**
- Background: rgba(255, 255, 255, 0.05)
- Border: 1px solid rgba(255, 255, 255, 0.1)
- Border-radius: 8px
- Padding: 12px 16px
- Texto: var(--text-primary)
- Placeholder: var(--text-muted)
- Focus: border-color var(--accent-purple), box-shadow var(--glow-purple)

**Select**
- Mesmo estilo do Text Input
- Ícone dropdown: lucide ChevronDown
- Dropdown menu: glassmorphism card

**Checkbox / Toggle**
- Toggle: 44px x 24px
- Background off: rgba(255, 255, 255, 0.1)
- Background on: var(--accent-purple)
- Transição: 200ms ease

#### 3.5.3 Cards

**Card Base**
- Background: var(--bg-tertiary) ou glassmorphism
- Border: 1px solid var(--border-subtle)
- Border-radius: 16px
- Padding: 24px
- Hover: transform translateY(-2px), box-shadow var(--shadow-lg)

**Stat Card**
- Layout: vertical
- Label: overline, text-tertiary, uppercase
- Value: heading-xl ou display-lg, text-primary
- Change indicator: badge com ícone (TrendingUp/TrendingDown)
- Ícone decorativo: 48px, cor de acento com opacity 0.1 bg

**Card com Gráfico**
- Header: título + filtros/período
- Body: gráfico ApexCharts
- Footer (opcional): legenda ou métricas resumidas

#### 3.5.4 Sidebar

- Largura: 260px (expandida), 72px (colapsada)
- Background: glassmorphism (blur 20px)
- Border-right: 1px solid var(--border-subtle)
- Logo: topo, padding 24px
- Nav items:
  - Padding: 12px 16px
  - Border-radius: 8px
  - Ícone: 20px (Lucide)
  - Texto: body-md
  - Hover: background rgba(255, 255, 255, 0.05)
  - Active: background com gradiente sutil, borda left 3px accent-purple
- Separadores: 1px solid var(--border-subtle), margin vertical 16px
- User section: bottom, avatar + nome + dropdown

#### 3.5.5 Tables

- Background: glassmorphism card
- Header:
  - Background: rgba(255, 255, 255, 0.03)
  - Texto: overline, text-tertiary, uppercase
  - Border-bottom: 1px solid var(--border-subtle)
- Rows:
  - Padding: 16px
  - Border-bottom: 1px solid var(--border-subtle)
  - Hover: background rgba(255, 255, 255, 0.02)
- Cells:
  - Texto: body-sm
  - Números: tabular-nums, text-align right

#### 3.5.6 Modal

- Overlay: rgba(0, 0, 0, 0.7), backdrop-filter blur(4px)
- Container:
  - Max-width: 480px (sm), 640px (md), 800px (lg)
  - Background: glassmorphism
  - Border-radius: 20px
  - Padding: 32px
- Header: heading-lg + close button
- Footer: botões alinhados à direita
- Animação: fade in + scale de 0.95 para 1

#### 3.5.7 Badges e Tags

- Padding: 4px 12px
- Border-radius: full
- Font: caption, font-weight 500

**Variantes:**
- Default: bg rgba(255,255,255,0.1), text-secondary
- Purple: bg rgba(168,85,247,0.2), text #a855f7
- Blue: bg rgba(59,130,246,0.2), text #3b82f6
- Orange: bg rgba(249,115,22,0.2), text #f97316
- Yellow: bg rgba(234,179,8,0.2), text #eab308
- Success: bg rgba(34,197,94,0.2), text #22c55e
- Error: bg rgba(239,68,68,0.2), text #ef4444

#### 3.5.8 Progress Bar

- Container: height 8px, border-radius full, bg rgba(255,255,255,0.1)
- Fill: border-radius full, transition width 500ms ease
- Variantes de cor: purple, blue, orange, yellow (gradientes)

#### 3.5.9 Empty State

- Container: centralizado, padding 64px
- Ícone: 64px, opacity 0.3
- Título: heading-md, text-primary
- Descrição: body-sm, text-tertiary
- CTA: primary button

#### 3.5.10 Alerts / Toasts

- Border-radius: 12px
- Padding: 16px
- Ícone: 20px, cor do status
- Border-left: 4px solid (cor do status)
- Background: rgba da cor com 0.1 opacity

**Toast:**
- Position: fixed, bottom-right
- Max-width: 400px
- Animação: slide in from right
- Auto-dismiss: 5s com progress bar

### 3.6 Biblioteca de Gráficos - ApexCharts

**Configuração Global**
```javascript
// apexcharts.config.js

export const apexChartsGlobalConfig = {
  chart: {
    background: 'transparent',
    fontFamily: 'Inter, sans-serif',
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true
      },
      autoSelected: 'zoom'
    },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
      animateGradually: {
        enabled: true,
        delay: 150
      },
      dynamicAnimation: {
        enabled: true,
        speed: 350
      }
    },
    dropShadow: {
      enabled: false
    }
  },
  colors: ['#a855f7', '#3b82f6', '#f97316', '#eab308', '#22c55e'],
  stroke: {
    curve: 'smooth',
    width: 2
  },
  grid: {
    borderColor: 'rgba(255, 255, 255, 0.06)',
    strokeDashArray: 4,
    xaxis: {
      lines: { show: false }
    },
    yaxis: {
      lines: { show: true }
    }
  },
  xaxis: {
    labels: {
      style: {
        colors: 'rgba(255, 255, 255, 0.5)',
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      }
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      style: {
        colors: 'rgba(255, 255, 255, 0.5)',
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      },
      formatter: (value) => formatCurrency(value)
    }
  },
  tooltip: {
    theme: 'dark',
    style: {
      fontSize: '12px',
      fontFamily: 'Inter, sans-serif'
    },
    x: { show: true },
    y: {
      formatter: (value) => formatCurrency(value)
    }
  },
  legend: {
    labels: {
      colors: 'rgba(255, 255, 255, 0.7)'
    },
    itemMargin: {
      horizontal: 16
    }
  },
  dataLabels: {
    enabled: false
  }
};
```

**Tipos de Gráficos Utilizados**

1. **Area Chart (Portfolio Evolution)**
```javascript
{
  type: 'area',
  series: [{
    name: 'Portfolio Value',
    data: [...]
  }],
  options: {
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100]
      }
    }
  }
}
```

2. **Donut Chart (Asset Allocation)**
```javascript
{
  type: 'donut',
  series: [44, 55, 13, 33],
  options: {
    labels: ['BTC', 'ETH', 'Stablecoins', 'Outros'],
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: () => '$2.5M'
            }
          }
        }
      }
    }
  }
}
```

3. **Bar Chart (Performance por Estratégia)**
```javascript
{
  type: 'bar',
  series: [{
    name: 'Rendimento',
    data: [...]
  }],
  options: {
    plotOptions: {
      bar: {
        borderRadius: 8,
        horizontal: true,
        barHeight: '60%',
        distributed: true
      }
    }
  }
}
```

4. **Candlestick (Price Charts)**
```javascript
{
  type: 'candlestick',
  options: {
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#22c55e',
          downward: '#ef4444'
        },
        wick: {
          useFillColor: true
        }
      }
    }
  }
}
```

5. **Heatmap (Correlação de Ativos)**
```javascript
{
  type: 'heatmap',
  options: {
    plotOptions: {
      heatmap: {
        colorScale: {
          ranges: [
            { from: -1, to: -0.5, color: '#ef4444' },
            { from: -0.5, to: 0, color: '#f97316' },
            { from: 0, to: 0.5, color: '#eab308' },
            { from: 0.5, to: 1, color: '#22c55e' }
          ]
        }
      }
    }
  }
}
```

6. **Radial Bar (Métricas de Risco)**
```javascript
{
  type: 'radialBar',
  series: [75],
  options: {
    plotOptions: {
      radialBar: {
        hollow: {
          size: '70%'
        },
        track: {
          background: 'rgba(255, 255, 255, 0.1)'
        },
        dataLabels: {
          name: { show: true },
          value: {
            fontSize: '24px',
            fontWeight: 600,
            color: '#ffffff'
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        colorStops: [
          { offset: 0, color: '#a855f7' },
          { offset: 100, color: '#3b82f6' }
        ]
      }
    }
  }
}
```

7. **Treemap (Exposição por Protocolo)**
```javascript
{
  type: 'treemap',
  options: {
    plotOptions: {
      treemap: {
        distributed: true,
        enableShades: false
      }
    },
    colors: ['#a855f7', '#3b82f6', '#f97316', '#eab308', '#22c55e']
  }
}
```

---

## 4. ARQUITETURA DO PROJETO

### 4.1 Visão Geral da Estrutura

```
interconection-treasury/
├── frontend/                    # Aplicação Next.js
├── backend/                     # API FastAPI
├── database/                    # Scripts e migrations
├── docs/                        # Documentação
├── scripts/                     # Scripts utilitários
├── .github/                     # GitHub Actions
├── .env.example
├── README.md
└── CLAUDE.md                    # Instruções para desenvolvimento
```

### 4.2 Estrutura Frontend (Next.js)

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   ├── logo-icon.svg
│   └── images/
│       └── empty-states/
│
├── src/
│   ├── app/                          # App Router (Next.js 14)
│   │   ├── (auth)/                   # Grupo de rotas autenticação
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/              # Grupo de rotas dashboard
│   │   │   ├── layout.tsx            # Layout com sidebar
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   │
│   │   │   ├── portfolio/
│   │   │   │   ├── page.tsx          # Visão geral portfolio
│   │   │   │   └── [assetId]/
│   │   │   │       └── page.tsx      # Detalhe do ativo
│   │   │   │
│   │   │   ├── positions/
│   │   │   │   ├── page.tsx          # Lista de posições
│   │   │   │   ├── exchanges/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── wallets/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── defi/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── staking/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   ├── page.tsx          # Overview analytics
│   │   │   │   ├── performance/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── risk/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── reports/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── strategies/
│   │   │   │   ├── page.tsx          # Lista estratégias
│   │   │   │   └── [strategyId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── alerts/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── integrations/
│   │   │   │   ├── page.tsx          # Lista de integrações
│   │   │   │   ├── exchanges/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── wallets/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── protocols/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── profile/
│   │   │       │   └── page.tsx
│   │   │       ├── team/
│   │   │       │   └── page.tsx
│   │   │       ├── security/
│   │   │       │   └── page.tsx
│   │   │       ├── notifications/
│   │   │       │   └── page.tsx
│   │   │       └── billing/
│   │   │           └── page.tsx
│   │   │
│   │   ├── api/                      # API Routes (se necessário)
│   │   │   └── [...]/
│   │   │
│   │   ├── globals.css
│   │   ├── layout.tsx                # Root layout
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                       # Componentes base UI
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── dropdown.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── spinner.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── accordion.tsx
│   │   │   ├── table.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── date-picker.tsx
│   │   │   ├── search.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/                   # Componentes de layout
│   │   │   ├── sidebar/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── sidebar-item.tsx
│   │   │   │   ├── sidebar-group.tsx
│   │   │   │   └── index.ts
│   │   │   ├── header/
│   │   │   │   ├── header.tsx
│   │   │   │   ├── user-menu.tsx
│   │   │   │   ├── notifications.tsx
│   │   │   │   └── index.ts
│   │   │   ├── page-header.tsx
│   │   │   ├── page-container.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── charts/                   # Componentes de gráficos
│   │   │   ├── area-chart.tsx
│   │   │   ├── donut-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── candlestick-chart.tsx
│   │   │   ├── heatmap-chart.tsx
│   │   │   ├── radial-chart.tsx
│   │   │   ├── treemap-chart.tsx
│   │   │   ├── line-chart.tsx
│   │   │   ├── chart-container.tsx
│   │   │   ├── chart-legend.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── cards/                    # Cards especializados
│   │   │   ├── stat-card.tsx
│   │   │   ├── asset-card.tsx
│   │   │   ├── position-card.tsx
│   │   │   ├── strategy-card.tsx
│   │   │   ├── alert-card.tsx
│   │   │   ├── integration-card.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── tables/                   # Tabelas especializadas
│   │   │   ├── positions-table.tsx
│   │   │   ├── transactions-table.tsx
│   │   │   ├── assets-table.tsx
│   │   │   ├── alerts-table.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── forms/                    # Formulários
│   │   │   ├── add-exchange-form.tsx
│   │   │   ├── add-wallet-form.tsx
│   │   │   ├── create-alert-form.tsx
│   │   │   ├── settings-form.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── modals/                   # Modais
│   │   │   ├── add-integration-modal.tsx
│   │   │   ├── create-alert-modal.tsx
│   │   │   ├── confirm-modal.tsx
│   │   │   ├── export-modal.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── dashboard/                # Componentes específicos dashboard
│   │   │   ├── portfolio-overview.tsx
│   │   │   ├── recent-activity.tsx
│   │   │   ├── quick-stats.tsx
│   │   │   ├── active-strategies.tsx
│   │   │   ├── pending-alerts.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── portfolio/                # Componentes portfolio
│   │   │   ├── asset-allocation.tsx
│   │   │   ├── portfolio-chart.tsx
│   │   │   ├── asset-list.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── analytics/                # Componentes analytics
│   │   │   ├── performance-chart.tsx
│   │   │   ├── risk-metrics.tsx
│   │   │   ├── drawdown-chart.tsx
│   │   │   ├── correlation-matrix.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── shared/                   # Componentes compartilhados
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       ├── loading-state.tsx
│   │       ├── currency-display.tsx
│   │       ├── percent-change.tsx
│   │       ├── crypto-icon.tsx
│   │       └── index.ts
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── use-auth.ts
│   │   ├── use-portfolio.ts
│   │   ├── use-positions.ts
│   │   ├── use-analytics.ts
│   │   ├── use-websocket.ts
│   │   ├── use-toast.ts
│   │   ├── use-modal.ts
│   │   ├── use-theme.ts
│   │   ├── use-debounce.ts
│   │   ├── use-local-storage.ts
│   │   └── index.ts
│   │
│   ├── lib/                          # Utilitários e configurações
│   │   ├── api/
│   │   │   ├── client.ts             # Axios instance
│   │   │   ├── endpoints.ts
│   │   │   ├── portfolio.ts
│   │   │   ├── positions.ts
│   │   │   ├── analytics.ts
│   │   │   ├── integrations.ts
│   │   │   ├── alerts.ts
│   │   │   ├── auth.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── format.ts             # Formatação números/datas
│   │   │   ├── currency.ts           # Formatação moedas
│   │   │   ├── date.ts               # Manipulação datas
│   │   │   ├── validation.ts         # Validações
│   │   │   ├── cn.ts                 # Class name merger
│   │   │   └── index.ts
│   │   │
│   │   ├── charts/
│   │   │   ├── config.ts             # ApexCharts config global
│   │   │   ├── themes.ts             # Temas de gráficos
│   │   │   └── index.ts
│   │   │
│   │   └── constants/
│   │       ├── routes.ts
│   │       ├── crypto.ts             # Lista de criptos
│   │       ├── exchanges.ts          # Lista de exchanges
│   │       ├── protocols.ts          # Lista de protocolos DeFi
│   │       └── index.ts
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── auth-store.ts
│   │   ├── portfolio-store.ts
│   │   ├── ui-store.ts
│   │   ├── notifications-store.ts
│   │   └── index.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── api.ts
│   │   ├── portfolio.ts
│   │   ├── position.ts
│   │   ├── asset.ts
│   │   ├── transaction.ts
│   │   ├── analytics.ts
│   │   ├── alert.ts
│   │   ├── integration.ts
│   │   ├── user.ts
│   │   └── index.ts
│   │
│   ├── styles/
│   │   ├── design-tokens.css         # Variáveis CSS
│   │   └── components.css            # Estilos base componentes
│   │
│   └── providers/
│       ├── query-provider.tsx        # React Query
│       ├── theme-provider.tsx
│       ├── toast-provider.tsx
│       └── index.tsx
│
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── package.json
```

### 4.3 Estrutura Backend (FastAPI)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                       # Entry point FastAPI
│   ├── config.py                     # Configurações
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                   # Dependencies (auth, db)
│   │   │
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py             # Router principal v1
│   │       │
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── auth.py
│   │           ├── users.py
│   │           ├── portfolio.py
│   │           ├── positions.py
│   │           ├── assets.py
│   │           ├── transactions.py
│   │           ├── analytics.py
│   │           ├── alerts.py
│   │           ├── integrations.py
│   │           ├── exchanges.py
│   │           ├── wallets.py
│   │           ├── protocols.py
│   │           ├── strategies.py
│   │           ├── reports.py
│   │           └── webhooks.py
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                 # Settings Pydantic
│   │   ├── security.py               # JWT, hashing
│   │   ├── exceptions.py             # Custom exceptions
│   │   └── logging.py                # Logging config
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py                # Database session
│   │   ├── base.py                   # Base model
│   │   └── init_db.py                # Inicialização DB
│   │
│   ├── models/                       # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── portfolio.py
│   │   ├── position.py
│   │   ├── asset.py
│   │   ├── transaction.py
│   │   ├── integration.py
│   │   ├── exchange_account.py
│   │   ├── wallet.py
│   │   ├── protocol_position.py
│   │   ├── alert.py
│   │   ├── strategy.py
│   │   ├── report.py
│   │   └── audit_log.py
│   │
│   ├── schemas/                      # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── auth.py
│   │   ├── portfolio.py
│   │   ├── position.py
│   │   ├── asset.py
│   │   ├── transaction.py
│   │   ├── analytics.py
│   │   ├── alert.py
│   │   ├── integration.py
│   │   ├── strategy.py
│   │   └── report.py
│   │
│   ├── services/                     # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── portfolio_service.py
│   │   ├── position_service.py
│   │   ├── analytics_service.py
│   │   ├── alert_service.py
│   │   ├── integration_service.py
│   │   ├── aggregation_service.py
│   │   ├── report_service.py
│   │   └── notification_service.py
│   │
│   ├── integrations/                 # Integrações externas
│   │   ├── __init__.py
│   │   ├── base.py                   # Base integration class
│   │   │
│   │   ├── exchanges/
│   │   │   ├── __init__.py
│   │   │   ├── base_exchange.py
│   │   │   ├── binance.py
│   │   │   ├── coinbase.py
│   │   │   ├── kraken.py
│   │   │   ├── okx.py
│   │   │   └── bybit.py
│   │   │
│   │   ├── wallets/
│   │   │   ├── __init__.py
│   │   │   ├── base_wallet.py
│   │   │   ├── ethereum.py
│   │   │   ├── bitcoin.py
│   │   │   ├── solana.py
│   │   │   └── multichain.py
│   │   │
│   │   ├── defi/
│   │   │   ├── __init__.py
│   │   │   ├── base_protocol.py
│   │   │   ├── aave.py
│   │   │   ├── uniswap.py
│   │   │   ├── curve.py
│   │   │   ├── lido.py
│   │   │   ├── compound.py
│   │   │   └── gmx.py
│   │   │
│   │   └── pricing/
│   │       ├── __init__.py
│   │       ├── coingecko.py
│   │       └── chainlink.py
│   │
│   ├── workers/                      # Background tasks (Celery)
│   │   ├── __init__.py
│   │   ├── celery_app.py
│   │   ├── tasks/
│   │   │   ├── __init__.py
│   │   │   ├── sync_positions.py
│   │   │   ├── update_prices.py
│   │   │   ├── check_alerts.py
│   │   │   ├── generate_reports.py
│   │   │   └── cleanup.py
│   │   └── schedules.py
│   │
│   ├── websocket/                    # WebSocket handlers
│   │   ├── __init__.py
│   │   ├── manager.py
│   │   ├── handlers.py
│   │   └── events.py
│   │
│   └── utils/
│       ├── __init__.py
│       ├── crypto.py                 # Encryption utils
│       ├── formatting.py
│       └── calculations.py           # Métricas financeiras
│
├── alembic/                          # Migrations
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_api/
│   ├── test_services/
│   └── test_integrations/
│
├── .env
├── .env.example
├── requirements.txt
└── requirements-dev.txt
```

### 4.4 Estrutura Database

```
database/
├── migrations/                       # Migrations SQL (backup)
│   ├── 001_initial_schema.sql
│   ├── 002_add_integrations.sql
│   └── ...
│
├── seeds/
│   ├── exchanges.sql
│   ├── protocols.sql
│   ├── assets.sql
│   └── demo_data.sql
│
├── schemas/
│   └── schema.sql                    # Schema completo
│
└── scripts/
    ├── backup.sh
    ├── restore.sh
    └── init.sh
```

---

## 5. FUNCIONALIDADES DETALHADAS

### 5.1 Fase 1 - MVP Frontend (Meses 1-4)

#### 5.1.1 Módulo de Autenticação

**Login**
- Email + senha com validação
- "Lembrar-me" com token persistente
- Link "Esqueci minha senha"
- Integração futura com SSO/OAuth
- Rate limiting de tentativas

**Registro (interno apenas na Fase 1)**
- Nome, email, senha
- Confirmação de email
- Termos de uso

**Recuperação de Senha**
- Envio de link por email
- Token com expiração (1h)
- Nova senha com confirmação

**Segurança**
- JWT com refresh token
- Sessão com timeout configurável
- Log de acessos

#### 5.1.2 Dashboard Principal

**Overview Cards**

| Card | Métricas | Atualização |
|------|----------|-------------|
| Total Portfolio | Valor total em USD, variação 24h | Real-time |
| P&L Diário | Lucro/prejuízo do dia, % | Real-time |
| P&L Mensal | Lucro/prejuízo do mês, % | Real-time |
| Yield Médio | APY médio ponderado | Diário |

**Gráfico de Evolução Patrimonial**
- Area chart com histórico do portfolio
- Períodos: 24h, 7d, 30d, 90d, 1y, All
- Tooltip com valor e data
- Linha de base (inicial)

**Alocação de Ativos**
- Donut chart com distribuição
- Por tipo: BTC, ETH, Stablecoins, Altcoins, DeFi
- Por localização: Exchanges, Wallets, DeFi
- Click para filtrar tabela

**Atividade Recente**
- Lista das últimas 10 transações
- Tipo, ativo, valor, timestamp
- Status (confirmado, pendente)
- Link para detalhes

**Alertas Pendentes**
- Top 5 alertas ativos
- Prioridade visual (cor)
- Ação rápida (dismiss, ver)

**Estratégias Ativas**
- Cards das estratégias em execução
- Performance atual
- Status (ativo, pausado)

#### 5.1.3 Módulo de Posições

**Visão Consolidada**
- Tabela com todas as posições
- Colunas: Ativo, Quantidade, Preço, Valor, P&L, Localização
- Filtros: tipo de ativo, localização, performance
- Ordenação por qualquer coluna
- Busca por nome/símbolo

**Por Exchange**
- Agrupamento por exchange conectada
- Saldos spot, margin, futures
- API status (conectado, erro, sincronizando)
- Última sincronização

**Por Wallet**
- Lista de wallets conectadas
- Saldo por chain (ETH, BTC, SOL, etc.)
- Tokens e NFTs
- Histórico de transações

**Por Protocolo DeFi**
- Posições em lending (Aave, Compound)
- Posições em liquidity pools (Uniswap, Curve)
- Posições em staking (Lido, etc.)
- Rewards pendentes
- Health factor (se aplicável)

**Detalhe do Ativo**
- Preço atual + histórico
- Todas as posições do ativo
- Transações do ativo
- Métricas: preço médio, P&L total

#### 5.1.4 Módulo de Portfolio

**Visão Geral**
- Valor total do portfolio
- Gráfico de evolução
- Distribuição por categoria
- Top holdings

**Análise de Alocação**
- Treemap de exposição
- Por ativo
- Por setor (DeFi, L1, L2, etc.)
- Por chain
- Por tipo (spot, lending, LP, staking)

**Histórico de Snapshots**
- Snapshots diários automáticos
- Comparação entre períodos
- Mudanças de alocação ao longo do tempo

#### 5.1.5 Módulo de Analytics

**Performance**
- Retorno absoluto e percentual
- Por período (diário, semanal, mensal, anual)
- Por ativo/estratégia
- Benchmark comparison (BTC, ETH, S&P500)
- Gráfico de performance cumulativa

**Métricas de Risco**

| Métrica | Descrição | Visualização |
|---------|-----------|--------------|
| VaR (95%) | Value at Risk | Gauge chart |
| Drawdown | Máxima queda do pico | Line chart |
| Volatilidade | Desvio padrão dos retornos | Bar chart |
| Sharpe Ratio | Retorno ajustado ao risco | KPI card |
| Sortino Ratio | Sharpe com downside | KPI card |

**Correlação**
- Matriz de correlação entre ativos
- Heatmap interativo
- Período configurável

**P&L Analysis**
- P&L realizado vs não realizado
- Por ativo, exchange, estratégia
- Breakdown de fees pagos

#### 5.1.6 Módulo de Alertas

**Tipos de Alertas**

| Tipo | Descrição |
|------|-----------|
| Preço | Ativo atinge preço alvo |
| Variação % | Ativo varia X% em período |
| Valor Portfolio | Portfolio atinge valor |
| Drawdown | Drawdown excede limite |
| Health Factor | HF abaixo de threshold |
| Yield | APY cai abaixo de limite |
| Posição | Posição expira ou precisa ação |

**Configuração de Alerta**
- Condição (maior que, menor que, igual)
- Valor/percentual
- Canais (in-app, email, webhook)
- Frequência (uma vez, recorrente)
- Expiração

**Centro de Alertas**
- Lista de alertas ativos
- Histórico de alertas disparados
- Estatísticas de alertas

#### 5.1.7 Módulo de Integrações

**Exchanges**
- Binance, Coinbase, Kraken, OKX, Bybit
- Conexão via API key + secret
- Permissões: read-only (fase 1)
- Status de conexão
- Última sincronização
- Log de erros

**Wallets**
- Adição por endereço público
- Chains suportadas: Ethereum, Bitcoin, Solana, Polygon, Arbitrum, Optimism
- Detecção automática de tokens
- Labeling de wallets

**Protocolos DeFi**
- Aave, Compound, Uniswap, Curve, Lido
- Detecção automática de posições
- APY atual
- Rewards pendentes

**Interface de Conexão**
- Wizard step-by-step
- Validação de API keys
- Teste de conexão
- Confirmação de permissões

#### 5.1.8 Módulo de Configurações

**Perfil**
- Dados pessoais
- Foto de perfil
- Timezone
- Moeda de exibição (USD, BRL, EUR)

**Segurança**
- Alterar senha
- 2FA (TOTP)
- Sessões ativas
- Log de atividades

**Notificações**
- Preferências por canal
- Frequência de digest
- Tipos de notificação

**Aparência**
- Tema (escuro/claro/sistema)
- Formato de números
- Idioma

#### 5.1.9 Componentes Real-time

**WebSocket Events**

| Evento | Descrição |
|--------|-----------|
| price_update | Atualização de preço |
| position_update | Mudança em posição |
| alert_triggered | Alerta disparado |
| sync_complete | Sincronização concluída |
| sync_error | Erro de sincronização |

**Indicadores Visuais**
- Pulse animation em dados atualizando
- Badge de notificação no header
- Toast para eventos importantes
- Status de conexão WebSocket

### 5.2 Fase 2 - Analytics Avançado (Meses 5-8)

#### 5.2.1 Risk Management Avançado
- Simulação de cenários (stress test)
- Análise de sensibilidade
- Exposição por fator de risco
- Limite de risco configurável
- Alertas automáticos de limite

#### 5.2.2 Relatórios Automatizados
- Relatório diário/semanal/mensal
- Templates customizáveis
- Export PDF/Excel
- Agendamento de envio
- Relatório de auditoria

#### 5.2.3 Histórico e Auditoria
- Log completo de transações
- Trilha de auditoria
- Reconciliação de posições
- Detecção de discrepâncias

#### 5.2.4 Métricas Avançadas
- Attribution analysis
- Factor decomposition
- Rolling metrics
- Benchmark tracking

### 5.3 Fase 3 - Multi-Tenant (Meses 9-12)

#### 5.3.1 Gestão de Organizações
- Criação de organização
- Configurações por organização
- Branding customizado (logo, cores)
- Domínio customizado

#### 5.3.2 Gestão de Usuários
- Convite de membros
- Roles e permissões
- Grupos de acesso
- SSO/SAML

#### 5.3.3 Isolamento de Dados
- Segregação completa por tenant
- Encryption por tenant
- Backup independente

#### 5.3.4 Billing
- Planos e pricing
- Usage tracking
- Invoices
- Payment integration (Stripe)

#### 5.3.5 Onboarding Self-Service
- Signup flow
- Wizard de configuração
- Templates pré-configurados
- Documentação in-app

### 5.4 Fase 4 - Execução (Ano 2)

#### 5.4.1 Trade Execution
- Interface de trading
- Order types (market, limit, stop)
- Roteamento inteligente
- Confirmação em 2 etapas

#### 5.4.2 Rebalanceamento
- Targets de alocação
- Rebalanceamento automático
- Simulação antes de executar
- Thresholds configuráveis

#### 5.4.3 Estratégias Automatizadas
- Yield farming automatizado
- DCA (Dollar Cost Averaging)
- Grid trading
- Estratégias customizadas

#### 5.4.4 Smart Approvals
- Workflow de aprovação
- Limites por usuário
- Multi-sig para valores altos
- Audit trail completo

---

## 6. MODELOS DE DADOS

### 6.1 Entidades Principais

```
User
- id: UUID
- email: string
- password_hash: string
- name: string
- avatar_url: string?
- organization_id: UUID (FK)
- role: enum (admin, manager, viewer)
- timezone: string
- currency: string
- is_active: boolean
- email_verified: boolean
- two_factor_enabled: boolean
- created_at: timestamp
- updated_at: timestamp
- last_login_at: timestamp

Organization
- id: UUID
- name: string
- slug: string
- logo_url: string?
- settings: jsonb
- plan: enum (free, pro, enterprise)
- created_at: timestamp
- updated_at: timestamp

Integration
- id: UUID
- organization_id: UUID (FK)
- type: enum (exchange, wallet, protocol)
- provider: string
- name: string
- credentials: encrypted jsonb
- status: enum (active, error, disconnected)
- last_sync_at: timestamp
- error_message: string?
- created_at: timestamp
- updated_at: timestamp

Position
- id: UUID
- organization_id: UUID (FK)
- integration_id: UUID (FK)
- asset_id: UUID (FK)
- type: enum (spot, lending, lp, staking, margin)
- quantity: decimal
- entry_price: decimal?
- current_value_usd: decimal
- unrealized_pnl: decimal
- apy: decimal?
- metadata: jsonb
- created_at: timestamp
- updated_at: timestamp

Asset
- id: UUID
- symbol: string
- name: string
- coingecko_id: string
- logo_url: string
- decimals: int
- chain: string?
- contract_address: string?
- current_price_usd: decimal
- price_change_24h: decimal
- market_cap: decimal?
- created_at: timestamp
- updated_at: timestamp

Transaction
- id: UUID
- organization_id: UUID (FK)
- integration_id: UUID (FK)
- asset_id: UUID (FK)
- type: enum (buy, sell, transfer, deposit, withdraw, swap, stake, unstake, claim, fee)
- quantity: decimal
- price_usd: decimal
- total_usd: decimal
- fee_usd: decimal?
- tx_hash: string?
- timestamp: timestamp
- metadata: jsonb
- created_at: timestamp

Alert
- id: UUID
- organization_id: UUID (FK)
- user_id: UUID (FK)
- name: string
- type: enum (price, portfolio_value, drawdown, health_factor, yield, custom)
- condition: jsonb
- channels: jsonb
- is_active: boolean
- triggered_count: int
- last_triggered_at: timestamp?
- created_at: timestamp
- updated_at: timestamp

PortfolioSnapshot
- id: UUID
- organization_id: UUID (FK)
- timestamp: timestamp
- total_value_usd: decimal
- positions_snapshot: jsonb
- allocations: jsonb
- metrics: jsonb

Strategy
- id: UUID
- organization_id: UUID (FK)
- name: string
- description: string
- type: enum (yield_farming, liquidity_provision, staking, lending, custom)
- status: enum (active, paused, completed)
- config: jsonb
- performance: jsonb
- created_at: timestamp
- updated_at: timestamp

AuditLog
- id: UUID
- organization_id: UUID (FK)
- user_id: UUID (FK)
- action: string
- entity_type: string
- entity_id: UUID
- old_values: jsonb?
- new_values: jsonb?
- ip_address: string
- user_agent: string
- created_at: timestamp
```

---

## 7. APIs

### 7.1 Endpoints REST (v1)

**Auth**
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/register
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/verify-email
```

**Users**
```
GET    /api/v1/users/me
PATCH  /api/v1/users/me
PUT    /api/v1/users/me/password
GET    /api/v1/users/me/sessions
DELETE /api/v1/users/me/sessions/:id
```

**Portfolio**
```
GET    /api/v1/portfolio
GET    /api/v1/portfolio/summary
GET    /api/v1/portfolio/allocation
GET    /api/v1/portfolio/history
GET    /api/v1/portfolio/snapshots
```

**Positions**
```
GET    /api/v1/positions
GET    /api/v1/positions/:id
GET    /api/v1/positions/by-exchange
GET    /api/v1/positions/by-wallet
GET    /api/v1/positions/by-protocol
```

**Assets**
```
GET    /api/v1/assets
GET    /api/v1/assets/:id
GET    /api/v1/assets/:id/price-history
GET    /api/v1/assets/:id/positions
```

**Transactions**
```
GET    /api/v1/transactions
GET    /api/v1/transactions/:id
GET    /api/v1/transactions/export
```

**Analytics**
```
GET    /api/v1/analytics/performance
GET    /api/v1/analytics/risk
GET    /api/v1/analytics/pnl
GET    /api/v1/analytics/correlation
```

**Integrations**
```
GET    /api/v1/integrations
POST   /api/v1/integrations
GET    /api/v1/integrations/:id
DELETE /api/v1/integrations/:id
POST   /api/v1/integrations/:id/sync
GET    /api/v1/integrations/:id/status
```

**Alerts**
```
GET    /api/v1/alerts
POST   /api/v1/alerts
GET    /api/v1/alerts/:id
PATCH  /api/v1/alerts/:id
DELETE /api/v1/alerts/:id
GET    /api/v1/alerts/history
```

**Reports**
```
GET    /api/v1/reports
POST   /api/v1/reports/generate
GET    /api/v1/reports/:id
GET    /api/v1/reports/:id/download
```

### 7.2 WebSocket Events

**Client → Server**
```
subscribe:prices       - Subscrever atualizações de preço
subscribe:portfolio    - Subscrever atualizações de portfolio
subscribe:alerts       - Subscrever alertas
unsubscribe:*          - Cancelar subscrição
ping                   - Keep-alive
```

**Server → Client**
```
price:update           - Atualização de preço de ativo
portfolio:update       - Atualização de valor do portfolio
position:update        - Atualização de posição específica
alert:triggered        - Alerta disparado
sync:started           - Sincronização iniciada
sync:completed         - Sincronização concluída
sync:error             - Erro de sincronização
notification           - Notificação genérica
pong                   - Resposta keep-alive
```

---

## 8. ROADMAP VISUAL

```
ANO 1 ═══════════════════════════════════════════════════════════════════

Fase 1: MVP Frontend     Fase 2: Analytics      Fase 3: Multi-Tenant
    (Meses 1-4)            (Meses 5-8)            (Meses 9-12)
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ✓ Auth/Login        │ │ ✓ Risk Avançado │ │ ✓ Organizations │
│ ✓ Dashboard         │ │ ✓ Relatórios    │ │ ✓ User Mgmt     │
│ ✓ Posições          │ │ ✓ Auditoria     │ │ ✓ Permissions   │
│ ✓ Portfolio         │ │ ✓ Métricas+     │ │ ✓ Billing       │
│ ✓ Analytics Básico  │ │                 │ │ ✓ Onboarding    │
│ ✓ Alertas           │ │                 │ │                 │
│ ✓ Integrações       │ │                 │ │                 │
│ ✓ Settings          │ │                 │ │                 │
└─────────────────────┘ └─────────────────┘ └─────────────────┘
         │                      │                    │
         ▼                      ▼                    ▼
    [Dogfooding]          [Beta Clientes]      [Launch B2B]

ANO 2 ═══════════════════════════════════════════════════════════════════

               Fase 4: Execução (Meses 13-18+)
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Trade Execution                                               │
│ ✓ Rebalanceamento Automático                                    │
│ ✓ Estratégias Automatizadas                                     │
│ ✓ Smart Approvals / Multi-sig                                   │
│ ✓ API Pública                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. MÉTRICAS DE SUCESSO

### Fase 1 (MVP)

| Métrica | Target |
|---------|--------|
| Integrações funcionando | 3 exchanges + 2 protocolos |
| Latência do dashboard | < 2s load inicial |
| Precisão de dados | 99.9% vs dados reais |
| Uptime | 99.5% |

### Fase 2 (Analytics)

| Métrica | Target |
|---------|--------|
| Relatórios gerados | < 30s para gerar |
| Métricas calculadas | 100% precisão |
| Histórico disponível | 1 ano retroativo |

### Fase 3 (Multi-Tenant)

| Métrica | Target |
|---------|--------|
| Clientes beta | 3-5 |
| Onboarding time | < 1 hora |
| NPS | > 40 |

---

## 10. CONSIDERAÇÕES FINAIS

### Prioridades Fase 1
1. **UX impecável** - Dashboard fluido, dados claros
2. **Confiabilidade** - Dados precisos, sincronização estável
3. **Performance** - Load rápido, atualizações real-time
4. **Segurança** - Auth robusto, dados encriptados

### Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| APIs de exchanges instáveis | Alta | Alto | Retry logic, fallbacks |
| Complexidade DeFi | Média | Alto | Começar com protocolos principais |
| Performance com muitos dados | Média | Médio | Paginação, lazy loading |
| Segurança de credentials | Baixa | Crítico | Encryption, key rotation |

### Próximos Passos Imediatos
1. Setup do repositório e ambiente de desenvolvimento
2. Implementação do Design System no Tailwind
3. Criação dos componentes base UI
4. Layout principal (sidebar + header)
5. Primeira página funcional (Dashboard com mocks)

---

**Documento criado em:** Janeiro 2026
**Versão:** 1.0
**Autor:** Equipe de Produto
**Próxima revisão:** Após Fase 1
