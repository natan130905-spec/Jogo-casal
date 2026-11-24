// Verificação de alcançabilidade por saltos (sem bots): monta um grafo de "lugares onde se pode ficar em pé"
// (topos das plataformas fixas, plataformas especiais em várias posições do tempo, argolas) e liga A → B quando
// um salto de verdade (mesma física de src/core/sim.ts, com colisão) sai de A e pousa em B. As portas entram
// fechadas; atravessá-las vira uma ligação que depende de alguém estar na placa.
//
// Tipos de ligação:
//   solo   pulo normal, cair da beira, andar numa plataforma especial, argola
//   super  superpulo de mãos dadas: vale se o parceiro está no mesmo lugar (impulso) ou lá em cima, até 3,5 m
//          acima (puxa pela mão)
//   fio    dentro de um trecho do Fio Vermelho: vale se o parceiro está na ponta de lá (segura e o outro sobe pela
//          corda) ou na de cá (segura e o outro balança e solta)
//   porta  atravessar a porta: vale se o parceiro está numa placa dela (porta dupla: um em cada placa)
//
// Depois, `pares` faz a busca no espaço dos DOIS jogadores (onde está Natan, onde está Bruna) para provar que de
// todo par alcançável ainda se chega ao fim: ninguém fica preso sem saída, nem com a ajuda do outro.
import { moverEixo, sobrepoe, type Corpo } from '../../src/core/colisao';
import { especialNoTempo } from '../../src/core/plataformas';
import { FISICA } from '../../src/core/sim';
import type { DefEspecial, Fase, Ponto, Retangulo } from '../../src/core/types';

const DT = 1 / 60;
const MEIA = FISICA.largura / 2;
const ALT = FISICA.altura;
/** distância máxima (m) entre a placa e a porta para alguém sozinho abrir e passar */
export const PLACA_COLADA = 1.5;

export interface No {
  id: number; chave: string;
  tipo: 'fixo' | 'esp' | 'quica' | 'argola';
  /** intervalo das posições do centro do corpo e altura dos pés */
  x0: number; x1: number; y: number;
  k?: number;
}
export type TipoLigacao = 'solo' | 'super' | 'fio' | 'porta';
export interface Ligacao { para: number; tipo: TipoLigacao; porta?: string }
export interface Grafo {
  fase: Fase;
  nos: No[];
  lig: Ligacao[][];
  /** estrelinhas que se alcançam a partir de cada nó: andando/pulando sozinho e com superpulo */
  estrelas: Set<number>[];
  estrelasSuper: Set<number>[];
  /** placas que se pisam em cada nó */
  placas: Set<string>[];
  saltos: number;
}

/** Superfícies de pé das plataformas fixas (mais portas fechadas), já sem as partes tapadas. */
function superficies(sol: Retangulo[]): { x0: number; x1: number; y: number }[] {
  const res: { x0: number; x1: number; y: number }[] = [];
  for (const r of sol) {
    const y = r.y + r.h;
    let partes: [number, number][] = [[r.x - MEIA + 0.01, r.x + r.w + MEIA - 0.01]];
    for (const o of sol) {
      if (o === r) continue;
      if (!(o.y < y + ALT && o.y + o.h > y + 1e-3)) continue;
      const b0 = o.x - MEIA, b1 = o.x + o.w + MEIA;
      partes = partes.flatMap(([a, b]): [number, number][] => {
        if (b1 <= a || b0 >= b) return [[a, b]];
        const out: [number, number][] = [];
        if (b0 > a) out.push([a, b0]);
        if (b1 < b) out.push([b1, b]);
        return out;
      });
    }
    for (const [a, b] of partes) if (b - a > 0.05) res.push({ x0: a, x1: b, y });
  }
  res.sort((p, q) => p.y - q.y || p.x0 - q.x0);
  const juntas: typeof res = [];
  for (const s of res) {
    const u = juntas[juntas.length - 1];
    if (u && Math.abs(u.y - s.y) < 1e-3 && s.x0 <= u.x1 + 1e-3) u.x1 = Math.max(u.x1, s.x1);
    else juntas.push({ ...s });
  }
  return juntas;
}

