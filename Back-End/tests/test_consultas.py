import pytest

pytestmark = pytest.mark.anyio


def nova_consulta(paciente, dentista, data_hora="2026-12-01T14:00:00"):
    return {
        "paciente_id": paciente["id"],
        "dentista_id": dentista["id"],
        "data_hora": data_hora,
    }


async def test_agendar_consulta(client, paciente, dentista):
    resposta = await client.post("/consultas", json=nova_consulta(paciente, dentista))
    assert resposta.status_code == 201
    assert resposta.json()["status"] == "agendada"


async def test_paciente_inexistente_retorna_404(client, dentista):
    resposta = await client.post(
        "/consultas", json=nova_consulta({"id": 999}, dentista)
    )
    assert resposta.status_code == 404


async def test_dentista_nao_pode_ter_dois_pacientes_no_mesmo_horario(
    client, paciente, dentista
):
    await client.post("/consultas", json=nova_consulta(paciente, dentista))
    resposta = await client.post("/consultas", json=nova_consulta(paciente, dentista))
    assert resposta.status_code == 409


async def test_agenda_do_dia(client, paciente, dentista):
    await client.post(
        "/consultas", json=nova_consulta(paciente, dentista, "2026-12-01T09:00:00")
    )
    await client.post(
        "/consultas", json=nova_consulta(paciente, dentista, "2026-12-02T09:00:00")
    )
    resposta = await client.get("/consultas", params={"data": "2026-12-01"})
    assert len(resposta.json()) == 1


async def test_mudar_status(client, paciente, dentista):
    consulta = (
        await client.post("/consultas", json=nova_consulta(paciente, dentista))
    ).json()
    resposta = await client.patch(
        f"/consultas/{consulta['id']}", json={"status": "confirmada"}
    )
    assert resposta.json()["status"] == "confirmada"

    invalido = await client.patch(
        f"/consultas/{consulta['id']}", json={"status": "talvez"}
    )
    assert invalido.status_code == 422


async def test_horario_de_consulta_cancelada_pode_ser_reagendado(
    client, paciente, dentista
):
    consulta = (
        await client.post("/consultas", json=nova_consulta(paciente, dentista))
    ).json()
    await client.patch(f"/consultas/{consulta['id']}", json={"status": "cancelada"})
    resposta = await client.post("/consultas", json=nova_consulta(paciente, dentista))
    assert resposta.status_code == 201


async def test_fluxo_recepcao_status_procedimento_e_busca(client, paciente, dentista):
    payload = {
        **nova_consulta(paciente, dentista, "2026-12-03T10:30:00"),
        "procedimento": "Restauração · dente 26",
        "status": "na_recepcao",
    }
    criada = await client.post("/consultas", json=payload)
    assert criada.status_code == 201
    consulta = criada.json()
    assert consulta["procedimento"] == "Restauração · dente 26"
    assert consulta["status"] == "na_recepcao"

    em_atend = await client.patch(
        f"/consultas/{consulta['id']}", json={"status": "em_atendimento"}
    )
    assert em_atend.status_code == 200
    assert em_atend.json()["status"] == "em_atendimento"

    por_nome = await client.get("/consultas", params={"busca": "João"})
    assert len(por_nome.json()) == 1

    por_cpf = await client.get("/consultas", params={"busca": "529.982"})
    assert len(por_cpf.json()) == 1
