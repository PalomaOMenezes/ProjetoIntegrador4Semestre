"""Conexão assíncrona com o banco de dados e utilitários de migração leve."""

import os
from collections.abc import AsyncIterator

from sqlalchemy import event, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Na Vercel o diretório do app é read-only; /tmp permite SQLite de demonstração.
_DEFAULT_DB_URL = (
    "sqlite+aiosqlite:////tmp/poc.db"
    if os.getenv("VERCEL")
    else "sqlite+aiosqlite:///./poc.db"
)
DATABASE_URL = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


class Base(DeclarativeBase):
    """Classe base para os modelos ORM do SQLAlchemy."""


def ativar_chaves_estrangeiras(sync_engine: Engine) -> None:
    """O SQLite só respeita FOREIGN KEY com este PRAGMA ligado em cada conexão."""

    @event.listens_for(sync_engine, "connect")
    def _ligar_fk(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


ativar_chaves_estrangeiras(engine.sync_engine)


_MIGRACOES_COLUNAS: tuple[tuple[str, str, str], ...] = (
    ("paciente", "data_nascimento", "DATE"),
    ("paciente", "anamnese_atualizada_em", "DATETIME"),
    (
        "consulta",
        "procedimento",
        "VARCHAR(200) NOT NULL DEFAULT 'Avaliação inicial'",
    ),
    ("consulta", "valor_estimado", "FLOAT"),
    ("prontuario", "evolucao_id", "INTEGER"),
)


def garantir_colunas_legado(sync_conn: Connection) -> None:
    """Adiciona colunas novas em bancos SQLite pré-existentes sem apagar dados."""
    for tabela, coluna, definicao in _MIGRACOES_COLUNAS:
        info = sync_conn.execute(text(f"PRAGMA table_info({tabela})")).fetchall()
        existentes = {row[1] for row in info}
        if existentes and coluna not in existentes:
            sync_conn.execute(
                text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}")
            )


async def get_db() -> AsyncIterator[AsyncSession]:
    """Fornece uma sessão assíncrona do banco para cada requisição."""
    async with AsyncSessionLocal() as session:
        yield session
