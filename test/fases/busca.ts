// Alcance de cada coletável decidido por BUSCA SOBRE A SIMULAÇÃO REAL (`passo` de src/core/sim.ts), versão rápida
// para o CI. Vem de tools/revisao/auditoria-movimento/alcance_estrelinhas.ts (a busca completa, ~30 min), com menos
// gestos e chave mais grossa. Ver docs/revisao/AUDITORIA_MOVIMENTO.md §2 e §7.
//
// Estado da busca = o Estado inteiro do núcleo depois de um "gesto" que termina com o jogador 0 em pé. A chave (para
// não repetir) discretiza x (padrão 0,5 m) e y (0,1 m), a plataforma especial em que está, as especiais a até 8 m
// (posição a cada 1 m) e as portas. De cada estado tentam-se os gestos (andar, esperar, pular segurando ou só
// tocando com alguns perfis de joystick, pular correndo, agarrar a argola e soltar) e cada gesto roda `passo` tick a
// tick até pousar, cair no fundo ou 4 s. Vale tudo o que o corpo toca no caminho (regra de COLETA do núcleo).
//
// Variantes:
//   A  sozinho: parte do início, de cada lanterna e dos chãos que só se alcançam pelo fio (o fio não entra na busca
//      real; o grafo de ./alcance.ts diz quais são). Portas e placas reais.
//   B  em dupla: os mesmos pontos, mais o superpulo de mãos dadas em qualquer lugar e portas abertas (o parceiro
//      segura a placa).
// Os bichinhos são retirados (supõe-se que foram derrotados).
//
// "folga" de uma estrelinha = em quantos pares (estado, gesto) diferentes ela é pega. Folga baixa = só um salto
// muito preciso pega; o jogador provavelmente não acha. O teste exige uma folga mínima.
import { sobrepoe } from '../../src/core/colisao';
import { COLETA, DT, estadoInicial, FISICA, passo } from '../../src/core/sim';
import { INPUT_NEUTRO, type Estado, type Fase, type Input, type Ponto, type Retangulo } from '../../src/core/types';
import { alcancaveis, montarGrafo, noSob, nosQueTocam, pares } from './alcance';

const N = INPUT_NEUTRO;
const MEIA = FISICA.largura / 2, ALT = FISICA.altura;
const I = (x: number, jump = false, act = false): Input => ({ x, y: 0, jump, act, shoot: false });

export type Variante = 'A' | 'B';
interface Gesto { nome: string; impulso?: boolean; argola?: boolean; f: (t: number, e: Estado) => Input; min: number }

function gestos(dupla: boolean, temArgola: boolean): Gesto[] {
  const g: Gesto[] = [];
  for (const d of [1, -1]) g.push({ nome: `anda${d}`, min: 8, f: () => I(d) });
  g.push({ nome: 'espera', min: 30, f: () => N });
  for (const imp of dupla ? [false, true] : [false]) {
    const s = imp ? '-imp' : '';
    g.push({ nome: `pula-vert${s}`, impulso: imp, min: 2, f: (t) => I(0, t < 99) });
    for (const d of [1, -1]) {
      g.push({ nome: `pula${d}${s}`, impulso: imp, min: 2, f: (t) => I(d, t < 99) });
      g.push({ nome: `corre-pula${d}${s}`, impulso: imp, min: 8, f: (t) => I(d, t >= 6) });
      if (imp) continue;
      g.push({ nome: `pula-para${d}`, min: 2, f: (t) => I(t < 12 ? d : 0, true) });
      g.push({ nome: `pula-atrasa${d}`, min: 2, f: (t) => I(t < 12 ? 0 : d, true) });
      g.push({ nome: `toque${d}`, min: 2, f: (t) => I(d, t < 1) });
    }
  }
  if (temArgola) {
    // pula segurando a mão; se agarrar a argola, balança para `d2` e solta (aperta o pulo de novo) depois de `k` ticks
    for (const d of [1, -1, 0]) for (const d2 of [1, -1]) for (const k of [20, 45]) {
      let agarrou = -1;
      g.push({
        nome: `argola${d}>${d2}@${k}`, argola: true, min: 2,
        f: (t, e) => {
          if (t === 0) agarrou = -1;
          const j = e.jogadores[0];
          if (agarrou < 0 && j.argola >= 0) agarrou = t;
          if (agarrou < 0) return I(d, t < 30, true);
          const dt = t - agarrou;
          return I(d2, dt >= k && dt < k + 30, false);
        },
      });
    }
  }
  return g;
}

