import { describe, it, expect } from 'vitest';
import { estadoInicial, passo, FISICA, PISAO, solidos } from '../src/core/sim';
import { criarFase, FLORESTA_1 } from '../src/core/fases';
import type { Estado, Fase, Input, Retangulo } from '../src/core/types';

const N: Input = { x: 0, jump: false, act: false };
const rodar = (e: Estado, seg: number, a: Partial<Input> = {}, b: Partial<Input> = {}) => {
  for (let i = 0; i < Math.round(seg * 60); i++) passo(FLORESTA_1, e, [{ ...N, ...a }, { ...N, ...b }]);
  return e;
};
/** Leva o jogador i até x (no chão): pula na beira de um vão ou quando trava num degrau. */
function irAte(e: Estado, i: number, x: number, maxSeg = 20) {
  let segurar = 0;
  for (let t = 0; t < maxSeg * 60; t++) {
    const j = e.jogadores[i];
    if (Math.abs(j.x - x) < 0.15 && j.noChao) break;
    const dir = Math.sign(x - j.x) || 1;
    const perto = Math.abs(x - j.x) < 0.6;
    const sol = solidos(FLORESTA_1, e);
    const dentro = (px: number, py: number) => sol.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    const semChaoAFrente = !dentro(j.x + dir * 0.7, j.y - 0.1);
    const paredeAFrente = dentro(j.x + dir * 0.45, j.y + 0.2);
    if (j.noChao && !perto && (semChaoAFrente || paredeAFrente)) segurar = 22;
    const inp: Input = { x: perto ? dir * 0.4 : dir, jump: segurar > 0, act: false };
    if (segurar > 0) segurar--;
    passo(FLORESTA_1, e, i === 0 ? [inp, N] : [N, inp]);
  }
  return e.jogadores[i];
}

describe('simulação', () => {
  it('os dois caem e ficam no chão inicial', () => {
    const e = rodar(estadoInicial(FLORESTA_1), 1);
    expect(e.jogadores[0].noChao).toBe(true);
    expect(e.jogadores[0].y).toBeCloseTo(0, 3);
    expect(e.jogadores[1].y).toBeCloseTo(0, 3);
  });

  it('é determinística', () => {
    const a = rodar(estadoInicial(FLORESTA_1), 3, { x: 1, jump: true }, { x: 0.5 });
    const b = rodar(estadoInicial(FLORESTA_1), 3, { x: 1, jump: true }, { x: 0.5 });
    expect(JSON.stringify(a.jogadores)).toBe(JSON.stringify(b.jogadores));
  });

  it('pulo normal não alcança a casa na árvore; o impulso de mãos dadas alcança', () => {
    const alturaNormal = FISICA.pulo ** 2 / (2 * FISICA.gravidade);
    const alturaImpulso = FISICA.impulsoPulo ** 2 / (2 * FISICA.gravidade);
    const topo = 2.6 + 0.6;
    expect(alturaNormal).toBeLessThan(topo);
    expect(alturaImpulso).toBeGreaterThan(topo + FISICA.altura * 0.2);
  });

  it('cair no vão devolve ao último ponto seguro', () => {
    const e = estadoInicial(FLORESTA_1);
    rodar(e, 0.5);
    e.jogadores[0].x = 14.8; // em cima do vão
    rodar(e, 2);
    expect(e.jogadores[0].y).toBeGreaterThanOrEqual(-0.01);
  });

  it('porteira fechada bloqueia; a placa abre; soltar fecha', () => {
    const e = estadoInicial(FLORESTA_1);
    rodar(e, 0.5);
    Object.assign(e.jogadores[0], { x: 38, y: 0 });
    Object.assign(e.jogadores[1], { x: 33.7, y: 0 }); // em cima da placa-1
    rodar(e, 3, { x: 1 });
    expect(e.portas['porteira-1']).toBe(1);
    expect(e.jogadores[0].x).toBeGreaterThan(41); // passou
    Object.assign(e.jogadores[1], { x: 36, y: 0 });
    rodar(e, 2);
    expect(e.portas['porteira-1']).toBe(0);
  });

  it('campanha da fase completa por um roteiro cooperativo', () => {
    const e = rodar(estadoInicial(FLORESTA_1), 0.5);
    // este roteiro testa placas, porteira e mãos dadas; os bichinhos têm testes próprios (mecanicas.test.ts)
    for (const n of e.inimigos) n.vivo = false;
    irAte(e, 1, 33.7);          // P2 vai para a placa-1
    irAte(e, 0, 42.3);          // P1 passa a porteira aberta e fica na placa-2
    expect(e.jogadores[0].x).toBeGreaterThan(41);
    irAte(e, 1, 49);            // P2 passa (P1 segura a placa-2)
    irAte(e, 0, 49.6);          // P1 encosta no parceiro
    expect(e.jogadores[1].x).toBeGreaterThan(44);
    rodar(e, 0.1, {}, { act: true });            // P2 dá as mãos: impulso para P1
    expect(e.jogadores[0].impulso).toBeGreaterThan(0);
    rodar(e, 1.0, { x: 1, jump: true });          // P1 sobe na casa
    expect(e.jogadores[0].y).toBeGreaterThan(3);
    Object.assign(e.jogadores[1], { x: 49.4, y: 0, vx: 0, vy: 0 }); // P2 ao lado da beirada, embaixo
    Object.assign(e.jogadores[0], { x: 50.4, y: 3.2, vx: 0, vy: 0 }); // P1 na beirada, em cima
    rodar(e, 0.05);
    rodar(e, 0.1, { act: true });                 // P1 puxa P2 pela mão
    expect(e.jogadores[1].impulso).toBeGreaterThan(0);
    rodar(e, 1.0, {}, { jump: true, x: 1 });     // P2 sobe
    expect(e.jogadores[1].y).toBeGreaterThan(3);
    irAte(e, 0, 53.6); irAte(e, 1, 53.0);         // os dois entram no portal e esperam
    rodar(e, 1);
    expect(e.concluida).toBe(true);
  });
});

