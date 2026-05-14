# SmileClinic — Sistema de Pré-agendamento Odontológico

Prova de Conceito (PoC) para o Sistema de Gestão Odontológica (SENAC 2026 — 4º semestre).
O sistema engloba uma Landing Page responsiva que se comunica de forma assíncrona com uma API de back-end em Python para persistência e validação dos dados de agendamento.

## Stack Tecnológico
- **Front-End:** HTML5, CSS3, JavaScript (Vanilla).
- **Back-End:** Python 3.12+, FastAPI, SQLAlchemy, SQLite (via `aiosqlite`).
- **Ferramentas:** `uv` (gerenciamento e dependências), `pytest` (testes).

## Como Executar o Projeto

### 1. Inicializando o Back-End

O back-end requer a ferramenta `uv` para instalar e executar dependências sem overhead. É obrigatório rodar o servidor na porta `3000` para bater com a integração do front-end.

```bash
# Entre na pasta do backend
cd Back-End

# Inicie o servidor (o uv resolverá as dependências automaticamente)
uv run uvicorn main:app --port 3000
```
A API estará disponível em `http://localhost:3000` e a documentação interativa em `http://localhost:3000/docs`.

### 2. Inicializando o Front-End

Como o front-end é estático, basta abrir o arquivo `index.html` em qualquer navegador.
Caso utilize o VS Code, a extensão **Live Server** também é recomendada.

```bash
# Entre na pasta e abra o arquivo no navegador padrão
cd Front-End
start index.html
```

## Como Executar os Testes

O projeto conta com uma suíte de testes ponta a ponta e validações via Pydantic.
```bash
cd Back-End
uv run pytest
```

## Checklist de Conclusão (v1.0-poc)
- [x] Front-end responsivo (375px e 1280px).
- [x] Validações híbridas (Front-end Vanilla e Back-end Pydantic).
- [x] Rotas REST configuradas com persistência isolada (SQLite).
- [x] Tratamento customizado de erros (`422 Unprocessable Entity` dinâmico).
- [x] Repositório limpo com `.gitignore` estrito.
