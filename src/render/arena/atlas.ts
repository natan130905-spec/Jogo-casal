// Atlas dos efeitos da arena (canvas 1024 × 512, 8 × 4 células de 128 px), desenhado na hora:
// halo, brilho de 4 pontas, anel, nuvem fofa, pétala, coração, estrela de 5 pontas, faísca, algarismos 0–9 e "!".
import * as THREE from 'three';

export const C = {
  halo: 0, brilho: 1, anel: 2, nuvem: 3, petala: 4, coracao: 5, estrela: 6, faisca: 7,
  /** algarismo d = C.digito + d */
  digito: 8, exclamacao: 18, folha: 19, gota: 20,
} as const;

let atlas: THREE.CanvasTexture | null = null;

export function texturaAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d')!;
  const celula = (k: number) => [(k % 8) * 128, Math.floor(k / 8) * 128] as const;
  const radial = (cx: number, cy: number, r: number, paradas: [number, string][]) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [t, c] of paradas) gr.addColorStop(t, c);
    return gr;
  };
  // halo
  {
    const [x, y] = celula(C.halo);
    const gr = g.createRadialGradient(x + 64, y + 64, 0, x + 64, y + 64, 64);
    for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${Math.exp(-t * t * 4.5) * (1 - t)})`); }
    g.fillStyle = gr; g.fillRect(x, y, 128, 128);
  }
  // brilho de 4 pontas (curvas)
  {
    const [x, y] = celula(C.brilho), cx = x + 64, cy = y + 64;
    g.fillStyle = radial(cx, cy, 64, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(x, y, 128, 128);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? 60 : 9;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else { const am = a - Math.PI / 8; g.quadraticCurveTo(cx + Math.cos(am) * 14, cy + Math.sin(am) * 14, px, py); }
    }
    g.fill();
  }
  // anel
  {
    const [x, y] = celula(C.anel);
    g.fillStyle = radial(x + 64, y + 64, 62, [[0, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(x, y, 128, 128);
  }
  // nuvem fofa (três bolhas, miolo claro e borda mais escura: para mistura normal)
  {
    const [x, y] = celula(C.nuvem), cx = x + 64, cy = y + 64;
    for (const [dx, dy, r] of [[-16, 10, 34], [16, 8, 32], [0, -12, 38]]) {
      g.fillStyle = radial(cx + dx - 6, cy + dy - 8, r + 6, [[0, 'rgba(255,255,255,1)'], [0.65, 'rgba(225,225,225,1)'], [0.88, 'rgba(150,150,150,0.9)'], [1, 'rgba(150,150,150,0)']]);
      g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
    }
  }
  // pétala
  {
    const [x, y] = celula(C.petala), cx = x + 64, cy = y + 64;
    g.save(); g.translate(cx, cy); g.rotate(-0.5);
    g.fillStyle = radial(-10, -10, 60, [[0, '#ffffff'], [1, '#e8e8e8']]);
    g.beginPath(); g.moveTo(0, -52); g.bezierCurveTo(40, -30, 34, 30, 0, 52); g.bezierCurveTo(-34, 30, -40, -30, 0, -52); g.fill();
    g.strokeStyle = 'rgba(180,180,180,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 40); g.stroke();
    g.restore();
  }
  // coração
  {
    const [x, y] = celula(C.coracao), cx = x + 64, cy = y + 70;
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(cx, cy + 40);
    g.bezierCurveTo(cx - 70, cy - 5, cx - 30, cy - 62, cx, cy - 26);
    g.bezierCurveTo(cx + 30, cy - 62, cx + 70, cy - 5, cx, cy + 40); g.fill();
  }
  // estrela de 5 pontas
  {
    const [x, y] = celula(C.estrela), cx = x + 64, cy = y + 66;
    g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 22 : 56; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  // faísca alongada (vertical)
  {
    const [x, y] = celula(C.faisca), cx = x + 64, cy = y + 64;
    g.save(); g.translate(cx, cy); g.scale(0.16, 1);
    g.fillStyle = radial(0, 0, 60, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // algarismos e "!" (contorno escuro, miolo branco: a cor vem da partícula)
  const texto = (k: number, s: string) => {
    const [x, y] = celula(k);
    g.font = 'bold 104px system-ui, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = 'rgba(40,10,60,1)';
    g.strokeText(s, x + 64, y + 70);
    g.fillStyle = '#fff'; g.fillText(s, x + 64, y + 70);
  };
  for (let d = 0; d < 10; d++) texto(C.digito + d, String(d));
  texto(C.exclamacao, '!');
  // folhinha (para a grama que voa) e gota
  {
    const [x, y] = celula(C.folha), cx = x + 64, cy = y + 64;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, 18, 50, 0.6, 0, Math.PI * 2); g.fill();
  }
  {
    const [x, y] = celula(C.gota), cx = x + 64, cy = y + 70;
    g.fillStyle = radial(cx - 8, cy - 8, 44, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0.6)']]);
    g.beginPath(); g.moveTo(cx, cy - 56); g.bezierCurveTo(cx + 40, cy, cx + 36, cy + 40, cx, cy + 40); g.bezierCurveTo(cx - 36, cy + 40, cx - 40, cy, cx, cy - 56); g.fill();
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 2;
  return atlas;
}
