// T14 · mapa de apoio em dia (R59): o capN.json gravado é exatamente o que o gerador monta hoje (fase, física e
// colisão), o hashFase confere, todo PontoCoop cobre uma ligação de ajuda e toda ligação de ajuda do caminho mínimo
// tem PontoCoop (o companheiro ajuda e o inverso). Falhou? `npm run apoio` e revise as anotações (campo `apoio`).
import { describe, expect, it } from 'vitest';
import { codificarMapa, hashFase, lerMapa, type MapaApoioJson } from '../src/core/companheiro/apoio';
import { carregarApoio } from '../src/core/fases/apoio/index';
import { CAPITULOS, CAP6_ESPELHOS } from '../src/core/fases/index';
import { montarGrafo, type Grafo } from './fases/alcance';
import { ajudasDoCaminho, conferirApoio, montarMapaApoio } from './fases/apoio';

const gravados = import.meta.glob<string>('../src/core/fases/apoio/cap*.json', { query: '?raw', import: 'default', eager: true });
const grafos = new Map<string, Grafo>();
const grafoDe = (f: (typeof CAPITULOS)[number]) => { let g = grafos.get(f.id); if (!g) grafos.set(f.id, (g = montarGrafo(f))); return g; };

describe('T14 · mapa de apoio em dia', () => {
  for (const f of CAPITULOS) {
    describe(`${f.capitulo}. ${f.nome}`, () => {
      const texto = gravados[`../src/core/fases/apoio/cap${f.capitulo}.json`];
      it('o capN.json existe, tem o hashFase de hoje e é idêntico ao que o gerador monta agora', () => {
        expect(texto, `src/core/fases/apoio/cap${f.capitulo}.json`).toBeDefined();
        const j = JSON.parse(texto) as MapaApoioJson;
        expect(j.hashFase, 'hashFase (a fase mudou? npm run apoio)').toBe(hashFase(f));
        expect(texto.trim() === JSON.stringify(codificarMapa(montarMapaApoio(f, grafoDe(f)).mapa)), 'mapa gravado ≠ mapa gerado hoje (npm run apoio)').toBe(true);
      });

      it('todo PontoCoop cobre uma ligação de ajuda; toda ajuda do caminho mínimo tem PontoCoop; anotações casam', () => {
        const mapa = lerMapa(JSON.parse(texto) as MapaApoioJson);
        expect(conferirApoio(f, mapa, grafoDe(f))).toEqual([]);
        const caminho = mapa.coop.filter((p) => p.origem === 'caminho');
        expect(caminho.length, 'ajudas inevitáveis (ARQUITETURA_MODOS §2.1: 4–8)').toBeGreaterThanOrEqual(4);
        expect(caminho.length).toBeLessThanOrEqual(8);
        expect(new Set(mapa.coop.map((p) => p.id)).size, 'ids únicos').toBe(mapa.coop.length);
        for (const p of caminho) expect(p.id.startsWith(`cap${f.capitulo}:`) && p.id !== `cap${f.capitulo}:${p.tipo}-${caminho.indexOf(p) + 1}`, `${p.id}: id anotado à mão`).toBe(true);
      });
    });
  }

  it('carregarApoio devolve o mapa decodificado (o que o companheiro vai usar)', async () => {
    const m = await carregarApoio(1);
    expect(m?.fase).toBe('cap1-brinquedos');
    expect(m!.nos.length).toBe(m!.lig.length);
    expect(m!.lig.flat().every((l) => l.para >= 0 && l.para < m!.nos.length && !!l.manobra)).toBe(true);
    expect(await carregarApoio(99)).toBeNull();
  });

  it('controle: o T14 reprova fase mudada, PontoCoop no lugar errado e ajuda sem PontoCoop', () => {
    const f = CAPITULOS[0], g = grafoDe(f);
    const mapa = lerMapa(JSON.parse(gravados['../src/core/fases/apoio/cap1.json']) as MapaApoioJson);
    // fase mudada (placa 1 m para o lado) sem regenerar
    const mudada = { ...f, placas: f.placas.map((p, k) => (k === 0 ? { ...p, x: p.x + 1 } : p)) };
    expect(conferirApoio(mudada, mapa, g).filter((e) => e.includes('hashFase')).length, 'hash').toBe(1);
    // companheiro "na placa" fora do nó dela
    const torto = { ...mapa, coop: mapa.coop.map((p, k) => (k === 0 ? { ...p, papel: { ...p.papel, x: p.papel.x + 30 } } : p)) };
    expect(conferirApoio(f, torto, g), 'papel').toContainEqual(expect.stringContaining('fora do nó'));
    // um ponto do caminho apagado
    const sem = { ...mapa, coop: mapa.coop.filter((p) => p.id !== 'cap1:caixa-impulso') };
    expect(conferirApoio(f, sem, g), 'sem ponto').toContainEqual(expect.stringContaining('sem PontoCoop'));
  });
});

describe('cap. 6 sem a ligação falsa do teleporte (R20)', () => {
  it('o caminho mínimo são as 4 portas espelhadas e o muro de mãos dadas; nenhuma ligação pula o 1º trecho', () => {
    const g = grafoDe(CAP6_ESPELHOS);
    const { ajudas } = ajudasDoCaminho(g);
    const portas = ajudas.filter((a) => a.l.tipo === 'porta').map((a) => a.l.porta).sort();
    expect(portas).toEqual(['porta-baixo-1', 'porta-baixo-2', 'porta-cima-1', 'porta-cima-2']);
    expect(ajudas.filter((a) => a.l.tipo === 'super').every((a) => g.nos[a.de].x1 > 140 && g.nos[a.para].x0 > 140), 'mãos dadas só no muro (x 146–154)').toBe(true);
    // antes: superpulo da sala de entrada (x ≤ 31) direto para o corredor depois das portas (x ≥ 44)
    const falsas = g.lig.flatMap((ls, de) => ls.filter((l) => l.tipo !== 'porta' && g.nos[de].x1 <= 31.5 && g.nos[l.para].x0 >= 44).map((l) => `${de}→${l.para} ${l.tipo}`));
    expect(falsas).toEqual([]);
  });
});
