import { describe, it, expect } from 'vitest';
import { estadoInicial, passo, FIO, VIDA, normalizarInput } from '../src/core/sim';
import { ARSENAL } from '../src/core/arsenal';
import { criarFase, EXEMPLO_MECANICAS, FLORESTA_1 } from '../src/core/fases';
import { INIMIGO } from '../src/core/inimigos';
import { instantaneo, interpolar, restaurar } from '../src/core/instantaneo';
import type { Estado, Fase, Input } from '../src/core/types';

const N: Input = { x: 0, y: 0, jump: false, act: false, shoot: false };
type Ent = Partial<Input> | ((e: Estado, t: number) => Partial<Input>);
const val = (v: Ent, e: Estado, t: number) => (typeof v === 'function' ? v(e, t) : v);
/** Roda `seg` segundos; devolve todos os eventos do período. */
function rodar(f: Fase, e: Estado, seg: number, a: Ent = {}, b: Ent = {}, cada?: (e: Estado) => void) {
  const evs: string[] = [];
  for (let t = 0; t < Math.round(seg * 60); t++) {
    passo(f, e, [{ ...N, ...val(a, e, t) }, { ...N, ...val(b, e, t) }]);
    evs.push(...e.eventos);
    cada?.(e);
  }
  return evs;
}
const pos = (e: Estado, i: number, x: number, y: number) => Object.assign(e.jogadores[i], { x, y, vx: 0, vy: 0, seguroX: x, seguroY: y });
const dist = (e: Estado) => Math.hypot(e.jogadores[0].x - e.jogadores[1].x, e.jogadores[0].y - e.jogadores[1].y);

const CHAO = { x: -2, y: -1, w: 40, h: 1 };

// L4: o Lança-Estrelas virou o Estilingue de Xuxinha (src/core/arsenal.ts); os testes do arsenal estão em
// test/arsenal.test.ts. Aqui ficam os mesmos casos de antes, com a arma nova.
/** ATACAR em pulsos (o aperto é que conta): aperta num tick, solta no outro */
const pulso = (t: number) => t % 2 === 0;
describe('Estilingue (no lugar do Lança-Estrelas)', () => {
  it('cadência de 2,5 por segundo com pedrinha na carga; alcance de ~9 m em arco', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40 });
    const e = estadoInicial(f);
    rodar(f, e, 0.3);
    let maxX = 0;
    const evs = rodar(f, e, 1.2, (_e, t) => ({ shoot: pulso(t) }), {}, (s) => { for (const x of s.faiscas) maxX = Math.max(maxX, x.x); });
    // 0,4 s entre tiros: 0; 0,4; 0,8 (a carga não esvazia: a 1ª pedrinha já voltou aos 0,6 s)
    expect(evs.filter((x) => x.startsWith('tiro:0'))).toHaveLength(3);
    expect(maxX).toBeGreaterThan(1 + 6);
    expect(maxX).toBeLessThan(1 + ARSENAL.mira.alcance + 0.6);
    rodar(f, e, 1);
    expect(e.faiscas).toHaveLength(0);
  });

  it('atira para onde olha e derrota bichinhos conforme a vida (bolotinha 1, cogumelo 2)', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, inimigos: [{ tipo: 'bolotinha', x: 6, y: 0 }, { tipo: 'cogumelo', x: -1, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 1, 30, 0);
    rodar(f, e, 0.2);
    const evs = rodar(f, e, 1, (_e, t) => ({ shoot: pulso(t) }));
    expect(evs).toContain('derrota:0:bolotinha');
    expect(e.inimigos[0].vivo).toBe(false);
    expect(e.soltas).toHaveLength(1); // a lembrança volta como estrelinha
    // vira para a esquerda e acerta o cogumelo: precisa de 2 pedrinhas
    rodar(f, e, 0.05, { x: -1 });
    const ev2: string[] = [];
    for (let k = 0; k < 120 && e.inimigos[1].vivo; k++) ev2.push(...rodar(f, e, 1 / 60, { shoot: pulso(k) }));
    expect(ev2.filter((x) => x === 'acerto:1')).toHaveLength(2);
    expect(e.inimigos[1].vivo).toBe(false);
  });

  it('pedrinha estoura esporo e some na parede', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO, { x: 4, y: 0, w: 1, h: 3 }], largura: 40 });
    const e = estadoInicial(f);
    pos(e, 1, 30, 0);
    rodar(f, e, 0.2);
    e.esporos.push({ x: 2.6, y: 0.6, vx: 0, vy: 0, t: 5 });
    rodar(f, e, 0.5, (_e, t) => ({ shoot: pulso(t) }));
    expect(e.esporos).toHaveLength(0);
    rodar(f, e, 0.5);
    expect(e.faiscas.every((x) => x.x < 4)).toBe(true);
  });
});

