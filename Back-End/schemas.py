"""Formato dos dados que entram e saem da API (Pydantic)."""

import re
import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from enums import (
    FaceDente,
    ServicoEnum,
    StatusConsulta,
    StatusEvolucao,
    StatusLancamento,
    StatusPlanoTratamento,
    StatusSolicitacao,
    TipoDocumentoClinico,
    TipoLancamento,
)

# Reexportado para manter compatibilidade com o código antigo.
__all__ = ["ServicoEnum"]


def so_digitos(valor: str) -> str:
    """Remove todos os caracteres que não sejam dígitos."""
    return re.sub(r"\D", "", valor)


def validar_telefone(valor: str) -> str:
    """Valida telefone brasileiro com DDD (10 ou 11 dígitos)."""
    digitos = so_digitos(valor)
    if not 10 <= len(digitos) <= 11:
        raise ValueError("telefone deve ter DDD + número (10 ou 11 dígitos)")
    return digitos


def validar_cpf(valor: str) -> str:
    """Valida CPF com cálculo dos dois dígitos verificadores."""
    cpf = so_digitos(valor)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        raise ValueError("CPF inválido")
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            raise ValueError("CPF inválido")
    return cpf


def texto_ou_none(valor: Optional[str]) -> Optional[str]:
    """Texto só com espaços vira None (assim a anamnese pode ser apagada)."""
    if valor is None:
        return None
    return valor.strip() or None


