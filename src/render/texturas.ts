// Texturas geradas em canvas na hora (sem baixar imagens): atlas de luz (halo, brilho, névoa, raio de sol),
// silhuetas da floresta ao fundo e a runa dourada das placas, da porteira e do portal.
import * as THREE from 'three';
import { sorteio } from './util';

export type Celula = 'halo' | 'estrela' | 'nevoa' | 'raio';
const W = 512, H = 256;
const CELULAS: Record<Celula, [number, number, number, number]> = {
  halo: [0, 0, 128, 128], estrela: [0, 128, 128, 128], nevoa: [128, 0, 256, 128], raio: [384, 0, 128, 256],
};
/** UV (u0, v0, u1, v1) de uma célula do atlas de luz. */
export function uvCelula(c: Celula): [number, number, number, number] {
  const [x, y, w, h] = CELULAS[c];
  return [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

export function texturaLuz(): THREE.CanvasTexture {
  const [c, g] = canvas(W, H);
  // halo: gradiente radial bem suave (queda quase gaussiana)
  {
    const [x, y, w] = CELULAS.halo, r = w / 2;
    const gr = g.createRadialGradient(x + r, y + r, 0, x + r, y + r, r);
    for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${Math.exp(-t * t * 5.5) * (1 - t)})`); }
    g.fillStyle = gr; g.fillRect(x, y, w, w);
  }
  // estrela de 4 pontas com halo (vaga-lume grande, brilho do portal)
  {
    const [x, y, w] = CELULAS.estrela, r = w / 2, cx = x + r, cy = y + r;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, w);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      g.beginPath();
      g.moveTo(cx - dx * r * 0.95, cy - dy * r * 0.95); g.lineTo(cx + dy * 4, cy + dx * 4);
      g.lineTo(cx + dx * r * 0.95, cy + dy * r * 0.95); g.lineTo(cx - dy * 4, cy - dx * 4); g.closePath(); g.fill();
    }
  }
  // névoa: nuvem macia e irregular (vários halos sobrepostos)
  {
    const [x, y, w, h] = CELULAS.nevoa, rnd = sorteio(3);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let i = 0; i < 26; i++) {
      const px = x + 30 + rnd() * (w - 60), py = y + h * 0.5 + (rnd() - 0.5) * h * 0.3, r = 18 + rnd() * 30;
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
    }
    g.restore();
  }
  // raio de sol: faixa vertical, borda suave nos lados, some embaixo
  {
    const [x, y, w, h] = CELULAS.raio;
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / (w - 1), v = j / (h - 1);
      const lado = Math.pow(Math.sin(u * Math.PI), 2.2);
      const listra = 0.75 + 0.25 * Math.sin(u * 23.0 + Math.sin(u * 7) * 2);
      const a = lado * listra * Math.pow(1 - v, 1.3) * Math.min(1, v * 8 + 0.3);
      const k = (j * w + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a * 255);
    }
    g.putImageData(img, x, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Silhuetas da floresta ao fundo (duas faixas que se repetem na horizontal): em cinza claro, tingidas pela cor do
 * vértice. Faixa 0 (v 0.5–1): longe, árvores altas e finas; faixa 1 (v 0–0.5): perto, troncos grossos e copas.
 */
export function texturaSilhuetas(): THREE.CanvasTexture {
  const LW = 2048, LH = 256;
  const [c, g] = canvas(LW, LH * 2);
  const rnd = sorteio(11);
  const emLaco = (x: number, f: (dx: number) => void) => { for (const d of [-LW, 0, LW]) if (x + d > -300 && x + d < LW + 300) f(x + d); };
  const bolha = (x: number, y: number, r: number, tom: number) => {
    emLaco(x, (px) => {
      g.fillStyle = `rgb(${tom},${tom},${tom})`; g.beginPath(); g.arc(px, y, r, 0, Math.PI * 2); g.fill();
    });
  };
  for (let faixa = 0; faixa < 2; faixa++) {
    const y0 = faixa * LH, perto = faixa === 1;
    g.save(); g.beginPath(); g.rect(0, y0, LW, LH); g.clip();
    // chão ondulado
    g.fillStyle = 'rgb(205,205,205)';
    g.beginPath(); g.moveTo(0, y0 + LH);
    for (let x = 0; x <= LW; x += 16) g.lineTo(x, y0 + LH - 30 - 14 * Math.sin((x / LW) * Math.PI * 6) - 8 * Math.sin((x / LW) * Math.PI * 22));
    g.lineTo(LW, y0 + LH); g.fill();
    const n = perto ? 16 : 30;
    for (let i = 0; i < n; i++) {
      const x = (i + rnd() * 0.7) * (LW / n);
      const larg = perto ? 26 + rnd() * 30 : 8 + rnd() * 10;
      const topo = y0 + (perto ? 60 + rnd() * 50 : 30 + rnd() * 70);
      // tronco que alarga na base
      emLaco(x, (px) => {
        g.fillStyle = 'rgb(200,200,200)';
        g.beginPath(); g.moveTo(px - larg * 0.4, topo); g.lineTo(px + larg * 0.4, topo);
        g.quadraticCurveTo(px + larg * 0.5, y0 + LH - 40, px + larg * 1.3, y0 + LH); g.lineTo(px - larg * 1.3, y0 + LH);
        g.quadraticCurveTo(px - larg * 0.5, y0 + LH - 40, px - larg * 0.4, topo); g.fill();
      });
      // copa: cachos de bolhas com o topo mais claro
      const rc = perto ? 50 + rnd() * 40 : 22 + rnd() * 26;
      for (let k = 0; k < (perto ? 9 : 6); k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * rc;
        const bx = x + Math.cos(a) * d * 1.3, by = topo - rc * 0.2 + Math.sin(a) * d * 0.55;
        bolha(bx, by + 6, rc * (0.45 + rnd() * 0.35), 200);
        bolha(bx, by, rc * (0.4 + rnd() * 0.3), 225);
      }
      // trepadeiras penduradas
      if (perto) for (let k = 0; k < 4; k++) {
        const vx = x + (rnd() - 0.5) * rc * 2, vy = topo + rc * 0.2, comp = 30 + rnd() * 70;
        emLaco(vx, (px) => { g.strokeStyle = 'rgb(170,170,170)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px, vy); g.quadraticCurveTo(px + 6, vy + comp / 2, px - 2, vy + comp); g.stroke(); });
      }
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Runa dourada: círculo + estrela de 4 pontas (fundo transparente). */
export function texturaRuna(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const cx = 64, cy = 64;
  g.strokeStyle = '#fff4c8'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 54, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 45, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50, 3, 0, Math.PI * 2); g.fillStyle = '#fff4c8'; g.fill(); }
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? 38 : 9;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
