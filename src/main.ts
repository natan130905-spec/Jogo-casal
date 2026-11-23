import './estilo.css';
import { FLORESTA_1 } from './core/fases';
import { DT, estadoInicial, normalizarInput, passo } from './core/sim';
import { instantaneo, interpolar, restaurar } from './core/instantaneo';
import { INPUT_NEUTRO, type Estado, type Input } from './core/types';
import { Controles } from './input/controles';
import { criarSala, entrarSala, normalizarCodigo, type Conexao, type Mensagem } from './net/rede';
import { Cena, type Qualidade } from './render/cena';

const VERSAO = '0.1.0';
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const tela = (id: string) => {
  for (const el of document.querySelectorAll<HTMLElement>('.tela')) el.hidden = el.id !== id;
};
const params = new URLSearchParams(location.search);
const qualidadePadrao = (): Qualidade => {
  const q = params.get('q');
  if (q === 'baixa' || q === 'media' || q === 'alta') return q;
  // primeira escolha pelo aparelho: telas densas e 8+ núcleos → alta
  const nucleos = navigator.hardwareConcurrency || 4;
  return nucleos >= 8 && devicePixelRatio >= 2.5 ? 'alta' : 'media';
};

type Modo = 'treino' | 'anfitriao' | 'convidado';
let cena: Cena | null = null;
let rodando = false;

async function telaCheia() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch { /* iOS e alguns navegadores não permitem; o aviso de girar cuida disso */ }
}

function iniciarJogo(modo: Modo, con: Conexao | null) {
  tela('jogo');
  const canvas = $<HTMLCanvasElement>('#canvas');
  const fase = FLORESTA_1;
  cena = new Cena(canvas, fase, ($<HTMLSelectElement>('#qualidade').value as Qualidade) || qualidadePadrao());
  const ajustar = () => cena!.redimensionar(innerWidth, innerHeight);
  ajustar();
  addEventListener('resize', ajustar);
  const controles = new Controles($('#controles'));
  const estado: Estado = estadoInicial(fase);
  let entradaRemota: Input = INPUT_NEUTRO;
  let euControlo = modo === 'convidado' ? 1 : 0;
  $('#bt-trocar').hidden = modo !== 'treino';
  $('#bt-trocar').onclick = () => { euControlo = 1 - euControlo; };
  $('#hud-sala').textContent = con ? `Sala ${con.codigo}` : 'Treino';

  // convidado: instantâneos recebidos, para interpolar com 100 ms de atraso
  const buffer: { t: number; s: Estado }[] = [];
  let eventosPendentes: string[] = [];
  let ping = 0;
  if (con) {
    con.aoReceber = (m: Mensagem) => {
      if (m.t === 'in') entradaRemota = normalizarInput(m.i);
      else if (m.t === 'st') {
        const s = restaurar(fase, m.s);
        buffer.push({ t: performance.now(), s });
        eventosPendentes.push(...s.eventos);
        while (buffer.length > 8) buffer.shift();
      } else if (m.t === 'ping') con.enviar({ t: 'pong', at: m.at });
      else if (m.t === 'pong') ping = performance.now() - m.at;
    };
    con.aoMudarEstado = (st, det) => {
      if (st === 'caiu') { $('#aviso').textContent = `Conexão perdida${det ? `: ${det}` : ''}.`; $('#aviso').hidden = false; }
    };
    setInterval(() => con.enviar({ t: 'ping', at: performance.now() }), 2000);
  }

  let acumulado = 0, anterior = performance.now(), seqEnvio = 0, eventosParaEnviar: string[] = [];
  let fpsQuadros = 0, fpsT = anterior;
  rodando = true;
  let ultimo: Estado = estado;
  // gancho de teste e depuração (só leitura)
  (window as unknown as { __edm: unknown }).__edm = { estado: () => ultimo, modo, info: () => cena!.info() };
  const quadro = (agora: number) => {
    if (!rodando) return;
    const dt = Math.min(0.1, (agora - anterior) / 1000);
    anterior = agora;
    const local = controles.ler();
    let mostrar: Estado = estado;

    if (modo === 'convidado') {
      con!.enviar({ t: 'in', i: local, seq: seqEnvio++ });
      const alvo = agora - 100;
      let a = buffer[0], b = buffer[buffer.length - 1];
      for (let i = 0; i < buffer.length - 1; i++) if (buffer[i].t <= alvo && buffer[i + 1].t >= alvo) { a = buffer[i]; b = buffer[i + 1]; }
      if (a && b) {
        const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (alvo - a.t) / (b.t - a.t)));
        mostrar = interpolar(fase, a.s, b.s, k);
        mostrar.eventos = eventosPendentes; eventosPendentes = [];
      }
    } else {
      acumulado += dt;
      while (acumulado >= DT) {
        const ent: [Input, Input] = modo === 'treino'
          ? (euControlo === 0 ? [local, INPUT_NEUTRO] : [INPUT_NEUTRO, local])
          : [local, entradaRemota];
        passo(fase, estado, ent);
        eventosParaEnviar.push(...estado.eventos);
        acumulado -= DT;
        if (modo === 'anfitriao' && estado.tick % 3 === 0) {
          con!.enviar({ t: 'st', s: instantaneo(fase, estado, eventosParaEnviar) });
          eventosParaEnviar = [];
        }
      }
    }

    cena!.desenhar(mostrar, dt);
    ultimo = mostrar;
    fpsQuadros++;
    if (agora - fpsT > 1000) {
      const inf = cena!.info();
      $('#hud-info').textContent = `${Math.round((fpsQuadros * 1000) / (agora - fpsT))} fps${con ? ` · ${Math.round(ping)} ms` : ''}${params.has('debug') ? ` · ${inf.chamadas} ch · ${inf.triangulos} tri` : ''}`;
      fpsQuadros = 0; fpsT = agora;
    }
    if (mostrar.concluida) $('#concluida').hidden = false;
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

