// Envoltória do pulo medida na simulação REAL (src/core/sim.ts, passo fixo de 60 Hz), não por fórmula.
// Uso: tools/revisao/auditoria-movimento/rodar.sh envoltoria   (gera envoltoria.json ao lado)
// Mede: altura máxima e tempo no ar de cada tipo de pulo, altura × tempo segurando o botão, distância horizontal,
// e a tabela "vão × desnível" que se vence com corrida (sem coyote time: pula na última quina possível).
import { writeFileSync } from 'node:fs';
import { criarFase } from '../../../src/core/fases';
import { DT, estadoInicial, FISICA, passo, PISAO } from '../../../src/core/sim';
import { INPUT_NEUTRO, type Fase, type Input, type Retangulo } from '../../../src/core/types';

const N = INPUT_NEUTRO;
const inp = (x: number, jump: boolean, act = false): Input => ({ x, y: 0, jump, act, shoot: false });

/** chão longo em y=0 e, opcional, um alvo */
// (a simulação prende x em [0,3; largura-0,3]: tudo acontece em torno de x = 100)
const X0 = 100;
function fasePlana(extra: Retangulo[] = [], especiais: Fase['especiais'] = []): Fase {
  return criarFase({ id: 'env', plataformas: [{ x: 0, y: -1, w: 300, h: 1 }, ...extra], especiais, fundo: -30, largura: 300 });
}

interface Voo { hMax: number; tAr: number; dx: number; tApice: number; traj?: [number, number][] }
/** jogador 0 em x0 parado (ou correndo `corrida` ticks antes), pula segurando `segura` ticks, com joystick `dir`. */
function pular(o: { segura: number; dir: number; corrida?: number; impulso?: boolean; f?: Fase; x0?: number }): Voo {
  const f = o.f ?? fasePlana();
  const e = estadoInicial(f);
  const j = e.jogadores[0];
  j.x = o.x0 ?? X0; j.y = 0; e.jogadores[1].x = 5;
  // assenta
  for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
  for (let t = 0; t < (o.corrida ?? 0); t++) passo(f, e, [inp(o.dir, false), N]);
  if (o.impulso) j.impulso = 0.6;
  const x0 = j.x, y0 = j.y;
  let hMax = 0, tApice = 0, t = 0;
  const traj: [number, number][] = [[0, 0]];
  for (; t < 600; t++) {
    passo(f, e, [inp(o.dir, t < o.segura), N]);
    traj.push([+(j.x - x0).toFixed(3), +(j.y - y0).toFixed(3)]);
    if (j.y - y0 > hMax) { hMax = j.y - y0; tApice = (t + 1) * DT; }
    if (t > 2 && j.noChao) break;
  }
  return { hMax, tAr: (t + 1) * DT, dx: j.x - x0, tApice, traj };
}

/** gelatina: cai de `altura` sobre uma gelatina, mede a altura do 1º quique acima do topo dela */
function quique(segurando: boolean, forca = 15): number {
  const f = fasePlana([], [{ tipo: 'quicante', x: X0 - 1, y: 0, w: 2, h: 0.4, forca }]);
  const e = estadoInicial(f);
  const j = e.jogadores[0];
  e.jogadores[1].x = 5;
  j.x = X0; j.y = 1;
  let hMax = 0, viu = false;
  for (let t = 0; t < 400; t++) {
    passo(f, e, [inp(0, segurando), N]);
    if (e.eventos.includes('quique:0')) viu = true;
    if (viu) hMax = Math.max(hMax, j.y - 0.4);
    if (viu && j.vy < 0) break;
  }
  return hMax;
}

/** pisão: quique ao pisar num bichinho (bolotinha), altura acima dos pés no momento do pisão */
function pisao(segurando: boolean): number {
  const f = criarFase({ id: 'p', plataformas: [{ x: 0, y: -1, w: 300, h: 1 }], fundo: -30, largura: 300, inimigos: [{ tipo: 'bolotinha', x: X0, y: 0 }] });
  const e = estadoInicial(f);
  const j = e.jogadores[0];
  e.jogadores[1].x = 5;
  j.x = X0 - 0.3; j.y = 2.5; j.vy = 0;
  let hMax = -Infinity, y0 = 0, viu = false;
  for (let t = 0; t < 400; t++) {
    passo(f, e, [inp(0, segurando), N]);
    if (!viu && e.eventos.some((v) => v.startsWith('pisao:0'))) { viu = true; y0 = j.y; }
    if (viu) hMax = Math.max(hMax, j.y - y0);
    if (viu && j.vy < 0) break;
  }
  return hMax;
}

