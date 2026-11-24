// Fluxo do jogo: menu → sala → prólogo em quadrinhos → mapa da jornada → fase → capítulo concluído → lembrança →
// mapa … No capítulo 7, ao tocar o pedaço da estrela: cena da fuga do Rei → Arena do Coração (3D) → vitória →
// capítulo concluído → lembrança → final → créditos. O capítulo 7 só conta como concluído depois da arena.
// O anfitrião (ou o treino) decide; cada mudança de tela vai ao convidado pela rede ('cena', 'mapa', 'fase', 'arena',
// 'pausa', 'salvo'). O convidado só mostra o que chega e manda pedidos ('pedido') e comandos ('in'/'ina').
// Modos (L2b): 'solo' (campanha sem sala; o outro personagem com o companheiro do jogo), 'anfitriao'/'convidado'
// (campanha a dois pela sala) e 'treino' (tudo liberado, o Quintal de Treino; nunca grava a campanha). A campanha é
// do casal (src/ui/salvo.ts): os dois aparelhos gravam a mesma, fundem ao conectar e retomam na última lanterna.
import './estilo.css';
import './ui/menu.css';
import type { Estado } from './core/types';
import { criarSala, entrarSala, normalizarCodigo, type Conexao, type Mensagem, type NomeCena, type Pedido } from './net/rede';
import type { Qualidade } from './render/cena';
import { FINAL, FUGA, PROLOGO, estrelinhasPossiveis, faseDoCap, info, lembranca, type Quadro } from './ui/historia';
import { ESTRELA_SVG } from './ui/ilustracoes';
import { Partida, type Modo } from './ui/partida';
import { PartidaArena } from './ui/partidaArena';
import {
  arenaPendente, campanhaAtiva, carregarSalvo, carregarTreino, comCampanha, comMarca, concluido, estrelinhasTotais, fundir,
  gravarSalvo, gravarTreino, liberado, limparCampanha, pedacos, pedirPersistencia, proximoCapitulo, registrarConclusao,
  registrarRetomada, resumir, temJornada, temProgresso, TOTAL_CAPITULOS, vista, type Campanha, type ResumoLanterna,
} from './ui/salvo';
import { TREINO_QUINTAL } from './core/fases/treino_quintal';
import { deveAvisarTelaDeInicio, infoDoNavegador } from './ui/plataforma';
import { som } from './ui/som';
import { $, Hud, Mapa, mostrarCaiu, mostrarConcluido, mostrarCreditos, mostrarPausa, mostrarTela, Quadrinhos, comConfirmacao, tocavel } from './ui/telas';

const VERSAO = '0.4.0';
const params = new URLSearchParams(location.search);
document.body.classList.toggle('depurar', params.has('debug'));
const qualidadePadrao = (): Qualidade => {
  const q = params.get('q');
  if (q === 'baixa' || q === 'media' || q === 'alta') return q;
  // a escolha salva no aparelho; senão 'media' (o orçamento do Redmi Note 11, que tem 8 núcleos e tela densa:
  // na 'alta' as sombras reais passam de 450 mil triângulos no capítulo 2)
  try { const s = localStorage.getItem('edm-qualidade'); if (s === 'baixa' || s === 'media' || s === 'alta') return s; } catch { /* sem armazenamento */ }
  return 'media';
};

type Tela =
  | { t: 'menu' }
  | { t: 'cena'; cena: Exclude<NomeCena, 'concluido' | 'creditos'>; quadro: number; cap: number }
  | { t: 'concluido'; cap: number; est: number; total: number }
  | { t: 'mapa'; sel: number }
  /** `retomada`: começa na lanterna guardada; `quintal`: o Quintal de Treino (cap 0, só no treino) */
  | { t: 'fase'; cap: number; retomada?: ResumoLanterna; quintal?: boolean }
  /** Arena do Coração: a luta 3D com o Rei-Pesadelo no fim do capítulo 7 */
  | { t: 'arena' }
  | { t: 'creditos' };