describe('bichinhos-pesadelo', () => {
  it('bolotinha anda e vira na beira e na parede', () => {
    const f = criarFase({ id: 't', plataformas: [{ x: 0, y: -1, w: 6, h: 1 }, { x: 0, y: 0, w: 0.5, h: 2 }], largura: 40, inimigos: [{ tipo: 'bolotinha', x: 3, y: 0, dir: 1 }] });
    const e = estadoInicial(f);
    pos(e, 0, 30, 20); pos(e, 1, 32, 20);
    let min = 99, max = -99;
    rodar(f, e, 12, {}, {}, (s) => { min = Math.min(min, s.inimigos[0].x); max = Math.max(max, s.inimigos[0].x); });
    expect(e.inimigos[0].vivo).toBe(true);
    expect(max).toBeGreaterThan(5.3); expect(max).toBeLessThanOrEqual(6.1);  // chegou na beira e voltou
    expect(min).toBeLessThan(1.2); expect(min).toBeGreaterThanOrEqual(0.5 + INIMIGO.bolotinha.w / 2 - 0.01); // parede
  });

  it('morcego-sono voa em onda dentro da patrulha', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, inimigos: [{ tipo: 'morcego', x: 10, y: 3, alcance: 2 }] });
    const e = estadoInicial(f);
    pos(e, 0, 30, 0); pos(e, 1, 31, 0);
    let yMin = 99, yMax = -99, xMin = 99, xMax = -99;
    rodar(f, e, 6, {}, {}, (s) => { const n = s.inimigos[0]; yMin = Math.min(yMin, n.y); yMax = Math.max(yMax, n.y); xMin = Math.min(xMin, n.x); xMax = Math.max(xMax, n.x); });
    expect(yMax - yMin).toBeGreaterThan(1);
    expect(xMin).toBeGreaterThanOrEqual(8 - 1e-6); expect(xMax).toBeLessThanOrEqual(12 + 1e-6);
    expect(xMax - xMin).toBeGreaterThan(3.5);
  });

  it('cogumelo-bravo fica parado e cospe esporos lentos no jogador perto', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, inimigos: [{ tipo: 'cogumelo', x: 10, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 0, 4, 0); pos(e, 1, 30, 0);
    const evs = rodar(f, e, 2.7);
    expect(evs).toContain('esporo:0');
    expect(e.inimigos[0].x).toBe(10);
    const evs2 = rodar(f, e, 3);
    expect(evs2).toContain('dano:0'); // o esporo chegou (devagar)
  });

  it('pisar derrota e dá quique; o espinhudo não pode ser pisado', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, inimigos: [{ tipo: 'bolotinha', x: 5, y: 0 }, { tipo: 'espinhudo', x: 15, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 1, 30, 0);
    rodar(f, e, 0.1);
    pos(e, 0, e.inimigos[0].x, 1.6);
    let quicou = false;
    const evs = rodar(f, e, 0.4, {}, {}, (s) => { if (s.jogadores[0].vy > 5) quicou = true; });
    expect(evs).toContain('pisao:0:0');
    expect(evs).toContain('derrota:0:bolotinha');
    expect(quicou).toBe(true);
    expect(e.jogadores[0].coracoes).toBe(3);
    // espinhudo
    rodar(f, e, 1.5);
    pos(e, 0, e.inimigos[1].x, 1.6);
    const ev2 = rodar(f, e, 0.4);
    expect(ev2).toContain('dano:0');
    expect(e.inimigos[1].vivo).toBe(true);
    expect(e.jogadores[0].coracoes).toBe(2);
  });
});

