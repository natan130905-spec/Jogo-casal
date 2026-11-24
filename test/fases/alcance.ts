// Verificação de alcançabilidade por saltos (sem bots): monta um grafo de "lugares onde se pode ficar em pé"
// (topos das plataformas fixas, plataformas especiais em várias posições do tempo, argolas) e liga A → B quando
// um salto de verdade (mesma física de src/core/sim.ts, com colisão) sai de A e pousa em B.
//  - grafo "solo": só pulo normal e cair da beira; portas fechadas (ninguém segurando placa).
//  - grafo "coop": também o superpulo de mãos dadas (só onde dá para puxar o parceiro depois: até 3,5 m acima),
//    os trechos do Fio Vermelho e as portas abertas.
import { moverEixo, sobrepoe, type Corpo } from '../../src/core/colisao';
import { especialNoTempo } from '../../src/core/plataformas';
import { FISICA } from '../../src/core/sim';
import type { DefEspecial, Fase, Ponto, Retangulo } from '../../src/core/types';

const DT = 1 / 60;
const MEIA = FISICA.largura / 2;
const ALT = FISICA.altura;

export interface No {
  id: number; chave: string;
  tipo: 'fixo' | 'esp' | 'quica' | 'argola';
  /** intervalo das posições do centro do corpo e altura dos pés */
  x0: number; x1: number; y: number;
  k?: number; amostra?: number;
}
export interface Grafo {
  nos: No[];
  arestas: Set<number>[];
  /** estrelinhas que se alcançam a partir de cada nó (andando ou num salto que sai dele) */
  estrelas: Set<number>[];
  solidos: Retangulo[];
  saltosSimulados: number;
}

/** Superfícies de pé das plataformas fixas (mais portas fechadas, se for o caso), já sem as partes tapadas. */
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
  // junta pedaços contíguos na mesma altura
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

interface Opcoes { portasFechadas: boolean; coop: boolean; passoAmostra?: number }

