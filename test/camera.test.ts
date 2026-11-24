// Câmera por jogador (src/render/camera.ts; docs/revisao/PESQUISA_ARTE_CAMERA.md §6–7, plano #2): mede por PROJEÇÃO,
// com uma PerspectiveCamera do Three montada exatamente como o render monta (aplicarCamera), o tamanho do personagem
// na tela em todos os ticks das partidas dos bots cooperativos dos 7 capítulos, nos dois celulares (câmera do Natan
// e câmera da Bruna). Critérios: 21–25 % da altura nos quadros normais, nunca < 15 %, o próprio personagem sempre
// dentro do quadro, pulo no plano não mexe a câmera em y, e nenhuma estrelinha fica acima da tela com quem está
// em pé no chão logo abaixo dela.
// MEDIR_CAMERA=1 grava test-out/camera_medidas.json com as distribuições (antes = câmera compartilhada antiga).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAM, CameraJogador, aplicarCamera, alturaVisivel } from '../src/render/camera';
import { CAPITULOS } from '../src/core/fases/index';
import { DT, estadoInicial, passo } from '../src/core/sim';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from '../src/core/types';
import { jogar } from './fases/bot';
import { PLANOS } from './fases/planos/index';

/** Redmi Note 11 (844×390) e iPhone 14 (750×340) deitados */
const ASPECTOS = [844 / 390, 750 / 340];

function projetor(aspecto: number) {
  const cam = new THREE.PerspectiveCamera(CAM.fov, aspecto, 0.5, 400);
  const v = new THREE.Vector3();
  return { cam, ndc: (x: number, y: number) => v.set(x, y, 0).project(cam).clone() };
}

/** A câmera compartilhada antiga (cena.ts até 2026-11-24), para o "antes" das medidas. */
function cameraAntiga(aspecto: number) {
  const cam = new THREE.PerspectiveCamera(42, aspecto, 0.5, 400);
  const alvo = new THREE.Vector3(); let ini = false;
  return {
    cam,
    atualizar(e: Estado, dt: number) {
      const [a, b] = e.jogadores;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
      const dist = Math.min(22, Math.max(7.6, 6 + sep * 0.9));
      alvo.set(mx, my + 2.0 + dist * 0.06, dist);
      if (!ini) { cam.position.copy(alvo); ini = true; }
      cam.position.lerp(alvo, Math.min(1, dt * 4));
      cam.lookAt(cam.position.x, cam.position.y - 0.9 - dist * 0.04, 0);
      cam.updateMatrixWorld();
    },
  };
}

