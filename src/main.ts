// Fluxo do jogo: menu → sala → prólogo em quadrinhos → mapa da jornada → fase → capítulo concluído → lembrança →
// mapa … → final. O anfitrião (ou o treino) decide; cada mudança de tela vai ao convidado pela rede ('cena', 'mapa',
// 'fase', 'pausa', 'progresso'). O convidado só mostra o que chega e manda pedidos ('pedido') e comandos ('in').
import './estilo.css';
import type { Estado } from './core/types';
import { criarSala, entrarSala, normalizarCodigo, type Conexao, type Mensagem, type NomeCena, type Pedido } from './net/rede';
import type { Qualidade } from './render/cena';
import { FINAL, PROLOGO, estrelinhasPossiveis, faseDoCap, info, lembranca, type Quadro } from './ui/historia';
import { ESTRELA_SVG } from './ui/ilustracoes';
import { Partida, type Modo } from './ui/partida';
import {
  carregarProgresso, concluido, estrelinhasTotais, liberado, limparProgresso, pedacos, proximoCapitulo, registrar,
  salvarProgresso, TOTAL_CAPITULOS, type Progresso,
} from './ui/progresso';
import { som } from './ui/som';
import { $, Hud, Mapa, mostrarCaiu, mostrarConcluido, mostrarPausa, mostrarTela, Quadrinhos } from './ui/telas';

const VERSAO = '0.2.0';
const params = new URLSearchParams(location.search);
const qualidadePadrao = (): Qualidade => {
  const q = params.get('q');
  if (q === 'baixa' || q === 'media' || q === 'alta') return q;
  // primeira escolha pelo aparelho: telas densas e 8+ núcleos → alta
  const nucleos = navigator.hardwareConcurrency || 4;
  return nucleos >= 8 && devicePixelRatio >= 2.5 ? 'alta' : 'media';
};

type Tela =
  | { t: 'menu' }
  | { t: 'cena'; cena: Exclude<NomeCena, 'concluido'>; quadro: number; cap: number }
  | { t: 'concluido'; cap: number; est: number; total: number }
  | { t: 'mapa'; sel: number }
  | { t: 'fase'; cap: number };

let modo: Modo = 'treino';
let con: Conexao | null = null;
let progresso: Progresso = carregarProgresso();
let atual: Tela = { t: 'menu' };
let partida: Partida | null = null;
let pausado = false;
let sessaoIniciada = false;
const hud = new Hud();
const mapa = new Mapa();
const quadrinhos = new Quadrinhos(() => acao('avancar'), () => acao('pular'));
const controla = () => modo !== 'convidado';
const capValido = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(TOTAL_CAPITULOS, Math.round(n))) : 1);

// gancho de teste e depuração (só leitura)
(window as unknown as { __edmFluxo: unknown }).__edmFluxo = { tela: () => atual, progresso: () => progresso, pausado: () => pausado, modo: () => modo };

// ---------- telas ----------
function quadrosDa(t: Extract<Tela, { t: 'cena' }>): readonly Quadro[] {
  return t.cena === 'prologo' ? PROLOGO : t.cena === 'final' ? FINAL : lembranca(t.cap);
}

/** Mostra a tela `t` neste aparelho. */
function aplicar(t: Tela) {
  atual = t;
  if (t.t !== 'fase' && partida) { partida.destruir(); partida = null; }
  if (t.t !== 'fase') { pausado = false; mostrarPausa(false); }
  switch (t.t) {
    case 'menu': mostrarTela('menu'); break;
    case 'cena': {
      const qs = quadrosDa(t);
      quadrinhos.mostrar(qs, t.quadro, t.cena === 'prologo' ? 'Toque para começar a jornada' : t.cena === 'final' ? 'Toque para voltar ao mapa' : 'Toque para voltar ao mapa');
      $('#bt-pular').hidden = false;
      if (t.cena === 'prologo') som.tocarMusica('menu');
      if (t.cena === 'final') som.tocarMusica('final');
      break;
    }
    case 'concluido': {
      const f = faseDoCap(t.cap) as { frase?: string };
      mostrarConcluido(t.cap, t.est, t.total, `“${f.frase ?? info(t.cap).frase}”`, controla());
      break;
    }
    case 'mapa':
      mapa.mostrar(progresso, t.sel, { livre: modo === 'treino', controla: controla() });
      $('#bt-historia').hidden = !controla();
      som.tocarMusica('menu');
      break;
    case 'fase':
      if (!partida || partida.cap !== t.cap) {
        partida?.destruir();
        partida = new Partida({
          modo, con, cap: t.cap, hud,
          qualidade: ($<HTMLSelectElement>('#qualidade').value as Qualidade) || qualidadePadrao(),
          aoConcluir: (e) => concluirCapitulo(t.cap, e),
        });
        pausado = false;
      } else mostrarTela('jogo');
      partida.pausar(pausado);
      mostrarPausa(pausado, quemPausou);
      break;
  }
}

