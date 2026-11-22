import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.anyio
async def test_criar_solicitacao_sucesso():
    payload = {
        "nome": "João da Silva",
        "email": "joao@email.com",
        "telefone": "(11) 99999-9999",
        "servico": "limpeza",
        "mensagem": "Gostaria de agendar para a próxima semana.",
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
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
        "servico": "limpeza",
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/solicitacoes", json=payload)

    assert response.status_code == 422
    data = response.json()
    assert "message" in data


@pytest.mark.anyio
async def test_criar_solicitacao_telefone_com_poucos_digitos(client):
    payload = {
        "nome": "João",
        "email": "joao@email.com",
        "telefone": "(11) 9999",
        "servico": "limpeza",
    }
    response = await client.post("/solicitacoes", json=payload)
    assert response.status_code == 422
