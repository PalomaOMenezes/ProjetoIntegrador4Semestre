"""Valores fixos (enums) usados no banco e na API."""

from enum import Enum


class ServicoEnum(str, Enum):
    """Serviços aceitos no formulário da landing page."""

    primeira_consulta = "primeira-consulta"
    limpeza = "limpeza"
    emergencia = "emergencia"
    ortodontia = "ortodontia"
    clareamento = "clareamento"
    implante = "implante"
    outro = "outro"


class StatusSolicitacao(str, Enum):
    """Situação de um pré-agendamento vindo da landing page."""

    pendente = "pendente"
    contatado = "contatado"
    agendado = "agendado"
    arquivado = "arquivado"


class StatusConsulta(str, Enum):
    """Etapas do atendimento na agenda da recepção."""

    agendada = "agendada"
    confirmada = "confirmada"
    na_recepcao = "na_recepcao"
    em_atendimento = "em_atendimento"
    realizada = "realizada"
    falta = "falta"
    cancelada = "cancelada"


class FaceDente(str, Enum):
    """Faces dentárias válidas para registros do odontograma."""

    oclusal = "oclusal"
    mesial = "mesial"
    distal = "distal"
    vestibular = "vestibular"
    lingual = "lingual"


class StatusEvolucao(str, Enum):
    """Estado de assinatura de uma ficha de evolução clínica."""

    rascunho = "rascunho"
    assinado = "assinado"


class StatusPlanoTratamento(str, Enum):
    """Andamento de um item no plano de tratamento."""

    planejado = "planejado"
    em_andamento = "em_andamento"
    concluido = "concluido"
    cancelado = "cancelado"


class TipoDocumentoClinico(str, Enum):
    """Tipos de documentos emitidos no prontuário eletrônico."""

    receita = "receita"
    atestado = "atestado"
    orcamento = "orcamento"
    encaminhamento = "encaminhamento"
    termo = "termo"


class TipoLancamento(str, Enum):
    """Natureza de um lançamento financeiro."""

    receita = "receita"
    despesa = "despesa"


class StatusLancamento(str, Enum):
    """Situação de liquidação de um lançamento financeiro."""

    pendente = "pendente"
    pago = "pago"
    cancelado = "cancelado"
