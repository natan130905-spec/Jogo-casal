// Alcance de cada coletável dos 7 capítulos, decidido por BUSCA SOBRE A SIMULAÇÃO REAL (src/core/sim.ts `passo`).
//
// Uso (de uma cópia do repositório): tools/revisao/auditoria-movimento/rodar.sh alcance [cap…] [--json saida.json]
//
// Como funciona
//   Estado da busca = o Estado inteiro do núcleo depois de um "gesto" que termina com o jogador 0 em pé. A chave
//   (para não repetir) é x a cada 0,25 m, y a cada 0,05 m, a plataforma especial em que está, as posições das
//   especiais a até 10 m (0,5 m) e a abertura das portas (0,25). De cada estado tentam-se ~22 gestos de entrada
//   (andar, esperar, pular segurando muito/pouco com 7 perfis de joystick, pular correndo, pular e agarrar a argola e
//   soltar depois de 1/3, 2/3 ou 1 s) e cada gesto roda `passo` tick a tick até pousar, cair no fundo ou 4 s.
//   Tudo o que o corpo toca no caminho conta (estrelinha pela mesma regra de COLETA do núcleo; lanterna pela regra
//   de checkpoint; placa em pé; pedaço da estrela pela caixa do corpo).
//
// Variantes (do mais exigente ao mais permissivo)
//   C  "sozinho desde o início": parte do início, parceiro parado no início, sem fio, sem impulso. Mostra até onde
//      um jogador sozinho chega (base para a campanha solo).
//   A  "sozinho de uma lanterna": parte do início, de cada lanterna e dos chãos que só se alcançam pelo fio
//      (pontos de apoio legítimos: a dupla renasce ali) e usa só gestos de um jogador, com portas e placas reais.
//   B  "em dupla": mesmos pontos de A, mais o superpulo de mãos dadas em qualquer lugar (impulso 0,6 s antes do
//      pulo, como se o parceiro estivesse ao lado ou em cima) e portas abertas (parceiro na placa).
//   F  "com o fio": o que só o grafo aproximado (ligações 'fio') alcança; o Fio Vermelho não entra na busca real.
//   Sem nenhuma: INALCANÇÁVEL.
//   Os bichinhos são retirados (supõe-se que foram derrotados); o pisão não é usado como degrau.
//
// "folga": em quantos pares (estado, gesto) diferentes a estrelinha é pega na variante em que primeiro aparece.
// Folga baixa (≤ 3) = precisa de um salto muito preciso; o jogador provavelmente não acha.
import { writeFileSync } from 'node:fs';
import { CAPITULOS } from '../../../src/core/fases';
import { sobrepoe } from '../../../src/core/colisao';
import { COLETA, DT, estadoInicial, FISICA, passo } from '../../../src/core/sim';
import { INPUT_NEUTRO, type Estado, type Fase, type Input, type Ponto, type Retangulo } from '../../../src/core/types';
import { alcancaveis, montarGrafo, pares, nosQueTocam, noSob, type Grafo } from '../../../test/fases/alcance';

const N = INPUT_NEUTRO;
const MEIA = FISICA.largura / 2, ALT = FISICA.altura;

type Variante = 'C' | 'A' | 'B';
interface Gesto { nome: string; impulso?: boolean; argola?: boolean; f: (t: number, e: Estado) => Input; min: number }

const I = (x: number, jump = false, act = false, y = 0): Input => ({ x, y, jump, act, shoot: false });