function periodoEspecial(d: DefEspecial): number {
  switch (d.tipo) {
    case 'movel': {
      const pts = d.circular ? [...d.trajeto, d.trajeto[0]] : d.trajeto;
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      return (d.circular ? total : 2 * total) / d.vel;
    }
    case 'giratoria': return d.periodo;
    case 'bolha': return d.sobe / d.vel + (d.pausa ?? 1);
    default: return 0;
  }
}

export function montarGrafo(f: Fase, o: { passoAmostra?: number } = {}): Grafo {
  const sol: Retangulo[] = [...f.plataformas, ...f.portas.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }))];
  const nos: No[] = [];
  const add = (n: Omit<No, 'id'>) => { const id = nos.length; nos.push({ ...n, id }); return id; };
  for (const s of superficies(sol)) add({ chave: `f:${s.y.toFixed(2)}:${s.x0.toFixed(2)}`, tipo: 'fixo', ...s });

  const defs = f.especiais ?? [];
  const retNo = new Map<number, Retangulo>();
  const cadeias: number[][] = [];
  for (let k = 0; k < defs.length; k++) {
    const d = defs[k];
    if (d.tipo === 'quicante' || d.tipo === 'cai') {
      const id = add({ chave: `${d.tipo[0]}:${k}`, tipo: d.tipo === 'quicante' ? 'quica' : 'esp', x0: d.x - MEIA + 0.01, x1: d.x + d.w + MEIA - 0.01, y: d.y + d.h, k });
      retNo.set(id, { x: d.x, y: d.y, w: d.w, h: d.h }); cadeias.push([id]); continue;
    }
    const per = periodoEspecial(d);
    const passo = o.passoAmostra ?? 0.25;
    const ids: number[] = [];
    for (let s = 0, t = 0; t < per - 1e-6; s++, t += passo) {
      const p = especialNoTempo(d, t);
      if (!p || !p.ativa) continue;
      const id = add({ chave: `e:${k}:${s}`, tipo: 'esp', x0: p.x - MEIA + 0.01, x1: p.x + d.w + MEIA - 0.01, y: p.y + d.h, k });
      retNo.set(id, { x: p.x, y: p.y, w: d.w, h: d.h });
      ids.push(id);
    }
    cadeias.push(ids);
  }
  const argolas = f.argolas ?? [];
  const idArgola = argolas.map((g, k) => add({ chave: `a:${k}`, tipo: 'argola', x0: g.x, x1: g.x, y: g.y, k }));

  const lig: Ligacao[][] = nos.map(() => []);
  const chaves = nos.map(() => new Set<string>());
  const liga = (a: number, b: number, tipo: TipoLigacao, porta?: string) => {
    if (a === b || a < 0 || b < 0) return;
    const ch = `${b}:${tipo}:${porta ?? ''}`;
    if (chaves[a].has(ch)) return;
    chaves[a].add(ch); lig[a].push({ para: b, tipo, porta });
  };
  const estrelas = nos.map(() => new Set<number>());
  const estrelasSuper = nos.map(() => new Set<number>());

  // andar nas especiais (bolha só sobe; móvel e giratória em ciclo)
  for (let k = 0; k < defs.length; k++) {
    const ids = cadeias[k];
    if (ids.length < 2) continue;
    for (let s = 0; s < ids.length; s++) {
      if (defs[k].tipo === 'bolha' && s === ids.length - 1) continue;
      liga(ids[s], ids[(s + 1) % ids.length], 'solo');
    }
  }

  const estrelasF = f.estrelinhas ?? [];
  const tocaEstrela = (x: number, y: number, alvo: Set<number>) => {
    const cy = y + ALT / 2;
    for (let k = 0; k < estrelasF.length; k++) {
      const p = estrelasF[k];
      if (Math.abs(p.x - x) <= MEIA + 0.55 && Math.abs(p.y - cy) <= ALT / 2 + 0.55) alvo.add(k);
    }
  };
  for (const n of nos) {
    if (n.tipo === 'argola' || n.tipo === 'quica') continue;
    for (let k = 0; k < estrelasF.length; k++) {
      const p = estrelasF[k];
      if (p.x >= n.x0 - 0.55 && p.x <= n.x1 + 0.55 && p.y <= n.y + ALT + 0.55 && p.y >= n.y - 0.55) estrelas[n.id].add(k);
    }
  }
  const placas = nos.map((n) => new Set(f.placas.filter((p) => n.tipo !== 'argola' && sobrepoe({ x: n.x0 - MEIA, y: n.y - 0.02, w: n.x1 - n.x0 + 2 * MEIA, h: ALT }, { ...p, y: p.y - 0.05, h: p.h + 0.1 })).map((p) => p.id)));

  const fixos = nos.filter((n) => n.tipo === 'fixo');
  const noFixoEm = (x: number, y: number) => fixos.find((n) => Math.abs(n.y - y) < 0.02 && x >= n.x0 - 0.02 && x <= n.x1 + 0.02)?.id ?? -1;

  let saltos = 0;
  const voo = (de: number, tipo: TipoLigacao, x: number, y: number, vx: number, vy: number, guia: (c: Corpo, t: number) => number, perto: Retangulo[], espPerto: [number, Retangulo][]) => {
    // começa dentro de parede (amostra de plataforma especial encostada no chão): não vale
    if (perto.some((r) => sobrepoe({ x: x - MEIA, y: y + 0.01, w: FISICA.largura, h: ALT - 0.02 }, r))) return;
    saltos++;
    const alvoEstrelas = tipo === 'super' ? estrelasSuper[de] : estrelas[de];
    const c: Corpo = { x, y, vx, vy, noChao: false };
    for (let t = 0; t < 200; t++) {
      const inx = Math.max(-1, Math.min(1, guia(c, t)));
      const acel = (t === 0 ? FISICA.acelChao : FISICA.acelAr) * DT;
      c.vx += Math.max(-acel, Math.min(acel, inx * FISICA.velAndar - c.vx));
      c.vy = Math.max(-FISICA.velQuedaMax, c.vy - FISICA.gravidade * DT);
      c.noChao = false;
      moverEixo(c, FISICA.largura, ALT, perto, c.vx * DT, 0);
      const yAntes = c.y;
      moverEixo(c, FISICA.largura, ALT, perto, 0, c.vy * DT, true);
      c.x = Math.max(0.3, Math.min(f.largura - 0.3, c.x));
      tocaEstrela(c.x, c.y, alvoEstrelas);
      for (let k = 0; k < argolas.length; k++) {
        const g = argolas[k];
        if (Math.hypot(g.x - c.x, g.y - (c.y + 1)) <= 1.05) liga(de, idArgola[k], tipo);
      }
      if (!c.noChao && c.vy <= 0) {
        for (const [id, r] of espPerto) {
          const topo = r.y + r.h;
          if (c.x + MEIA <= r.x || c.x - MEIA >= r.x + r.w) continue;
          if (yAntes >= topo - 0.06 && c.y <= topo + 1e-3) { liga(de, id, tipo); return; }
        }
      }
      if (c.noChao) { liga(de, noFixoEm(c.x, c.y), tipo); return; }
      if (c.y < f.fundo) return;
    }
  };

  for (const n of nos) {
    if (n.tipo === 'argola') continue;
    const xs: number[] = [];
    const larg = n.x1 - n.x0;
    if (n.tipo === 'quica') { for (let i = 0; i <= 2; i++) xs.push(n.x0 + 0.3 + ((larg - 0.6) * i) / 2); }
    else {
      xs.push(n.x0 + 0.02, n.x1 - 0.02);
      for (let x = n.x0 + 1; x < n.x1 - 0.5; x += 2) xs.push(x);
    }
    const perto = sol.filter((r) => r.x < n.x1 + 12 && r.x + r.w > n.x0 - 12);
    const espPerto: [number, Retangulo][] = [...retNo].filter(([id, r]) => id !== n.id && r.x < n.x1 + 12 && r.x + r.w > n.x0 - 12);
    const saidas: [number, TipoLigacao][] = n.tipo === 'quica' ? [[15, 'solo'], [18, 'solo']]
      : n.tipo === 'fixo' ? [[FISICA.pulo, 'solo'], [0, 'solo'], [FISICA.impulsoPulo, 'super']] : [[FISICA.pulo, 'solo'], [0, 'solo']];
    for (const x0 of xs) {
      // pontos de mira (arredondados a 0,5 m, sem repetir)
      const mira = new Set<number>();
      const mirar = (x: number) => { if (Math.abs(x - x0) <= 9.5) mira.add(Math.round(x * 2) / 2); };
      for (const m of nos) {
        if (m.id === n.id || m.tipo === 'argola') continue;
        if (m.x1 < x0 - 9 || m.x0 > x0 + 9) continue;
        if (m.y > n.y + 6 || m.y < n.y - 14) continue;
        mirar(Math.max(m.x0 + 0.35, Math.min(m.x1 - 0.35, x0))); mirar(m.x0 + 0.35); mirar(m.x1 - 0.35); mirar((m.x0 + m.x1) / 2);
      }
      for (const g of argolas) mirar(g.x);
      const alvos = [...mira];
      for (const [vy, tipo] of saidas) {
        const daBeira = x0 <= n.x0 + 0.05 || x0 >= n.x1 - 0.05;
        if (vy === 0 && !daBeira) continue;
        const guias: ((c: Corpo, t: number) => number)[] = [() => 1, () => -1];
        for (const ax of alvos) {
          guias.push((c) => ((ax - c.x) * 4) / 5.2);
          guias.push((c, t) => (t < 14 ? 0 : ((ax - c.x) * 4) / 5.2));
        }
        for (const gi of guias) {
          for (const v0 of [0, 1, -1]) {
            const vx = v0 * FISICA.velAndar;
            if (vy === 0) {
              const fora = x0 <= n.x0 + 0.05 ? -1 : 1;
              if (v0 !== fora) continue;
              voo(n.id, tipo, x0 + fora * 0.02, n.y, vx, 0, gi, perto, espPerto);
              continue;
            }
            voo(n.id, tipo, x0, n.y + 1e-3, vx, vy, gi, perto, espPerto);
          }
        }
      }
    }
  }
  // o que já se alcança sozinho não precisa de ajuda
  for (const n of nos) {
    const solo = new Set(lig[n.id].filter((l) => l.tipo === 'solo').map((l) => l.para));
    lig[n.id] = lig[n.id].filter((l) => l.tipo === 'solo' || !solo.has(l.para));
  }

  // argolas: do balanço se alcança o que estiver até 6 m para os lados e entre 0,8 e 7 m abaixo
  for (let k = 0; k < argolas.length; k++) {
    const g = argolas[k];
    for (const m of nos) {
      if (m.tipo === 'argola') continue;
      const dx = Math.max(0, m.x0 - g.x, g.x - m.x1);
      if (dx <= 6 && m.y <= g.y - 0.8 && m.y >= g.y - 7) liga(idArgola[k], m.id, 'solo');
    }
  }
  // Fio Vermelho: dentro do mesmo trecho, até 7 m de vão e 4 m de desnível
  for (const z of f.fio ?? []) {
    const dentro = fixos.filter((m) => m.x1 >= z.x0 && m.x0 <= z.x1);
    for (const a of dentro) for (const b of dentro) {
      if (a === b) continue;
      const vao = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
      if (vao <= 7 && Math.abs(b.y - a.y) <= 4) liga(a.id, b.id, 'fio');
    }
  }
  // portas: o chão de um lado e do outro
  for (const p of f.portas) {
    const esq = fixos.filter((n) => Math.abs(n.y - p.y) < 0.02 && Math.abs(n.x1 - (p.x - MEIA)) < 0.05);
    const dir = fixos.filter((n) => Math.abs(n.y - p.y) < 0.02 && Math.abs(n.x0 - (p.x + p.w + MEIA)) < 0.05);
    for (const a of esq) for (const b of dir) { liga(a.id, b.id, 'porta', p.id); liga(b.id, a.id, 'porta', p.id); }
  }
  return { fase: f, nos, lig, estrelas, estrelasSuper, placas, saltos };
}

