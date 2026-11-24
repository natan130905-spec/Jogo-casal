// Regras da Arena do Coração (núcleo 3D do capítulo 7): entrada, armas, poderes, vida, fases do Rei e rede.
import { describe, expect, it } from 'vitest';
import {
  ARMAS, CRISTAIS, DT, ENTRADA_NEUTRA, PODER, REI, TIRO, VIDA, direcaoNoChao, entradaParaDirecao, estadoInicialArena,
  instantaneoArena, interpolarArena, normalizarEntradaArena, passoArena, restaurarArena, trocarSolo, vidaInicioFase,
  type EntradaArena, type EstadoArena,
} from '../src/core/arena';
import { ferirRei, mudarFase } from '../src/core/arena/comum';
import { BotArena } from './arena_bot';

const N = ENTRADA_NEUTRA;
const rodar = (e: EstadoArena, seg: number, a: Partial<EntradaArena> = {}, b: Partial<EntradaArena> = {}) => {
  for (let k = 0; k < Math.round(seg / DT); k++) passoArena(e, [{ ...N, ...a }, { ...N, ...b }]);
  return e;
};
/** Rei parado (sem andar nem atacar) para medir armas. */
const calmo = (e: EstadoArena) => { e.rei.etapa = 'descanso'; e.rei.t = 999; e.rei.transicao = 0; e.rei.atordoado = 999; return e; };
/** Põe o jogador i a `d` m da borda do Rei, olhando para ele. */
const naFrenteDoRei = (e: EstadoArena, i: number, d: number) => {
  const j = e.jogadores[i];
  j.x = e.rei.x; j.z = e.rei.z + REI.raio + 0.4 + d; j.ang = Math.PI;
  e.jogadores[1 - i].x = 9; e.jogadores[1 - i].z = 0;
};
/** Aperta um botão por um tick e solta. */
const apertar = (e: EstadoArena, i: number, b: Partial<EntradaArena>) => {
  passoArena(e, i === 0 ? [{ ...N, ...b }, N] : [N, { ...N, ...b }]);
  passoArena(e, [N, N]);
};
const perda = (e: EstadoArena, f: () => void) => { const v = e.rei.vida; f(); return v - e.rei.vida; };

describe('arena: entrada', () => {
  it('normaliza a entrada vinda da rede', () => {
    expect(normalizarEntradaArena({ x: 5, y: 'a', yaw: Infinity, golpe: 1, pulo: true })).toEqual({ ...N, x: 1, pulo: true });
    const d = normalizarEntradaArena({ x: 1, y: 1 });
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6);
    expect(normalizarEntradaArena(null)).toEqual(N);
    expect(normalizarEntradaArena({ yaw: 7 }).yaw).toBeCloseTo(7 - 2 * Math.PI, 6);
  });

  it('joystick relativo à câmera (yaw = rotation.y do Three.js)', () => {
    const f = direcaoNoChao({ ...N, y: 1 });
    expect([f.x, f.z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, -1]); // para a frente = -z
    const g = direcaoNoChao({ ...N, y: 1, yaw: Math.PI / 2 });
    expect(g.x).toBeCloseTo(-1, 6); // câmera virada 90° para a esquerda: frente = -x
    const p = entradaParaDirecao(0.3, 0.4);
    const q = direcaoNoChao(p);
    expect(q.x).toBeCloseTo(0.6, 6); expect(q.z).toBeCloseTo(0.8, 6);
  });
});

