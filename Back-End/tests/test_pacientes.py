import pytest

from tests.dados import PACIENTE

pytestmark = pytest.mark.anyio


async def test_criar_paciente_guarda_so_digitos(client):
    resposta = await client.post("/pacientes", json=PACIENTE)
    assert resposta.status_code == 201
    dados = resposta.json()
    assert dados["cpf"] == "52998224725"
    assert dados["telefone"] == "11999999999"


async def test_cpf_invalido_retorna_422(client):
    resposta = await client.post(
        "/pacientes", json={**PACIENTE, "cpf": "111.111.111-11"}
    )
    assert resposta.status_code == 422
    assert "cpf" in resposta.json()["message"]


async def test_cpf_duplicado_retorna_409(client, paciente):
    resposta = await client.post("/pacientes", json=PACIENTE)
    assert resposta.status_code == 409


async def test_buscar_paciente_por_nome(client, paciente):
    resposta = await client.get("/pacientes", params={"busca": "joão"})
    assert [p["id"] for p in resposta.json()] == [paciente["id"]]


async def test_atualizar_e_remover_paciente(client, paciente):
    resposta = await client.patch(
        f"/pacientes/{paciente['id']}", json={"endereco": "Av. Paulista, 1000"}
    )
    assert resposta.json()["endereco"] == "Av. Paulista, 1000"

    assert (await client.delete(f"/pacientes/{paciente['id']}")).status_code == 204
    assert (await client.get(f"/pacientes/{paciente['id']}")).status_code == 404


async def test_nao_remove_paciente_com_consulta(client, paciente, dentista):
    await client.post(
        "/consultas",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "data_hora": "2026-12-01T14:00:00",
        },
    )
    resposta = await client.delete(f"/pacientes/{paciente['id']}")
    assert resposta.status_code == 409


async def test_buscar_paciente_por_cpf_com_pontuacao(client, paciente):
    resposta = await client.get("/pacientes", params={"busca": "529.982"})
    assert [p["id"] for p in resposta.json()] == [paciente["id"]]


async def test_apagar_anamnese_do_paciente(client, paciente):
    resposta = await client.patch(f"/pacientes/{paciente['id']}", json={"anamnese": ""})
    assert resposta.status_code == 200
    assert resposta.json()["anamnese"] is None
