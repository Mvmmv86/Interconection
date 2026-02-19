# Interconection Backend

Backend API para a plataforma Interconection Treasury MGMT.

## Stack

- **Framework:** FastAPI 0.109+
- **Python:** 3.11+
- **ORM:** SQLAlchemy 2.0+ (async)
- **Migrations:** Alembic
- **Validação:** Pydantic 2.5+
- **Database:** PostgreSQL 15+
- **Cache:** Redis
- **Background Tasks:** Celery

## Setup

### 1. Criar ambiente virtual

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Instalar dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 4. Criar banco de dados

```bash
# PostgreSQL
createdb interconection
```

### 5. Executar migrations

```bash
alembic upgrade head
```

### 6. Rodar servidor

```bash
uvicorn app.main:app --reload --port 8002
```

## Estrutura

```
backend/
├── alembic/              # Migrations
├── app/
│   ├── api/              # Endpoints
│   │   └── v1/
│   │       └── endpoints/
│   ├── core/             # Config, security
│   ├── db/               # Database session
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── integrations/     # External APIs
│   ├── calculations/     # Financial calcs
│   ├── workers/          # Celery tasks
│   └── websocket/        # WS handlers
├── tests/
├── requirements.txt
└── .env.example
```

## API Docs

- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc

## Endpoints

### Auth
- `POST /api/v1/auth/register` - Registrar
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token

### Clients
- `GET /api/v1/clients` - Listar
- `POST /api/v1/clients` - Criar
- `GET /api/v1/clients/{id}` - Buscar
- `PATCH /api/v1/clients/{id}` - Atualizar
- `DELETE /api/v1/clients/{id}` - Deletar

### Wallets
- `GET /api/v1/clients/{id}/wallets` - Listar
- `POST /api/v1/clients/{id}/wallets` - Adicionar
- `POST /api/v1/clients/{id}/wallets/{id}/scan` - Escanear

### Exchanges
- `GET /api/v1/clients/{id}/exchanges` - Listar
- `POST /api/v1/clients/{id}/exchanges` - Conectar
- `POST /api/v1/clients/{id}/exchanges/{id}/sync` - Sincronizar

### Portfolio
- `GET /api/v1/portfolio/summary` - Resumo
- `GET /api/v1/portfolio/allocation` - Alocação
- `GET /api/v1/portfolio/history` - Histórico

### Positions
- `GET /api/v1/positions` - Listar
- `GET /api/v1/positions/summary` - Resumo
- `GET /api/v1/positions/staking` - Staking
- `GET /api/v1/positions/lp` - LP

### Analytics
- `GET /api/v1/analytics/performance` - Performance
- `GET /api/v1/analytics/risk` - Risco
- `GET /api/v1/analytics/pnl` - P&L
- `GET /api/v1/analytics/yield` - Yield

### Alerts
- `GET /api/v1/alerts` - Listar
- `POST /api/v1/alerts` - Criar
- `POST /api/v1/alerts/{id}/test` - Testar

## Testes

```bash
pytest tests/ -v
```

## Lint

```bash
ruff check .
black --check .
mypy app/
```
