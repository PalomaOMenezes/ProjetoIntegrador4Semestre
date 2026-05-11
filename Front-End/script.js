const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const formulario = document.getElementById('form-agendamento');
const btnSubmit = document.getElementById('btn-submit');
const formStatus = document.getElementById('form-status');

const API_URL = 'http://localhost:3000/solicitacoes';

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
  const erroEl = document.getElementById(`${campo}-erro`);
  input.classList.add('input-erro');
  input.classList.remove('input-valido');
  if (erroEl) erroEl.textContent = mensagem;
}

function limparErro(campo) {
  const input = document.getElementById(campo);
  const erroEl = document.getElementById(`${campo}-erro`);
  input.classList.remove('input-erro');
  input.classList.add('input-valido');
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
  document.querySelectorAll('.form-input').forEach(function(input) {
    input.classList.remove('input-valido', 'input-erro');
  });
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
