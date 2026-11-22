import pytest

pytestmark = pytest.mark.anyio


def registro(paciente, dentista, **extra):
    return {
        "paciente_id": paciente["id"],
        "dentista_id": dentista["id"],
        "dente": 26,
        "face": "oclusal",
        "descricao": "Restauração em resina.",
        **extra,
    }


async def test_registrar_no_odontograma(client, paciente, dentista):
    resposta = await client.post("/prontuarios", json=registro(paciente, dentista))
    assert resposta.status_code == 201
    assert resposta.json()["dente"] == 26


@pytest.mark.parametrize("dente", [10, 19, 51, 9])
async def test_dente_fora_da_notacao_fdi(client, paciente, dentista, dente):
    resposta = await client.post(
        "/prontuarios", json=registro(paciente, dentista, dente=dente)
    )
    assert resposta.status_code == 422


async def test_face_invalida(client, paciente, dentista):
    resposta = await client.post(
        "/prontuarios", json=registro(paciente, dentista, face="cima")
    )
    assert resposta.status_code == 422


async def test_historico_do_paciente(client, paciente, dentista):
    await client.post("/prontuarios", json=registro(paciente, dentista, dente=11))
    await client.post("/prontuarios", json=registro(paciente, dentista, dente=36))
    resposta = await client.get("/prontuarios", params={"paciente_id": paciente["id"]})
    assert [r["dente"] for r in resposta.json()] == [36, 11]
