"""Controller do módulo financeiro (receitas, contas a receber e despesas)."""

from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from enums import StatusLancamento, TipoLancamento
from models import Consulta, Dentista, LancamentoFinanceiro, Paciente
from schemas import LancamentoCreate, LancamentoResponse, LancamentoUpdate
from security import exigir_autenticacao

router = APIRouter(
    prefix="/financeiro",
    tags=["Financeiro"],
    dependencies=[Depends(exigir_autenticacao)],
)


async def _conferir_relacionados(
    db: AsyncSession,
    paciente_id: int | None,
    dentista_id: int | None,
    consulta_id: int | None,
) -> None:
    if paciente_id is not None:
        await buscar_ou_404(db, Paciente, paciente_id, "Paciente")
    if dentista_id is not None:
        await buscar_ou_404(db, Dentista, dentista_id, "Dentista")
    if consulta_id is not None:
        await buscar_ou_404(db, Consulta, consulta_id, "Consulta")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=LancamentoResponse)
async def criar_lancamento(
    dados: LancamentoCreate, db: AsyncSession = Depends(get_db)
) -> LancamentoFinanceiro:
    """Registra uma receita ou despesa no fluxo financeiro."""
    await _conferir_relacionados(
        db, dados.paciente_id, dados.dentista_id, dados.consulta_id
    )
    payload = dados.model_dump()
    if payload["status"] == StatusLancamento.pago and payload["data_pagamento"] is None:
        payload["data_pagamento"] = payload["data_competencia"]
    lancamento = LancamentoFinanceiro(**payload)
    await salvar(db, lancamento, "Não foi possível registrar o lançamento.")
    return lancamento


@router.get("", response_model=list[LancamentoResponse])
async def listar_lancamentos(
    tipo: TipoLancamento | None = None,
    status_lancamento: StatusLancamento | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    dentista_id: int | None = None,
    paciente_id: int | None = None,
    busca: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> Sequence[LancamentoFinanceiro]:
    """Lista lançamentos financeiros com filtros por período, tipo e status."""
    consulta = select(LancamentoFinanceiro).order_by(
        LancamentoFinanceiro.data_competencia.desc(), LancamentoFinanceiro.id.desc()
    )
    if tipo is not None:
        consulta = consulta.where(LancamentoFinanceiro.tipo == tipo)
    if status_lancamento is not None:
        consulta = consulta.where(LancamentoFinanceiro.status == status_lancamento)
    if data_inicio is not None:
        consulta = consulta.where(LancamentoFinanceiro.data_competencia >= data_inicio)
    if data_fim is not None:
        consulta = consulta.where(LancamentoFinanceiro.data_competencia <= data_fim)
    if dentista_id is not None:
        consulta = consulta.where(LancamentoFinanceiro.dentista_id == dentista_id)
    if paciente_id is not None:
        consulta = consulta.where(LancamentoFinanceiro.paciente_id == paciente_id)
    if busca and busca.strip():
        termo = f"%{busca.strip()}%"
        consulta = consulta.where(
            LancamentoFinanceiro.descricao.ilike(termo)
            | LancamentoFinanceiro.categoria.ilike(termo)
        )
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.patch("/{lancamento_id}", response_model=LancamentoResponse)
async def atualizar_lancamento(
    lancamento_id: int, dados: LancamentoUpdate, db: AsyncSession = Depends(get_db)
) -> LancamentoFinanceiro:
    """Atualiza dados ou liquida um lançamento financeiro."""
    lancamento = await buscar_ou_404(
        db, LancamentoFinanceiro, lancamento_id, "Lançamento"
    )
    campos = dados.model_dump(exclude_unset=True)
    await _conferir_relacionados(
        db, campos.get("paciente_id"), campos.get("dentista_id"), None
    )
    for campo, valor in campos.items():
        setattr(lancamento, campo, valor)
    if lancamento.status == StatusLancamento.pago and lancamento.data_pagamento is None:
        lancamento.data_pagamento = date.today()
    elif lancamento.status == StatusLancamento.pendente:
        lancamento.data_pagamento = None
    await salvar(db, lancamento, "Não foi possível atualizar o lançamento.")
    return lancamento


@router.delete("/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_lancamento(
    lancamento_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove um lançamento financeiro."""
    lancamento = await buscar_ou_404(
        db, LancamentoFinanceiro, lancamento_id, "Lançamento"
    )
    await apagar(db, lancamento, "Não foi possível remover o lançamento.")