let modo: Modo = 'treino';
let con: Conexao | null = null;
let salvo = carregarSalvo().salvo;
/** a campanha em jogo (o slot ativo; no convidado, a do anfitrião assim que chega) */
let campanha: Campanha = campanhaAtiva(salvo);
/** a campanha muda e grava neste aparelho: solo e anfitrião (o convidado grava o que chega; o treino nada) */
/** convidado: a campanha deste aparelho antes de entrar na sala (é a que ele oferece ao anfitrião, mesmo que a do
 *  anfitrião chegue antes do aviso de conectado) */
let minhaCampanha: Campanha = campanha;
const gravaCampanha = () => modo === 'solo' || modo === 'anfitriao';
let atual: Tela = { t: 'menu' };
let partida: Partida | null = null;
let arena: PartidaArena | null = null;
/** a partida em andamento (2.5D ou arena) */
const jogo = () => partida ?? arena;
const emJogo = (t: Tela) => t.t === 'fase' || t.t === 'arena';
let pausado = false;
let sessaoIniciada = false;
const hud = new Hud();
const mapa = new Mapa();
const quadrinhos = new Quadrinhos(() => acao('avancar'), () => acao('pular'));
const controla = () => modo !== 'convidado';
const capValido = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(TOTAL_CAPITULOS, Math.round(n))) : 1);

// gancho de teste e depuração (só leitura)
(window as unknown as { __edmFluxo: unknown }).__edmFluxo = {
  tela: () => atual, progresso: () => vista(campanha), campanha: () => campanha, salvo: () => salvo, pausado: () => pausado, modo: () => modo,
};

// ---------- telas ----------
function quadrosDa(t: Extract<Tela, { t: 'cena' }>): readonly Quadro[] {
  return t.cena === 'prologo' ? PROLOGO : t.cena === 'final' ? FINAL : t.cena === 'fuga' ? FUGA : lembranca(t.cap);
}

/** Mostra a tela `t` neste aparelho. */
function aplicar(t: Tela) {
  atual = t;
  if (t.t !== 'fase' && partida) { partida.destruir(); partida = null; }
  if (t.t !== 'arena' && arena) { arena.destruir(); arena = null; }
  if (!emJogo(t)) { pausado = false; anfitriaoAusente = false; mostrarPausa(false); $('#aviso').hidden = true; }
  switch (t.t) {
    case 'menu': mostrarTela('menu'); break;
    case 'cena': {
      const qs = quadrosDa(t);
      quadrinhos.mostrar(qs, t.quadro, t.cena === 'prologo' ? 'Toque para começar a jornada' : t.cena === 'fuga' ? 'Toque para ir à Arena do Coração'
        : t.cena === 'final' ? 'Toque para os créditos' : t.cap === TOTAL_CAPITULOS ? 'Toque para o final' : 'Toque para voltar ao mapa');
      $('#bt-pular').hidden = false;
      if (t.cena === 'prologo') som.tocarMusica('menu');
      if (t.cena === 'fuga') som.tocarMusica('chefe');
      if (t.cena === 'final') som.tocarMusica('final');
      break;
    }
    case 'concluido': {
      const f = faseDoCap(t.cap) as { frase?: string };
      mostrarConcluido(t.cap, t.est, t.total, `“${f.frase ?? info(t.cap).frase}”`, controla());
      break;
    }
    case 'mapa':
      mapa.mostrar(vista(campanha), t.sel, { livre: modo === 'treino', controla: controla(), retomada: gravaCampanha() ? campanha.retomada : null, quintal: modo === 'treino' });
      $('#bt-historia').hidden = !controla();
      som.tocarMusica('menu');
      break;
    case 'fase':
      if (!partida || partida.cap !== t.cap) {
        partida?.destruir();
        if (t.quintal) { const pt = carregarTreino(); gravarTreino({ ...pt, visitas: pt.visitas + 1 }); }
        partida = new Partida({
          modo, con, cap: t.cap, hud,
          fase: t.quintal ? TREINO_QUINTAL : undefined,
          titulo: t.quintal ? 'Quintal de Treino' : undefined,
          retomada: t.retomada,
          qualidade: ($<HTMLSelectElement>('#qualidade').value as Qualidade) || qualidadePadrao(),
          aoConcluir: (e) => concluirCapitulo(t.cap, e),
          aoSumir: (on) => outroSumiu(on),
          aoLanterna: (e) => guardarRetomada(t.cap, e),
        });
        pausado = false;
      } else mostrarTela('jogo');
      partida.pausar(pausado);
      mostrarPausa(pausado, quemPausou);
      break;
    case 'arena':
      if (!arena) {
        arena = new PartidaArena({
          // a arena ainda não tem aliado do jogo: no solo ela roda como no treino (só o seu personagem em jogo)
          modo: modo === 'solo' ? 'treino' : modo, con,
          qualidade: ($<HTMLSelectElement>('#qualidade').value as Qualidade) || qualidadePadrao(),
          aoVencer: () => vencerArena(),
        });
        pausado = false;
      } else mostrarTela('jogo');
      arena.pausar(pausado);
      mostrarPausa(pausado, quemPausou);
      break;
    case 'creditos':
      mostrarCreditos(controla());
      som.tocarMusica('final');
      break;
  }
}

