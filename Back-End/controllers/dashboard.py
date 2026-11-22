"""Controller do dashboard gerencial, série de 6 meses e exportação CSV."""

import calendar
import csv
import io
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.configuracoes import obter_ou_criar_configuracao
from database import get_db
from enums import StatusConsulta, StatusLancamento, TipoLancamento
from models import Consulta, Dentista, LancamentoFinanceiro
from schemas import DashboardResponse, DesempenhoProfissional, SerieMensalItem
from security import exigir_autenticacao

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard Gerencial"],
    dependencies=[Depends(exigir_autenticacao)],
)

_MESES_PT: tuple[str, ...] = (
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
)


def _resolver_periodo(
    data_inicio: date | None, data_fim: date | None
) -> tuple[date, date, date, date]:
    hoje = date.today()
    inicio = data_inicio or date(hoje.year, hoje.month, 1)
    ultimo_dia = calendar.monthrange(inicio.year, inicio.month)[1]
    fim = data_fim or date(inicio.year, inicio.month, ultimo_dia)

    if inicio > fim:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "data_inicio deve ser menor ou igual a data_fim.",
        )

    mes_inteiro = (
        inicio.day == 1
        and inicio.year == fim.year
        and inicio.month == fim.month
        and fim.day == calendar.monthrange(fim.year, fim.month)[1]
    )
    if mes_inteiro:
        ant_fim = inicio - timedelta(days=1)
        ant_inicio = date(ant_fim.year, ant_fim.month, 1)
    else:
        duracao = (fim - inicio).days + 1
        ant_fim = inicio - timedelta(days=1)
        ant_inicio = ant_fim - timedelta(days=duracao - 1)

    return inicio, fim, ant_inicio, ant_fim


def _contar_dias_uteis(inicio: date, fim: date) -> int:
    total = 0
    atual = inicio
    while atual <= fim:
        if atual.weekday() < 5:
            total += 1
        atual += timedelta(days=1)
    return max(total, 1)


def _ultimos_seis_meses(referencia: date) -> list[tuple[int, int]]:
    meses: list[tuple[int, int]] = []
    ano = referencia.year
    mes = referencia.month
    for _ in range(6):
        meses.append((ano, mes))
        mes -= 1
        if mes == 0:
            mes = 12
            ano -= 1
    meses.reverse()
    return meses


