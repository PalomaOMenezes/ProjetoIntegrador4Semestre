"""Tabelas do banco (SQLAlchemy)."""

import uuid
from datetime import date, datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from enums import (
    FaceDente,
    StatusConsulta,
    StatusEvolucao,
    StatusLancamento,
    StatusPlanoTratamento,
    TipoDocumentoClinico,
    TipoLancamento,
)


def agora_utc() -> datetime:
    """Retorna o instante atual em UTC."""
    return datetime.now(timezone.utc)


def coluna_enum(enum_cls: type[PyEnum]) -> Enum:
    """Guarda o enum como texto e cria um CHECK no banco com os valores permitidos."""
    return Enum(
        enum_cls,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
        length=30,
    )


class Dentista(Base):
    """Profissional de odontologia com acesso ao painel."""

    __tablename__ = "dentista"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    cro: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )

    consultas: Mapped[list["Consulta"]] = relationship(back_populates="dentista")
    prontuarios: Mapped[list["Prontuario"]] = relationship(back_populates="dentista")


class Paciente(Base):
    """Cadastro clínico e cadastral de paciente."""

    __tablename__ = "paciente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str] = mapped_column(String(11), nullable=False)
    cpf: Mapped[str] = mapped_column(String(11), nullable=False, unique=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    endereco: Mapped[str] = mapped_column(String(255), nullable=False)
    anamnese: Mapped[str | None] = mapped_column(Text, nullable=True)
    anamnese_atualizada_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )

    consultas: Mapped[list["Consulta"]] = relationship(back_populates="paciente")
    prontuarios: Mapped[list["Prontuario"]] = relationship(back_populates="paciente")


class Consulta(Base):
    """Agendamento de atendimento na recepção."""

    __tablename__ = "consulta"
    # Um dentista não pode ter duas consultas no mesmo horário.
    # Consultas canceladas não contam: o horário volta a ficar livre.
    __table_args__ = (
        Index(
            "uq_consulta_dentista_horario",
            "dentista_id",
            "data_hora",
            unique=True,
            sqlite_where=text("status != 'cancelada'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("paciente.id", ondelete="RESTRICT"), nullable=False
    )
    dentista_id: Mapped[int] = mapped_column(
        ForeignKey("dentista.id", ondelete="RESTRICT"), nullable=False
    )
    data_hora: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    procedimento: Mapped[str] = mapped_column(
        String(200), nullable=False, default="Avaliação inicial"
    )
    valor_estimado: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[StatusConsulta] = mapped_column(
        coluna_enum(StatusConsulta), nullable=False, default=StatusConsulta.agendada
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )

    paciente: Mapped[Paciente] = relationship(back_populates="consultas")
    dentista: Mapped[Dentista] = relationship(back_populates="consultas")


class Prontuario(Base):
    """Registro de procedimento no odontograma (notação FDI)."""

    __tablename__ = "prontuario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("paciente.id", ondelete="RESTRICT"), nullable=False
    )
    dentista_id: Mapped[int] = mapped_column(
        ForeignKey("dentista.id", ondelete="RESTRICT"), nullable=False
    )
    evolucao_id: Mapped[int | None] = mapped_column(
        ForeignKey("evolucao_clinica.id", ondelete="SET NULL"), nullable=True
    )
    dente: Mapped[int] = mapped_column(Integer, nullable=False)  # FDI: 11 a 48
    face: Mapped[FaceDente] = mapped_column(coluna_enum(FaceDente), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )

    paciente: Mapped[Paciente] = relationship(back_populates="prontuarios")
    dentista: Mapped[Dentista] = relationship(back_populates="prontuarios")


class EvolucaoClinica(Base):
    """Ficha estruturada de evolução clínica de um atendimento."""

    __tablename__ = "evolucao_clinica"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("paciente.id", ondelete="RESTRICT"), nullable=False
    )
    dentista_id: Mapped[int] = mapped_column(
        ForeignKey("dentista.id", ondelete="RESTRICT"), nullable=False
    )
    consulta_id: Mapped[int | None] = mapped_column(
        ForeignKey("consulta.id", ondelete="SET NULL"), nullable=True
    )
    queixa_principal: Mapped[str] = mapped_column(Text, nullable=False)
    exame_clinico: Mapped[str] = mapped_column(Text, nullable=False)
    procedimento_realizado: Mapped[str] = mapped_column(Text, nullable=False)
    prescricao_orientacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[StatusEvolucao] = mapped_column(
        coluna_enum(StatusEvolucao), nullable=False, default=StatusEvolucao.rascunho
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )
    atualizado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=agora_utc
    )