describe('vida, bolha e checkpoint', () => {
  const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, inimigos: [{ tipo: 'espinhudo', x: 12, y: 0 }], lanternas: [{ x: 6, y: 0 }] });

  it('encostar tira 1 coração e dá 1 s de invencibilidade', () => {
    const e = estadoInicial(f);
    pos(e, 0, 10, 0); pos(e, 1, 2, 0);
    let ev = rodar(f, e, 1, { x: 1 });
    expect(ev.filter((x) => x === 'dano:0')).toHaveLength(1);
    expect(e.jogadores[0].coracoes).toBe(2);
    pos(e, 0, e.inimigos[0].x - 0.5, 0);
    e.jogadores[0].invencivel = 0.5;
    ev = rodar(f, e, 0.3);
    expect(ev).not.toContain('dano:0'); // ainda invencível
    expect(e.jogadores[0].invencivel).toBeLessThan(VIDA.invencivel);
  });

  it('sem corações vira bolha, flutua até o parceiro e renasce encostando', () => {
    const e = estadoInicial(f);
    pos(e, 0, 9, 0); pos(e, 1, 2, 0);
    e.jogadores[0].coracoes = 1;
    let ev = rodar(f, e, 0.5, { x: 1 });
    expect(ev).toContain('bolha:0');
    expect(e.jogadores[0].bolha).toBe(true);
    expect(e.jogadores[0].coracoes).toBe(0);
    ev = rodar(f, e, 4);
    expect(ev).toContain('renasce:0');
    expect(e.jogadores[0].bolha).toBe(false);
    expect(e.jogadores[0].coracoes).toBe(3);
    expect(Math.abs(e.jogadores[0].x - e.jogadores[1].x)).toBeLessThan(1.5);
  });

  it('os dois bolha voltam à última lanterna acesa', () => {
    const e = estadoInicial(f);
    pos(e, 0, 7, 0); pos(e, 1, 8, 0);
    const ev1 = rodar(f, e, 0.1);
    expect(ev1).toContain('lanterna:0');
    expect(e.checkpoint).toBe(0);
    pos(e, 0, 20, 0); pos(e, 1, 30, 0);
    e.jogadores[0].bolha = e.jogadores[1].bolha = true;
    e.jogadores[0].coracoes = e.jogadores[1].coracoes = 0;
    const ev = rodar(f, e, 1 / 60);
    expect(ev).toContain('volta-checkpoint');
    expect(e.jogadores.every((j) => !j.bolha && j.coracoes === 3)).toBe(true);
    expect(Math.abs(e.jogadores[0].x - 6)).toBeLessThan(1);
    expect(Math.abs(e.jogadores[1].x - 6)).toBeLessThan(1);
  });

  it('bolha não pega estrelinha nem aperta placa', () => {
    const g = criarFase({ id: 't', plataformas: [CHAO], largura: 40, estrelinhas: [{ x: 10, y: 0.5 }], placas: [{ id: 'p', x: 9.5, y: 0, w: 1, h: 0.15, abre: 'q' }], portas: [{ id: 'q', x: 20, y: 0, w: 0.5, h: 3 }] });
    const e = estadoInicial(g);
    pos(e, 0, 10, 0.3); pos(e, 1, 10.2, 0.3);
    e.jogadores[0].bolha = true;
    rodar(g, e, 0.02);
    expect(e.jogadores[0].estrelinhas).toBe(0);
  });
});

describe('coletáveis e pedaço da estrela', () => {
  it('estrelinhas: contador por jogador e do casal; estrelinha solta também conta', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, estrelinhas: [{ x: 4, y: 0.6 }, { x: 6, y: 0.6 }, { x: 4, y: 3 }], inimigos: [{ tipo: 'bolotinha', x: 14, y: 0 }] });
    const e = estadoInicial(f);
    pos(e, 1, 30, 0);
    const ev = rodar(f, e, 1.5, { x: 1 });
    expect(ev.filter((x) => x === 'estrelinha:0')).toHaveLength(2);
    expect(e.coletadas.sort()).toEqual([0, 1]);
    // P2 pega a estrelinha alta pulando
    pos(e, 1, 4, 0);
    rodar(f, e, 0.6, {}, { jump: true });
    expect(e.jogadores[1].estrelinhas).toBe(1);
    expect(e.estrelinhasCasal).toBe(3);
    // derrotar a bolotinha solta uma estrelinha que dá para pegar
    pos(e, 0, 8, 0);
    rodar(f, e, 3, (s, t) => ({ shoot: s.inimigos[0].vivo && pulso(t) }));
    expect(e.soltas).toHaveLength(1);
    pos(e, 0, e.soltas[0].x, 0);
    rodar(f, e, 0.1);
    expect(e.soltas).toHaveLength(0);
    expect(e.jogadores[0].estrelinhas).toBe(3);
    expect(e.estrelinhasCasal).toBe(4);
  });

  it('pedaço da estrela: só conclui com os dois tocando juntos', () => {
    const f = criarFase({ id: 't', plataformas: [CHAO], largura: 40, portal: { x: 10, y: 0, w: 2, h: 2 } });
    const e = estadoInicial(f);
    pos(e, 0, 11, 0); pos(e, 1, 4, 0);
    rodar(f, e, 1);
    expect(e.concluida).toBe(false);
    pos(e, 1, 10.6, 0);
    const ev = rodar(f, e, 1);
    expect(ev).toContain('pedaco');
    expect(e.concluida).toBe(true);
  });
});

