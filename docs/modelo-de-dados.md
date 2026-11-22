# Modelo de Dados — SmileClinic

## Visão geral

O banco de dados relacional é implementado em SQLAlchemy 2.0 assíncrono sobre SQLite (com `PRAGMA foreign_keys=ON`), pronto para migração para PostgreSQL via `DATABASE_URL`. Além do núcleo cadastral (**Dentista**, **Paciente**, **Consulta**, **Prontuário/Evolução** e **Odontograma**), o sistema interno inclui **Plano de Tratamento**, **Documentos Clínicos**, **Financeiro**, **Configurações da Clínica** e **Solicitações de Agendamento**.

## Relacionamentos principais

| Relacionamento | Cardinalidade | Descrição |
|---|---|---|
| Dentista — Consulta | 1 : N | Um dentista realiza várias consultas; cada consulta tem um único profissional. |
| Paciente — Consulta | 1 : N | Um paciente possui várias consultas; cada consulta pertence a um único paciente. |
| Paciente — Evolução Clínica (Prontuário) | 1 : N | Um paciente possui várias fichas de evolução clínica. |
| Evolução Clínica — Odontograma (`prontuario`) | 1 : N | Uma ficha de prontuário contém vários registros no odontograma (`evolucao_id`), mantendo suporte a lançamentos avulsos por paciente. |
| Paciente — Plano de Tratamento / Documentos | 1 : N | Um paciente possui procedimentos planejados e documentos emitidos (receitas, atestados, orçamentos). |
| Consulta / Paciente / Dentista — Lançamento Financeiro | 1 : N | Receitas e despesas podem ser vinculadas a consultas, pacientes e profissionais. |

## Dicionário de dados

### dentista
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador do dentista |
| nome | VARCHAR(255) | NOT NULL | Nome completo |
| cargo | VARCHAR(100) | NOT NULL | Especialidade |
| cro | VARCHAR(20) | NOT NULL, UNIQUE | Registro profissional em maiúsculas |
| email | VARCHAR(255) | NOT NULL, UNIQUE | E-mail de login |
| senha_hash | VARCHAR(255) | NOT NULL | Hash PBKDF2-SHA256 com salt |
| criado_em | DATETIME | NOT NULL | Data de cadastro |

### paciente
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador do paciente |
| nome | VARCHAR(255) | NOT NULL | Nome completo |
| telefone | VARCHAR(11) | NOT NULL | DDD + número (somente dígitos) |
| cpf | VARCHAR(11) | NOT NULL, UNIQUE | CPF validado (somente dígitos) |
| data_nascimento | DATE | NULL | Data de nascimento |
| endereco | VARCHAR(255) | NOT NULL | Endereço residencial |
| anamnese | TEXT | NULL | Alergias, medicamentos e histórico de saúde |
| anamnese_atualizada_em | DATETIME | NULL | Data da última alteração da anamnese |
| criado_em | DATETIME | NOT NULL | Data de cadastro |

### consulta
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador da consulta |
| paciente_id | INTEGER | FK → paciente.id, RESTRICT | Paciente atendido |
| dentista_id | INTEGER | FK → dentista.id, RESTRICT | Profissional responsável |
| data_hora | DATETIME | NOT NULL | Data e horário marcados |
| procedimento | VARCHAR(200) | NOT NULL | Procedimento previsto |
| valor_estimado | FLOAT | NULL | Valor de referência para faturamento |
| status | VARCHAR(30) | NOT NULL, CHECK | `agendada`, `confirmada`, `na_recepcao`, `em_atendimento`, `realizada`, `falta` ou `cancelada` |
| criado_em | DATETIME | NOT NULL | Data de criação |

Restrição adicional: índice único parcial `uq_consulta_dentista_horario` em `(dentista_id, data_hora)` onde `status != 'cancelada'`.

### evolucao_clinica (Prontuário)
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador da ficha |
| paciente_id / dentista_id | INTEGER | FK, RESTRICT | Paciente e profissional |
| consulta_id | INTEGER | FK → consulta.id, SET NULL | Consulta associada (opcional) |
| queixa_principal | TEXT | NOT NULL | Queixa relatada |
| exame_clinico | TEXT | NOT NULL | Achados clínicos |
| procedimento_realizado | TEXT | NOT NULL | Conduta executada |
| prescricao_orientacoes | TEXT | NULL | Prescrição e orientações pós-atendimento |
| status | VARCHAR(30) | NOT NULL, CHECK | `rascunho` ou `assinado` |
| criado_em / atualizado_em | DATETIME | — | Controle de datas |

### prontuario (Odontograma FDI)
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador do registro |
| paciente_id / dentista_id | INTEGER | FK, RESTRICT | Paciente e profissional |
| evolucao_id | INTEGER | FK → evolucao_clinica.id, SET NULL | Vínculo com o atendimento (1:N do MER/DER) |
| dente | INTEGER | NOT NULL | Notação FDI (11–18, 21–28, 31–38, 41–48) |
| face | VARCHAR(30) | NOT NULL, CHECK | `oclusal`, `mesial`, `distal`, `vestibular` ou `lingual` |
| descricao | TEXT | NOT NULL | Procedimento ou observação no dente |
| criado_em | DATETIME | NOT NULL | Data do registro |

### plano_tratamento_item & documento_clinico
- `plano_tratamento_item`: `id`, `paciente_id`, `dentista_id`, `dente` (FDI opcional), `procedimento`, `valor`, `status` (`planejado`, `em_andamento`, `concluido`, `cancelado`), `criado_em`.
- `documento_clinico`: `id`, `paciente_id`, `dentista_id`, `tipo` (`receita`, `atestado`, `orcamento`, `encaminhamento`, `termo`), `titulo`, `conteudo`, `criado_em`.

### lancamento_financeiro
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | INTEGER | PK | Identificador do lançamento |
| tipo | VARCHAR(30) | NOT NULL, CHECK | `receita` ou `despesa` |
| descricao / categoria | VARCHAR | NOT NULL | Identificação e agrupamento |
| valor | FLOAT | NOT NULL | Valor positivo em reais |
| status | VARCHAR(30) | NOT NULL, CHECK | `pendente`, `pago` ou `cancelado` |
| data_competencia / data_pagamento | DATE | — | Competência e liquidação |
| forma_pagamento | VARCHAR(50) | NULL | PIX, Cartão, Débito, Dinheiro, Boleto |
| paciente_id / dentista_id / consulta_id | INTEGER | FK, SET NULL | Vínculos opcionais com a operação clínica |

### configuracao_clinica & solicitacao_agendamento
- `configuracao_clinica`: registro único (`id=1`) com `nome_clinica`, `unidade`, `telefone`, `endereco`, `horario_funcionamento` e `slots_diarios_por_dentista`.
- `solicitacao_agendamento`: pedidos vindos da landing page (`id` UUID, `nome`, `email`, `telefone`, `servico`, `mensagem`, `status`: `pendente`, `contatado`, `agendado`, `arquivado`).