class PlanoTratamentoItem(Base):
    """Procedimento planejado para o paciente."""

    __tablename__ = "plano_tratamento_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("paciente.id", ondelete="RESTRICT"), nullable=False
    )
    dentista_id: Mapped[int] = mapped_column(
        ForeignKey("dentista.id", ondelete="RESTRICT"), nullable=False
    )
    dente: Mapped[int | None] = mapped_column(Integer, nullable=True)
    procedimento: Mapped[str] = mapped_column(String(255), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[StatusPlanoTratamento] = mapped_column(
        coluna_enum(StatusPlanoTratamento),
        nullable=False,
        default=StatusPlanoTratamento.planejado,
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )


class DocumentoClinico(Base):
    """Receitas, atestados, orçamentos e orientações emitidos no prontuário."""

    __tablename__ = "documento_clinico"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("paciente.id", ondelete="RESTRICT"), nullable=False
    )
    dentista_id: Mapped[int] = mapped_column(
        ForeignKey("dentista.id", ondelete="RESTRICT"), nullable=False
    )
    tipo: Mapped[TipoDocumentoClinico] = mapped_column(
        coluna_enum(TipoDocumentoClinico), nullable=False
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )


class LancamentoFinanceiro(Base):
    """Receita ou despesa da clínica usada no financeiro e no dashboard."""

    __tablename__ = "lancamento_financeiro"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[TipoLancamento] = mapped_column(
        coluna_enum(TipoLancamento), nullable=False
    )
    descricao: Mapped[str] = mapped_column(String(255), nullable=False)
    categoria: Mapped[str] = mapped_column(String(100), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[StatusLancamento] = mapped_column(
        coluna_enum(StatusLancamento),
        nullable=False,
        default=StatusLancamento.pendente,
    )
    data_competencia: Mapped[date] = mapped_column(Date, nullable=False)
    data_pagamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    forma_pagamento: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paciente_id: Mapped[int | None] = mapped_column(
        ForeignKey("paciente.id", ondelete="SET NULL"), nullable=True
    )
    dentista_id: Mapped[int | None] = mapped_column(
        ForeignKey("dentista.id", ondelete="SET NULL"), nullable=True
    )
    consulta_id: Mapped[int | None] = mapped_column(
        ForeignKey("consulta.id", ondelete="SET NULL"), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc
    )


class ConfiguracaoClinica(Base):
    """Parâmetros gerais da unidade odontológica."""

    __tablename__ = "configuracao_clinica"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome_clinica: Mapped[str] = mapped_column(
        String(150), nullable=False, default="SmileClinic"
    )
    unidade: Mapped[str] = mapped_column(
        String(150), nullable=False, default="Unidade principal"
    )
    telefone: Mapped[str] = mapped_column(
        String(30), nullable=False, default="(11) 3000-0000"
    )
    endereco: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Av. Paulista, 1000 - São Paulo/SP"
    )
    horario_funcionamento: Mapped[str] = mapped_column(
        String(150), nullable=False, default="Seg a Sex, 08:00 às 19:00"
    )
    slots_diarios_por_dentista: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10
    )


class SolicitacaoAgendamento(Base):
    """Pedido vindo da landing page (antes de virar paciente + consulta)."""

    __tablename__ = "solicitacao_agendamento"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str] = mapped_column(String(20), nullable=False)
    servico: Mapped[str] = mapped_column(String(50), nullable=False)
    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pendente", nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=agora_utc, nullable=False
    )
    atualizado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=agora_utc
    )