function mensagemDa(t: Tela): Mensagem | null {
  switch (t.t) {
    case 'cena': return { t: 'cena', cena: t.cena, quadro: t.quadro, cap: t.cap };
    case 'concluido': return { t: 'cena', cena: 'concluido', quadro: 0, cap: t.cap, est: t.est, total: t.total };
    case 'mapa': return { t: 'mapa', c: campanha, sel: t.sel };
    case 'fase': return { t: 'fase', cap: t.cap };
    case 'arena': return { t: 'arena' };
    case 'creditos': return { t: 'cena', cena: 'creditos', quadro: 0 };
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
  executar(a, modo === 'treino' || modo === 'solo' ? '' : 'Pausado por Natan (quem criou a sala).');
}

function executar(a: Pedido, quem: string) {
  const t = atual;
  switch (a) {
    case 'avancar':
      if (t.t === 'cena') { if (t.quadro + 1 < quadrosDa(t).length) ir({ ...t, quadro: t.quadro + 1 }); else fimDaCena(t); }
      else if (t.t === 'concluido') ir({ t: 'cena', cena: 'lembranca', quadro: 0, cap: t.cap });
      else if (t.t === 'creditos') ir({ t: 'mapa', sel: TOTAL_CAPITULOS });
      break;
    case 'pular':
      if (t.t === 'cena') fimDaCena(t);
      else if (t.t === 'creditos') ir({ t: 'mapa', sel: TOTAL_CAPITULOS });
      break;
    case 'pausa': if (emJogo(t)) definirPausa(true, quem); break;
    case 'continuar': if (emJogo(t)) definirPausa(false, ''); break;
    case 'mapa':
      if (t.t === 'fase') { gravarAoSair(); ir({ t: 'mapa', sel: t.cap || 1 }); }
      else if (t.t === 'arena') ir({ t: 'mapa', sel: TOTAL_CAPITULOS });
      break;
  }
}

function fimDaCena(t: Extract<Tela, { t: 'cena' }>) {
  if (t.cena === 'prologo') {
    if (gravaCampanha() && !campanha.prologoVisto) { campanha = comMarca(campanha, 'prologoVisto'); guardar(); }
    ir({ t: 'mapa', sel: proximoCapitulo(campanha) });
  } else if (t.cena === 'fuga') {
    ir({ t: 'arena' });
  } else if (t.cena === 'lembranca') {
    if (t.cap === TOTAL_CAPITULOS) ir({ t: 'cena', cena: 'final', quadro: 0, cap: t.cap });
    else ir({ t: 'mapa', sel: modo === 'treino' || liberado(campanha, t.cap + 1) ? t.cap + 1 : t.cap });
  } else {
    if (gravaCampanha() && !campanha.finalVisto) { campanha = comMarca(campanha, 'finalVisto'); guardar(); }
    ir({ t: 'creditos' });
  }
}

function definirPausa(on: boolean, quem: string) {
  pausado = on; quemPausou = quem;
  jogo()?.pausar(on);
  mostrarPausa(on, quem);
  if (modo === 'anfitriao') con?.enviar({ t: 'pausa', on });
}

function concluirCapitulo(cap: number, e: Estado) {
  const total = estrelinhasPossiveis(faseDoCap(cap));
  // o pedaço do capítulo 7 ainda não é deles: o Rei o arranca e foge para a arena. Guarda as estrelinhas da parte
  // 2.5D (o melhor resultado) e a fuga; o capítulo só conta com a vitória.
  const fuga = cap === TOTAL_CAPITULOS;
  if (gravaCampanha()) { campanha = registrarConclusao(campanha, cap, { estrelinhas: e.estrelinhasCasal, total, coletadas: e.coletadas, fuga }); guardar(); }
  if (fuga) { ir({ t: 'cena', cena: 'fuga', quadro: 0, cap }); return; }
  ir({ t: 'concluido', cap, est: e.estrelinhasCasal, total });
}

/** Vitória na Arena do Coração: agora sim o capítulo 7 está concluído (com as estrelinhas da parte 2.5D). */
function vencerArena() {
  const cap = TOTAL_CAPITULOS;
  const c7 = campanha.capitulos[cap];
  const r = { estrelinhas: c7?.melhorPassada ?? 0, total: c7?.total || estrelinhasPossiveis(faseDoCap(cap)) };
  if (gravaCampanha()) { campanha = registrarConclusao(campanha, cap, r); guardar(); }
  ir({ t: 'concluido', cap, est: r.estrelinhas, total: r.total });
}

/** Grava a campanha neste aparelho (solo e anfitrião; o treino nunca) e manda a cópia ao convidado, que também grava. */
function guardar() {
  if (!gravaCampanha()) return;
  salvo = comCampanha(salvo, campanha);
  gravarSalvo(salvo);
  if (modo === 'anfitriao') con?.enviar({ t: 'salvo', c: campanha });
}

/** Lanterna acesa (solo/anfitrião): guarda onde voltar e o que a passada já pegou (R24). */
function guardarRetomada(cap: number, e: Estado) {
  if (!gravaCampanha() || cap < 1) return;
  campanha = registrarRetomada(campanha, resumir(cap, e));
  guardar();
}

/** Saindo do app ou da fase no meio: a retomada fica com o que já se pegou depois da lanterna (iOS descarta a aba
 *  em segundo plano sem aviso; só pagehide/visibilitychange chegam a tempo). */
function gravarAoSair() {
  if (!gravaCampanha()) return;
  const e = atual.t === 'fase' && !atual.quintal ? partida?.estadoParaGravar() : null;
  if (e && atual.t === 'fase') campanha = registrarRetomada(campanha, resumir(atual.cap, e));
  guardar();
}

/** Chegou uma cópia da campanha pela sala ('salvo' ou 'mapa'). Mesma campanha: funde (nada some). Outra: o convidado
 *  passa a jogar a do anfitrião (a dele fica noutro slot); o anfitrião só adota a do convidado se a sua está vazia. */
function receberCampanha(x: unknown) {
  const c = limparCampanha(x);
  if (!c) return;
  const local = salvo.slots.find((s) => s.id === c.id);
  if (modo === 'convidado') {
    const nova = local ? fundir(local, c) : c;
    campanha = nova;
    salvo = comCampanha(salvo, nova);
    gravarSalvo(salvo);
    // a cópia deste aparelho tinha algo que o anfitrião não tinha: devolve a fusão (ele funde e repete a todos)
    if (JSON.stringify(nova) !== JSON.stringify(c)) con?.enviar({ t: 'salvo', c: nova });
  } else if (modo === 'anfitriao') {
    if (c.id === campanha.id) {
      const nova = fundir(campanha, c);
      if (JSON.stringify(nova) === JSON.stringify(campanha)) return;
      campanha = nova;
    } else if (!temJornada(campanha) && temJornada(c)) {
      // quem criou a sala ainda não tinha jornada: segue a do convidado (R23: tanto faz quem cria a sala)
      salvo = { ...salvo, slots: salvo.slots.filter((s) => s.id !== campanha.id) };
      campanha = c;
    } else return;
    guardar();
    if (atual.t === 'mapa') ir(atual);
  }
}

// ---------- segundo plano e o outro aparelho sumido (R26, R39) ----------
const nomeDoOutro = () => (modo === 'anfitriao' ? 'Bruna' : 'Natan');
/** convidado: o anfitrião sumiu ou saiu do app (pausa só neste aparelho, até ele voltar) */
let anfitriaoAusente = false;
function outroSumiu(on: boolean) {
  if (!emJogo(atual)) return;
  const quem = nomeDoOutro(), ele = quem === 'Bruna' ? 'ela' : 'ele';
  if (modo === 'anfitriao') {
    if (on) definirPausa(true, `${quem} saiu do jogo. Esperando ${ele} voltar…`);
    else if (pausado) { quemPausou = `${quem} voltou! Toquem em Continuar.`; mostrarPausa(true, quemPausou); }
  } else if (modo === 'convidado') {
    // o convidado não pausa sozinho (se ele parasse de mandar as entradas, o anfitrião acharia que foi ELE quem saiu):
    // com a pausa do anfitrião, troca o texto dela; sem ela (anfitrião travado), só um aviso por cima do jogo
    anfitriaoAusente = on;
    const texto = `${quem} saiu do jogo. Esperando ${ele} voltar…`;
    if (pausado) mostrarPausa(true, on ? texto : 'Pausado.');
    const av = $('#aviso');
    av.hidden = !on || pausado;
    if (on) av.textContent = texto;
  }
}

function aoEsconder() {
  som.suspender();
  gravarAoSair();
  if (!emJogo(atual)) { if (con && modo !== 'treino') con.enviar({ t: 'ausente', on: true }); return; }
  partida?.soltar();
  if (modo === 'treino' || modo === 'solo') { if (!pausado) definirPausa(true, ''); return; }
  if (modo === 'anfitriao' && !pausado) definirPausa(true, 'Pausado: você saiu do jogo.');
  // o outro solta a entrada deste aparelho e pausa com aviso (no anfitrião, a pausa acima já foi ao convidado)
  con?.enviar({ t: 'ausente', on: true });
}
function aoVoltar() {
  som.retomar();
  if (con && modo !== 'treino') con.enviar({ t: 'ausente', on: false });
}
document.addEventListener('visibilitychange', () => (document.hidden ? aoEsconder() : aoVoltar()));
addEventListener('pagehide', aoEsconder);
addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) aoVoltar(); });

