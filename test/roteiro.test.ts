// Roteiro de balões e dicas (L8a; NARRATIVA_CASAL §13): dados do roteiro (T-R1, T-R3, T-R4), o diretor rodando com
// a simulação de verdade (bots do cap. 1: ≤ 90 s de balão por passada, C14), momento visto não repete (T-U2), nada
// durante perigo, determinismo (mesma sequência nos dois celulares) e dica na primeira vez de toda mecânica do cap. 1.
import { describe, expect, it } from 'vitest';
import { CAPITULOS } from '../src/core/fases/index';
import { estadoInicial, passo } from '../src/core/sim';
import type { Estado, Fase, Input } from '../src/core/types';
import { MECANICAS, MECANICAS_CAP } from '../src/ui/dicas';
import { Diretor, leitura, MAX_CARACTERES, perigo, textoDe } from '../src/ui/roteiro/diretor';
import { ROTEIROS } from '../src/ui/roteiro';
import type { Fala, Texto } from '../src/ui/roteiro/tipos';
import { jogar, NEUTRO, posicionar } from './fases/bot';
import { PLANOS } from './fases/planos';

const fase = (cap: number) => CAPITULOS[cap - 1] as Fase;
const textos = (f: Fala): string[] => (Array.isArray(f.texto) ? f.texto : [f.texto]).flatMap((t: Texto) => (typeof t === 'string' ? [t] : [t.N, t.B]));

/** roda o plano dos bots com o diretor ouvindo cada passo; devolve o diretor e o relatório */
function passada(cap: number, o: { diretor?: Diretor } = {}) {
  const f = fase(cap);
  const d = o.diretor ?? new Diretor(f, ROTEIROS[cap]);
  const r = jogar(f, PLANOS[f.id], { cada: (e) => d.passo(e, e.eventos) });
  return { d, r };
}

/** fica parado (ou com a entrada dada) por s segundos, com o diretor ouvindo */
function rodar(f: Fase, e: Estado, d: Diretor, s: number, ent: [Input, Input] = [NEUTRO, NEUTRO]) {
  for (let k = 0; k < s * 60; k++) { passo(f, e, ent); d.passo(e, e.eventos); }
}

for (const [cap, roteiro] of Object.entries(ROTEIROS)) {
  const f = fase(Number(cap));
  describe(`roteiro do capítulo ${cap}`, () => {
    it('T-R1: ids únicos, ≤ 48 caracteres, zonas dentro da fase, todo `depois` existe, toda fala tem como sair', () => {
      const ids = roteiro.falas.map((x) => x.id);
      expect(new Set(ids).size, 'ids repetidos').toBe(ids.length);
      const alvo = new Set(roteiro.falas.map((x) => x.depois).filter(Boolean));
      for (const x of roteiro.falas) {
        for (const t of textos(x)) expect([...t].length, `${x.id}: "${t}"`).toBeLessThanOrEqual(MAX_CARACTERES);
        if (x.gatilho?.zona) {
          const [a, b] = x.gatilho.zona;
          expect(a, `${x.id} zona`).toBeGreaterThanOrEqual(0);
          expect(b, `${x.id} zona`).toBeLessThanOrEqual(f.largura);
          expect(a, `${x.id} zona`).toBeLessThan(b);
        }
        if (x.depois) expect(ids, `${x.id}.depois`).toContain(x.depois);
        expect(!!x.gatilho || alvo.has(x.id), `${x.id} sem gatilho e sem ninguém que leve a ela`).toBe(true);
        if (x.mecanica) expect(MECANICAS[x.mecanica], `${x.id}: mecânica ${x.mecanica}`).toBeTruthy();
        if (Array.isArray(x.quem) && Array.isArray(x.texto)) expect(x.quem.length).toBe(x.texto.length);
        // leitura: 1,2 s + 0,06 s por caractere, teto de 4,5 s
        for (const t of textos(x)) expect(leitura(t)).toBeLessThanOrEqual(4.5);
      }
      // nenhum laço de respostas
      for (const x of roteiro.falas) {
        const vistos = new Set<string>();
        for (let y: Fala | undefined = x; y?.depois; y = roteiro.falas.find((z) => z.id === y!.depois)) {
          expect(vistos.has(y.id), `laço a partir de ${x.id}`).toBe(false);
          vistos.add(y.id);
        }
      }
    });

    it('T-R3: equilíbrio de voz — Natan entre 40 % e 60 % das falas nominais do casal', () => {
      let n = 0, b = 0;
      for (const x of roteiro.falas) for (const q of Array.isArray(x.quem) ? x.quem : [x.quem]) { if (q === 'N') n++; if (q === 'B') b++; }
      const parte = n / (n + b);
      expect(parte, `N ${n} × B ${b}`).toBeGreaterThanOrEqual(0.4);
      expect(parte, `N ${n} × B ${b}`).toBeLessThanOrEqual(0.6);
    });

    it('T-R4: nenhum "te amo" no roteiro em texto claro (fica para a carta cifrada)', () => {
      for (const x of roteiro.falas) for (const t of textos(x)) {
        expect(t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(), x.id).not.toMatch(/te\s*amo|amo\s*voce/);
      }
    });

    it('C10: só textos genéricos (nenhum marcador [REAL] nem data no roteiro)', () => {
      for (const x of roteiro.falas) for (const t of textos(x)) {
        expect(t, x.id).not.toMatch(/\[REAL\]|\d{1,2}\/\d{1,2}|\b(19|20)\d\d\b/);
      }
    });
  });
}