// ---------- envoltória da física (AUDITORIA_MOVIMENTO.md §1, §3 e §7) ----------
// Medida na simulação real, tick a tick. Trava os números de que as fases dependem: uma mudança em FISICA que deixe
// uma estrelinha 5 cm fora do alcance quebra aqui antes de chegar ao jogador. Valores registrados em docs/NUCLEO.md.

const X0 = 100;
const I = (x: number, jump: boolean): Input => ({ x, y: 0, jump, act: false, shoot: false });
const plana = (extra: Retangulo[] = [], o: Partial<Fase> = {}) =>
  criarFase({ id: 'p', plataformas: [{ x: 0, y: -1, w: 300, h: 1 }, ...extra], fundo: -30, largura: 300, ...o });

/** jogador 0 parado em X0 (ou correndo `corrida` ticks), pula segurando `segura` ticks com joystick `dir`. */
function pulo(segura: number, dir = 0, o: { corrida?: number; impulso?: boolean } = {}) {
  const f = plana(); const e = estadoInicial(f); const j = e.jogadores[0];
  j.x = X0; j.y = 0; e.jogadores[1].x = 5;
  for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
  for (let t = 0; t < (o.corrida ?? 0); t++) passo(f, e, [I(dir, false), N]);
  if (o.impulso) j.impulso = 0.6;
  const x0 = j.x; let h = 0, t = 0;
  for (; t < 300; t++) { passo(f, e, [I(dir, t < segura), N]); h = Math.max(h, j.y); if (t > 2 && j.noChao) break; }
  return { h, tAr: (t + 1) / 60, dx: j.x - x0 };
}

/** coyote: correndo para fora da quina, até quantos ticks depois de sair do chão o pulo ainda sai? */
function coyoteMedido(): number {
  const f = criarFase({ id: 'c', plataformas: [{ x: 0, y: -1, w: X0, h: 1 }, { x: 0, y: -21, w: 300, h: 1 }], fundo: -30, largura: 300 });
  let melhor = -1;
  for (let atraso = 1; atraso <= 12; atraso++) {
    const e = estadoInicial(f); const j = e.jogadores[0];
    e.jogadores[1].x = 5; j.x = X0 - 6; j.y = 0;
    let saiu = -1, pulou = false;
    for (let t = 0; t < 200 && !pulou; t++) {
      passo(f, e, [I(1, saiu >= 0 && t - saiu === atraso), N]);
      if (saiu < 0 && !j.noChao) saiu = t;
      if (e.eventos.includes('pulo:0')) pulou = true;
    }
    if (pulou) melhor = atraso; else break;
  }
  return melhor;
}

/** buffer: apertar o pulo k ticks antes do tick em que pousa (e segurar) pula ao pousar? Maior k que funciona. */
function bufferMedido(segurar = true): number {
  const f = plana();
  let melhor = -1;
  for (let k = 1; k <= 14; k++) {
    const e = estadoInicial(f); const j = e.jogadores[0];
    e.jogadores[1].x = 5; j.x = X0; j.y = 3;
    const sombra = structuredClone(e);
    let pouso = 0;
    for (; pouso < 200; pouso++) { passo(f, sombra, [N, N]); if (sombra.jogadores[0].noChao) break; }
    let pulou = false;
    for (let t = 0; t < pouso + 20; t++) {
      const aperta = t >= pouso - k && (segurar || t === pouso - k);
      passo(f, e, [I(0, aperta), N]);
      if (e.eventos.includes('pulo:0')) pulou = true;
    }
    if (pulou) melhor = k; else break;
  }
  return melhor;
}

/** degrau de altura h colado: pulo cheio com o joystick contra a parede. Sobe? */
function sobeDegrau(h: number): boolean {
  const f = plana([{ x: X0 + 0.31, y: 0, w: 4, h }]);
  const e = estadoInicial(f); const j = e.jogadores[0];
  e.jogadores[1].x = 5; j.x = X0; j.y = 0;
  for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
  for (let t = 0; t < 90; t++) { passo(f, e, [I(1, true), N]); if (t > 3 && j.noChao) break; }
  return Math.abs(j.y - h) < 0.02;
}

