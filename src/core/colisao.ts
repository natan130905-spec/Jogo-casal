// Colisão de corpos com retângulos sólidos (separação por eixo). Sem estado; usado por jogadores e bichinhos.
import type { Retangulo } from './types';

export interface Corpo { x: number; y: number; vx: number; vy: number; noChao: boolean }

export const sobrepoe = (a: Retangulo, b: Retangulo) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const caixaDe = (c: { x: number; y: number }, w: number, h: number): Retangulo => ({ x: c.x - w / 2, y: c.y, w, h });

export const pontoDentro = (r: Retangulo, px: number, py: number, folga = 0) =>
  px >= r.x - folga && px <= r.x + r.w + folga && py >= r.y - folga && py <= r.y + r.h + folga;

/** Correção de quina da cabeça: até quanto a cabeça raspando a borda de baixo de um teto desliza para fora (m).
 *  A auditoria propôs 0,20 m (0,32 é mais que meia largura). Medido em 2026-11-24: com 0,20 o capítulo 3 fica com
 *  206 pares de posições sem saída e os bots não passam de x = 164,7 (um trecho depende do deslize de 0,32).
 *  Fica 0,32 até o trecho ser redesenhado. */
export const QUINA_CABECA = 0.32;

/** Folga com que um corpo resolvido fica fora do sólido (m). */
const EPS = 1e-4;

/** O corpo (centro x, pés y) cabe aqui sem encostar em nenhum sólido? */
const livre = (sol: readonly Retangulo[], x: number, y: number, w: number, h: number) => {
  const c = caixaDe({ x, y }, w, h);
  for (const r of sol) if (sobrepoe(c, r)) return false;
  return true;
};

/**
 * Move o corpo num eixo e resolve colisões. `quina` (só jogadores): se a cabeça só raspa a borda de cima,
 * desliza para fora em vez de parar o pulo. Retorna se bateu.
 *
 * Horizontal: o corpo sai do sólido pelo lado de **menor penetração** (com o passo de um tick, ≤ 0,3 m, é sempre o
 * lado de onde veio). Antes saía pelo lado da direção do movimento: um corpo que começava o passo 1e-4 m dentro de
 * um piso de 34 m ia para a outra ponta dele (teleporte do cap. 6, R20).
 * Vertical: o deslize de quina da cabeça só vale se o lugar de destino estiver livre; senão é uma batida normal
 * (antes o deslize podia deixar o corpo dentro do sólido vizinho, num vão da largura exata do corpo).
 */
export function moverEixo(c: Corpo, w: number, h: number, sol: readonly Retangulo[], dx: number, dy: number, quina = false): boolean {
  let bateu = false;
  const meia = w / 2;
  if (dx !== 0) {
    c.x += dx;
    for (const r of sol) {
      if (!sobrepoe(caixaDe(c, w, h), r)) continue;
      const penEsq = c.x + meia - r.x, penDir = r.x + r.w - (c.x - meia);
      // empate: volta para de onde veio
      const paraEsq = penEsq < penDir || (penEsq === penDir && dx > 0);
      c.x = paraEsq ? r.x - meia - EPS : r.x + r.w + meia + EPS;
      c.vx = 0; bateu = true;
    }
  }
  if (dy !== 0) {
    c.y += dy;
    for (const r of sol) {
      if (!sobrepoe(caixaDe(c, w, h), r)) continue;
      if (dy > 0 && quina) {
        const sobraEsq = c.x + meia - r.x, sobraDir = r.x + r.w - (c.x - meia);
        if (sobraEsq > 0 && sobraEsq <= QUINA_CABECA && livre(sol, r.x - meia - EPS, c.y, w, h)) { c.x = r.x - meia - EPS; continue; }
        if (sobraDir > 0 && sobraDir <= QUINA_CABECA && livre(sol, r.x + r.w + meia + EPS, c.y, w, h)) { c.x = r.x + r.w + meia + EPS; continue; }
      }
      if (dy < 0) { c.y = r.y + r.h; c.noChao = true; } else { c.y = r.y - h - EPS; }
      c.vy = 0; bateu = true;
    }
  }
  return bateu;
}
