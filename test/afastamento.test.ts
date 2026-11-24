// Regra de afastamento (C2 do PLANO, L2a): desligada por padrão; ligada (`Estado.afastamento`, o L3a liga), acima de
// 24 m quem anda para longe do parceiro anda a 60 %; de 12 a 24 m só aviso; dentro de zona do Fio Vermelho ou de
// trecho "separado de propósito" (corredores do cap. 6) nada muda.
import { describe, expect, it } from 'vitest';
import { CAP6_ESPELHOS } from '../src/core/fases/index';
import { criarFase, EXEMPLO_MECANICAS } from '../src/core/fases';
import { chao } from '../src/core/fases/comum';
import { AFASTAMENTO, estadoInicial, FISICA, passo, situacaoAfastamento } from '../src/core/sim';
import type { Estado, Fase, Input } from '../src/core/types';
import { jogar, posicionar } from './fases/bot';
import { PLANOS } from './fases/planos';
import { CAPITULOS } from '../src/core/fases/index';

const N: Input = { x: 0, y: 0, jump: false, act: false, shoot: false };
const PLANA = criarFase({ id: 'plana', plataformas: [chao(-2, 200)], largura: 200, fundo: -10 });

/** Põe Natan em xa e Bruna em xb, no chão; Natan anda com o joystick em `dir` por 40 ticks. Devolve a maior |vx|. */
function velocidade(f: Fase, xa: number, xb: number, dir: number, ligado: boolean, ya = 0, yb = 0): { v: number; e: Estado } {
  const e = estadoInicial(f);
  e.afastamento = ligado;
  posicionar(e, [xa, ya], [xb, yb]);
  for (let t = 0; t < 20; t++) passo(f, e, [N, N]);
  let v = 0;
  for (let t = 0; t < 40; t++) { passo(f, e, [{ ...N, x: dir }, N]); v = Math.max(v, Math.abs(e.jogadores[0].vx)); }
  return { v, e };
}

describe('afastamento (12/24 m, 60 %)', () => {
  it('desligado por padrão: a 30 m, andar para longe continua a 5,2 m/s', () => {
    expect(estadoInicial(PLANA).afastamento).toBeUndefined();
    expect(velocidade(PLANA, 40, 70, -1, false).v).toBeCloseTo(FISICA.velAndar, 3);
  });

  it('ligado, acima de 24 m: para longe cai a 60 % (3,12 m/s); para perto continua 5,2', () => {
    const longe = velocidade(PLANA, 40, 70, -1, true);
    expect(situacaoAfastamento(PLANA, longe.e)).toBe('freio');
    expect(longe.v).toBeCloseTo(FISICA.velAndar * AFASTAMENTO.fator, 3);
    expect(velocidade(PLANA, 40, 70, 1, true).v).toBeCloseTo(FISICA.velAndar, 3);
    // a Bruna (jogador 1) do outro lado: a regra vale para os dois
    const e = estadoInicial(PLANA); e.afastamento = true; posicionar(e, [40, 0], [70, 0]);
    for (let t = 0; t < 20; t++) passo(PLANA, e, [N, N]);
    let v = 0; for (let t = 0; t < 40; t++) { passo(PLANA, e, [N, { ...N, x: 1 }]); v = Math.max(v, Math.abs(e.jogadores[1].vx)); }
    expect(v).toBeCloseTo(FISICA.velAndar * AFASTAMENTO.fator, 3);
  });

  it('de 12 a 24 m só avisa (sem freio); até 12 m, livre', () => {
    const meio = velocidade(PLANA, 50, 70, -1, true);
    expect(meio.v).toBeCloseTo(FISICA.velAndar, 3);
    expect(situacaoAfastamento(PLANA, meio.e)).toBe('aviso');
    const perto = estadoInicial(PLANA); posicionar(perto, [60, 0], [65, 0]);
    expect(situacaoAfastamento(PLANA, perto)).toBe('livre');
  });

  it('dentro da zona do Fio Vermelho nada muda', () => {
    const f: Fase = { ...EXEMPLO_MECANICAS, largura: 70, plataformas: [...EXEMPLO_MECANICAS.plataformas, chao(-2, 70, -0.001, 0.5)], fundo: -8 };
    // Natan na zona do fio (11,5–22,5), Bruna 30 m adiante
    const r = velocidade({ ...f, inimigos: [], especiais: [], portas: [], placas: [] }, 20, 50, -1, true);
    expect(situacaoAfastamento(f, r.e)).toBe('fio');
    expect(r.v).toBeCloseTo(FISICA.velAndar, 3);
  });

  it('cap. 6: nos corredores separados de propósito nada muda; fora deles, freia', () => {
    const f = { ...CAP6_ESPELHOS, inimigos: [] };
    // Bruna embaixo em x 60 (corredor 30–64), Natan em cima voltando para a sala de entrada: dentro do trecho separado
    const r = velocidade(f, 55, 31, 1, true, 5, 0);
    expect(situacaoAfastamento(f, r.e)).toBe('separados');
    expect(r.v).toBeCloseTo(FISICA.velAndar, 3);
    // salão final (x 120–150, fora dos trechos separados): 26 m de distância freia
    const s = velocidade(f, 147, 121, 1, true);
    expect(situacaoAfastamento(f, s.e)).toBe('freio');
    expect(s.v).toBeCloseTo(FISICA.velAndar * AFASTAMENTO.fator, 3);
  });

  it('com a regra ligada, os 7 planos de bots continuam fechando (os bots andam juntos)', () => {
    for (const f of CAPITULOS) {
      const e = estadoInicial(f); e.afastamento = true;
      const r = jogar(f, PLANOS[f.id], { e, limite: 420 });
      expect(r.concluida, `${f.id}: ${r.erro ?? ''}`).toBe(true);
    }
  }, 120_000);
});