describe('arena: jogadores', () => {
  it('anda, pula e cai de volta no chão', () => {
    const e = estadoInicialArena();
    rodar(e, 0.5, { x: 1 });
    expect(e.jogadores[0].x).toBeGreaterThan(-3 + 1.5);
    apertar(e, 0, { pulo: true });
    rodar(e, 0.2);
    expect(e.jogadores[0].y).toBeGreaterThan(1);
    rodar(e, 1);
    expect(e.jogadores[0].noChao).toBe(true);
    expect(e.jogadores[0].y).toBe(0);
  });

  it('golpe ≈ 3× o tiro; combo de 3; a lança alcança mais longe e é mais lenta', () => {
    const media = (g: readonly number[]) => g.reduce((a, b) => a + b, 0) / g.length;
    for (const arma of ARMAS) {
      expect(media(arma.golpes) / TIRO.dano).toBeGreaterThanOrEqual(2.5);
      expect(media(arma.golpes) / TIRO.dano).toBeLessThanOrEqual(3.5);
    }
    expect(ARMAS[1].alcance).toBeGreaterThan(ARMAS[0].alcance);
    expect(ARMAS[1].dura).toBeGreaterThan(ARMAS[0].dura);
    // medido na simulação: um golpe e um tiro de Natan
    const e = calmo(estadoInicialArena());
    naFrenteDoRei(e, 0, 0.5);
    const golpe = perda(e, () => { apertar(e, 0, { golpe: true }); rodar(e, 0.4); });
    const tiro = perda(e, () => { calmo(e); e.jogadores[0].z += 5; apertar(e, 0, { tiro: true }); rodar(e, 0.6); });
    expect(golpe).toBe(ARMAS[0].golpes[0]);
    expect(tiro).toBe(TIRO.dano);
    // combo: três toques seguidos
    const ev: string[] = [];
    const f = calmo(estadoInicialArena());
    naFrenteDoRei(f, 0, 0.3);
    for (let k = 0; k < 70; k++) { passoArena(f, [{ ...N, golpe: k % 8 < 4 }, N]); ev.push(...f.eventos); }
    expect(ev.filter((s) => s.startsWith('golpe:0:')).slice(0, 3)).toEqual(['golpe:0:0', 'golpe:0:1', 'golpe:0:2']);
    // lança: alcança a 2 m (a espada não)
    const g = calmo(estadoInicialArena());
    naFrenteDoRei(g, 1, 2);
    expect(perda(g, () => { apertar(g, 1, { golpe: true }); rodar(g, 0.5); })).toBe(ARMAS[1].golpes[0]);
    const h = calmo(estadoInicialArena());
    naFrenteDoRei(h, 0, 2);
    expect(perda(h, () => { apertar(h, 0, { golpe: true }); rodar(h, 0.5); })).toBe(0);
  });

  it('o golpe trava no Rei com o joystick solto e erra se apontado para longe', () => {
    const e = calmo(estadoInicialArena());
    naFrenteDoRei(e, 0, 0.3);
    e.jogadores[0].ang = 0; // de costas
    expect(perda(e, () => { apertar(e, 0, { golpe: true }); rodar(e, 0.4); })).toBeGreaterThan(0);
    calmo(e); rodar(e, 0.5);
    const lado = entradaParaDirecao(1, 0, { golpe: true });
    expect(perda(e, () => { apertar(e, 0, lado); rodar(e, 0.4); })).toBe(0);
  });

  it('poder ≈ 10 golpes (Corte Cometa e Jardim de Luz) e a barra enche com acertos e perto do parceiro', () => {
    for (const p of [PODER.cometa.dano, PODER.jardim.dano]) {
      expect(p / ARMAS[0].golpes[0]).toBeGreaterThanOrEqual(8);
      expect(p / ARMAS[0].golpes[0]).toBeLessThanOrEqual(12);
    }
    const e = calmo(estadoInicialArena());
    naFrenteDoRei(e, 0, 3);
    e.jogadores[0].poder = PODER.max;
    const cometa = perda(e, () => { apertar(e, 0, { poder: true }); rodar(e, 0.5); });
    expect(cometa).toBe(PODER.cometa.dano);
    expect(e.jogadores[0].poder).toBe(0);
    expect(e.rei.atordoado).toBeGreaterThan(0);
    const f = calmo(estadoInicialArena());
    f.jogadores[1].poder = PODER.max;
    f.jogadores[0].coracoes = 1;
    const jardim = perda(f, () => { apertar(f, 1, { poder: true }); rodar(f, 0.5); });
    expect(jardim).toBe(PODER.jardim.dano);
    expect(f.jogadores[0].coracoes).toBe(2); // cura o parceiro
    // perto do parceiro: enche sozinha
    const g = calmo(estadoInicialArena());
    g.jogadores[0].x = 0; g.jogadores[1].x = 1; g.jogadores[0].z = g.jogadores[1].z = 8;
    rodar(g, 2);
    expect(g.jogadores[0].poder).toBeCloseTo(2 * PODER.pertoPorSeg, 0);
  });

  it('Golpe do Fio Vermelho: os dois usam o poder a até 3 s um do outro', () => {
    const e = calmo(estadoInicialArena());
    mudarFase(e, 2); calmo(e);
    e.jogadores.forEach((j) => { j.poder = PODER.max; });
    naFrenteDoRei(e, 0, 3);
    e.jogadores[1].x = e.rei.x + 3; e.jogadores[1].z = e.rei.z;
    const ev: string[] = [];
    passoArena(e, [{ ...N, poder: true }, N]); ev.push(...e.eventos);
    expect(ev).toContain('escudo-quebra');
    rodar(e, 1);
    passoArena(e, [N, { ...N, poder: true }]); ev.push(...e.eventos);
    expect(ev).toContain('fio-vermelho');
    // passou da janela: não combina
    const f = calmo(estadoInicialArena());
    f.jogadores.forEach((j) => { j.poder = PODER.max; });
    passoArena(f, [{ ...N, poder: true }, N]);
    rodar(f, PODER.fio.janela + 0.5);
    passoArena(f, [N, { ...N, poder: true }]);
    expect(f.eventos).not.toContain('fio-vermelho');
  });

  it('esquiva: rolamento com invencibilidade curta; no último instante enche o poder', () => {
    const e = estadoInicialArena();
    e.rei.t = 999;
    e.perigos.push({ id: 900, tipo: 'esporo', forma: 'circulo', x: e.jogadores[0].x, z: e.jogadores[0].z, r: 1.3, x2: 0, z2: 0, aviso: 3 * DT, t: 0, dura: 0.15, atingiu: 0, fonte: -1 });
    passoArena(e, [{ ...N, esquiva: true }, N]);
    rodar(e, 0.3);
    expect(e.jogadores[0].coracoes).toBe(3);
    expect(e.jogadores[0].poder).toBeGreaterThanOrEqual(PODER.porEsquivaPerfeita);
    // parado: toma dano, 1 coração, invencível por 1 s
    const f = estadoInicialArena();
    f.rei.t = 999;
    f.perigos.push({ id: 900, tipo: 'esporo', forma: 'circulo', x: f.jogadores[0].x, z: f.jogadores[0].z, r: 1.3, x2: 0, z2: 0, aviso: 3 * DT, t: 0, dura: 0.15, atingiu: 0, fonte: -1 });
    rodar(f, 0.2);
    expect(f.jogadores[0].coracoes).toBe(2);
    expect(f.jogadores[0].invencivel).toBeGreaterThan(VIDA.invencivel - 0.25);
  });

  it('sem corações vira bolha e renasce ao encostar no parceiro; quem cai da borda volta como bolha', () => {
    const e = calmo(estadoInicialArena());
    e.jogadores[0].coracoes = 1;
    e.perigos.push({ id: 900, tipo: 'esporo', forma: 'circulo', x: e.jogadores[0].x, z: e.jogadores[0].z, r: 1.3, x2: 0, z2: 0, aviso: DT, t: 0, dura: 0.15, atingiu: 0, fonte: -1 });
    rodar(e, 0.1);
    expect(e.jogadores[0].bolha).toBe(true);
    rodar(e, 3);
    expect(e.jogadores[0].bolha).toBe(false);
    expect(e.jogadores[0].coracoes).toBe(3);
    // borda
    const f = calmo(estadoInicialArena());
    f.jogadores[0].x = 11.8; f.jogadores[0].z = 0;
    let k = 0;
    for (; k < 120 && !f.eventos.includes('caiu:0'); k++) passoArena(f, [{ ...N, x: 1 }, N]);
    expect(f.eventos).toContain('caiu:0');
    expect(f.jogadores[0].bolha).toBe(true);
    expect(f.jogadores[0].coracoes).toBe(2);
    expect(Math.hypot(f.jogadores[0].x - f.jogadores[1].x, f.jogadores[0].z - f.jogadores[1].z)).toBeLessThan(3);
    rodar(f, 1);
    expect(f.jogadores[0].bolha).toBe(false);
    expect(f.jogadores[0].coracoes).toBe(2);
  });
});

