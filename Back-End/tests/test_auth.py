"""Testes da autenticação JWT (rotas protegidas vs públicas, expiração e assinatura)."""

import pytest

import security
from tests.dados import DENTISTA

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize(
    "rota",
    [
        "/dentistas",
        "/pacientes",
        "/consultas",
        "/prontuarios",
        "/evolucoes",
        "/planos-tratamento",
        "/documentos",
        "/financeiro",
        "/dashboard",
        "/configuracoes",
        "/solicitacoes",
    ],
)
async def test_rotas_internas_exigem_token(public_client, rota):
    resp = await public_client.get(rota)
    assert resp.status_code == 401


async def test_rotas_publicas_funcionam_sem_token(public_client):
    health = await public_client.get("/health")
    assert health.status_code == 200

    sol = await public_client.post(
        "/solicitacoes",
        json={
            "nome": "Visitante Landing",
            "email": "visitante@example.com",
            "telefone": "(11) 99999-1234",
            "servico": "limpeza",
        },
    )
    assert sol.status_code == 201


async def test_login_emite_jwt_valido_e_bloqueia_invalido_ou_expirado(
    public_client, dentista
):
    login = await public_client.post(
        "/auth/login",
        json={"email": DENTISTA["email"], "senha": DENTISTA["senha"]},
    )
    assert login.status_code == 200
    corpo = login.json()
    assert corpo["token_type"] == "bearer"
    token = corpo["access_token"]
    assert len(token.split(".")) == 3

    ok = await public_client.get(
        "/dentistas", headers={"Authorization": f"Bearer {token}"}
    )
    assert ok.status_code == 200

    adulterado = await public_client.get(
        "/dentistas", headers={"Authorization": f"Bearer {token}x"}
    )
    assert adulterado.status_code == 401

    expirado = security.criar_token_jwt(
        dentista["id"], dentista["email"], expira_em_segundos=-10
    )
    resp_exp = await public_client.get(
        "/dentistas", headers={"Authorization": f"Bearer {expirado}"}
    )
    assert resp_exp.status_code == 401
