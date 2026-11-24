// Salvamento v2 (L2b): retomar na lanterna (T8), fusão sem perda (T9), migração do v1 (T10), slots e a chave do
// treino separada (T12, a parte sem navegador). ARQUITETURA_MODOS §5 e §11.
import { describe, expect, it } from 'vitest';
import { CAPITULOS } from '../src/core/fases/index';
import { pontoCheckpoint } from '../src/core/sim';
import {
  bitsDe, carregarSalvo, CHAVE_SALVO, CHAVE_TREINO, CHAVE_V1, comCampanha, fundir, gravarTreino, indicesDe, limparCampanha,
  limparResumo, migrarV1, novaCampanha, registrarConclusao, registrarRetomada, resumir, retomar, vista,
  type Campanha, type Progresso, type ResumoLanterna,
} from '../src/ui/salvo';
import { jogar, type Etapa } from './fases/bot';
import { PLANOS } from './fases/planos';

// as consultas do v1 (as de src/ui/progresso.ts antes do L2b), para comparar a migração
const v1 = {
  liberado: (p: Progresso, n: number) => n === 1 || !!p.capitulos[n - 1],
  pedacos: (p: Progresso) => Object.keys(p.capitulos).length,
  estrelinhasTotais: (p: Progresso) => Object.values(p.capitulos).reduce((s, c) => s + c.estrelinhas, 0),
};