describe('arena: Rei-Pesadelo', () => {
  it('três fases: o dano para no limite de cada fase', () => {
    const e = calmo(estadoInicialArena());
    ferirRei(e, 99999, 0, 'teste');
    expect(e.rei.fase).toBe(2);
    expect(e.rei.vida).toBe(vidaInicioFase(2));
    expect(e.rei.escudo).toBe(true);
    // escudo: só poder ou Fio Vermelho
    e.rei.transicao = 0;
    expect(perda(e, () => ferirRei(e, 50, 0, 'golpe'))).toBe(0);
    e.rei.escudo = false;
    ferirRei(e, 99999, 0, 'teste');
    expect(e.rei.fase).toBe(3);
    expect(e.parede).toBe(1);
  });

  it('fase 3: parede de névoa; os dois cristais ao mesmo tempo derrubam a parede', () => {
    const e = calmo(estadoInicialArena());
    mudarFase(e, 3);
    rodar(e, REI.transicao + 1.5);
    expect(e.parede).toBe(2);
    // cada um do seu lado
    expect(e.jogadores[0].x).toBeLessThan(0);
    expect(e.jogadores[1].x).toBeGreaterThan(0);
    expect(perda(e, () => ferirRei(e, 10, 0, 'golpe'))).toBe(0);
    const c0 = CRISTAIS.pos[0], c1 = CRISTAIS.pos[1];
    Object.assign(e.jogadores[0], { x: c0.x, z: c0.z + 1.2, ang: Math.PI });
    Object.assign(e.jogadores[1], { x: c1.x, z: c1.z + 1.2, ang: Math.PI });
    apertar(e, 0, { golpe: true });
    rodar(e, 0.3);
    expect(e.parede).toBe(2); // só um aceso
    const ev: string[] = [];
    passoArena(e, [N, { ...N, golpe: true }]);
    for (let k = 0; k < 30; k++) { passoArena(e, [N, N]); ev.push(...e.eventos); }
    expect(ev).toContain('parede-cai');
    expect(e.rei.vulneravel).toBeGreaterThan(0);
    expect(perda(e, () => ferirRei(e, 10, 0, 'golpe'))).toBeCloseTo(10 * REI.multEstrela, 6);
  });

  it('treino: um cristal acende os dois', () => {
    const e = calmo(estadoInicialArena({ treino: true }));
    mudarFase(e, 3);
    rodar(e, REI.transicao + 1.5);
    const c0 = CRISTAIS.pos[0];
    Object.assign(e.jogadores[0], { x: c0.x, z: c0.z + 1.2, ang: Math.PI });
    const ev: string[] = [];
    passoArena(e, [{ ...N, golpe: true }, N]);
    for (let k = 0; k < 30; k++) { passoArena(e, [N, N]); ev.push(...e.eventos); }
    expect(ev).toContain('parede-cai');
  });

  it('os dois caem: recomeça só a fase atual do chefe', () => {
    const e = calmo(estadoInicialArena());
    mudarFase(e, 2); calmo(e);
    e.rei.vida -= 100;
    e.jogadores.forEach((j) => { j.coracoes = 1; });
    for (const j of e.jogadores) e.perigos.push({ id: 900 + e.perigos.length, tipo: 'esporo', forma: 'circulo', x: j.x, z: j.z, r: 1.3, x2: 0, z2: 0, aviso: DT, t: 0, dura: 0.15, atingiu: 0, fonte: -1 });
    const ev: string[] = [];
    for (let k = 0; k < 10; k++) { passoArena(e, [N, N]); ev.push(...e.eventos); }
    expect(ev).toContain('recomeca-fase:2');
    expect(e.rei.fase).toBe(2);
    expect(e.rei.vida).toBe(vidaInicioFase(2));
    expect(e.jogadores.every((j) => !j.bolha && j.coracoes === 3)).toBe(true);
  });

  it('derrotado vira vaga-lume (evento de vitória)', () => {
    const e = calmo(estadoInicialArena());
    mudarFase(e, 3); e.rei.transicao = 0; e.parede = 0;
    const ev: string[] = [];
    ferirRei(e, 99999, 0, 'golpe'); ev.push(...e.eventos);
    expect(ev).toEqual(expect.arrayContaining(['chefe-derrotado', 'vaga-lume', 'vitoria']));
    expect(e.vitoria).toBe(true);
    expect(e.vagalume).not.toBeNull();
    rodar(e, 1);
    expect(e.perigos).toEqual([]);
  });

  it('treino: o parceiro acompanha e não leva dano; trocarSolo passa o controle', () => {
    const e = estadoInicialArena({ treino: true });
    rodar(e, 3, { x: 1 });
    const [a, b] = e.jogadores;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(2.5);
    trocarSolo(e);
    expect(e.solo).toBe(1);
    const x = e.jogadores[1].x;
    rodar(e, 1, {}, { x: 1 });
    expect(e.jogadores[1].x).toBeGreaterThan(x + 2);
  });
});