/** Pode usar a ligação estando o parceiro em `parceiro`? */
export function podeUsar(g: Grafo, de: number, l: Ligacao, parceiro: number): boolean {
  switch (l.tipo) {
    case 'solo': return true;
    // impulso (o parceiro no mesmo lugar) ou puxar de cima (o parceiro lá em cima, até 3,5 m acima)
    case 'super': return parceiro === de || (parceiro === l.para && g.nos[l.para].y - g.nos[de].y <= 3.5);
    case 'fio': return parceiro === de || parceiro === l.para;
    case 'porta': {
      const p = g.fase.portas.find((d) => d.id === l.porta)!;
      const ligadas = g.fase.placas.filter((q) => q.abre === p.id).map((q) => q.id);
      if (p.modo === 'todas') {
        // cada placa com alguém: o que passa (em pé numa placa encostada na porta) e o parceiro
        return ligadas.every((id) => g.placas[parceiro].has(id) || g.placas[de].has(id)) && ligadas.some((id) => g.placas[parceiro].has(id));
      }
      if (ligadas.some((id) => g.placas[parceiro].has(id))) return true;
      // a própria placa colada na porta: sai dela e passa antes de a porta fechar (fecha a 1,5/s; basta ≤ 1,5 m)
      return g.fase.placas.some((q) => q.abre === p.id && g.placas[de].has(q.id) && Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w)) <= PLACA_COLADA);
    }
  }
}

