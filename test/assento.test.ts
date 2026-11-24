// Assentos (L2b): o laço da partida pede uma entrada a cada assento; no solo, o outro personagem segue de forma
// simples (o Seguidor), até o companheiro do L6 ocupar o assento.
import { describe, expect, it } from 'vitest';
import fonteAssento from '../src/core/assento.ts?raw';
import { AssentoEntrada, AssentoParado, Seguidor, type ControladorAssento } from '../src/core/assento';
import { CAPITULOS } from '../src/core/fases/index';
import { TREINO_QUINTAL } from '../src/core/fases/treino_quintal';
import { estadoInicial, passo } from '../src/core/sim';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from '../src/core/types';
import { criarFase } from '../src/core/fases';
import { chao } from '../src/core/fases/comum';
import { ir } from '../src/core/companheiro/manobras';
import { posicionar } from './fases/bot';

/** Roda `n` ticks com o assento 0 andando para `dir` e o assento 1 com `outro`; devolve os estados e as entradas do 1. */
function rodar(f: Fase, outro: ControladorAssento, n: number, dir = 1, e: Estado = estadoInicial(f)) {
  const pessoa = new AssentoEntrada('pessoa', (): Input => ({ x: dir, y: 0, jump: false, act: false, shoot: false }));
  const ents: Input[] = [];
  for (let t = 0; t < n; t++) {
    const ent: [Input, Input] = [pessoa.entrada(), outro.entrada(f, e, 1)];
    ents.push(ent[1]);
    passo(f, e, ent);
  }
  return { e, ents };
}

describe('assentos', () => {
  it('parado: o outro não sai do lugar (o treino de antes)', () => {
    const f = CAPITULOS[0];
    const x0 = estadoInicial(f).jogadores[1].x;
    const { e } = rodar(f, new AssentoParado(), 120);
    expect(e.jogadores[1].x).toBeCloseTo(x0, 1);
  });

  /** o Natan vai até `alvo` (pulando degraus e vãos com a manobra dos bots) e o seguidor vai atrás */
  function seguir(f: Fase, alvo: number, segundos: number) {
    const e = estadoInicial(f);
    const ida = ir(alvo), m: Record<string, number> = {};
    let t = 0, maior = 0;
    const s = new Seguidor();
    for (let k = 0; k < 60 * segundos; k++) {
      const p = ida.fn({ f, e, i: 0, eu: e.jogadores[0], outro: e.jogadores[1], t: t++, m }) ?? {};
      passo(f, e, [{ ...INPUT_NEUTRO, ...p }, s.entrada(f, e, 1)]);
      maior = Math.max(maior, Math.abs(e.jogadores[0].x - e.jogadores[1].x));
    }
    return { e, maior };
  }

  it('seguidor: acompanha pelo chão (a ≤ 3 m depois de 20 m) e sobe o degrau e pula o vão atrás do parceiro', () => {
    const plano = criarFase({ id: 'plano', plataformas: [chao(-2, 40)] });
    const a = seguir(plano, 21, 8);
    expect(a.e.jogadores[0].x).toBeGreaterThan(20.5);
    expect(Math.abs(a.e.jogadores[0].x - a.e.jogadores[1].x)).toBeLessThan(3);
    // degrau de 0,8 m em x 10 e vão de 1,5 m em x 18–19,5: o Natan já está do outro lado, parado em x 24
    const obst = criarFase({ id: 'obst', plataformas: [chao(-2, 10), chao(10, 18, 0.8), chao(19.5, 40, 0.8)] });
    const e = estadoInicial(obst);
    posicionar(e, [24, 0.8], [3, 0]);
    const s = new Seguidor();
    let subiu = false;
    for (let k = 0; k < 60 * 10; k++) {
      passo(obst, e, [INPUT_NEUTRO, s.entrada(obst, e, 1)]);
      if (e.jogadores[1].x > 11 && e.jogadores[1].x < 17 && e.jogadores[1].noChao && e.jogadores[1].y > 0.7) subiu = true;
    }
    expect(subiu).toBe(true);
    expect(e.jogadores[1].x).toBeGreaterThan(20);
    expect(e.jogadores[1].y).toBeGreaterThan(0.7);
    expect(Math.abs(e.jogadores[1].x - 24)).toBeLessThan(3);
  });

  it('seguidor: perto do parceiro, fica parado (não treme)', () => {
    const f = CAPITULOS[0];
    const e = estadoInicial(f);
    const s = new Seguidor();
    const ents: Input[] = [];
    for (let t = 0; t < 240; t++) { const i = s.entrada(f, e, 1); ents.push(i); passo(f, e, [INPUT_NEUTRO, i]); }
    expect(ents.slice(120).every((i) => i.x === 0 && !i.jump)).toBe(true);
  });

  it('seguidor: determinístico (mesmas entradas nas duas rodadas) e sem Math.random no núcleo', () => {
    const f = TREINO_QUINTAL;
    const a = rodar(f, new Seguidor(), 600), b = rodar(f, new Seguidor(), 600);
    expect(JSON.stringify(a.ents)).toBe(JSON.stringify(b.ents));
    expect(a.e.jogadores[1].x).toBe(b.e.jogadores[1].x);
    expect(fonteAssento.replace(/\/\/.*$/gm, '')).not.toMatch(/Math\.random|Date\.now|performance/);
  });

  it('Quintal de Treino: a oficina sem o Rei, com bonecos e sem pedaço da estrela', () => {
    expect(TREINO_QUINTAL.id).toBe('treino-quintal');
    expect((TREINO_QUINTAL.inimigos ?? []).some((n) => n.tipo === 'rei')).toBe(false);
    expect((TREINO_QUINTAL.inimigos ?? []).filter((n) => n.x >= 50).length).toBeGreaterThanOrEqual(4);
    expect(TREINO_QUINTAL.portal.x).toBeGreaterThan(TREINO_QUINTAL.largura);
  });
});
