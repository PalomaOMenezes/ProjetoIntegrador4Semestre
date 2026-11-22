"""Controller das fichas de evolução clínica do prontuário eletrônico."""

from collections.abc import Sequence

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from models import Consulta, Dentista, EvolucaoClinica, Paciente, agora_utc
from schemas import EvolucaoCreate, EvolucaoResponse, EvolucaoUpdate
from security import exigir_autenticacao

router = APIRouter(
    prefix="/evolucoes",
    tags=["Prontuário / Evolução Clínica"],
    dependencies=[Depends(exigir_autenticacao)],
)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EvolucaoResponse)
async def criar_evolucao(
    dados: EvolucaoCreate, db: AsyncSession = Depends(get_db)
) -> EvolucaoClinica:
    """Registra uma ficha estruturada de evolução clínica."""
    await buscar_ou_404(db, Paciente, dados.paciente_id, "Paciente")
    await buscar_ou_404(db, Dentista, dados.dentista_id, "Dentista")
    if dados.consulta_id is not None:
        await buscar_ou_404(db, Consulta, dados.consulta_id, "Consulta")
    evolucao = EvolucaoClinica(**dados.model_dump())
    await salvar(db, evolucao, "Não foi possível salvar a evolução clínica.")
    return evolucao


@router.get("", response_model=list[EvolucaoResponse])
async def listar_evolucoes(
    paciente_id: int | None = None,
    consulta_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> Sequence[EvolucaoClinica]:
    """Lista fichas de evolução clínica da mais recente para a mais antiga."""
    consulta = select(EvolucaoClinica).order_by(
        EvolucaoClinica.criado_em.desc(), EvolucaoClinica.id.desc()
    )
    if paciente_id is not None:
        consulta = consulta.where(EvolucaoClinica.paciente_id == paciente_id)
    if consulta_id is not None:
        consulta = consulta.where(EvolucaoClinica.consulta_id == consulta_id)
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.get("/{evolucao_id}", response_model=EvolucaoResponse)
async def obter_evolucao(
    evolucao_id: int, db: AsyncSession = Depends(get_db)
) -> EvolucaoClinica:
    """Obtém uma ficha de evolução clínica por ID."""
    return await buscar_ou_404(db, EvolucaoClinica, evolucao_id, "Evolução clínica")


@router.patch("/{evolucao_id}", response_model=EvolucaoResponse)
async def atualizar_evolucao(
    evolucao_id: int, dados: EvolucaoUpdate, db: AsyncSession = Depends(get_db)
) -> EvolucaoClinica:
    """Atualiza campos ou status de assinatura da evolução clínica."""
    evolucao = await buscar_ou_404(db, EvolucaoClinica, evolucao_id, "Evolução clínica")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(evolucao, campo, valor)
    evolucao.atualizado_em = agora_utc()
    await salvar(db, evolucao, "Não foi possível atualizar a evolução clínica.")
    return evolucao


@router.delete("/{evolucao_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_evolucao(
    evolucao_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove uma ficha de evolução clínica."""
    evolucao = await buscar_ou_404(db, EvolucaoClinica, evolucao_id, "Evolução clínica")
    await apagar(db, evolucao, "Não foi possível remover a evolução clínica.")