class Memoria { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

describe('bitset das estrelinhas e dos bichinhos', () => {
  it('ida e volta, forma única, fora da faixa some', () => {
    const ix = [0, 5, 6, 7, 45, 46, 100];
    expect(indicesDe(bitsDe(ix))).toEqual(ix);
    expect(bitsDe([7, 0, 7])).toBe(bitsDe([0, 7]));
    expect(bitsDe([])).toBe('');
    expect(bitsDe([-1, 1.5, 5000])).toBe('');
    expect(bitsDe(Array.from({ length: 46 }, (_, i) => i)).length).toBe(8); // ≤ 46 estrelinhas = 8 caracteres
  });
});

describe('T8: salvar na lanterna e retomar (os 7 capítulos)', () => {
  // Joga o plano dos bots; a cada lanterna acesa grava o resumo (como a partida faz em aoLanterna), passa por JSON
  // e limparResumo (como o localStorage), recria o estado só com ele e continua o plano da etapa em andamento.
  const resultados: { cap: number; lanterna: number; ok: boolean; bytes: number }[] = [];
  for (const f of CAPITULOS) {
    it(`cap. ${f.capitulo}: toda lanterna retoma e chega ao pedaço da estrela`, () => {
      let atual = 0;
      const plano = PLANOS[f.id];
      const marcado: Etapa[] = plano.map((et, k) => ({ ...et, p: [[{ nome: 'marca', fn: () => { atual = k; return null; } }, ...et.p[0]], et.p[1]] }));
      const saves: { r: ResumoLanterna; etapa: number; coletadas: number[]; mortos: number[] }[] = [];
      let cp = -1, c = novaCampanha('AAAAAAAAAAAAAAAA', 1);
      jogar(f, marcado, { cada: (e) => {
        if (e.checkpoint !== cp) {
          cp = e.checkpoint;
          c = registrarRetomada(c, resumir(f.capitulo, e), 1000 + e.tick);
          const r = limparResumo(JSON.parse(JSON.stringify(c.retomada)))!;
          saves.push({ r, etapa: atual, coletadas: [...e.coletadas].sort((a, b) => a - b), mortos: e.inimigos.flatMap((n, k) => (n.vivo ? [] : [k])) });
        }
      } });
      expect(saves.length).toBe(f.lanternas?.length ?? 0);
      for (const s of saves) {
        const e0 = retomar(f, s.r);
        // mesma lanterna, mesmas estrelinhas, mesmos bichinhos derrotados, os dois na lanterna
        expect(e0.checkpoint).toBe(s.r.lanterna);
        expect([...e0.coletadas].sort((a, b) => a - b)).toEqual(s.coletadas);
        expect(e0.inimigos.flatMap((n, k) => (n.vivo ? [] : [k]))).toEqual(s.mortos);
        for (const i of [0, 1] as const) expect(e0.jogadores[i].x).toBeCloseTo(pontoCheckpoint(f, e0, i).x, 6);
        let ok = false;
        for (const k of [s.etapa, s.etapa + 1]) if (jogar(f, plano.slice(k), { e: retomar(f, s.r) }).concluida) { ok = true; break; }
        resultados.push({ cap: f.capitulo, lanterna: s.r.lanterna, ok, bytes: JSON.stringify(s.r).length });
        expect(ok, `cap. ${f.capitulo}, lanterna ${s.r.lanterna}`).toBe(true);
      }
    }, 120000);
  }
  it('37/37 e o resumo cabe em ≈ 200 B', () => {
    expect(resultados.length).toBe(CAPITULOS.reduce((s, f) => s + (f.lanternas?.length ?? 0), 0));
    expect(resultados.length).toBe(37);
    expect(resultados.filter((r) => r.ok).length).toBe(37);
    expect(Math.max(...resultados.map((r) => r.bytes))).toBeLessThan(260);
  });
});

// gerador com semente (sem Math.random: o teste se repete igual)
function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function campanhaAleatoria(r: () => number, id: string): Campanha {
  const int = (n: number) => Math.floor(r() * n);
  const lista = (n: number, max: number) => Array.from({ length: int(n) }, () => int(max));
  const c = novaCampanha(id, 1000 + int(1000));
  c.salvoEm = c.criadaEm + int(5000); c.rev = int(50); c.nome = r() < 0.5 ? 'Nossa jornada' : 'Natan & Bruna';
  c.prologoVisto = r() < 0.5; c.finalVisto = r() < 0.2;
  for (let n = 1; n <= 7; n++) {
    if (r() < 0.4) continue;
    c.capitulos[n] = { concluido: r() < 0.6, fuga: n === 7 && r() < 0.5, pegas: bitsDe(lista(30, 46)), melhorPassada: int(60), total: 40 + int(20), baus: bitsDe(lista(4, 8)) };
  }
  c.desbloqueios = { armas: int(1 << 16), lembrancas: int(128), segredos: bitsDe(lista(5, 21)) };
  if (r() < 0.6) {
    const rev = int(60);
    c.retomada = { v: 1, cap: 1 + int(7), lanterna: int(6) - 1, tick: int(20000), coletadas: [...new Set(lista(20, 46))].sort((a, b) => a - b),
      est: [int(30), int(30)], casal: int(60), derrotados: bitsDe(lista(6, 12)), rev, salvoEm: 2000 + int(3000) };
  } else c.fimRetomada = int(60);
  return limparCampanha(JSON.parse(JSON.stringify(c)))!;
}

describe('T9: fusão do salvo do casal', () => {
  it('500 pares: comutativa, idempotente, associativa e nada some', () => {
    const r = sorteio(20261124);
    for (let k = 0; k < 500; k++) {
      const a = campanhaAleatoria(r, 'CasalNatanBruna1'), b = campanhaAleatoria(r, 'CasalNatanBruna1'), c = campanhaAleatoria(r, 'CasalNatanBruna1');
      const ab = fundir(a, b);
      expect(JSON.stringify(ab)).toBe(JSON.stringify(fundir(b, a)));
      expect(JSON.stringify(fundir(a, a))).toBe(JSON.stringify(a));
      expect(JSON.stringify(fundir(ab, ab))).toBe(JSON.stringify(ab));
      expect(JSON.stringify(fundir(fundir(a, b), c))).toBe(JSON.stringify(fundir(a, fundir(b, c))));
      expect(JSON.stringify(fundir(ab, a))).toBe(JSON.stringify(ab)); // absorve
      // a fusão é o que a validação devolveria (forma normal)
      expect(JSON.stringify(limparCampanha(JSON.parse(JSON.stringify(ab))))).toBe(JSON.stringify(ab));
      for (const x of [a, b]) {
        expect(ab.prologoVisto || !x.prologoVisto).toBe(true);
        expect(ab.finalVisto || !x.finalVisto).toBe(true);
        expect(ab.rev).toBeGreaterThanOrEqual(x.rev);
        expect(ab.desbloqueios.armas & x.desbloqueios.armas).toBe(x.desbloqueios.armas);
        for (const s of indicesDe(x.desbloqueios.segredos)) expect(indicesDe(ab.desbloqueios.segredos)).toContain(s);
        for (const [n, p] of Object.entries(x.capitulos)) {
          const q = ab.capitulos[Number(n)];
          expect(q).toBeDefined();
          if (p.concluido) expect(q.concluido).toBe(true);
          if (p.fuga) expect(q.fuga).toBe(true);
          expect(q.melhorPassada).toBeGreaterThanOrEqual(p.melhorPassada);
          expect(q.total).toBeGreaterThanOrEqual(p.total);
          const pq = indicesDe(q.pegas);
          for (const i of indicesDe(p.pegas)) expect(pq).toContain(i);
          for (const i of indicesDe(p.baus)) expect(indicesDe(q.baus)).toContain(i);
        }
      }
      // a retomada é a mais nova (rev); uma conclusão (fimRetomada) mais nova apaga a velha
      const kr = (x: Campanha) => (x.retomada ? x.retomada.rev : x.fimRetomada);
      expect(ab.retomada ? ab.retomada.rev : ab.fimRetomada).toBe(Math.max(kr(a), kr(b)));
    }
  });

  it('concluir apaga a retomada do capítulo e a fusão com o aparelho atrasado não a traz de volta', () => {
    const f = CAPITULOS[0];
    let c = novaCampanha('CasalNatanBruna1', 1);
    const meio = jogar(f, PLANOS[f.id].slice(0, 3)).e;
    c = registrarRetomada(c, resumir(1, meio), 10);
    const atrasado = c; // o outro aparelho ficou com esta cópia
    const fim = registrarConclusao(c, 1, { estrelinhas: 30, total: 40, coletadas: meio.coletadas }, 20);
    expect(fim.retomada).toBeUndefined();
    expect(fim.capitulos[1].concluido).toBe(true);
    expect(fundir(fim, atrasado).retomada).toBeUndefined();
    expect(fundir(atrasado, fim).retomada).toBeUndefined();
    // e uma retomada nova, depois da conclusão, vence
    const nova = registrarRetomada(fim, resumir(2, meio), 30);
    expect(fundir(nova, atrasado).retomada?.cap).toBe(2);
  });

  it('a melhor passada é o máximo e as estrelinhas pegas a união (as estrelas grandes não perdem nada)', () => {
    let a = novaCampanha('CasalNatanBruna1', 1), b = a;
    a = registrarConclusao(a, 2, { estrelinhas: 20, total: 40, coletadas: [0, 1, 2] });
    b = registrarConclusao(b, 2, { estrelinhas: 12, total: 40, coletadas: [2, 3, 9] });
    const ab = fundir(a, b);
    expect(ab.capitulos[2].melhorPassada).toBe(20);
    expect(indicesDe(ab.capitulos[2].pegas)).toEqual([0, 1, 2, 3, 9]);
  });

  it('cap. 7: a fuga deixa a Arena pendente; a vitória conclui (vista igual à do v1: arena7)', () => {
    let c = novaCampanha('CasalNatanBruna1', 1);
    c = registrarConclusao(c, 7, { estrelinhas: 31, total: 50, fuga: true });
    expect(vista(c).capitulos[7]).toBeUndefined();
    expect(vista(c).arena7).toEqual({ estrelinhas: 31, total: 50 });
    c = registrarConclusao(c, 7, { estrelinhas: 31, total: 50 });
    expect(vista(c).capitulos[7]).toEqual({ estrelinhas: 31, total: 50 });
    expect(vista(c).arena7).toBeUndefined();
  });
});

describe('T10: migração do edm-progresso-v1', () => {
  const formas: Record<string, unknown> = {
    vazio: { v: 1, prologoVisto: false, capitulos: {}, finalVisto: false },
    tres: { v: 1, prologoVisto: true, capitulos: { 1: { estrelinhas: 30, total: 41 }, 2: { estrelinhas: 22, total: 37 }, 3: { estrelinhas: 40, total: 52 } }, finalVisto: false },
    soArena7: { v: 1, prologoVisto: true, capitulos: { 1: { estrelinhas: 1, total: 41 }, 2: { estrelinhas: 2, total: 37 }, 3: { estrelinhas: 3, total: 52 }, 4: { estrelinhas: 4, total: 40 }, 5: { estrelinhas: 5, total: 48 }, 6: { estrelinhas: 6, total: 44 } }, finalVisto: false, arena7: { estrelinhas: 33, total: 51 } },
    completo: { v: 1, prologoVisto: true, capitulos: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, { estrelinhas: 10 * n, total: 50 + n }])), finalVisto: true },
    lixo: { v: 9, capitulos: 'x', prologoVisto: 'sim' },
  };
  for (const [nome, x] of Object.entries(formas)) {
    it(`${nome}: liberado, pedaços, estrelinhas e Arena pendente iguais`, () => {
      const antes = x as Progresso;
      const valido = (x as { v?: number }).v === 1;
      const c = migrarV1(JSON.parse(JSON.stringify(x)), 'MigradoDoV1aaaaa', 5);
      const p = vista(c);
      for (let n = 1; n <= 7; n++) expect(v1.liberado(p, n)).toBe(valido ? v1.liberado(antes, n) : n === 1);
      expect(v1.pedacos(p)).toBe(valido ? v1.pedacos(antes) : 0);
      expect(v1.estrelinhasTotais(p)).toBe(valido ? v1.estrelinhasTotais(antes) : 0);
      expect(p.arena7).toEqual(valido ? antes.arena7 : undefined);
      expect(p.prologoVisto).toBe(valido && antes.prologoVisto);
      expect(p.finalVisto).toBe(valido && antes.finalVisto);
      expect(limparCampanha(JSON.parse(JSON.stringify(c)))).toEqual(c);
    });
  }

  it('na primeira abertura: migra, grava o v2 e não apaga o v1; na segunda, lê o v2 (mesmo id)', () => {
    const m = new Memoria();
    m.setItem(CHAVE_V1, JSON.stringify(formas.tres));
    const a = carregarSalvo(m);
    expect(a.migrou).toBe(true);
    expect(m.getItem(CHAVE_V1)).toBe(JSON.stringify(formas.tres));
    const b = carregarSalvo(m);
    expect(b.migrou).toBe(false);
    expect(b.salvo.ativo).toBe(a.salvo.ativo);
    expect(vista(b.salvo.slots[0]).capitulos[3]).toEqual({ estrelinhas: 40, total: 52 });
  });

  it('sem nada: campanha nova só na memória (nada gravado até a primeira gravação)', () => {
    const m = new Memoria();
    const a = carregarSalvo(m);
    expect(a.salvo.slots.length).toBe(1);
    expect(m.getItem(CHAVE_SALVO)).toBeNull();
  });
});

