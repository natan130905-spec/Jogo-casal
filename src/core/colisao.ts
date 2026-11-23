// Colisão de corpos com retângulos sólidos (separação por eixo). Sem estado; usado por jogadores e bichinhos.
import type { Retangulo } from './types';

export interface Corpo { x: number; y: number; vx: number; vy: number; noChao: boolean }

export const sobrepoe = (a: Retangulo, b: Retangulo) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const caixaDe = (c: { x: number; y: number }, w: number, h: number): Retangulo => ({ x: c.x - w / 2, y: c.y, w, h });

export const pontoDentro = (r: Retangulo, px: number, py: number, folga = 0) =>
  px >= r.x - folga && px <= r.x + r.w + folga && py >= r.y - folga && py <= r.y + r.h + folga;

/**
 * Move o corpo num eixo e resolve colisões. `quina` (só jogadores): se a cabeça só raspa a borda de cima,
 * desliza para fora em vez de parar o pulo. Retorna se bateu.
 */
export function moverEixo(c: Corpo, w: number, h: number, sol: readonly Retangulo[], dx: number, dy: number, quina = false): boolean {
  let bateu = false;
  if (dx !== 0) {
    c.x += dx;
    for (const r of sol) {
      if (!sobrepoe(caixaDe(c, w, h), r)) continue;
      c.x = dx > 0 ? r.x - w / 2 - 1e-4 : r.x + r.w + w / 2 + 1e-4;
      c.vx = 0; bateu = true;
    }
  }
  if (dy !== 0) {
    c.y += dy;
    for (const r of sol) {
      if (!sobrepoe(caixaDe(c, w, h), r)) continue;
      if (dy > 0 && quina) {
        const meia = w / 2;
        const sobraEsq = c.x + meia - r.x, sobraDir = r.x + r.w - (c.x - meia);
        if (sobraEsq > 0 && sobraEsq <= 0.32) { c.x = r.x - meia - 1e-4; continue; }
        if (sobraDir > 0 && sobraDir <= 0.32) { c.x = r.x + r.w + meia + 1e-4; continue; }
      }
      if (dy < 0) { c.y = r.y + r.h; c.noChao = true; } else { c.y = r.y - h - 1e-4; }
      c.vy = 0; bateu = true;
    }
  }
  return bateu;
}
