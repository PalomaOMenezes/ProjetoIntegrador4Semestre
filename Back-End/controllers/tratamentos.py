"""Controller de planos de tratamento e documentos clínicos do prontuário."""

from collections.abc import Sequence

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from models import Dentista, DocumentoClinico, Paciente, PlanoTratamentoItem
from schemas import (
    DocumentoCreate,
    DocumentoResponse,
    PlanoItemCreate,
    PlanoItemResponse,
    PlanoItemUpdate,
)
from security import exigir_autenticacao

planos_router = APIRouter(
    prefix="/planos-tratamento",
    tags=["Prontuário / Plano de Tratamento"],
    dependencies=[Depends(exigir_autenticacao)],
)
documentos_router = APIRouter(
    prefix="/documentos",
    tags=["Prontuário / Documentos"],
    dependencies=[Depends(exigir_autenticacao)],
)


@planos_router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=PlanoItemResponse
)
async def criar_item_plano(
    dados: PlanoItemCreate, db: AsyncSession = Depends(get_db)
) -> PlanoTratamentoItem:
    """Adiciona um procedimento ao plano de tratamento do paciente."""
    await buscar_ou_404(db, Paciente, dados.paciente_id, "Paciente")
    await buscar_ou_404(db, Dentista, dados.dentista_id, "Dentista")
    item = PlanoTratamentoItem(**dados.model_dump())
    await salvar(db, item, "Não foi possível salvar o item do plano.")
    return item


@planos_router.get("", response_model=list[PlanoItemResponse])
async def listar_itens_plano(
    paciente_id: int | None = None, db: AsyncSession = Depends(get_db)
) -> Sequence[PlanoTratamentoItem]:
    """Lista procedimentos planejados para um paciente."""
    consulta = select(PlanoTratamentoItem).order_by(
        PlanoTratamentoItem.criado_em.desc(), PlanoTratamentoItem.id.desc()
    )
    if paciente_id is not None:
        consulta = consulta.where(PlanoTratamentoItem.paciente_id == paciente_id)
    resultado = await db.scalars(consulta)
    return resultado.all()


@planos_router.patch("/{item_id}", response_model=PlanoItemResponse)
async def atualizar_item_plano(
    item_id: int, dados: PlanoItemUpdate, db: AsyncSession = Depends(get_db)
) -> PlanoTratamentoItem:
    """Atualiza procedimento, dente, valor ou status no plano de tratamento."""
    item = await buscar_ou_404(db, PlanoTratamentoItem, item_id, "Item do plano")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(item, campo, valor)
    await salvar(db, item, "Não foi possível atualizar o item do plano.")
    return item


@planos_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_item_plano(item_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Remove um procedimento do plano de tratamento."""
    item = await buscar_ou_404(db, PlanoTratamentoItem, item_id, "Item do plano")
    await apagar(db, item, "Não foi possível remover o item do plano.")


@documentos_router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=DocumentoResponse
)
async def criar_documento(
    dados: DocumentoCreate, db: AsyncSession = Depends(get_db)
) -> DocumentoClinico:
    """Emite e grava um documento clínico (receita, atestado, orçamento, etc.)."""
    await buscar_ou_404(db, Paciente, dados.paciente_id, "Paciente")
    await buscar_ou_404(db, Dentista, dados.dentista_id, "Dentista")
    documento = DocumentoClinico(**dados.model_dump())
    await salvar(db, documento, "Não foi possível salvar o documento.")
    return documento


@documentos_router.get("", response_model=list[DocumentoResponse])
async def listar_documentos(
    paciente_id: int | None = None, db: AsyncSession = Depends(get_db)
) -> Sequence[DocumentoClinico]:
    """Lista documentos emitidos no prontuário."""
    consulta = select(DocumentoClinico).order_by(
        DocumentoClinico.criado_em.desc(), DocumentoClinico.id.desc()
    )
    if paciente_id is not None:
        consulta = consulta.where(DocumentoClinico.paciente_id == paciente_id)
    resultado = await db.scalars(consulta)
    return resultado.all()


@documentos_router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_documento(
    documento_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove um documento clínico."""
    documento = await buscar_ou_404(db, DocumentoClinico, documento_id, "Documento")
    await apagar(db, documento, "Não foi possível remover o documento.")