async def _calcular_dashboard(
    db: AsyncSession,
    data_inicio: date | None,
    data_fim: date | None,
    dentista_id: int | None,
) -> tuple[DashboardResponse, list[LancamentoFinanceiro]]:
    inicio, fim, ant_inicio, ant_fim = _resolver_periodo(data_inicio, data_fim)
    config = await obter_ou_criar_configuracao(db)

    meses_serie = _ultimos_seis_meses(fim)
    serie_inicio = date(meses_serie[0][0], meses_serie[0][1], 1)
    ultimo_dia_serie = calendar.monthrange(meses_serie[-1][0], meses_serie[-1][1])[1]
    serie_fim = date(meses_serie[-1][0], meses_serie[-1][1], ultimo_dia_serie)

    stmt_lanc = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.data_competencia.between(inicio, fim)
    )
    stmt_ant = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.data_competencia.between(ant_inicio, ant_fim),
        LancamentoFinanceiro.tipo == TipoLancamento.receita,
        LancamentoFinanceiro.status != StatusLancamento.cancelado,
    )
    stmt_serie = select(LancamentoFinanceiro).where(
        LancamentoFinanceiro.data_competencia.between(serie_inicio, serie_fim),
        LancamentoFinanceiro.status != StatusLancamento.cancelado,
    )
    stmt_cons = select(Consulta).where(
        Consulta.data_hora.between(
            datetime.combine(inicio, time.min), datetime.combine(fim, time.max)
        )
    )

    if dentista_id is not None:
        stmt_lanc = stmt_lanc.where(LancamentoFinanceiro.dentista_id == dentista_id)
        stmt_ant = stmt_ant.where(LancamentoFinanceiro.dentista_id == dentista_id)
        stmt_serie = stmt_serie.where(LancamentoFinanceiro.dentista_id == dentista_id)
        stmt_cons = stmt_cons.where(Consulta.dentista_id == dentista_id)

    lancamentos = list((await db.scalars(stmt_lanc)).all())
    lancamentos_ant = list((await db.scalars(stmt_ant)).all())
    lancamentos_serie = list((await db.scalars(stmt_serie)).all())
    consultas = list((await db.scalars(stmt_cons)).all())
    dentistas = list((await db.scalars(select(Dentista).order_by(Dentista.nome))).all())

    receitas_validas = [
        item
        for item in lancamentos
        if item.tipo == TipoLancamento.receita
        and item.status != StatusLancamento.cancelado
    ]
    faturamento_bruto = round(sum(item.valor for item in receitas_validas), 2)
    faturamento_anterior = round(sum(item.valor for item in lancamentos_ant), 2)
    variacao_pct = (
        round(
            ((faturamento_bruto - faturamento_anterior) / faturamento_anterior) * 100,
            1,
        )
        if faturamento_anterior > 0
        else None
    )

    valor_recebido = round(
        sum(
            item.valor
            for item in receitas_validas
            if item.status == StatusLancamento.pago
        ),
        2,
    )
    valor_a_receber = round(
        sum(
            item.valor
            for item in receitas_validas
            if item.status == StatusLancamento.pendente
        ),
        2,
    )
    pct_recebido = (
        round((valor_recebido / faturamento_bruto) * 100, 1)
        if faturamento_bruto > 0
        else 0.0
    )
    pct_a_receber = (
        round((valor_a_receber / faturamento_bruto) * 100, 1)
        if faturamento_bruto > 0
        else 0.0
    )

    despesas_pagas = round(
        sum(
            item.valor
            for item in lancamentos
            if item.tipo == TipoLancamento.despesa
            and item.status == StatusLancamento.pago
        ),
        2,
    )
    saldo_periodo = round(valor_recebido - despesas_pagas, 2)

    consultas_realizadas = [
        c for c in consultas if c.status == StatusConsulta.realizada
    ]
    consultas_ativas = [c for c in consultas if c.status != StatusConsulta.cancelada]
    consultas_faltas = [c for c in consultas if c.status == StatusConsulta.falta]

    atendimentos_realizados = len(consultas_realizadas)
    pacientes_unicos = len({c.paciente_id for c in consultas_realizadas})

    num_dentistas = 1 if dentista_id is not None else max(len(dentistas), 1)
    capacidade = (
        _contar_dias_uteis(inicio, fim)
        * num_dentistas
        * config.slots_diarios_por_dentista
    )
    ocupacao_pct = (
        min(round((len(consultas_ativas) / capacidade) * 100, 1), 100.0)
        if capacidade > 0
        else 0.0
    )
    taxa_faltas_pct = (
        round((len(consultas_faltas) / len(consultas_ativas)) * 100, 1)
        if consultas_ativas
        else 0.0
    )
    ticket_medio = (
        round(faturamento_bruto / atendimentos_realizados, 2)
        if atendimentos_realizados > 0
        else 0.0
    )

    mapa_dentistas = {d.id: d.nome for d in dentistas}
    ids_resumo = (
        [dentista_id] if dentista_id is not None else list(mapa_dentistas.keys())
    )
    por_profissional: list[DesempenhoProfissional] = []
    for d_id in ids_resumo:
        if d_id not in mapa_dentistas:
            continue
        atend_d = sum(1 for c in consultas_realizadas if c.dentista_id == d_id)
        fat_d = round(
            sum(item.valor for item in receitas_validas if item.dentista_id == d_id),
            2,
        )
        por_profissional.append(
            DesempenhoProfissional(
                dentista_id=d_id,
                nome=mapa_dentistas[d_id],
                atendimentos=atend_d,
                faturamento=fat_d,
            )
        )
    por_profissional.sort(key=lambda item: item.faturamento, reverse=True)

    serie_mensal: list[SerieMensalItem] = []
    for ano_m, mes_m in meses_serie:
        rec_m = round(
            sum(
                item.valor
                for item in lancamentos_serie
                if item.tipo == TipoLancamento.receita
                and item.data_competencia.year == ano_m
                and item.data_competencia.month == mes_m
            ),
            2,
        )
        desp_m = round(
            sum(
                item.valor
                for item in lancamentos_serie
                if item.tipo == TipoLancamento.despesa
                and item.status == StatusLancamento.pago
                and item.data_competencia.year == ano_m
                and item.data_competencia.month == mes_m
            ),
            2,
        )
        serie_mensal.append(
            SerieMensalItem(
                ano_mes=f"{ano_m:04d}-{mes_m:02d}",
                rotulo=_MESES_PT[mes_m - 1],
                receitas=rec_m,
                despesas=desp_m,
            )
        )

    resumo = DashboardResponse(
        data_inicio=inicio,
        data_fim=fim,
        anterior_inicio=ant_inicio,
        anterior_fim=ant_fim,
        faturamento_bruto=faturamento_bruto,
        faturamento_anterior=faturamento_anterior,
        variacao_faturamento_pct=variacao_pct,
        valor_recebido=valor_recebido,
        percentual_recebido=pct_recebido,
        valor_a_receber=valor_a_receber,
        percentual_a_receber=pct_a_receber,
        atendimentos_realizados=atendimentos_realizados,
        pacientes_unicos=pacientes_unicos,
        despesas_pagas=despesas_pagas,
        saldo_periodo=saldo_periodo,
        ocupacao_agenda_pct=ocupacao_pct,
        taxa_faltas_pct=taxa_faltas_pct,
        ticket_medio=ticket_medio,
        por_profissional=por_profissional,
        serie_mensal=serie_mensal,
    )
    return resumo, lancamentos


