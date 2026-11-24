// Fases dos 7 capítulos: dados bem formados, alcançabilidade por saltos (ninguém fica preso sem saída) e
// vitória de verdade com dois bots cooperativos roteirizados rodando a simulação inteira, do início ao pedaço da estrela.
import { describe, expect, it } from 'vitest';
import { CAPITULOS } from '../src/core/fases/index';
import { estadoInicial, passo, solidos } from '../src/core/sim';
import { INIMIGO } from '../src/core/inimigos';
import { pontoDentro, sobrepoe } from '../src/core/colisao';
import { instantaneo, restaurar } from '../src/core/instantaneo';
import type { Fase, Input, Ponto } from '../src/core/types';
import { criarFase, FASES } from '../src/core/fases';
import { chao } from '../src/core/fases/comum';
import { alcancaveis, chegamA, montarGrafo, noSob, nosQueTocam, type Grafo } from './fases/alcance';
import { jogar, NEUTRO } from './fases/bot';
import { PLANOS } from './fases/planos';

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
          const cx = { x: n.x - m.w / 2, y: n.y, w: m.w, h: m.h };
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
        for (let t = 0; t < 600; t++) passo(f, e, [NEUTRO, NEUTRO]);
        expect(e.jogadores.every((j) => j.noChao)).toBe(true);
        const s = JSON.parse(JSON.stringify(instantaneo(f, e, [])));
        const r = restaurar(f, s);
        expect(r.inimigos.length).toBe(e.inimigos.length);
        expect(r.especiais.length).toBe(e.especiais.length);
      });
    });
  }
});

// ---------- alcançabilidade ----------
const grafos = new Map<string, { coop: Grafo; solo: Grafo }>();
const grafosDe = (f: Fase) => {
  let g = grafos.get(f.id);
  if (!g) { g = { coop: montarGrafo(f, { portasFechadas: false, coop: true }), solo: montarGrafo(f, { portasFechadas: true, coop: false }) }; grafos.set(f.id, g); }
  return g;
};
const desc = (g: Grafo, id: number) => { const n = g.nos[id]; return `${n.tipo} y=${n.y.toFixed(2)} x=${n.x0.toFixed(1)}…${n.x1.toFixed(1)}`; };

