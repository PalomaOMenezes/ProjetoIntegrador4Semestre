/* Infraestrutura compartilhada do sistema interno SmileClinic */

const IS_LOCAL =
  location.protocol === 'file:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1';
const API = IS_LOCAL ? 'http://127.0.0.1:3000' : '/api';

const MAPA_SERVICO_PROCEDIMENTO = {
  'primeira-consulta': 'Avaliação inicial',
  limpeza: 'Limpeza e profilaxia',
  emergencia: 'Atendimento de emergência',
  ortodontia: 'Avaliação ortodôntica',
  clareamento: 'Clareamento dental',
  implante: 'Avaliação para implante',
  outro: 'Consulta odontológica',
};

const STATUS_CONSULTA = [
  { valor: 'agendada', rotulo: 'Agendada' },
  { valor: 'confirmada', rotulo: 'Confirmado' },
  { valor: 'na_recepcao', rotulo: 'Na recepção' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento' },
  { valor: 'realizada', rotulo: 'Concluído' },
  { valor: 'falta', rotulo: 'Falta' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
];

const FACES = [
  { valor: 'oclusal', rotulo: 'Oclusal' },
  { valor: 'mesial', rotulo: 'Mesial' },
  { valor: 'distal', rotulo: 'Distal' },
  { valor: 'vestibular', rotulo: 'Vestibular' },
  { valor: 'lingual', rotulo: 'Lingual' },
];

const TIPOS_DOCUMENTO = {
  receita: 'Receita',
  atestado: 'Atestado',
  orcamento: 'Orçamento',
  encaminhamento: 'Encaminhamento',
  termo: 'Termo de consentimento',
};

const STATUS_PLANO = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_SOLICITACAO = {
  pendente: 'Pendente',
  contatado: 'Contatado',
  agendado: 'Agendado',
  arquivado: 'Arquivado',
};

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function tokenAtual() {
  return sessionStorage.getItem('sc_token') || '';
}

function salvarSessao(respostaLogin) {
  const { access_token: token, ...dentista } = respostaLogin;
  sessionStorage.setItem('dentista', JSON.stringify(dentista));
  if (token) sessionStorage.setItem('sc_token', token);
}

function encerrarSessao() {
  sessionStorage.removeItem('dentista');
  sessionStorage.removeItem('sc_token');
}

async function api(caminho, opcoes = {}) {
  let resposta;
  const token = tokenAtual();
  const headers = { 'Content-Type': 'application/json', ...(opcoes.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    resposta = await fetch(API + caminho, {
      ...opcoes,
      headers,
      body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível conectar à API.');
  }
  if (resposta.status === 401 && caminho !== '/auth/login') {
    encerrarSessao();
    location.href = 'login.html';
    throw new Error('Sessão expirada.');
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.message || 'Erro inesperado na API.');
  return dados;
}

function dadosDoForm(form) {
  const dados = {};
  new FormData(form).forEach((valor, chave) => {
    const texto = String(valor).trim();
    if (texto !== '') dados[chave] = texto;
  });
  return dados;
}

/* ---------- Formatadores ---------- */

const formatarCpf = (c) =>
  String(c || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

const formatarTelefone = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return t || '';
};

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });

const formatarMoedaCurta = (valor) => {
  const n = Number(valor || 0);
  const temCentavos = Math.abs(n % 1) > 0.001;
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: temCentavos ? 2 : 0,
    maximumFractionDigits: temCentavos ? 2 : 0,
  });
};

const hojeISO = () => new Date().toLocaleDateString('sv-SE');

function somarDiasISO(iso, delta) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + delta);
  return dt.toLocaleDateString('sv-SE');
}

function inicioSemanaISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const diaSemana = dt.getDay(); // 0=Dom, 1=Seg
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  dt.setDate(dt.getDate() + diff);
  return dt.toLocaleDateString('sv-SE');
}