function gestos(dupla: boolean, temArgola: boolean): Gesto[] {
  const g: Gesto[] = [];
  for (const d of [1, -1]) {
    g.push({ nome: `anda${d}`, min: 8, f: (t) => I(d) });
    g.push({ nome: `anda-solta${d}`, min: 8, f: (t) => I(t < 8 ? d : 0) });
  }
  g.push({ nome: 'espera', min: 30, f: () => N });
  const perfis: [string, (t: number, d: number) => number][] = [
    ['reto', (t, d) => d],
    ['atrasa', (t, d) => (t < 12 ? 0 : d)],
    ['para', (t, d) => (t < 12 ? d : 0)],
    ['volta', (t, d) => (t < 20 ? d : -d)],
    ['meio', (t, d) => d * 0.5],
  ];
  const holds = [99, 6];
  for (const imp of dupla ? [false, true] : [false]) {
    for (const h of holds) {
      g.push({ nome: `pula-vert-h${h}${imp ? '-imp' : ''}`, impulso: imp, min: 2, f: (t) => I(0, t < h) });
      for (const [nome, p] of perfis) for (const d of [1, -1]) {
        if (h !== 99 && nome !== 'reto' && nome !== 'para') continue; // pulo curto só com perfis simples
        g.push({ nome: `pula-${nome}${d}-h${h}${imp ? '-imp' : ''}`, impulso: imp, min: 2, f: (t) => I(p(t, d), t < h) });
      }
    }
    for (const d of [1, -1]) g.push({ nome: `corre-pula${d}${imp ? '-imp' : ''}`, impulso: imp, min: 8, f: (t) => I(d, t >= 6) });
  }
  if (temArgola) {
    // pula segurando a mão; se agarrar a argola, balança para `d2` e solta (aperta o pulo de novo) depois de `k` ticks
    for (const d of [1, -1, 0]) for (const d2 of [1, -1]) for (const k of [20, 40, 60]) {
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

function clonar(e: Estado): Estado { return structuredClone(e); }

function chave(f: Fase, e: Estado): string {
  const j = e.jogadores[0];
  let s = `${Math.round(j.x * 4)}:${Math.round(j.y * 20)}:${j.plataforma}`;
  const defs = f.especiais ?? [];
  for (let k = 0; k < defs.length; k++) {
    const sp = e.especiais[k];
    if (Math.abs(sp.x - j.x) > 10) continue;
    s += `|${k}:${Math.round(sp.x * 2)}:${Math.round(sp.y * 2)}:${sp.s}`;
  }
  for (const p of f.portas) s += `|${Math.round((e.portas[p.id] ?? 0) * 4)}`;
  return s;
}

interface Achado { variante: Variante | 'F'; folga: number; gesto: string; de: Ponto; mecanica: string }
interface Resultado {
  cap: number; id: string; sementesDoFio: number; estados: Record<string, number>; gestosSimulados: number; segundos: number;
  estrelas: (Achado | null)[]; lanternas: (Variante | 'F' | null)[]; placas: Record<string, Variante | 'F' | null>; portal: Variante | null;
  soloMaxX: number; soloEstrelas: number;
}

/** Fase sem bichinhos e sem fio; na variante B, também sem portas (o parceiro segura a placa). */
function faseDaVariante(f: Fase, v: Variante): Fase {
  return { ...f, inimigos: [], fio: [], portas: v === 'B' ? [] : f.portas, placas: v === 'B' ? [] : f.placas };
}

function buscar(fBase: Fase, v: Variante, sementes: Ponto[], limite = 60000) {
  const f = faseDaVariante(fBase, v);
  const estrelas = f.estrelinhas ?? [];
  const lanternas = f.lanternas ?? [];
  const contagem = estrelas.map(() => 0);
  const exemplo: ({ gesto: string; de: Ponto; mecanica: string } | null)[] = estrelas.map(() => null);
  const lantern = lanternas.map(() => false);
  const placas: Record<string, boolean> = {};
  let portal = false;
  let maxX = 0;
  const vistos = new Set<string>();
  const fila: Estado[] = [];
  const G = gestos(v === 'B', (f.argolas ?? []).length > 0);
  let simulados = 0;

  const base = estadoInicial(f);
  for (const p of sementes) {
    const e = clonar(base);
    const j = e.jogadores[0];
    j.x = p.x; j.y = p.y + 0.02; j.seguroX = p.x; j.seguroY = p.y;
    // parceiro parado no início (longe), sem bolha
    for (let t = 0; t < 12; t++) passo(f, e, [N, N]);
    if (!e.jogadores[0].noChao) continue;
    const k = chave(f, e);
    if (!vistos.has(k)) { vistos.add(k); fila.push(e); }
  }

  const caixa = (x: number, y: number): Retangulo => ({ x: x - MEIA, y, w: FISICA.largura, h: ALT });
  let marca = 0;
  const ultima = estrelas.map(() => -1);
  const toca = (x: number, y: number, gesto: string, de: Ponto, mec: string) => {
    const cx = x, cy = y + ALT / 2;
    for (let k = 0; k < estrelas.length; k++) {
      const p = estrelas[k];
      if (Math.abs(p.x - cx) <= MEIA + COLETA.raio && Math.abs(p.y - cy) <= ALT / 2 + COLETA.raio) {
        if (ultima[k] !== marca) { ultima[k] = marca; contagem[k]++; }
        if (!exemplo[k]) exemplo[k] = { gesto, de, mecanica: mec };
      }
    }
    for (let k = 0; k < lanternas.length; k++) {
      const l = lanternas[k];
      if (x >= l.x - 0.6 && x <= l.x + 4 && Math.abs(y - l.y) < 2.5) lantern[k] = true;
    }
    if (!portal && sobrepoe(caixa(x, y), f.portal)) portal = true;
    if (x > maxX) maxX = x;
  };

  let cab = 0;
  while (cab < fila.length && vistos.size < limite) {
    const e0 = fila[cab++];
    const j0 = e0.jogadores[0];
    const de = { x: +j0.x.toFixed(2), y: +j0.y.toFixed(2) };
    marca++;
    toca(j0.x, j0.y, 'em pé', de, '');
    for (const p of fBase.placas) if (sobrepoe(caixa(j0.x, j0.y), { ...p, y: p.y - 0.05, h: p.h + 0.1 }) && Math.abs(j0.y - (p.y + p.h)) < 0.3) placas[p.id] = true;
    for (const gst of G) {
      if (gst.argola) {
        const perto = (f.argolas ?? []).some((a) => Math.abs(a.x - j0.x) < 6 && a.y - j0.y < 6 && a.y > j0.y);
        if (!perto) continue;
      }
      marca++;
      const e = clonar(e0);
      const j = e.jogadores[0];
      if (gst.impulso) j.impulso = 0.6;
      j.pulouSegurado = false;
      simulados++;
      let mec = '';
      let ok = false;
      for (let t = 0; t < 240; t++) {
        passo(f, e, [gst.f(t, e), N]);
        if (e.eventos.some((x) => x.startsWith('caiu:0'))) break;
        if (e.eventos.some((x) => x.startsWith('quique:0'))) mec ||= 'gelatina';
        if (e.eventos.some((x) => x.startsWith('argola:0'))) mec ||= 'argola';
        if (j.plataforma >= 0) { const d = (f.especiais ?? [])[j.plataforma]; if (d && !mec) mec = d.tipo; }
        toca(j.x, j.y, gst.nome, de, mec);
        if (t + 1 >= gst.min && j.noChao) { ok = true; break; }
      }
      if (!ok) continue;
      const k = chave(f, e);
      if (vistos.has(k)) continue;
      vistos.add(k);
      // não precisa guardar faiscas/esporos/eventos
      e.eventos = [];
      fila.push(e);
    }
  }
  return { contagem, exemplo, lantern, placas, portal, estados: vistos.size, simulados, maxX, esgotou: vistos.size >= limite };
}

/** Pontos de partida legítimos: o início, cada lanterna (onde a dupla renasce) e os chãos que o grafo de
 *  test/fases/alcance.ts só alcança passando pelo Fio Vermelho (o fio não entra na busca real). */
function sementes(f: Fase): { g: Grafo; pts: Ponto[]; doFio: number } {
  const g = montarGrafo(f);
  const ini: [number, number] = [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])];
  const r = pares(g, ini, nosQueTocam(g, f.portal));
  const semFio = alcancaveis(g, [ini[0], ini[1]], ['solo', 'super', 'porta']);
  const pts: Ponto[] = [{ ...f.inicio[0] }, ...(f.lanternas ?? []).map((l) => ({ x: l.x, y: l.y }))];
  let doFio = 0;
  for (const id of r.nosAlcancados) {
    const n = g.nos[id];
    if (n.tipo !== 'fixo' || semFio.has(id)) continue;
    doFio++;
    pts.push({ x: (n.x0 + n.x1) / 2, y: n.y }, { x: n.x0 + 0.05, y: n.y }, { x: n.x1 - 0.05, y: n.y });
  }
  return { g, pts, doFio };
}

/** Estrelinhas que o grafo aproximado alcança usando ligações de fio (nós alcançados pela dupla). */
function estrelasDoGrafo(g: Grafo, f: Fase): Set<number> {
  const ini: [number, number] = [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])];
  const r = pares(g, ini, nosQueTocam(g, f.portal));
  const s = new Set<number>();
  for (const id of r.nosAlcancados) { for (const k of g.estrelas[id]) s.add(k); for (const k of g.estrelasSuper[id]) s.add(k); }
  return s;
}

