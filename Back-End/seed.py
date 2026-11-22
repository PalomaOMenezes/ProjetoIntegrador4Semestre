"""Popula o banco com dados de exemplo completos para demonstração.

Uso:  uv run python seed.py
Login de exemplo:  ana@smileclinic.com  /  smile2026
"""

import asyncio
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, Base, engine, garantir_colunas_legado
from enums import (
    FaceDente,
    StatusConsulta,
    StatusEvolucao,
    StatusLancamento,
    StatusPlanoTratamento,
    TipoDocumentoClinico,
    TipoLancamento,
)
from models import (
    ConfiguracaoClinica,
    Consulta,
    Dentista,
    DocumentoClinico,
    EvolucaoClinica,
    LancamentoFinanceiro,
    Paciente,
    PlanoTratamentoItem,
    Prontuario,
    SolicitacaoAgendamento,
    agora_utc,
)
from security import gerar_hash


def _mes_anterior(ano: int, mes: int, passos: int) -> date:
    """Retorna o dia 15 de `passos` meses atrás."""
    total = (ano * 12 + (mes - 1)) - passos
    alvo_ano, alvo_mes_zero = divmod(total, 12)
    return date(alvo_ano, alvo_mes_zero + 1, 15)


async def popular_dados_exemplo(db: AsyncSession) -> bool:
    """Insere massa de demonstração se ainda não houver dentistas cadastrados."""
    if await db.scalar(select(Dentista).limit(1)):
        return False

    config = ConfiguracaoClinica(
        id=1,
        nome_clinica="SmileClinic",
        unidade="Unidade principal",
        telefone="(11) 3000-0000",
        endereco="Av. Paulista, 1000 - São Paulo/SP",
        horario_funcionamento="Seg a Sex, 08:00 às 19:00",
        slots_diarios_por_dentista=10,
    )

    ana = Dentista(
        nome="Dra. Ana Souza",
        cargo="Clínica Geral",
        cro="CRO-SP 12345",
        email="ana@smileclinic.com",
        senha_hash=gerar_hash("smile2026"),
    )
    bruno = Dentista(
        nome="Dr. Bruno Lima",
        cargo="Ortodontista",
        cro="CRO-SP 67890",
        email="bruno@smileclinic.com",
        senha_hash=gerar_hash("smile2026"),
    )
    lucas = Dentista(
        nome="Dr. Lucas Reis",
        cargo="Implantodontista",
        cro="CRO-SP 45210",
        email="lucas@smileclinic.com",
        senha_hash=gerar_hash("smile2026"),
    )

    agora = agora_utc()
    pacientes = [
        Paciente(
            nome="Pedro Alves",
            telefone="11999999999",
            cpf="52998224725",
            data_nascimento=date(1992, 4, 12),
            endereco="Rua das Flores, 100 - São Paulo/SP",
            anamnese="Alergia a penicilina. Sem uso contínuo de medicamentos.",
            anamnese_atualizada_em=agora - timedelta(days=8),
        ),
        Paciente(
            nome="Mariana Costa",
            telefone="11988887777",
            cpf="12345678909",
            data_nascimento=date(1988, 9, 24),
            endereco="Av. Paulista, 1000 - São Paulo/SP",
            anamnese="Hipertensa controlada com losartana 50mg.",
            anamnese_atualizada_em=agora - timedelta(days=15),
        ),
        Paciente(
            nome="Camila Souza",
            telefone="11977776666",
            cpf="98765432100",
            data_nascimento=date(1996, 1, 18),
            endereco="Rua Augusta, 250 - São Paulo/SP",
            anamnese=None,
            anamnese_atualizada_em=None,
        ),
        Paciente(
            nome="Rafael Santos",
            telefone="11966665555",
            cpf="11144477735",
            data_nascimento=date(2000, 7, 3),
            endereco="Rua Oscar Freire, 420 - São Paulo/SP",
            anamnese="Uso de aparelho ortodôntico fixo há 14 meses.",
            anamnese_atualizada_em=agora - timedelta(days=30),
        ),
        Paciente(
            nome="Beatriz Oliveira",
            telefone="11955554444",
            cpf="39053344705",
            data_nascimento=date(1984, 11, 9),
            endereco="Alameda Santos, 780 - São Paulo/SP",
            anamnese="Sensibilidade dentinária em molares inferiores.",
            anamnese_atualizada_em=agora - timedelta(days=5),
        ),
        Paciente(
            nome="Felipe Rocha",
            telefone="11944443333",
            cpf="71428793860",
            data_nascimento=date(1990, 3, 27),
            endereco="Rua Vergueiro, 1450 - São Paulo/SP",
            anamnese=None,
            anamnese_atualizada_em=None,
        ),
    ]

    db.add_all([config, ana, bruno, lucas, *pacientes])
    await db.flush()

    hoje = date.today()
    inicio_mes = date(hoje.year, hoje.month, 1)

    def em(dias: int, hora_num: int, minuto: int = 0) -> datetime:
        return datetime.combine(hoje + timedelta(days=dias), time(hora_num, minuto))

    consultas_hoje = [
        Consulta(
            paciente_id=pacientes[1].id,
            dentista_id=ana.id,
            data_hora=em(0, 8, 0),
            procedimento="Avaliação inicial",
            valor_estimado=280.0,
            status=StatusConsulta.realizada,
        ),
        Consulta(
            paciente_id=pacientes[0].id,
            dentista_id=lucas.id,
            data_hora=em(0, 8, 45),
            procedimento="Restauração · dente 26",
            valor_estimado=480.0,
            status=StatusConsulta.em_atendimento,
        ),
        Consulta(
            paciente_id=pacientes[2].id,
            dentista_id=ana.id,
            data_hora=em(0, 9, 30),
            procedimento="Limpeza e profilaxia",
            valor_estimado=320.0,
            status=StatusConsulta.na_recepcao,
        ),
        Consulta(
            paciente_id=pacientes[3].id,
            dentista_id=bruno.id,
            data_hora=em(0, 10, 15),
            procedimento="Retorno ortodôntico",
            valor_estimado=250.0,
            status=StatusConsulta.na_recepcao,
        ),
        Consulta(
            paciente_id=pacientes[4].id,
            dentista_id=ana.id,
            data_hora=em(0, 11, 0),
            procedimento="Avaliação inicial",
            valor_estimado=280.0,
            status=StatusConsulta.confirmada,
        ),
        Consulta(
            paciente_id=pacientes[5].id,
            dentista_id=lucas.id,
            data_hora=em(0, 11, 45),
            procedimento="Limpeza e profilaxia",
            valor_estimado=320.0,
            status=StatusConsulta.confirmada,
        ),
        Consulta(
            paciente_id=pacientes[0].id,
            dentista_id=bruno.id,
            data_hora=em(0, 14, 0),
            procedimento="Moldagem digital",
            valor_estimado=390.0,
            status=StatusConsulta.agendada,
        ),
        Consulta(
            paciente_id=pacientes[2].id,
            dentista_id=lucas.id,
            data_hora=em(0, 15, 30),
            procedimento="Clareamento em consultório",
            valor_estimado=950.0,
            status=StatusConsulta.confirmada,
        ),
    ]

    consultas_semana_e_mes = [
        Consulta(
            paciente_id=pacientes[0].id,
            dentista_id=ana.id,
            data_hora=datetime.combine(inicio_mes + timedelta(days=1), time(9, 0)),
            procedimento="Avaliação inicial",
            valor_estimado=280.0,
            status=StatusConsulta.realizada,
        ),
        Consulta(
            paciente_id=pacientes[1].id,
            dentista_id=lucas.id,
            data_hora=datetime.combine(inicio_mes + timedelta(days=2), time(10, 30)),
            procedimento="Implante unitário · etapa 1",
            valor_estimado=2400.0,
            status=StatusConsulta.realizada,
        ),
        Consulta(
            paciente_id=pacientes[3].id,
            dentista_id=bruno.id,
            data_hora=datetime.combine(inicio_mes + timedelta(days=3), time(14, 0)),
            procedimento="Manutenção ortodôntica",
            valor_estimado=250.0,
            status=StatusConsulta.realizada,
        ),
        Consulta(
            paciente_id=pacientes[4].id,
            dentista_id=ana.id,
            data_hora=datetime.combine(inicio_mes + timedelta(days=4), time(16, 0)),
            procedimento="Profilaxia completa",
            valor_estimado=320.0,
            status=StatusConsulta.falta,
        ),
        Consulta(
            paciente_id=pacientes[5].id,
            dentista_id=lucas.id,
            data_hora=datetime.combine(inicio_mes + timedelta(days=5), time(11, 0)),
            procedimento="Restauração em resina",
            valor_estimado=540.0,
            status=StatusConsulta.realizada,
        ),
        Consulta(
            paciente_id=pacientes[0].id,
            dentista_id=bruno.id,
            data_hora=em(1, 11, 0),
            procedimento="Revisão pós-restauração",
            valor_estimado=180.0,
            status=StatusConsulta.agendada,
        ),
        Consulta(
            paciente_id=pacientes[3].id,
            dentista_id=ana.id,
            data_hora=em(2, 10, 0),
            procedimento="Profilaxia semestral",
            valor_estimado=320.0,
            status=StatusConsulta.confirmada,
        ),
        Consulta(
            paciente_id=pacientes[4].id,
            dentista_id=lucas.id,
            data_hora=em(-1, 15, 0),
            procedimento="Consulta de retorno",
            valor_estimado=200.0,
            status=StatusConsulta.realizada,
        ),
    ]

    db.add_all([*consultas_hoje, *consultas_semana_e_mes])
    await db.flush()

    evolucao_anterior = EvolucaoClinica(
        paciente_id=pacientes[0].id,
        dentista_id=ana.id,
        consulta_id=consultas_semana_e_mes[0].id,
        queixa_principal="Revisão semestral de rotina.",
        exame_clinico="Lesão cariosa incipiente em face oclusal do dente 26.",
        procedimento_realizado="Avaliação inicial e radiografia interproximal.",
        prescricao_orientacoes=(
            "Escovação com creme dental fluoretado e fio dental diário."
        ),
        status=StatusEvolucao.assinado,
        criado_em=agora - timedelta(days=8),
    )
    evolucao_atual = EvolucaoClinica(
        paciente_id=pacientes[0].id,
        dentista_id=lucas.id,
        consulta_id=consultas_hoje[1].id,
        queixa_principal="Paciente relata sensibilidade ao frio no dente 26.",
        exame_clinico="Avaliação clínica realizada. Cárie na face oclusal do dente 26.",
        procedimento_realizado=(
            "Restauração em resina composta na face oclusal do dente 26."
        ),
        prescricao_orientacoes="Evitar alimentos muito rígidos por 24 horas.",
        status=StatusEvolucao.rascunho,
        criado_em=agora,
    )
    db.add_all([evolucao_anterior, evolucao_atual])
    await db.flush()

    db.add_all(
        [
            Prontuario(
                paciente_id=pacientes[0].id,
                dentista_id=lucas.id,
                evolucao_id=evolucao_atual.id,
                dente=26,
                face=FaceDente.oclusal,
                descricao="Restauração em resina composta A2.",
            ),
            Prontuario(
                paciente_id=pacientes[0].id,
                dentista_id=ana.id,
                evolucao_id=evolucao_anterior.id,
                dente=11,
                face=FaceDente.vestibular,
                descricao="Pequena fratura de esmalte, acompanhar.",
            ),
            PlanoTratamentoItem(
                paciente_id=pacientes[0].id,
                dentista_id=lucas.id,
                dente=26,
                procedimento="Restauração em resina composta",
                valor=480.0,
                status=StatusPlanoTratamento.em_andamento,
            ),
            PlanoTratamentoItem(
                paciente_id=pacientes[0].id,
                dentista_id=ana.id,
                dente=11,
                procedimento="Polimento e ajuste de esmalte",
                valor=220.0,
                status=StatusPlanoTratamento.planejado,
            ),
            DocumentoClinico(
                paciente_id=pacientes[0].id,
                dentista_id=lucas.id,
                tipo=TipoDocumentoClinico.receita,
                titulo="Orientações pós-restauração",
                conteudo=(
                    "1. Evitar alimentos muito quentes ou rígidos por 24 horas.\n"
                    "2. Em caso de sensibilidade persistente após 7 dias, retornar "
                    "para ajuste oclusal."
                ),
            ),
        ]
    )

    # Histórico de 5 meses anteriores para o gráfico de 6 meses do Dashboard
    historico_mensal = [
        (5, 3420.0, 1520.0, ana.id),
        (4, 3890.0, 1690.0, bruno.id),
        (3, 4120.0, 1740.0, lucas.id),
        (2, 3960.0, 1610.0, ana.id),
        (1, 4350.0, 1780.0, lucas.id),
    ]
    lancamentos_anteriores: list[LancamentoFinanceiro] = []
    for passos, rec, desp, dent_id in historico_mensal:
        dt = _mes_anterior(hoje.year, hoje.month, passos)
        lancamentos_anteriores.extend(
            [
                LancamentoFinanceiro(
                    tipo=TipoLancamento.receita,
                    descricao=f"Atendimentos consolidados ({dt.strftime('%m/%Y')})",
                    categoria="Consultas",
                    valor=rec,
                    status=StatusLancamento.pago,
                    data_competencia=dt,
                    data_pagamento=dt,
                    forma_pagamento="PIX",
                    dentista_id=dent_id,
                ),
                LancamentoFinanceiro(
                    tipo=TipoLancamento.despesa,
                    descricao=f"Custos operacionais ({dt.strftime('%m/%Y')})",
                    categoria="Operação",
                    valor=desp,
                    status=StatusLancamento.pago,
                    data_competencia=dt,
                    data_pagamento=dt,
                    forma_pagamento="Boleto",
                ),
            ]
        )

    db.add_all(
        [
            *lancamentos_anteriores,
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Avaliação inicial (Mariana Costa)",
                categoria="Consultas",
                valor=280.0,
                status=StatusLancamento.pago,
                data_competencia=hoje,
                data_pagamento=hoje,
                forma_pagamento="PIX",
                paciente_id=pacientes[1].id,
                dentista_id=ana.id,
                consulta_id=consultas_hoje[0].id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Restauração dente 26 (Pedro Alves)",
                categoria="Dentística",
                valor=480.0,
                status=StatusLancamento.pendente,
                data_competencia=hoje,
                data_pagamento=None,
                forma_pagamento="Cartão de crédito",
                paciente_id=pacientes[0].id,
                dentista_id=lucas.id,
                consulta_id=consultas_hoje[1].id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Implante unitário (Mariana Costa)",
                categoria="Implantodontia",
                valor=2400.0,
                status=StatusLancamento.pago,
                data_competencia=inicio_mes + timedelta(days=2),
                data_pagamento=inicio_mes + timedelta(days=2),
                forma_pagamento="Cartão de crédito",
                paciente_id=pacientes[1].id,
                dentista_id=lucas.id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Manutenção ortodôntica (Rafael Santos)",
                categoria="Ortodontia",
                valor=250.0,
                status=StatusLancamento.pago,
                data_competencia=inicio_mes + timedelta(days=3),
                data_pagamento=inicio_mes + timedelta(days=3),
                forma_pagamento="PIX",
                paciente_id=pacientes[3].id,
                dentista_id=bruno.id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Restauração em resina (Felipe Rocha)",
                categoria="Dentística",
                valor=540.0,
                status=StatusLancamento.pago,
                data_competencia=inicio_mes + timedelta(days=5),
                data_pagamento=inicio_mes + timedelta(days=5),
                forma_pagamento="Débito",
                paciente_id=pacientes[5].id,
                dentista_id=lucas.id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.receita,
                descricao="Clareamento em consultório (Camila Souza)",
                categoria="Estética",
                valor=950.0,
                status=StatusLancamento.pendente,
                data_competencia=hoje,
                data_pagamento=None,
                forma_pagamento="Cartão de crédito",
                paciente_id=pacientes[2].id,
                dentista_id=lucas.id,
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.despesa,
                descricao="Insumos clínicos e resinas compostas",
                categoria="Materiais",
                valor=1180.0,
                status=StatusLancamento.pago,
                data_competencia=inicio_mes + timedelta(days=4),
                data_pagamento=inicio_mes + timedelta(days=4),
                forma_pagamento="Boleto",
            ),
            LancamentoFinanceiro(
                tipo=TipoLancamento.despesa,
                descricao="Laboratório de prótese",
                categoria="Laboratório",
                valor=640.0,
                status=StatusLancamento.pago,
                data_competencia=inicio_mes + timedelta(days=6),
                data_pagamento=inicio_mes + timedelta(days=6),
                forma_pagamento="PIX",
            ),
            SolicitacaoAgendamento(
                nome="Helena Martins",
                email="helena.martins@email.com",
                telefone="(11) 98123-4567",
                servico="clareamento",
                mensagem="Gostaria de horário no período da manhã.",
                status="pendente",
            ),
            SolicitacaoAgendamento(
                nome="Thiago Mendes",
                email="thiago.mendes@email.com",
                telefone="(11) 97234-5678",
                servico="primeira-consulta",
                mensagem="Avaliação para aparelho ortodôntico.",
                status="pendente",
            ),
        ]
    )

    await db.commit()
    return True


async def main() -> None:
    """Cria tabelas e insere massa de demonstração se o banco estiver vazio."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(garantir_colunas_legado)

    async with AsyncSessionLocal() as db:
        criado = await popular_dados_exemplo(db)
        if criado:
            print("Dados de exemplo criados. Login: ana@smileclinic.com / smile2026")
        else:
            print("O banco já tem dados. Nada foi feito.")


if __name__ == "__main__":
    asyncio.run(main())
