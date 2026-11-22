"""Fixtures compartilhadas dos testes da API."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import security
from database import Base, ativar_chaves_estrangeiras, get_db
from main import app
from tests.dados import DENTISTA, PACIENTE

# Banco em memória, isolado do poc.db. StaticPool = todas as sessões usam a mesma conexão.
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
ativar_chaves_estrangeiras(test_engine.sync_engine)
TestingSessionLocal = async_sessionmaker(
    test_engine, expire_on_commit=False, class_=AsyncSession
)

# Senha com poucas iterações só nos testes, para rodarem rápido.
security.ITERACOES = 1_000


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def prepare_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def public_client():
    """Cliente HTTP sem token Bearer, para testar rotas públicas e bloqueios 401."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def client():
    """Cliente HTTP autenticado com JWT Bearer real."""
    token = security.criar_token_jwt(1, DENTISTA["email"])
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as c:
        yield c


@pytest.fixture
async def dentista(client):
    resposta = await client.post("/dentistas", json=DENTISTA)
    return resposta.json()


@pytest.fixture
async def paciente(client):
    resposta = await client.post("/pacientes", json=PACIENTE)
    return resposta.json()
