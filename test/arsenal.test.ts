// Arsenal (L4; DESIGN_ARMAS §3, §11, §13): Estilingue de Xuxinha, Espada de Papelão, Martelo, miçangas, troca,
// mochila, dar ao parceiro, alvo-sino, barbante, bloco rachado e baú; testes de aceite A1, A2, A3, A5, A8, A10, A12
// e a parte do combate que complementa (≤ 25 % do tempo do cap. 1).
import { describe, expect, it } from 'vitest';
import { ARSENAL, autoAtaque, COMBATE_FORCADO, DESBLOQUEADAS_INICIAIS, ITEM, ITENS, aplicarArsenalSalvo, arsenalParaSalvar,
  desempacotarArsenal, empacotarArsenal, receberMicangas, temRecursoInfinito } from '../src/core/arsenal';
import { criarFase } from '../src/core/fases';
import { CAPITULOS } from '../src/core/fases/index';
import { instantaneo, restaurar } from '../src/core/instantaneo';
import { estadoInicial, normalizarInput, passo } from '../src/core/sim';
import type { Estado, Fase, Input } from '../src/core/types';
import { nosQueTocam, montarGrafo, noSob, pares } from './fases/alcance';
import { jogar } from './fases/bot';
import { PLANOS } from './fases/planos';

const N: Input = { x: 0, y: 0, jump: false, act: false, shoot: false };
const CHAO = { x: -2, y: -1, w: 60, h: 1 };
type Ent = Partial<Input> | ((e: Estado, t: number) => Partial<Input>);
const val = (v: Ent, e: Estado, t: number) => (typeof v === 'function' ? v(e, t) : v);
function rodar(f: Fase, e: Estado, seg: number, a: Ent = {}, b: Ent = {}) {
  const evs: string[] = [];
  for (let t = 0; t < Math.round(seg * 60); t++) { passo(f, e, [{ ...N, ...val(a, e, t) }, { ...N, ...val(b, e, t) }]); evs.push(...e.eventos); }
  return evs;
}
const pos = (e: Estado, i: number, x: number, y = 0, olhando: 1 | -1 = 1) => Object.assign(e.jogadores[i], { x, y, vx: 0, vy: 0, seguroX: x, seguroY: y, olhando });
const pulso = (t: number) => t % 2 === 0;
const conta = (evs: string[], p: string) => evs.filter((x) => x.startsWith(p)).length;

describe('Estilingue de Xuxinha (recurso infinito)', () => {
  it('começa com Espada + Estilingue na mão; 3 pedrinhas e depois 1 a cada 0,6 s: nunca acaba', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO] });
    const e = estadoInicial(f);
    const a = e.jogadores[0].arsenal;
    expect(a.itens).toEqual([ITEM.espada, ITEM.estilingue, -1, -1]);
    expect(a.atual).toBe(1);
    expect(temRecursoInfinito(a)).toBe(true);
    let maxCarga = 0;
    const evs: string[] = [];
    for (let t = 0; t < 600; t++) { passo(f, e, [{ ...N, shoot: pulso(t) }, N]); evs.push(...e.eventos); maxCarga = Math.max(maxCarga, a.carga[1]); }
    // 10 s: as 3 do começo + ~16 que voltaram (1 a cada 0,6 s)
    const tiros = conta(evs, 'tiro:0');
    expect(tiros).toBeGreaterThanOrEqual(18);
    expect(tiros).toBeLessThanOrEqual(20);
    expect(maxCarga).toBeLessThanOrEqual(3);
    // parado, volta a 3
    rodar(f, e, 2);
    expect(a.carga[1]).toBe(3);
  });

  it('segurar ATACAR não dispara de novo; segurar 0,6 s e soltar dá o tiro carregado (2 de dano, atravessa 1)', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], inimigos: [{ tipo: 'cogumelo', x: 5, y: 0 }, { tipo: 'cogumelo', x: 6.2, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    const evs = rodar(f, e, 0.7, { shoot: true });
    expect(conta(evs, 'tiro:0')).toBe(1); // só o aperto
    expect(evs).toContain('carregado:0');
    const ev2 = rodar(f, e, 1.2, {});
    expect(conta(ev2, 'tiro:0')).toBe(1); // o carregado, ao soltar
    // o 1º cogumelo levou 1 + 2 e caiu; o carregado atravessou e acertou o 2º
    expect(e.inimigos[0].vivo).toBe(false);
    expect([...evs, ...ev2].filter((x) => x === 'acerto:1').length).toBeGreaterThanOrEqual(1);
  });

  it('mira assistida: acerta o morcego no alto (cone de ±25°) e o alvo-sino', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], inimigos: [{ tipo: 'morcego', x: 6, y: 2.4, alcance: 0.01 }], alvos: [{ x: 4, y: 3.2, premio: 2 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    const evs = rodar(f, e, 1, (_e, t) => ({ shoot: pulso(t) }));
    expect(evs).toContain('derrota:0:morcego');
    // sem bichinho, a mira vai no sino (4 m à frente, 2,6 m acima: ~33°; com o joystick para cima, a mira sobe)
    const ev2 = rodar(f, e, 1, (_e, t) => ({ shoot: pulso(t), y: 0.6 }));
    expect(ev2).toContain('sino:0');
    expect(e.soltas.length).toBe(1 + 2); // a estrelinha do morcego e o prêmio do sino
  });
});