function diaSemanaCurto(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const nome = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${String(d).padStart(2, '0')}`;
}

function intervaloMes(ano, mesZeroBased) {
  const inicio = new Date(ano, mesZeroBased, 1);
  const fim = new Date(ano, mesZeroBased + 1, 0);
  return {
    inicio: inicio.toLocaleDateString('sv-SE'),
    fim: fim.toLocaleDateString('sv-SE'),
  };
}

const horaISO = (iso) => String(iso || '').slice(11, 16);

function dataBR(iso) {
  if (!iso) return '—';
  const parte = String(iso).slice(0, 10);
  const [a, m, d] = parte.split('-');
  if (!a || !m || !d) return String(iso);
  return `${d}/${m}/${a}`;
}

function dataExtenso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nomeMesAno(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - a;
  if (
    hoje.getMonth() + 1 < m ||
    (hoje.getMonth() + 1 === m && hoje.getDate() < d)
  ) {
    idade -= 1;
  }
  return idade;
}

function formatarNumeroProntuario(id) {
  return String(id).padStart(6, '0');
}

function rotuloStatusConsulta(valor) {
  const item = STATUS_CONSULTA.find((s) => s.valor === valor);
  return item ? item.rotulo : valor;
}

function opcoes(lista, rotulo, selecionado) {
  return lista
    .map(
      (item) =>
        `<option value="${item.id}" ${
          String(item.id) === String(selecionado) ? 'selected' : ''
        }>${esc(rotulo(item))}</option>`
    )
    .join('');
}

function mascaraTelefone(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    input.value =
      d.length <= 10
        ? d.replace(
            /^(\d{0,2})(\d{0,4})(\d{0,4}).*/,
            (_, a, b, c) =>
              (a ? `(${a}` : '') + (b ? `) ${b}` : '') + (c ? `-${c}` : '')
          )
        : d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
  });
}

function mascaraCpf(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  });
}

/* ---------- Tema (Claro / Escuro / Sistema) ---------- */

function aplicarTema(preferencia) {
  const pref = preferencia || 'system';
  localStorage.setItem('sc_theme', pref);
  const dark =
    pref === 'dark' ||
    (pref === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
  atualizarIconesTema();
}

function alternarTemaRapido() {
  const atual = document.documentElement.dataset.theme;
  aplicarTema(atual === 'dark' ? 'light' : 'dark');
}

function iconeTemaSvg() {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

function atualizarIconesTema() {
  $$('[data-toggle-tema]').forEach((btn) => {
    btn.innerHTML = iconeTemaSvg();
    const dark = document.documentElement.dataset.theme === 'dark';
    btn.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo noturno');
    btn.setAttribute('title', dark ? 'Modo claro' : 'Modo noturno');
  });
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('sc_theme') || 'system') === 'system') {
      aplicarTema('system');
    }
  });
}

/* ---------- Toast ---------- */

function garantirPilhaToast() {
  let pilha = $('#toast-pilha');
  if (!pilha) {
    pilha = document.createElement('div');
    pilha.id = 'toast-pilha';
    pilha.className = 'toast-pilha';
    pilha.setAttribute('aria-live', 'polite');
    document.body.appendChild(pilha);
  }
  return pilha;
}

function mostrarToast(texto, tipo = 'ok') {
  const pilha = garantirPilhaToast();
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'erro' ? 'erro' : ''}`;
  el.textContent = texto;
  pilha.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visivel'));
  setTimeout(() => {
    el.classList.remove('visivel');
    setTimeout(() => el.remove(), 220);
  }, 3000);
}

/* ---------- Modais (iOS Sheet) ---------- */

function abrirModal(id) {
  fecharMenuSelect();
  const backdrop = $(`#${id}`);
  if (!backdrop) return;
  sincronizarSelects(backdrop);
  backdrop.classList.add('aberto');
  backdrop.setAttribute('aria-hidden', 'false');
  const foco = backdrop.querySelector(
    'input:not([type="hidden"]), .sc-select-trigger, textarea'
  );
  if (foco) setTimeout(() => foco.focus(), 60);
}

function fecharModal(id) {
  fecharMenuSelect();
  const backdrop = typeof id === 'string' ? $(`#${id}`) : id;
  if (!backdrop) return;
  backdrop.classList.remove('aberto');
  backdrop.setAttribute('aria-hidden', 'true');
}

function inicializarModais() {
  $$('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) fecharModal(backdrop);
    });
    backdrop.querySelectorAll('[data-fechar-modal]').forEach((btn) => {
      btn.addEventListener('click', () => fecharModal(backdrop));
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal-backdrop.aberto').forEach((b) => fecharModal(b));
    }
  });
}

/* ---------- Indicador deslizante 60fps (GPU transform) ---------- */

function sincronizarIndicador(container, seletorAtivo, seletorIndicador) {
  if (!container) return;
  const indicador = container.querySelector(seletorIndicador);
  const ativo = container.querySelector(seletorAtivo);
  if (!indicador || !ativo) return;
  const x = ativo.offsetLeft;
  const w = ativo.offsetWidth;
  indicador.style.width = `${w}px`;
  indicador.style.transform = `translate3d(${x}px, 0, 0)`;
}

function ativarIndicadorDeslizante(container, seletorAtivo, seletorIndicador) {
  if (!container) return () => {};
  const atualizar = () =>
    requestAnimationFrame(() =>
      sincronizarIndicador(container, seletorAtivo, seletorIndicador)
    );
  atualizar();
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(atualizar);
    ro.observe(container);
  } else {
    window.addEventListener('resize', atualizar);
  }
  return atualizar;
}