// ---------- rede ----------
function receber(m: Mensagem) {
  switch (m.t) {
    case 'in': case 'st': partida?.receber(m); break;
    case 'ina': case 'sta': arena?.receber(m); break;
    case 'oi': if (m.versao !== VERSAO) console.warn(`Versões diferentes: ${m.versao} × ${VERSAO}`); break;
    case 'ausente': outroSumiu(!!m.on); break;
    case 'pedido':
      if (modo === 'anfitriao' && ['avancar', 'pular', 'pausa', 'continuar', 'mapa'].includes(m.acao)) executar(m.acao, 'Pausado por Bruna (quem entrou na sala).');
      break;
    case 'salvo': receberCampanha(m.c); break;
    default:
      if (modo !== 'convidado') break;
      if (m.t === 'mapa') { receberCampanha(m.c); aplicar({ t: 'mapa', sel: capValido(m.sel) }); }
      else if (m.t === 'fase') aplicar({ t: 'fase', cap: capValido(m.cap) });
      else if (m.t === 'arena') aplicar({ t: 'arena' });
      else if (m.t === 'pausa') {
        pausado = !!m.on; jogo()?.pausar(pausado);
        mostrarPausa(pausado && emJogo(atual), anfitriaoAusente ? 'Natan saiu do jogo. Esperando ele voltar…' : 'Pausado.');
        if (pausado) $('#aviso').hidden = true;
      }
      else if (m.t === 'cena') {
        const cap = capValido(m.cap), q = Math.max(0, Math.round(Number(m.quadro) || 0));
        if (m.cena === 'concluido') aplicar({ t: 'concluido', cap, est: Math.max(0, Number(m.est) || 0), total: Math.max(0, Number(m.total) || 0) });
        else if (m.cena === 'creditos') aplicar({ t: 'creditos' });
        else if (m.cena === 'prologo' || m.cena === 'lembranca' || m.cena === 'final' || m.cena === 'fuga') aplicar({ t: 'cena', cena: m.cena, quadro: q, cap });
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
      jogo()?.pausar(true);
      mostrarCaiu(true, det ? `Motivo: ${det}.` : '', false);
      if (modo === 'anfitriao') void tentarDeNovo(); // o anfitrião já fica esperando a volta
    } else if (st === 'conectado') {
      mostrarCaiu(false);
      // o convidado oferece a cópia dele da campanha (o anfitrião funde, ou adota se a dele está vazia)
      if (modo === 'convidado') c.enviar({ t: 'salvo', c: minhaCampanha });
      if (modo === 'anfitriao') {
        if (!sessaoIniciada) { sessaoIniciada = true; c.enviar({ t: 'salvo', c: campanha }); iniciarSessao(); return; }
        // voltou: manda de novo a campanha, a tela atual e a pausa
        c.enviar({ t: 'salvo', c: campanha });
        const m = mensagemDa(atual);
        if (m) c.enviar(m);
        if (emJogo(atual)) c.enviar({ t: 'pausa', on: pausado });
      }
      jogo()?.pausar(pausado);
    }
  };
}