describe('arena: rede', () => {
  const meioDaLuta = () => {
    const e = estadoInicialArena();
    const bots = [new BotArena(0, { acerto: 0.6, desvio: 0.7, semente: 1 }), new BotArena(1, { acerto: 0.6, desvio: 0.7, semente: 2 })];
    let maior = 0, maiorEstado = '';
    for (let k = 0; k < 120 * 60; k++) {
      passoArena(e, [bots[0].entrada(e), bots[1].entrada(e)]);
      if (k % 3 === 0) {
        const s = JSON.stringify(instantaneoArena(e));
        if (s.length > maior) { maior = s.length; maiorEstado = s; }
      }
    }
    return { e, maior, maiorEstado };
  };

  it('instantâneo compacto (≤ 2 KB mesmo no momento mais cheio) e restaurar devolve o que se desenha', () => {
    const { e, maior } = meioDaLuta();
    expect(maior).toBeLessThan(2048);
    const r = restaurarArena(instantaneoArena(e));
    expect(r.tick).toBe(e.tick);
    r.jogadores.forEach((j, i) => {
      expect(j.x).toBeCloseTo(e.jogadores[i].x, 1); expect(j.z).toBeCloseTo(e.jogadores[i].z, 1);
      expect(j.coracoes).toBe(e.jogadores[i].coracoes); expect(j.acao).toBe(e.jogadores[i].acao);
    });
    expect(r.rei.vida).toBeCloseTo(e.rei.vida, 0);
    expect(r.rei.fase).toBe(e.rei.fase);
    expect(r.perigos.map((p) => p.id)).toEqual(e.perigos.map((p) => p.id));
    expect(r.lacaios.map((p) => p.id)).toEqual(e.lacaios.map((p) => p.id));
    expect(r.pilares).toEqual(e.pilares);
    // de novo pelo instantâneo dá o mesmo
    expect(instantaneoArena(r)).toEqual(instantaneoArena(e));
  });

  it('interpolar fica entre os dois instantâneos', () => {
    const e = estadoInicialArena();
    const a = restaurarArena(instantaneoArena(e));
    rodar(e, 0.05, { x: 1 });
    const b = restaurarArena(instantaneoArena(e));
    const m = interpolarArena(a, b, 0.5);
    expect(m.jogadores[0].x).toBeGreaterThan(a.jogadores[0].x);
    expect(m.jogadores[0].x).toBeLessThan(b.jogadores[0].x);
  });
});
