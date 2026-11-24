// Fases dos 7 capítulos: dados bem formados, alcançabilidade por saltos (ninguém fica preso sem saída) e
// vitória de verdade com dois bots cooperativos roteirizados rodando a simulação inteira, do início ao pedaço da estrela.
import { describe, expect, it } from 'vitest';
import { CAPITULOS } from '../src/core/fases/index';
import { DT, estadoInicial, passo, solidos } from '../src/core/sim';
import { INIMIGO } from '../src/core/inimigos';
import { pontoDentro, sobrepoe } from '../src/core/colisao';
import { instantaneo, restaurar } from '../src/core/instantaneo';
import type { Fase, Input, Ponto } from '../src/core/types';
import { criarFase, FASES } from '../src/core/fases';
import { chao } from '../src/core/fases/comum';
import { alcancaveis, descreverNo, montarGrafo, noSob, nosQueTocam, pares, type Grafo } from './fases/alcance';
import { jogar, NEUTRO } from './fases/bot';
import { PLANOS } from './fases/planos';
import { T15_EXTRA } from './fases/t15';

const TEMAS = ['brinquedos', 'floresta', 'relogio', 'oceano', 'doces', 'espelhos', 'cosmos'];

describe('fases dos capítulos: dados', () => {
  it('uma fase por capítulo, na ordem, com tema e lembrança', () => {
    expect(CAPITULOS.map((f) => f.capitulo)).toEqual(CAPITULOS.map((_, i) => i + 1));
    expect(new Set(CAPITULOS.map((f) => f.id)).size).toBe(CAPITULOS.length);
    for (const f of CAPITULOS) {
      expect(TEMAS[f.capitulo - 1]).toBe(f.tema);
      expect(f.lembranca.length).toBeGreaterThan(10);
      expect(f.frase.length).toBeGreaterThan(10);
      expect(FASES[f.id]).toBe(f); // registrada no índice geral
    }
  });

  for (const f of CAPITULOS) {
    describe(`${f.capitulo}. ${f.nome}`, () => {
      it('tamanho de 2–4 minutos, lanternas a cada ~30–40 m, estrelinhas e bichinhos', () => {
        expect(f.largura).toBeGreaterThanOrEqual(150);
        expect(f.largura).toBeLessThanOrEqual(320);
        const xs = [f.inicio[0].x, ...(f.lanternas ?? []).map((l) => l.x), f.portal.x];
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i] - xs[i - 1], `entre ${xs[i - 1]} e ${xs[i]}`).toBeGreaterThan(i === xs.length - 1 ? 8 : 18);
          expect(xs[i] - xs[i - 1], `entre ${xs[i - 1]} e ${xs[i]}`).toBeLessThanOrEqual(42);
        }
        expect((f.estrelinhas ?? []).length).toBeGreaterThanOrEqual(20);
        expect((f.inimigos ?? []).length).toBeGreaterThanOrEqual(4);
      });

      it('nada nasce dentro de parede; bichinhos que andam nascem em cima de chão fixo', () => {
        const sol = f.plataformas;
        const dentro = (x: number, y: number) => sol.some((r) => x > r.x + 0.02 && x < r.x + r.w - 0.02 && y > r.y + 0.02 && y < r.y + r.h - 0.02);
        for (const p of f.estrelinhas ?? []) expect(dentro(p.x, p.y), `estrelinha ${p.x},${p.y}`).toBe(false);
        for (const l of f.lanternas ?? []) expect(sol.some((r) => pontoDentro(r, l.x, l.y - 0.05)), `lanterna em ${l.x}`).toBe(true);
        for (const n of f.inimigos ?? []) {
          const m = INIMIGO[n.tipo];
          const cx = { x: n.x - m.w / 2 + 0.02, y: n.y + 0.02, w: m.w - 0.04, h: m.h - 0.04 };
          expect(sol.some((r) => sobrepoe(cx, r)), `${n.tipo} em ${n.x} dentro de parede`).toBe(false);
          if (n.tipo !== 'morcego') expect(sol.some((r) => pontoDentro(r, n.x, n.y - 0.05)), `${n.tipo} em ${n.x} sem chão`).toBe(true);
        }
        for (const p of f.placas) expect(sol.some((r) => pontoDentro(r, p.x + p.w / 2, p.y - 0.05)), `placa ${p.id}`).toBe(true);
        for (const p of f.placas) expect(f.portas.some((d) => d.id === p.abre), `placa ${p.id} abre porta que existe`).toBe(true);
        for (const d of f.portas) expect(f.placas.some((p) => p.abre === d.id), `porta ${d.id} tem placa`).toBe(true);
        expect(sol.some((r) => pontoDentro(r, f.portal.x + f.portal.w / 2, f.portal.y - 0.05)), 'pedaço da estrela em cima de chão').toBe(true);
      });

      it('a simulação roda a fase vazia sem erro e o instantâneo de rede vai e volta', () => {
        const e = estadoInicial(f);
        for (let t = 0; t < 60; t++) passo(f, e, [NEUTRO, NEUTRO]);
        expect(e.jogadores.every((j) => j.noChao), 'os dois começam em pé no chão').toBe(true);
        for (let t = 0; t < 540; t++) passo(f, e, [NEUTRO, NEUTRO]);
        expect(e.jogadores.every((j) => Number.isFinite(j.x + j.y) && j.y > f.fundo)).toBe(true);
        const s = JSON.parse(JSON.stringify(instantaneo(f, e, [])));
        const r = restaurar(f, s);
        expect(r.inimigos.length).toBe(e.inimigos.length);
        expect(r.especiais.length).toBe(e.especiais.length);
      });
    });
  }
});

