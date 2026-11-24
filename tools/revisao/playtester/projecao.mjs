// O que os controles e o HUD TAPAM durante a partida, e de que tamanho os personagens aparecem.
// Joga as fases com os bots cooperativos (simulação real), refaz a câmera de src/render/cena.ts (mesmas fórmulas:
// dist = clamp(6 + sep·0,9, 7,6, 22), alvo acima do meio dos dois, lerp dt·4, fov vertical 42°) e projeta na tela
// jogadores, estrelinhas ainda não pegas, estrelinhas soltas e bichinhos vivos. Cruza com os retângulos dos botões e
// do HUD medidos no DOM (jogo.json do jogo.mjs).
// Uso: node tools/revisao/playtester/projecao.mjs --raiz <cópia> --rects <jogo.json> [--porta 4894] [--saida <dir>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pasta, subirVite } from './comum.mjs';

const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', '.'));
const saida = pasta(resolve(opt('saida', join(raiz, 'test-out/playtester'))));
const jogoJson = JSON.parse(readFileSync(resolve(opt('rects')), 'utf8'));
const vs = await subirVite(raiz, Number(opt('porta', 4894)));
const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');

const FOV = (42 * Math.PI) / 180;
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dentro = (r, x, y, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
// área circular dos botões redondos (o retângulo exagera nos cantos)
const tapa = (nome, r, x, y, m) => {
  if (['#joystick', '#bt-pulo', '#bt-tiro', '#bt-mao'].includes(nome)) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; return Math.hypot(x - cx, y - cy) <= r.w / 2 + m; }
  return dentro(r, x, y, m);
};

const res = {};
for (const [nomeAp, ap] of Object.entries(jogoJson)) {
  if (!ap.rects) continue;
  const rects = ap.rects;
  const W = nomeAp === 'android' ? 915 : 844, H = nomeAp === 'android' ? 412 : 390;
  const aspect = W / H, th = Math.tan(FOV / 2);
  res[nomeAp] = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const f = faseDoCapitulo(n);
    const cam = { x: 0, y: 0, z: 0, ok: false };
    const alturas = [], dists = [];
    let ticks = 0, jogTapado = 0;
    const tapadoPor = {};
    const estrela = new Map(); // índice → { visto, tapado }
    let inimVis = 0, inimTap = 0, soltaVis = 0, soltaTap = 0;
    const proj = (px, py) => {
      const lookY = cam.y - 0.9 - cam.z * 0.04; // lookAt(x, y - 0.9 - dist·0.04, 0)
      const phi = Math.atan2(cam.y - lookY, cam.z);
      const dx = px - cam.x, dy = py - cam.y, dz = 0 - cam.z;
      const prof = -dy * Math.sin(phi) - dz * Math.cos(phi);
      const yc = dy * Math.cos(phi) - dz * Math.sin(phi);
      return { sx: (dx / (prof * th * aspect) + 1) / 2 * W, sy: (1 - yc / (prof * th)) / 2 * H, prof };
    };
    const quem = (x, y, m) => { for (const [k, r] of Object.entries(rects)) if (tapa(k, r, x, y, m)) return k; return null; };
    jogar(f, PLANOS[f.id], {
      limite: 420,
      cada: (e) => {
        const [a, b] = e.jogadores;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
        const dist = Math.min(22, Math.max(7.6, 6 + sep * 0.9));
        const alvo = { x: mx, y: my + 2 + dist * 0.06, z: dist };
        if (!cam.ok) Object.assign(cam, alvo, { ok: true });
        else for (const k of ['x', 'y', 'z']) cam[k] += (alvo[k] - cam[k]) * (4 / 60);
        ticks++;
        dists.push(cam.z);
        // altura na tela de um corpo de 1,1 m
        const p0 = proj(a.x, a.y), p1 = proj(a.x, a.y + 1.1);
        alturas.push(p0.sy - p1.sy);
        let t = false;
        for (const j of [a, b]) {
          const c = proj(j.x, j.y + 0.55);
          const k = quem(c.sx, c.sy, 0);
          if (k) { t = true; tapadoPor[k] = (tapadoPor[k] ?? 0) + 1; }
        }
        if (t) jogTapado++;
        (f.estrelinhas ?? []).forEach((s, i) => {
          if (e.coletadas.includes(i)) return;
          const c = proj(s.x, s.y);
          if (c.sx < 0 || c.sx > W || c.sy < 0 || c.sy > H) return;
          const reg = estrela.get(i) ?? { visto: 0, tapado: 0 };
          reg.visto++; if (quem(c.sx, c.sy, 8)) reg.tapado++;
          estrela.set(i, reg);
        });
        for (const s of e.soltas) { const c = proj(s.x, s.y); if (c.sx < 0 || c.sx > W || c.sy < 0 || c.sy > H) continue; soltaVis++; if (quem(c.sx, c.sy, 8)) soltaTap++; }
        for (const m of e.inimigos) {
          if (!m.vivo) continue;
          const c = proj(m.x, m.y + 0.4);
          if (c.sx < 0 || c.sx > W || c.sy < 0 || c.sy > H) continue;
          inimVis++; if (quem(c.sx, c.sy, 6)) inimTap++;
        }
      },
    });
    const est = [...estrela.values()];
    res[nomeAp][n] = {
      ticks,
      alturaPersonagemPx: { p10: +pct(alturas, 0.1).toFixed(0), mediana: +pct(alturas, 0.5).toFixed(0), p90: +pct(alturas, 0.9).toFixed(0), min: +Math.min(...alturas).toFixed(0) },
      fracAlturaTela: +(pct(alturas, 0.5) / H).toFixed(3),
      distCamera: { mediana: +pct(dists, 0.5).toFixed(1), p90: +pct(dists, 0.9).toFixed(1), max: +Math.max(...dists).toFixed(1) },
      jogadorAtrasDeControleOuHud: +(jogTapado / ticks).toFixed(3),
      tapadoPor: Object.fromEntries(Object.entries(tapadoPor).map(([k, v]) => [k, +(v / ticks).toFixed(3)])),
      estrelinhas: { total: (f.estrelinhas ?? []).length, vistas: est.length, metadeOuMaisDoTempoTapadas: est.filter((r) => r.tapado / r.visto >= 0.5).length, fracTempoTapado: +(est.reduce((s, r) => s + r.tapado, 0) / Math.max(1, est.reduce((s, r) => s + r.visto, 0))).toFixed(3) },
      soltasFracTapadas: +(soltaTap / Math.max(1, soltaVis)).toFixed(3),
      bichinhosFracTempoTapados: +(inimTap / Math.max(1, inimVis)).toFixed(3),
    };
  }
}
writeFileSync(join(saida, 'projecao.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await vs.close();