/** Gestos da busca completa (tools/revisao/auditoria-movimento/alcance_estrelinhas.ts, AUDITORIA_MOVIMENTO §2.1):
 *  ~22 por estado (45 em dupla), com 5 perfis de joystick, pulo segurando 99 ou 6 ticks, andar soltando e 3 tempos
 *  de soltar a argola. */
function gestosCompletos(dupla: boolean, temArgola: boolean): Gesto[] {
  const g: Gesto[] = [];
  for (const d of [1, -1]) {
    g.push({ nome: `anda${d}`, min: 8, f: () => I(d) });
    g.push({ nome: `anda-solta${d}`, min: 8, f: (t) => I(t < 8 ? d : 0) });
  }
  g.push({ nome: 'espera', min: 30, f: () => N });
  const perfis: [string, (t: number, d: number) => number][] = [
    ['reto', (_t, d) => d], ['atrasa', (t, d) => (t < 12 ? 0 : d)], ['para', (t, d) => (t < 12 ? d : 0)],
    ['volta', (t, d) => (t < 20 ? d : -d)], ['meio', (_t, d) => d * 0.5],
  ];
  for (const imp of dupla ? [false, true] : [false]) {
    const s = imp ? '-imp' : '';
    for (const h of [99, 6]) {
      g.push({ nome: `pula-vert-h${h}${s}`, impulso: imp, min: 2, f: (t) => I(0, t < h) });
      for (const [nome, p] of perfis) for (const d of [1, -1]) {
        if (h !== 99 && nome !== 'reto' && nome !== 'para') continue;
        g.push({ nome: `pula-${nome}${d}-h${h}${s}`, impulso: imp, min: 2, f: (t) => I(p(t, d), t < h) });
      }
    }
    for (const d of [1, -1]) g.push({ nome: `corre-pula${d}${s}`, impulso: imp, min: 8, f: (t) => I(d, t >= 6) });
  }
  if (temArgola) {
    for (const d of [1, -1, 0]) for (const d2 of [1, -1]) for (const k of [20, 40, 60]) {
      let agarrou = -1;
      g.push({
        nome: `argola${d}>${d2}@${k}`, argola: true, min: 2,
        f: (t, e) => {
          if (t === 0) agarrou = -1;
          if (agarrou < 0 && e.jogadores[0].argola >= 0) agarrou = t;
          if (agarrou < 0) return I(d, t < 30, true);
          const dt = t - agarrou;
          return I(d2, dt >= k && dt < k + 30, false);
        },
      });
    }
  }
  return g;
}

export interface OpcoesBusca {
  limite?: number; passoX?: number;
  /** busca completa (npm run test:lento): gestos da auditoria, x a cada 0,25 m, y a cada 0,05 m, especiais a cada
   *  0,5 m e portas a cada 0,25; os ponteiros do mesmo relógio por 1/16 de volta. Padrão: a versão rápida do CI. */
  completa?: boolean;
}

function chave(f: Fase, e: Estado, passoX: number, completa = false): string {
  if (completa) return chaveCompleta(f, e);
  const j = e.jogadores[0];
  const defs = f.especiais ?? [];
  const sobre = j.plataforma >= 0 ? defs[j.plataforma] : undefined;
  // em pé numa plataforma que anda com o tempo: vale a posição em cima dela (a dela vem da fase, abaixo)
  let s = sobre && sobre.tipo !== 'quicante' && sobre.tipo !== 'cai'
    ? `p${j.plataforma}:${Math.round((j.x - e.especiais[j.plataforma].x) / passoX)}`
    : `${Math.round(j.x / passoX)}:${Math.round(j.y * 10)}:${j.plataforma}`;
  const relogios = new Set<string>();
  for (let k = 0; k < defs.length; k++) {
    const sp = e.especiais[k], d = defs[k];
    if (Math.abs(sp.x - j.x) > 8) continue;
    if (d.tipo === 'giratoria') {
      // ponteiros do mesmo relógio giram juntos: basta a fase da volta (8 partes) uma vez por relógio
      const id = `${d.cx}:${d.cy}:${d.periodo}`;
      if (relogios.has(id)) continue;
      relogios.add(id);
      s += `|g${id}:${Math.floor(((e.tick * DT) / d.periodo % 1) * 8)}`;
    } else if (d.tipo === 'cai') s += `|${k}:${sp.ativa ? (sp.s === 0 ? 0 : 1) : 2}`; // parada, tremendo/caindo, sumida
    else if (d.tipo !== 'quicante') s += `|${k}:${Math.round(sp.x)}:${Math.round(sp.y)}`;
  }
  for (const p of f.portas) s += `|${Math.round((e.portas[p.id] ?? 0) * 2)}`;
  return s;
}

