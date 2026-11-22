"""Controller de solicitações de pré-agendamento da landing page."""

import uuid
from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from enums import StatusSolicitacao
from models import SolicitacaoAgendamento, agora_utc
from schemas import (
    SolicitacaoCreate,
    SolicitacaoDetalheResponse,
    SolicitacaoResponse,
    SolicitacaoUpdate,
)
from security import exigir_autenticacao

router = APIRouter(prefix="/solicitacoes", tags=["Solicitações (landing page)"])


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=SolicitacaoResponse
)
async def criar_solicitacao(
    solicitacao: SolicitacaoCreate, db: AsyncSession = Depends(get_db)
) -> SolicitacaoResponse:
    """Recebe e armazena um pedido de pré-agendamento vindo da landing page."""
    nova = SolicitacaoAgendamento(
        nome=solicitacao.nome,
        email=solicitacao.email,
        telefone=solicitacao.telefone,
        servico=solicitacao.servico.value,
        mensagem=solicitacao.mensagem,
    )
    db.add(nova)
    await db.commit()
    await db.refresh(nova)
    return SolicitacaoResponse(
        id=nova.id, status=nova.status, message="Solicitação enviada com sucesso"
    )


@router.get(
    "",
    response_model=list[SolicitacaoDetalheResponse],
    dependencies=[Depends(exigir_autenticacao)],
)
async def listar_solicitacoes(
    status_solicitacao: StatusSolicitacao | None = None,
    db: AsyncSession = Depends(get_db),
) -> Sequence[SolicitacaoAgendamento]:
    """Lista pré-agendamentos da landing page para acompanhamento na recepção."""
    consulta = select(SolicitacaoAgendamento).order_by(
        SolicitacaoAgendamento.criado_em.desc()
    )
    if status_solicitacao:
        consulta = consulta.where(
            SolicitacaoAgendamento.status == status_solicitacao.value
        )
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.patch(
    "/{solicitacao_id}",
    response_model=SolicitacaoDetalheResponse,
    dependencies=[Depends(exigir_autenticacao)],
)
async def atualizar_solicitacao(
    solicitacao_id: uuid.UUID,
    dados: SolicitacaoUpdate,
    db: AsyncSession = Depends(get_db),
) -> SolicitacaoAgendamento:
    """Atualiza o status de acompanhamento de uma solicitação."""
    registro = await db.get(SolicitacaoAgendamento, solicitacao_id)
    if registro is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Solicitação {solicitacao_id} não encontrada.",
        )
    registro.status = dados.status.value
    registro.atualizado_em = agora_utc()
    await db.commit()
    await db.refresh(registro)
    return registro
