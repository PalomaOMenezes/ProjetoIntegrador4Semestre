"""Testes para evolução clínica, planos de tratamento, documentos e vínculo com odontograma."""

import pytest

pytestmark = pytest.mark.anyio


async def test_paciente_com_data_nascimento_e_timestamp_anamnese(client):
    payload = {
        "nome": "Pedro Alves",
        "telefone": "(11) 99999-9999",
        "cpf": "529.982.247-25",
        "data_nascimento": "1992-04-12",
        "endereco": "Rua das Flores, 100 - São Paulo/SP",
        "anamnese": "Alergia a penicilina.",
    }
    criado = await client.post("/pacientes", json=payload)
    assert criado.status_code == 201
    corpo = criado.json()
    assert corpo["data_nascimento"] == "1992-04-12"
    assert corpo["anamnese_atualizada_em"] is not None

    limpo = await client.patch(f"/pacientes/{corpo['id']}", json={"anamnese": "   "})
    assert limpo.status_code == 200
    assert limpo.json()["anamnese"] is None
    assert limpo.json()["anamnese_atualizada_em"] is None


async def test_fluxo_evolucao_clinica_e_vinculo_odontograma(client, paciente, dentista):
    criada = await client.post(
        "/evolucoes",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "queixa_principal": "Sensibilidade no dente 26.",
            "exame_clinico": "Cárie na face oclusal.",
            "procedimento_realizado": "Restauração em resina composta.",
            "prescricao_orientacoes": "Evitar alimentos rígidos por 24h.",
        },
    )
    assert criada.status_code == 201
    evolucao = criada.json()
    assert evolucao["status"] == "rascunho"

    # Vincula registro do odontograma à evolução (MER/DER: Prontuário 1:N Odontograma)
    odonto = await client.post(
        "/prontuarios",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "evolucao_id": evolucao["id"],
            "dente": 26,
            "face": "oclusal",
            "descricao": "Restauração resina A2.",
        },
    )
    assert odonto.status_code == 201
    assert odonto.json()["evolucao_id"] == evolucao["id"]

    filtrados = await client.get("/prontuarios", params={"evolucao_id": evolucao["id"]})
    assert len(filtrados.json()) == 1

    assinada = await client.patch(
        f"/evolucoes/{evolucao['id']}", json={"status": "assinado"}
    )
    assert assinada.status_code == 200
    assert assinada.json()["status"] == "assinado"
    assert assinada.json()["atualizado_em"] is not None

    removida = await client.delete(f"/evolucoes/{evolucao['id']}")
    assert removida.status_code == 204


async def test_plano_tratamento_e_documentos(client, paciente, dentista):
    item = await client.post(
        "/planos-tratamento",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "dente": 11,
            "procedimento": "Polimento estético",
            "valor": 250.0,
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]
    assert item.json()["status"] == "planejado"

    atualizado = await client.patch(
        f"/planos-tratamento/{item_id}", json={"status": "concluido"}
    )
    assert atualizado.status_code == 200
    assert atualizado.json()["status"] == "concluido"

    invalido = await client.post(
        "/planos-tratamento",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "dente": 99,
            "procedimento": "Teste inválido",
            "valor": 100.0,
        },
    )
    assert invalido.status_code == 422

    doc = await client.post(
        "/documentos",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "tipo": "atestado",
            "titulo": "Atestado de comparecimento",
            "conteudo": "Paciente esteve em atendimento odontológico hoje.",
        },
    )
    assert doc.status_code == 201
    docs = await client.get("/documentos", params={"paciente_id": paciente["id"]})
    assert len(docs.json()) == 1
    assert docs.json()[0]["tipo"] == "atestado"