describe('Fio Vermelho', () => {
  // penhasco até 10, abismo de 10 a 15, outro chão (mais baixo) de 15 a 30; fio em toda a fase
  const f = criarFase({
    id: 'fio', largura: 30, fundo: -20,
    plataformas: [{ x: -2, y: -10, w: 12, h: 10 }, { x: 15, y: -12, w: 15, h: 10 }],
    fio: [{ x0: 0, x1: 30, comprimento: 4 }],
  });
  const pendurar = () => {
    const e = estadoInicial(f);
    pos(e, 0, 9.4, 0); pos(e, 1, 8, 0);
    rodar(f, e, 0.1, { act: true });
    pos(e, 1, 10.8, 0.2);
    Object.assign(e.jogadores[1], { seguroX: 8, seguroY: 0 }); // pisou no chão pela última vez em x = 8
    const ev = rodar(f, e, 2, { act: true });
    return { e, ev };
  };

  it('não deixa se afastar mais que o comprimento: puxa o outro; quem segura não sai do lugar', () => {
    const e = estadoInicial(f);
    pos(e, 0, 2, 0); pos(e, 1, 3, 0);
    const ev = rodar(f, e, 0.1);
    expect(ev).toContain('fio-preso');
    let maxD = 0;
    rodar(f, e, 2, {}, { x: 1 }, (s) => { maxD = Math.max(maxD, dist(s)); });
    expect(maxD).toBeLessThanOrEqual(FIO.comprimento + 0.01);
    expect(e.jogadores[0].x).toBeGreaterThan(3); // foi puxado
    // segurando (mão), P1 é âncora: P2 não passa do comprimento e P1 não se mexe
    const x0 = e.jogadores[0].x;
    rodar(f, e, 1, { act: true }, { x: 1 }, (s) => { maxD = Math.max(maxD, dist(s)); });
    expect(Math.abs(e.jogadores[0].x - x0)).toBeLessThan(0.06); // só o que sobrou do próprio embalo
    expect(maxD).toBeLessThanOrEqual(FIO.comprimento + 0.01);
    expect(e.fio.ancora).toBe(0);
  });

  it('quem cai no vão fica pendurado se o outro segura', () => {
    const { e } = pendurar();
    expect(e.jogadores[1].pendurado).toBe(true);
    expect(e.fio.pendurado).toBe(1);
    expect(e.jogadores[1].y).toBeGreaterThan(-4);
    expect(e.jogadores[1].y).toBeLessThan(-1);
    expect(dist(e)).toBeCloseTo(FIO.comprimento, 0);
    expect(e.jogadores[0].x).toBeCloseTo(9.4, 3);
  });

  it('pendurado sobe pelo fio (⬆ ou segurando pulo) até a beira e desce com ⬇', () => {
    const { e } = pendurar();
    rodar(f, e, 2, { act: true }); // o balanço do começo assenta
    const y0 = e.jogadores[1].y;
    rodar(f, e, 0.6, { act: true }, { y: 1 });
    expect(e.fio.comprimento).toBeLessThan(FIO.comprimento - 1);
    const y1 = e.jogadores[1].y;
    expect(y1).toBeGreaterThan(y0 + 0.8);
    rodar(f, e, 0.4, { act: true }, { y: -1 });
    expect(e.fio.comprimento).toBeGreaterThan(FIO.comprimento - 0.6);
    expect(e.jogadores[1].y).toBeLessThan(y1 - 0.3);
    // sobe segurando pulo e empurrando para a beira
    rodar(f, e, 3, { act: true }, (s) => ({ jump: true, x: s.jogadores[1].pendurado ? -0.3 : -1 }));
    expect(e.jogadores[1].noChao).toBe(true);
    expect(e.jogadores[1].y).toBeCloseTo(0, 2);
    expect(e.jogadores[1].x).toBeLessThan(10);
  });

  it('pendurado balança com o joystick (pêndulo) e solta para alcançar o outro lado', () => {
    // ponte fina (dá para balançar por baixo dela) e, depois do abismo, uma plataforma mais baixa
    const g = criarFase({
      id: 'ponte', largura: 30, fundo: -20,
      plataformas: [{ x: -2, y: -1, w: 12, h: 1 }, { x: 14, y: -13.5, w: 16, h: 10 }],
      fio: [{ x0: 0, x1: 30, comprimento: 4 }],
    });
    const e = estadoInicial(g);
    pos(e, 0, 9.4, 0); pos(e, 1, 8, 0);
    rodar(g, e, 0.1, { act: true });
    pos(e, 1, 10.8, 0.2);
    rodar(g, e, 2, { act: true });
    expect(e.jogadores[1].pendurado).toBe(true);
    // sem bombear, o balanço vai morrendo
    let x0 = 99, x1 = -99;
    rodar(g, e, 4, { act: true });
    rodar(g, e, 2, { act: true }, {}, (s) => { x0 = Math.min(x0, s.jogadores[1].x); x1 = Math.max(x1, s.jogadores[1].x); });
    const parado = x1 - x0;
    // bombeando no sentido do movimento
    x0 = 99; x1 = -99;
    rodar(g, e, 5, { act: true }, (s) => ({ x: s.jogadores[1].vx >= 0 ? 1 : -1 }), (s) => { x0 = Math.min(x0, s.jogadores[1].x); x1 = Math.max(x1, s.jogadores[1].x); });
    expect(x1 - x0).toBeGreaterThan(parado + 4);
    expect(e.jogadores[1].pendurado).toBe(true);
    // indo para a direita, subindo e rápido: solta (mão)
    let soltou = false;
    for (let t = 0; t < 600 && !soltou; t++) {
      const j = e.jogadores[1];
      const solta = j.vx > 4 && j.vy > 0 && j.x > 12;
      passo(g, e, [{ ...N, act: true }, { ...N, act: solta, x: j.vx >= 0 ? 1 : -1 }]);
      if (e.eventos.includes('soltou:1')) soltou = true;
    }
    expect(soltou).toBe(true);
    const ev = rodar(g, e, 2, { act: true }, { x: 1 });
    expect(ev).not.toContain('caiu:1');
    expect(e.jogadores[1].noChao).toBe(true);
    expect(e.jogadores[1].x).toBeGreaterThan(14); // chegou ao outro lado
    expect(e.jogadores[1].y).toBeCloseTo(-3.5, 2);
    expect(e.fio.frouxo).toBe(true);              // longe demais: o fio fica frouxo até se reaproximarem
  });

  it('soltar o fio sobre o abismo: cai e volta ao ponto seguro', () => {
    const { e } = pendurar();
    const ev = rodar(f, e, 3, { act: true }, (_, t) => ({ act: t === 0 }));
    expect(ev).toContain('soltou:1');
    expect(ev).toContain('caiu:1');
    expect(e.jogadores[1].x).toBeLessThan(10);
  });

  it('sem âncora: quem está no chão escorrega devagar até a beira e os dois caem', () => {
    const { e } = pendurar();
    const xa = e.jogadores[0].x;
    rodar(f, e, 0.25);
    const dx = e.jogadores[0].x - xa;
    expect(dx).toBeGreaterThan(0.05);
    expect(dx).toBeLessThanOrEqual(FIO.escorrega * 0.25 + 0.02);
    const ev = rodar(f, e, 4);
    expect(ev).toContain('caiu:0');
    expect(ev).toContain('caiu:1');
  });

  it('fora da zona não há fio', () => {
    const g = criarFase({ id: 'g', plataformas: [CHAO], largura: 40, fio: [{ x0: 20, x1: 30 }] });
    const e = estadoInicial(g);
    rodar(g, e, 2, {}, { x: 1 });
    expect(e.fio.zona).toBe(-1);
    expect(dist(e)).toBeGreaterThan(6);
  });
});

