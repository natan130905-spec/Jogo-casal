// Vitrine da Arena do Coração (só no servidor de desenvolvimento: /test/vitrine/arena.html). Roda a luta com dois
// bots (ou com o teclado no lugar de quem está em `?local=`), sem rede, para conferir o desenho 3D.
// Teclado: WASD anda (relativo à câmera), J golpe, K tiro, Espaço pulo, Shift esquiva, Q poder, Tab troca quem
// você controla, B liga/desliga os bots. Gancho `window.__arena` para as capturas automáticas (capturar_arena.mjs).
// ?q=baixa|media|alta · ?local=0|1 · ?bots=0 (os dois parados) · ?treino
import {
  ENTRADA_NEUTRA, PODER, estadoInicialArena, passoArena, vidaFimFase, type EntradaArena, type EstadoArena,
} from '../../src/core/arena';
import { CenaArena } from '../../src/render/arena';
import type { Qualidade } from '../../src/render/cena';
import { BotArena } from '../arena_bot';

const ps = new URLSearchParams(location.search);
const cena = new CenaArena(document.querySelector<HTMLCanvasElement>('#c')!, (ps.get('q') ?? 'media') as Qualidade);
const ajustar = () => cena.redimensionar(innerWidth, innerHeight);
ajustar(); addEventListener('resize', ajustar);
let estado: EstadoArena = estadoInicialArena({ treino: ps.has('treino') });
let local: 0 | 1 = (Number(ps.get('local') ?? 0) === 1 ? 1 : 0);
let bots = ps.get('bots') !== '0';
let teclado = false;
const perfil = { acerto: 0.6, desvio: 0.7 };
let robos = [new BotArena(0, { ...perfil, semente: 3 }), new BotArena(1, { ...perfil, semente: 7 })];

const teclas = new Set<string>();
addEventListener('keydown', (ev) => {
  teclas.add(ev.code); teclado = true;
  if (ev.code === 'Tab') { ev.preventDefault(); local = (1 - local) as 0 | 1; }
  if (ev.code === 'KeyB') bots = !bots;
});
addEventListener('keyup', (ev) => teclas.delete(ev.code));
const doTeclado = (): EntradaArena => ({
  x: (teclas.has('KeyD') ? 1 : 0) - (teclas.has('KeyA') ? 1 : 0),
  y: (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0),
  yaw: cena.yaw,
  pulo: teclas.has('Space'), golpe: teclas.has('KeyJ'), tiro: teclas.has('KeyK'), esquiva: teclas.has('ShiftLeft') || teclas.has('ShiftRight'), poder: teclas.has('KeyQ'),
});

/** entradas forçadas (somadas às dos bots): [Natan, Bruna] */
const forcar: [Partial<EntradaArena> | null, Partial<EntradaArena> | null] = [null, null];
let pausado = false;

function entradas(): [EntradaArena, EntradaArena] {
  const r: [EntradaArena, EntradaArena] = [ENTRADA_NEUTRA, ENTRADA_NEUTRA];
  for (const i of [0, 1] as const) {
    let ent = bots ? robos[i].entrada(estado) : ENTRADA_NEUTRA;
    if (teclado && i === local) ent = doTeclado();
    if (forcar[i]) ent = { ...ent, ...forcar[i] };
    r[i] = ent;
  }
  return r;
}

/** Um passo da simulação, juntando os eventos (como o convidado recebe vários de uma vez). */
function passo(acum: string[]) {
  passoArena(estado, entradas());
  acum.push(...estado.eventos);
}

const api = {
  get estado() { return estado; },
  /** recomeça (treino opcional) */
  reiniciar(treino = false) { estado = estadoInicialArena({ treino }); robos = [new BotArena(0, { ...perfil, semente: 3 }), new BotArena(1, { ...perfil, semente: 7 })]; },
  /** avança n ticks sem desenhar (rápido) */
  pular(n: number) { const ev: string[] = []; for (let k = 0; k < n; k++) passo(ev); estado.eventos = []; },
  /** avança até `cond(estado)` (código JS, ex.: "e.rei.fase === 2") ou até `max` ticks; devolve se achou */
  ate(cond: string, max = 60 * 120) {
    const f = new Function('e', `return (${cond});`) as (e: EstadoArena) => boolean;
    const ev: string[] = [];
    for (let k = 0; k < max; k++) { if (f(estado)) { estado.eventos = []; return true; } passo(ev); }
    estado.eventos = [];
    return false;
  },
  /** avança n ticks desenhando cada um (efeitos e animações corretos) */
  quadros(n: number, cada = 1) {
    for (let k = 0; k < n; k++) {
      const ev: string[] = [];
      for (let q = 0; q < cada; q++) passo(ev);
      estado.eventos = ev;
      cena.desenhar(estado, cada / 60, local);
    }
  },
  /** desenha de novo sem avançar a simulação */
  desenhar(dt = 1 / 60) { estado.eventos = []; cena.desenhar(estado, dt, local); },
  /** leva o Rei para o fim da fase atual (o próximo acerto troca de fase) */
  fimDaFase() { estado.rei.vida = vidaFimFase(estado.rei.fase) + 0.5; },
  encherPoder(i: number) { estado.jogadores[i].poder = PODER.max; },
  forcar(i: 0 | 1, ent: Partial<EntradaArena> | null) { forcar[i] = ent; },
  bots(b: boolean) { bots = b; },
  local(i: 0 | 1) { local = i; },
  pausar(p: boolean) { pausado = p; },
  camera(pos: { x: number; y: number; z: number } | null, alvo?: { x: number; y: number; z: number }) { cena.fixarCamera(pos, alvo); },
  /** põe um jogador em (x, z) olhando para `ang` */
  por(i: 0 | 1, x: number, z: number, ang = Math.PI) { Object.assign(estado.jogadores[i], { x, z, y: 0, vx: 0, vy: 0, vz: 0, ang, noChao: true }); },
  info: () => cena.info(),
  get yaw() { return cena.yaw; },
  carregado: false,
};
(window as unknown as { __arena: typeof api }).__arena = api;
(window as unknown as { __cena: CenaArena }).__cena = cena;
cena.carregar().then(() => { api.carregado = true; });

let anterior = performance.now(), acum = 0, fpsN = 0, fpsT = anterior;
const quadro = (agora: number) => {
  const dt = Math.min(0.1, (agora - anterior) / 1000); anterior = agora;
  if (!pausado) {
    acum += dt;
    const ev: string[] = [];
    while (acum >= 1 / 60) { passo(ev); acum -= 1 / 60; }
    estado.eventos = ev;
    cena.desenhar(estado, dt, local);
  }
  fpsN++;
  if (agora - fpsT > 1000) {
    const i = cena.info(), r = estado.rei;
    document.querySelector('#info')!.textContent = `${fpsN} fps · ${i.chamadas} ch · ${i.triangulos} tri · fase ${r.fase} · vida ${Math.round(r.vida)} · ${bots ? 'bots' : 'parados'} · local ${local === 0 ? 'Natan' : 'Bruna'}`;
    fpsN = 0; fpsT = agora;
  }
  requestAnimationFrame(quadro);
};
requestAnimationFrame(quadro);
