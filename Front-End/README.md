# OdontoAgenda — Front-end PoC

Prova de Conceito do front-end para o Sistema de Gestão Odontológica (Projeto Integrador SENAC 2026 — 4º semestre).

Entrega uma landing page com formulário de pré-agendamento, com acessibilidade, responsividade, validações client-side e estrutura pronta para integração com o back-end.

## Tecnologias

- **HTML5**: Semântico, com foco em acessibilidade (`aria-label`, tags estruturais corretas)
- **CSS3**: Design system com variáveis CSS, Flexbox/Grid, responsividade mobile-first e efeitos de glassmorphism — sem frameworks externos
- **JavaScript**: Manipulação de DOM, validação de formulário, máscaras de input via Regex e requisições assíncronas com `fetch`
- **Ícones**: Lucide Icons (SVG puro)
- **Tipografia**: Satoshi (texto corrido) e Fraunces (títulos)

## Estrutura

```text
Front-End/
├── assets/
│   └── hero-bg.jpg
├── index.html
├── script.js
└── style.css
```

## Como executar

Nenhuma etapa de build é necessária — a aplicação é inteiramente client-side.

**Opção 1 — Direto no navegador:**
Abra o arquivo `index.html` com duplo clique em qualquer navegador moderno.

**Opção 2 — Live Server (recomendado):**
Clique com o botão direito no `index.html` no VS Code > *Open with Live Server* (porta `5500`).

## Integração com a API

O formulário envia um `POST` para o endpoint configurado na constante `API_URL` em `script.js`. Para conectar ao back-end, atualize o valor dessa constante com o host correto:

```js
const API_URL = 'http://localhost:3000/solicitacoes';
```

Payload enviado: `{ nome, email, telefone, servico, mensagem }` (JSON).
Resposta esperada para sucesso: qualquer status HTTP `2xx`.
