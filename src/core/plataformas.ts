// Plataformas especiais (móveis, giratórias, quicantes, que caem, bolhas). As que dependem só do tempo
// (móvel, giratória, bolha) são funções do tick: o convidado recalcula sem precisar recebê-las pela rede.
import type { DefEspecial, EstadoEspecial, Fase, Retangulo } from './types';

export const DT = 1 / 60;

function posMovel(d: Extract<DefEspecial, { tipo: 'movel' }>, t: number) {
  const pts = d.circular ? [...d.trajeto, d.trajeto[0]] : d.trajeto;
  if (pts.length < 2) return { x: pts[0].x, y: pts[0].y };
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); seg.push(l); total += l; }
  if (total <= 0) return { x: pts[0].x, y: pts[0].y };
  let s = (d.vel * t) % (d.circular ? total : 2 * total);
  if (s > total) s = 2 * total - s; // ida e volta
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i] || i === seg.length - 1) {
      const k = seg[i] > 0 ? Math.min(1, s / seg[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }
    s -= seg[i];
  }
  return { x: pts[0].x, y: pts[0].y };
}

/** Posição (canto de baixo à esquerda) e se está ativa, para as especiais que dependem só do tempo. */
export function especialNoTempo(d: DefEspecial, t: number): { x: number; y: number; ativa: boolean; s: number } | null {
  switch (d.tipo) {
    case 'movel': { const p = posMovel(d, t); return { ...p, ativa: true, s: 0 }; }
    case 'giratoria': {
      const a = ((d.inicio ?? 0) * Math.PI) / 180 + (d.sentido ?? -1) * (2 * Math.PI * t) / d.periodo;
      return { x: d.cx + Math.cos(a) * d.raio - d.w / 2, y: d.cy + Math.sin(a) * d.raio - d.h / 2, ativa: true, s: 0 };
    }
    case 'bolha': {
      const subida = d.sobe / d.vel, ciclo = subida + (d.pausa ?? 1);
      const c = (((t + (d.atraso ?? 0)) % ciclo) + ciclo) % ciclo;
      if (c < subida) return { x: d.x, y: d.y + c * d.vel, ativa: true, s: 0 };
      return { x: d.x, y: d.y + d.sobe, ativa: false, s: 3 };
    }
    default: return null;
  }
}

export function especiaisIniciais(fase: Fase): EstadoEspecial[] {
  return (fase.especiais ?? []).map((d) => {
    const p = especialNoTempo(d, 0);
    if (p) return { x: p.x, y: p.y, ativa: p.ativa, s: p.s, t: 0, vy: 0 };
    const f = d as { x: number; y: number };
    return { x: f.x, y: f.y, ativa: true, s: 0, t: 0, vy: 0 };
  });
}

export const retEspecial = (d: DefEspecial, s: EstadoEspecial): Retangulo => ({ x: s.x, y: s.y, w: d.w, h: d.h });

/** Recalcula as especiais que dependem só do tempo (também usado pelo convidado, com tick fracionário). */
export function posicionarNoTempo(fase: Fase, especiais: EstadoEspecial[], tick: number) {
  const defs = fase.especiais ?? [];
  for (let k = 0; k < defs.length; k++) {
    const p = especialNoTempo(defs[k], tick * DT);
    if (!p || !especiais[k]) continue;
    const s = especiais[k];
    s.x = p.x; s.y = p.y; s.ativa = p.ativa; s.s = p.s;
  }
}

/**
 * Avança as especiais um passo. `pisadas[k]`: alguém está em pé na especial k. Gera eventos e devolve os
 * deslocamentos (para carregar quem está em cima).
 */
export function passoEspeciais(fase: Fase, especiais: EstadoEspecial[], tick: number, pisadas: boolean[], fundo: number, eventos: string[]) {
  const defs = fase.especiais ?? [];
  const delta: { dx: number; dy: number }[] = [];
  for (let k = 0; k < defs.length; k++) {
    const d = defs[k], s = especiais[k];
    const x0 = s.x, y0 = s.y, ativa0 = s.ativa;
    const p = especialNoTempo(d, tick * DT);
    if (p) {
      s.x = p.x; s.y = p.y; s.ativa = p.ativa; s.s = p.s;
      if (ativa0 && !s.ativa && d.tipo === 'bolha') eventos.push(`estoura:${k}`);
    } else if (d.tipo === 'cai') {
      s.t += DT;
      if (s.s === 0 && pisadas[k]) { s.s = 1; s.t = 0; eventos.push(`treme:${k}`); }
      else if (s.s === 1 && s.t >= (d.espera ?? 0.6)) { s.s = 2; s.t = 0; s.vy = 0; eventos.push(`cai:${k}`); }
      else if (s.s === 2) {
        s.vy = Math.max(-14, s.vy - 22 * DT);
        s.y += s.vy * DT;
        if (s.y < fundo - 2) { s.s = 3; s.ativa = false; }
      }
      if (s.s >= 2 && s.t >= (d.volta ?? 3)) {
        s.s = 0; s.t = 0; s.vy = 0; s.x = d.x; s.y = d.y; s.ativa = true; eventos.push(`volta:${k}`);
      }
    }
    // giratória/móvel/cai carregam quem está em cima; bolha que estourou não
    delta.push(s.ativa && ativa0 ? { dx: s.x - x0, dy: s.y - y0 } : { dx: 0, dy: 0 });
  }
  return delta;
}
