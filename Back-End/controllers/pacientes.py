"""Controller de cadastro, busca e atualização de pacientes."""

import re
from collections.abc import Sequence

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from models import Paciente, agora_utc
from schemas import PacienteCreate, PacienteResponse, PacienteUpdate
from security import exigir_autenticacao

router = APIRouter(
    prefix="/pacientes",
    tags=["Pacientes"],
    dependencies=[Depends(exigir_autenticacao)],
)

CONFLITO = "Já existe paciente com este CPF."


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PacienteResponse)
async def criar_paciente(
    dados: PacienteCreate, db: AsyncSession = Depends(get_db)
) -> Paciente:
    """Cadastra um novo paciente e registra data da anamnese quando preenchida."""
    payload = dados.model_dump()
    if payload.get("anamnese"):
        payload["anamnese_atualizada_em"] = agora_utc()
    paciente = Paciente(**payload)
    await salvar(db, paciente, CONFLITO)
    return paciente


@router.get("", response_model=list[PacienteResponse])
async def listar_pacientes(
    busca: str | None = None, db: AsyncSession = Depends(get_db)
) -> Sequence[Paciente]:
    """Lista pacientes. `busca` filtra por parte do nome ou do CPF."""
    consulta = select(Paciente).order_by(Paciente.nome)
    if busca:
        filtro = Paciente.nome.ilike(f"%{busca.strip()}%")
        digitos = re.sub(r"\D", "", busca)
        if digitos:
            filtro = filtro | Paciente.cpf.like(f"%{digitos}%")
        consulta = consulta.where(filtro)
    resultado = await db.scalars(consulta)
    return resultado.all()


@router.get("/{paciente_id}", response_model=PacienteResponse)
async def obter_paciente(
    paciente_id: int, db: AsyncSession = Depends(get_db)
) -> Paciente:
    """Retorna os dados completos de um paciente."""
    return await buscar_ou_404(db, Paciente, paciente_id, "Paciente")


@router.patch("/{paciente_id}", response_model=PacienteResponse)
async def atualizar_paciente(
    paciente_id: int, dados: PacienteUpdate, db: AsyncSession = Depends(get_db)
) -> Paciente:
    """Atualiza dados cadastrais ou anamnese de um paciente."""
    paciente = await buscar_ou_404(db, Paciente, paciente_id, "Paciente")
    campos = dados.model_dump(exclude_unset=True)
    if "anamnese" in campos and campos["anamnese"] != paciente.anamnese:
        paciente.anamnese_atualizada_em = (
            agora_utc() if campos["anamnese"] is not None else None
        )
    for campo, valor in campos.items():
        setattr(paciente, campo, valor)
    await salvar(db, paciente, CONFLITO)
    return paciente


@router.delete("/{paciente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_paciente(
    paciente_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove paciente se não houver histórico clínico ou consultas vinculadas."""
    paciente = await buscar_ou_404(db, Paciente, paciente_id, "Paciente")
    await apagar(
        db,
        paciente,
        "Paciente tem consultas ou prontuários e não pode ser removido.",
    )