function chaveCompleta(f: Fase, e: Estado): string {
  const j = e.jogadores[0];
  const defs = f.especiais ?? [];
  const sobre = j.plataforma >= 0 ? defs[j.plataforma] : undefined;
  // em pé numa plataforma que anda com o tempo: vale a posição em cima dela (a dela entra abaixo)
  let s = sobre && sobre.tipo !== 'quicante' && sobre.tipo !== 'cai'
    ? `p${j.plataforma}:${Math.round((j.x - e.especiais[j.plataforma].x) * 4)}`
    : `${Math.round(j.x * 4)}:${Math.round(j.y * 20)}:${j.plataforma}`;
  const relogios = new Set<string>();
  for (let k = 0; k < defs.length; k++) {
    const sp = e.especiais[k], d = defs[k];
    if (Math.abs(sp.x - j.x) > 10) continue;
    if (d.tipo === 'giratoria') {
      const id = `${d.cx}:${d.cy}:${d.periodo}`;
      if (relogios.has(id)) continue;
      relogios.add(id);
      s += `|g${id}:${Math.floor(((e.tick * DT) / d.periodo % 1) * 16)}`;
    } else s += `|${k}:${Math.round(sp.x * 2)}:${Math.round(sp.y * 2)}:${sp.s}`;
  }
  for (const p of f.portas) s += `|${Math.round((e.portas[p.id] ?? 0) * 4)}`;
  return s;
}

/** Fase sem bichinhos e sem fio; na variante B, também sem portas (o parceiro segura a placa). */
function faseDaVariante(f: Fase, v: Variante): Fase {
  return { ...f, inimigos: [], fio: [], portas: v === 'B' ? [] : f.portas, placas: v === 'B' ? [] : f.placas };
}

export interface ResultadoBusca {
  /** por estrelinha: em quantos pares (estado, gesto) é pega */
  folga: number[];
  lanternas: boolean[];
  placas: Record<string, boolean>;
  portal: boolean;
  estados: number;
  /** maior x do centro do corpo em pé (até onde a busca chegou) */
  maxX: number;
  /** estados por trecho de 10 m (diagnóstico: onde a busca gasta) */
  porTrecho: number[];
  gestos: number;
  esgotou: boolean;
}

