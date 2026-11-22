const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const formulario = document.getElementById('form-agendamento');
const btnSubmit = document.getElementById('btn-submit');
const formStatus = document.getElementById('form-status');

const IS_LOCAL =
  location.protocol === 'file:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1';
const API_URL = IS_LOCAL
  ? 'http://127.0.0.1:3000/solicitacoes'
  : '/api/solicitacoes';

const MENSAGENS_ERRO = {
  nome: 'Informe seu nome completo.',
  email: 'Informe um e-mail válido.',
  telefone: 'Informe um telefone válido, ex: (11) 99999-9999.',
  servico: 'Selecione um serviço.',
};

function aplicarMascara(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor.length <= 10) {
    valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    valor = valor.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }
  input.value = valor;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefone(telefone) {
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length >= 10 && numeros.length <= 11;
}

function exibirErro(campo, mensagem) {
  const input = document.getElementById(campo);
  const alvoVisual = input?.closest('.lp-select-wrap')?.querySelector('.lp-select-trigger') || input;
  const erroEl = document.getElementById(`${campo}-erro`);
  alvoVisual?.classList.add('input-erro');
  alvoVisual?.classList.remove('input-valido');
  if (erroEl) erroEl.textContent = mensagem;
}

function limparErro(campo) {
  const input = document.getElementById(campo);
  const alvoVisual = input?.closest('.lp-select-wrap')?.querySelector('.lp-select-trigger') || input;
  const erroEl = document.getElementById(`${campo}-erro`);
  alvoVisual?.classList.remove('input-erro');
  alvoVisual?.classList.add('input-valido');
  if (erroEl) erroEl.textContent = '';
}

function limparStatus() {
  formStatus.textContent = '';
  formStatus.className = 'form-feedback';
}

function validarFormulario() {
  let valido = true;

  const nome = document.getElementById('nome').value.trim();
  if (nome.length < 3) {
    exibirErro('nome', MENSAGENS_ERRO.nome);
    valido = false;
  } else {
    limparErro('nome');
  }

  const email = document.getElementById('email').value.trim();
  if (!validarEmail(email)) {
    exibirErro('email', MENSAGENS_ERRO.email);
    valido = false;
  } else {
    limparErro('email');
  }

  const telefone = document.getElementById('telefone').value.trim();
  if (!validarTelefone(telefone)) {
    exibirErro('telefone', MENSAGENS_ERRO.telefone);
    valido = false;
  } else {
    limparErro('telefone');
  }

  const servico = document.getElementById('servico').value;
  if (!servico) {
    exibirErro('servico', MENSAGENS_ERRO.servico);
    valido = false;
  } else {
    limparErro('servico');
  }

  return valido;
}

function iniciarEnvio() {
  btnSubmit.disabled = true;
  btnSubmit.classList.add('carregando');
  limparStatus();
}

function finalizarEnvio() {
  btnSubmit.disabled = false;
  btnSubmit.classList.remove('carregando');
}

function exibirSucesso() {
  formStatus.textContent = 'Solicitação enviada com sucesso! Entraremos em contato em até 24 horas.';
  formStatus.className = 'form-feedback sucesso';
  formulario.reset();
  document.querySelectorAll('.form-input, .lp-select-trigger').forEach(function(input) {
    input.classList.remove('input-valido', 'input-erro');
  });
  sincronizarSelectServico();
}

function exibirErroEnvio(mensagem) {
  formStatus.textContent = mensagem || 'Erro ao enviar. Tente novamente em instantes.';
  formStatus.className = 'form-feedback erro-geral';
}

formulario.addEventListener('submit', async function(evento) {
  evento.preventDefault();

  if (!validarFormulario()) return;

  iniciarEnvio();

  const dados = {
    nome: document.getElementById('nome').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
    servico: document.getElementById('servico').value,
    mensagem: document.getElementById('mensagem').value.trim(),
  };

  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });

    if (resposta.ok) {
      exibirSucesso();
    } else {
      const corpo = await resposta.json().catch(function() { return {}; });
      exibirErroEnvio(corpo.message || null);
    }
  } catch (_erro) {
    exibirErroEnvio('Não foi possível conectar ao servidor. Verifique sua conexão.');
  } finally {
    finalizarEnvio();
  }
});

document.getElementById('telefone').addEventListener('input', function() {
  aplicarMascara(this);
});

document.querySelectorAll('.form-input').forEach(function(input) {
  input.addEventListener('blur', function() {
    const campo = this.id;
    if (!this.value.trim() && this.required) {
      exibirErro(campo, MENSAGENS_ERRO[campo] || 'Campo obrigatório.');
    }
  });
});

