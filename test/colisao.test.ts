// T15 · guardião do teleporte (R20): a colisão nunca joga um corpo para longe num tick.
// Casos fixos de `moverEixo` e o caso real do cap. 6 (superpulo de mãos dadas para a esquerda em x 30,4–30,71, que
// levava o Natan de x 29,5 a x 66,1 em 1 tick). Os 7 planos de bots são conferidos em fases.test.ts (mesmo limite).
import { describe, expect, it } from 'vitest';
import { moverEixo, sobrepoe, caixaDe, type Corpo } from '../src/core/colisao';
import { CAP6_ESPELHOS } from '../src/core/fases/index';
import { DT, estadoInicial, FISICA, solidos } from '../src/core/sim';
import type { Retangulo } from '../src/core/types';
import { darImpulso, esperar, ir, jogar, posicionar, superpulo } from './fases/bot';
import { T15_EXTRA } from './fases/t15';


const W = FISICA.largura, H = FISICA.altura;
const corpo = (x: number, y: number, vx = 0, vy = 0): Corpo => ({ x, y, vx, vy, noChao: false });

describe('T15 · colisão sem teleporte (R20)', () => {
  it('corpo que começa o passo 1e-4 m dentro de um piso comprido sai pelo lado mais perto, não pela outra ponta', () => {
    const piso: Retangulo = { x: 29.8, y: 4.4, w: 34.2, h: 0.6 };
    for (const dx of [-5e-5, -0.01, 0.087]) { // passo curto para a esquerda: ainda dentro depois de andar
      const c = corpo(29.5001, 4.5); // borda direita em 29,8001: 1e-4 dentro do piso
      moverEixo(c, W, H, [piso], dx, 0);
      expect(Math.abs(c.x - 29.5), `dx ${dx}: foi para ${c.x}`).toBeLessThan(0.1);
      expect(sobrepoe(caixaDe(c, W, H), piso)).toBe(false);
    }
  });

  it('andando contra uma parede, o corpo para do lado de onde veio (os dois sentidos)', () => {
    const parede: Retangulo = { x: 10, y: 0, w: 0.5, h: 3 };
    const a = corpo(9.65, 0); moverEixo(a, W, H, [parede], 0.087, 0);
    expect(a.x).toBeCloseTo(10 - W / 2 - 1e-4, 6);
    const b = corpo(10.85, 0); moverEixo(b, W, H, [parede], -0.087, 0);
    expect(b.x).toBeCloseTo(10.5 + W / 2 + 1e-4, 6);
  });

  it('deslize de quina da cabeça só para lugar livre: num vão da largura exata do corpo, bate a cabeça', () => {
    // tábua (27,2–29,2) e piso de cima (29,8–64) com 0,6 m entre eles: o deslize punha o corpo 1e-4 dentro do piso
    const tabua: Retangulo = { x: 27.2, y: 3.8, w: 2, h: 0.5 };
    const piso: Retangulo = { x: 29.8, y: 3.4, w: 34.2, h: 1 };
    const c = corpo(29.3, 2.6, 0, 8);
    moverEixo(c, W, H, [tabua, piso], 0, 0.2, true);
    for (const r of [tabua, piso]) expect(sobrepoe(caixaDe(c, W, H), r), `dentro de ${JSON.stringify(r)}`).toBe(false);
    expect(c.vy).toBe(0); // bateu a cabeça
    // com espaço de sobra, o deslize continua valendo (o cap. 3 depende dele, R13)
    const d = corpo(29.3, 2.6, 0, 8);
    moverEixo(d, W, H, [tabua], 0, 0.2, true);
    expect(d.x).toBeCloseTo(29.2 + W / 2 + 1e-4, 6);
    expect(d.vy).toBe(8);
  });

  it('cap. 6: o superpulo de mãos dadas para a esquerda em x 30,4–30,71 não teleporta (teleporte_cap6.ts)', () => {
    const f = CAP6_ESPELHOS;
    const achados: string[] = [];
    for (const x of [30.4, 30.55, 30.71, 31, 31.5]) for (const alvo of [20, 26, 29]) {
      const e = estadoInicial(f);
      posicionar(e, [x, 0], [x + 0.7, 0]);
      let ant = e.jogadores.map((j) => ({ x: j.x, vx: j.vx }));
      let pior = 0;
      jogar(f, [{ nome: 's', limite: 6, p: [[ir(x), superpulo(alvo), esperar((c) => c.t > 200)], [ir(x + 0.7), darImpulso()]] }], {
        e, limite: 8,
        cada: (s) => {
          s.jogadores.forEach((j, i) => {
            if (s.eventos.includes(`caiu:${i}`)) return;
            const extra = Math.abs(j.x - ant[i].x) - Math.max(Math.abs(ant[i].vx), Math.abs(j.vx)) * DT;
            pior = Math.max(pior, extra);
          });
          for (const j of s.jogadores) for (const r of solidos(f, s)) if (sobrepoe(caixaDe({ x: j.x, y: j.y + 0.01 }, W - 0.02, H - 0.02), r)) achados.push(`x ${x} alvo ${alvo}: dentro de parede em ${j.x.toFixed(2)}`);
          ant = s.jogadores.map((j) => ({ x: j.x, vx: j.vx }));
        },
      });
      if (pior > T15_EXTRA) achados.push(`x ${x} alvo ${alvo}: TELEPORTE de ${pior.toFixed(2)} m além de |vx·dt|`);
    }
    expect(achados).toEqual([]);
  });
});