/* ---------- Sessão e Shell compartilhado ---------- */

function usuarioLogado() {
  try {
    return JSON.parse(sessionStorage.getItem('dentista'));
  } catch {
    return null;
  }
}

const ITENS_MENU_PRINCIPAL = [
  { id: 'agenda', rotulo: 'Agenda', href: 'agenda.html' },
  { id: 'pacientes', rotulo: 'Pacientes', href: 'pacientes.html' },
  { id: 'prontuario', rotulo: 'Prontuários', href: 'prontuario.html' },
  { id: 'financeiro', rotulo: 'Financeiro', href: 'financeiro.html' },
  { id: 'dashboard', rotulo: 'Dashboard', href: 'dashboard.html' },
  { id: 'dentistas', rotulo: 'Equipe', href: 'dentistas.html' },
];

const ITENS_MENU_RODAPE = [
  { id: 'configuracoes', rotulo: 'Configurações', href: 'configuracoes.html' },
  { id: 'ajuda', rotulo: 'Ajuda e suporte', href: 'ajuda.html' },
];

function montarShell(paginaAtiva) {
  const usuario = usuarioLogado();
  if (!usuario || !tokenAtual()) {
    encerrarSessao();
    location.href = 'login.html';
    return null;
  }

  const slot = $('#sidebar-slot');
  if (slot) {
    const linkHtml = (item) =>
      `<li><a href="${item.href}" class="nav-link" ${
        item.id === paginaAtiva ? 'aria-current="page"' : ''
      }><span>${item.rotulo}</span><span class="nav-badge oculto" data-badge="${item.id}"></span></a></li>`;

    const logoSvg = `
      <svg class="painel-logo-marca" viewBox="0 0 32 32" aria-hidden="true">
        <rect class="painel-logo-bg" width="32" height="32" rx="9" />
        <path class="painel-logo-dente" d="M10.2 11.4c0-3.1 3.3-3.6 5.8-2 2.5-1.6 5.8-1.1 5.8 2 0 3.7-1.4 6.5-2 11-.2 1.6-2 1.8-2.5.2l-.7-2.5c-.2-.7-1-.7-1.2 0l-.7 2.5c-.5 1.6-2.3 1.4-2.5-.2-.6-4.5-2-7.3-2-11Z" />
        <path class="painel-logo-sorriso" d="M13.2 13.7c1.6 1.5 4 1.5 5.6 0" />
      </svg>`;

    slot.outerHTML = `
      <header class="topbar-mobile">
        <button type="button" class="icon-btn" id="btn-abrir-menu" aria-label="Abrir navegação">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div class="topbar-marca-wrap">${logoSvg}<strong data-clinica-nome>SmileClinic</strong></div>
        <button type="button" class="icon-btn" data-toggle-tema aria-label="Alternar tema"></button>
      </header>
      <div class="sidebar-scrim" id="sidebar-scrim"></div>
      <aside class="sidebar" id="sidebar" aria-label="Navegação principal">
        <a href="agenda.html" class="sidebar-marca">
          <div class="sidebar-marca-topo">
            ${logoSvg}
            <strong data-clinica-nome>SmileClinic</strong>
          </div>
          <span data-clinica-unidade>Unidade principal</span>
        </a>
        <ul class="nav-lista">
          ${ITENS_MENU_PRINCIPAL.map(linkHtml).join('')}
        </ul>
        <div class="sidebar-rodape">
          <ul class="nav-lista">
            ${ITENS_MENU_RODAPE.map(linkHtml).join('')}
          </ul>
          <div class="sidebar-acoes">
            <div class="usuario-info">
              <strong>${esc(usuario.nome)}</strong>
              <small>${esc(usuario.cro)}</small>
            </div>
            <div style="display:flex;gap:6px">
              <button type="button" class="icon-btn" data-toggle-tema aria-label="Alternar tema"></button>
              <button type="button" class="icon-btn" id="btn-sair" aria-label="Sair" title="Sair">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  atualizarIconesTema();
  $$('[data-toggle-tema]').forEach((btn) =>
    btn.addEventListener('click', alternarTemaRapido)
  );

  const btnSair = $('#btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', () => {
      encerrarSessao();
      location.href = 'login.html';
    });
  }

  const sidebar = $('#sidebar');
  const scrim = $('#sidebar-scrim');
  const abrirMenu = () => {
    sidebar?.classList.add('aberta');
    scrim?.classList.add('ativo');
  };
  const fecharMenu = () => {
    sidebar?.classList.remove('aberta');
    scrim?.classList.remove('ativo');
  };
  $('#btn-abrir-menu')?.addEventListener('click', abrirMenu);
  scrim?.addEventListener('click', fecharMenu);

  // Carrega nome da unidade e pré-agendamentos pendentes sem bloquear a tela
  carregarMetadadosShell();
  inicializarModais();
  inicializarSelectsCustomizados();
  inicializarCalendariosCustomizados();
  return usuario;
}

/* ---------- Custom Select Popover (estilo iOS 60fps) ---------- */

const _CHEVRON_SVG =
  '<svg class="sc-select-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';
const _CHECK_SVG =
  '<svg class="sc-select-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
const _SELECT_VALUE_DESC = Object.getOwnPropertyDescriptor(
  HTMLSelectElement.prototype,
  'value'
);

let _selectMenuEl = null;
let _selectAtivo = null;
let _selectFocoIdx = -1;
let _selectGlobalInit = false;

function garantirMenuSelect() {
  if (!_selectMenuEl) {
    _selectMenuEl = document.createElement('div');
    _selectMenuEl.id = 'sc-select-menu';
    _selectMenuEl.className = 'sc-select-menu';
    _selectMenuEl.setAttribute('role', 'listbox');
    _selectMenuEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_selectMenuEl);
  }
  return _selectMenuEl;
}

function fecharMenuSelect(devolverFoco = false) {
  if (!_selectAtivo || !_selectMenuEl) return;
  const triggerAnterior = _selectAtivo.trigger;
  triggerAnterior.setAttribute('aria-expanded', 'false');
  _selectMenuEl.classList.remove('aberto');
  _selectMenuEl.setAttribute('aria-hidden', 'true');
  _selectAtivo = null;
  _selectFocoIdx = -1;
  if (devolverFoco) triggerAnterior.focus();
}

function posicionarMenuSelect(trigger, isPill) {
  const menu = garantirMenuSelect();
  const rect = trigger.getBoundingClientRect();
  const margem = 10;
  const larguraMin = Math.max(rect.width, isPill ? 168 : 196);
  const larguraMax = Math.min(360, window.innerWidth - margem * 2);

  menu.style.minWidth = `${Math.min(larguraMin, larguraMax)}px`;
  menu.style.maxWidth = `${larguraMax}px`;
  menu.classList.remove('para-cima');

  const menuRect = menu.getBoundingClientRect();
  const alturaMenu = Math.min(menuRect.height || 220, 280);
  const espacoAbaixo = window.innerHeight - rect.bottom - margem;
  const espacoAcima = rect.top - margem;
  const abrirAcima = espacoAbaixo < alturaMenu && espacoAcima > espacoAbaixo;

  const top = abrirAcima
    ? Math.max(margem, rect.top - alturaMenu - 6)
    : Math.min(window.innerHeight - alturaMenu - margem, rect.bottom + 6);

  let left = rect.left;
  const larguraReal = Math.max(menuRect.width, larguraMin);
  if (left + larguraReal > window.innerWidth - margem) {
    left = Math.max(margem, rect.right - larguraReal);
  }

  menu.classList.toggle('para-cima', abrirAcima);
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

function destacarOpcaoMenu(idx) {
  if (!_selectMenuEl) return;
  const botoes = $$('.sc-select-option:not(:disabled)', _selectMenuEl);
  if (!botoes.length) return;
  _selectFocoIdx = (idx + botoes.length) % botoes.length;
  botoes.forEach((b, i) => b.classList.toggle('focado', i === _selectFocoIdx));
  botoes[_selectFocoIdx]?.scrollIntoView({ block: 'nearest' });
}

function abrirMenuSelect(ctx) {
  const menu = garantirMenuSelect();
  if (_selectAtivo === ctx) {
    fecharMenuSelect(true);
    return;
  }
  if (_selectAtivo) fecharMenuSelect(false);
  if (typeof fecharCalendario === 'function') fecharCalendario(false);

  const { select, trigger } = ctx;
  const isPill = select.classList.contains('status-select');
  const opcoesLista = Array.from(select.options).filter(
    (opt) => !(opt.disabled && opt.value === '')
  );

  menu.innerHTML = opcoesLista.length
    ? opcoesLista
        .map((opt) => {
          const selecionado = opt.value === select.value;
          const barra = isPill
            ? `<span class="sc-select-opt-bar st-${esc(opt.value)}" aria-hidden="true"></span>`
            : '';
          return `
            <button
              type="button"
              class="sc-select-option"
              role="option"
              data-val="${esc(opt.value)}"
              aria-selected="${String(selecionado)}"
              ${opt.disabled ? 'disabled' : ''}
            >
              <span class="sc-select-opt-main">${barra}<span>${esc(opt.textContent)}</span></span>
              ${selecionado ? _CHECK_SVG : ''}
            </button>`;
        })
        .join('')
    : '<div style="padding:10px 12px;font-size:13px;color:var(--text-tertiary)">Nenhuma opção disponível</div>';

  _selectAtivo = ctx;
  trigger.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-hidden', 'false');
  menu.classList.remove('aberto');

  posicionarMenuSelect(trigger, isPill);
  void menu.offsetWidth;
  menu.classList.add('aberto');

  const botoes = $$('.sc-select-option:not(:disabled)', menu);
  const idxAtual = botoes.findIndex((b) => b.getAttribute('aria-selected') === 'true');
  _selectFocoIdx = idxAtual >= 0 ? idxAtual : 0;
  if (botoes[_selectFocoIdx]) {
    botoes[_selectFocoIdx].classList.add('focado');
    botoes[_selectFocoIdx].scrollIntoView({ block: 'nearest' });
  }
}

function sincronizarSelectElemento(select) {
  const ctx = select._scSelect;
  if (!ctx) return;
  if (!select.classList.contains('sc-select-native')) {
    select.classList.add('sc-select-native');
  }
  const { trigger, labelEl } = ctx;
  const opt =
    select.selectedOptions?.[0] ||
    Array.from(select.options).find((o) => o.value === select.value) ||
    select.options[0];

  labelEl.textContent = opt ? opt.textContent : 'Selecione';
  labelEl.classList.toggle(
    'placeholder',
    Boolean(!opt || (opt.disabled && opt.value === ''))
  );
  trigger.disabled = select.disabled;

  const isPill = select.classList.contains('status-select');
  const statusClasses = Array.from(select.classList).filter((c) =>
    c.startsWith('st-')
  );
  trigger.className = [
    'sc-select-trigger',
    isPill ? 'sc-select-pill' : '',
    ...statusClasses,
  ]
    .filter(Boolean)
    .join(' ');
}

function sincronizarSelects(raiz = document) {
  $$('select', raiz).forEach((s) => {
    if (!s._scSelect) aprimorarSelect(s);
    else sincronizarSelectElemento(s);
  });
}

function aprimorarSelect(select) {
  if (!select || select._scSelect || select.multiple || select.size > 1) return;

  const wrap = document.createElement('div');
  wrap.className = 'sc-select-wrap';
  if (select.style.minWidth) {
    wrap.style.minWidth = select.style.minWidth;
    select.style.minWidth = '';
  }

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'sc-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (select.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'sc-select-label';
  trigger.appendChild(labelEl);
  trigger.insertAdjacentHTML('beforeend', _CHEVRON_SVG);

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  wrap.appendChild(trigger);

  select.classList.add('sc-select-native');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-hidden', 'true');

  const ctx = { select, trigger, labelEl, wrap };
  select._scSelect = ctx;

  if (_SELECT_VALUE_DESC && _SELECT_VALUE_DESC.set) {
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() {
        return _SELECT_VALUE_DESC.get.call(this);
      },
      set(val) {
        _SELECT_VALUE_DESC.set.call(this, val);
        sincronizarSelectElemento(this);
      },
    });
  }

  if (select.id) {
    const labelFor = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    labelFor?.addEventListener('click', (e) => {
      e.preventDefault();
      trigger.focus();
      abrirMenuSelect(ctx);
    });
  }

  select.form?.addEventListener('reset', () => {
    requestAnimationFrame(() => sincronizarSelectElemento(select));
  });

  select.addEventListener('change', () => sincronizarSelectElemento(select));

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirMenuSelect(ctx);
  });

  trigger.addEventListener('keydown', (e) => {
    if (_selectAtivo === ctx) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        destacarOpcaoMenu(_selectFocoIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        destacarOpcaoMenu(_selectFocoIdx - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const botoes = $$('.sc-select-option:not(:disabled)', _selectMenuEl);
        botoes[_selectFocoIdx]?.click();
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        fecharMenuSelect(e.key === 'Escape');
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirMenuSelect(ctx);
    }
  });

  const obsLocal = new MutationObserver(() => {
    sincronizarSelectElemento(select);
    if (_selectAtivo === ctx) {
      fecharMenuSelect(false);
    }
  });
  obsLocal.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled'],
  });

  sincronizarSelectElemento(select);
}

function inicializarSelectsCustomizados() {
  sincronizarSelects(document);
  if (_selectGlobalInit) return;
  _selectGlobalInit = true;

  const menu = garantirMenuSelect();
  menu.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.sc-select-option:not(:disabled)');
    if (!optBtn || !_selectAtivo) return;
    const { select } = _selectAtivo;
    const novoVal = optBtn.dataset.val;
    const mudou = select.value !== novoVal;
    select.value = novoVal;
    fecharMenuSelect(true);
    if (mudou) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.addEventListener('click', (e) => {
    if (!_selectAtivo) return;
    if (
      !_selectMenuEl.contains(e.target) &&
      !_selectAtivo.trigger.contains(e.target)
    ) {
      fecharMenuSelect(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _selectAtivo) {
      e.stopPropagation();
      fecharMenuSelect(true);
    }
  });

  window.addEventListener('resize', () => fecharMenuSelect(false));
  window.addEventListener(
    'scroll',
    (e) => {
      if (_selectAtivo && e.target !== _selectMenuEl) {
        fecharMenuSelect(false);
      }
    },
    true
  );

  const obsGlobal = new MutationObserver((muts) => {
    for (const mut of muts) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'SELECT') {
          aprimorarSelect(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('select').forEach(aprimorarSelect);
        }
      }
    }
  });
  obsGlobal.observe(document.body, { childList: true, subtree: true });
}

/* ---------- Custom Date Picker Popover (estilo iOS 60fps) ---------- */

const _CALENDAR_SVG =
  '<svg class="sc-date-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2.2"/><path d="M2 6.5h12M5.2 1.8v2.4M10.8 1.8v2.4"/></svg>';
const _DATE_VALUE_DESC = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value'
);
const _MESES_CAL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const _MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];
const _DIAS_SEMANA_CAL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

let _calPopEl = null;
let _calAtivo = null;
let _calAno = 2026;
let _calMes = 0;
let _calModo = 'dias';
let _calGlobalInit = false;

function formatarDataDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function parseIsoParts(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return { ano: a, mes: m - 1, dia: d };
}

function montarIsoData(ano, mesZero, dia) {
  return `${ano}-${String(mesZero + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function garantirPopoverCalendario() {
  if (!_calPopEl) {
    _calPopEl = document.createElement('div');
    _calPopEl.className = 'sc-date-popover';
    _calPopEl.setAttribute('role', 'dialog');
    _calPopEl.setAttribute('aria-modal', 'false');
    _calPopEl.setAttribute('aria-label', 'Selecionar data');
    _calPopEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_calPopEl);
  }
  return _calPopEl;
}

function posicionarCalendario(trigger) {
  const pop = garantirPopoverCalendario();
  const rect = trigger.getBoundingClientRect();
  const margem = 10;
  const largura = 276;
  const alturaEst = 316;

  pop.classList.remove('para-cima');
  const espacoAbaixo = window.innerHeight - rect.bottom - margem;
  const espacoAcima = rect.top - margem;
  const abrirAcima = espacoAbaixo < alturaEst && espacoAcima > espacoAbaixo;
  const top = abrirAcima
    ? Math.max(margem, rect.top - alturaEst - 6)
    : rect.bottom + 6;
  const left = Math.max(
    margem,
    Math.min(rect.left, window.innerWidth - largura - margem)
  );

  pop.classList.toggle('para-cima', abrirAcima);
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
}

function fecharCalendario(devolverFoco = false) {
  if (!_calAtivo || !_calPopEl) return;
  const { trigger } = _calAtivo;
  trigger.setAttribute('aria-expanded', 'false');
  _calPopEl.classList.remove('aberto');
  _calPopEl.setAttribute('aria-hidden', 'true');
  _calAtivo = null;
  _calModo = 'dias';
  if (devolverFoco) trigger.focus();
}

function renderizarCalendario() {
  if (!_calAtivo) return;
  const pop = garantirPopoverCalendario();
  const { input } = _calAtivo;
  const hoje = hojeISO();
  const valAtual = input.value;

  const setaEsq =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5"/></svg>';
  const setaDir =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';

  if (_calModo === 'meses') {
    const mesesHtml = _MESES_CURTOS.map((nome, idx) => {
      const ativo = idx === _calMes;
      return `<button type="button" class="sc-date-mes-btn${
        ativo ? ' ativo' : ''
      }" data-mes="${idx}">${nome}</button>`;
    }).join('');

    pop.innerHTML = `
      <div class="sc-date-header">
        <button type="button" class="sc-date-nav" data-nav-ano="-1" aria-label="Ano anterior">${setaEsq}</button>
        <button type="button" class="sc-date-titulo" data-toggle-modo>
          <span>${_calAno}</span>
          ${_CHEVRON_SVG}
        </button>
        <button type="button" class="sc-date-nav" data-nav-ano="1" aria-label="Próximo ano">${setaDir}</button>
      </div>
      <div class="sc-date-meses-grid">${mesesHtml}</div>
      <div class="sc-date-footer">
        <button type="button" class="sc-date-acao" data-cal-limpar ${
          input.required ? 'disabled' : ''
        }>Limpar</button>
        <button type="button" class="sc-date-acao destaque" data-cal-hoje>Hoje</button>
      </div>
    `;
    return;
  }

  const primeiroDiaSemana = new Date(_calAno, _calMes, 1).getDay();
  const diasNoMes = new Date(_calAno, _calMes + 1, 0).getDate();
  const diasMesAnt = new Date(_calAno, _calMes, 0).getDate();

  const celulas = [];
  for (let i = primeiroDiaSemana - 1; i >= 0; i -= 1) {
    const d = diasMesAnt - i;
    const prevMes = _calMes === 0 ? 11 : _calMes - 1;
    const prevAno = _calMes === 0 ? _calAno - 1 : _calAno;
    celulas.push({
      dia: d,
      iso: montarIsoData(prevAno, prevMes, d),
      fora: true,
    });
  }
  for (let d = 1; d <= diasNoMes; d += 1) {
    celulas.push({
      dia: d,
      iso: montarIsoData(_calAno, _calMes, d),
      fora: false,
    });
  }
  const faltam = 42 - celulas.length;
  for (let d = 1; d <= faltam; d += 1) {
    const proxMes = _calMes === 11 ? 0 : _calMes + 1;
    const proxAno = _calMes === 11 ? _calAno + 1 : _calAno;
    celulas.push({
      dia: d,
      iso: montarIsoData(proxAno, proxMes, d),
      fora: true,
    });
  }

  const diasHtml = celulas
    .map((c) => {
      const classes = ['sc-date-day'];
      if (c.fora) classes.push('fora');
      if (c.iso === hoje) classes.push('hoje');
      if (c.iso === valAtual) classes.push('selecionado');
      return `<button type="button" class="${classes.join(' ')}" data-iso="${
        c.iso
      }" aria-pressed="${String(c.iso === valAtual)}">${c.dia}</button>`;
    })
    .join('');

  pop.innerHTML = `
    <div class="sc-date-header">
      <button type="button" class="sc-date-nav" data-nav-mes="-1" aria-label="Mês anterior">${setaEsq}</button>
      <button type="button" class="sc-date-titulo" data-toggle-modo>
        <span>${_MESES_CAL[_calMes]} ${_calAno}</span>
        ${_CHEVRON_SVG}
      </button>
      <button type="button" class="sc-date-nav" data-nav-mes="1" aria-label="Próximo mês">${setaDir}</button>
    </div>
    <div class="sc-date-semana">
      ${_DIAS_SEMANA_CAL.map((s) => `<span>${s}</span>`).join('')}
    </div>
    <div class="sc-date-grid">${diasHtml}</div>
    <div class="sc-date-footer">
      <button type="button" class="sc-date-acao" data-cal-limpar ${
        input.required ? 'disabled' : ''
      }>Limpar</button>
      <button type="button" class="sc-date-acao destaque" data-cal-hoje>Hoje</button>
    </div>
  `;
}

function abrirCalendario(ctx) {
  if (_calAtivo === ctx) {
    fecharCalendario(true);
    return;
  }
  fecharCalendario(false);
  fecharMenuSelect(false);

  const { input, trigger } = ctx;
  if (input.disabled) return;

  const ref = parseIsoParts(input.value) || parseIsoParts(hojeISO());
  _calAno = ref.ano;
  _calMes = ref.mes;
  _calModo = 'dias';
  _calAtivo = ctx;

  const pop = garantirPopoverCalendario();
  renderizarCalendario();
  trigger.setAttribute('aria-expanded', 'true');
  pop.setAttribute('aria-hidden', 'false');
  pop.classList.remove('aberto');

  posicionarCalendario(trigger);
  void pop.offsetWidth;
  pop.classList.add('aberto');
}

function sincronizarDateInput(input) {
  const ctx = input._scDate;
  if (!ctx) return;
  if (!input.classList.contains('sc-date-native')) {
    input.classList.add('sc-date-native');
  }
  const { trigger, labelEl } = ctx;
  const formatado = formatarDataDisplay(input.value);
  labelEl.textContent = formatado || 'Selecionar data';
  labelEl.classList.toggle('placeholder', !formatado);
  trigger.disabled = input.disabled;
}

function aprimorarDateInput(input) {
  if (!input || input.type !== 'date' || input._scDate) return;

  const wrap = document.createElement('div');
  wrap.className = 'sc-date-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'sc-date-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  if (input.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', input.getAttribute('aria-label'));
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'sc-date-label';
  trigger.appendChild(labelEl);
  trigger.insertAdjacentHTML('beforeend', _CALENDAR_SVG);

  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  wrap.appendChild(trigger);

  input.classList.add('sc-date-native');
  input.setAttribute('tabindex', '-1');
  input.setAttribute('aria-hidden', 'true');

  const ctx = { input, trigger, labelEl, wrap };
  input._scDate = ctx;

  if (_DATE_VALUE_DESC && _DATE_VALUE_DESC.set) {
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return _DATE_VALUE_DESC.get.call(this);
      },
      set(val) {
        _DATE_VALUE_DESC.set.call(this, val);
        sincronizarDateInput(this);
      },
    });
  }

  if (input.id) {
    const labelFor = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    labelFor?.addEventListener('click', (e) => {
      e.preventDefault();
      trigger.focus();
      abrirCalendario(ctx);
    });
  }

  input.form?.addEventListener('reset', () => {
    requestAnimationFrame(() => sincronizarDateInput(input));
  });
  input.addEventListener('change', () => sincronizarDateInput(input));

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirCalendario(ctx);
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirCalendario(ctx);
    } else if (e.key === 'Escape' && _calAtivo === ctx) {
      e.preventDefault();
      fecharCalendario(true);
    }
  });

  sincronizarDateInput(input);
}