describe('argolas (pêndulo)', () => {
  // chão até 6, vão de 6 a 10, chão depois; argola no teto em (6.5, 4)
  const f = criarFase({
    id: 'arg', largura: 30, fundo: -20,
    plataformas: [{ x: -2, y: -1, w: 8, h: 1 }, { x: 10, y: -1, w: 10, h: 1 }],
    argolas: [{ x: 6.5, y: 4 }],
  });
  it('agarra no ar com a mão, desce, o parceiro empurra, balança e solta com o pulo', () => {
    const e = estadoInicial(f);
    pos(e, 1, 5.5, 0);
    pos(e, 0, 6.5, 2.5);
    let ev = rodar(f, e, 0.1, { act: true });
    expect(ev).toContain('argola:0:0');
    expect(e.jogadores[0].argola).toBe(0);
    rodar(f, e, 1, { y: -1 });                 // desce pelo fio da argola
    expect(e.jogadores[0].raioArgola).toBeGreaterThan(2.4);
    expect(e.jogadores[0].y).toBeGreaterThan(0); // pendurado, não caiu
    expect(e.jogadores[0].argola).toBe(0);
    // o parceiro, na beira, empurra (aperta a mão)
    const vx0 = e.jogadores[0].vx;
    ev = rodar(f, e, 1 / 60, {}, { act: true });
    expect(ev).toContain('empurrao:1');
    expect(e.jogadores[0].vx).toBeGreaterThan(vx0 + 3);
    // bombeia e solta indo para a direita
    let solto = false;
    for (let t = 0; t < 900 && !solto; t++) {
      const j = e.jogadores[0];
      const soltar = t > 180 && j.vx > 5 && j.vy > 0 && j.x > 7.5;
      passo(f, e, [{ ...N, x: j.vx >= 0 ? 1 : -1, jump: soltar }, N]);
      if (e.eventos.includes('solta-argola:0')) solto = true;
    }
    expect(solto).toBe(true);
    expect(e.jogadores[0].argola).toBe(-1);
    ev = rodar(f, e, 2, { x: 1 });
    expect(ev).not.toContain('caiu:0');
    expect(e.jogadores[0].x).toBeGreaterThan(10);
    expect(e.jogadores[0].noChao).toBe(true);
  });
});

