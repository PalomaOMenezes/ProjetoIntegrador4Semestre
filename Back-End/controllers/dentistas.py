"""Controller de cadastro de dentistas e autenticação."""

from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.comum import apagar, buscar_ou_404, salvar
from database import get_db
from models import Dentista
from schemas import (
    DentistaCreate,
    DentistaResponse,
    DentistaUpdate,
    LoginRequest,
    LoginResponse,
)
from security import (
    criar_token_jwt,
    exigir_autenticacao,
    gerar_hash,
    verificar_senha,
)

router = APIRouter(
    prefix="/dentistas",
    tags=["Dentistas"],
    dependencies=[Depends(exigir_autenticacao)],
)
auth_router = APIRouter(prefix="/auth", tags=["Autenticação"])

CONFLITO = "Já existe dentista com este CRO ou e-mail."


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DentistaResponse)
async def criar_dentista(
    dados: DentistaCreate, db: AsyncSession = Depends(get_db)
) -> Dentista:
    """Cadastra um novo profissional com senha armazenada apenas como hash."""
    dentista = Dentista(
        **dados.model_dump(exclude={"senha"}), senha_hash=gerar_hash(dados.senha)
    )
    await salvar(db, dentista, CONFLITO)
    return dentista


@router.get("", response_model=list[DentistaResponse])
async def listar_dentistas(
    db: AsyncSession = Depends(get_db),
) -> Sequence[Dentista]:
    """Lista os profissionais ordenados por nome."""
    resultado = await db.scalars(select(Dentista).order_by(Dentista.nome))
    return resultado.all()


@router.get("/{dentista_id}", response_model=DentistaResponse)
async def obter_dentista(
    dentista_id: int, db: AsyncSession = Depends(get_db)
) -> Dentista:
    """Retorna os dados de um dentista."""
    return await buscar_ou_404(db, Dentista, dentista_id, "Dentista")


@router.patch("/{dentista_id}", response_model=DentistaResponse)
async def atualizar_dentista(
    dentista_id: int, dados: DentistaUpdate, db: AsyncSession = Depends(get_db)
) -> Dentista:
    """Atualiza dados cadastrais ou senha de um profissional."""
    dentista = await buscar_ou_404(db, Dentista, dentista_id, "Dentista")
    campos = dados.model_dump(exclude_unset=True)
    if "senha" in campos:
        dentista.senha_hash = gerar_hash(campos.pop("senha"))
    if "cro" in campos:
        campos["cro"] = campos["cro"].strip().upper()
    for campo, valor in campos.items():
        setattr(dentista, campo, valor)
    await salvar(db, dentista, CONFLITO)
    return dentista


@router.delete("/{dentista_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_dentista(
    dentista_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Remove um dentista sem histórico clínico ou consultas associadas."""
    dentista = await buscar_ou_404(db, Dentista, dentista_id, "Dentista")
    await apagar(
        db,
        dentista,
        "Dentista tem consultas ou prontuários e não pode ser removido.",
    )


@auth_router.post("/login", response_model=LoginResponse)
async def login(
    dados: LoginRequest, db: AsyncSession = Depends(get_db)
) -> LoginResponse:
    """Autentica o profissional por e-mail/senha e emite token JWT Bearer."""
    dentista = await db.scalar(select(Dentista).where(Dentista.email == dados.email))
    if dentista is None or not verificar_senha(dados.senha, dentista.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha inválidos.")
    token = criar_token_jwt(dentista.id, dentista.email)
    return LoginResponse(
        id=dentista.id,
        nome=dentista.nome,
        cargo=dentista.cargo,
        cro=dentista.cro,
        email=dentista.email,
        access_token=token,
    )
