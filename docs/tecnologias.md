# Back-end e Tecnologias — SmileClinic

## Arquitetura

A API REST do SmileClinic é construída em Python com FastAPI em arquitetura de camadas:

| Camada | Arquivo(s) | Responsabilidade |
|---|---|---|
| Controllers | `controllers/*.py` | Rotas HTTP, regras de negócio, faturamento de consultas e agregação do dashboard. |
| Schemas | `schemas.py` | Validação de entrada e serialização de saída com Pydantic. |
| Models | `models.py` | Mapeamento objeto-relacional (SQLAlchemy 2.0 assíncrono). |
| Banco de dados | `database.py` | Engine assíncrona (`aiosqlite`), `PRAGMA foreign_keys=ON` e migração leve de colunas. |
| Segurança | `security.py` | Hash PBKDF2-SHA256 (600.000 iterações) e autenticação stateless por JWT HS256. |

## Segurança e autenticação

- **Rotas públicas:** `GET /health`, `POST /auth/login` e `POST /solicitacoes` (landing page).
- **Rotas internas protegidas:** exigem cabeçalho `Authorization: Bearer <token>` emitido pelo `/auth/login`, com validação de assinatura HMAC-SHA256 e expiração configurável via `JWT_SECRET` e `JWT_EXP_SECONDS`.

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Autentica dentista e devolve dados + `access_token` JWT |
| POST · GET | `/dentistas` | Cadastra · lista profissionais |
| GET · PATCH · DELETE | `/dentistas/{id}` | Consulta · edita · remove profissional |
| POST · GET | `/pacientes` | Cadastra · lista pacientes (`busca` por nome ou CPF) |
| GET · PATCH · DELETE | `/pacientes/{id}` | Consulta · edita (incluindo anamnese) · remove paciente |
| POST · GET | `/consultas` | Agenda · lista consultas (`data`, `data_inicio`, `data_fim`, `dentista_id`, `status_consulta`, `busca`) |
| GET · PATCH · DELETE | `/consultas/{id}` | Consulta · altera · remove agendamento |
| POST | `/consultas/{id}/faturar` | Gera lançamento financeiro de receita vinculado à consulta |
| POST · GET · PATCH · DELETE | `/evolucoes` | Fichas de evolução clínica do prontuário |
| POST · GET · PATCH · DELETE | `/prontuarios` | Registros do odontograma FDI (vinculáveis a `evolucao_id`) |
| POST · GET · PATCH · DELETE | `/planos-tratamento` | Itens planejados de tratamento por paciente |
| POST · GET · DELETE | `/documentos` | Documentos clínicos (receita, atestado, orçamento, encaminhamento, termo) |
| POST · GET · PATCH · DELETE | `/financeiro` | Receitas, contas a receber e despesas da clínica |
| GET | `/dashboard` | Indicadores financeiros, operacionais, produção por profissional e série de 6 meses |
| GET | `/dashboard/exportar` | Exportação de relatório gerencial e lançamentos em CSV |
| POST · GET · PATCH | `/solicitacoes` | Criação pública (landing) + gestão autenticada na recepção |
| GET · PATCH | `/configuracoes` | Parâmetros gerais da unidade |
| GET | `/health` | Verificação de disponibilidade |

## Deploy na Vercel (demonstração)

O arquivo `vercel.json` na raiz usa **Vercel Services** (Beta) para publicar `Front-End/` e `Back-End/` juntos no mesmo domínio, expondo a API em `/api/*`. Quando `VERCEL` está definido e `DATABASE_URL` não é informado, a API utiliza `/tmp/poc.db` e executa o seed de demonstração automaticamente na inicialização. Para persistência em produção, basta configurar `DATABASE_URL` apontando para PostgreSQL (ex.: Neon ou Supabase) e `JWT_SECRET`.