describe('diretor com os bots do capítulo 1', () => {
  const { d, r } = passada(1);
  const soma = d.log.reduce((s, b) => s + (b.ate - b.desde) / 60, 0);

  it('a passada termina e os balões somam ≤ 90 s (C14)', () => {
    expect(r.concluida, r.erro).toBe(true);
    console.log(`cap. 1: ${d.log.length} balões, ${soma.toFixed(1)} s de balão em ${r.segundos.toFixed(1)} s de fase`);
    expect(soma).toBeLessThanOrEqual(90);
    expect(d.log.length).toBeGreaterThanOrEqual(15);
  });

  it('a história principal aparece: abertura, primeira ajuda, mãos dadas, trenzinho, segredo, portão e pódio', () => {
    const ids = new Set(d.log.map((b) => b.id));
    for (const id of ['c1-01', 'c1-02', 'c1-03', 'c1-08', 'c1-12', 'c1-20', 'c1-24', 'c1-25', 'c1-40', 'c1-61', 'c1-63', 'c1-71', 'c1-80']) expect(ids, id).toContain(id);
  });

  it('no máximo 1 balão por pessoa ao mesmo tempo; nenhuma fala sem espera sai duas vezes', () => {
    for (const q of [0, 1, 2]) {
      const meus = d.log.filter((b) => b.quem === q).sort((a, b) => a.desde - b.desde);
      for (let k = 1; k < meus.length; k++) expect(meus[k].desde, `${meus[k - 1].id} → ${meus[k].id}`).toBeGreaterThanOrEqual(meus[k - 1].ate);
    }
    const roteiro = ROTEIROS[1];
    const cont: Record<string, number> = {};
    for (const b of d.log) cont[b.id] = (cont[b.id] ?? 0) + 1;
    for (const [id, n] of Object.entries(cont)) {
      const x = roteiro.falas.find((y) => y.id === id)!;
      if (x.espera === undefined && !x.mecanica) expect(n, id).toBe(1);
      if (x.mecanica) expect(n, id).toBeLessThanOrEqual(2);
    }
  });

  it('a variante {N|B} concorda com quem fala', () => {
    const b24 = d.log.find((b) => b.id === 'c1-24')!;
    expect(b24.texto).toBe(b24.quem === 1 ? 'Obrigada por voltar.' : 'Obrigado por voltar.');
    const b72 = d.log.find((b) => b.id === 'c1-72')!;
    expect(b72.texto).toBe(textoDe({ N: 'Que dama.', B: 'Que cavalheiro.' }, b72.quem));
  });

  it('determinístico: duas passadas dão a mesma sequência (os dois celulares mostram a mesma fala sem mensagem nova)', () => {
    const outra = passada(1).d;
    expect(outra.log.map((b) => `${b.id}|${b.quem}|${b.desde}|${b.texto}`)).toEqual(d.log.map((b) => `${b.id}|${b.quem}|${b.desde}|${b.texto}`));
  });

  it('o diretor só lê: a passada com e sem balões é idêntica, tick a tick (balão nunca trava o controle, T-U2)', () => {
    const f = fase(1);
    const sem: string[] = [], com: string[] = [];
    jogar(f, PLANOS[f.id], { cada: (e) => sem.push(JSON.stringify(e)) });
    const dd = new Diretor(f, ROTEIROS[1]);
    jogar(f, PLANOS[f.id], { cada: (e) => { dd.passo(e, e.eventos); com.push(JSON.stringify(e)); } });
    expect(com.length).toBe(sem.length);
    expect(com.join('\n') === sem.join('\n')).toBe(true);
  });

  it('nada durante perigo, salvo as falas marcadas emPerigo', () => {
    const f = fase(1);
    const dd = new Diretor(f, ROTEIROS[1]);
    const porId = new Map(ROTEIROS[1].falas.map((x) => [x.id, x]));
    let vistos = 0;
    jogar(f, PLANOS[f.id], { cada: (e) => {
      for (const b of dd.passo(e, e.eventos)) if (perigo(e)) { vistos++; expect(porId.get(b.id)!.emPerigo, `${b.id} saiu com bichinho perto`).toBe(true); }
    } });
    console.log(`falas emPerigo que saíram com bichinho perto: ${vistos}`);
  });
});