describe('slots e chaves', () => {
  it('no máximo 3 slots; o ativo nunca sai; o mesmo id substitui', () => {
    let s = { v: 2 as const, ativo: 'Slot000000000000', slots: [novaCampanha('Slot000000000000', 1)] };
    for (let k = 1; k <= 4; k++) s = comCampanha(s, novaCampanha(`Slot00000000000${k}`, 1 + k), false);
    expect(s.slots.length).toBe(3);
    expect(s.slots.some((c) => c.id === 'Slot000000000000')).toBe(true);
    const mudada = registrarConclusao(s.slots[0], 1, { estrelinhas: 3, total: 9 });
    s = comCampanha(s, mudada);
    expect(s.slots.length).toBe(3);
    expect(s.slots.filter((c) => c.id === mudada.id).length).toBe(1);
  });

  it('o treino grava só a chave dele', () => {
    const m = new Memoria();
    gravarTreino({ v: 1, eu: 1, visitas: 2 }, m);
    expect([...m.m.keys()]).toEqual([CHAVE_TREINO]);
  });

  it('limparCampanha recusa o que não é campanha v2', () => {
    expect(limparCampanha(null)).toBeNull();
    expect(limparCampanha({ v: 2, id: 'curto' })).toBeNull();
    expect(limparCampanha({ v: 1, id: 'AAAAAAAAAAAAAAAA' })).toBeNull();
    const c = limparCampanha({ v: 2, id: 'AAAAAAAAAAAAAAAA', capitulos: { 1: { concluido: 'sim', melhorPassada: -5, pegas: '!!' }, 9: { concluido: true } } })!;
    expect(c.capitulos[1]).toEqual({ concluido: false, fuga: false, pegas: '', melhorPassada: 0, total: 0, baus: '' });
    expect(c.capitulos[9]).toBeUndefined();
  });
});
