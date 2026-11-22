# SmileClinic — Sistema de Gestão Odontológica

Projeto Integrador (SENAC 2026). O sistema reúne duas frentes integradas a uma única API REST em Python:

- **Landing page** (`Front-End/index.html`) para o paciente enviar pedidos de pré-agendamento.
- **Sistema interno da clínica** (`Front-End/painel/`) para recepção, equipe clínica e gestão: login com JWT, agenda (Lista, Dia e Semana), conversão de pré-agendamentos, cadastro de pacientes e equipe, prontuário eletrônico completo (evolução clínica, anamnese, odontograma FDI, plano de tratamento e documentos), módulo financeiro, dashboard gerencial com gráfico de 6 meses e exportação CSV, configurações da unidade e modo noturno.

## Stack

- **Front-end:** HTML5, CSS3 (identidade monocromática com tema claro/escuro e animações 60fps) e JavaScript puro (sem etapa de build), responsivo para computador, tablet e celular.
- **Back-end:** Python 3.12+, FastAPI, Pydantic, SQLAlchemy 2.0 assíncrono e SQLite (`aiosqlite`), pronto para PostgreSQL via `DATABASE_URL`.
- **Segurança:** Hash de senha PBKDF2-SHA256 (600.000 iterações) e autenticação Bearer JWT (HS256) nas rotas internas.
- **Qualidade:** `uv`, `pytest` (50 testes), `ruff` e `pyrefly`.
- **Deploy:** `vercel.json` configurado com Vercel Services (Front-End estático + FastAPI em `/api` com banco de demonstração auto-populado em `/tmp/poc.db`).

## Estrutura de pastas

```text
.
├── vercel.json               # Deploy unificado (Front-End + API FastAPI em /api)
├── Back-End/
│   ├── main.py               # Aplicação FastAPI, lifespan e registro de controllers
│   ├── controllers/          # Um controller por domínio
│   │   ├── dentistas.py      # CRUD de equipe + /auth/login (JWT)
│   │   ├── pacientes.py      # Cadastro, busca, nascimento e anamnese
│   │   ├── consultas.py      # Agenda (dia/intervalo/busca) + /consultas/{id}/faturar
│   │   ├── evolucoes.py      # Fichas estruturadas de evolução clínica
│   │   ├── prontuarios.py    # Odontograma FDI (vinculável à evolução)
│   │   ├── tratamentos.py    # Planos de tratamento e documentos clínicos
│   │   ├── financeiro.py     # Receitas, contas a receber e despesas
│   │   ├── dashboard.py      # Indicadores, série de 6 meses e exportação CSV
│   │   ├── solicitacoes.py   # Pré-agendamentos vindos da landing page
│   │   └── configuracoes.py  # Parâmetros gerais da unidade
│   ├── models.py             # Entidades SQLAlchemy
│   ├── schemas.py            # Contratos e validações Pydantic
│   ├── enums.py              # Domínios de status e tipos
│   ├── database.py           # Engine assíncrona e migração leve de colunas
│   ├── security.py           # PBKDF2-SHA256 + JWT HS256
│   ├── seed.py               # Dados de demonstração completos
│   └── tests/                # 50 testes automatizados (pytest + httpx)
├── Front-End/
│   ├── index.html            # Landing page (pré-agendamento)
│   └── painel/               # Sistema interno da clínica
│       ├── login.html
│       ├── agenda.html       # Lista, Dia, Semana, pré-agendamentos e faturamento
│       ├── pacientes.html
│       ├── prontuario.html   # Evolução, Anamnese, Odontograma FDI, Plano e Documentos
│       ├── financeiro.html
│       ├── dashboard.html    # KPIs, caixa, indicadores, gráfico 6 meses e CSV
│       ├── dentistas.html
│       ├── configuracoes.html
│       ├── ajuda.html
│       ├── theme.js / core.js / painel.js / painel.css
└── docs/
    ├── der.png / der.drawio
    ├── modelo-de-dados.md
    └── tecnologias.md
```

## Como executar localmente

### 1. Back-end (porta 3000)

```bash
cd Back-End
uv run python seed.py
uv run uvicorn main:app --port 3000 --reload
```

- API: http://127.0.0.1:3000
- Documentação OpenAPI: http://127.0.0.1:3000/docs

### 2. Front-end (porta 5500)

Abra `Front-End/painel/login.html` com Live Server ou rode:

```bash
uv run --project Back-End python -m http.server 5500 --directory Front-End
```

- Sistema interno: http://127.0.0.1:5500/painel/login.html
- Landing page: http://127.0.0.1:5500/index.html
- Login de demonstração: `ana@smileclinic.com` / `smile2026`

## Testes e qualidade

```bash
cd Back-End
uv run ruff format --check .
uv run ruff check .
uv run pyrefly check
uv run pytest
```
