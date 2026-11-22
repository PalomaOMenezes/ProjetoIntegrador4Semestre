/* Controladores de tela do sistema interno SmileClinic */

/* ==================== LOGIN ==================== */

function telaLogin() {
  atualizarIconesTema();
  $$('[data-toggle-tema]').forEach((btn) =>
    btn.addEventListener('click', alternarTemaRapido)
  );
  const form = $('#form-login');
  const erroEl = $('#login-erro');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEl.textContent = '';
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const dentista = await api('/auth/login', {
        method: 'POST',
        body: dadosDoForm(form),
      });
      salvarSessao(dentista);
      location.href = 'agenda.html';
    } catch (erro) {
      erroEl.textContent = erro.message;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ==================== AGENDA ==================== */

async function telaAgenda() {
  const usuario = montarShell('agenda');
  if (!usuario) return;

  const filtroData = $('#filtro-data');
  const filtroDentista = $('#filtro-dentista');
  const filtroStatus = $('#filtro-status');
  const filtroBusca = $('#filtro-busca');
  const corpoTabela = $('#lista-consultas');
  const wrapLista = $('#visao-lista');
  const wrapDia = $('#visao-dia');
  const wrapSemana = $('#visao-semana');
  const paginacaoEl = $('#paginacao-agenda');
  const formConsulta = $('#form-consulta');
  const erroConsulta = $('#erro-consulta');
  const formPacienteRapido = $('#form-paciente-rapido');
  const erroPacienteRapido = $('#erro-paciente-rapido');
  const formFaturar = $('#form-faturar');
  const erroFaturar = $('#erro-faturar');
  const btnSolicitacoes = $('#btn-solicitacoes');

  mascaraCpf(formPacienteRapido.cpf);
  mascaraTelefone(formPacienteRapido.telefone);

  filtroData.value = hojeISO();
  formConsulta.data.value = hojeISO();

  let pacientes = [];
  let dentistas = [];
  let consultasDia = [];
  let solicitacoesCache = [];
  let solicitacaoEmConversao = null;
  let modoVisao = 'lista';
  let paginaAtual = 1;
  const POR_PAGINA = 6;

  try {
    [pacientes, dentistas] = await Promise.all([
      api('/pacientes'),
      api('/dentistas'),
    ]);
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
    return;
  }

  let nomePaciente = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]));
  const nomeDentista = Object.fromEntries(dentistas.map((d) => [d.id, d.nome]));

  function popularSelectPacientes(selecionadoId) {
    nomePaciente = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]));
    formConsulta.paciente_id.innerHTML =
      '<option value="" disabled ' +
      (selecionadoId ? '' : 'selected') +
      '>Selecione o paciente</option>' +
      opcoes(pacientes, (p) => `${p.nome} (${formatarCpf(p.cpf)})`, selecionadoId);
  }

  filtroDentista.innerHTML =
    '<option value="">Todos os profissionais</option>' +
    opcoes(dentistas, (d) => d.nome);
  filtroStatus.innerHTML =
    '<option value="">Todos os status</option>' +
    STATUS_CONSULTA.map(
      (s) => `<option value="${s.valor}">${esc(s.rotulo)}</option>`
    ).join('');

  popularSelectPacientes(null);
  formConsulta.dentista_id.innerHTML = opcoes(
    dentistas,
    (d) => d.nome,
    usuario.id
  );
  formConsulta.status.innerHTML = STATUS_CONSULTA.map(
    (s) =>
      `<option value="${s.valor}" ${
        s.valor === 'agendada' ? 'selected' : ''
      }>${esc(s.rotulo)}</option>`
  ).join('');

  const segVisao = $('#seg-visao');
  const atualizarThumbVisao = ativarIndicadorDeslizante(
    segVisao,
    'button[aria-selected="true"]',
    '.segmented-thumb'
  );

  segVisao.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-visao]');
    if (!btn) return;
    modoVisao = btn.dataset.visao;
    $$('button[data-visao]', segVisao).forEach((b) =>
      b.setAttribute('aria-selected', String(b === btn))
    );
    atualizarThumbVisao();
    wrapLista.classList.toggle('oculto', modoVisao !== 'lista');
    wrapDia.classList.toggle('oculto', modoVisao !== 'dia');
    wrapSemana.classList.toggle('oculto', modoVisao !== 'semana');
    carregar();
  });

  function atualizarKpis(lista) {
    const ativos = lista.filter((c) => c.status !== 'cancelada');
    $('#kpi-total').textContent = String(ativos.length);
    $('#kpi-confirmados').textContent = String(
      lista.filter((c) => c.status === 'confirmada').length
    );
    $('#kpi-recepcao').textContent = String(
      lista.filter((c) => c.status === 'na_recepcao').length
    );
    $('#kpi-atendimento').textContent = String(
      lista.filter((c) => c.status === 'em_atendimento').length
    );
    $$('button.kpi-card[data-kpi-status]').forEach((card) => {
      card.classList.toggle('ativo', filtroStatus.value === card.dataset.kpiStatus);
    });
  }

  function renderizarTabela(filtradas) {
    const total = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    const inicio = (paginaAtual - 1) * POR_PAGINA;
    const fatia = filtradas.slice(inicio, inicio + POR_PAGINA);

    corpoTabela.innerHTML = fatia.length
      ? fatia
          .map((c) => {
            const acaoFicha =
              c.status === 'realizada' || c.status === 'em_atendimento'
                ? 'Ver ficha'
                : 'Abrir ficha';
            return `
              <tr>
                <td class="tabular td-forte">${horaISO(c.data_hora)}</td>
                <td class="td-forte">${esc(nomePaciente[c.paciente_id] || 'Paciente')}</td>
                <td class="td-secundario">${esc(c.procedimento || 'Avaliação inicial')}</td>
                <td class="td-secundario">${esc(nomeDentista[c.dentista_id] || 'Profissional')}</td>
                <td>
                  <select class="status-select st-${esc(c.status)}" data-status-id="${c.id}" aria-label="Status da consulta">
                    ${STATUS_CONSULTA.map(
                      (s) =>
                        `<option value="${s.valor}" ${
                          s.valor === c.status ? 'selected' : ''
                        }>${esc(s.rotulo)}</option>`
                    ).join('')}
                  </select>
                </td>
                <td class="td-acoes">
                  ${
                    c.status === 'realizada'
                      ? `<button type="button" class="btn btn-fantasma btn-sm" data-cobrar-consulta="${c.id}">Cobrar</button>`
                      : ''
                  }
                  <a href="prontuario.html?paciente=${c.paciente_id}&consulta=${c.id}" class="btn btn-fantasma btn-sm">${acaoFicha}</a>
                  <button type="button" class="btn btn-perigo btn-sm" data-remover-consulta="${c.id}">Excluir</button>
                </td>
              </tr>`;
          })
          .join('')
      : '<tr><td colspan="6" class="celula-vazia">Nenhum agendamento para os filtros selecionados.</td></tr>';

    if (total === 0) {
      paginacaoEl.innerHTML = '';
      return;
    }

    const botoesPag = Array.from({ length: totalPaginas }, (_, idx) => {
      const p = idx + 1;
      return `<button type="button" class="pag-btn ${
        p === paginaAtual ? 'ativo' : ''
      }" data-pagina="${p}">${p}</button>`;
    }).join('');

    paginacaoEl.innerHTML = `
      <span class="tabular">Exibindo ${fatia.length} de ${total} agendamentos</span>
      <div class="paginacao-controles">
        <button type="button" class="pag-btn" data-pagina="${paginaAtual - 1}" ${
          paginaAtual <= 1 ? 'disabled' : ''
        }>Anterior</button>
        ${botoesPag}
        <button type="button" class="pag-btn" data-pagina="${paginaAtual + 1}" ${
          paginaAtual >= totalPaginas ? 'disabled' : ''
        }>Próxima</button>
      </div>`;
  }

  function renderizarTimeline(filtradas) {
    const horas = Array.from({ length: 12 }, (_, i) => i + 8); // 08h às 19h
    wrapDia.innerHTML = `
      <div class="timeline-dia">
        ${horas
          .map((h) => {
            const prefixo = String(h).padStart(2, '0');
            const itens = filtradas.filter((c) =>
              horaISO(c.data_hora).startsWith(prefixo)
            );
            return `
              <div class="timeline-faixa">
                <span class="timeline-hora">${prefixo}:00</span>
                <div class="timeline-itens">
                  ${
                    itens.length
                      ? itens
                          .map(
                            (c) => `
                          <div class="timeline-item">
                            <div class="timeline-item-info">
                              <strong>${horaISO(c.data_hora)} · ${esc(nomePaciente[c.paciente_id])}</strong>
                              <span>${esc(c.procedimento)} · ${esc(nomeDentista[c.dentista_id])}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px">
                              <span class="status-pill st-${esc(c.status)}">${esc(rotuloStatusConsulta(c.status))}</span>
                              <a href="prontuario.html?paciente=${c.paciente_id}&consulta=${c.id}" class="btn btn-secundario btn-sm">Ficha</a>
                            </div>
                          </div>`
                          )
                          .join('')
                      : '<span style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Livre</span>'
                  }
                </div>
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function renderizarSemana(filtradas) {
    const seg = inicioSemanaISO(filtroData.value);
    const hoje = hojeISO();
    const dias = Array.from({ length: 6 }, (_, i) => somarDiasISO(seg, i));
    wrapSemana.innerHTML = `
      <div class="semana-grid">
        ${dias
          .map((dia) => {
            const itens = filtradas.filter((c) => c.data_hora.startsWith(dia));
            return `
              <div class="semana-col ${dia === hoje ? 'hoje' : ''}">
                <div class="semana-col-topo">
                  ${esc(diaSemanaCurto(dia))}
                  <span>${itens.length}</span>
                </div>
                ${
                  itens.length
                    ? itens
                        .map(
                          (c) => `
                        <a href="prontuario.html?paciente=${c.paciente_id}&consulta=${c.id}" class="semana-card">
                          <div class="semana-card-hora">
                            <span>${horaISO(c.data_hora)}</span>
                            <span class="status-pill st-${esc(c.status)}" style="height:20px;padding:0 6px;font-size:10px">${esc(rotuloStatusConsulta(c.status))}</span>
                          </div>
                          <strong>${esc(nomePaciente[c.paciente_id])}</strong>
                          <small>${esc(c.procedimento)}</small>
                        </a>`
                        )
                        .join('')
                    : '<span style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Sem agendamentos</span>'
                }
              </div>`;
          })
          .join('')}
      </div>`;
  }

  function renderizar() {
    if (modoVisao === 'semana') {
      const seg = inicioSemanaISO(filtroData.value);
      const sab = somarDiasISO(seg, 5);
      $('#agenda-data-extenso').textContent = `Semana de ${dataBR(seg)} a ${dataBR(sab)}`;
    } else {
      $('#agenda-data-extenso').textContent = dataExtenso(filtroData.value);
    }
    const filtradas = filtroStatus.value
      ? consultasDia.filter((c) => c.status === filtroStatus.value)
      : consultasDia;
    if (modoVisao === 'lista') {
      renderizarTabela(filtradas);
    } else if (modoVisao === 'dia') {
      renderizarTimeline(filtradas);
    } else {
      renderizarSemana(filtradas);
    }
  }

  async function carregar() {
    const params = new URLSearchParams();
    if (modoVisao === 'semana') {
      const seg = inicioSemanaISO(filtroData.value);
      params.set('data_inicio', seg);
      params.set('data_fim', somarDiasISO(seg, 5));
    } else {
      params.set('data', filtroData.value);
    }
    if (filtroDentista.value) params.set('dentista_id', filtroDentista.value);
    if (filtroBusca.value.trim()) params.set('busca', filtroBusca.value.trim());
    try {
      consultasDia = await api(`/consultas?${params}`);
      atualizarKpis(consultasDia);
      renderizar();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function abrirModalFaturar(consulta) {
    if (!consulta) return;
    formFaturar.reset();
    formFaturar.consulta_id.value = String(consulta.id);
    formFaturar.valor.value = consulta.valor_estimado
      ? String(consulta.valor_estimado)
      : '';
    formFaturar.categoria.value = 'Consultas';
    erroFaturar.textContent = '';
    $('#faturar-resumo').textContent = `${
      nomePaciente[consulta.paciente_id] || 'Paciente'
    } (${consulta.procedimento})`;
    abrirModal('modal-faturar');
  }

  async function carregarSolicitacoes() {
    try {
      const lista = await api('/solicitacoes');
      solicitacoesCache = lista;
      const pendentes = lista.filter((s) => s.status === 'pendente').length;
      const badgeBtn = $('#badge-solicitacoes');
      if (badgeBtn) {
        badgeBtn.textContent = String(pendentes);
        badgeBtn.classList.toggle('oculto', pendentes === 0);
      }
      const corpo = $('#lista-solicitacoes');
      if (!corpo) return;
      corpo.innerHTML = lista.length
        ? lista
            .map(
              (s) => `
              <tr>
                <td class="td-forte">${esc(s.nome)}</td>
                <td class="td-secundario tabular">${esc(s.telefone)}</td>
                <td class="td-secundario">${esc(s.servico)}</td>
                <td class="td-secundario">${esc(s.mensagem || '—')}</td>
                <td>
                  <select class="status-select st-${esc(s.status)}" data-sol-id="${s.id}" aria-label="Status do pré-agendamento">
                    ${Object.entries(STATUS_SOLICITACAO)
                      .map(
                        ([val, rot]) =>
                          `<option value="${val}" ${
                            val === s.status ? 'selected' : ''
                          }>${rot}</option>`
                      )
                      .join('')}
                  </select>
                </td>
                <td class="td-acoes">
                  ${
                    s.status !== 'agendado' && s.status !== 'arquivado'
                      ? `<button type="button" class="btn btn-primario btn-sm" data-converter-sol="${s.id}">Agendar</button>`
                      : ''
                  }
                </td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="6" class="celula-vazia">Nenhum pré-agendamento recebido.</td></tr>';
    } catch {
      // Ignora silenciosamente se offline
    }
  }

  $('#btn-dia-anterior').addEventListener('click', () => {
    const passo = modoVisao === 'semana' ? -7 : -1;
    filtroData.value = somarDiasISO(filtroData.value, passo);
    paginaAtual = 1;
    carregar();
  });
  $('#btn-dia-seguinte').addEventListener('click', () => {
    const passo = modoVisao === 'semana' ? 7 : 1;
    filtroData.value = somarDiasISO(filtroData.value, passo);
    paginaAtual = 1;
    carregar();
  });
  $('#btn-hoje').addEventListener('click', () => {
    filtroData.value = hojeISO();
    paginaAtual = 1;
    carregar();
  });

  filtroData.addEventListener('change', () => {
    paginaAtual = 1;
    carregar();
  });
  filtroDentista.addEventListener('change', () => {
    paginaAtual = 1;
    carregar();
  });
  filtroStatus.addEventListener('change', () => {
    paginaAtual = 1;
    atualizarKpis(consultasDia);
    renderizar();
  });

  let buscaTimer;
  filtroBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => {
      paginaAtual = 1;
      carregar();
    }, 250);
  });

  $$('button.kpi-card[data-kpi-status]').forEach((card) => {
    card.addEventListener('click', () => {
      const alvo = card.dataset.kpiStatus;
      filtroStatus.value = filtroStatus.value === alvo ? '' : alvo;
      paginaAtual = 1;
      atualizarKpis(consultasDia);
      renderizar();
    });
  });

  paginacaoEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pagina]');
    if (!btn || btn.disabled) return;
    paginaAtual = Number(btn.dataset.pagina);
    renderizar();
  });

  corpoTabela.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-status-id]');
    if (!sel) return;
    const id = Number(sel.dataset.statusId);
    const novoStatus = sel.value;
    try {
      await api(`/consultas/${id}`, {
        method: 'PATCH',
        body: { status: novoStatus },
      });
      const item = consultasDia.find((c) => c.id === id);
      if (item) item.status = novoStatus;
      sel.className = `status-select st-${novoStatus}`;
      atualizarKpis(consultasDia);
      mostrarToast(`Status alterado para ${rotuloStatusConsulta(novoStatus)}.`);
      renderizar();
      if (novoStatus === 'realizada' && item) {
        abrirModalFaturar(item);
      }
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
      carregar();
    }
  });

  corpoTabela.addEventListener('click', async (e) => {
    const cobrar = e.target.closest('[data-cobrar-consulta]');
    if (cobrar) {
      const c = consultasDia.find(
        (x) => x.id === Number(cobrar.dataset.cobrarConsulta)
      );
      abrirModalFaturar(c);
      return;
    }
    const btn = e.target.closest('[data-remover-consulta]');
    if (!btn) return;
    try {
      await api(`/consultas/${btn.dataset.removerConsulta}`, { method: 'DELETE' });
      mostrarToast('Consulta removida.');
      carregar();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  formFaturar.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroFaturar.textContent = '';
    const d = dadosDoForm(formFaturar);
    try {
      await api(`/consultas/${d.consulta_id}/faturar`, {
        method: 'POST',
        body: {
          valor: Number(d.valor),
          status: d.status,
          forma_pagamento: d.forma_pagamento,
          categoria: d.categoria,
        },
      });
      fecharModal('modal-faturar');
      mostrarToast('Cobrança registrada no Financeiro.');
    } catch (erro) {
      erroFaturar.textContent = erro.message;
    }
  });

  $('#btn-novo-agendamento').addEventListener('click', () => {
    solicitacaoEmConversao = null;
    formConsulta.reset();
    formConsulta.data.value = filtroData.value;
    formConsulta.dentista_id.value = String(usuario.id);
    formConsulta.procedimento.value = 'Avaliação inicial';
    erroConsulta.textContent = '';
    abrirModal('modal-consulta');
  });

  formConsulta.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroConsulta.textContent = '';
    const d = dadosDoForm(formConsulta);
    try {
      await api('/consultas', {
        method: 'POST',
        body: {
          paciente_id: Number(d.paciente_id),
          dentista_id: Number(d.dentista_id),
          data_hora: `${d.data}T${d.hora}:00`,
          procedimento: d.procedimento || 'Avaliação inicial',
          valor_estimado: d.valor_estimado ? Number(d.valor_estimado) : null,
          status: d.status || 'agendada',
        },
      });
      if (solicitacaoEmConversao) {
        await api(`/solicitacoes/${solicitacaoEmConversao.id}`, {
          method: 'PATCH',
          body: { status: 'agendado' },
        }).catch(() => {});
        solicitacaoEmConversao = null;
        carregarSolicitacoes();
        carregarMetadadosShell();
      }
      fecharModal('modal-consulta');
      filtroData.value = d.data;
      mostrarToast('Agendamento criado.');
      carregar();
    } catch (erro) {
      erroConsulta.textContent = erro.message;
    }
  });

  formPacienteRapido.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroPacienteRapido.textContent = '';
    const d = dadosDoForm(formPacienteRapido);
    try {
      const novo = await api('/pacientes', { method: 'POST', body: d });
      pacientes.push(novo);
      popularSelectPacientes(novo.id);
      fecharModal('modal-paciente-rapido');
      formConsulta.reset();
      formConsulta.paciente_id.value = String(novo.id);
      formConsulta.dentista_id.value = String(usuario.id);
      formConsulta.data.value = filtroData.value;
      formConsulta.procedimento.value =
        MAPA_SERVICO_PROCEDIMENTO[solicitacaoEmConversao?.servico] ||
        'Avaliação inicial';
      erroConsulta.textContent = '';
      mostrarToast('Paciente cadastrado. Defina o horário da consulta.');
      abrirModal('modal-consulta');
    } catch (erro) {
      erroPacienteRapido.textContent = erro.message;
    }
  });

  btnSolicitacoes?.addEventListener('click', async () => {
    await carregarSolicitacoes();
    abrirModal('modal-solicitacoes');
  });

  $('#lista-solicitacoes')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-converter-sol]');
    if (!btn) return;
    const sol = solicitacoesCache.find((s) => s.id === btn.dataset.converterSol);
    if (!sol) return;
    solicitacaoEmConversao = sol;
    fecharModal('modal-solicitacoes');

    const telDigitos = sol.telefone.replace(/\D/g, '');
    const existente = pacientes.find(
      (p) =>
        p.telefone === telDigitos ||
        p.nome.toLowerCase() === sol.nome.trim().toLowerCase()
    );
    if (existente) {
      formConsulta.reset();
      popularSelectPacientes(existente.id);
      formConsulta.dentista_id.value = String(usuario.id);
      formConsulta.data.value = filtroData.value;
      formConsulta.procedimento.value =
        MAPA_SERVICO_PROCEDIMENTO[sol.servico] || 'Avaliação inicial';
      erroConsulta.textContent = '';
      abrirModal('modal-consulta');
      return;
    }

    formPacienteRapido.reset();
    formPacienteRapido.nome.value = sol.nome;
    formPacienteRapido.telefone.value = formatarTelefone(sol.telefone);
    formPacienteRapido.anamnese.value = sol.mensagem || '';
    erroPacienteRapido.textContent = '';
    abrirModal('modal-paciente-rapido');
  });

  $('#lista-solicitacoes')?.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-sol-id]');
    if (!sel) return;
    try {
      await api(`/solicitacoes/${sel.dataset.solId}`, {
        method: 'PATCH',
        body: { status: sel.value },
      });
      sel.className = `status-select st-${sel.value}`;
      mostrarToast('Pré-agendamento atualizado.');
      carregarSolicitacoes();
      carregarMetadadosShell();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  await Promise.all([carregar(), carregarSolicitacoes()]);
}

/* ==================== PACIENTES ==================== */

function telaPacientes() {
  if (!montarShell('pacientes')) return;

  const corpo = $('#lista-pacientes');
  const busca = $('#busca-paciente');
  const form = $('#form-paciente');
  const erroForm = $('#erro-paciente');
  const tituloModal = $('#titulo-modal-paciente');
  mascaraCpf(form.cpf);
  mascaraTelefone(form.telefone);

  let listaCache = [];

  async function carregar() {
    try {
      const qs = busca.value.trim()
        ? `?${new URLSearchParams({ busca: busca.value.trim() })}`
        : '';
      listaCache = await api(`/pacientes${qs}`);
      $('#total-pacientes').textContent = `${listaCache.length} paciente(s)`;
      corpo.innerHTML = listaCache.length
        ? listaCache
            .map((p) => {
              const idade = calcularIdade(p.data_nascimento);
              const nascTxt = p.data_nascimento
                ? `${dataBR(p.data_nascimento)}${idade !== null ? ` (${idade} anos)` : ''}`
                : '—';
              const anamneseResumo = p.anamnese
                ? esc(p.anamnese.slice(0, 56)) + (p.anamnese.length > 56 ? '…' : '')
                : 'Sem alertas';
              return `
                <tr>
                  <td class="td-forte">${esc(p.nome)}</td>
                  <td class="td-secundario tabular">${nascTxt}</td>
                  <td class="td-secundario tabular">${formatarCpf(p.cpf)}</td>
                  <td class="td-secundario tabular">${formatarTelefone(p.telefone)}</td>
                  <td class="td-secundario">${anamneseResumo}</td>
                  <td class="td-acoes">
                    <a class="btn btn-fantasma btn-sm" href="prontuario.html?paciente=${p.id}">Prontuário</a>
                    <button type="button" class="btn btn-fantasma btn-sm" data-editar-paciente="${p.id}">Editar</button>
                    <button type="button" class="btn btn-perigo btn-sm" data-remover-paciente="${p.id}">Excluir</button>
                  </td>
                </tr>`;
            })
            .join('')
        : '<tr><td colspan="6" class="celula-vazia">Nenhum paciente encontrado.</td></tr>';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  $('#btn-novo-paciente').addEventListener('click', () => {
    form.reset();
    form.id.value = '';
    erroForm.textContent = '';
    tituloModal.textContent = 'Novo paciente';
    abrirModal('modal-paciente');
  });

  corpo.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-paciente]');
    const remover = e.target.closest('[data-remover-paciente]');
    if (editar) {
      const p = listaCache.find((x) => x.id === Number(editar.dataset.editarPaciente));
      if (!p) return;
      form.id.value = String(p.id);
      form.nome.value = p.nome;
      form.cpf.value = formatarCpf(p.cpf);
      form.telefone.value = formatarTelefone(p.telefone);
      form.data_nascimento.value = p.data_nascimento || '';
      form.endereco.value = p.endereco;
      form.anamnese.value = p.anamnese || '';
      erroForm.textContent = '';
      tituloModal.textContent = 'Editar paciente';
      abrirModal('modal-paciente');
    }
    if (remover) {
      try {
        await api(`/pacientes/${remover.dataset.removerPaciente}`, {
          method: 'DELETE',
        });
        mostrarToast('Paciente removido.');
        carregar();
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroForm.textContent = '';
    const { id, ...dados } = dadosDoForm(form);
    if (id) {
      dados.anamnese = form.anamnese.value.trim();
      if (!form.data_nascimento.value) dados.data_nascimento = null;
    }
    try {
      await api(id ? `/pacientes/${id}` : '/pacientes', {
        method: id ? 'PATCH' : 'POST',
        body: dados,
      });
      fecharModal('modal-paciente');
      mostrarToast(id ? 'Paciente atualizado.' : 'Paciente cadastrado.');
      carregar();
    } catch (erro) {
      erroForm.textContent = erro.message;
    }
  });

  let timer;
  busca.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(carregar, 250);
  });

  carregar();
}

/* ==================== PRONTUÁRIO ELETRÔNICO ==================== */

const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

async function telaProntuario() {
  const usuario = montarShell('prontuario');
  if (!usuario) return;

  const qs = new URLSearchParams(location.search);
  let pacienteId = qs.get('paciente');
  const consultaParam = qs.get('consulta') ? Number(qs.get('consulta')) : null;

  const seletor = $('#seletor-paciente');
  const tabsBar = $('#tabs-prontuario');
  const formEvolucao = $('#form-evolucao');
  const formAnamnese = $('#form-anamnese');
  const formOdonto = $('#form-odonto');
  const formPlano = $('#form-plano');
  const formDoc = $('#form-documento');

  let dentistasMap = {};
  let pacienteAtual = null;
  let evolucoes = [];
  let evolucaoEditandoId = null;
  let denteSelecionado = null;

  const btnDente = (n) =>
    `<button type="button" class="dente-btn" data-dente="${n}" aria-pressed="false" aria-label="Dente ${n}">${n}</button>`;
  $('#arcada-superior').innerHTML = ARCADA_SUPERIOR.map(btnDente).join('');
  $('#arcada-inferior').innerHTML = ARCADA_INFERIOR.map(btnDente).join('');
  formOdonto.face.innerHTML = FACES.map(
    (f) => `<option value="${f.valor}">${esc(f.rotulo)}</option>`
  ).join('');

  const atualizarIndicadorAbas = ativarIndicadorDeslizante(
    tabsBar,
    '.tab-btn[aria-selected="true"]',
    '.tabs-indicator'
  );

  tabsBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn[data-aba]');
    if (!btn) return;
    const aba = btn.dataset.aba;
    $$('.tab-btn', tabsBar).forEach((b) =>
      b.setAttribute('aria-selected', String(b === btn))
    );
    $$('.tab-painel').forEach((p) =>
      p.classList.toggle('oculto', p.id !== `painel-${aba}`)
    );
    atualizarIndicadorAbas();
  });

  try {
    const [pacientes, listaDentistas] = await Promise.all([
      api('/pacientes'),
      api('/dentistas'),
    ]);
    dentistasMap = Object.fromEntries(listaDentistas.map((d) => [d.id, d.nome]));
    if (!pacientes.length) {
      mostrarToast('Cadastre um paciente primeiro.', 'erro');
      return;
    }
    pacienteId = pacienteId || String(pacientes[0].id);
    seletor.innerHTML = opcoes(
      pacientes,
      (p) => `${p.nome} (${formatarCpf(p.cpf)})`,
      pacienteId
    );
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
    return;
  }

  function preencherFormEvolucao(ev) {
    if (!ev) {
      evolucaoEditandoId = null;
      formEvolucao.reset();
      formEvolucao.status.value = 'rascunho';
      $('#evolucao-rodape-meta').textContent = `${dataBR(hojeISO())} · ${usuario.nome}`;
      $$('.historico-row').forEach((r) => r.classList.remove('ativo'));
      return;
    }
    evolucaoEditandoId = ev.id;
    formEvolucao.queixa_principal.value = ev.queixa_principal;
    formEvolucao.exame_clinico.value = ev.exame_clinico;
    formEvolucao.procedimento_realizado.value = ev.procedimento_realizado;
    formEvolucao.prescricao_orientacoes.value = ev.prescricao_orientacoes || '';
    formEvolucao.status.value = ev.status;
    $('#evolucao-rodape-meta').textContent = `${dataBR(ev.criado_em)} · ${
      dentistasMap[ev.dentista_id] || usuario.nome
    }`;
    $$('.historico-row').forEach((r) =>
      r.classList.toggle('ativo', Number(r.dataset.evId) === ev.id)
    );
  }

  function selecionarDente(n) {
    denteSelecionado = n;
    $$('.dente-btn').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.dente) === n))
    );
    $('#dente-selecionado-rotulo').textContent = n
      ? `Dente ${n} selecionado`
      : 'Selecione um dente na arcada';
  }

  async function carregarPaciente() {
    const pid = Number(seletor.value);
    try {
      const [p, listaEvolucoes, listaOdonto, listaPlano, listaDocs, consultas] =
        await Promise.all([
          api(`/pacientes/${pid}`),
          api(`/evolucoes?paciente_id=${pid}`),
          api(`/prontuarios?paciente_id=${pid}`),
          api(`/planos-tratamento?paciente_id=${pid}`),
          api(`/documentos?paciente_id=${pid}`),
          api(`/consultas?paciente_id=${pid}`),
        ]);

      pacienteAtual = p;
      evolucoes = listaEvolucoes;

      // Breadcrumb e Banner do paciente
      $('#prontuario-breadcrumb').textContent = `Pacientes / ${p.nome} / Atendimento atual`;
      $('#banner-nome').textContent = p.nome;
      const idade = calcularIdade(p.data_nascimento);
      const partes = [];
      if (idade !== null) partes.push(`${idade} anos`);
      if (p.data_nascimento) partes.push(`Nascimento: ${dataBR(p.data_nascimento)}`);
      partes.push(`Prontuário: ${formatarNumeroProntuario(p.id)}`);
      $('#banner-sub').textContent = partes.join(' · ');

      // Atendimento atual (consulta da URL, em atendimento, ou mais recente)
      const consultaFoco =
        consultas.find((c) => c.id === consultaParam) ||
        consultas.find((c) => c.status === 'em_atendimento') ||
        consultas[consultas.length - 1];

      const badgeStatus = $('#banner-status');
      const infoProf = $('#banner-profissional');
      if (consultaFoco) {
        badgeStatus.textContent = rotuloStatusConsulta(consultaFoco.status);
        badgeStatus.className = `status-pill st-${consultaFoco.status}`;
        infoProf.textContent = `${
          dentistasMap[consultaFoco.dentista_id] || usuario.nome
        } · ${dataBR(consultaFoco.data_hora)} ${horaISO(consultaFoco.data_hora)}`;
      } else {
        badgeStatus.textContent = 'Sem consulta hoje';
        badgeStatus.className = 'status-pill st-agendada';
        infoProf.textContent = usuario.nome;
      }

      // Alertas clínicos
      const alertasEl = $('#alerta-anamnese');
      if (p.anamnese) {
        alertasEl.innerHTML = `<div class="alerta-destaque">${esc(p.anamnese)}</div>`;
      } else {
        alertasEl.innerHTML = '<p>Alergias: nenhuma relatada.</p>';
      }
      $('#alerta-anamnese-data').textContent = p.anamnese_atualizada_em
        ? `Anamnese atualizada em ${dataBR(p.anamnese_atualizada_em)}`
        : 'Anamnese ainda não registrada';

      const realizadas = consultas
        .filter((c) => c.status === 'realizada')
        .sort((a, b) => b.data_hora.localeCompare(a.data_hora));
      $('#alerta-ultimo-atendimento').textContent = realizadas.length
        ? `${dataBR(realizadas[0].data_hora)} · ${realizadas[0].procedimento}`
        : 'Nenhum atendimento concluído';

      // Anamnese tab
      formAnamnese.anamnese.value = p.anamnese || '';

      // Histórico de evoluções
      const histEl = $('#lista-evolucoes');
      histEl.innerHTML = evolucoes.length
        ? evolucoes
            .map(
              (ev) => `
              <li>
                <button type="button" class="historico-row" data-ev-id="${ev.id}">
                  <span class="historico-data">${dataBR(ev.criado_em)}</span>
                  <span class="historico-resumo">${esc(ev.procedimento_realizado)}</span>
                  <span class="status-pill st-${ev.status}">${
                    ev.status === 'assinado' ? 'Assinado' : 'Rascunho'
                  }</span>
                </button>
              </li>`
            )
            .join('')
        : '<li class="celula-vazia" style="padding:16px">Nenhum atendimento registrado.</li>';

      preencherFormEvolucao(evolucoes[0] || null);

      // Odontograma
      const dentesComRegistro = new Set(listaOdonto.map((r) => r.dente));
      $$('.dente-btn').forEach((b) =>
        b.classList.toggle('tem-registro', dentesComRegistro.has(Number(b.dataset.dente)))
      );
      $('#lista-odonto').innerHTML = listaOdonto.length
        ? listaOdonto
            .map(
              (r) => `
              <tr>
                <td class="tabular td-forte">${r.dente}</td>
                <td class="td-secundario" style="text-transform:capitalize">${esc(r.face)}</td>
                <td>${esc(r.descricao)}</td>
                <td class="td-secundario">${esc(dentistasMap[r.dentista_id] || '—')}</td>
                <td class="td-secundario tabular">${dataBR(r.criado_em)}</td>
                <td class="td-acoes">
                  <button type="button" class="btn btn-perigo btn-sm" data-remover-odonto="${r.id}">Excluir</button>
                </td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="6" class="celula-vazia">Nenhum registro no odontograma.</td></tr>';

      // Plano de tratamento
      const totalPlano = listaPlano
        .filter((i) => i.status !== 'cancelado')
        .reduce((acc, i) => acc + Number(i.valor || 0), 0);
      $('#total-plano').textContent = formatarMoeda(totalPlano);

      $('#lista-plano').innerHTML = listaPlano.length
        ? listaPlano
            .map(
              (item) => `
              <tr>
                <td class="tabular td-forte">${item.dente || '—'}</td>
                <td class="td-forte">${esc(item.procedimento)}</td>
                <td class="tabular">${formatarMoeda(item.valor)}</td>
                <td>
                  <select class="status-select st-${item.status}" data-plano-status="${item.id}" aria-label="Status do procedimento">
                    ${Object.entries(STATUS_PLANO)
                      .map(
                        ([val, rot]) =>
                          `<option value="${val}" ${
                            val === item.status ? 'selected' : ''
                          }>${rot}</option>`
                      )
                      .join('')}
                  </select>
                </td>
                <td class="td-acoes">
                  <button type="button" class="btn btn-fantasma btn-sm" data-faturar-plano="${item.id}" data-proc="${esc(item.procedimento)}" data-valor="${item.valor}">Lançar</button>
                  <button type="button" class="btn btn-perigo btn-sm" data-remover-plano="${item.id}">Excluir</button>
                </td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="5" class="celula-vazia">Nenhum procedimento no plano de tratamento.</td></tr>';

      // Documentos
      $('#lista-documentos').innerHTML = listaDocs.length
        ? listaDocs
            .map(
              (doc) => `
              <article class="doc-card">
                <div class="doc-card-topo">
                  <div>
                    <span class="status-pill st-agendada" style="margin-right:8px">${esc(
                      TIPOS_DOCUMENTO[doc.tipo] || doc.tipo
                    )}</span>
                    <strong>${esc(doc.titulo)}</strong>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <small class="td-secundario tabular">${dataBR(doc.criado_em)} · ${esc(
                      dentistasMap[doc.dentista_id] || ''
                    )}</small>
                    <button type="button" class="btn btn-perigo btn-sm no-print" data-remover-doc="${doc.id}">Excluir</button>
                  </div>
                </div>
                <p class="doc-conteudo">${esc(doc.conteudo)}</p>
              </article>`
            )
            .join('')
        : '<p class="celula-vazia" style="padding:16px">Nenhum documento emitido.</p>';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function salvarEvolucaoAtual() {
    const d = dadosDoForm(formEvolucao);
    if (!d.queixa_principal || !d.exame_clinico || !d.procedimento_realizado) {
      mostrarToast('Preencha queixa, exame clínico e procedimento.', 'erro');
      return;
    }
    try {
      if (evolucaoEditandoId) {
        await api(`/evolucoes/${evolucaoEditandoId}`, {
          method: 'PATCH',
          body: {
            queixa_principal: d.queixa_principal,
            exame_clinico: d.exame_clinico,
            procedimento_realizado: d.procedimento_realizado,
            prescricao_orientacoes: formEvolucao.prescricao_orientacoes.value.trim(),
            status: d.status || 'rascunho',
          },
        });
        mostrarToast('Atendimento atualizado.');
      } else {
        await api('/evolucoes', {
          method: 'POST',
          body: {
            paciente_id: Number(seletor.value),
            dentista_id: usuario.id,
            consulta_id: consultaParam,
            queixa_principal: d.queixa_principal,
            exame_clinico: d.exame_clinico,
            procedimento_realizado: d.procedimento_realizado,
            prescricao_orientacoes: d.prescricao_orientacoes || null,
            status: d.status || 'rascunho',
          },
        });
        mostrarToast('Atendimento salvo.');
      }
      await carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  $('#btn-salvar-atendimento').addEventListener('click', salvarEvolucaoAtual);
  formEvolucao.addEventListener('submit', (e) => {
    e.preventDefault();
    salvarEvolucaoAtual();
  });

  $('#btn-nova-evolucao').addEventListener('click', () => {
    preencherFormEvolucao(null);
    formEvolucao.queixa_principal.focus();
  });

  $('#btn-imprimir').addEventListener('click', () => window.print());

  $('#lista-evolucoes').addEventListener('click', (e) => {
    const btn = e.target.closest('.historico-row[data-ev-id]');
    if (!btn) return;
    const ev = evolucoes.find((x) => x.id === Number(btn.dataset.evId));
    if (ev) preencherFormEvolucao(ev);
  });

  formAnamnese.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/pacientes/${seletor.value}`, {
        method: 'PATCH',
        body: { anamnese: formAnamnese.anamnese.value.trim() },
      });
      mostrarToast('Anamnese salva.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  $('.odontograma-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('.dente-btn');
    if (btn) selecionarDente(Number(btn.dataset.dente));
  });

  formOdonto.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!denteSelecionado) {
      mostrarToast('Selecione um dente na arcada.', 'erro');
      return;
    }
    const d = dadosDoForm(formOdonto);
    try {
      await api('/prontuarios', {
        method: 'POST',
        body: {
          paciente_id: Number(seletor.value),
          dentista_id: usuario.id,
          evolucao_id: evolucaoEditandoId,
          dente: denteSelecionado,
          face: d.face,
          descricao: d.descricao,
        },
      });
      formOdonto.descricao.value = '';
      mostrarToast(`Registro salvo no dente ${denteSelecionado}.`);
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  $('#lista-odonto').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remover-odonto]');
    if (!btn) return;
    try {
      await api(`/prontuarios/${btn.dataset.removerOdonto}`, { method: 'DELETE' });
      mostrarToast('Registro removido.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  formPlano.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dadosDoForm(formPlano);
    try {
      await api('/planos-tratamento', {
        method: 'POST',
        body: {
          paciente_id: Number(seletor.value),
          dentista_id: usuario.id,
          dente: d.dente ? Number(d.dente) : null,
          procedimento: d.procedimento,
          valor: Number(d.valor || 0),
        },
      });
      formPlano.reset();
      mostrarToast('Procedimento adicionado ao plano.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  $('#lista-plano').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-plano-status]');
    if (!sel) return;
    try {
      await api(`/planos-tratamento/${sel.dataset.planoStatus}`, {
        method: 'PATCH',
        body: { status: sel.value },
      });
      sel.className = `status-select st-${sel.value}`;
      mostrarToast('Status do plano atualizado.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  $('#lista-plano').addEventListener('click', async (e) => {
    const faturar = e.target.closest('[data-faturar-plano]');
    const remover = e.target.closest('[data-remover-plano]');
    if (faturar) {
      const valor = Number(faturar.dataset.valor);
      if (valor <= 0) {
        mostrarToast('Defina um valor maior que zero para faturar.', 'erro');
        return;
      }
      try {
        await api('/financeiro', {
          method: 'POST',
          body: {
            tipo: 'receita',
            descricao: `${faturar.dataset.proc} (${pacienteAtual?.nome || ''})`,
            categoria: 'Tratamento',
            valor,
            status: 'pendente',
            data_competencia: hojeISO(),
            paciente_id: Number(seletor.value),
            dentista_id: usuario.id,
          },
        });
        mostrarToast('Lançamento criado no Financeiro como pendente.');
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
    if (remover) {
      try {
        await api(`/planos-tratamento/${remover.dataset.removerPlano}`, {
          method: 'DELETE',
        });
        mostrarToast('Item removido do plano.');
        carregarPaciente();
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
  });

  formDoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dadosDoForm(formDoc);
    try {
      await api('/documentos', {
        method: 'POST',
        body: {
          paciente_id: Number(seletor.value),
          dentista_id: usuario.id,
          tipo: d.tipo,
          titulo: d.titulo,
          conteudo: d.conteudo,
        },
      });
      formDoc.reset();
      mostrarToast('Documento salvo.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  $('#lista-documentos').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remover-doc]');
    if (!btn) return;
    try {
      await api(`/documentos/${btn.dataset.removerDoc}`, { method: 'DELETE' });
      mostrarToast('Documento removido.');
      carregarPaciente();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  seletor.addEventListener('change', () => {
    selecionarDente(null);
    carregarPaciente();
  });

  selecionarDente(null);
  await carregarPaciente();
}

/* ==================== FINANCEIRO ==================== */

async function telaFinanceiro() {
  const usuario = montarShell('financeiro');
  if (!usuario) return;

  const hoje = new Date();
  let anoRef = hoje.getFullYear();
  let mesRef = hoje.getMonth();
  let filtroTipo = '';
  let listaCache = [];
  let pacientesMap = {};
  let dentistasMap = {};

  const filtroStatus = $('#filtro-fin-status');
  const filtroBusca = $('#filtro-fin-busca');
  const corpo = $('#lista-financeiro');
  const form = $('#form-lancamento');
  const erroForm = $('#erro-lancamento');
  const tituloModal = $('#titulo-modal-lancamento');

  try {
    const [pacientes, dentistas] = await Promise.all([
      api('/pacientes'),
      api('/dentistas'),
    ]);
    pacientesMap = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]));
    dentistasMap = Object.fromEntries(dentistas.map((d) => [d.id, d.nome]));
    form.paciente_id.innerHTML =
      '<option value="">Sem paciente vinculado</option>' +
      opcoes(pacientes, (p) => p.nome);
    form.dentista_id.innerHTML =
      '<option value="">Sem profissional vinculado</option>' +
      opcoes(dentistas, (d) => d.nome);
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }

  const segTipo = $('#seg-tipo-fin');
  const atualizarThumb = ativarIndicadorDeslizante(
    segTipo,
    'button[aria-selected="true"]',
    '.segmented-thumb'
  );

  segTipo.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tipo]');
    if (!btn) return;
    filtroTipo = btn.dataset.tipo;
    $$('button[data-tipo]', segTipo).forEach((b) =>
      b.setAttribute('aria-selected', String(b === btn))
    );
    atualizarThumb();
    carregar();
  });

  async function carregar() {
    const { inicio, fim } = intervaloMes(anoRef, mesRef);
    $('#fin-mes-rotulo').textContent = nomeMesAno(inicio);

    const params = new URLSearchParams({ data_inicio: inicio, data_fim: fim });
    if (filtroTipo) params.set('tipo', filtroTipo);
    if (filtroStatus.value) params.set('status_lancamento', filtroStatus.value);
    if (filtroBusca.value.trim()) params.set('busca', filtroBusca.value.trim());

    try {
      const [filtrados, todosMes] = await Promise.all([
        api(`/financeiro?${params}`),
        api(`/financeiro?data_inicio=${inicio}&data_fim=${fim}`),
      ]);
      listaCache = filtrados;

      const recebido = todosMes
        .filter((l) => l.tipo === 'receita' && l.status === 'pago')
        .reduce((s, l) => s + l.valor, 0);
      const aReceber = todosMes
        .filter((l) => l.tipo === 'receita' && l.status === 'pendente')
        .reduce((s, l) => s + l.valor, 0);
      const despesas = todosMes
        .filter((l) => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((s, l) => s + l.valor, 0);
      const saldo = recebido - despesas;

      $('#fin-recebido').textContent = formatarMoedaCurta(recebido);
      $('#fin-a-receber').textContent = formatarMoedaCurta(aReceber);
      $('#fin-despesas').textContent = formatarMoedaCurta(despesas);
      $('#fin-saldo').textContent = formatarMoedaCurta(saldo);

      corpo.innerHTML = filtrados.length
        ? filtrados
            .map((l) => {
              const vinculo =
                pacientesMap[l.paciente_id] || dentistasMap[l.dentista_id] || '—';
              const sinal = l.tipo === 'despesa' ? '− ' : '+ ';
              return `
                <tr>
                  <td class="tabular td-secundario">${dataBR(l.data_competencia)}</td>
                  <td class="td-forte">${esc(l.descricao)}</td>
                  <td class="td-secundario">${esc(l.categoria)}</td>
                  <td class="td-secundario">${esc(vinculo)}</td>
                  <td class="td-secundario">${esc(l.forma_pagamento || '—')}</td>
                  <td class="tabular td-forte">${sinal}${formatarMoeda(l.valor)}</td>
                  <td><span class="status-pill st-${l.status}">${
                    l.status === 'pago'
                      ? 'Pago'
                      : l.status === 'pendente'
                        ? 'Pendente'
                        : 'Cancelado'
                  }</span></td>
                  <td class="td-acoes">
                    ${
                      l.status === 'pendente'
                        ? `<button type="button" class="btn btn-fantasma btn-sm" data-pagar="${l.id}">Quitar</button>`
                        : ''
                    }
                    <button type="button" class="btn btn-fantasma btn-sm" data-editar-lanc="${l.id}">Editar</button>
                    <button type="button" class="btn btn-perigo btn-sm" data-remover-lanc="${l.id}">Excluir</button>
                  </td>
                </tr>`;
            })
            .join('')
        : '<tr><td colspan="8" class="celula-vazia">Nenhum lançamento neste período.</td></tr>';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  $('#fin-mes-anterior').addEventListener('click', () => {
    mesRef -= 1;
    if (mesRef < 0) {
      mesRef = 11;
      anoRef -= 1;
    }
    carregar();
  });
  $('#fin-mes-seguinte').addEventListener('click', () => {
    mesRef += 1;
    if (mesRef > 11) {
      mesRef = 0;
      anoRef += 1;
    }
    carregar();
  });

  filtroStatus.addEventListener('change', carregar);
  let buscaTimer;
  filtroBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(carregar, 250);
  });

  $('#btn-novo-lancamento').addEventListener('click', () => {
    form.reset();
    form.id.value = '';
    form.data_competencia.value = hojeISO();
    form.dentista_id.value = String(usuario.id);
    erroForm.textContent = '';
    tituloModal.textContent = 'Novo lançamento';
    abrirModal('modal-lancamento');
  });

  corpo.addEventListener('click', async (e) => {
    const pagar = e.target.closest('[data-pagar]');
    const editar = e.target.closest('[data-editar-lanc]');
    const remover = e.target.closest('[data-remover-lanc]');

    if (pagar) {
      try {
        await api(`/financeiro/${pagar.dataset.pagar}`, {
          method: 'PATCH',
          body: { status: 'pago', data_pagamento: hojeISO() },
        });
        mostrarToast('Lançamento marcado como pago.');
        carregar();
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
    if (editar) {
      const l = listaCache.find((x) => x.id === Number(editar.dataset.editarLanc));
      if (!l) return;
      form.id.value = String(l.id);
      form.tipo.value = l.tipo;
      form.descricao.value = l.descricao;
      form.categoria.value = l.categoria;
      form.valor.value = String(l.valor);
      form.status.value = l.status;
      form.data_competencia.value = l.data_competencia;
      form.forma_pagamento.value = l.forma_pagamento || '';
      form.paciente_id.value = l.paciente_id ? String(l.paciente_id) : '';
      form.dentista_id.value = l.dentista_id ? String(l.dentista_id) : '';
      erroForm.textContent = '';
      tituloModal.textContent = 'Editar lançamento';
      abrirModal('modal-lancamento');
    }
    if (remover) {
      try {
        await api(`/financeiro/${remover.dataset.removerLanc}`, {
          method: 'DELETE',
        });
        mostrarToast('Lançamento removido.');
        carregar();
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroForm.textContent = '';
    const d = dadosDoForm(form);
    const id = d.id;
    const body = {
      tipo: d.tipo,
      descricao: d.descricao,
      categoria: d.categoria,
      valor: Number(d.valor),
      status: d.status,
      data_competencia: d.data_competencia,
      forma_pagamento: d.forma_pagamento || null,
      paciente_id: d.paciente_id ? Number(d.paciente_id) : null,
      dentista_id: d.dentista_id ? Number(d.dentista_id) : null,
    };
    try {
      await api(id ? `/financeiro/${id}` : '/financeiro', {
        method: id ? 'PATCH' : 'POST',
        body,
      });
      fecharModal('modal-lancamento');
      mostrarToast(id ? 'Lançamento atualizado.' : 'Lançamento registrado.');
      carregar();
    } catch (erro) {
      erroForm.textContent = erro.message;
    }
  });

  await carregar();
}

/* ==================== DASHBOARD GERENCIAL ==================== */

async function telaDashboard() {
  if (!montarShell('dashboard')) return;

  const hoje = new Date();
  let anoRef = hoje.getFullYear();
  let mesRef = hoje.getMonth();

  const inputInicio = $('#dash-inicio');
  const inputFim = $('#dash-fim');
  const filtroDentista = $('#dash-dentista');

  function sincronizarDatasMes() {
    const { inicio, fim } = intervaloMes(anoRef, mesRef);
    inputInicio.value = inicio;
    inputFim.value = fim;
  }
  sincronizarDatasMes();

  try {
    const dentistas = await api('/dentistas');
    filtroDentista.innerHTML =
      '<option value="">Todos os profissionais</option>' +
      opcoes(dentistas, (d) => d.nome);
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }

  function queryParams() {
    const params = new URLSearchParams({
      data_inicio: inputInicio.value,
      data_fim: inputFim.value,
    });
    if (filtroDentista.value) params.set('dentista_id', filtroDentista.value);
    return params;
  }

  async function carregar() {
    try {
      const d = await api(`/dashboard?${queryParams()}`);
      $('#dash-comparativo').textContent = `Comparado a ${dataBR(
        d.anterior_inicio
      )} – ${dataBR(d.anterior_fim)}`;

      $('#kpi-fat-bruto').textContent = formatarMoedaCurta(d.faturamento_bruto);
      const varEl = $('#kpi-fat-var');
      if (d.variacao_faturamento_pct === null) {
        varEl.textContent = 'Sem base no período anterior';
        varEl.className = 'kpi-detalhe';
      } else {
        const sinal = d.variacao_faturamento_pct >= 0 ? '▲ +' : '▼ ';
        varEl.textContent = `${sinal}${d.variacao_faturamento_pct.toFixed(1).replace('.', ',')}% vs período anterior`;
        varEl.className = `kpi-detalhe ${
          d.variacao_faturamento_pct >= 0 ? 'positivo' : 'negativo'
        }`;
      }

      $('#kpi-recebido').textContent = formatarMoedaCurta(d.valor_recebido);
      $('#kpi-recebido-pct').textContent = `${d.percentual_recebido
        .toFixed(1)
        .replace('.', ',')}% do faturamento`;

      $('#kpi-a-receber').textContent = formatarMoedaCurta(d.valor_a_receber);
      $('#kpi-a-receber-pct').textContent = `${d.percentual_a_receber
        .toFixed(1)
        .replace('.', ',')}% do faturamento`;

      $('#kpi-atendimentos').textContent = String(d.atendimentos_realizados);
      $('#kpi-pacientes-periodo').textContent = `${d.pacientes_unicos} paciente(s) no período`;

      $('#caixa-recebimentos').textContent = formatarMoedaCurta(d.valor_recebido);
      $('#caixa-despesas').textContent = formatarMoedaCurta(d.despesas_pagas);
      $('#caixa-saldo').textContent = formatarMoedaCurta(d.saldo_periodo);
      const totalFluxo = d.valor_recebido + d.despesas_pagas;
      const pctEntrada = totalFluxo > 0 ? (d.valor_recebido / totalFluxo) * 100 : 0;
      $('#barra-caixa').style.width = `${pctEntrada.toFixed(1)}%`;

      $('#op-ocupacao').textContent = `${d.ocupacao_agenda_pct.toFixed(0)}%`;
      $('#barra-ocupacao').style.width = `${Math.min(d.ocupacao_agenda_pct, 100)}%`;

      $('#op-faltas').textContent = `${d.taxa_faltas_pct.toFixed(0)}%`;
      $('#barra-faltas').style.width = `${Math.min(d.taxa_faltas_pct, 100)}%`;

      $('#op-ticket').textContent = formatarMoedaCurta(d.ticket_medio);

      renderizarGraficoEvolucao(d.serie_mensal || []);

      const corpoProf = $('#lista-profissionais-dash');
      corpoProf.innerHTML = d.por_profissional.length
        ? d.por_profissional
            .map(
              (p) => `
              <tr>
                <td class="td-forte">${esc(p.nome)}</td>
                <td class="tabular">${p.atendimentos}</td>
                <td class="tabular td-forte">${formatarMoeda(p.faturamento)}</td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="3" class="celula-vazia">Sem dados de produção no período.</td></tr>';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  $('#dash-mes-anterior').addEventListener('click', () => {
    mesRef -= 1;
    if (mesRef < 0) {
      mesRef = 11;
      anoRef -= 1;
    }
    sincronizarDatasMes();
    carregar();
  });
  $('#dash-mes-seguinte').addEventListener('click', () => {
    mesRef += 1;
    if (mesRef > 11) {
      mesRef = 0;
      anoRef += 1;
    }
    sincronizarDatasMes();
    carregar();
  });

  inputInicio.addEventListener('change', carregar);
  inputFim.addEventListener('change', carregar);
  filtroDentista.addEventListener('change', carregar);

  function renderizarGraficoEvolucao(serie) {
    const container = $('#grafico-evolucao');
    if (!container) return;
    if (!serie.length) {
      container.innerHTML =
        '<p class="celula-vazia" style="padding:24px">Sem lançamentos nos últimos 6 meses.</p>';
      return;
    }
    const maxVal = Math.max(
      1,
      ...serie.flatMap((m) => [Number(m.receitas || 0), Number(m.despesas || 0)])
    );
    const W = 720;
    const H = 220;
    const padL = 64;
    const padR = 20;
    const padT = 24;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const passo = plotW / serie.length;
    const barW = Math.min(28, passo * 0.28);

    const gridLinhas = [0, 0.5, 1]
      .map((frac) => {
        const y = padT + plotH * (1 - frac);
        const val = maxVal * frac;
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="chart-gridline" />
          <text x="${padL - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="chart-axis-text">${esc(formatarMoedaCurta(val))}</text>`;
      })
      .join('');

    const grupos = serie
      .map((item, idx) => {
        const cx = padL + passo * idx + passo / 2;
        const hRec = (Number(item.receitas || 0) / maxVal) * plotH;
        const hDesp = (Number(item.despesas || 0) / maxVal) * plotH;
        const yRec = padT + plotH - hRec;
        const yDesp = padT + plotH - hDesp;
        const xRec = cx - barW - 2;
        const xDesp = cx + 2;
        const rotuloUltimo =
          idx === serie.length - 1 && item.receitas > 0
            ? `<text x="${(xRec + barW / 2).toFixed(1)}" y="${Math.max(14, yRec - 6).toFixed(1)}" text-anchor="middle" class="chart-value-text">${esc(formatarMoedaCurta(item.receitas))}</text>`
            : '';
        return `
          <g>
            <rect x="${xRec.toFixed(1)}" y="${yRec.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, hRec).toFixed(1)}" rx="3" class="chart-bar-rec">
              <title>${esc(item.rotulo)}: Receitas ${esc(formatarMoeda(item.receitas))}</title>
            </rect>
            <rect x="${xDesp.toFixed(1)}" y="${yDesp.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, hDesp).toFixed(1)}" rx="3" class="chart-bar-desp">
              <title>${esc(item.rotulo)}: Despesas ${esc(formatarMoeda(item.despesas))}</title>
            </rect>
            ${rotuloUltimo}
            <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="chart-axis-text" style="text-transform:capitalize">${esc(item.rotulo)}</text>
          </g>`;
      })
      .join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Receitas e despesas dos últimos 6 meses">
        ${gridLinhas}
        ${grupos}
      </svg>`;
  }

  $('#btn-exportar-csv').addEventListener('click', async () => {
    try {
      const resp = await fetch(`${API}/dashboard/exportar?${queryParams()}`, {
        headers: { Authorization: `Bearer ${tokenAtual()}` },
      });
      if (!resp.ok) throw new Error('Falha ao exportar relatório.');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${inputInicio.value}-${inputFim.value}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      mostrarToast('Relatório CSV exportado.');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });

  await carregar();
}

/* ==================== EQUIPE (DENTISTAS) ==================== */

function telaDentistas() {
  if (!montarShell('dentistas')) return;

  const corpo = $('#lista-dentistas');
  const form = $('#form-dentista');
  const erroForm = $('#erro-dentista');
  const tituloModal = $('#titulo-modal-dentista');
  const campoSenha = form.senha;
  let listaCache = [];

  async function carregar() {
    try {
      listaCache = await api('/dentistas');
      corpo.innerHTML = listaCache.length
        ? listaCache
            .map(
              (d) => `
              <tr>
                <td class="td-forte">${esc(d.nome)}</td>
                <td class="td-secundario">${esc(d.cargo)}</td>
                <td class="tabular td-secundario">${esc(d.cro)}</td>
                <td class="td-secundario">${esc(d.email)}</td>
                <td class="td-acoes">
                  <button type="button" class="btn btn-fantasma btn-sm" data-editar-dent="${d.id}">Editar</button>
                  <button type="button" class="btn btn-perigo btn-sm" data-remover-dent="${d.id}">Excluir</button>
                </td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="5" class="celula-vazia">Nenhum profissional cadastrado.</td></tr>';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  $('#btn-novo-dentista').addEventListener('click', () => {
    form.reset();
    form.id.value = '';
    campoSenha.required = true;
    $('#label-senha').textContent = 'Senha inicial (mínimo 8 caracteres)';
    erroForm.textContent = '';
    tituloModal.textContent = 'Novo profissional';
    abrirModal('modal-dentista');
  });

  corpo.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-dent]');
    const remover = e.target.closest('[data-remover-dent]');
    if (editar) {
      const d = listaCache.find((x) => x.id === Number(editar.dataset.editarDent));
      if (!d) return;
      form.id.value = String(d.id);
      form.nome.value = d.nome;
      form.cargo.value = d.cargo;
      form.cro.value = d.cro;
      form.email.value = d.email;
      campoSenha.value = '';
      campoSenha.required = false;
      $('#label-senha').textContent = 'Nova senha (opcional, mínimo 8 caracteres)';
      erroForm.textContent = '';
      tituloModal.textContent = 'Editar profissional';
      abrirModal('modal-dentista');
    }
    if (remover) {
      try {
        await api(`/dentistas/${remover.dataset.removerDent}`, { method: 'DELETE' });
        mostrarToast('Profissional removido.');
        carregar();
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroForm.textContent = '';
    const { id, ...dados } = dadosDoForm(form);
    try {
      await api(id ? `/dentistas/${id}` : '/dentistas', {
        method: id ? 'PATCH' : 'POST',
        body: dados,
      });
      fecharModal('modal-dentista');
      mostrarToast(id ? 'Profissional atualizado.' : 'Profissional cadastrado.');
      carregar();
    } catch (erro) {
      erroForm.textContent = erro.message;
    }
  });

  carregar();
}

/* ==================== CONFIGURAÇÕES ==================== */

async function telaConfiguracoes() {
  const usuario = montarShell('configuracoes');
  if (!usuario) return;

  const form = $('#form-config');
  const segTema = $('#seg-tema');

  const prefAtual = localStorage.getItem('sc_theme') || 'system';
  $$('button[data-pref-tema]', segTema).forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.prefTema === prefAtual))
  );
  const atualizarThumb = ativarIndicadorDeslizante(
    segTema,
    'button[aria-selected="true"]',
    '.segmented-thumb'
  );

  segTema.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pref-tema]');
    if (!btn) return;
    aplicarTema(btn.dataset.prefTema);
    $$('button[data-pref-tema]', segTema).forEach((b) =>
      b.setAttribute('aria-selected', String(b === btn))
    );
    atualizarThumb();
  });

  $('#perfil-nome').textContent = usuario.nome;
  $('#perfil-cargo').textContent = `${usuario.cargo} · ${usuario.cro}`;
  $('#perfil-email').textContent = usuario.email;

  try {
    const cfg = await api('/configuracoes');
    form.nome_clinica.value = cfg.nome_clinica;
    form.unidade.value = cfg.unidade;
    form.telefone.value = cfg.telefone;
    form.endereco.value = cfg.endereco;
    form.horario_funcionamento.value = cfg.horario_funcionamento;
    form.slots_diarios_por_dentista.value = String(cfg.slots_diarios_por_dentista);
  } catch (erro) {
    mostrarToast(erro.message, 'erro');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dadosDoForm(form);
    try {
      await api('/configuracoes', {
        method: 'PATCH',
        body: {
          ...d,
          slots_diarios_por_dentista: Number(d.slots_diarios_por_dentista),
        },
      });
      await carregarMetadadosShell();
      mostrarToast('Configurações salvas.');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  });
}

/* ==================== AJUDA ==================== */

function telaAjuda() {
  montarShell('ajuda');
}

/* ==================== INICIALIZAÇÃO ==================== */

const TELAS = {
  login: telaLogin,
  agenda: telaAgenda,
  pacientes: telaPacientes,
  prontuario: telaProntuario,
  financeiro: telaFinanceiro,
  dashboard: telaDashboard,
  dentistas: telaDentistas,
  configuracoes: telaConfiguracoes,
  ajuda: telaAjuda,
};

TELAS[document.body.dataset.pagina]?.();
