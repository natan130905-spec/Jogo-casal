import { describe, it, expect } from 'vitest';
import { estadoInicial, passo, FISICA, solidos } from '../src/core/sim';
import { FLORESTA_1 } from '../src/core/fases';
import type { Estado, Input } from '../src/core/types';

const N: Input = { x: 0, jump: false, act: false };
const rodar = (e: Estado, seg: number, a: Partial<Input> = {}, b: Partial<Input> = {}) => {
  for (let i = 0; i < Math.round(seg * 60); i++) passo(FLORESTA_1, e, [{ ...N, ...a }, { ...N, ...b }]);
  return e;
};
/** Leva o jogador i até x (no chão): pula na beira de um vão ou quando trava num degrau. */
function irAte(e: Estado, i: number, x: number, maxSeg = 20) {
  let segurar = 0;
  for (let t = 0; t < maxSeg * 60; t++) {
    const j = e.jogadores[i];
    if (Math.abs(j.x - x) < 0.15 && j.noChao) break;
    const dir = Math.sign(x - j.x) || 1;
    const perto = Math.abs(x - j.x) < 0.6;
    const sol = solidos(FLORESTA_1, e);
    const dentro = (px: number, py: number) => sol.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    const semChaoAFrente = !dentro(j.x + dir * 0.7, j.y - 0.1);
    const paredeAFrente = dentro(j.x + dir * 0.45, j.y + 0.2);
    if (j.noChao && !perto && (semChaoAFrente || paredeAFrente)) segurar = 22;
    const inp: Input = { x: perto ? dir * 0.4 : dir, jump: segurar > 0, act: false };
    if (segurar > 0) segurar--;
    passo(FLORESTA_1, e, i === 0 ? [inp, N] : [N, inp]);
  }
  return e.jogadores[i];
}

describe('simulação', () => {
  it('os dois caem e ficam no chão inicial', () => {
    const e = rodar(estadoInicial(FLORESTA_1), 1);
    expect(e.jogadores[0].noChao).toBe(true);
    expect(e.jogadores[0].y).toBeCloseTo(0, 3);
    expect(e.jogadores[1].y).toBeCloseTo(0, 3);
  });

  it('é determinística', () => {
    const a = rodar(estadoInicial(FLORESTA_1), 3, { x: 1, jump: true }, { x: 0.5 });
    const b = rodar(estadoInicial(FLORESTA_1), 3, { x: 1, jump: true }, { x: 0.5 });
    expect(JSON.stringify(a.jogadores)).toBe(JSON.stringify(b.jogadores));
  });

  it('pulo normal não alcança a casa na árvore; o impulso de mãos dadas alcança', () => {
    const alturaNormal = FISICA.pulo ** 2 / (2 * FISICA.gravidade);
    const alturaImpulso = FISICA.impulsoPulo ** 2 / (2 * FISICA.gravidade);
    const topo = 2.6 + 0.6;
    expect(alturaNormal).toBeLessThan(topo);
    expect(alturaImpulso).toBeGreaterThan(topo + FISICA.altura * 0.2);
  });

  it('cair no vão devolve ao último ponto seguro', () => {
    const e = estadoInicial(FLORESTA_1);
    rodar(e, 0.5);
    e.jogadores[0].x = 14.8; // em cima do vão
    rodar(e, 2);
    expect(e.jogadores[0].y).toBeGreaterThanOrEqual(-0.01);
  });

  it('porteira fechada bloqueia; a placa abre; soltar fecha', () => {
    const e = estadoInicial(FLORESTA_1);
    rodar(e, 0.5);
    Object.assign(e.jogadores[0], { x: 38, y: 0 });
    Object.assign(e.jogadores[1], { x: 33.7, y: 0 }); // em cima da placa-1
    rodar(e, 3, { x: 1 });
    expect(e.portas['porteira-1']).toBe(1);
    expect(e.jogadores[0].x).toBeGreaterThan(41); // passou
    Object.assign(e.jogadores[1], { x: 36, y: 0 });
    rodar(e, 2);
    expect(e.portas['porteira-1']).toBe(0);
  });

  it('campanha da fase completa por um roteiro cooperativo', () => {
    const e = rodar(estadoInicial(FLORESTA_1), 0.5);
    // este roteiro testa placas, porteira e mãos dadas; os bichinhos têm testes próprios (mecanicas.test.ts)
    for (const n of e.inimigos) n.vivo = false;
    irAte(e, 1, 33.7);          // P2 vai para a placa-1
    irAte(e, 0, 42.3);          // P1 passa a porteira aberta e fica na placa-2
    expect(e.jogadores[0].x).toBeGreaterThan(41);
    irAte(e, 1, 49);            // P2 passa (P1 segura a placa-2)
    irAte(e, 0, 49.6);          // P1 encosta no parceiro
    expect(e.jogadores[1].x).toBeGreaterThan(44);
    rodar(e, 0.1, {}, { act: true });            // P2 dá as mãos: impulso para P1
    expect(e.jogadores[0].impulso).toBeGreaterThan(0);
    rodar(e, 1.0, { x: 1, jump: true });          // P1 sobe na casa
    expect(e.jogadores[0].y).toBeGreaterThan(3);
    Object.assign(e.jogadores[1], { x: 49.4, y: 0, vx: 0, vy: 0 }); // P2 ao lado da beirada, embaixo
    Object.assign(e.jogadores[0], { x: 50.4, y: 3.2, vx: 0, vy: 0 }); // P1 na beirada, em cima
    rodar(e, 0.05);
    rodar(e, 0.1, { act: true });                 // P1 puxa P2 pela mão
    expect(e.jogadores[1].impulso).toBeGreaterThan(0);
    rodar(e, 1.0, {}, { jump: true, x: 1 });     // P2 sobe
    expect(e.jogadores[1].y).toBeGreaterThan(3);
    irAte(e, 0, 53.6); irAte(e, 1, 53.0);         // os dois entram no portal e esperam
    rodar(e, 1);
    expect(e.concluida).toBe(true);
  });
});