// ---------- alcançabilidade ----------
const grafos = new Map<string, Grafo>();
const grafoDe = (f: Fase) => { let g = grafos.get(f.id); if (!g) grafos.set(f.id, (g = montarGrafo(f))); return g; };
const analise = new Map<string, ReturnType<typeof pares>>();
const analisar = (f: Fase) => {
  let r = analise.get(f.id);
  if (!r) {
    const g = grafoDe(f);
    r = pares(g, [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])], nosQueTocam(g, f.portal));
    analise.set(f.id, r);
  }
  return r;
};

describe('fases dos capítulos: alcançabilidade por saltos', () => {
  it('o verificador acha poço sem saída, beco e degrau só de mãos dadas (controle)', () => {
    const base = { largura: 60, fundo: -10, inicio: [{ x: 1, y: 0 }, { x: 2, y: 0 }] as [Ponto, Ponto] };
    const ver = (f: Fase) => { const g = montarGrafo(f); return { g, r: pares(g, [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])], nosQueTocam(g, f.portal)) }; };
    // poço de 3 m acima do limite de queda: sozinho não se sai, mas o outro desce, dá o impulso e é puxado: sem armadilha
    const poco = ver(criarFase({ ...base, id: 'poco', plataformas: [chao(-2, 20), chao(20, 23, -3, 6), chao(23, 60)], portal: { x: 50, y: 0, w: 2, h: 2 } }));
    expect(poco.r.chegaAoFim).toBe(true);
    expect(poco.r.presos).toEqual([]);
    expect(alcancaveis(poco.g, [noSob(poco.g, { x: 21.5, y: -3 })], ['solo']).has(noSob(poco.g, { x: 50, y: 0 }))).toBe(false);
    // poço de 5 m: quem cai fica preso (e o par todo)
    const fundo = ver(criarFase({ ...base, id: 'fundo', plataformas: [chao(-2, 20), chao(20, 23, -5, 6), chao(23, 60)], portal: { x: 50, y: 0, w: 2, h: 2 } }));
    const noPoco = noSob(fundo.g, { x: 21.5, y: -5 });
    expect(fundo.r.presos.some(([a, b]) => a === noPoco && b !== noPoco)).toBe(true);
    // beco: um degrau de 6 m não se sobe nem com mãos dadas
    const beco = ver(criarFase({ ...base, id: 'beco', plataformas: [chao(-2, 20), chao(20, 60, 6)], portal: { x: 50, y: 6, w: 2, h: 2 } }));
    expect(beco.r.chegaAoFim).toBe(false);
    // 3,4 m sobe com mãos dadas (e o de cima puxa o outro), sozinho não
    const degrau = ver(criarFase({ ...base, id: 'degrau', plataformas: [chao(-2, 20), chao(20, 60, 3.4)], portal: { x: 50, y: 3.4, w: 2, h: 2 } }));
    expect(degrau.r.chegaAoFim).toBe(true);
    expect(degrau.r.presos).toEqual([]);
    expect(alcancaveis(degrau.g, [noSob(degrau.g, { x: 1, y: 0 })], ['solo']).has(noSob(degrau.g, { x: 50, y: 3.4 }))).toBe(false);
    // porta com placa só do lado de cá: quem passou fica preso do outro lado se o outro não vier
    const porta = ver(criarFase({ ...base, id: 'porta', plataformas: [chao(-2, 60), { x: 19.6, y: 3.2, w: 1.3, h: 5 }], placas: [{ id: 'p', x: 10, y: 0, w: 1.4, h: 0.15, abre: 'd' }],
      portas: [{ id: 'd', x: 20, y: 0, w: 0.5, h: 3.2 }, ], portal: { x: 50, y: 0, w: 2, h: 2 } }));
    expect(porta.r.chegaAoFim).toBe(false); // o segundo nunca passa
  });

  for (const f of CAPITULOS) {
    describe(`${f.capitulo}. ${f.nome}`, () => {
      it('os dois chegam juntos ao pedaço da estrela e nenhum par de posições fica sem saída', () => {
        const g = grafoDe(f);
        const r = analisar(f);
        expect(r.chegaAoFim, 'pedaço da estrela alcançável pelos dois').toBe(true);
        const amostra = r.presos.slice(0, 6).map(([a, b]) => `Natan ${descreverNo(g, a)} | Bruna ${descreverNo(g, b)}`);
        expect(amostra, `${r.presos.length} de ${r.alcancados} pares sem saída`).toEqual([]);
      });

      it('sozinho não se vence: há momentos em que um precisa do outro', () => {
        const g = grafoDe(f);
        const solo = alcancaveis(g, [noSob(g, f.inicio[0])], ['solo']);
        expect(nosQueTocam(g, f.portal).some((n) => solo.has(n))).toBe(false);
        const tipos = new Set(g.lig.flat().map((l) => (l.tipo === 'porta' ? `porta` : l.tipo)));
        expect([...tipos].filter((t) => t !== 'solo').length, 'tipos de ajuda na fase').toBeGreaterThan(0);
      });

      it('voltar a qualquer lanterna (os dois viraram bolha) nunca prende: dali ainda se chega ao fim', () => {
        const g = grafoDe(f);
        const fim = nosQueTocam(g, f.portal);
        for (const l of f.lanternas ?? []) {
          const r = pares(g, [noSob(g, { x: l.x - 0.5, y: l.y + 0.05 }), noSob(g, { x: l.x + 0.5, y: l.y + 0.05 })], fim);
          expect(r.chegaAoFim, `lanterna em ${l.x}`).toBe(true);
          expect(r.presos.length, `lanterna em ${l.x}: pares sem saída`).toBe(0);
        }
      });

      it('todas as estrelinhas, lanternas e placas estão ao alcance', () => {
        const g = grafoDe(f);
        const { nosAlcancados } = analisar(f);
        const pegas = new Set<number>();
        for (const id of nosAlcancados) { for (const k of g.estrelas[id]) pegas.add(k); for (const k of g.estrelasSuper[id]) pegas.add(k); }
        const faltam = (f.estrelinhas ?? []).map((p, k) => (pegas.has(k) ? null : `${p.x},${p.y}`)).filter(Boolean);
        expect(faltam, 'estrelinhas fora de alcance').toEqual([]);
        for (const l of f.lanternas ?? []) expect(nosAlcancados.has(noSob(g, l)), `lanterna em ${l.x}`).toBe(true);
        for (const p of f.placas) expect(nosQueTocam(g, { ...p, y: p.y - 0.05, h: p.h + 0.1 }).some((n) => nosAlcancados.has(n)), `placa ${p.id}`).toBe(true);
      });
    });
  }
});