export function montarGrafo(f: Fase, o: Opcoes): Grafo {
  const sol: Retangulo[] = [...f.plataformas];
  if (o.portasFechadas) for (const p of f.portas) sol.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  const nos: No[] = [];
  const add = (n: Omit<No, 'id'>) => { const id = nos.length; nos.push({ ...n, id }); return id; };
  for (const s of superficies(sol)) add({ chave: `f:${s.y.toFixed(2)}:${s.x0.toFixed(2)}`, tipo: 'fixo', ...s });

  // especiais: retângulos (one-way) por nó
  const defs = f.especiais ?? [];
  const retNo = new Map<number, Retangulo>();
  const cadeias: number[][] = [];
  for (let k = 0; k < defs.length; k++) {
    const d = defs[k];
    if (d.tipo === 'quicante') {
      const id = add({ chave: `q:${k}`, tipo: 'quica', x0: d.x - MEIA + 0.01, x1: d.x + d.w + MEIA - 0.01, y: d.y + d.h, k });
      retNo.set(id, { x: d.x, y: d.y, w: d.w, h: d.h }); cadeias.push([id]); continue;
    }
    if (d.tipo === 'cai') {
      const id = add({ chave: `c:${k}`, tipo: 'esp', x0: d.x - MEIA + 0.01, x1: d.x + d.w + MEIA - 0.01, y: d.y + d.h, k });
      retNo.set(id, { x: d.x, y: d.y, w: d.w, h: d.h }); cadeias.push([id]); continue;
    }
    const per = periodoEspecial(d);
    const passo = o.passoAmostra ?? 0.25;
    const ids: number[] = [];
    for (let s = 0, t = 0; t < per - 1e-6; s++, t += passo) {
      const p = especialNoTempo(d, t);
      if (!p || !p.ativa) continue;
      const id = add({ chave: `e:${k}:${s}`, tipo: 'esp', x0: p.x - MEIA + 0.01, x1: p.x + d.w + MEIA - 0.01, y: p.y + d.h, k, amostra: s });
      retNo.set(id, { x: p.x, y: p.y, w: d.w, h: d.h });
      ids.push(id);
    }
    cadeias.push(ids);
  }
  const argolas = f.argolas ?? [];
  const idArgola = argolas.map((g, k) => add({ chave: `a:${k}`, tipo: 'argola', x0: g.x, x1: g.x, y: g.y, k }));

  const arestas = nos.map(() => new Set<number>());
  const estrelas = nos.map(() => new Set<number>());
  const liga = (a: number, b: number) => { if (a !== b && a >= 0 && b >= 0) arestas[a].add(b); };

  // andar nas especiais: seguir a plataforma de uma amostra para a próxima (bolha só sobe; móvel e giratória em ciclo)
  for (let k = 0; k < defs.length; k++) {
    const ids = cadeias[k];
    const d = defs[k];
    if (ids.length < 2) continue;
    for (let s = 0; s < ids.length; s++) {
      const prox = ids[(s + 1) % ids.length];
      if (d.tipo === 'bolha' && s === ids.length - 1) continue;
      liga(ids[s], prox);
    }
  }

  const estrelasF = f.estrelinhas ?? [];
  const tocaEstrela = (x: number, y: number, de: number) => {
    const cy = y + ALT / 2;
    for (let k = 0; k < estrelasF.length; k++) {
      const p = estrelasF[k];
      if (Math.abs(p.x - x) <= MEIA + 0.55 && Math.abs(p.y - cy) <= ALT / 2 + 0.55) estrelas[de].add(k);
    }
  };
  // em pé: estrelinhas ao alcance andando
  for (const n of nos) {
    if (n.tipo === 'argola' || n.tipo === 'quica') continue;
    for (let k = 0; k < estrelasF.length; k++) {
      const p = estrelasF[k];
      if (p.x >= n.x0 - 0.55 && p.x <= n.x1 + 0.55 && p.y - (n.y + ALT / 2) <= ALT / 2 + 0.55 && p.y >= n.y - 0.55) estrelas[n.id].add(k);
    }
  }

  // nó onde se pousou
  const fixos = nos.filter((n) => n.tipo === 'fixo');
  const noFixoEm = (x: number, y: number) => fixos.find((n) => Math.abs(n.y - y) < 0.02 && x >= n.x0 - 0.02 && x <= n.x1 + 0.02)?.id ?? -1;

  let saltosSimulados = 0;
  /** um salto: (x, y) de partida, velocidade inicial, entrada do joystick ao longo do voo */
  const voo = (de: number, x: number, y: number, vx: number, vy: number, guia: (c: Corpo, t: number) => number, lancado: boolean, perto: Retangulo[], espPerto: [number, Retangulo][]) => {
    saltosSimulados++;
    const c: Corpo = { x, y, vx, vy, noChao: false };
    for (let t = 0; t < 200; t++) {
      const inx = Math.max(-1, Math.min(1, guia(c, t)));
      const alvo = inx * FISICA.velAndar;
      const acel = (t === 0 ? FISICA.acelChao : FISICA.acelAr) * DT;
      c.vx += Math.max(-acel, Math.min(acel, alvo - c.vx));
      c.vy = Math.max(-FISICA.velQuedaMax, c.vy - FISICA.gravidade * DT);
      c.noChao = false;
      moverEixo(c, FISICA.largura, ALT, perto, c.vx * DT, 0);
      const yAntes = c.y;
      moverEixo(c, FISICA.largura, ALT, perto, 0, c.vy * DT, true);
      c.x = Math.max(0.3, Math.min(f.largura - 0.3, c.x));
      tocaEstrela(c.x, c.y, de);
      // argolas: as mãos chegam perto (no ar)
      for (let k = 0; k < argolas.length; k++) {
        const g = argolas[k];
        if (Math.hypot(g.x - c.x, g.y - (c.y + 1)) <= 1.05) liga(de, idArgola[k]);
      }
      if (!c.noChao && c.vy <= 0) {
        for (const [id, r] of espPerto) {
          const topo = r.y + r.h;
          if (c.x + MEIA <= r.x || c.x - MEIA >= r.x + r.w) continue;
          if (yAntes >= topo - 0.06 && c.y <= topo + 1e-3) { liga(de, id); return; }
        }
      }
      if (c.noChao) { if (t > 0 || vy <= 0) liga(de, noFixoEm(c.x, c.y)); return; }
      if (c.y < f.fundo) return;
      void lancado;
    }
  };

  const fontes = nos.filter((n) => n.tipo !== 'argola');
  for (const n of fontes) {
    const xs: number[] = [];
    const larg = n.x1 - n.x0;
    if (n.tipo === 'quica') { for (let i = 0; i <= 2; i++) xs.push(n.x0 + 0.3 + ((larg - 0.6) * i) / 2); }
    else {
      xs.push(n.x0 + 0.02, n.x1 - 0.02);
      for (let x = n.x0 + 1; x < n.x1 - 0.5; x += 2) xs.push(x);
    }
    const perto = sol.filter((r) => r.x < n.x1 + 12 && r.x + r.w > n.x0 - 12);
    const espPerto: [number, Retangulo][] = [...retNo].filter(([id, r]) => id !== n.id && r.x < n.x1 + 12 && r.x + r.w > n.x0 - 12);
    const vys = n.tipo === 'quica' ? [15, 18] : o.coop && n.tipo === 'fixo' ? [FISICA.pulo, 0, FISICA.impulsoPulo] : [FISICA.pulo, 0];
    for (const x0 of xs) {
      // alvos: os outros nós por perto
      const alvos: number[] = [];
      for (const m of nos) {
        if (m.id === n.id || m.tipo === 'argola') continue;
        if (m.x1 < x0 - 9 || m.x0 > x0 + 9) continue;
        if (m.y > n.y + 6 || m.y < n.y - 14) continue;
        alvos.push(Math.max(m.x0 + 0.35, Math.min(m.x1 - 0.35, x0)), m.x0 + 0.35, m.x1 - 0.35, (m.x0 + m.x1) / 2);
      }
      for (const g of argolas) if (Math.abs(g.x - x0) < 6) alvos.push(g.x);
      for (const vy of vys) {
        const daBeira = x0 <= n.x0 + 0.05 || x0 >= n.x1 - 0.05;
        if (vy === 0 && !daBeira) continue;
        const sup = vy === FISICA.impulsoPulo;
        const guias: ((c: Corpo, t: number) => number)[] = [() => 1, () => -1];
        for (const ax of alvos) {
          guias.push((c) => (ax - c.x) * 4 / 5.2);
          guias.push((c, t) => (t < 12 ? 0 : (ax - c.x) * 4 / 5.2));
        }
        for (const gi of guias) {
          for (const v0 of [0, 1, -1]) {
            const vx = v0 * FISICA.velAndar;
            if (vy === 0) {
              // cair da beira, andando para fora
              const fora = x0 <= n.x0 + 0.05 ? -1 : 1;
              if (v0 !== fora) continue;
              voo(n.id, x0 + fora * 0.02, n.y, vx, 0, gi, false, perto, espPerto);
              continue;
            }
            const antes = saltosSimulados;
            voo(n.id, x0, n.y + 1e-3, vx, vy, gi, n.tipo === 'quica', perto, espPerto);
            void antes; void sup;
          }
        }
      }
    }
  }
  // superpulo só vale se o de cima consegue puxar o parceiro depois (até 3,5 m acima): remove as arestas coop altas
  // demais (as de pulo normal nunca passam de 1,9 m).
  for (const n of fontes) {
    if (n.tipo !== 'fixo') continue;
    for (const b of [...arestas[n.id]]) {
      const m = nos[b];
      if (m.tipo === 'argola') continue;
      if (m.y - n.y > 3.5) arestas[n.id].delete(b);
    }
  }

  // argolas: do balanço se alcança o que estiver até 6 m para os lados e entre 0,8 e 7 m abaixo
  for (let k = 0; k < argolas.length; k++) {
    const g = argolas[k];
    for (const m of nos) {
      if (m.tipo === 'argola') continue;
      const dx = Math.max(0, m.x0 - g.x, g.x - m.x1);
      if (dx <= 6 && m.y <= g.y - 0.8 && m.y >= g.y - 7) liga(idArgola[k], m.id);
    }
  }
  // Fio Vermelho (coop): dentro do mesmo trecho, um segura e o outro balança/sobe pela corda até 7 m de vão e 4 m
  // de desnível
  if (o.coop) {
    for (const z of f.fio ?? []) {
      const dentro = nos.filter((m) => m.tipo === 'fixo' && m.x1 >= z.x0 && m.x0 <= z.x1);
      for (const a of dentro) for (const b of dentro) {
        if (a === b) continue;
        const vao = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
        if (vao <= 7 && Math.abs(b.y - a.y) <= 4) liga(a.id, b.id);
      }
    }
  }
  return { nos, arestas, estrelas, solidos: sol, saltosSimulados };
}