function iniciarSessao() {
  if (modo !== 'treino' && !campanha.prologoVisto) ir({ t: 'cena', cena: 'prologo', quadro: 0, cap: 1 });
  else ir({ t: 'mapa', sel: arenaPendente(campanha) ? TOTAL_CAPITULOS : proximoCapitulo(campanha) });
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
$<HTMLSelectElement>('#qualidade').onchange = (e) => {
  try { localStorage.setItem('edm-qualidade', (e.target as HTMLSelectElement).value); } catch { /* sem armazenamento */ }
};
{
  const n = pedacos(campanha);
  $('#menu-progresso').textContent = n || campanha.prologoVisto
    ? `★ ${estrelinhasTotais(campanha)} estrelinhas · ${n} de ${TOTAL_CAPITULOS} pedaços da estrela${concluido(campanha, TOTAL_CAPITULOS) ? ' · jornada completa!' : ''}`
    : '';
  // "Continuar": a campanha sozinho de onde parou (a última lanterna, a Arena pendente ou o próximo capítulo)
  const r = campanha.retomada;
  $('#bt-continuar-jornada').hidden = !temProgresso(campanha);
  $('#continuar-onde').textContent = r ? `Cap. ${r.cap} · ${r.lanterna >= 0 ? `lanterna ${r.lanterna + 1}` : 'começo'} · ★ ${r.casal}`
    : arenaPendente(campanha) ? 'Arena do Coração' : `Cap. ${proximoCapitulo(campanha)} · ★ ${estrelinhasTotais(campanha)}`;
  $('#bt-solo').textContent = temProgresso(campanha) ? 'Jogar sozinho (mapa)' : 'Jogar sozinho';
}
pedirPersistencia();
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
    minhaCampanha = campanha;
    ligarConexao(await entrarSala(codigo, VERSAO));
    // o 'conectado' da primeira vez dispara dentro de entrarSala, antes de ligarConexao: a oferta vai daqui
    con?.enviar({ t: 'salvo', c: minhaCampanha });
    $('#menu-erro').textContent = 'Conectado! Esperando quem criou a sala…';
  } catch (e) { modo = 'treino'; $('#menu-erro').textContent = (e as Error).message; }
};
// campanha sozinho: começa sem sala (R22). "Continuar" vai direto à última lanterna.
$('#bt-solo').onclick = async () => {
  som.destravar();
  await telaCheia();
  modo = 'solo';
  iniciarSessao();
};
$('#bt-continuar-jornada').onclick = async () => {
  som.destravar();
  await telaCheia();
  modo = 'solo';
  const r = campanha.retomada;
  if (r && liberado(campanha, r.cap)) ir({ t: 'fase', cap: r.cap, retomada: r });
  else iniciarSessao();
};
$('#bt-treino').onclick = async () => {
  som.destravar();
  await telaCheia();
  modo = 'treino';
  iniciarSessao();
};
$('#bt-voltar').onclick = () => sair();
// saídas destrutivas: só com o segundo toque (R28). Sair da sala derruba a sala dos dois; o mapa abandona a fase.
const avisoSair = () => (modo === 'anfitriao' ? 'Toque de novo: sair (a Bruna também sai)' : modo === 'convidado' ? 'Toque de novo: sair da sala' : 'Toque de novo: sair');
comConfirmacao($('#bt-mapa-sair'), avisoSair, () => sair());
comConfirmacao($('#bt-pausa-mapa'), () => (gravaCampanha() ? 'Toque de novo: ir ao mapa (guarda a lanterna)' : 'Toque de novo: voltar ao mapa (a fase recomeça)'), () => acao('mapa'));
comConfirmacao($('#bt-pausa-sair'), avisoSair, () => sair());
$('#bt-historia').onclick = () => { if (controla()) ir({ t: 'cena', cena: 'prologo', quadro: 0, cap: 1 }); };
mapa.aoSelecionar = (n) => { if (controla()) ir({ t: 'mapa', sel: n }); };
mapa.aoJogar = (n) => { if (controla() && (modo === 'treino' || liberado(campanha, n))) ir({ t: 'fase', cap: n }); };
mapa.aoRetomar = (n) => { const r = campanha.retomada; if (gravaCampanha() && r && r.cap === n && liberado(campanha, n)) ir({ t: 'fase', cap: n, retomada: r }); };
mapa.aoQuintal = () => { if (modo === 'treino') ir({ t: 'fase', cap: 0, quintal: true }); };
mapa.aoArena = () => { if (controla() && (modo === 'treino' || arenaPendente(campanha) || concluido(campanha, TOTAL_CAPITULOS))) ir({ t: 'arena' }); };
$('#creditos').addEventListener('click', () => acao('avancar'));
$('#bt-conc-continuar').onclick = () => acao('avancar');
$('#bt-pausa').onclick = () => acao('pausa');
$('#bt-continuar').onclick = () => acao('continuar');
const rotuloSom = () => { $('#bt-som').textContent = `Som: ${som.ligado ? 'ligado' : 'desligado'}`; };
rotuloSom();
$('#bt-som').onclick = () => { som.alternar(); rotuloSom(); };
$('#bt-tentar').onclick = () => void tentarDeNovo();
$('#bt-caiu-sair').onclick = () => sair();
// botões que precisam responder com o polegar no joystick (outro dedo na tela não gera 'click'; R27). ❚❚ age já no
// toque; os outros ao levantar o dedo em cima deles. ⇄ recebe o onclick da Partida/PartidaArena de cada fase.
tocavel($('#bt-pausa'), { aoBaixar: true });
for (const id of ['#bt-trocar', '#bt-continuar', '#bt-pausa-mapa', '#bt-pausa-sair', '#bt-som', '#bt-tentar', '#bt-caiu-sair',
  '#bt-conc-continuar', '#bt-pular', '#bt-jogar', '#bt-arena', '#bt-mapa-sair', '#bt-historia', '#bt-retomar', '#bt-quintal']) tocavel($(id));
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (emJogo(atual)) acao(pausado ? 'continuar' : 'pausa');
  } else if ((e.code === 'Enter' || e.code === 'Space') && (atual.t === 'cena' || atual.t === 'concluido' || atual.t === 'creditos')) {
    e.preventDefault();
    acao('avancar');
  }
});
// iPhone no Safari: sem tela cheia (não há Fullscreen API); uma vez, ensina a abrir pelo ícone da Tela de Início (R31)
{
  const CHAVE_IOS = 'edm-aviso-ios';
  let jaViu = false;
  try { jaViu = localStorage.getItem(CHAVE_IOS) === '1'; } catch { /* sem armazenamento */ }
  if (deveAvisarTelaDeInicio(infoDoNavegador(), jaViu)) {
    // faixa no alto do menu (não bloqueia os botões); conta como vista já ao aparecer e some ao sair do menu
    $('#aviso-ios').hidden = false;
    try { localStorage.setItem(CHAVE_IOS, '1'); } catch { /* sem armazenamento */ }
    tocavel($('#bt-aviso-ios'));
    $('#bt-aviso-ios').onclick = () => { $('#aviso-ios').hidden = true; };
    for (const id of ['#bt-criar', '#bt-entrar', '#bt-treino', '#bt-solo', '#bt-continuar-jornada']) $(id).addEventListener('click', () => { $('#aviso-ios').hidden = true; });
  }
}
const salaUrl = params.get('sala');
if (salaUrl) $<HTMLInputElement>('#codigo').value = normalizarCodigo(salaUrl);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