describe('corpo a corpo', () => {
  it('Espada: combo 1 + 1 + 2 em 0,3 s por golpe, à frente; não quebra bloco rachado', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], inimigos: [{ tipo: 'espinhudo', x: 3, y: 0 }], rachados: [{ x: 1.6, y: 0, w: 0.4, h: 1 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    pos(e, 0, 1);
    e.jogadores[0].invencivel = 99;
    const evs = rodar(f, e, 0.05, { troca: 1 });
    expect(evs).toContain('troca:0:1');
    const ev2 = rodar(f, e, 1.2, { shoot: true });
    expect(conta(ev2, 'golpe:0')).toBeGreaterThanOrEqual(3);
    expect(ev2).toContain('bate:0');
    expect(e.rachados[0]).toBe(1);
  });

  it('Martelo (baú): quebra o bloco rachado (estrelinhas) e a martelada caindo tira 3 em área', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], baus: [{ x: 1.5, y: 0, item: ITEM.martelo }], rachados: [{ x: 2.0, y: 0, w: 1, h: 1, premio: 3 }],
      inimigos: [{ tipo: 'cogumelo', x: 8, y: 0 }, { tipo: 'cogumelo', x: 9.6, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    const evs = rodar(f, e, 0.1);
    expect(evs).toContain(`bau:0:0:${ITEM.martelo}`);
    expect(e.jogadores[0].arsenal.itens[0]).toBe(ITEM.martelo);
    expect(e.jogadores[0].arsenal.atual).toBe(0);
    expect(e.desbloqueadas & (1 << ITEM.martelo)).toBeTruthy();
    const ev2 = rodar(f, e, 0.8, (_e, t) => ({ shoot: t > 10 }));
    expect(ev2).toContain('racha:0');
    expect(e.rachados[0]).toBe(0);
    expect(e.soltas.length).toBe(3);
    // martelada: pula por cima dos cogumelos e martela no ar
    pos(e, 0, 8.8, 3); e.jogadores[0].invencivel = 99;
    const ev3 = rodar(f, e, 1, (s, t) => ({ shoot: t === 6 }));
    expect(ev3).toContain('martelo-cai:0');
    expect(ev3).toContain('martelada:0');
    expect(e.inimigos.every((n) => !n.vivo)).toBe(true);
  });

  it('o corpo a corpo corta barbante (prêmio) e rebate esporo; a pedrinha atravessa o barbante', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], barbantes: [{ x: 2, y0: 1.1, y1: 4, premio: 2 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    rodar(f, e, 1, (_e, t) => ({ shoot: pulso(t) }));
    expect(e.barbantes[0]).toBe(-1);
    rodar(f, e, 0.1, { troca: 1 });
    e.esporos.push({ x: 1.8, y: 0.6, vx: -1, vy: 0, t: 5 });
    const evs = rodar(f, e, 0.4, { shoot: true });
    expect(evs).toContain('barbante:0');
    expect(evs).toContain('rebate:0');
    expect(e.soltas.length).toBe(2);
  });
});