/** vence o degrau (vão `gap` horizontal entre a quina de saída e a de chegada, chegada `dh` acima)? Corrida longa,
 *  pula no último tick antes de sair da quina, segura tudo. Busca o melhor instante de pulo e de soltar o joystick. */
function venceDegrau(gap: number, dh: number, impulso = false): boolean {
  // saída: chão até x=0 (topo 0); chegada: bloco de x=gap até gap+6, topo dh (sólido até lá embaixo)
  const alvo: Retangulo = { x: X0 + gap, y: dh - 20, w: 6, h: 20 };
  const f = criarFase({ id: 'd', plataformas: [{ x: 0, y: -1, w: X0, h: 1 }, alvo], fundo: -12, largura: 300 });
  for (let atraso = 0; atraso <= 3; atraso++) {
    const e = estadoInicial(f);
    const j = e.jogadores[0];
    e.jogadores[1].x = 5; e.jogadores[1].y = 0;
    j.x = X0 - 12; j.y = 0;
    let pulou = false;
    for (let t = 0; t < 400; t++) {
      // pula quando a próxima posição já sairia do chão (quina) menos `atraso` ticks
      const vaiSair = j.x - FISICA.largura / 2 + j.vx * DT * (1 + atraso) >= X0;
      const querPular = !pulou && j.noChao && vaiSair;
      if (querPular && impulso) j.impulso = 0.6;
      passo(f, e, [inp(1, pulou || querPular), N]);
      if (querPular) pulou = true;
      if (pulou && j.noChao && j.x > X0 + gap - 0.3 && Math.abs(j.y - dh) < 0.02) return true;
      if (j.y < -8 || (pulou && j.noChao && Math.abs(j.y - dh) >= 0.02)) break;
    }
  }
  return false;
}

/** coyote: andando a 5,2 m/s para fora da quina, até quantos ticks depois de sair do chão o pulo ainda sai? */
function coyote(): number {
  const f = criarFase({ id: 'c', plataformas: [{ x: 0, y: -1, w: X0, h: 1 }, { x: 0, y: -21, w: 300, h: 1 }], fundo: -30, largura: 300 });
  let melhor = -1;
  for (let atraso = 0; atraso <= 8; atraso++) {
    const e = estadoInicial(f);
    const j = e.jogadores[0];
    e.jogadores[1].x = 5; j.x = X0 - 6; j.y = 0;
    let saiu = -1, pulou = false;
    for (let t = 0; t < 200 && !pulou; t++) {
      const quer = saiu >= 0 && t - saiu === atraso;
      passo(f, e, [inp(1, quer), N]);
      if (saiu < 0 && !j.noChao) saiu = t;
      if (e.eventos.includes('pulo:0')) pulou = true;
    }
    if (pulou) melhor = atraso;
  }
  return melhor;
}

/** buffer: apertar o pulo `k` ticks ANTES de pousar (e segurar) faz pular ao pousar? Devolve o maior k que funciona. */
function buffer(): number {
  const f = fasePlana();
  let melhor = -1;
  for (let k = 1; k <= 10; k++) {
    const e = estadoInicial(f);
    const j = e.jogadores[0];
    e.jogadores[1].x = 5; j.x = X0; j.y = 3; j.vy = 0;
    // ticks até pousar caindo de 3 m
    const sombra = structuredClone(e);
    let pouso = 0;
    for (; pouso < 200; pouso++) { passo(f, sombra, [N, N]); if (sombra.jogadores[0].noChao) break; }
    let pulou = false;
    for (let t = 0; t < pouso + 20; t++) {
      passo(f, e, [inp(0, t >= pouso - k), N]);
      if (e.eventos.includes('pulo:0')) pulou = true;
    }
    if (pulou) melhor = k;
  }
  return melhor;
}