describe('momento visto não repete (T-U2)', () => {
  it('voltar à lanterna e passar de novo pela tampa não repete as falas da tampa nem da abertura', () => {
    const f = fase(1);
    const e = estadoInicial(f);
    const d = new Diretor(f, ROTEIROS[1]);
    rodar(f, e, d, 20);
    posicionar(e, [34.5, 0], [33.5, 0]);
    rodar(f, e, d, 8);
    const antes = d.log.map((b) => b.id);
    expect(antes).toContain('c1-01');
    expect(antes).toContain('c1-20');
    // os dois viram bolha → volta à lanterna; andam de novo até a tampa
    for (const j of e.jogadores) { j.coracoes = 0; j.bolha = true; }
    rodar(f, e, d, 1);
    expect(d.log.some((b) => b.id === 'c1-r2'), 'reação de "volta-checkpoint"').toBe(true);
    posicionar(e, [34.5, 0], [33.5, 0]);
    rodar(f, e, d, 8);
    const depois = d.log.map((b) => b.id);
    expect(depois.filter((id) => id === 'c1-20').length).toBe(1);
    expect(depois.filter((id) => id === 'c1-01').length).toBe(1);
  });

  it('recomeçar a fase (tick volta a 0) recomeça o roteiro', () => {
    const f = fase(1);
    const d = new Diretor(f, ROTEIROS[1]);
    let e = estadoInicial(f);
    rodar(f, e, d, 3);
    expect(d.log[0]?.id).toBe('c1-01');
    e = estadoInicial(f);
    rodar(f, e, d, 3);
    expect(d.log.filter((b) => b.id === 'c1-01').length).toBe(1);
    expect(d.log[0].desde).toBeLessThan(10);
  });
});

describe('convidado: o tick mostrado pode voltar uns ticks (troca do par de instantâneos)', () => {
  it('voltar poucos ticks não recomeça o roteiro nem repete a abertura; os eventos do quadro valem', () => {
    const f = fase(1);
    const e = estadoInicial(f);
    const d = new Diretor(f, ROTEIROS[1]);
    rodar(f, e, d, 4);
    const n = d.log.length;
    const volta = structuredClone(e); volta.tick -= 5;
    d.passo(volta, ['derrota:0:bolotinha']);
    d.passo(e, []);
    expect(d.log.filter((b) => b.id === 'c1-01').length).toBe(1);
    expect(d.log.length).toBeGreaterThanOrEqual(n);
    rodar(f, e, d, 6);
    expect(d.log.map((b) => b.id), 'a reação ao "derrota" do quadro que voltou').toContain('c1-13');
  });
});