describe('troca, mochila, miçangas e dar', () => {
  it('troca vale a borda (segurar o 2 não repete) e leva 0,15 s; a 6 é a próxima arma', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    const evs = rodar(f, e, 0.5, { troca: 1 });
    expect(conta(evs, 'troca:0')).toBe(1);
    expect(e.jogadores[0].arsenal.atual).toBe(0);
    rodar(f, e, 0.1, { troca: 6 });
    expect(e.jogadores[0].arsenal.atual).toBe(1);
    // logo depois da troca não ataca
    const ev2 = rodar(f, e, 0.05, (_e, t) => ({ troca: t === 0 ? 1 : 0, shoot: t === 1 }));
    expect(conta(ev2, 'golpe:0')).toBe(0);
  });

  it('mochila do casal: só na lanterna acesa troca a Espada pelo Martelo (e de volta); o Estilingue único não sai', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], lanternas: [{ x: 6, y: 0 }] });
    const e = estadoInicial(f);
    e.desbloqueadas |= 1 << ITEM.martelo;
    pos(e, 1, 40);
    rodar(f, e, 0.1, { troca: 1 });
    rodar(f, e, 0.1, { troca: 5 });
    expect(e.jogadores[0].arsenal.itens[0]).toBe(ITEM.espada); // longe da lanterna
    pos(e, 0, 6.5);
    rodar(f, e, 0.1);
    expect(e.checkpoint).toBe(0);
    const evs = rodar(f, e, 0.1, (_e, t) => ({ troca: t < 2 ? 5 : 0 }));
    expect(evs).toContain(`mochila:0:${ITEM.martelo}`);
    expect(e.jogadores[0].arsenal.itens[0]).toBe(ITEM.martelo);
    rodar(f, e, 0.1, (_e, t) => ({ troca: t < 2 ? 5 : 0 }));
    expect(e.jogadores[0].arsenal.itens[0]).toBe(ITEM.espada);
    rodar(f, e, 0.1, { troca: 2 });
    rodar(f, e, 0.1, (_e, t) => ({ troca: t < 2 ? 5 : 0 }));
    expect(e.jogadores[0].arsenal.itens[1]).toBe(ITEM.estilingue);
  });

  it('miçangas: vão para a arma de munição mais vazia; sem ela, para a bolsa; recarga de 1,5 s', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO] });
    const e = estadoInicial(f);
    const a = e.jogadores[0].arsenal;
    expect(receberMicangas(a, 0.5, true)).toBe(3); // meia carga sem arma de munição: 3 miçangas na bolsa
    expect(a.bolsa).toBe(3);
    // pega o Lançador de Confeitos (P1, só nos testes): a bolsa vai para a reserva dele
    e.desbloqueadas |= 1 << ITEM.confeitos;
    Object.assign(a, { itens: [ITEM.espada, ITEM.estilingue, ITEM.confeitos, -1], atual: 2, carga: [0, 3, 8, 0], reserva: [0, 0, 3, 0], bolsa: 0 });
    pos(e, 1, 40);
    const evs = rodar(f, e, 10, (_e, t) => ({ shoot: pulso(t) }));
    // 8 de carga, recarga de 1,5 s com a carga vazia, + 3 da reserva: 11 tiros (em leque de 3: 33 confeitos)
    expect(conta(evs, 'tiro:0')).toBe(11);
    expect(a.carga[2] + a.reserva[2]).toBe(0);
    expect(receberMicangas(a, 1, true)).toBe(8);
    expect(a.reserva[2]).toBe(8);
    rodar(f, e, 2);
    expect(a.carga[2]).toBe(8); // recarregou da reserva
  });

  it('bichinho de índice par solta pote de meia carga; a lanterna dá 1 carga; sem potes (A2) nada disso', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], inimigos: [{ tipo: 'bolotinha', x: 5, y: 0 }, { tipo: 'bolotinha', x: 6, y: 0 }], lanternas: [{ x: 12, y: 0 }] });
    for (const semPotes of [false, true]) {
      const e = estadoInicial(f);
      e.semPotes = semPotes;
      pos(e, 1, 40);
      rodar(f, e, 2, (_e, t) => ({ shoot: pulso(t) }));
      expect(e.inimigos.every((n) => !n.vivo)).toBe(true);
      expect(e.potes.length).toBe(semPotes ? 0 : 1);
      const evs = rodar(f, e, 3, { x: 1 });
      expect(conta(evs, 'pote:0')).toBe(semPotes ? 0 : 1);
      expect(e.jogadores[0].arsenal.bolsa).toBe(semPotes ? 0 : 3 + 6);
    }
  });

  it('dar: com arma de munição, metade da reserva vai para o parceiro; com a espada, os dois trocam o item', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO] });
    const e = estadoInicial(f);
    const [a, b] = e.jogadores.map((j) => j.arsenal);
    Object.assign(a, { itens: [ITEM.martelo, ITEM.estilingue, ITEM.confeitos, -1], atual: 2, carga: [0, 3, 8, 0], reserva: [0, 0, 20, 0] });
    Object.assign(b.itens, [ITEM.espada, ITEM.estilingue, ITEM.confeitos, -1]);
    b.reserva[2] = 0;
    pos(e, 0, 2); pos(e, 1, 6);
    const evs = rodar(f, e, 0.1, (_e, t) => ({ dar: t < 3 }));
    expect(conta(evs, 'dar:0:m')).toBe(1);
    expect(a.reserva[2]).toBe(10);
    expect(b.reserva[2]).toBe(10);
    rodar(f, e, 0.1, { troca: 1 });
    rodar(f, e, 0.1, (_e, t) => ({ dar: t < 3 }));
    expect(a.itens[0]).toBe(ITEM.espada);
    expect(b.itens[0]).toBe(ITEM.martelo);
    // longe (> 8 m): o item não vai; as miçangas caem no chão
    pos(e, 1, 30);
    rodar(f, e, 0.1, { troca: 3 });
    rodar(f, e, 0.1, (_e, t) => ({ dar: t < 3 }));
    expect(e.potes.length).toBe(1);
    expect(a.reserva[2]).toBe(5);
  });

  it('tiro no Rei fechado é defendido e cai como miçanga (não se gasta munição à toa)', () => {
    const f = criarFase({ id: 'rei', largura: 40, plataformas: [CHAO], inimigos: [{ tipo: 'rei', x: 10, y: 0, alcance: 0.01 }] });
    const e = estadoInicial(f);
    pos(e, 1, 1); pos(e, 0, 6);
    e.jogadores[0].invencivel = 99; e.jogadores[1].invencivel = 99;
    const evs = rodar(f, e, 0.3, (_e, t) => ({ shoot: t === 0 }));
    expect(evs).toContain('defendeu:0');
    expect(e.potes.length).toBe(1);
    expect(e.potes[0].q).toBe(1);
  });

  it('alvo-sino tocado segura a porta aberta por `tempo` s, como uma placa', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], portas: [{ id: 'g', x: 8, y: 0, w: 0.5, h: 3 }], alvos: [{ x: 5, y: 1, abre: 'g', tempo: 2 }] });
    const e = estadoInicial(f);
    pos(e, 1, 40);
    rodar(f, e, 0.5, (_e, t) => ({ shoot: t === 0 }));
    expect(e.alvos[0]).toBeGreaterThan(0);
    rodar(f, e, 0.5);
    expect(e.portas.g).toBeGreaterThan(0.5);
    rodar(f, e, 3);
    expect(e.portas.g).toBe(0);
  });

  it('normalizarInput aceita troca 1–6 e dar; `atk` vale como `shoot` (rede nova)', () => {
    expect(normalizarInput({ troca: 3, dar: true })).toEqual({ x: 0, y: 0, jump: false, act: false, shoot: false, troca: 3, dar: true });
    expect(normalizarInput({ troca: 9, dar: 1 })).toEqual({ x: 0, y: 0, jump: false, act: false, shoot: false });
    expect(normalizarInput({ atk: true }).shoot).toBe(true);
  });

  it('salvamento: itens do casal e espaços voltam; Estilingue e corpo a corpo sempre garantidos', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO] });
    const e = estadoInicial(f);
    e.desbloqueadas |= 1 << ITEM.martelo;
    e.jogadores[1].arsenal.itens[0] = ITEM.martelo;
    const s = JSON.parse(JSON.stringify(arsenalParaSalvar(e)));
    const n = estadoInicial(f);
    aplicarArsenalSalvo(n, s);
    expect(n.desbloqueadas).toBe(e.desbloqueadas);
    expect(n.jogadores[1].arsenal.itens[0]).toBe(ITEM.martelo);
    const ruim = estadoInicial(f);
    aplicarArsenalSalvo(ruim, { armas: 0, espacos: [[-1, -1, 7, 99], [ITEM.martelo, ITEM.espada, -1, -1]] });
    for (const j of ruim.jogadores) expect(temRecursoInfinito(j.arsenal)).toBe(true);
    expect(ruim.desbloqueadas).toBe(DESBLOQUEADAS_INICIAIS);
  });
});