window.addEventListener('scroll', function() {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

navToggle.addEventListener('click', function() {
  const aberto = navMenu.classList.toggle('aberto');
  this.setAttribute('aria-expanded', String(aberto));
});

document.querySelectorAll('.nav-menu .nav-link, .nav-menu .nav-cta').forEach(function(link) {
  link.addEventListener('click', function() {
    navMenu.classList.remove('aberto');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- Carrossel contínuo de depoimentos (loop infinito 60fps) ---------- */

(function inicializarCarrosselDepoimentos() {
  const track = document.getElementById('depoimentos-track');
  const grupoOriginal = track?.querySelector('.depoimentos-grupo');
  if (!track || !grupoOriginal) return;
  const clone = grupoOriginal.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);
})();

/* ---------- Select customizado animado no formulário ---------- */

let sincronizarSelectServico = function () {};

(function inicializarSelectServico() {
  const select = document.getElementById('servico');
  if (!select) return;

  const wrap = document.createElement('div');
  wrap.className = 'lp-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lp-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML =
    '<span class="lp-select-label placeholder">Selecione um serviço</span>' +
    '<svg class="lp-select-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';
  wrap.appendChild(trigger);

  const labelEl = trigger.querySelector('.lp-select-label');
  const menu = document.createElement('div');
  menu.className = 'lp-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-hidden', 'true');
  document.body.appendChild(menu);

  const checkSvg =
    '<svg class="lp-select-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
  let aberto = false;
  let focoIdx = 0;

  function sincronizar() {
    const opt = select.options[select.selectedIndex];
    const vazio = !opt || !opt.value;
    labelEl.textContent = opt ? opt.textContent : 'Selecione um serviço';
    labelEl.classList.toggle('placeholder', vazio);
  }
  sincronizarSelectServico = sincronizar;

  function fechar(devolverFoco) {
    if (!aberto) return;
    aberto = false;
    trigger.setAttribute('aria-expanded', 'false');
    menu.classList.remove('aberto');
    menu.setAttribute('aria-hidden', 'true');
    if (devolverFoco) trigger.focus();
  }

  function posicionar() {
    const rect = trigger.getBoundingClientRect();
    const margem = 10;
    menu.style.width = `${Math.round(rect.width)}px`;
    menu.classList.remove('para-cima');
    const h = Math.min(menu.scrollHeight || 240, 280);
    const cabeAbaixo = window.innerHeight - rect.bottom - margem >= h;
    const top = cabeAbaixo ? rect.bottom + 6 : Math.max(margem, rect.top - h - 6);
    menu.classList.toggle('para-cima', !cabeAbaixo);
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(rect.left)}px`;
  }

  function abrir() {
    if (aberto) { fechar(true); return; }
    const opcoes = Array.from(select.options).filter(function (o) { return o.value !== ''; });
    menu.innerHTML = opcoes
      .map(function (o) {
        const sel = o.value === select.value;
        return (
          '<button type="button" class="lp-select-option" role="option" data-val="' +
          o.value +
          '" aria-selected="' +
          sel +
          '"><span>' +
          o.textContent +
          '</span>' +
          (sel ? checkSvg : '') +
          '</button>'
        );
      })
      .join('');
    aberto = true;
    trigger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    posicionar();
    void menu.offsetWidth;
    menu.classList.add('aberto');
    const botoes = Array.from(menu.querySelectorAll('.lp-select-option'));
    focoIdx = Math.max(0, botoes.findIndex(function (b) { return b.getAttribute('aria-selected') === 'true'; }));
    if (botoes[focoIdx]) botoes[focoIdx].classList.add('focado');
  }

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    abrir();
  });

  menu.addEventListener('click', function (e) {
    const btn = e.target.closest('.lp-select-option');
    if (!btn) return;
    select.value = btn.dataset.val;
    sincronizar();
    limparErro('servico');
    fechar(true);
  });

  trigger.addEventListener('keydown', function (e) {
    if (!aberto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
      return;
    }
    const botoes = Array.from(menu.querySelectorAll('.lp-select-option'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focoIdx = (focoIdx + (e.key === 'ArrowDown' ? 1 : -1) + botoes.length) % botoes.length;
      botoes.forEach(function (b, i) { b.classList.toggle('focado', i === focoIdx); });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      botoes[focoIdx]?.click();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      fechar(e.key === 'Escape');
    }
  });

  document.addEventListener('click', function (e) {
    if (aberto && !menu.contains(e.target) && !trigger.contains(e.target)) fechar(false);
  });
  window.addEventListener('scroll', function () { fechar(false); }, true);
  window.addEventListener('resize', function () { fechar(false); });

  const labelFor = document.querySelector('label[for="servico"]');
  labelFor?.addEventListener('click', function (e) {
    e.preventDefault();
    trigger.focus();
    abrir();
  });

  /* Pré-seleção automática ao clicar em "Agendar" nos cards de serviço */
  document.querySelectorAll('.servico-link[data-servico]').forEach(function (link) {
    link.addEventListener('click', function () {
      select.value = this.dataset.servico;
      sincronizar();
      limparErro('servico');
    });
  });

  sincronizar();
})();

/* ---------- Números e micro-gráficos animados ao rolar até estatísticas ---------- */

(function inicializarEstatisticasAnimadas() {
  const container = document.getElementById('convenios-numeros');
  if (!container) return;

  const reduzido =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzido || !('IntersectionObserver' in window)) return;

  const contadores = Array.from(container.querySelectorAll('[data-count-to]'));
  container.classList.add('aguardando');

  function formatarContador(el, valor, finalizado) {
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = Number(el.dataset.decimals || 0);
    const num =
      finalizado || decimals === 0
        ? String(Math.round(valor))
        : valor.toFixed(decimals).replace('.', ',');
    return `${prefix}${num}${suffix}`;
  }

  function animarContadores() {
    const duracao = 1100;
    const inicio = performance.now();

    function passo(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      const ease = 1 - Math.pow(1 - t, 3);
      contadores.forEach(function (el) {
        const alvo = Number(el.dataset.countTo || 0);
        el.textContent = formatarContador(el, alvo * ease, t >= 1);
      });
      if (t < 1) requestAnimationFrame(passo);
    }

    requestAnimationFrame(passo);
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        container.classList.remove('aguardando');
        container.classList.add('animado');
        animarContadores();
      });
    },
    { threshold: 0.25 }
  );

  observer.observe(container);
})();