export function alcancaveis(g: Grafo, de: number[]): Set<number> {
  const vis = new Set<number>(de.filter((x) => x >= 0));
  const fila = [...vis];
  while (fila.length) { const a = fila.pop()!; for (const b of g.arestas[a]) if (!vis.has(b)) { vis.add(b); fila.push(b); } }
  return vis;
}
/** Nós que chegam a algum dos `alvos` (busca ao contrário). */
export function chegamA(g: Grafo, alvos: number[]): Set<number> {
  const rev = g.nos.map(() => [] as number[]);
  g.arestas.forEach((s, a) => { for (const b of s) rev[b].push(a); });
  const vis = new Set<number>(alvos.filter((x) => x >= 0));
  const fila = [...vis];
  while (fila.length) { const a = fila.pop()!; for (const b of rev[a]) if (!vis.has(b)) { vis.add(b); fila.push(b); } }
  return vis;
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
/** Nós fixos que tocam o retângulo (alguém em pé neles encosta nele). */
export function nosQueTocam(g: Grafo, r: Retangulo): number[] {
  return g.nos.filter((n) => n.tipo === 'fixo' && sobrepoe({ x: n.x0 - MEIA, y: n.y, w: n.x1 - n.x0 + 2 * MEIA, h: ALT }, r)).map((n) => n.id);
}
