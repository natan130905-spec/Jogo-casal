// PROPOSTA de teste permanente (não roda sozinho: o nome não termina em .test.ts de propósito, para não entrar no
// `npm test` enquanto outra equipe mexe no repositório). Para adotar: copie para test/fisica_envoltoria.test.ts e
// troque os imports para '../src/core/…' e './fases/…'. Medidas de 2026-11-24 (commit 791dde2), simulação real.
//
// O que ele trava:
//   1. a envoltória do pulo (altura, tempo no ar, distância) — se alguém mexer em FISICA e uma estrelinha que
//      dependia de 1,75 m ficar a 1,70 m, o teste avisa ANTES do jogador;
//   2. coyote time, jump buffer e pisão (hoje: 0, 0 e o pisão sem segurar cortado; os valores-alvo estão nos `todo`);
//   3. alcance: toda estrelinha alcançável sozinho ou em dupla pela busca sobre a simulação real
//      (tools/revisao/auditoria-movimento/alcance_estrelinhas.ts → mover para test/fases/busca.ts).
import { describe, expect, it } from 'vitest';
import { CAPITULOS, criarFase } from '../../../src/core/fases';
import { estadoInicial, passo } from '../../../src/core/sim';
import { INPUT_NEUTRO as N, type Input } from '../../../src/core/types';
import { analisarCapitulo } from './alcance_estrelinhas';

const I = (x: number, jump: boolean): Input => ({ x, y: 0, jump, act: false, shoot: false });
const plana = () => criarFase({ id: 'p', plataformas: [{ x: 0, y: -1, w: 300, h: 1 }], fundo: -30, largura: 300 });

function pulo(segura: number, dir = 0, impulso = false) {
  const f = plana(); const e = estadoInicial(f); const j = e.jogadores[0];
  j.x = 100; e.jogadores[1].x = 5;
  for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
  for (let t = 0; t < 30 && dir; t++) passo(f, e, [I(dir, false), N]);
  if (impulso) j.impulso = 0.6;
  const x0 = j.x; let h = 0, t = 0;
  for (; t < 300; t++) { passo(f, e, [I(dir, t < segura), N]); h = Math.max(h, j.y); if (t > 2 && j.noChao) break; }
  return { h, tAr: (t + 1) / 60, dx: j.x - x0 };
}

describe('envoltória do pulo (trava os números que as fases usam)', () => {
  it('pulo cheio: 1,75 m, 0,70 s no ar, 3,64 m correndo', () => {
    const p = pulo(999, 1);
    expect(p.h).toBeCloseTo(1.75, 2); expect(p.tAr).toBeCloseTo(0.7, 2); expect(p.dx).toBeCloseTo(3.64, 1);
  });
  it('toque de 1 tick: 0,73 m; 200 ms: 1,60 m (pulo variável)', () => {
    expect(pulo(1).h).toBeCloseTo(0.725, 2);
    expect(pulo(12).h).toBeCloseTo(1.603, 2);
  });
  it('superpulo de mãos dadas: 4,40 m, 5,63 m correndo', () => {
    const p = pulo(999, 1, true);
    expect(p.h).toBeCloseTo(4.4, 2); expect(p.dx).toBeCloseTo(5.63, 1);
  });
  // Alvos propostos (AUDITORIA_MOVIMENTO.md §3). Trocar `it.todo` por `it` quando a mudança entrar no núcleo.
  it.todo('coyote time: pulo sai até 6 ticks (0,10 s) depois de sair da quina');
  it.todo('jump buffer: apertar até 7 ticks (0,12 s) antes de pousar pula no pouso');
  it.todo('pisão sem segurar quica ≥ 1,3 m (hoje 0,47 m: `lancado` não é ligado no pisão)');
  it.todo('quina dos pés: degrau até 1,90 m sobe com o pulo cheio encostado (hoje 1,74 m)');
});

describe('alcance de todo coletável (busca sobre a simulação real)', () => {
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}: nenhuma estrelinha, lanterna ou placa inalcançável; pedaço alcançável`, () => {
      const r = analisarCapitulo(f);
      const faltam = r.estrelas.map((a, k) => (a ? null : `#${k} (${f.estrelinhas![k].x}, ${f.estrelinhas![k].y})`)).filter(Boolean);
      expect(faltam).toEqual([]);
      expect(r.lanternas.filter((v) => v === null)).toEqual([]);
      expect(Object.entries(r.placas).filter(([, v]) => v === null)).toEqual([]);
      expect(r.portal).not.toBeNull();
      // nenhuma estrelinha que só se pega com salto muito preciso
      expect(r.estrelas.filter((a) => a && a.variante !== 'F' && a.folga <= 3).length).toBe(0);
    }, 240_000);
  }
});