function mensagemDa(t: Tela): Mensagem | null {
  switch (t.t) {
    case 'cena': return { t: 'cena', cena: t.cena, quadro: t.quadro, cap: t.cap };
    case 'concluido': return { t: 'cena', cena: 'concluido', quadro: 0, cap: t.cap, est: t.est, total: t.total };
    case 'mapa': return { t: 'mapa', p: progresso, sel: t.sel };
    case 'fase': return { t: 'fase', cap: t.cap };
    default: return null;
  }
}

/** Anfitrião/treino: vai para a tela e leva o convidado junto. */
function ir(t: Tela) {
  aplicar(t);
  const m = mensagemDa(t);
  if (m && modo === 'anfitriao') con?.enviar(m);
}

// ---------- ações (o convidado só pede; quem decide é o anfitrião) ----------
let quemPausou = '';
function acao(a: Pedido) {
  if (modo === 'convidado') { con?.enviar({ t: 'pedido', acao: a }); return; }
  executar(a, modo === 'treino' ? '' : 'Pausado por Natan (quem criou a sala).');
}

function executar(a: Pedido, quem: string) {
  const t = atual;
  switch (a) {
    case 'avancar':
      if (t.t === 'cena') { if (t.quadro + 1 < quadrosDa(t).length) ir({ ...t, quadro: t.quadro + 1 }); else fimDaCena(t); }
      else if (t.t === 'concluido') ir({ t: 'cena', cena: 'lembranca', quadro: 0, cap: t.cap });
      break;
    case 'pular':
      if (t.t === 'cena') fimDaCena(t);
      break;
    case 'pausa': if (t.t === 'fase') definirPausa(true, quem); break;
    case 'continuar': if (t.t === 'fase') definirPausa(false, ''); break;
    case 'mapa': if (t.t === 'fase') ir({ t: 'mapa', sel: t.cap }); break;
  }
}

function fimDaCena(t: Extract<Tela, { t: 'cena' }>) {
  if (t.cena === 'prologo') {
    if (!progresso.prologoVisto) { progresso = { ...progresso, prologoVisto: true }; guardar(); }
    ir({ t: 'mapa', sel: proximoCapitulo(progresso) });
  } else if (t.cena === 'lembranca') {
    if (t.cap === TOTAL_CAPITULOS) ir({ t: 'cena', cena: 'final', quadro: 0, cap: t.cap });
    else ir({ t: 'mapa', sel: modo === 'treino' || liberado(progresso, t.cap + 1) ? t.cap + 1 : t.cap });
  } else {
    if (!progresso.finalVisto) { progresso = { ...progresso, finalVisto: true }; guardar(); }
    ir({ t: 'mapa', sel: TOTAL_CAPITULOS });
  }
}

function definirPausa(on: boolean, quem: string) {
  pausado = on; quemPausou = quem;
  partida?.pausar(on);
  mostrarPausa(on, quem);
  if (modo === 'anfitriao') con?.enviar({ t: 'pausa', on });
}

function concluirCapitulo(cap: number, e: Estado) {
  const total = estrelinhasPossiveis(faseDoCap(cap));
  progresso = registrar(progresso, cap, { estrelinhas: e.estrelinhasCasal, total });
  guardar();
  ir({ t: 'concluido', cap, est: e.estrelinhasCasal, total });
}

