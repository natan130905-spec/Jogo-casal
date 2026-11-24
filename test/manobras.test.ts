// As manobras do companheiro (src/core/companheiro/) são puras e determinísticas: sem sorteio, sem relógio e sem DOM
// (T13 depende disso). Os 7 planos de bots que as usam fecham no tick travado em fases.test.ts (TICK_PLANO).
import { describe, expect, it } from 'vitest';
import * as manobras from '../src/core/companheiro/manobras';
import * as bot from './fases/bot';

describe('manobras em src/core/companheiro', () => {
  it('sem Math.random, Date, performance, window ou document', () => {
    const fontes = import.meta.glob('../src/core/companheiro/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(fontes).length).toBeGreaterThan(0);
    const achados: string[] = [];
    for (const [nome, texto] of Object.entries(fontes)) {
      const s = texto.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const proibido of ['Math.random', 'Date', 'performance', 'window', 'document']) if (new RegExp(`\\b${proibido.replace('.', '\\.')}\\b`).test(s)) achados.push(`${nome}: ${proibido}`);
    }
    expect(achados).toEqual([]);
  });

  it('os bots usam as mesmas manobras (test/fases/bot.ts reexporta, não copia)', () => {
    for (const nome of ['ir', 'saltar', 'darImpulso', 'superpulo', 'segurarFio', 'descerDaBeira', 'balancar', 'preverVoo', 'carona', 'subirEm', 'saltarDe',
      'subirNaGiratoria', 'saltarDaGiratoria', 'atravessarArgola', 'quicarPara', 'lutarComORei', 'autoTiro'] as const) {
      expect(typeof manobras[nome], nome).toBe('function');
      expect((bot as Record<string, unknown>)[nome], nome).toBe(manobras[nome]);
    }
  });
});