@router.get("", response_model=DashboardResponse)
async def obter_dashboard(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    dentista_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    """Retorna os indicadores financeiros e operacionais consolidados."""
    resumo, _ = await _calcular_dashboard(db, data_inicio, data_fim, dentista_id)
    return resumo


@router.get("/exportar")
async def exportar_relatorio_csv(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    dentista_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exporta relatório gerencial e lançamentos do período em CSV."""
    resumo, lancamentos = await _calcular_dashboard(
        db, data_inicio, data_fim, dentista_id
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")

    writer.writerow(["Indicador", "Valor"])
    writer.writerow(["Período", f"{resumo.data_inicio} a {resumo.data_fim}"])
    writer.writerow(["Faturamento bruto (R$)", f"{resumo.faturamento_bruto:.2f}"])
    writer.writerow(["Valor recebido (R$)", f"{resumo.valor_recebido:.2f}"])
    writer.writerow(["A receber (R$)", f"{resumo.valor_a_receber:.2f}"])
    writer.writerow(["Despesas pagas (R$)", f"{resumo.despesas_pagas:.2f}"])
    writer.writerow(["Saldo do período (R$)", f"{resumo.saldo_periodo:.2f}"])
    writer.writerow(["Atendimentos realizados", resumo.atendimentos_realizados])
    writer.writerow(["Pacientes únicos", resumo.pacientes_unicos])
    writer.writerow(["Ocupação da agenda (%)", f"{resumo.ocupacao_agenda_pct:.1f}"])
    writer.writerow(["Taxa de faltas (%)", f"{resumo.taxa_faltas_pct:.1f}"])
    writer.writerow(["Ticket médio (R$)", f"{resumo.ticket_medio:.2f}"])
    writer.writerow([])
    writer.writerow(
        ["Data", "Tipo", "Descrição", "Categoria", "Status", "Forma", "Valor (R$)"]
    )
    for item in lancamentos:
        writer.writerow(
            [
                item.data_competencia.isoformat(),
                item.tipo.value,
                item.descricao,
                item.categoria,
                item.status.value,
                item.forma_pagamento or "",
                f"{item.valor:.2f}",
            ]
        )

    conteudo = "\ufeff" + buffer.getvalue()
    nome_arquivo = f"relatorio-{resumo.data_inicio}-{resumo.data_fim}.csv"
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
    )