const pct = (l: number[], p: number) => { const s = [...l].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const medidas: Record<string, unknown> = {};

describe('câmera por jogador: tamanho do personagem medido por projeção nos 7 capítulos (bots)', () => {
  for (const f of CAPITULOS) {
    it(`cap. ${f.capitulo}: 21–25 % nos quadros normais, nunca < 15 %, o próprio personagem sempre no quadro`, async () => {
      const res: Record<string, unknown> = {};
      for (const asp of ASPECTOS) for (const eu of [0, 1]) {
        const c = new CameraJogador(f), p = projetor(asp), antiga = cameraAntiga(asp);
        const alt: number[] = [], normal: number[] = [], antes: number[] = [];
        const foraQuadro: string[] = [];
        let estavel = 0;
        jogar(f, PLANOS[f.id], {
          limite: 420,
          cada: (e) => {
            aplicarCamera(p.cam, c.atualizar(e, eu, asp, DT));
            const j = e.jogadores[eu];
            const pe = p.ndc(j.x, j.y), ca = p.ndc(j.x, j.y + CAM.corpo);
            const a = (ca.y - pe.y) / 2;
            alt.push(a);
            // quadro normal: o alvo é o enquadramento-base (sem parceiro afastando, sem estrelinha) há ≥ 2 s (zoom assentado)
            estavel = Math.abs(c.alvo.V - alturaVisivel(CAM.alt)) < 1e-9 && c.alvo.pes === CAM.pes ? estavel + 1 : 0;
            if (estavel >= 120) normal.push(a);
            if (!j.bolha && (pe.y < -1 || ca.y > 1 || Math.abs(pe.x) > 1) && foraQuadro.length < 5) foraQuadro.push(`tick ${e.tick} (${j.x.toFixed(1)}, ${j.y.toFixed(1)})`);
            antiga.atualizar(e, DT);
            const pa = new THREE.Vector3(j.x, j.y, 0).project(antiga.cam), qa = new THREE.Vector3(j.x, j.y + CAM.corpo, 0).project(antiga.cam);
            antes.push((qa.y - pa.y) / 2);
          },
        });
        const chave = `${asp.toFixed(2)}_eu${eu}`;
        res[chave] = {
          ticks: alt.length, normais: normal.length,
          depois: { min: Math.min(...alt), p10: pct(alt, 0.1), mediana: pct(alt, 0.5), max: Math.max(...alt) },
          normal: normal.length ? { min: Math.min(...normal), max: Math.max(...normal) } : null,
          antes: { min: Math.min(...antes), p10: pct(antes, 0.1), mediana: pct(antes, 0.5), max: Math.max(...antes) },
        };
        expect(Math.min(...alt), `${chave}: menor altura`).toBeGreaterThanOrEqual(CAM.altMin - 0.002);
        expect(normal.length / alt.length, `${chave}: fração de quadros normais`).toBeGreaterThan(0.3);
        expect(Math.min(...normal), `${chave}: normal mínimo`).toBeGreaterThanOrEqual(0.21);
        expect(Math.max(...normal), `${chave}: normal máximo`).toBeLessThanOrEqual(0.25);
        expect(foraQuadro, `${chave}: o próprio personagem saiu do quadro`).toEqual([]);
      }
      medidas[f.capitulo] = res;
      const no = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
      if (no.process?.env.MEDIR_CAMERA) {
        const fs = await import(/* @vite-ignore */ 'node:' + 'fs') as { mkdirSync(p: string, o: object): void; writeFileSync(p: string, d: string): void };
        fs.mkdirSync('test-out', { recursive: true });
        fs.writeFileSync('test-out/camera_medidas.json', JSON.stringify(medidas, null, 1));
      }
    }, 120_000);
  }
});

/** Roda a simulação com entradas fixas e devolve o enquadramento de cada tick. */
function rodar(f: Fase, e: Estado, ticks: number, ent: (t: number) => [Input, Input], c: CameraJogador, eu = 0) {
  const q: { y: number; V: number; pes: number; jy: number; noChao: boolean }[] = [];
  for (let t = 0; t < ticks; t++) {
    passo(f, e, ent(t));
    const r = c.atualizar(e, eu, ASPECTOS[0], DT);
    q.push({ y: r.yPes, V: r.V, pes: r.pes, jy: e.jogadores[eu].y, noChao: e.jogadores[eu].noChao });
  }
  return q;
}

describe('câmera por jogador: comportamento', () => {
  it('pulo no plano não muda o y da câmera (encaixe na plataforma)', () => {
    const f = CAPITULOS[0], e = estadoInicial(f), c = new CameraJogador(f);
    rodar(f, e, 120, () => [INPUT_NEUTRO, INPUT_NEUTRO], c); // assenta
    const antes = rodar(f, e, 1, () => [INPUT_NEUTRO, INPUT_NEUTRO], c)[0];
    const q = rodar(f, e, 70, (t) => [{ ...INPUT_NEUTRO, jump: t < 20 }, INPUT_NEUTRO], c);
    const noAr = q.filter((x) => !x.noChao);
    expect(Math.max(...noAr.map((x) => x.jy)) - antes.jy, 'o pulo subiu').toBeGreaterThan(1.2);
    for (const x of q) { expect(Math.abs(x.y - antes.y)).toBeLessThan(1e-6); expect(Math.abs(x.V - antes.V)).toBeLessThan(1e-6); }
  });

  it('no treino, trocar o personagem passa a seguir o outro', () => {
    const f = CAPITULOS[1], e = estadoInicial(f), c = new CameraJogador(f);
    e.jogadores[1].x += 30;
    const a = c.atualizar(e, 0, ASPECTOS[0], DT);
    c.reiniciar();
    const b = c.atualizar(e, 1, ASPECTOS[0], DT);
    expect(Math.abs(a.x - e.jogadores[0].x)).toBeLessThan(2);
    expect(Math.abs(b.x - e.jogadores[1].x)).toBeLessThan(2);
  });

  it('parceiro a 6 m: os dois no quadro; a 20 m: só eu, a 23 %', () => {
    const f = CAPITULOS[1];
    for (const [d, juntos] of [[6, true], [20, false]] as const) {
      const e = estadoInicial(f), c = new CameraJogador(f), p = projetor(ASPECTOS[0]);
      const [a, b] = e.jogadores; b.x = a.x + d; b.y = a.y;
      for (let t = 0; t < 180; t++) aplicarCamera(p.cam, c.atualizar(e, 0, ASPECTOS[0], DT));
      const nb = p.ndc(b.x, b.y + 0.55), na = p.ndc(a.x, a.y + 0.55);
      expect(Math.abs(na.x) < 1, `eu no quadro (${d} m)`).toBe(true);
      expect(Math.abs(nb.x) < 1, `parceiro no quadro (${d} m)`).toBe(juntos);
      if (!juntos) expect((p.ndc(a.x, a.y + CAM.corpo).y - p.ndc(a.x, a.y).y) / 2).toBeCloseTo(CAM.alt, 3);
      else expect((p.ndc(a.x, a.y + CAM.corpo).y - p.ndc(a.x, a.y).y) / 2).toBeGreaterThanOrEqual(CAM.altMin);
    }
  });

  it('nenhuma estrelinha fica acima da tela com o jogador em pé no chão logo abaixo dela (7 capítulos)', () => {
    const fora: string[] = [];
    for (const f of CAPITULOS) {
      (f.estrelinhas ?? []).forEach((s, k) => {
        let chao: { x: number; w: number; topo: number } | null = null;
        for (const r of f.plataformas) {
          const topo = r.y + r.h;
          if (s.x < r.x - 0.3 || s.x > r.x + r.w + 0.3 || topo > s.y - 0.2) continue;
          if (!chao || topo > chao.topo) chao = { x: r.x, w: r.w, topo };
        }
        if (!chao) return;
        const e = estadoInicial(f), c = new CameraJogador(f), p = projetor(ASPECTOS[0]);
        for (const j of e.jogadores) { j.x = Math.min(chao.x + chao.w - 0.2, Math.max(chao.x + 0.2, s.x)); j.y = chao.topo; j.noChao = true; }
        for (let t = 0; t < 240; t++) aplicarCamera(p.cam, c.atualizar(e, 0, ASPECTOS[0], DT));
        const n = p.ndc(s.x, s.y + 0.3);
        if (n.y > 1) fora.push(`cap ${f.capitulo} #${k} (${s.x}, ${s.y})`);
      });
    }
    expect(fora).toEqual([]);
  });
});
