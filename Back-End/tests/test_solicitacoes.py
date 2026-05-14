import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from main import app
from database import get_db, Base

# Configura banco em memória isolado para os testes
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
async def prepare_database():
    # Cria as tabelas antes de cada teste e recria
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.anyio
async def test_criar_solicitacao_sucesso():
    payload = {
        "nome": "João da Silva",
        "email": "joao@email.com",
        "telefone": "(11) 99999-9999",
        "servico": "limpeza",
        "mensagem": "Gostaria de agendar para a próxima semana."
    }
    # lifespan do app cria o banco poc.db, mas o Depends usará memory DB
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/solicitacoes", json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["message"] == "Solicitação enviada com sucesso"

@pytest.mark.anyio
async def test_criar_solicitacao_email_invalido():
    payload = {
        "nome": "João da Silva",
        "email": "email_invalido",
        "telefone": "(11) 99999-9999",
        "servico": "limpeza"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/solicitacoes", json=payload)
    
    assert response.status_code == 422
    data = response.json()
    assert "message" in data