def validar_dente(valor: int) -> int:
    """Valida número do dente na notação FDI (quadrantes 1–4, posições 1–8)."""
    if not (1 <= valor // 10 <= 4 and 1 <= valor % 10 <= 8):
        raise ValueError(
            "dente deve seguir a notação FDI (11 a 18, 21 a 28, 31 a 38, 41 a 48)"
        )
    return valor


class ModeloResposta(BaseModel):
    """Base para modelos de saída lidos diretamente do ORM."""

    model_config = ConfigDict(from_attributes=True)


# ---------- Solicitação (landing page) ----------


class SolicitacaoCreate(BaseModel):
    """Payload enviado pelo formulário da landing page."""

    nome: str = Field(..., min_length=3)
    email: EmailStr
    telefone: str = Field(..., min_length=10, max_length=20)
    servico: ServicoEnum
    mensagem: Optional[str] = Field(None, max_length=500)

    @field_validator("telefone")
    @classmethod
    def _telefone(cls, v: str) -> str:
        validar_telefone(v)
        return v


class SolicitacaoResponse(BaseModel):
    """Resposta imediata após envio de uma solicitação."""

    id: uuid.UUID
    status: str
    message: str


class SolicitacaoDetalheResponse(ModeloResposta):
    """Registro completo de solicitação exibido na recepção."""

    id: uuid.UUID
    nome: str
    email: str
    telefone: str
    servico: str
    mensagem: Optional[str]
    status: str
    criado_em: datetime


class SolicitacaoUpdate(BaseModel):
    """Atualização de status de uma solicitação na recepção."""

    status: StatusSolicitacao


# ---------- Dentista ----------


class DentistaCreate(BaseModel):
    """Dados para cadastro de dentista."""

    nome: str = Field(..., min_length=3, max_length=255)
    cargo: str = Field(..., min_length=3, max_length=100, examples=["Clínico Geral"])
    cro: str = Field(..., min_length=4, max_length=20, examples=["CRO-SP 12345"])
    email: EmailStr
    senha: str = Field(..., min_length=8, max_length=128)

    @field_validator("cro")
    @classmethod
    def _cro_maiusculo(cls, v: str) -> str:
        return v.strip().upper()


class DentistaUpdate(BaseModel):
    """Dados para atualização parcial de dentista."""

    nome: Optional[str] = Field(None, min_length=3, max_length=255)
    cargo: Optional[str] = Field(None, min_length=3, max_length=100)
    cro: Optional[str] = Field(None, min_length=4, max_length=20)
    email: Optional[EmailStr] = None
    senha: Optional[str] = Field(None, min_length=8, max_length=128)


class DentistaResponse(ModeloResposta):
    """Dados públicos do dentista (nunca expõe senha ou hash)."""

    id: int
    nome: str
    cargo: str
    cro: str
    email: str


class LoginRequest(BaseModel):
    """Credenciais de acesso ao painel."""

    email: EmailStr
    senha: str


class LoginResponse(DentistaResponse):
    """Resposta do login com dados do profissional e token JWT Bearer."""

    access_token: str
    token_type: str = "bearer"


# ---------- Paciente ----------


class PacienteCreate(BaseModel):
    """Dados para cadastro de paciente."""

    nome: str = Field(..., min_length=3, max_length=255)
    telefone: str = Field(..., examples=["(11) 99999-9999"])
    cpf: str = Field(..., examples=["529.982.247-25"])
    data_nascimento: Optional[date] = None
    endereco: str = Field(..., min_length=5, max_length=255)
    anamnese: Optional[str] = Field(None, max_length=5000)

    @field_validator("telefone")
    @classmethod
    def _telefone(cls, v: str) -> str:
        return validar_telefone(v)

    @field_validator("cpf")
    @classmethod
    def _cpf(cls, v: str) -> str:
        return validar_cpf(v)

    @field_validator("anamnese")
    @classmethod
    def _anamnese(cls, v: Optional[str]) -> Optional[str]:
        return texto_ou_none(v)


class PacienteUpdate(BaseModel):
    """Dados para atualização parcial de paciente."""

    nome: Optional[str] = Field(None, min_length=3, max_length=255)
    telefone: Optional[str] = None
    cpf: Optional[str] = None
    data_nascimento: Optional[date] = None
    endereco: Optional[str] = Field(None, min_length=5, max_length=255)
    anamnese: Optional[str] = Field(None, max_length=5000)

    @field_validator("telefone")
    @classmethod
    def _telefone(cls, v: Optional[str]) -> Optional[str]:
        return validar_telefone(v) if v is not None else v

    @field_validator("cpf")
    @classmethod
    def _cpf(cls, v: Optional[str]) -> Optional[str]:
        return validar_cpf(v) if v is not None else v

    @field_validator("anamnese")
    @classmethod
    def _anamnese(cls, v: Optional[str]) -> Optional[str]:
        return texto_ou_none(v)


class PacienteResponse(ModeloResposta):
    """Saída do cadastro de paciente."""

    id: int
    nome: str
    telefone: str
    cpf: str
    data_nascimento: Optional[date] = None
    endereco: str
    anamnese: Optional[str]
    anamnese_atualizada_em: Optional[datetime] = None


# ---------- Consulta ----------


class ConsultaCreate(BaseModel):
    """Dados para agendamento de consulta."""

    paciente_id: int
    dentista_id: int
    data_hora: datetime = Field(..., examples=["2026-12-01T14:30:00"])
    procedimento: str = Field(default="Avaliação inicial", min_length=2, max_length=200)
    valor_estimado: Optional[float] = Field(default=None, ge=0)
    status: StatusConsulta = StatusConsulta.agendada

    @field_validator("procedimento")
    @classmethod
    def _procedimento(cls, v: str) -> str:
        texto = v.strip()
        if len(texto) < 2:
            raise ValueError("procedimento deve ter pelo menos 2 caracteres")
        return texto


class ConsultaUpdate(BaseModel):
    """Dados para atualização parcial de consulta."""

    paciente_id: Optional[int] = None
    dentista_id: Optional[int] = None
    data_hora: Optional[datetime] = None
    procedimento: Optional[str] = Field(None, min_length=2, max_length=200)
    valor_estimado: Optional[float] = Field(default=None, ge=0)
    status: Optional[StatusConsulta] = None


class ConsultaResponse(ModeloResposta):
    """Saída de consulta agendada."""

    id: int
    paciente_id: int
    dentista_id: int
    data_hora: datetime
    procedimento: str
    valor_estimado: Optional[float] = None
    status: StatusConsulta


# ---------- Prontuário / Odontograma ----------


class ProntuarioCreate(BaseModel):
    """Registro de procedimento em dente específico."""

    paciente_id: int
    dentista_id: int
    evolucao_id: Optional[int] = None
    dente: int = Field(..., examples=[26])
    face: FaceDente
    descricao: str = Field(..., min_length=3, max_length=2000)

    @field_validator("dente")
    @classmethod
    def _dente(cls, v: int) -> int:
        return validar_dente(v)


class ProntuarioUpdate(BaseModel):
    """Atualização de registro do odontograma."""

    evolucao_id: Optional[int] = None
    dente: Optional[int] = None
    face: Optional[FaceDente] = None
    descricao: Optional[str] = Field(None, min_length=3, max_length=2000)

    @field_validator("dente")
    @classmethod
    def _dente(cls, v: Optional[int]) -> Optional[int]:
        return validar_dente(v) if v is not None else v


class ProntuarioResponse(ModeloResposta):
    """Saída de registro no odontograma."""

    id: int
    paciente_id: int
    dentista_id: int
    evolucao_id: Optional[int] = None
    dente: int
    face: FaceDente
    descricao: str
    criado_em: datetime


# ---------- Evolução Clínica ----------


class EvolucaoCreate(BaseModel):
    """Criação de ficha estruturada de evolução clínica."""

    paciente_id: int
    dentista_id: int
    consulta_id: Optional[int] = None
    queixa_principal: str = Field(..., min_length=2, max_length=3000)
    exame_clinico: str = Field(..., min_length=2, max_length=3000)
    procedimento_realizado: str = Field(..., min_length=2, max_length=3000)
    prescricao_orientacoes: Optional[str] = Field(None, max_length=3000)
    status: StatusEvolucao = StatusEvolucao.rascunho

    @field_validator("prescricao_orientacoes")
    @classmethod
    def _prescricao(cls, v: Optional[str]) -> Optional[str]:
        return texto_ou_none(v)


class EvolucaoUpdate(BaseModel):
    """Atualização parcial de uma evolução clínica."""

    queixa_principal: Optional[str] = Field(None, min_length=2, max_length=3000)
    exame_clinico: Optional[str] = Field(None, min_length=2, max_length=3000)
    procedimento_realizado: Optional[str] = Field(None, min_length=2, max_length=3000)
    prescricao_orientacoes: Optional[str] = Field(None, max_length=3000)
    status: Optional[StatusEvolucao] = None

    @field_validator("prescricao_orientacoes")
    @classmethod
    def _prescricao(cls, v: Optional[str]) -> Optional[str]:
        return texto_ou_none(v)


class EvolucaoResponse(ModeloResposta):
    """Saída de ficha de evolução clínica."""

    id: int
    paciente_id: int
    dentista_id: int
    consulta_id: Optional[int]
    queixa_principal: str
    exame_clinico: str
    procedimento_realizado: str
    prescricao_orientacoes: Optional[str]
    status: StatusEvolucao
    criado_em: datetime
    atualizado_em: Optional[datetime]


# ---------- Plano de Tratamento ----------


class PlanoItemCreate(BaseModel):
    """Criação de procedimento no plano de tratamento."""

    paciente_id: int
    dentista_id: int
    dente: Optional[int] = None
    procedimento: str = Field(..., min_length=3, max_length=255)
    valor: float = Field(..., ge=0)
    status: StatusPlanoTratamento = StatusPlanoTratamento.planejado

    @field_validator("dente")
    @classmethod
    def _dente(cls, v: Optional[int]) -> Optional[int]:
        return validar_dente(v) if v is not None else v


class PlanoItemUpdate(BaseModel):
    """Atualização parcial de item do plano de tratamento."""

    dente: Optional[int] = None
    procedimento: Optional[str] = Field(None, min_length=3, max_length=255)
    valor: Optional[float] = Field(None, ge=0)
    status: Optional[StatusPlanoTratamento] = None

    @field_validator("dente")
    @classmethod
    def _dente(cls, v: Optional[int]) -> Optional[int]:
        return validar_dente(v) if v is not None else v


class PlanoItemResponse(ModeloResposta):
    """Saída de item do plano de tratamento."""

    id: int
    paciente_id: int
    dentista_id: int
    dente: Optional[int]
    procedimento: str
    valor: float
    status: StatusPlanoTratamento
    criado_em: datetime


# ---------- Documentos Clínicos ----------


class DocumentoCreate(BaseModel):
    """Emissão de documento clínico (receita, atestado, orçamento, etc.)."""

    paciente_id: int
    dentista_id: int
    tipo: TipoDocumentoClinico
    titulo: str = Field(..., min_length=3, max_length=200)
    conteudo: str = Field(..., min_length=5, max_length=10000)


class DocumentoResponse(ModeloResposta):
    """Saída de documento clínico salvo."""

    id: int
    paciente_id: int
    dentista_id: int
    tipo: TipoDocumentoClinico
    titulo: str
    conteudo: str
    criado_em: datetime


# ---------- Financeiro ----------


class LancamentoCreate(BaseModel):
    """Criação de lançamento financeiro (receita ou despesa)."""

    tipo: TipoLancamento
    descricao: str = Field(..., min_length=3, max_length=255)
    categoria: str = Field(..., min_length=2, max_length=100)
    valor: float = Field(..., gt=0)
    status: StatusLancamento = StatusLancamento.pendente
    data_competencia: date
    data_pagamento: Optional[date] = None
    forma_pagamento: Optional[str] = Field(None, max_length=50)
    paciente_id: Optional[int] = None
    dentista_id: Optional[int] = None
    consulta_id: Optional[int] = None

    @field_validator("valor")
    @classmethod
    def _arredondar(cls, v: float) -> float:
        return round(v, 2)


class LancamentoUpdate(BaseModel):
    """Atualização parcial de lançamento financeiro."""

    tipo: Optional[TipoLancamento] = None
    descricao: Optional[str] = Field(None, min_length=3, max_length=255)
    categoria: Optional[str] = Field(None, min_length=2, max_length=100)
    valor: Optional[float] = Field(None, gt=0)
    status: Optional[StatusLancamento] = None
    data_competencia: Optional[date] = None
    data_pagamento: Optional[date] = None
    forma_pagamento: Optional[str] = Field(None, max_length=50)
    paciente_id: Optional[int] = None
    dentista_id: Optional[int] = None

    @field_validator("valor")
    @classmethod
    def _arredondar(cls, v: Optional[float]) -> Optional[float]:
        return round(v, 2) if v is not None else v


class LancamentoResponse(ModeloResposta):
    """Saída de lançamento financeiro."""

    id: int
    tipo: TipoLancamento
    descricao: str
    categoria: str
    valor: float
    status: StatusLancamento
    data_competencia: date
    data_pagamento: Optional[date]
    forma_pagamento: Optional[str]
    paciente_id: Optional[int]
    dentista_id: Optional[int]
    consulta_id: Optional[int]
    criado_em: datetime


# ---------- Dashboard Gerencial ----------


class FaturarConsultaRequest(BaseModel):
    """Parâmetros opcionais ao gerar cobrança financeira de uma consulta."""

    valor: Optional[float] = Field(default=None, gt=0)
    status: StatusLancamento = StatusLancamento.pago
    forma_pagamento: Optional[str] = Field(default="PIX", max_length=50)
    categoria: str = Field(default="Consultas", min_length=2, max_length=100)


class DesempenhoProfissional(BaseModel):
    """Resumo de produtividade e faturamento por profissional."""

    dentista_id: int
    nome: str
    atendimentos: int
    faturamento: float


class SerieMensalItem(BaseModel):
    """Totais mensais de receitas e despesas para evolução de 6 meses."""

    ano_mes: str
    rotulo: str
    receitas: float
    despesas: float


class DashboardResponse(BaseModel):
    """Consolidado gerencial, financeiro e operacional do período."""

    data_inicio: date
    data_fim: date
    anterior_inicio: date
    anterior_fim: date
    faturamento_bruto: float
    faturamento_anterior: float
    variacao_faturamento_pct: Optional[float]
    valor_recebido: float
    percentual_recebido: float
    valor_a_receber: float
    percentual_a_receber: float
    atendimentos_realizados: int
    pacientes_unicos: int
    despesas_pagas: float
    saldo_periodo: float
    ocupacao_agenda_pct: float
    taxa_faltas_pct: float
    ticket_medio: float
    por_profissional: list[DesempenhoProfissional]
    serie_mensal: list[SerieMensalItem]


# ---------- Configurações da Clínica ----------


class ConfiguracaoUpdate(BaseModel):
    """Atualização dos parâmetros gerais da unidade."""

    nome_clinica: Optional[str] = Field(None, min_length=2, max_length=150)
    unidade: Optional[str] = Field(None, min_length=2, max_length=150)
    telefone: Optional[str] = Field(None, min_length=8, max_length=30)
    endereco: Optional[str] = Field(None, min_length=5, max_length=255)
    horario_funcionamento: Optional[str] = Field(None, min_length=4, max_length=150)
    slots_diarios_por_dentista: Optional[int] = Field(None, ge=1, le=40)


class ConfiguracaoResponse(ModeloResposta):
    """Configurações atuais da clínica."""

    id: int
    nome_clinica: str
    unidade: str
    telefone: str
    endereco: str
    horario_funcionamento: str
    slots_diarios_por_dentista: int
