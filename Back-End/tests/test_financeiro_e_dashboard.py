"""Testes do módulo financeiro, dashboard gerencial, solicitações e configurações."""

import pytest

pytestmark = pytest.mark.anyio


async def test_financeiro_crud_e_liquidacao(client, paciente, dentista):
    criado = await client.post(
        "/financeiro",
        json={
            "tipo": "receita",
            "descricao": "Restauração dente 26",
            "categoria": "Dentística",
            "valor": 480.0,
            "status": "pendente",
            "data_competencia": "2026-10-15",
            "forma_pagamento": "PIX",
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
        },
    )
    assert criado.status_code == 201
    lanc = criado.json()
    assert lanc["data_pagamento"] is None

    pago = await client.patch(f"/financeiro/{lanc['id']}", json={"status": "pago"})
    assert pago.status_code == 200
    assert pago.json()["status"] == "pago"
    assert pago.json()["data_pagamento"] is not None

    lista = await client.get(
        "/financeiro", params={"tipo": "receita", "busca": "Restauração"}
    )
    assert len(lista.json()) == 1

    removido = await client.delete(f"/financeiro/{lanc['id']}")
    assert removido.status_code == 204


async def test_dashboard_indicadores_e_exportacao_csv(client, paciente, dentista):
    # Receita no mês anterior (setembro/2026): R$ 1.000
    await client.post(
        "/financeiro",
        json={
            "tipo": "receita",
            "descricao": "Atendimento setembro",
            "categoria": "Consultas",
            "valor": 1000.0,
            "status": "pago",
            "data_competencia": "2026-09-20",
            "dentista_id": dentista["id"],
        },
    )
    # Receitas em outubro/2026: R$ 800 recebido + R$ 400 pendente = R$ 1.200 (+20%)
    await client.post(
        "/financeiro",
        json={
            "tipo": "receita",
            "descricao": "Clareamento",
            "categoria": "Estética",
            "valor": 800.0,
            "status": "pago",
            "data_competencia": "2026-10-10",
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
        },
    )
    await client.post(
        "/financeiro",
        json={
            "tipo": "receita",
            "descricao": "Restauração",
            "categoria": "Dentística",
            "valor": 400.0,
            "status": "pendente",
            "data_competencia": "2026-10-12",
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
        },
    )
    # Despesa paga em outubro/2026: R$ 300 -> saldo R$ 500
    await client.post(
        "/financeiro",
        json={
            "tipo": "despesa",
            "descricao": "Materiais",
            "categoria": "Insumos",
            "valor": 300.0,
            "status": "pago",
            "data_competencia": "2026-10-11",
        },
    )
    # Consultas em outubro/2026: 2 realizadas, 1 falta -> taxa de faltas 33.3%
    await client.post(
        "/consultas",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "data_hora": "2026-10-10T09:00:00",
            "procedimento": "Clareamento",
            "status": "realizada",
        },
    )
    await client.post(
        "/consultas",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "data_hora": "2026-10-12T10:00:00",
            "procedimento": "Restauração",
            "status": "realizada",
        },
    )
    await client.post(
        "/consultas",
        json={
            "paciente_id": paciente["id"],
            "dentista_id": dentista["id"],
            "data_hora": "2026-10-15T11:00:00",
            "procedimento": "Retorno",
            "status": "falta",
        },
    )

    resp = await client.get(
        "/dashboard",
        params={"data_inicio": "2026-10-01", "data_fim": "2026-10-31"},
    )
    assert resp.status_code == 200
    dados = resp.json()
    assert dados["faturamento_bruto"] == 1200.0
    assert dados["variacao_faturamento_pct"] == 20.0
    assert dados["valor_recebido"] == 800.0
    assert dados["valor_a_receber"] == 400.0
    assert dados["despesas_pagas"] == 300.0
    assert dados["saldo_periodo"] == 500.0
    assert dados["atendimentos_realizados"] == 2
    assert dados["pacientes_unicos"] == 1
    assert dados["ticket_medio"] == 600.0
    assert dados["taxa_faltas_pct"] == 33.3
    assert len(dados["serie_mensal"]) == 6
    assert dados["serie_mensal"][-1]["ano_mes"] == "2026-10"
    assert dados["serie_mensal"][-1]["receitas"] == 1200.0
    assert dados["serie_mensal"][-1]["despesas"] == 300.0

    csv_resp = await client.get(
        "/dashboard/exportar",
        params={"data_inicio": "2026-10-01", "data_fim": "2026-10-31"},
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Faturamento bruto" in csv_resp.text
    assert "1200.00" in csv_resp.text


async def test_solicitacoes_listagem_e_configuracoes(client):
    criada = await client.post(
        "/solicitacoes",
        json={
            "nome": "Helena Martins",
            "email": "helena@example.com",
            "telefone": "(11) 98123-4567",
            "servico": "clareamento",
        },
    )
    assert criada.status_code == 201
    sol_id = criada.json()["id"]

    pendentes = await client.get(
        "/solicitacoes", params={"status_solicitacao": "pendente"}
    )
    assert len(pendentes.json()) == 1

    atualizada = await client.patch(
        f"/solicitacoes/{sol_id}", json={"status": "agendado"}
    )
    assert atualizada.status_code == 200
    assert atualizada.json()["status"] == "agendado"

    cfg = await client.get("/configuracoes")
    assert cfg.status_code == 200
    assert cfg.json()["nome_clinica"] == "SmileClinic"

    cfg_edit = await client.patch(
        "/configuracoes",
        json={"unidade": "Unidade Jardins", "slots_diarios_por_dentista": 12},
    )
    assert cfg_edit.status_code == 200
    assert cfg_edit.json()["unidade"] == "Unidade Jardins"
    assert cfg_edit.json()["slots_diarios_por_dentista"] == 12


async def test_faturar_consulta_e_bloquear_duplicata(client, paciente, dentista):
    consulta = (
        await client.post(
            "/consultas",
            json={
                "paciente_id": paciente["id"],
                "dentista_id": dentista["id"],
                "data_hora": "2026-11-10T10:00:00",
                "procedimento": "Clareamento",
                "valor_estimado": 850.0,
                "status": "realizada",
            },
        )
    ).json()

    faturada = await client.post(
        f"/consultas/{consulta['id']}/faturar",
        json={"forma_pagamento": "PIX", "status": "pago"},
    )
    assert faturada.status_code == 201
    lanc = faturada.json()
    assert lanc["valor"] == 850.0
    assert lanc["consulta_id"] == consulta["id"]
    assert lanc["status"] == "pago"

    duplicada = await client.post(
        f"/consultas/{consulta['id']}/faturar",
        json={"forma_pagamento": "PIX", "status": "pago"},
    )
    assert duplicada.status_code == 409
