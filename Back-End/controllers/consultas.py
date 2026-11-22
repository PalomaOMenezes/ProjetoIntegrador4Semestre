"""Controller de agendamentos, fluxo da recepção e faturamento de consulta."""

import re
from collections.abc import Sequence
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from enums import StatusConsulta, StatusLancamento, TipoLancamento
from models import Consulta, Dentista, LancamentoFinanceiro, Paciente
from schemas import (
    ConsultaCreate,
    ConsultaResponse,
    ConsultaUpdate,
    FaturarConsultaRequest,
    LancamentoResponse,
)
from security import exigir_autenticacao

router = APIRouter(
    prefix="/consultas",
    tags=["Consultas / Agendamentos"],
    dependencies=[Depends(exigir_autenticacao)],
)

CONFLITO = "O dentista já tem uma consulta neste horário."


async def conferir_relacionados(
    db: AsyncSession, paciente_id: int | None, dentista_id: int | None
) -> None:
    """Garante que paciente e dentista informados existam antes de gravar."""
    if paciente_id is not None:
        await buscar_ou_404(db, Paciente, paciente_id, "Paciente")
    if dentista_id is not None:
        await buscar_ou_404(db, Dentista, dentista_id, "Dentista")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ConsultaResponse)
async def criar_consulta(
    dados: ConsultaCreate, db: AsyncSession = Depends(get_db)
) -> Consulta:
    """Agenda uma nova consulta verificando conflito de horário do dentista."""
    await conferir_relacionados(db, dados.paciente_id, dados.dentista_id)
    consulta = Consulta(**dados.model_dump())
    await salvar(db, consulta, CONFLITO)
    return consulta


@router.get("", response_model=list[ConsultaResponse])
async def listar_consultas(
    data: date | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    paciente_id: int | None = None,
    dentista_id: int | None = None,
    status_consulta: StatusConsulta | None = None,
    busca: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> Sequence[Consulta]:
    """Lista consultas com filtros de dia, intervalo, profissional, status e busca."""
    consulta = select(Consulta).order_by(Consulta.data_hora)
    if data:
        inicio = datetime.combine(data, time.min)
        fim = datetime.combine(data, time.max)
        consulta = consulta.where(Consulta.data_hora.between(inicio, fim))
    else:
        if data_inicio:
            consulta = consulta.where(
                Consulta.data_hora >= datetime.combine(data_inicio, time.min)
            )
        if data_fim:
            consulta = consulta.where(
                Consulta.data_hora <= datetime.combine(data_fim, time.max)
            )
    if paciente_id:
        consulta = consulta.where(Consulta.paciente_id == paciente_id)
    if dentista_id:
        consulta = consulta.where(Consulta.dentista_id == dentista_id)
    if status_consulta:
        consulta = consulta.where(Consulta.status == status_consulta)
    if busca and busca.strip():
        termo = busca.strip()
        consulta = consulta.join(Paciente, Consulta.paciente_id == Paciente.id)
        filtro = Paciente.nome.ilike(f"%{termo}%") | Consulta.procedimento.ilike(
            f"%{termo}%"
        )
        digitos = re.sub(r"\D", "", termo)
        if digitos:
            filtro = filtro | Paciente.cpf.like(f"%{digitos}%")
        consulta = consulta.where(filtro)
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.get("/{consulta_id}", response_model=ConsultaResponse)
async def obter_consulta(
    consulta_id: int, db: AsyncSession = Depends(get_db)
) -> Consulta:
    """Retorna os detalhes de uma consulta."""
    return await buscar_ou_404(db, Consulta, consulta_id, "Consulta")


@router.patch("/{consulta_id}", response_model=ConsultaResponse)
async def atualizar_consulta(
    consulta_id: int, dados: ConsultaUpdate, db: AsyncSession = Depends(get_db)
) -> Consulta:
    """Altera horário, procedimento, profissional ou status de uma consulta."""
    consulta = await buscar_ou_404(db, Consulta, consulta_id, "Consulta")
    await conferir_relacionados(db, dados.paciente_id, dados.dentista_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(consulta, campo, valor)
    await salvar(db, consulta, CONFLITO)
    return consulta


@router.post(
    "/{consulta_id}/faturar",
    status_code=status.HTTP_201_CREATED,
    response_model=LancamentoResponse,
)
async def faturar_consulta(
    consulta_id: int,
    dados: FaturarConsultaRequest,
    db: AsyncSession = Depends(get_db),
) -> LancamentoFinanceiro:
    """Cria lançamento de receita no financeiro vinculado à consulta sem duplicar."""
    consulta = await buscar_ou_404(db, Consulta, consulta_id, "Consulta")
    existente = await db.scalar(
        select(LancamentoFinanceiro).where(
            LancamentoFinanceiro.consulta_id == consulta.id,
            LancamentoFinanceiro.status != StatusLancamento.cancelado,
        )
    )
    if existente is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Esta consulta já possui lançamento financeiro registrado.",
        )

    valor = dados.valor if dados.valor is not None else consulta.valor_estimado
    if valor is None or valor <= 0:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Informe um valor maior que zero para faturar a consulta.",
        )

    paciente = await buscar_ou_404(db, Paciente, consulta.paciente_id, "Paciente")
    data_comp = consulta.data_hora.date()
    lancamento = LancamentoFinanceiro(
        tipo=TipoLancamento.receita,
        descricao=f"{consulta.procedimento} ({paciente.nome})",
        categoria=dados.categoria,
        valor=round(valor, 2),
        status=dados.status,
        data_competencia=data_comp,
        data_pagamento=data_comp if dados.status == StatusLancamento.pago else None,
        forma_pagamento=dados.forma_pagamento,
        paciente_id=consulta.paciente_id,
        dentista_id=consulta.dentista_id,
        consulta_id=consulta.id,
    )
    await salvar(db, lancamento, "Não foi possível faturar a consulta.")
    return lancamento


@router.delete("/{consulta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_consulta(
    consulta_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove uma consulta da agenda."""
    consulta = await buscar_ou_404(db, Consulta, consulta_id, "Consulta")
    await apagar(db, consulta, "Não foi possível remover a consulta.")
