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
  const backdrop = $(`#${id}`);
  if (!backdrop) return;
  backdrop.classList.add('aberto');
  backdrop.setAttribute('aria-hidden', 'false');
  const foco = backdrop.querySelector('input:not([type="hidden"]), select, textarea');
  if (foco) setTimeout(() => foco.focus(), 60);
}

function fecharModal(id) {
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

    slot.outerHTML = `
      <header class="topbar-mobile">
        <button type="button" class="icon-btn" id="btn-abrir-menu" aria-label="Abrir navegação">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <strong data-clinica-nome>SmileClinic</strong>
        <button type="button" class="icon-btn" data-toggle-tema aria-label="Alternar tema"></button>
      </header>
      <div class="sidebar-scrim" id="sidebar-scrim"></div>
      <aside class="sidebar" id="sidebar" aria-label="Navegação principal">
        <a href="agenda.html" class="sidebar-marca">
          <strong data-clinica-nome>SmileClinic</strong>
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
  return usuario;
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