/** pisão numa bolotinha caindo de 2,5 m: altura do quique acima dos pés no momento do pisão. */
function pisao(segurando: boolean): number {
  const f = plana([], { inimigos: [{ tipo: 'bolotinha', x: X0, y: 0 }] });
  const e = estadoInicial(f); const j = e.jogadores[0];
  e.jogadores[1].x = 5; j.x = X0 - 0.3; j.y = 2.5;
  let h = -Infinity, y0 = 0, viu = false;
  for (let t = 0; t < 400; t++) {
    passo(f, e, [I(0, segurando), N]);
    if (!viu && e.eventos.some((v) => v.startsWith('pisao:0'))) { viu = true; y0 = j.y; }
    if (viu) h = Math.max(h, j.y - y0);
    if (viu && j.vy < 0) break;
  }
  return h;
}

describe('envoltória do pulo (trava os números que as fases usam)', () => {
  it('pulo cheio: 1,75 m, 0,70 s no ar, 3,64 m correndo', () => {
    const p = pulo(999, 1, { corrida: 30 });
    expect(p.h).toBeCloseTo(1.75, 2); expect(p.tAr).toBeCloseTo(0.7, 2); expect(p.dx).toBeCloseTo(3.64, 1);
  });
  it('superpulo de mãos dadas: 4,40 m, 5,63 m correndo', () => {
    const p = pulo(999, 1, { corrida: 30, impulso: true });
    expect(p.h).toBeCloseTo(4.4, 2); expect(p.dx).toBeCloseTo(5.63, 1);
  });
  it('pulo mínimo generoso: qualquer toque (1 tick ou 100 ms) sobe 1,38 m (antes 0,73 m e 1,23 m)', () => {
    expect(pulo(1).h).toBeCloseTo(1.385, 2);
    expect(pulo(6).h).toBeCloseTo(1.385, 2);
    expect(pulo(1).h).toBeGreaterThan(1.25); // um toque normal vence um degrau de 1,25 m
  });
  it('altura variável continua: soltar cedo sobe menos que segurar, e o degrau de 1,5 m ainda pede segurar', () => {
    const toque = pulo(1).h, cheio = pulo(999).h;
    expect(cheio - toque).toBeGreaterThan(0.25);
    expect(toque).toBeLessThan(1.5);
    expect(pulo(12).h).toBeGreaterThan(pulo(1).h);
  });
  it('coyote time: o pulo sai até 6 ticks (0,10 s) depois de sair da quina, e não depois', () => {
    expect(coyoteMedido()).toBe(6);
  });
  it('coyote não vira pulo duplo: depois de pular, um segundo toque no ar não pula de novo', () => {
    const f = plana(); const e = estadoInicial(f); const j = e.jogadores[0];
    j.x = X0; e.jogadores[1].x = 5;
    for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
    let pulos = 0;
    for (let t = 0; t < 40; t++) { passo(f, e, [I(0, t < 2 || (t >= 4 && t < 6)), N]); if (e.eventos.includes('pulo:0')) pulos++; }
    expect(pulos).toBe(1);
  });
  it('jump buffer: apertar até 7 ticks (0,12 s) antes de pousar pula no pouso, segurando ou só tocando', () => {
    expect(bufferMedido(true)).toBe(7);
    expect(bufferMedido(false)).toBe(7);
  });
  it('quina dos pés: degrau colado de até 1,90 m sobe com o pulo cheio (antes 1,74 m); 2,0 m não', () => {
    for (const h of [1.5, 1.74, 1.8, 1.9]) expect(sobeDegrau(h), `degrau ${h}`).toBe(true);
    expect(sobeDegrau(2.0)).toBe(false);
  });
  it('quina dos pés não puxa para cima no chão: andar contra um degrau de 0,15 m não sobe', () => {
    const f = plana([{ x: X0 + 0.31, y: 0, w: 4, h: 0.15 }]);
    const e = estadoInicial(f); const j = e.jogadores[0];
    j.x = X0; e.jogadores[1].x = 5;
    for (let t = 0; t < 60; t++) passo(f, e, [I(1, false), N]);
    expect(j.y).toBeCloseTo(0, 3);
  });
  it('pisão: quica 1,27 m solto (antes 0,47 m: faltava `lancado`) e 2,7 m segurando', () => {
    // 9 m/s: 9²/(2·30) = 1,35 m na fórmula contínua; 1,275 m na integração de 60 Hz do núcleo
    expect(pisao(false)).toBeCloseTo(1.275, 2);
    expect(pisao(false)).toBeGreaterThan(PISAO.quique ** 2 / 60 - 0.1);
    expect(pisao(true)).toBeGreaterThanOrEqual(2.7);
  });
});