/** Salva o progresso (só o anfitrião; o treino não salva) e manda a cópia ao convidado. */
function guardar() {
  if (modo === 'anfitriao') { salvarProgresso(progresso); con?.enviar({ t: 'progresso', p: progresso }); }
}

// ---------- rede ----------
function receber(m: Mensagem) {
  switch (m.t) {
    case 'in': case 'st': partida?.receber(m); break;
    case 'oi': if (m.versao !== VERSAO) console.warn(`Versões diferentes: ${m.versao} × ${VERSAO}`); break;
    case 'pedido':
      if (modo === 'anfitriao' && ['avancar', 'pular', 'pausa', 'continuar', 'mapa'].includes(m.acao)) executar(m.acao, 'Pausado por Bruna (quem entrou na sala).');
      break;
    default:
      if (modo !== 'convidado') break;
      if (m.t === 'progresso') progresso = limparProgresso(m.p);
      else if (m.t === 'mapa') { progresso = limparProgresso(m.p); aplicar({ t: 'mapa', sel: capValido(m.sel) }); }
      else if (m.t === 'fase') aplicar({ t: 'fase', cap: capValido(m.cap) });
      else if (m.t === 'pausa') { pausado = !!m.on; partida?.pausar(pausado); mostrarPausa(pausado && atual.t === 'fase', 'Pausado.'); }
      else if (m.t === 'cena') {
        const cap = capValido(m.cap), q = Math.max(0, Math.round(Number(m.quadro) || 0));
        if (m.cena === 'concluido') aplicar({ t: 'concluido', cap, est: Math.max(0, Number(m.est) || 0), total: Math.max(0, Number(m.total) || 0) });
        else if (m.cena === 'prologo' || m.cena === 'lembranca' || m.cena === 'final') aplicar({ t: 'cena', cena: m.cena, quadro: q, cap });
      }
  }
}

let tentando = false;
async function tentarDeNovo() {
  if (!con || tentando) return;
  tentando = true;
  mostrarCaiu(true, modo === 'anfitriao' ? 'Esperando a outra pessoa voltar para a sala…' : 'Procurando a sala de novo…', true);
  try { await con.reconectar(); }
  catch { mostrarCaiu(true, 'Não deu para reconectar ainda. Confira a internet dos dois aparelhos.', false); }
  finally { tentando = false; }
}

function ligarConexao(c: Conexao) {
  con = c;
  c.aoReceber = receber;
  c.aoMudarEstado = (st, det) => {
    if (st === 'caiu') {
      partida?.pausar(true);
      mostrarCaiu(true, det ? `Motivo: ${det}.` : '', false);
      if (modo === 'anfitriao') void tentarDeNovo(); // o anfitrião já fica esperando a volta
    } else if (st === 'conectado') {
      mostrarCaiu(false);
      if (modo === 'anfitriao') {
        if (!sessaoIniciada) { sessaoIniciada = true; c.enviar({ t: 'progresso', p: progresso }); iniciarSessao(); return; }
        // voltou: manda de novo o progresso, a tela atual e a pausa
        c.enviar({ t: 'progresso', p: progresso });
        const m = mensagemDa(atual);
        if (m) c.enviar(m);
        if (atual.t === 'fase') c.enviar({ t: 'pausa', on: pausado });
      }
      partida?.pausar(pausado);
    }
  };
}

function iniciarSessao() {
  if (modo !== 'treino' && !progresso.prologoVisto) ir({ t: 'cena', cena: 'prologo', quadro: 0, cap: 1 });
  else ir({ t: 'mapa', sel: proximoCapitulo(progresso) });
}

function sair() {
  con?.fechar();
  location.assign(location.pathname);
}

// ---------- botões ----------
async function telaCheia() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch { /* iOS e alguns navegadores não permitem; o aviso de girar cuida disso */ }
}