export function buscar(fBase: Fase, v: Variante, sementes: Ponto[], o: OpcoesBusca = {}): ResultadoBusca {
  const limite = o.limite ?? 6000, passoX = o.passoX ?? 0.5;
  const f = faseDaVariante(fBase, v);
  const estrelas = f.estrelinhas ?? [];
  const lanternas = f.lanternas ?? [];
  const folga = estrelas.map(() => 0);
  const lantern = lanternas.map(() => false);
  const placas: Record<string, boolean> = Object.fromEntries(fBase.placas.map((p) => [p.id, false]));
  let portal = false;
  const vistos = new Set<string>();
  const fila: Estado[] = [];
  const G = (o.completa ? gestosCompletos : gestos)(v === 'B', (f.argolas ?? []).length > 0);
  let simulados = 0;
  let maxX = 0;
  const porTrecho: number[] = Array.from({ length: Math.ceil(f.largura / 10) }, () => 0);

  const base = estadoInicial(f);
  // o parceiro fica parado longe (no início), fora do caminho
  for (const p of sementes) {
    const e = structuredClone(base);
    const j = e.jogadores[0];
    j.x = p.x; j.y = p.y + 0.02; j.seguroX = p.x; j.seguroY = p.y;
    for (let t = 0; t < 12; t++) passo(f, e, [N, N]);
    if (!e.jogadores[0].noChao) continue;
    const k = chave(f, e, passoX, o.completa);
    if (!vistos.has(k)) { vistos.add(k); fila.push(e); }
  }

  const caixa = (x: number, y: number): Retangulo => ({ x: x - MEIA, y, w: FISICA.largura, h: ALT });
  let marca = 0;
  const ultima = estrelas.map(() => -1);
  // estrelinhas por metro de x (para não varrer todas a cada tick)
  const perto: number[][] = Array.from({ length: Math.ceil(f.largura) + 2 }, () => []);
  estrelas.forEach((p, k) => {
    for (let m = Math.floor(p.x - MEIA - COLETA.raio); m <= Math.floor(p.x + MEIA + COLETA.raio); m++) perto[Math.max(0, Math.min(perto.length - 1, m))].push(k);
  });
  const toca = (x: number, y: number) => {
    const cy = y + ALT / 2;
    for (const k of perto[Math.max(0, Math.min(perto.length - 1, Math.floor(x)))]) {
      const p = estrelas[k];
      if (Math.abs(p.x - x) <= MEIA + COLETA.raio && Math.abs(p.y - cy) <= ALT / 2 + COLETA.raio && ultima[k] !== marca) { ultima[k] = marca; folga[k]++; }
    }
    for (let k = 0; k < lanternas.length; k++) {
      const l = lanternas[k];
      if (!lantern[k] && x >= l.x - 0.6 && x <= l.x + 4 && Math.abs(y - l.y) < 2.5) lantern[k] = true;
    }
    if (!portal && sobrepoe(caixa(x, y), f.portal)) portal = true;
  };

  let cab = 0;
  while (cab < fila.length && vistos.size < limite) {
    const e0 = fila[cab++];
    const j0 = e0.jogadores[0];
    marca++;
    toca(j0.x, j0.y);
    for (const p of fBase.placas) if (sobrepoe(caixa(j0.x, j0.y), { ...p, y: p.y - 0.05, h: p.h + 0.1 }) && Math.abs(j0.y - (p.y + p.h)) < 0.3) placas[p.id] = true;
    for (const gst of G) {
      if (gst.argola && !(f.argolas ?? []).some((a) => Math.abs(a.x - j0.x) < 6 && a.y - j0.y < 6 && a.y > j0.y)) continue;
      marca++;
      const e = structuredClone(e0);
      const j = e.jogadores[0];
      if (gst.impulso) j.impulso = 0.6;
      j.pulouSegurado = false;
      simulados++;
      let ok = false;
      for (let t = 0; t < 240; t++) {
        passo(f, e, [gst.f(t, e), N]);
        if (e.eventos.includes('caiu:0')) break;
        toca(j.x, j.y);
        if (t + 1 >= gst.min && j.noChao) { ok = true; break; }
      }
      if (!ok) continue;
      const k = chave(f, e, passoX, o.completa);
      if (vistos.has(k)) continue;
      vistos.add(k);
      e.eventos = [];
      fila.push(e);
      if (j.x > maxX) maxX = j.x;
      const tr = Math.floor(j.x / 10);
      porTrecho[tr] = (porTrecho[tr] ?? 0) + 1;
    }
  }
  return { folga, lanternas: lantern, placas, portal, estados: vistos.size, maxX, porTrecho, gestos: simulados, esgotou: vistos.size >= limite };
}

/** Pontos de partida legítimos: o início, cada lanterna (onde a dupla renasce) e os chãos que o grafo de
 *  ./alcance.ts só alcança passando pelo Fio Vermelho (o fio não entra na busca real). */
export function sementes(f: Fase): Ponto[] {
  const g = montarGrafo(f);
  const ini: [number, number] = [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])];
  const r = pares(g, ini, nosQueTocam(g, f.portal));
  const semFio = alcancaveis(g, [ini[0], ini[1]], ['solo', 'super', 'porta']);
  const pts: Ponto[] = [{ ...f.inicio[0] }, ...(f.lanternas ?? []).map((l) => ({ x: l.x, y: l.y }))];
  for (const id of r.nosAlcancados) {
    const n = g.nos[id];
    if (n.tipo !== 'fixo' || semFio.has(id)) continue;
    pts.push({ x: (n.x0 + n.x1) / 2, y: n.y }, { x: n.x0 + 0.05, y: n.y }, { x: n.x1 - 0.05, y: n.y });
  }
  return pts;
}

export interface AlcanceCapitulo { A: ResultadoBusca; B: ResultadoBusca; segundos: number }

/** As duas variantes de um capítulo. */
export function alcanceDoCapitulo(f: Fase, o: OpcoesBusca = {}): AlcanceCapitulo {
  const t0 = Date.now();
  const pts = sementes(f);
  const A = buscar(f, 'A', pts, o);
  const B = buscar(f, 'B', pts, o);
  return { A, B, segundos: (Date.now() - t0) / 1000 };
}

/** Estrelinhas que só saem em dupla (B pega, A não). */
export const soEmDupla = (r: AlcanceCapitulo) => r.B.folga.map((v, k) => (v > 0 && r.A.folga[k] === 0 ? k : -1)).filter((k) => k >= 0);