describe('dicas da primeira vez (C16): toda mecânica nova do capítulo 1', () => {
  const f = fase(1);
  /** cenário de quem não sabe a mecânica: posição dos dois, segundos parados e o que mais for preciso */
  const CENARIOS: Record<string, { pos?: [[number, number], [number, number]]; s: number; antes?: (e: Estado) => void }> = {
    andar: { s: 15 },
    pular: { pos: [[6, 0], [5, 0]], s: 6 },
    atirar: { pos: [[15, 0], [14, 0]], s: 4 },
    lanterna: { pos: [[31.5, 0], [30.5, 0]], s: 3 },
    bolha: { pos: [[10, 0], [9, 0]], s: 2, antes: (e) => { e.jogadores[1].coracoes = 1; e.jogadores[1].invencivel = 0; e.inimigos[0].x = 9; } },
    placa: { pos: [[38, 0], [37, 0]], s: 10 },
    maos: { pos: [[50.5, 0], [49.5, 0]], s: 6 },
    puxar: { pos: [[54, 2.8], [50, 0]], s: 6 },
    trem: { pos: [[63.6, 0], [62.6, 0]], s: 7 },
    marca: { pos: [[116.5, 1.5], [115.5, 1.5]], s: 14 },
    'placa-alta': { pos: [[137, 0], [136, 0]], s: 4 },
  };

  for (const mec of MECANICAS_CAP[1]) {
    it(`${mec}: a dica sai na primeira vez, num cenário de quem não sabe`, () => {
      const fala = ROTEIROS[1].falas.find((x) => x.mecanica === mec);
      expect(fala, `fala de dica para ${mec}`).toBeTruthy();
      expect(fala!.pool).toBe('dica');
      const c = CENARIOS[mec];
      expect(c, `cenário de teste para ${mec}`).toBeTruthy();
      const e = estadoInicial(f);
      const d = new Diretor(f, ROTEIROS[1]);
      // a abertura (≈ 17 s) passa antes; depois o cenário, com folga para a fala da lanterna que o teleporte acende
      rodar(f, e, d, mec === 'andar' ? 1 : 18);
      // tira os bichinhos do caminho (menos o do cenário de tiro e de bolha), para medir só a dica
      if (mec !== 'atirar' && mec !== 'bolha') for (const n of e.inimigos) n.vivo = false;
      if (c.pos) posicionar(e, c.pos[0], c.pos[1]);
      c.antes?.(e);
      if (mec === 'bolha') { rodar(f, e, d, 0.05); for (const n of e.inimigos) n.vx = 0; }
      rodar(f, e, d, c.s + 5);
      expect(d.log.map((b) => b.id), `dica de ${mec}`).toContain(fala!.id);
    });
  }

  it('dica de mecânica já usada não sai (pular antes da zona)', () => {
    const e = estadoInicial(f);
    const d = new Diretor(f, ROTEIROS[1]);
    rodar(f, e, d, 0.5, [{ ...NEUTRO, jump: true }, NEUTRO]);
    rodar(f, e, d, 1);
    posicionar(e, [6, 0], [5, 0]);
    rodar(f, e, d, 8);
    expect(d.log.map((b) => b.id)).not.toContain('c1-10');
  });

  it('20 s depois, sem usar a mecânica, a dica volta uma vez com o botão piscando (e o nível sobe para o companheiro)', () => {
    const e = estadoInicial(f);
    const d = new Diretor(f, ROTEIROS[1]);
    rodar(f, e, d, 1);
    for (const n of e.inimigos) n.vivo = false;
    posicionar(e, [50.5, 0], [49.5, 0]);
    rodar(f, e, d, 40);
    const vezes = d.log.filter((b) => b.id === 'c1-30');
    expect(vezes.length).toBe(2);
    expect(vezes[1].desde - vezes[0].desde).toBeGreaterThanOrEqual(20 * 60);
    expect(vezes[1].repeticao).toBe(true);
    expect(vezes[1].botao).toBe('#bt-mao');
    expect(d.dicas.nivel('maos', e.tick)).toBe(2);
    rodar(f, e, d, 30);
    expect(d.log.filter((b) => b.id === 'c1-30').length, 'só repete uma vez').toBe(2);
    expect(d.dicas.nivel('maos', e.tick)).toBe(4);
  });
});