// ---------------------------------------------------------------- aceite
describe('A12 · sem fogo amigo', () => {
  for (const [nome, prep] of [
    ['Estilingue', () => ({})], ['Espada', () => ({ troca: 1 })],
    ['Martelo', (e: Estado) => { e.jogadores.forEach((j) => { j.arsenal.itens[0] = ITEM.martelo; }); return { troca: 1 }; }],
    ['Confeitos', (e: Estado) => { e.jogadores.forEach((j) => { Object.assign(j.arsenal, { itens: [ITEM.espada, ITEM.estilingue, ITEM.confeitos, -1], carga: [0, 3, 8, 0], reserva: [0, 0, 48, 0] }); }); return { troca: 3 }; }],
  ] as const) {
    it(`${nome}: os dois lado a lado, atacando um ao outro (também carregado e no ar), ninguém perde coração`, () => {
      const f = criarFase({ id: 't', plataformas: [CHAO] });
      const e = estadoInicial(f);
      pos(e, 0, 5, 0, 1); pos(e, 1, 6, 0, -1);
      const extra = (prep as (e: Estado) => Partial<Input>)(e);
      rodar(f, e, 0.2, extra, extra);
      const evs = rodar(f, e, 6, (_e, t) => ({ shoot: t % 50 < 40 ? pulso(t) : true, jump: t % 90 === 0 }), (_e, t) => ({ shoot: t % 50 < 40 ? pulso(t) : true, jump: t % 70 === 0 }));
      expect(conta(evs, 'tiro') + conta(evs, 'golpe')).toBeGreaterThan(5);
      expect(conta(evs, 'dano')).toBe(0);
      expect(e.jogadores.map((j) => j.coracoes)).toEqual([3, 3]);
    });
  }
});

