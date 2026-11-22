"""Controller de registros do odontograma (notação FDI)."""

from collections.abc import Sequence

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from models import Dentista, EvolucaoClinica, Paciente, Prontuario
from schemas import ProntuarioCreate, ProntuarioResponse, ProntuarioUpdate
from security import exigir_autenticacao

router = APIRouter(
    prefix="/prontuarios",
    tags=["Prontuário / Odontograma"],
    dependencies=[Depends(exigir_autenticacao)],
)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProntuarioResponse)
async def criar_registro(
    dados: ProntuarioCreate, db: AsyncSession = Depends(get_db)
) -> Prontuario:
    """Cria um registro odontológico por dente/face, opcionalmente ligado à evolução."""
    await buscar_ou_404(db, Paciente, dados.paciente_id, "Paciente")
    await buscar_ou_404(db, Dentista, dados.dentista_id, "Dentista")
    if dados.evolucao_id is not None:
        await buscar_ou_404(db, EvolucaoClinica, dados.evolucao_id, "Evolução clínica")
    registro = Prontuario(**dados.model_dump())
    await salvar(db, registro, "Não foi possível salvar o registro.")
    return registro


@router.get("", response_model=list[ProntuarioResponse])
async def listar_registros(
    paciente_id: int | None = None,
    dente: int | None = None,
    evolucao_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> Sequence[Prontuario]:
    """Histórico do odontograma, do mais recente para o mais antigo."""
    consulta = select(Prontuario).order_by(
        Prontuario.criado_em.desc(), Prontuario.id.desc()
    )
    if paciente_id is not None:
        consulta = consulta.where(Prontuario.paciente_id == paciente_id)
    if dente is not None:
        consulta = consulta.where(Prontuario.dente == dente)
    if evolucao_id is not None:
        consulta = consulta.where(Prontuario.evolucao_id == evolucao_id)
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.get("/{registro_id}", response_model=ProntuarioResponse)
async def obter_registro(
    registro_id: int, db: AsyncSession = Depends(get_db)
) -> Prontuario:
    """Retorna um registro específico do odontograma."""
    return await buscar_ou_404(db, Prontuario, registro_id, "Registro de prontuário")


@router.patch("/{registro_id}", response_model=ProntuarioResponse)
async def atualizar_registro(
    registro_id: int, dados: ProntuarioUpdate, db: AsyncSession = Depends(get_db)
) -> Prontuario:
    """Atualiza dente, face ou descrição de um registro do odontograma."""
    registro = await buscar_ou_404(
        db, Prontuario, registro_id, "Registro de prontuário"
    )
    campos = dados.model_dump(exclude_unset=True)
    if campos.get("evolucao_id") is not None:
        await buscar_ou_404(
            db, EvolucaoClinica, campos["evolucao_id"], "Evolução clínica"
        )
    for campo, valor in campos.items():
        setattr(registro, campo, valor)
    await salvar(db, registro, "Não foi possível salvar o registro.")
    return registro


@router.delete("/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_registro(
    registro_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove um registro do odontograma."""
    registro = await buscar_ou_404(
        db, Prontuario, registro_id, "Registro de prontuário"
    )
    await apagar(db, registro, "Não foi possível remover o registro.")