// ---------- menu ----------
$<HTMLSelectElement>('#qualidade').value = qualidadePadrao();
$('#bt-criar').onclick = async () => {
  await telaCheia();
  tela('sala'); $('#sala-status').textContent = 'Criando a sala…';
  try {
    const con = await criarSala(VERSAO);
    $('#sala-codigo').textContent = con.codigo;
    $('#sala-status').textContent = 'Envie o código para a outra pessoa. Esperando…';
    const link = `${location.origin}${location.pathname}?sala=${con.codigo}`;
    $('#bt-compartilhar').onclick = async () => {
      if (navigator.share) await navigator.share({ title: 'Entre Dois Mundos', text: `Entra na minha sala: ${con.codigo}`, url: link }).catch(() => {});
      else { await navigator.clipboard?.writeText(link); $('#sala-status').textContent = 'Link copiado!'; }
    };
    con.aoMudarEstado = (st, det) => {
      if (st === 'conectado') iniciarJogo('anfitriao', con);
      if (st === 'caiu') $('#sala-status').textContent = `Erro: ${det ?? ''}`;
    };
  } catch (e) { $('#sala-status').textContent = `Não foi possível criar a sala: ${(e as Error).message}`; }
};
$('#bt-entrar').onclick = async () => {
  const codigo = normalizarCodigo($<HTMLInputElement>('#codigo').value);
  if (codigo.length !== 5) { $('#menu-erro').textContent = 'O código tem 5 letras/números.'; return; }
  await telaCheia();
  $('#menu-erro').textContent = 'Conectando…';
  try { iniciarJogo('convidado', await entrarSala(codigo, VERSAO)); }
  catch (e) { $('#menu-erro').textContent = (e as Error).message; }
};
$('#bt-treino').onclick = async () => { await telaCheia(); iniciarJogo('treino', null); };
$('#bt-voltar').onclick = () => location.reload();
$('#bt-sair').onclick = () => location.assign(location.pathname);
const salaUrl = params.get('sala');
if (salaUrl) $<HTMLInputElement>('#codigo').value = normalizarCodigo(salaUrl);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