/** quina dos pés: pulo reto com joystick para a parede de um degrau de altura h (encostado). Sobe? */
function sobeQuina(h: number): boolean {
  const f = fasePlana([{ x: X0 + 0.31, y: 0, w: 4, h }]);
  const e = estadoInicial(f);
  const j = e.jogadores[0];
  e.jogadores[1].x = 5; j.x = X0; j.y = 0;
  for (let t = 0; t < 10; t++) passo(f, e, [N, N]);
  for (let t = 0; t < 80; t++) { passo(f, e, [inp(1, true), N]); if (t > 3 && j.noChao) break; }
  return Math.abs(j.y - h) < 0.02;
}

export function envoltoria() {
  const r: Record<string, unknown> = {};
  r.coyoteTicks = coyote();
  r.bufferTicks = buffer();
  r.quinaPes = Object.fromEntries([1.5, 1.6, 1.7, 1.74, 1.76, 1.8].map((h) => [h, sobeQuina(h)]));
  r.fisica = FISICA;
  const cheio = pular({ segura: 999, dir: 0 });
  const correndo = pular({ segura: 999, dir: 1, corrida: 30 });
  const parado = pular({ segura: 999, dir: 1 });
  const sup = pular({ segura: 999, dir: 0, impulso: true });
  const supCorrendo = pular({ segura: 999, dir: 1, corrida: 30, impulso: true });
  r.trajetorias = {
    'correndo, segura': correndo.traj, 'correndo, toque 100 ms': pular({ segura: 6, dir: 1, corrida: 30 }).traj,
    'correndo, toque 17 ms': pular({ segura: 1, dir: 1, corrida: 30 }).traj, 'superpulo correndo': supCorrendo.traj,
  };
  for (const v of [cheio, correndo, parado, sup, supCorrendo]) delete v.traj;
  r.pulo = { cheio, correndo, paradoSegurandoLado: parado, superpulo: sup, superCorrendo: supCorrendo };
  // altura × ticks segurando
  const curva: { ticks: number; ms: number; h: number }[] = [];
  for (const k of [1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 36]) curva.push({ ticks: k, ms: Math.round(k * DT * 1000), h: +pular({ segura: k, dir: 0 }).hMax.toFixed(3) });
  r.alturaPorTempoSegurado = curva;
  r.quique = { solto: quique(false), segurando: quique(true) };
  r.pisao = { solto: pisao(false), segurando: pisao(true), constantes: PISAO };
  // tabela vão × desnível (normal e superpulo)
  const gaps = [0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8];
  const dhs = [-3, -2, -1, 0, 0.5, 1, 1.25, 1.5, 1.6, 1.7, 1.75, 1.8, 2, 2.5, 3, 3.5, 4, 4.25, 4.4, 4.5];
  const tab = (imp: boolean) => dhs.map((dh) => ({ dh, ok: gaps.map((g) => venceDegrau(g, dh, imp)) }));
  r.degrau = { gaps, normal: tab(false), super: tab(true) };
  // aceleração: ticks até a velocidade máxima no chão e no ar, e para parar
  r.aceleracao = {
    chaoAteMax_s: FISICA.velAndar / FISICA.acelChao, arAteMax_s: FISICA.velAndar / FISICA.acelAr,
    pararNoChao_m: (FISICA.velAndar ** 2) / (2 * FISICA.acelChao), virarNoAr_s: (2 * FISICA.velAndar) / FISICA.acelAr,
  };
  return r;
}

if (process.argv[2] === 'envoltoria') {
  const r = envoltoria();
  const out = new URL('./envoltoria.json', import.meta.url).pathname.replace(/\/dist\//, '/');
  writeFileSync(process.argv[3] ?? out, JSON.stringify(r, null, 1));
  const d = r.degrau as { gaps: number[]; normal: { dh: number; ok: boolean[] }[]; super: { dh: number; ok: boolean[] }[] };
  console.log(JSON.stringify({ coyote: r.coyoteTicks, buffer: r.bufferTicks, quina: r.quinaPes, pulo: r.pulo, curva: r.alturaPorTempoSegurado, quique: r.quique, pisao: r.pisao, acel: r.aceleracao }, null, 1));
  for (const [nome, t] of [['normal', d.normal], ['super', d.super]] as const) {
    console.log(`\n${nome}: desnível \\ vão ${d.gaps.join(' ')}`);
    for (const l of [...t].reverse()) console.log(`${String(l.dh).padStart(5)}  ${l.ok.map((v) => (v ? ' ●' : ' ·')).join(' ')}`);
  }
}
