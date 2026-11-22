"""Funções reaproveitadas pelos controllers."""

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base

ModelT = TypeVar("ModelT", bound=Base)


async def buscar_ou_404(
    db: AsyncSession, modelo: type[ModelT], id_: int, nome: str
) -> ModelT:
    """Busca registro por chave primária ou lança HTTP 404."""
    objeto = await db.get(modelo, id_)
    if objeto is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"{nome} {id_} não encontrado(a)."
        )
    return objeto


async def salvar(db: AsyncSession, objeto: Base, conflito: str) -> None:
    """Grava no banco; se violar UNIQUE ou FOREIGN KEY, devolve 409."""
    db.add(objeto)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, conflito)
    await db.refresh(objeto)


async def apagar(db: AsyncSession, objeto: Base, conflito: str) -> None:
    """Remove o registro; se houver vínculo com ON DELETE RESTRICT, devolve 409."""
    await db.delete(objeto)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, conflito)
