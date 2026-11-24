// "Janela de decolagem" de cada estrelinha (AUDITORIA_MOVIMENTO §2.3; vem de tools/revisao/auditoria-movimento/
// janela.ts). Existir um salto que pega a estrelinha não basta: o jogador precisa acertá-lo no celular. Para cada
// estrelinha, varre o ponto de decolagem a cada 5 cm em todos os chãos fixos a até 9 m e, com a simulação REAL
// (`passo`), testa os perfis (correndo e soltando ou não o joystick; parado para um lado ou para cima). A janela é o
// maior trecho contínuo de pontos que pegam a estrelinha; na corrida, metros ÷ 5,2 m/s = o tempo que o dedo tem.
// O coyote time agora é do núcleo (FISICA.coyote): quando a janela encosta na quina do lado da corrida, mede quantos
// ticks depois de sair do chão o pulo ainda pega a estrelinha (o jogador corre para fora da beira e aperta tarde).
import { DT, estadoInicial, FISICA, passo } from '../../src/core/sim';
import { INPUT_NEUTRO as N, type Estado, type Fase, type Input } from '../../src/core/types';
import { montarGrafo } from './alcance';

const MEIA = FISICA.largura / 2, ALT = FISICA.altura, R = 0.55;
const I = (x: number, jump: boolean): Input => ({ x, y: 0, jump, act: false, shoot: false });

type Perfil = { nome: string; corrida: boolean; dir: number; f: (t: number) => number };
const PERFIS: Perfil[] = [];
for (const d of [1, -1]) {
  PERFIS.push({ nome: `corre${d > 0 ? '→' : '←'}`, corrida: true, dir: d, f: () => d });
  PERFIS.push({ nome: `corre${d > 0 ? '→' : '←'}-solta`, corrida: true, dir: d, f: (t) => (t < 14 ? d : 0) });
  PERFIS.push({ nome: `parado${d > 0 ? '→' : '←'}`, corrida: false, dir: d, f: () => d });
}
PERFIS.push({ nome: 'parado↑', corrida: false, dir: 0, f: () => 0 });

const pega = (j: { x: number; y: number }, p: { x: number; y: number }) => Math.abs(p.x - j.x) <= MEIA + R && Math.abs(p.y - (j.y + ALT / 2)) <= ALT / 2 + R;

/** Pulo a partir de (x, y) com o perfil. `tarde` > 0: corre para fora da quina e aperta o pulo `tarde` ticks depois
 *  de sair do chão (o coyote do núcleo decide se ainda pula). */
function salta(f: Fase, base: Estado, x: number, y: number, p: Perfil, estrela: { x: number; y: number }, tarde = 0): boolean {
  const e = structuredClone(base);
  const j = e.jogadores[0];
  j.x = x; j.y = y; j.vx = p.corrida ? p.dir * FISICA.velAndar : 0; j.vy = 0; j.noChao = true; j.pulouSegurado = false; j.arTicks = 0;
  if (tarde > 0) {
    let fora = -1;
    for (let t = 0; t < 60; t++) {
      passo(f, e, [I(p.dir, false), N]);
      if (pega(j, estrela)) return true;
      if (!j.noChao && fora < 0) fora = t;
      if (fora >= 0 && t - fora >= tarde - 1) break;
    }
    if (fora < 0) return false;
  }
  for (let t = 0; t < 150; t++) {
    passo(f, e, [I(p.f(t), true), N]);
    if (pega(j, estrela)) return true;
    if (e.eventos.includes('caiu:0')) return false;
    if (t > 2 && j.noChao) return false;
  }
  return false;
}

export interface Janela { m: number; s: number; perfil: string; de: [number, number]; y: number; /** janela contando o pulo tardio do coyote (m) */ coyoteM: number }

/** Melhor janela de cada estrelinha (null = não sai de salto solo a partir de chão fixo). */
export function janelas(fBase: Fase): (Janela | null)[] {
  const f: Fase = { ...fBase, inimigos: [], fio: [], portas: [], placas: [], especiais: [] };
  const g = montarGrafo(fBase);
  const base = estadoInicial(f);
  base.jogadores[1].x = 0.3; base.jogadores[1].y = fBase.inicio[1].y;
  const res: (Janela | null)[] = [];
  for (const est of fBase.estrelinhas ?? []) {
    let melhor: Janela | null = null;
    for (const n of g.nos) {
      if (n.tipo !== 'fixo' || n.x1 < est.x - 9 || n.x0 > est.x + 9 || n.y > est.y + 0.6 || n.y < est.y - 6) continue;
      for (const p of PERFIS) {
        if (p.dir !== 0 && Math.sign(est.x - (n.x0 + n.x1) / 2) !== p.dir && Math.abs(est.x - (n.x0 + n.x1) / 2) > 2) continue;
        let run = 0, ini = 0, bestRun = 0, bestIni = 0;
        const passo5 = 0.05;
        for (let x = Math.max(n.x0 + 0.02, est.x - 9); x <= Math.min(n.x1 - 0.02, est.x + 9) + 1e-9; x += passo5) {
          // pegar parado em pé (sem pular) não conta como janela de salto
          const ok = pega({ x, y: n.y }, est) || salta(f, base, x, n.y + 1e-3, p, est);
          if (ok) { if (run === 0) ini = x; run++; if (run > bestRun) { bestRun = run; bestIni = ini; } } else run = 0;
        }
        if (bestRun === 0) continue;
        const m = bestRun * passo5;
        const fimJanela = bestIni + (bestRun - 1) * passo5;
        let coyoteM = m;
        const quina = p.dir > 0 ? n.x1 - 0.02 : n.x0 + 0.02;
        if (p.corrida && Math.abs((p.dir > 0 ? fimJanela : bestIni) - quina) < 0.06) {
          let extra = 0;
          for (let k = 1; k <= FISICA.coyote; k++) if (salta(f, base, quina - p.dir * 0.3, n.y + 1e-3, p, est, k)) extra = k; else break;
          coyoteM = m + extra * DT * FISICA.velAndar;
        }
        const cand: Janela = { m: +m.toFixed(2), s: +(p.corrida ? m / FISICA.velAndar : 0).toFixed(3), perfil: p.nome, de: [+bestIni.toFixed(2), +fimJanela.toFixed(2)], y: n.y, coyoteM: +coyoteM.toFixed(2) };
        // a melhor janela: compara corrida em tempo e parado em metros (0,52 m parado ≈ 0,1 s correndo)
        const valor = (w: Janela) => Math.max(w.coyoteM, w.m) * (w.perfil.startsWith('corre') ? 1 : 0.75);
        if (!melhor || valor(cand) > valor(melhor)) melhor = cand;
      }
    }
    res.push(melhor);
  }
  return res;
}
