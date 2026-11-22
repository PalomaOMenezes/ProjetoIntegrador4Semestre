# SmileClinic — API Back-end

API REST do Sistema de Gestão Odontológica. Atende os cadastros e fluxos do modelo de dados: dentistas, pacientes, consultas (agenda) e prontuário (odontograma), além dos pedidos da landing page.

Descrição técnica completa: [`../docs/tecnologias.md`](../docs/tecnologias.md).

## Organização

| Arquivo | Papel |
|---|---|
| `main.py` | Cria a aplicação, configura CORS e o formato de erro, registra os controllers |
| `controllers/` | Um controller por recurso, com as rotas e as regras de negócio |
| `schemas.py` | Validação dos dados de entrada e saída (Pydantic) |
| `models.py` | Classes das tabelas (SQLAlchemy) |
| `enums.py` | Valores permitidos: status da consulta, face do dente, serviço |
| `database.py` | Conexão assíncrona. O banco vem da variável `DATABASE_URL` (padrão: `poc.db`) |
| `security.py` | Hash de senha (PBKDF2-SHA256) |
| `seed.py` | Dados de exemplo para demonstração |

## Como executar

```bash
cd Back-End
uv run python seed.py
uv run uvicorn main:app --port 3000 --reload
```

Documentação interativa: http://127.0.0.1:3000/docs

> Se você já tinha um `poc.db` da versão anterior, as tabelas novas são criadas sozinhas ao iniciar a API. Para começar do zero, apague o `poc.db`.

## Testes

```bash
uv run pytest
uv run ruff check .
```

Os testes usam um banco em memória e não mexem no `poc.db`.