$('#logo-estrela').innerHTML = ESTRELA_SVG;
$<HTMLSelectElement>('#qualidade').value = qualidadePadrao();
{
  const n = pedacos(progresso);
  $('#menu-progresso').textContent = n || progresso.prologoVisto
    ? `★ ${estrelinhasTotais(progresso)} estrelinhas · ${n} de ${TOTAL_CAPITULOS} pedaços da estrela${concluido(progresso, TOTAL_CAPITULOS) ? ' · jornada completa!' : ''}`
    : '';
}
addEventListener('pointerdown', () => som.destravar(), { once: true });
addEventListener('keydown', () => som.destravar(), { once: true });

$('#bt-criar').onclick = async () => {
  som.destravar(); som.tocarMusica('menu');
  await telaCheia();
  mostrarTela('sala'); $('#sala-status').textContent = 'Criando a sala…';
  try {
    modo = 'anfitriao';
    const c = await criarSala(VERSAO);
    ligarConexao(c);
    $('#sala-codigo').textContent = c.codigo;
    $('#sala-status').textContent = 'Envie o código para a outra pessoa. Esperando…';
    const link = `${location.origin}${location.pathname}?sala=${c.codigo}`;
    $('#bt-compartilhar').onclick = async () => {
      if (navigator.share) await navigator.share({ title: 'Entre Dois Mundos', text: `Entra na minha sala: ${c.codigo}`, url: link }).catch(() => {});
      else { await navigator.clipboard?.writeText(link); $('#sala-status').textContent = 'Link copiado!'; }
    };
  } catch (e) { $('#sala-status').textContent = `Não foi possível criar a sala: ${(e as Error).message}`; }
};
$('#bt-entrar').onclick = async () => {
  const codigo = normalizarCodigo($<HTMLInputElement>('#codigo').value);
  if (codigo.length !== 5) { $('#menu-erro').textContent = 'O código tem 5 letras/números.'; return; }
  som.destravar(); som.tocarMusica('menu');
  await telaCheia();
  $('#menu-erro').textContent = 'Conectando…';
  try {
    modo = 'convidado';
    progresso = { ...progresso, capitulos: {} }; // até chegar o do anfitrião
    ligarConexao(await entrarSala(codigo, VERSAO));
    $('#menu-erro').textContent = 'Conectado! Esperando quem criou a sala…';
  } catch (e) { modo = 'treino'; $('#menu-erro').textContent = (e as Error).message; }
};
$('#bt-treino').onclick = async () => {
  som.destravar();
  await telaCheia();
  modo = 'treino';
  iniciarSessao();
};
$('#bt-voltar').onclick = () => sair();
$('#bt-mapa-sair').onclick = () => sair();
$('#bt-historia').onclick = () => { if (controla()) ir({ t: 'cena', cena: 'prologo', quadro: 0, cap: 1 }); };
mapa.aoSelecionar = (n) => { if (controla()) ir({ t: 'mapa', sel: n }); };
mapa.aoJogar = (n) => { if (controla() && (modo === 'treino' || liberado(progresso, n))) ir({ t: 'fase', cap: n }); };
$('#bt-conc-continuar').onclick = () => acao('avancar');
$('#bt-pausa').onclick = () => acao('pausa');
$('#bt-continuar').onclick = () => acao('continuar');
$('#bt-pausa-mapa').onclick = () => acao('mapa');
$('#bt-pausa-sair').onclick = () => sair();
const rotuloSom = () => { $('#bt-som').textContent = `Som: ${som.ligado ? 'ligado' : 'desligado'}`; };
rotuloSom();
$('#bt-som').onclick = () => { som.alternar(); rotuloSom(); };
$('#bt-tentar').onclick = () => void tentarDeNovo();
$('#bt-caiu-sair').onclick = () => sair();
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (atual.t === 'fase') acao(pausado ? 'continuar' : 'pausa');
  } else if ((e.code === 'Enter' || e.code === 'Space') && (atual.t === 'cena' || atual.t === 'concluido')) {
    e.preventDefault();
    acao('avancar');
  }
});
const salaUrl = params.get('sala');
if (salaUrl) $<HTMLInputElement>('#codigo').value = normalizarCodigo(salaUrl);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