describe('plataformas especiais e portas', () => {
  it('móvel carrega quem está em cima', () => {
    const f = criarFase({ id: 't', largura: 40, fundo: -20, plataformas: [{ x: -2, y: -1, w: 4, h: 1 }], especiais: [{ tipo: 'movel', w: 2, h: 0.4, trajeto: [{ x: 4, y: 0 }, { x: 10, y: 0 }], vel: 2 }] });
    const e = estadoInicial(f);
    pos(e, 1, 0.5, 0);
    pos(e, 0, 5, 0.6);
    rodar(f, e, 0.2);
    expect(e.jogadores[0].plataforma).toBe(0);
    const x0 = e.jogadores[0].x;
    rodar(f, e, 1);
    expect(e.jogadores[0].x - x0).toBeCloseTo(2, 1);
    expect(e.jogadores[0].y).toBeCloseTo(0.4, 2);
    rodar(f, e, 3); // chega ao fim e volta
    expect(e.especiais[0].x).toBeLessThan(10);
    expect(e.jogadores[0].plataforma).toBe(0);
  });

  it('giratória (ponteiro) gira em círculo e leva junto', () => {
    const f = criarFase({ id: 't', largura: 40, fundo: -20, plataformas: [{ x: -2, y: -1, w: 3, h: 1 }], especiais: [{ tipo: 'giratoria', w: 2, h: 0.3, cx: 10, cy: 4, raio: 3, periodo: 12, inicio: 90 }] });
    const e = estadoInicial(f);
    pos(e, 1, 0, 0);
    pos(e, 0, 10, 7.5);
    rodar(f, e, 0.3);
    expect(e.jogadores[0].plataforma).toBe(0);
    rodar(f, e, 1.5);
    const p = e.especiais[0];
    expect(Math.hypot(p.x + 1 - 10, p.y + 0.15 - 4)).toBeCloseTo(3, 3);
    expect(p.x + 1).toBeGreaterThan(10.5); // horário: do topo vai para a direita
    expect(e.jogadores[0].plataforma).toBe(0);
    expect(e.jogadores[0].y).toBeCloseTo(p.y + 0.3, 2);
  });

  it('quicante lança para cima; atravessa-se por baixo', () => {
    const f = criarFase({ id: 't', largura: 40, plataformas: [CHAO], especiais: [{ tipo: 'quicante', x: 4, y: 0, w: 2, h: 0.3 }, { tipo: 'cai', x: 10, y: 1.2, w: 2, h: 0.3 }] });
    const e = estadoInicial(f);
    pos(e, 1, 20, 0);
    pos(e, 0, 5, 1.5);
    const ev = rodar(f, e, 0.4);
    expect(ev).toContain('quique:0');
    let maxY = 0;
    rodar(f, e, 1.5, {}, {}, (s) => { maxY = Math.max(maxY, s.jogadores[0].y); });
    expect(maxY).toBeGreaterThan(3);
    // por baixo da plataforma que cai: o pulo atravessa e pousa em cima
    pos(e, 0, 11, 0);
    rodar(f, e, 0.1);
    rodar(f, e, 0.9, { jump: true });
    expect(e.jogadores[0].plataforma).toBe(1);
    expect(e.jogadores[0].y).toBeCloseTo(1.5, 2);
  });

  it('plataforma que cai: treme, cai e volta', () => {
    const f = criarFase({ id: 't', largura: 40, plataformas: [CHAO], especiais: [{ tipo: 'cai', x: 4, y: 2, w: 2, h: 0.3, espera: 0.5, volta: 3 }] });
    const e = estadoInicial(f);
    pos(e, 1, 20, 0);
    pos(e, 0, 5, 2.4);
    let ev = rodar(f, e, 0.4);
    expect(ev).toContain('treme:0');
    ev = rodar(f, e, 0.5);
    expect(ev).toContain('cai:0');
    rodar(f, e, 0.5);
    expect(e.especiais[0].y).toBeLessThan(2);
    expect(e.jogadores[0].y).toBeLessThan(2.3);
    ev = rodar(f, e, 3);
    expect(ev).toContain('volta:0');
    expect(e.especiais[0].y).toBe(2);
    expect(e.especiais[0].ativa).toBe(true);
  });

  it('bolha sobe levando quem está em cima e estoura', () => {
    const f = criarFase({ id: 't', largura: 40, plataformas: [CHAO], especiais: [{ tipo: 'bolha', x: 4, y: 0, w: 1.2, h: 0.4, sobe: 3, vel: 1, pausa: 1 }] });
    const e = estadoInicial(f);
    pos(e, 1, 20, 0);
    pos(e, 0, 4.6, 0.5);
    rodar(f, e, 0.2);
    expect(e.jogadores[0].plataforma).toBe(0);
    rodar(f, e, 2);
    expect(e.jogadores[0].y).toBeGreaterThan(2.2);
    const ev = rodar(f, e, 1);
    expect(ev).toContain('estoura:0');
    rodar(f, e, 1.5);
    expect(e.jogadores[0].y).toBeCloseTo(0, 2);
  });

  it('porta dupla só abre com as duas placas ao mesmo tempo', () => {
    const f = criarFase({
      id: 't', largura: 40, plataformas: [CHAO],
      placas: [{ id: 'a', x: 2, y: 0, w: 1, h: 0.15, abre: 'd' }, { id: 'b', x: 6, y: 0, w: 1, h: 0.15, abre: 'd' }],
      portas: [{ id: 'd', x: 10, y: 0, w: 0.5, h: 3, modo: 'todas' }],
    });
    const e = estadoInicial(f);
    pos(e, 0, 2.5, 0); pos(e, 1, 4, 0);
    rodar(f, e, 1.5);
    expect(e.placasPressionadas.a).toBe(true);
    expect(e.portas.d).toBe(0);
    pos(e, 1, 6.5, 0);
    const ev = rodar(f, e, 1.5);
    expect(e.portas.d).toBe(1);
    expect(ev).toContain('porta-abriu:d');
    pos(e, 1, 4, 0);
    rodar(f, e, 1.5);
    expect(e.portas.d).toBe(0);
  });
});