function inicializarCalendariosCustomizados() {
  $$('input[type="date"]').forEach(aprimorarDateInput);
  if (_calGlobalInit) return;
  _calGlobalInit = true;

  const pop = garantirPopoverCalendario();
  pop.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!_calAtivo) return;
    const { input } = _calAtivo;

    const navMes = e.target.closest('[data-nav-mes]');
    if (navMes) {
      const delta = Number(navMes.dataset.navMes);
      _calMes += delta;
      if (_calMes < 0) {
        _calMes = 11;
        _calAno -= 1;
      } else if (_calMes > 11) {
        _calMes = 0;
        _calAno += 1;
      }
      renderizarCalendario();
      return;
    }

    const navAno = e.target.closest('[data-nav-ano]');
    if (navAno) {
      _calAno += Number(navAno.dataset.navAno);
      renderizarCalendario();
      return;
    }

    if (e.target.closest('[data-toggle-modo]')) {
      _calModo = _calModo === 'dias' ? 'meses' : 'dias';
      renderizarCalendario();
      return;
    }

    const mesBtn = e.target.closest('[data-mes]');
    if (mesBtn) {
      _calMes = Number(mesBtn.dataset.mes);
      _calModo = 'dias';
      renderizarCalendario();
      return;
    }

    const diaBtn = e.target.closest('[data-iso]');
    if (diaBtn) {
      const novoIso = diaBtn.dataset.iso;
      const mudou = input.value !== novoIso;
      input.value = novoIso;
      fecharCalendario(true);
      if (mudou) input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (e.target.closest('[data-cal-hoje]')) {
      const hoje = hojeISO();
      const mudou = input.value !== hoje;
      input.value = hoje;
      fecharCalendario(true);
      if (mudou) input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (e.target.closest('[data-cal-limpar]') && !input.required) {
      const mudou = input.value !== '';
      input.value = '';
      fecharCalendario(true);
      if (mudou) input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.addEventListener('click', (e) => {
    if (!_calAtivo) return;
    if (
      !_calPopEl.contains(e.target) &&
      !_calAtivo.trigger.contains(e.target)
    ) {
      fecharCalendario(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _calAtivo) {
      e.stopPropagation();
      fecharCalendario(true);
    }
  });

  window.addEventListener('resize', () => fecharCalendario(false));
  window.addEventListener(
    'scroll',
    (e) => {
      if (_calAtivo && e.target !== _calPopEl) {
        fecharCalendario(false);
      }
    },
    true
  );

  const obsData = new MutationObserver((muts) => {
    for (const mut of muts) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'INPUT' && node.type === 'date') {
          aprimorarDateInput(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('input[type="date"]').forEach(aprimorarDateInput);
        }
      }
    }
  });
  obsData.observe(document.body, { childList: true, subtree: true });
}

async function carregarMetadadosShell() {
  try {
    const cfg = await api('/configuracoes');
    $$('[data-clinica-nome]').forEach((el) => {
      el.textContent = cfg.nome_clinica;
    });
    $$('[data-clinica-unidade]').forEach((el) => {
      el.textContent = cfg.unidade;
    });
  } catch {
    // Mantém valores padrão se a API estiver offline
  }

  try {
    const pendentes = await api('/solicitacoes?status_solicitacao=pendente');
    const badge = $('[data-badge="agenda"]');
    if (badge) {
      if (pendentes.length > 0) {
        badge.textContent = String(pendentes.length);
        badge.classList.remove('oculto');
      } else {
        badge.classList.add('oculto');
      }
    }
  } catch {
    // Silencioso
  }
}
