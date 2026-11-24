// Limitador de fps (src/ui/ritmo.ts, R39): com o rAF a 90, 120 e 144 Hz desenha no máximo 60 quadros por segundo
// (e não cai para 45); a 60 Hz não pula nenhum; no modo economia, 30.
import { describe, expect, it } from 'vitest';
import { Limitador, metaDeFps } from '../src/ui/ritmo';

/** batidas do rAF a `hz` por `seg` segundos, com variação de ±`jitter` ms (vsync real oscila um pouco) */
function desenhados(hz: number, meta = 60, seg = 10, jitter = 0.6) {
  const l = new Limitador(meta);
  let n = 0, s = 12345;
  const aleat = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let k = 0; k < hz * seg; k++) if (l.quadro(1000 + (k * 1000) / hz + (aleat() * 2 - 1) * jitter)) n++;
  return n / seg;
}

describe('limitador de fps (R39)', () => {
  for (const hz of [90, 120, 144]) {
    it(`rAF a ${hz} Hz → ≤ 60 quadros/s (e ≥ 58)`, () => {
      const fps = desenhados(hz);
      expect(fps).toBeLessThanOrEqual(60.1);
      expect(fps).toBeGreaterThanOrEqual(58);
    });
  }
  it('rAF a 60 Hz → não pula quadro', () => { expect(desenhados(60)).toBeGreaterThanOrEqual(59.9); });
  it('modo economia: 120 Hz → 30 quadros/s; 60 Hz → 30', () => {
    expect(desenhados(120, 30)).toBeCloseTo(30, 0);
    expect(desenhados(60, 30)).toBeCloseTo(30, 0);
  });
  it('depois de uma parada (segundo plano) desenha o primeiro quadro na volta', () => {
    const l = new Limitador(60);
    expect(l.quadro(1000)).toBe(true);
    expect(l.quadro(9000)).toBe(true);
  });
  it('?fps=30 liga o modo economia', () => { expect(metaDeFps('?fps=30')).toBe(30); expect(metaDeFps('')).toBe(60); });
});