describe('Rei-Pesadelo', () => {
  it('só sofre com o ponto fraco à mostra, muda de fase e cai com 20 pedrinhas; libera o pedaço da estrela', () => {
    const f = criarFase({ id: 'rei', largura: 40, plataformas: [CHAO], inimigos: [{ tipo: 'rei', x: 20, y: 0, alcance: 5 }], portal: { x: 1, y: 0, w: 2, h: 2 } });
    const e = estadoInicial(f);
    const evs: string[] = [];
    let defendeu = 0;
    for (let t = 0; t < 60 * 120 && e.inimigos[0].vivo; t++) {
      const r = e.inimigos[0];
      // teste da regra de dano: P1 fica a 3 m do Rei, olhando para ele, sempre protegido
      Object.assign(e.jogadores[0], { x: r.x - 3.2, y: 0, vx: 0, vy: 0, olhando: 1, invencivel: 1 });
      Object.assign(e.jogadores[1], { x: 2, y: 0, invencivel: 1 });
      passo(f, e, [{ ...N, shoot: pulso(t) }, N]);
      evs.push(...e.eventos);
      if (e.eventos.some((x) => x.startsWith('defendeu'))) defendeu++;
    }
    expect(e.inimigos[0].vivo).toBe(false);
    expect(evs.filter((x) => x === 'acerto:0')).toHaveLength(INIMIGO.rei.vida);
    expect(INIMIGO.rei.vida).toBe(20);
    expect(defendeu).toBeGreaterThan(0);
    expect(evs).toContain('chefe-fase:2');
    expect(evs).toContain('chefe-fase:3');
    expect(evs).toContain('ponto-fraco:0');
    expect(evs).toContain('esporo:0');
    expect(evs).toContain('chefe-derrotado');
    // com o Rei derrotado, o pedaço da estrela vale
    pos(e, 0, 1.5, 0); pos(e, 1, 2.5, 0);
    rodar(f, e, 1);
    expect(e.concluida).toBe(true);
  });

  it('com o Rei vivo, o pedaço da estrela não conclui', () => {
    const f = criarFase({ id: 'rei', largura: 40, plataformas: [CHAO], inimigos: [{ tipo: 'rei', x: 30, y: 0 }], portal: { x: 1, y: 0, w: 2, h: 2 } });
    const e = estadoInicial(f);
    pos(e, 0, 1.5, 0); pos(e, 1, 2.5, 0);
    rodar(f, e, 1);
    expect(e.concluida).toBe(false);
  });
});

