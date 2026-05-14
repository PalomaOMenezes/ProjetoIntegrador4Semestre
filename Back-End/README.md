# SmileClinic - API Backend

Este é o back-end desenvolvido para a Prova de Conceito (PoC) do sistema de pré-agendamento da SmileClinic. Ele atua como o ponto central para receber, validar e armazenar os dados enviados pelo formulário da Landing Page.

## O que foi construído?

Para garantir um sistema leve, rápido e aderente às melhores práticas, construímos a API utilizando:

- **FastAPI**: Para gerenciar o roteamento REST de forma assíncrona.
- **Pydantic**: Para aplicar validação rigorosa dos dados de entrada (como checagem de e-mail, limites de caracteres e verificação exata do serviço solicitado).
- **SQLAlchemy + SQLite**: Para a persistência dos dados de forma estruturada. Usamos um banco de dados local (`poc.db`) ideal para esta PoC.
- **Testes (Pytest + TDD)**: Toda a regra de validação e roteamento foi construída usando testes automatizados para garantir confiabilidade.

## Principais Funcionalidades

1. **Rota `POST /solicitacoes`:**
   Recebe o payload do formulário. 
   - **Fluxo de Sucesso:** Valida a requisição, gera um ID único, registra o horário de criação, define o status inicial como `pendente`, salva no banco de dados e retorna o status `201 Created`.
   - **Fluxo de Falha:** Erros de preenchimento são interceptados automaticamente e envelopados na chave `{"message": "..."}` com status HTTP `422`. O Front-end lê exatamente essa chave para exibir avisos na tela.

2. **CORS:**
   O middleware foi configurado para permitir que o Front-end (rodando no navegador a partir de arquivos HTML ou Live Server) possa se comunicar com a API sem ser bloqueado pela segurança do navegador.

## Como Executar

O projeto utiliza o gerenciador **uv** para gerir dependências de forma otimizada. Não é necessário instalar bibliotecas manualmente com `pip`.

1. Navegue até a pasta do back-end:
   ```bash
   cd Back-End
   ```

2. Inicie o servidor fixando a porta `3000` (porta mapeada no Front-End):
   ```bash
   uv run uvicorn main:app --port 3000
   ```

Com isso, a API estará rodando em `http://127.0.0.1:3000`. 
*A documentação interativa gerada automaticamente fica disponível em `http://127.0.0.1:3000/docs`.*