describe('fases dos capítulos: alcançabilidade por saltos', () => {
  it('o verificador acha poço sem saída, beco e porta que prende (controle)', () => {
    const base = { id: 'armadilha', largura: 60, fundo: -10, inicio: [{ x: 1, y: 0 }, { x: 2, y: 0 }] as [Ponto, Ponto] };
    // poço de 3 m de fundo acima do limite de queda: quem cai não sai sozinho
    const poco = criarFase({ ...base, plataformas: [chao(-2, 20), chao(20, 23, -3), chao(23, 60)], lanternas: [{ x: 10, y: 0 }], portal: { x: 50, y: 0, w: 2, h: 2 } });
    const gp = { coop: montarGrafo(poco, { portasFechadas: false, coop: true }), solo: montarGrafo(poco, { portasFechadas: true, coop: false }) };
    const fundoPoco = noSob(gp.solo, { x: 21.5, y: -3 });
    const voltam = chegamA(gp.solo, [noSob(gp.solo, { x: 10, y: 0 }), ...nosQueTocam(gp.solo, poco.portal)]);
    expect(voltam.has(fundoPoco)).toBe(false);
    expect(chegamA(gp.coop, nosQueTocam(gp.coop, poco.portal)).has(noSob(gp.coop, { x: 21.5, y: -3 }))).toBe(true); // com ajuda, sai
    // beco: um degrau de 6 m não se sobe nem com mãos dadas
    const beco = criarFase({ ...base, plataformas: [chao(-2, 20), chao(20, 60, 6)], portal: { x: 50, y: 6, w: 2, h: 2 } });
    const gb = montarGrafo(beco, { portasFechadas: false, coop: true });
    expect(alcancaveis(gb, [noSob(gb, { x: 1, y: 0 })]).has(noSob(gb, { x: 50, y: 6 }))).toBe(false);
    // 4 m sobe com mãos dadas (e o de cima puxa o outro), 1,9 m sozinho não
    const degrau = criarFase({ ...base, plataformas: [chao(-2, 20), chao(20, 60, 3.4)], portal: { x: 50, y: 3.4, w: 2, h: 2 } });
    const gd = { coop: montarGrafo(degrau, { portasFechadas: false, coop: true }), solo: montarGrafo(degrau, { portasFechadas: true, coop: false }) };
    expect(alcancaveis(gd.coop, [noSob(gd.coop, { x: 1, y: 0 })]).has(noSob(gd.coop, { x: 50, y: 3.4 }))).toBe(true);
    expect(alcancaveis(gd.solo, [noSob(gd.solo, { x: 1, y: 0 })]).has(noSob(gd.solo, { x: 50, y: 3.4 }))).toBe(false);
  });

  for (const f of CAPITULOS) {
    describe(`${f.capitulo}. ${f.nome}`, () => {
      it('do início se chega ao pedaço da estrela; todo lugar alcançável ainda chega lá (sem beco sem saída)', () => {
        const { coop } = grafosDe(f);
        const ini = f.inicio.map((p) => noSob(coop, p));
        const R = alcancaveis(coop, ini);
        const fim = nosQueTocam(coop, f.portal);
        expect(fim.some((n) => R.has(n)), 'pedaço da estrela alcançável').toBe(true);
        const chega = chegamA(coop, fim);
        const presos = [...R].filter((n) => !chega.has(n)).map((n) => desc(coop, n));
        expect(presos, 'lugares de onde não se chega mais ao fim').toEqual([]);
      });

      it('sozinho e com as portas fechadas, de todo lugar se volta a uma lanterna, placa, início ou fim', () => {
        const { coop, solo } = grafosDe(f);
        const R = alcancaveis(coop, f.inicio.map((p) => noSob(coop, p)));
        const encontros = [
          ...f.inicio.map((p) => noSob(solo, p)),
          ...(f.lanternas ?? []).map((l) => noSob(solo, l)),
          ...f.placas.flatMap((p) => nosQueTocam(solo, { ...p, y: p.y - 0.05, h: p.h + 0.1 })),
          ...nosQueTocam(solo, f.portal),
        ];
        const voltam = chegamA(solo, encontros);
        const presos: string[] = [];
        for (const id of R) {
          const n = coop.nos[id];
          let m: number;
          if (n.tipo === 'fixo') {
            // o mesmo lugar no grafo de portas fechadas (o meio da superfície; se ali houver porta, ignora)
            const meio = (n.x0 + n.x1) / 2;
            if (f.portas.some((d) => meio > d.x - 0.3 && meio < d.x + d.w + 0.3 && n.y >= d.y - 0.01 && n.y < d.y + d.h)) continue;
            m = noSob(solo, { x: meio, y: n.y });
          } else m = solo.nos.findIndex((s) => s.chave === n.chave);
          if (m < 0 || !voltam.has(m)) presos.push(desc(coop, id));
        }
        expect(presos, 'lugares onde um jogador sozinho fica preso').toEqual([]);
      });

      it('todas as estrelinhas, lanternas e placas estão ao alcance', () => {
        const { coop } = grafosDe(f);
        const R = alcancaveis(coop, f.inicio.map((p) => noSob(coop, p)));
        const pegas = new Set<number>();
        for (const id of R) for (const k of coop.estrelas[id]) pegas.add(k);
        const faltam = (f.estrelinhas ?? []).map((p, k) => (pegas.has(k) ? null : `${p.x},${p.y}`)).filter(Boolean);
        expect(faltam, 'estrelinhas fora de alcance').toEqual([]);
        for (const l of f.lanternas ?? []) expect(R.has(noSob(coop, l)), `lanterna em ${l.x}`).toBe(true);
        for (const p of f.placas) expect(nosQueTocam(coop, { ...p, y: p.y - 0.05, h: p.h + 0.1 }).some((n) => R.has(n)), `placa ${p.id}`).toBe(true);
      });
    });
  }
});

// ---------- vitória com bots ----------
describe('fases dos capítulos: dois bots cooperativos vencem', () => {
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}`, () => {
      const plano = PLANOS[f.id];
      expect(plano, 'plano dos bots').toBeDefined();
      let presoDentro = 0;
      const r = jogar(f, plano, {
        limite: 420,
        cada: (e) => {
          // ninguém atravessa parede
          const sol = solidos(f, e);
          for (const j of e.jogadores) if (!j.bolha && sol.some((s) => sobrepoe({ x: j.x - 0.29, y: j.y + 0.02, w: 0.58, h: 1.0 }, s))) presoDentro++;
        },
      });
      console.log(`cap ${f.capitulo}: ${r.concluida ? 'VENCEU' : 'NÃO VENCEU'} em ${r.segundos.toFixed(1)} s; estrelinhas ${r.estrelinhas}/${(f.estrelinhas ?? []).length}+soltas; ` +
        `bichinhos ${r.derrotados}/${(f.inimigos ?? []).length}; quedas ${r.quedas}; danos ${r.danos}; bolhas ${r.bolhas}${r.erro ? `; ${r.erro}` : ''}`);
      expect(r.erro).toBeUndefined();
      expect(r.concluida).toBe(true);
      expect(r.voltas, 'os dois viraram bolha').toBe(0);
      expect(presoDentro, 'ticks com alguém dentro de parede').toBe(0);
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
