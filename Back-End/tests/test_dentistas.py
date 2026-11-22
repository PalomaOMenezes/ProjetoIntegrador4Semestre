import pytest

from tests.dados import DENTISTA

pytestmark = pytest.mark.anyio


async def test_criar_dentista_nao_devolve_senha(client):
    resposta = await client.post("/dentistas", json=DENTISTA)
    assert resposta.status_code == 201
    dados = resposta.json()
    assert dados["cro"] == "CRO-SP 12345"
    assert "senha" not in dados and "senha_hash" not in dados


async def test_cro_duplicado_retorna_409(client, dentista):
    resposta = await client.post(
        "/dentistas", json={**DENTISTA, "email": "outro@smileclinic.com"}
    )
    assert resposta.status_code == 409
    assert "CRO" in resposta.json()["message"]


async def test_login_ok_e_senha_errada(client, dentista):
    ok = await client.post(
        "/auth/login", json={"email": DENTISTA["email"], "senha": DENTISTA["senha"]}
    )
    assert ok.status_code == 200
    assert ok.json()["id"] == dentista["id"]

    errado = await client.post(
        "/auth/login", json={"email": DENTISTA["email"], "senha": "errada123"}
    )
    assert errado.status_code == 401


async def test_trocar_senha(client, dentista):
    await client.patch(f"/dentistas/{dentista['id']}", json={"senha": "novaSenha99"})
    resposta = await client.post(
        "/auth/login", json={"email": DENTISTA["email"], "senha": "novaSenha99"}
    )
    assert resposta.status_code == 200


async def test_dentista_inexistente_retorna_404(client):
    resposta = await client.get("/dentistas/999")
    assert resposta.status_code == 404
    assert "message" in resposta.json()