describe('determinismo e rede', () => {
  /** entradas pseudoaleatórias reproduzíveis */
  const roteiro = (semente: number) => {
    let s = semente >>> 0;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const lista: [Input, Input][] = [];
    let atual: [Input, Input] = [N, N];
    for (let t = 0; t < 60 * 30; t++) {
      if (t % 12 === 0) {
        const um = (): Input => ({ x: r() < 0.7 ? 1 : r() < 0.5 ? -1 : 0, y: r() < 0.2 ? 1 : 0, jump: r() < 0.3, act: r() < 0.2, shoot: r() < 0.4 });
        atual = [um(), um()];
      }
      lista.push(atual);
    }
    return lista;
  };

  it('mesmas entradas, mesmo resultado (fase com todas as mecânicas)', () => {
    const ent = roteiro(42);
    const a = estadoInicial(EXEMPLO_MECANICAS), b = estadoInicial(EXEMPLO_MECANICAS);
    for (const x of ent) passo(EXEMPLO_MECANICAS, a, x);
    for (const x of ent) passo(EXEMPLO_MECANICAS, b, x);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.tick).toBe(ent.length);
  });

  it('o estado é serializável (JSON ida e volta continua a simulação igual)', () => {
    const ent = roteiro(7);
    const a = estadoInicial(EXEMPLO_MECANICAS);
    for (const x of ent.slice(0, 900)) passo(EXEMPLO_MECANICAS, a, x);
    const b: Estado = JSON.parse(JSON.stringify(a));
    for (const x of ent.slice(900)) { passo(EXEMPLO_MECANICAS, a, x); passo(EXEMPLO_MECANICAS, b, x); }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('instantâneo pequeno e fiel; o convidado reconstrói e interpola', () => {
    const ent = roteiro(3);
    const e = estadoInicial(EXEMPLO_MECANICAS);
    let maior = 0;
    let anterior = restaurar(EXEMPLO_MECANICAS, instantaneo(EXEMPLO_MECANICAS, e));
    for (let t = 0; t < ent.length; t++) {
      passo(EXEMPLO_MECANICAS, e, ent[t]);
      if (t % 3) continue;
      const s = instantaneo(EXEMPLO_MECANICAS, e);
      const txt = JSON.stringify(s);
      maior = Math.max(maior, txt.length);
      const r = restaurar(EXEMPLO_MECANICAS, JSON.parse(txt));
      for (let i = 0; i < 2; i++) {
        expect(Math.abs(r.jogadores[i].x - e.jogadores[i].x)).toBeLessThan(0.006);
        expect(r.jogadores[i].coracoes).toBe(e.jogadores[i].coracoes);
        expect(r.jogadores[i].bolha).toBe(e.jogadores[i].bolha);
      }
      expect(r.inimigos.map((n) => n.vivo)).toEqual(e.inimigos.map((n) => n.vivo));
      expect(r.especiais.map((p) => p.ativa)).toEqual(e.especiais.map((p) => p.ativa));
      r.especiais.forEach((p, k) => { expect(Math.abs(p.x - e.especiais[k].x)).toBeLessThan(0.006); expect(Math.abs(p.y - e.especiais[k].y)).toBeLessThan(0.006); });
      expect(r.estrelinhasCasal).toBe(e.estrelinhasCasal);
      expect(r.fio.zona).toBe(e.fio.zona);
      const m = interpolar(EXEMPLO_MECANICAS, anterior, r, 0.5);
      expect(m.jogadores[0].x).toBeGreaterThanOrEqual(Math.min(anterior.jogadores[0].x, r.jogadores[0].x) - 1e-9);
      expect(m.jogadores[0].x).toBeLessThanOrEqual(Math.max(anterior.jogadores[0].x, r.jogadores[0].x) + 1e-9);
      anterior = r;
    }
    expect(maior).toBeLessThan(900);
    // floresta-1 no início: bem pequeno
    expect(JSON.stringify(instantaneo(FLORESTA_1, estadoInicial(FLORESTA_1))).length).toBeLessThan(400);
  });

  it('entrada recebida pela rede é limpa', () => {
    expect(normalizarInput({ x: 5, jump: 'sim', shoot: true, act: 1 })).toEqual({ x: 1, y: 0, jump: false, act: false, shoot: true });
    expect(normalizarInput(null)).toEqual({ x: 0, y: 0, jump: false, act: false, shoot: false });
    expect(normalizarInput({ x: NaN, y: -3 })).toEqual({ x: 0, y: -1, jump: false, act: false, shoot: false });
  });
});