export function analisarCapitulo(f: Fase & { capitulo?: number }): Resultado {
  const t0 = Date.now();
  const { g, pts, doFio } = sementes(f);
  const C = buscar(f, 'C', [f.inicio[0]]);
  const A = buscar(f, 'A', pts);
  const B = buscar(f, 'B', pts);
  const grafo = estrelasDoGrafo(g, f);
  const estrelas = (f.estrelinhas ?? []).map((_, k): Achado | null => {
    for (const [v, R] of [['C', C], ['A', A], ['B', B]] as const) {
      if (R.contagem[k] > 0) { const ex = R.exemplo[k]!; return { variante: v, folga: R.contagem[k], gesto: ex.gesto, de: ex.de, mecanica: ex.mecanica }; }
    }
    if (grafo.has(k)) return { variante: 'F', folga: 0, gesto: 'grafo (fio/aprox.)', de: { x: NaN, y: NaN }, mecanica: 'fio' };
    return null;
  });
  const lanternas = (f.lanternas ?? []).map((_, k) => (C.lantern[k] ? 'C' : A.lantern[k] ? 'A' : B.lantern[k] ? 'B' : null) as Variante | null);
  const placas: Record<string, Variante | null> = {};
  for (const p of f.placas) placas[p.id] = C.placas[p.id] ? 'C' : A.placas[p.id] ? 'A' : null;
  return {
    cap: f.capitulo ?? 0, id: f.id, sementesDoFio: doFio,
    estados: { C: C.estados, A: A.estados, B: B.estados, ...(C.esgotou || A.esgotou || B.esgotou ? { LIMITE: 1 } : {}) },
    gestosSimulados: C.simulados + A.simulados + B.simulados, segundos: (Date.now() - t0) / 1000,
    estrelas, lanternas, placas, portal: C.portal ? 'C' : A.portal ? 'A' : B.portal ? 'B' : null,
    soloMaxX: +C.maxX.toFixed(1), soloEstrelas: C.contagem.filter((c) => c > 0).length,
  };
}