/** Alcance de um jogador só, supondo o parceiro sempre por perto quando precisar (otimista). */
export function alcancaveis(g: Grafo, de: number[], tipos: TipoLigacao[] = ['solo', 'super', 'fio', 'porta']): Set<number> {
  const vis = new Set<number>(de.filter((x) => x >= 0));
  const fila = [...vis];
  while (fila.length) {
    const a = fila.pop()!;
    for (const l of g.lig[a]) if (tipos.includes(l.tipo) && !vis.has(l.para)) { vis.add(l.para); fila.push(l.para); }
  }
  return vis;
}

/**
 * Busca no espaço dos pares (nó de Natan, nó de Bruna). Devolve os pares alcançáveis a partir do início e os que
 * NÃO conseguem mais chegar ao fim (os dois no pedaço da estrela).
 */
export function pares(g: Grafo, ini: [number, number], fim: number[]) {
  const N = g.nos.length;
  const cod = (a: number, b: number) => a * N + b;
  const vis = new Set<number>([cod(ini[0], ini[1])]);
  const fila = [cod(ini[0], ini[1])];
  const pred = new Map<number, number[]>();
  while (fila.length) {
    const s = fila.pop()!;
    const a = Math.floor(s / N), b = s % N;
    const prox: number[] = [];
    for (const l of g.lig[a]) if (podeUsar(g, a, l, b)) prox.push(cod(l.para, b));
    for (const l of g.lig[b]) if (podeUsar(g, b, l, a)) prox.push(cod(a, l.para));
    for (const t of prox) {
      let p = pred.get(t); if (!p) pred.set(t, (p = [])); p.push(s);
      if (!vis.has(t)) { vis.add(t); fila.push(t); }
    }
  }
  const fimSet = new Set(fim);
  const chega = new Set<number>();
  const f2: number[] = [];
  for (const s of vis) if (fimSet.has(Math.floor(s / N)) && fimSet.has(s % N)) { chega.add(s); f2.push(s); }
  while (f2.length) {
    const s = f2.pop()!;
    for (const p of pred.get(s) ?? []) if (!chega.has(p)) { chega.add(p); f2.push(p); }
  }
  const presos = [...vis].filter((s) => !chega.has(s)).map((s) => [Math.floor(s / N), s % N] as [number, number]);
  const nosAlcancados = new Set<number>();
  for (const s of vis) { nosAlcancados.add(Math.floor(s / N)); nosAlcancados.add(s % N); }
  return { alcancados: vis.size, presos, chegaAoFim: chega.size > 0, nosAlcancados };
}

/** Nó fixo onde fica em pé quem está em (x, y) (ou cai até ele). */
export function noSob(g: Grafo, p: Ponto, tol = 0.05): number {
  let melhor = -1, yMelhor = -Infinity;
  for (const n of g.nos) {
    if (n.tipo !== 'fixo') continue;
    if (p.x < n.x0 || p.x > n.x1) continue;
    if (n.y <= p.y + tol && n.y > yMelhor) { yMelhor = n.y; melhor = n.id; }
  }
  return melhor;
}
/** Nós fixos de onde quem está em pé encosta no retângulo. */
export function nosQueTocam(g: Grafo, r: Retangulo): number[] {
  return g.nos.filter((n) => n.tipo === 'fixo' && sobrepoe({ x: n.x0 - MEIA, y: n.y, w: n.x1 - n.x0 + 2 * MEIA, h: ALT }, r)).map((n) => n.id);
}
export const descreverNo = (g: Grafo, id: number) => { const n = g.nos[id]; return `${n.tipo} y=${n.y.toFixed(2)} x=${n.x0.toFixed(1)}…${n.x1.toFixed(1)}`; };