// ---------- vitória com bots ----------
/** Tick em que cada plano conclui, travado (L2a: as manobras saíram de test/fases/bot.ts para
 *  src/core/companheiro/manobras.ts sem mudar nada; medido com tools/revisao/l2a/planos_ticks.ts). Mudou a física,
 *  uma fase ou uma manobra de propósito? Rode a ferramenta e atualize aqui, citando o motivo no commit.
 *  L4: o Lança-Estrelas virou o arsenal (Estilingue com mira assistida e 3 pedrinhas, Espada, Martelo) e os bots
 *  usam o `autoAtaque`; o cap. 1 ganhou o bloco rachado em x 100. Mudaram os caps. 1 (4008 → 4011), 2 (4201 → 4187),
 *  5 (4394 → 4379) e 7 (5343 → 5630, o Rei com 3 pedrinhas que voltam em vez do tiro contínuo). */
const TICK_PLANO: Record<string, number> = {
  'cap1-brinquedos': 4011, 'cap2-floresta': 4187, 'cap3-relogio': 7356, 'cap4-oceano': 5589,
  'cap5-doces': 4379, 'cap6-espelhos': 3227, 'cap7-cosmos': 5630,
};
describe('fases dos capítulos: dois bots cooperativos vencem', () => {
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}`, () => {
      const plano = PLANOS[f.id];
      expect(plano, 'plano dos bots').toBeDefined();
      let presoDentro = 0;
      // T15 (R20): nenhum passo move o corpo mais que |vx·dt| + 0,35 m na horizontal (fora quedas, bolha e renascer)
      let ant: { x: number; vx: number }[] | null = null, teleporte = 0, ondeTeleporte = '';
      const r = jogar(f, plano, {
        limite: 420,
        cada: (e) => {
          // ninguém atravessa parede
          const sol = solidos(f, e);
          for (const j of e.jogadores) if (!j.bolha && sol.some((s) => sobrepoe({ x: j.x - 0.29, y: j.y + 0.02, w: 0.58, h: 1.0 }, s))) presoDentro++;
          if (ant) e.jogadores.forEach((j, i) => {
            if (j.bolha || e.eventos.some((ev) => ev === `caiu:${i}` || ev === `renasce:${i}` || ev === 'volta-checkpoint')) return;
            const extra = Math.abs(j.x - ant![i].x) - Math.max(Math.abs(ant![i].vx), Math.abs(j.vx)) * DT;
            if (extra > teleporte) { teleporte = extra; ondeTeleporte = `jogador ${i} ${ant![i].x.toFixed(2)}→${j.x.toFixed(2)} no tick ${e.tick}`; }
          });
          ant = e.jogadores.map((j) => ({ x: j.x, vx: j.vx }));
        },
      });
      console.log(`cap ${f.capitulo}: ${r.concluida ? 'VENCEU' : 'NÃO VENCEU'} em ${r.segundos.toFixed(1)} s; estrelinhas ${r.estrelinhas}/${(f.estrelinhas ?? []).length}+soltas; ` +
        `bichinhos ${r.derrotados}/${(f.inimigos ?? []).length}; quedas ${r.quedas}; danos ${r.danos}; bolhas ${r.bolhas}${r.erro ? `; ${r.erro}` : ''}`);
      expect(r.erro).toBeUndefined();
      expect(r.concluida).toBe(true);
      expect(r.voltas, 'os dois viraram bolha').toBe(0);
      expect(r.e.tick, 'tick de conclusão (TICK_PLANO)').toBe(TICK_PLANO[f.id]);
      expect(presoDentro, 'ticks com alguém dentro de parede').toBe(0);
      expect(teleporte, `T15: maior salto além de |vx·dt| (${ondeTeleporte})`).toBeLessThanOrEqual(T15_EXTRA);
      // os bots não erram e não exploram: um casal de verdade leva de 2 a 3 vezes mais (2–4 minutos)
      expect(r.segundos).toBeGreaterThan(45);
      expect(r.segundos).toBeLessThan(150);
    });
  }
});

// ---------- entradas aleatórias: nada quebra ----------
describe('fases dos capítulos: entradas aleatórias não quebram a simulação', () => {
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}`, () => {
      let semente = 12345 + f.capitulo;
      const sorteio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
      const e = estadoInicial(f);
      const ents: [Input, Input] = [{ ...NEUTRO }, { ...NEUTRO }];
      for (let t = 0; t < 60 * 90; t++) {
        if (t % 12 === 0) for (const inp of ents) {
          inp.x = sorteio() < 0.7 ? 1 : sorteio() < 0.5 ? -1 : 0; inp.y = sorteio() < 0.3 ? 1 : 0;
          inp.jump = sorteio() < 0.5; inp.act = sorteio() < 0.25; inp.shoot = sorteio() < 0.5;
        }
        passo(f, e, ents);
        for (const j of e.jogadores) {
          expect(Number.isFinite(j.x) && Number.isFinite(j.y)).toBe(true);
          expect(j.x).toBeGreaterThanOrEqual(0); expect(j.x).toBeLessThanOrEqual(f.largura);
          expect(j.y).toBeGreaterThan(f.fundo - 1);
        }
      }
    });
  }
});
