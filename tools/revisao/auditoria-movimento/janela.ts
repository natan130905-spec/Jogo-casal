// "Janela de decolagem" de cada estrelinha: existir um salto que pega a estrelinha não basta; o jogador precisa
// acertá-lo no celular (toque, sem coyote time, e o convidado com ~200 ms de atraso). Para cada estrelinha, varre o
// ponto de decolagem a cada 5 cm em todos os chãos fixos a até 9 m e, com a simulação REAL (`passo`), testa:
//   corrida: chega a 5,2 m/s, aperta o pulo exatamente ali e segura (joystick para o mesmo lado, ou solta no ápice)
//   parado: em pé ali, pula segurando, joystick para um lado (ou nenhum)
// A janela é o maior trecho contínuo de pontos que pegam a estrelinha. Na corrida, metros ÷ 5,2 m/s = tempo que o
// dedo tem para acertar. Também mede a mesma janela COM o coyote time proposto (0,10 s: o pulo ainda sai até 6 ticks
// depois de sair da quina), emulado por fora do núcleo.
// Uso: rodar.sh janela [cap…] [--json saida.json]
import { writeFileSync } from 'node:fs';
import { CAPITULOS } from '../../../src/core/fases';
import { DT, estadoInicial, FISICA, passo } from '../../../src/core/sim';
import { INPUT_NEUTRO as N, type Estado, type Fase, type Input } from '../../../src/core/types';
import { montarGrafo } from '../../../test/fases/alcance';

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

/** Simula um salto; `atrasoCoyote` > 0: o jogador sai correndo da quina e aperta o pulo k ticks depois (coyote emulado). */
function salta(f: Fase, base: Estado, x: number, y: number, p: Perfil, estrela: { x: number; y: number }, coyote = 0): boolean {
  const e = structuredClone(base);
  const j = e.jogadores[0];
  j.x = x; j.y = y; j.vx = p.corrida ? p.dir * FISICA.velAndar : 0; j.vy = 0; j.noChao = true; j.pulouSegurado = false;
  let t0 = 0;
  if (coyote > 0) {
    // anda (correndo) até sair do chão e mais `coyote - 1` ticks no ar, depois "devolve" o chão e pula
    let fora = -1;
    for (let t = 0; t < 60; t++) {
      passo(f, e, [I(p.dir, false), N]);
      if (!j.noChao && fora < 0) fora = t;
      if (fora >= 0 && t - fora >= coyote - 1) break;
    }
    if (fora < 0 || j.vy < -FISICA.gravidade * DT * coyote - 1e-6) return false;
    j.noChao = true; j.vy = 0; t0 = 0;
  }
  for (let t = t0; t < 150; t++) {
    passo(f, e, [I(p.f(t), true), N]);
    const cx = j.x, cy = j.y + ALT / 2;
    if (Math.abs(estrela.x - cx) <= MEIA + R && Math.abs(estrela.y - cy) <= ALT / 2 + R) return true;
    if (e.eventos.some((v) => v.startsWith('caiu:0'))) return false;
    if (t > 2 && j.noChao) return false;
  }
  return false;
}

interface Janela { m: number; s: number; perfil: string; de: [number, number]; y: number; coyoteM: number; coyoteS: number }

export function janelas(fBase: Fase) {
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
        const xs: number[] = [];
        for (let x = Math.max(n.x0 + 0.02, est.x - 9); x <= Math.min(n.x1 - 0.02, est.x + 9) + 1e-9; x += passo5) xs.push(x);
        for (const x of xs) {
          // pegar parado em pé (sem pular) não conta como janela de salto
          const emPe = Math.abs(est.x - x) <= MEIA + R && Math.abs(est.y - (n.y + ALT / 2)) <= ALT / 2 + R;
          const ok = emPe || salta(f, base, x, n.y + 1e-3, p, est);
          if (ok) { if (run === 0) ini = x; run++; if (run > bestRun) { bestRun = run; bestIni = ini; } } else run = 0;
        }
        if (bestRun === 0) continue;
        const m = bestRun * passo5;
        const s = p.corrida ? m / FISICA.velAndar : NaN;
        // com coyote: se a janela encosta na quina do lado da corrida, quanto ela cresce para fora?
        let coyoteM = m;
        const fimJanela = bestIni + (bestRun - 1) * passo5;
        const quina = p.dir > 0 ? n.x1 - 0.02 : n.x0 + 0.02;
        if (p.corrida && Math.abs((p.dir > 0 ? fimJanela : bestIni) - quina) < 0.06) {
          let extra = 0;
          for (let k = 1; k <= 6; k++) if (salta(f, base, quina - p.dir * 0.3, n.y + 1e-3, p, est, k)) extra = k; else break;
          coyoteM = m + extra * DT * FISICA.velAndar;
        }
        const cand: Janela = { m: +m.toFixed(2), s: +(s || 0).toFixed(3), perfil: p.nome, de: [+bestIni.toFixed(2), +fimJanela.toFixed(2)], y: n.y, coyoteM: +coyoteM.toFixed(2), coyoteS: +(p.corrida ? coyoteM / FISICA.velAndar : 0).toFixed(3) };
        // a melhor janela: compara corrida em tempo e parado em metros (0,52 m parado ≈ 0,1 s correndo)
        const valor = (w: Janela) => (w.perfil.startsWith('corre') ? w.m : w.m * 0.75);
        if (!melhor || valor(cand) > valor(melhor)) melhor = cand;
      }
    }
    res.push(melhor);
  }
  return res;
}

if (process.argv[2] === 'janela') {
  const args = process.argv.slice(3);
  const iJson = args.indexOf('--json');
  const saida = iJson >= 0 ? args[iJson + 1] : null;
  const caps = args.filter((a, i) => /^\d$/.test(a) && (iJson < 0 || i !== iJson + 1)).map(Number);
  const todos: unknown[] = [];
  for (const f of CAPITULOS) {
    if (caps.length && !caps.includes(f.capitulo)) continue;
    const t0 = Date.now();
    const r = janelas(f);
    todos.push({ cap: f.capitulo, janelas: r });
    const est = f.estrelinhas ?? [];
    const apertadas = r.map((w, k) => ({ w, k })).filter(({ w }) => !w || w.m < 1.0).sort((a, b) => (a.w?.m ?? -1) - (b.w?.m ?? -1));
    console.log(`\n== cap ${f.capitulo}: ${est.length} estrelinhas; ${r.filter((w) => !w).length} sem salto solo a partir de chão fixo; ${apertadas.filter((a) => a.w).length} com janela < 1 m (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    for (const { w, k } of apertadas) {
      const p = est[k];
      console.log(w ? `   #${k} (${+p.x.toFixed(2)}, ${+p.y.toFixed(2)}) janela ${w.m} m${w.s ? ` = ${Math.round(w.s * 1000)} ms` : ''} ${w.perfil} de x ${w.de[0]}…${w.de[1]} (chão ${w.y.toFixed(2)})${w.coyoteM > w.m ? ` · com coyote ${w.coyoteM} m = ${Math.round(w.coyoteS * 1000)} ms` : ''}`
        : `   #${k} (${+p.x.toFixed(2)}, ${+p.y.toFixed(2)}) só com plataforma especial, superpulo ou fio`);
    }
  }
  if (saida) writeFileSync(saida, JSON.stringify(todos, null, 1));
}