describe('A10 · determinismo', () => {
  it('a mesma entrada dá o mesmo arsenal, os mesmos projéteis e os mesmos potes (cap. 1 com os bots, duas vezes)', () => {
    const f = CAPITULOS[0];
    const a = jogar(f, PLANOS[f.id]).e, b = jogar(f, PLANOS[f.id]).e;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('nenhum Math.random, Date.now nem performance em src/core', () => {
    const fontes = import.meta.glob('../src/core/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(fontes).length).toBeGreaterThan(20);
    const achados = Object.entries(fontes).filter(([, t]) => /Math\.random|Date\.now|performance\.now/.test(t.replace(/\/\/.*$/gm, ''))).map(([n]) => n);
    expect(achados).toEqual([]);
  });
});

describe('A8 · rede: o arsenal vai e volta no instantâneo; instantâneo médio ≤ +15 %', () => {
  /** instantâneo médio (JSON, 1 a cada 3 ticks) com os bots ANTES do L4, medido com tools/revisao/l4/medir.ts no
   *  commit 6c8fe5b (tools/revisao/l4/antes.json) */
  const ANTES: Record<string, number> = { 'cap1-brinquedos': 342, 'cap2-floresta': 426, 'cap3-relogio': 431, 'cap4-oceano': 406, 'cap5-doces': 561, 'cap6-espelhos': 380, 'cap7-cosmos': 471 };
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}`, () => {
      let bytes = 0, n = 0, difs = 0;
      jogar(f, PLANOS[f.id], {
        cada: (e) => {
          if (e.tick % 3) return;
          const txt = JSON.stringify(instantaneo(f, e));
          bytes += txt.length; n++;
          const r = restaurar(f, JSON.parse(txt));
          for (let i = 0; i < 2; i++) {
            const x = e.jogadores[i].arsenal, y = r.jogadores[i].arsenal;
            if (JSON.stringify([x.itens, x.atual, x.carga, x.reserva, x.bolsa, x.combo, x.martelada, x.atkAntes, x.trocaAntes])
              !== JSON.stringify([y.itens, y.atual, y.carga, y.reserva, y.bolsa, y.combo, y.martelada, y.atkAntes, y.trocaAntes])) difs++;
            if (Math.abs(x.espera - y.espera) > 0.006 || Math.abs(x.relogio[1] - y.relogio[1]) > 0.006 || Math.abs(x.carregando - y.carregando) > 0.006) difs++;
          }
          if (r.faiscas.length !== e.faiscas.length || r.potes.length !== e.potes.length || r.desbloqueadas !== e.desbloqueadas) difs++;
          if (JSON.stringify([r.alvos.map((v) => Math.round(v * 10)), r.rachados, r.baus]) !== JSON.stringify([e.alvos.map((v) => Math.round(v * 10)), e.rachados, e.baus])) difs++;
        },
      });
      expect(difs, 'instantâneos com o arsenal diferente do anfitrião').toBe(0);
      const medio = bytes / n;
      console.log(`A8 cap ${f.capitulo}: instantâneo médio ${medio.toFixed(0)} B (antes ${ANTES[f.id]}; ${((medio / ANTES[f.id] - 1) * 100).toFixed(1)} %)`);
      expect(medio).toBeLessThanOrEqual(ANTES[f.id] * 1.15);
    });
  }
  it('empacotar/desempacotar é exato nos valores que a simulação usa', () => {
    const a = estadoInicial(CAPITULOS[0]).jogadores[0].arsenal;
    Object.assign(a, { itens: [ITEM.martelo, ITEM.estilingue, ITEM.confeitos, -1], atual: 2, carga: [0, 1, 5, 0], reserva: [0, 0, 17, 0], bolsa: 9, combo: 2, martelada: true, trocaAntes: 6, carregando: 0.35 });
    const b = desempacotarArsenal(JSON.parse(JSON.stringify(empacotarArsenal(a))));
    expect(b).toEqual(a);
    expect(empacotarArsenal(estadoInicial(CAPITULOS[0]).jogadores[0].arsenal).length).toBe(1);
  });
});

describe('A1/A2 · os 7 capítulos fecham com os bots', () => {
  for (const semPotes of [false, true]) for (const f of CAPITULOS) {
    if (!semPotes && f.capitulo > 1) continue; // A1: munição real só no cap. 1 (o único com o arsenal todo no MVP)
    it(`${semPotes ? 'A2 (só Estilingue ∞ e corpo a corpo, sem potes)' : 'A1 (munição real)'} · ${f.capitulo}. ${f.nome}`, () => {
      const e = estadoInicial(f);
      e.semPotes = semPotes;
      // A3, parte 2: nos pontos de combate forçado, os dois têm o recurso infinito à mão
      const forcado = COMBATE_FORCADO.filter((c) => c.capitulo === f.capitulo);
      let semInfinito = 0, noForcado = 0, potes = 0;
      const r = jogar(f, PLANOS[f.id], {
        e, limite: 420,
        cada: (s) => {
          potes = Math.max(potes, s.potes.length);
          for (const j of s.jogadores) {
            const rei = s.inimigos.find((n) => n.tipo === 'rei' && n.vivo);
            const dentro = forcado.some((c) => (c.rei ? !!rei && Math.abs(rei.x - j.x) < 14 : j.x >= c.x0! && j.x <= c.x1!));
            if (dentro) { noForcado++; if (!temRecursoInfinito(j.arsenal)) semInfinito++; }
          }
        },
      });
      expect(r.erro).toBeUndefined();
      expect(r.concluida).toBe(true);
      expect(r.voltas, '0 recomeços de checkpoint').toBe(0);
      if (semPotes) expect(potes).toBe(0);
      if (forcado.length) expect(noForcado, 'os bots passam pelo combate forçado').toBeGreaterThan(0);
      expect(semInfinito, 'ticks no combate forçado sem Estilingue + corpo a corpo').toBe(0);
    });
  }
});

describe('A3 · nenhum obrigatório exige munição finita ou item raro; A5 · baús alcançáveis e item antes do uso', () => {
  const infinitos = new Set(['estilingue', 'corpo', 'qualquer']);
  for (const f of CAPITULOS) {
    it(`${f.capitulo}. ${f.nome}`, () => {
      // elemento que abre porta (obrigatório, se a porta estiver no caminho) só com recurso infinito
      for (const s of f.alvos ?? []) if (s.abre) expect(infinitos.has(s.requer ?? 'estilingue'), `sino em ${s.x}`).toBe(true);
      for (const b of f.barbantes ?? []) expect(infinitos.has(b.requer ?? 'corpo'), `barbante em ${b.x}`).toBe(true);
      // bloco rachado: o grafo de alcance (test/fases.test.ts) já fecha com ele inteiro, logo não é obrigatório;
      // e o item que o quebra está num baú antes dele (ou é inicial)
      const g = montarGrafo(f);
      const r = pares(g, [noSob(g, f.inicio[0]), noSob(g, f.inicio[1])], nosQueTocam(g, f.portal));
      expect(r.chegaAoFim, 'fecha com os blocos rachados inteiros').toBe(true);
      for (const k of f.rachados ?? []) {
        const req = k.requer ?? 'martelo';
        if (req === 'martelo') expect((f.baus ?? []).some((b) => b.item === ITEM.martelo && b.x < k.x), `baú do Martelo antes do bloco em ${k.x}`).toBe(true);
      }
      for (const b of f.baus ?? []) {
        expect(ITENS[b.item]?.mvp, `baú em ${b.x} com item do MVP`).toBe(true);
        expect(r.nosAlcancados.has(noSob(g, b)), `baú em ${b.x} alcançável`).toBe(true);
      }
    });
  }
});

describe('cap. 1: um uso de cada elemento com os bots; combate ≤ 25 % do tempo', () => {
  it('sino, barbante, baú do Martelo e bloco rachado acontecem; bichinho vivo a < 8 m em ≤ 25 % dos ticks', () => {
    const f = CAPITULOS[0];
    let combate = 0, ticks = 0;
    const r = jogar(f, PLANOS[f.id], {
      cada: (s) => { ticks++; if (s.inimigos.some((b) => b.vivo && s.jogadores.some((j) => !j.bolha && Math.hypot(j.x - b.x, j.y - b.y) < 8))) combate++; },
    });
    expect(r.concluida).toBe(true);
    for (const t of ['sino', 'barbante', 'bau', 'racha']) expect(r.eventos[t] ?? 0, t).toBeGreaterThanOrEqual(1);
    console.log(`cap 1: combate ${((combate / ticks) * 100).toFixed(1)} % do tempo; ${r.eventos.tiro ?? 0} tiros, ${r.eventos.golpe ?? 0} golpes`);
    expect(combate / ticks).toBeLessThanOrEqual(0.25);
  });

  it('o autoAtaque troca para o corpo a corpo perto e volta ao Estilingue de longe', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], inimigos: [{ tipo: 'cogumelo', x: 1.8, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 0, 1);
    expect(autoAtaque(f, e, 0).troca).toBe(1);
    pos(e, 0, -1.5);
    e.jogadores[0].arsenal.atual = 0;
    expect(autoAtaque(f, e, 0).troca).toBe(2);
  });
});
