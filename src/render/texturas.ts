// Texturas geradas em canvas na hora (sem baixar imagens): atlas de luz (halo, brilho, névoa, raio de sol),
// silhuetas da floresta ao fundo e a runa dourada das placas, da porteira e do portal.
import * as THREE from 'three';
import { sorteio } from './util';
import type { ChaveTema } from './tema';

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
export function texturaSilhuetas(forma: ChaveTema = 'floresta'): THREE.CanvasTexture {
  const LW = 2048, LH = 256;
  const [c, g] = canvas(LW, LH * 2);
  if (forma !== 'floresta') return silhuetasTema(c, g, LW, LH, forma);
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

/** Silhuetas dos outros mundos, no mesmo esquema de duas faixas (longe/perto) da floresta. */
function silhuetasTema(c: HTMLCanvasElement, g: CanvasRenderingContext2D, LW: number, LH: number, forma: ChaveTema): THREE.CanvasTexture {
  const rnd = sorteio(23);
  const cinza = (t: number) => `rgb(${t},${t},${t})`;
  /** desenha `f` em x e nas cópias de x ± LW (a faixa se repete sem emenda) */
  const laco = (x: number, f: (px: number) => void) => { for (const d of [-LW, 0, LW]) if (x + d > -400 && x + d < LW + 400) f(x + d); };
  for (let faixa = 0; faixa < 2; faixa++) {
    const y0 = faixa * LH, chao = y0 + LH, perto = faixa === 1, esc = perto ? 1.6 : 1;
    g.save(); g.beginPath(); g.rect(0, y0, LW, LH); g.clip();
    g.fillStyle = cinza(205);
    g.beginPath(); g.moveTo(0, chao);
    for (let x = 0; x <= LW; x += 16) g.lineTo(x, chao - 24 - 10 * Math.sin((x / LW) * Math.PI * 4) - 6 * Math.sin((x / LW) * Math.PI * 18));
    g.lineTo(LW, chao); g.fill();
    const n = perto ? 14 : 24;
    for (let i = 0; i < n; i++) {
      const x = (i + rnd() * 0.7) * (LW / n);
      const alto = (perto ? 90 + rnd() * 110 : 60 + rnd() * 120);
      const larg = (perto ? 40 + rnd() * 40 : 18 + rnd() * 24);
      const tom = 195 + Math.floor(rnd() * 30);
      const tipo = Math.floor(rnd() * 3);
      laco(x, (px) => {
        g.fillStyle = cinza(tom); g.strokeStyle = cinza(tom); g.lineCap = 'round';
        const base = chao - 10, topo = base - alto;
        switch (forma) {
          case 'brinquedos':
            if (tipo === 0) { // torre de blocos
              let y = base; for (let k = 0; k < 3 + (alto > 120 ? 2 : 0); k++) { const s = larg * (1 - k * 0.08); g.fillRect(px - s / 2 + (k % 2) * 6, y - s, s, s); y -= s; }
            } else if (tipo === 1) { // lápis gigante
              g.fillRect(px - larg * 0.3, topo + larg * 0.6, larg * 0.6, alto - larg * 0.6);
              g.beginPath(); g.moveTo(px - larg * 0.3, topo + larg * 0.6); g.lineTo(px + larg * 0.3, topo + larg * 0.6); g.lineTo(px, topo); g.fill();
            } else { // bola e ursinho
              g.beginPath(); g.arc(px, base - larg * 0.7, larg * 0.7, 0, Math.PI * 2); g.fill();
              g.beginPath(); g.arc(px, base - larg * 1.75, larg * 0.48, 0, Math.PI * 2); g.fill();
              for (const s of [-1, 1]) { g.beginPath(); g.arc(px + s * larg * 0.38, base - larg * 2.15, larg * 0.18, 0, Math.PI * 2); g.fill(); }
            }
            break;
          case 'relogio':
            if (tipo === 2) { // engrenagem
              const r = larg * 0.9, cy = base - alto * 0.5;
              g.beginPath(); g.arc(px, cy, r, 0, Math.PI * 2); g.fill();
              for (let k = 0; k < 10; k++) { g.save(); g.translate(px, cy); g.rotate((k / 10) * Math.PI * 2); g.fillRect(-r * 0.14, -r * 1.22, r * 0.28, r * 0.3); g.restore(); }
              g.fillRect(px - 4 * esc, cy, 8 * esc, base - cy);
            } else { // torre de relógio
              g.fillRect(px - larg / 2, topo + larg * 0.5, larg, alto - larg * 0.5);
              g.beginPath(); g.moveTo(px - larg * 0.62, topo + larg * 0.55); g.lineTo(px + larg * 0.62, topo + larg * 0.55); g.lineTo(px, topo - larg * 0.5); g.fill();
              g.fillStyle = cinza(Math.min(255, tom + 25)); g.beginPath(); g.arc(px, topo + larg * 1.05, larg * 0.32, 0, Math.PI * 2); g.fill();
            }
            break;
          case 'oceano':
            if (tipo === 0) { // coral ramificado
              g.lineWidth = larg * 0.22;
              const galho = (x0: number, y0: number, a: number, l: number, d: number) => {
                const x1 = x0 + Math.cos(a) * l, y1 = y0 - Math.sin(a) * l;
                g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
                if (d > 0) { galho(x1, y1, a + 0.45, l * 0.7, d - 1); galho(x1, y1, a - 0.5, l * 0.7, d - 1); }
                else { g.beginPath(); g.arc(x1, y1, larg * 0.14, 0, Math.PI * 2); g.fill(); }
              };
              galho(px, base, Math.PI / 2, alto * 0.38, 3);
            } else if (tipo === 1) { // arco de ruína
              g.fillRect(px - larg, base - alto, larg * 0.5, alto); g.fillRect(px + larg * 0.5, base - alto, larg * 0.5, alto);
              g.beginPath(); g.arc(px, base - alto, larg, Math.PI, 0); g.lineTo(px + larg * 0.5, base - alto); g.arc(px, base - alto, larg * 0.5, 0, Math.PI, true); g.fill();
            } else { // algas
              g.lineWidth = 7 * esc;
              for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(px + k * 12 * esc, base); for (let t = 0; t <= 1; t += 0.1) g.lineTo(px + k * 12 * esc + Math.sin(t * 9 + k) * 10 * esc, base - t * alto); g.stroke(); }
            }
            break;
          case 'doces':
            if (tipo === 0) { // pirulito
              g.fillRect(px - 3 * esc, base - alto + larg * 0.6, 6 * esc, alto - larg * 0.6);
              g.beginPath(); g.arc(px, base - alto + larg * 0.4, larg * 0.75, 0, Math.PI * 2); g.fill();
            } else if (tipo === 1) { // bolo / cupcake
              g.beginPath(); g.moveTo(px - larg * 0.8, base); g.lineTo(px - larg, base - alto * 0.45); g.lineTo(px + larg, base - alto * 0.45); g.lineTo(px + larg * 0.8, base); g.fill();
              for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px, base - alto * (0.45 + k * 0.17), larg * (1 - k * 0.28), Math.PI, 0); g.fill(); }
            } else { // torre de castelo de doce
              g.fillRect(px - larg / 2, base - alto, larg, alto);
              g.beginPath(); g.moveTo(px - larg * 0.7, base - alto); g.lineTo(px + larg * 0.7, base - alto); g.lineTo(px, base - alto - larg * 1.1); g.fill();
            }
            break;
          case 'espelhos': { // cristais
            const k = 2 + tipo;
            for (let m = 0; m < k; m++) {
              const dx = (m - (k - 1) / 2) * larg * 0.5, h = alto * (1 - Math.abs(m - (k - 1) / 2) * 0.25), w = larg * 0.32, inc = (m - (k - 1) / 2) * 0.12;
              g.beginPath(); g.moveTo(px + dx - w, base); g.lineTo(px + dx - w + inc * h, base - h * 0.85); g.lineTo(px + dx + inc * h * 1.1, base - h); g.lineTo(px + dx + w + inc * h, base - h * 0.85); g.lineTo(px + dx + w, base); g.fill();
            }
            break;
          }
          case 'cosmos':
            if (tipo === 0) { // planeta com anel
              const r = larg * 0.7, cy = base - alto * 0.8;
              g.beginPath(); g.arc(px, cy, r, 0, Math.PI * 2); g.fill();
              g.lineWidth = 5 * esc; g.beginPath(); g.ellipse(px, cy, r * 1.7, r * 0.35, -0.25, 0, Math.PI * 2); g.stroke();
            } else { // ilha flutuante com torrinha
              const cy = base - alto * 0.55;
              g.beginPath(); g.moveTo(px - larg, cy); g.quadraticCurveTo(px, cy - larg * 0.3, px + larg, cy); g.lineTo(px, cy + larg * 1.3); g.fill();
              if (tipo === 2) { g.fillRect(px - larg * 0.15, cy - larg * 0.9, larg * 0.3, larg * 0.9); g.beginPath(); g.moveTo(px - larg * 0.25, cy - larg * 0.9); g.lineTo(px + larg * 0.25, cy - larg * 0.9); g.lineTo(px, cy - larg * 1.4); g.fill(); }
            }
            break;
        }
      });
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

/**
 * Atlas dos efeitos de jogo (4 células de 128 px numa faixa): 0 halo macio, 1 brilho de 4 pontas (faísca),
 * 2 anel (onda do estouro), 3 nuvenzinha de esporo (com borda mais escura, para mistura normal).
 */
export function texturaEfeitos(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 128);
  // 0 halo
  {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${Math.exp(-t * t * 4.5) * (1 - t)})`); }
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  // 1 brilho: miolo forte + 4 pontas finas e curvas (a estrela da capa)
  {
    const cx = 192, cy = 64;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(128, 0, 128, 128);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? 60 : 9;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else { const am = a - Math.PI / 8, rm = 14; g.quadraticCurveTo(cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, x, y); }
    }
    g.quadraticCurveTo(cx + Math.cos(-Math.PI / 2 - Math.PI / 8) * 14, cy + Math.sin(-Math.PI / 2 - Math.PI / 8) * 14, cx, cy - 60);
    g.fill();
  }
  // 2 anel
  {
    const cx = 320, cy = 64;
    const gr = g.createRadialGradient(cx, cy, 30, cx, cy, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(256, 0, 128, 128);
  }
  // 3 esporo: bolinha fofa (três bolhas), miolo claro e borda escura
  {
    const cx = 448, cy = 64;
    for (const [dx, dy, r] of [[-14, 8, 34], [14, 6, 32], [0, -12, 36]]) {
      const gr = g.createRadialGradient(cx + dx - 6, cy + dy - 8, 2, cx + dx, cy + dy, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(200,200,200,1)'); gr.addColorStop(0.92, 'rgba(110,110,110,1)'); gr.addColorStop(1, 'rgba(110,110,110,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