if (process.argv[2] === 'alcance') {
  const args = process.argv.slice(3);
  const iJson = args.indexOf('--json');
  const saida = iJson >= 0 ? args[iJson + 1] : null;
  const caps = args.filter((a, i) => /^\d$/.test(a) && (iJson < 0 || i !== iJson + 1)).map(Number);
  const todos: Resultado[] = [];
  for (const f of CAPITULOS) {
    if (caps.length && !caps.includes(f.capitulo)) continue;
    const r = analisarCapitulo(f);
    todos.push(r);
    const est = f.estrelinhas ?? [];
    const cont = { C: 0, A: 0, B: 0, F: 0, X: 0 };
    for (const a of r.estrelas) cont[a ? a.variante : 'X']++;
    console.log(`\n== cap ${r.cap} ${r.id}: ${est.length} estrelinhas · sozinho desde o início ${cont.C} · sozinho de uma lanterna ${cont.A} · só em dupla ${cont.B} · só com fio ${cont.F} · INALCANÇÁVEIS ${cont.X}`);
    console.log(`   estados C/A/B ${r.estados.C}/${r.estados.A}/${r.estados.B}${r.estados.LIMITE ? ' (LIMITE)' : ''} · ${r.gestosSimulados} gestos · ${r.segundos.toFixed(1)} s · sozinho chega até x=${r.soloMaxX} · pedaço: ${r.portal ?? 'NÃO'}`);
    console.log(`   lanternas: ${r.lanternas.map((v, k) => `${(f.lanternas ?? [])[k].x}:${v ?? 'X'}`).join(' ')} · placas: ${Object.entries(r.placas).map(([k, v]) => `${k}:${v ?? 'X'}`).join(' ')}`);
    r.estrelas.forEach((a, k) => {
      const p = est[k];
      if (!a) console.log(`   X  #${k} (${p.x}, ${p.y}) INALCANÇÁVEL`);
      else if (a.variante !== 'C' && a.variante !== 'A') console.log(`   ${a.variante}  #${k} (${p.x}, ${p.y}) ${a.gesto} de (${a.de.x}, ${a.de.y}) folga ${a.folga} ${a.mecanica}`);
      else if (a.folga <= 3) console.log(`   ${a.variante}! #${k} (${p.x}, ${p.y}) folga ${a.folga} (${a.gesto} de ${a.de.x},${a.de.y}) ${a.mecanica}`);
    });
  }
  if (saida) writeFileSync(saida, JSON.stringify(todos, null, 1));
}
