// Bichinhos-pesadelo (fofos e emburrados, nunca assustadores), no estilo da folha de design
// `public/arte/17_bichinhos.webp`: bolotinha (bola de pelo), morcego-sono, cogumelo-bravo, espinhudo e o Rei-Pesadelo.
// Cada tipo é uma malha só (peças pintadas por vértice e juntadas) com um atributo `parte` que o shader usa para
// mexer pés, asas e mãos sem esqueleto. O rosto é uma calota com textura de canvas (4 expressões num atlas):
// 0 emburrado · 1 piscando · 2 dor (>_<) · 3 especial (cogumelo soprando, Rei tonto com o ponto fraco à mostra).
// Por bichinho: corpo (1 chamada) + contorno (1, média e alta) + rosto (1). Rei: + estrela do peito.
// Derrotar = "devolver a lembrança": incha, pisca branco e estoura em brilho (as partículas e a estrelinha solta
// vêm de cena.ts / do estado).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EstadoInimigo, Fase, TipoInimigo } from '../core/types';
import { INIMIGO } from '../core/inimigos';
import type { Qualidade } from './cena';
import { colocar, fbm, misturar, pintar } from './util';
import { Cel, type Particulas } from './particulas';

/** partes que o shader anima */
const P = { corpo: 0, peE: 1, peD: 2, asaE: 3, asaD: 4, maoE: 5, maoD: 6 } as const;

interface Forma {
  geo: THREE.BufferGeometry;
  /** contorno: só as peças grandes */
  contorno: THREE.BufferGeometry;
  /** centro e raios do "rosto" (calota) */
  rosto: { y: number; z: number; r: number; ex: number; ey: number; a: number; t0: number; t1: number };
  pal: { olho: string; sobr: string; bochecha: string; pele: string };
}

class Pecas {
  todas: THREE.BufferGeometry[] = []; grandes: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, cor: number | ((p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => void), parte: number = P.corpo, contorno = true) {
    const p = pintar(g, cor);
    p.setAttribute('parte', new THREE.Float32BufferAttribute(new Float32Array(p.getAttribute('position').count).fill(parte), 1));
    this.todas.push(p);
    if (contorno) this.grandes.push(p);
  }
  juntar(): [THREE.BufferGeometry, THREE.BufferGeometry] {
    const a = mergeGeometries(this.todas)!, b = mergeGeometries(this.grandes)!;
    for (const g of this.todas) g.dispose();
    a.computeBoundingSphere(); b.computeBoundingSphere();
    return [a, b];
  }
}

/** Esfera "de pelo": bolinhas no contorno, lisa na frente (onde fica o rosto). */
function bolaDePelo(r: number, seg: number, liso: (p: THREE.Vector3) => number) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
  const pos = g.getAttribute('position') as THREE.BufferAttribute, p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const n = p.clone().normalize();
    const tufos = Math.abs(Math.sin(n.x * 9 + n.y * 4) * Math.sin(n.y * 8 - n.z * 5) * Math.sin(n.z * 7 + n.x * 3));
    const k = 1 + (0.1 * Math.pow(tufos, 0.6) + fbm(n.x * 3, n.y * 3, n.z * 3) * 0.05) * (1 - liso(n));
    pos.setXYZ(i, p.x * k, p.y * k, p.z * k);
  }
  g.computeVertexNormals();
  return g;
}

const pe = (pc: Pecas, x: number, y: number, z: number, r: number, cor: number, parte: number) => {
  const g = new THREE.SphereGeometry(r, 10, 7); colocar(g, x, y + r * 0.6, z, [1, 0.62, 1.25]); pc.add(g, cor, parte);
};

function formaBolotinha(): Forma {
  const pc = new Pecas();
  const { w, h } = INIMIGO.bolotinha;
  const R = h * 0.5;
  const corpo = bolaDePelo(R, 22, (n) => THREE.MathUtils.smoothstep(n.z, 0.45, 0.8) * THREE.MathUtils.smoothstep(n.y, -0.55, -0.2) * THREE.MathUtils.smoothstep(-n.y, -0.65, -0.3));
  colocar(corpo, 0, R + 0.04, 0, [w / h, 1, 0.95]);
  pc.add(corpo, (p, n, c) => misturar(c, 0x4e2a7a, 0xa47ad8, 0.35 + n.y * 0.4 + Math.max(0, -p.x) * 0.2));
  for (const s of [-1, 1]) pe(pc, s * 0.17, 0, 0.05, 0.09, 0x2e1a48, s < 0 ? P.peE : P.peD);
  // tufinho no topo
  const t = new THREE.ConeGeometry(0.06, 0.14, 6); colocar(t, 0.03, 2 * R + 0.07, 0, 1, [0, 0, -0.4]); pc.add(t, 0x9a70d0, P.corpo, false);
  const [geo, contorno] = pc.juntar();
  return { geo, contorno, rosto: { y: R + 0.04, z: 0, r: R * 0.96, ex: w / h, ey: 1, a: 0.75, t0: 1.05, t1: 2.15 }, pal: { olho: '#e8344a', sobr: '#2a1240', bochecha: 'rgba(255,120,170,0.55)', pele: '#8a5ec0' } };
}

function formaMorcego(): Forma {
  const pc = new Pecas();
  const R = 0.2, cy = 0.27;
  const corpo = new THREE.SphereGeometry(R, 18, 14); colocar(corpo, 0, cy, 0, [1.05, 1, 0.95]);
  pc.add(corpo, (_p, n, c) => misturar(c, 0x3e2468, 0x8a64c0, 0.4 + n.y * 0.4));
  const barriga = new THREE.SphereGeometry(R * 0.6, 10, 8); colocar(barriga, 0, cy - R * 0.45, R * 0.55, [1, 0.9, 0.5]); pc.add(barriga, 0xb89ae0, P.corpo, false);
  for (const s of [-1, 1]) {
    // orelhas grandes, rosadas por dentro
    const o = new THREE.ConeGeometry(0.08, 0.2, 8); colocar(o, s * 0.12, cy + R + 0.06, -0.01, [1, 1, 0.5], [0, 0, -s * 0.35]); pc.add(o, (_p, n, c) => c.setHex(n.z > 0.3 ? 0xf08ab8 : 0x5a3a90));
    // asa: membrana recortada (forma extrudada fina), girando no ombro
    const f = new THREE.Shape();
    f.moveTo(0, 0.05); f.lineTo(0.16, 0.14); f.lineTo(0.36, 0.1);
    f.quadraticCurveTo(0.3, 0.0, 0.31, -0.06); f.quadraticCurveTo(0.24, -0.02, 0.2, -0.08); f.quadraticCurveTo(0.14, -0.03, 0.08, -0.07); f.quadraticCurveTo(0.05, -0.02, 0, -0.04);
    const asa = new THREE.ExtrudeGeometry(f, { depth: 0.02, bevelEnabled: false, curveSegments: 4 });
    if (s < 0) asa.scale(-1, 1, 1);
    colocar(asa, s * R * 0.8, cy + 0.02, -0.04);
    pc.add(asa, (p, _n, c) => misturar(c, 0x5a3a90, 0xd078b0, Math.min(1, Math.abs(p.x) * 2.2)), s < 0 ? P.asaE : P.asaD);
    pe(pc, s * 0.07, 0.02, 0.02, 0.045, 0x2e1a48, s < 0 ? P.peE : P.peD);
  }
  const tufo = new THREE.SphereGeometry(0.05, 6, 5); colocar(tufo, 0, cy + R * 0.95, 0.02); pc.add(tufo, 0x9a74d0, P.corpo, false);
  const [geo, contorno] = pc.juntar();
  return { geo, contorno, rosto: { y: cy, z: 0, r: R * 1.01, ex: 1.05, ey: 1, a: 0.85, t0: 0.95, t1: 2.25 }, pal: { olho: '#e8344a', sobr: '#24103a', bochecha: 'rgba(255,120,170,0.45)', pele: '#6a4aa0' } };
}

function formaCogumelo(): Forma {
  const pc = new Pecas();
  const { h } = INIMIGO.cogumelo;
  // pé (o corpo com o rosto)
  const pe0 = new THREE.SphereGeometry(0.24, 18, 14); colocar(pe0, 0, 0.27, 0, [1.05, 1.05, 0.95]);
  pc.add(pe0, (_p, n, c) => misturar(c, 0xd8b498, 0xfff0e0, 0.45 + n.y * 0.35));
  // chapéu magenta com pintas lilás
  const R = 0.45, cy = h * 0.55;
  const cap = new THREE.SphereGeometry(R, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2); colocar(cap, 0, cy, 0, [1, 0.72, 1]);
  const pintas = [[0.3, 0.6], [1.5, 0.9], [2.6, 0.5], [3.8, 0.85], [5.0, 0.55], [0.9, 0.25], [4.4, 0.3], [2.1, 0.2]];
  pc.add(cap, (p, n, c) => {
    misturar(c, 0x8a1848, 0xe03a78, 0.35 + n.y * 0.6);
    const th = Math.acos(Math.min(1, Math.max(-1, (p.y - cy) / (R * 0.72)))), ph = Math.atan2(p.z, p.x) + Math.PI;
    for (const [a, t] of pintas) if (Math.hypot((ph - a) * Math.sin(th + 0.2), th - t) < 0.24) { misturar(c, 0xb890f0, 0xe0c8ff, n.y); break; }
  });
  const lam = new THREE.CylinderGeometry(R * 0.98, R * 0.4, 0.07, 22, 1, true); colocar(lam, 0, cy - 0.035, 0);
  pc.add(lam, (p, _n, c) => c.setHex(Math.sin(Math.atan2(p.z, p.x) * 22) > 0 ? 0xe8c8a8 : 0xd0a888), P.corpo, false);
  for (const s of [-1, 1]) {
    pe(pc, s * 0.13, 0, 0.04, 0.07, 0x4a2a3a, s < 0 ? P.peE : P.peD);
    const b = new THREE.SphereGeometry(0.06, 8, 6); colocar(b, s * 0.25, 0.22, 0.02); pc.add(b, 0xe8c8b0, s < 0 ? P.maoE : P.maoD);
  }
  const [geo, contorno] = pc.juntar();
  return { geo, contorno, rosto: { y: 0.27, z: 0, r: 0.24 * 1.01, ex: 1.05, ey: 1.05, a: 0.8, t0: 1.25, t1: 2.35 }, pal: { olho: '#d8304a', sobr: '#4a2020', bochecha: 'rgba(255,120,140,0.6)', pele: '#f2dcc6' } };
}

function formaEspinhudo(): Forma {
  const pc = new Pecas();
  const { w, h } = INIMIGO.espinhudo;
  const R = h * 0.47;
  const corpo = bolaDePelo(R, 20, (n) => THREE.MathUtils.smoothstep(n.z, 0.5, 0.8) * THREE.MathUtils.smoothstep(n.y, -0.6, -0.3) * THREE.MathUtils.smoothstep(-n.y, -0.5, -0.15));
  colocar(corpo, 0, R * 0.92, 0, [w / h * 1.05, 0.95, 0.95]);
  pc.add(corpo, (_p, n, c) => misturar(c, 0x4a2a78, 0x9a70d8, 0.4 + n.y * 0.4));
  // espinhos de cristal nas costas e no alto (não na frente do rosto)
  let k = 0;
  for (let fila = 0; fila < 4; fila++) {
    const el = 0.35 + fila * 0.32;
    const n = 7 - fila;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + (i + (fila % 2) * 0.5) / n * 1.7) + Math.PI; // gira de um lado ao outro, por trás
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      if (d.z > 0.35 && d.y < 0.7) continue;
      const l = 0.22 + ((k++ * 37) % 7) * 0.015;
      const c = new THREE.ConeGeometry(0.075, l, 5); c.translate(0, l / 2, 0);
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().add(new THREE.Vector3(0, 0, -0.35)).normalize()));
      c.translate(d.x * R * w / h * 0.9, R * 0.92 + d.y * R * 0.85, d.z * R * 0.85);
      pc.add(c, (p, _n, cc) => misturar(cc, 0x6a3aa8, 0xe0b8ff, Math.min(1, (p.y - R * 0.6) * 1.6)));
    }
  }
  for (const s of [-1, 1]) pe(pc, s * 0.2, 0, 0.06, 0.085, 0x2e1a48, s < 0 ? P.peE : P.peD);
  const [geo, contorno] = pc.juntar();
  return { geo, contorno, rosto: { y: R * 0.92, z: 0, r: R * 0.97, ex: w / h * 1.05, ey: 0.95, a: 0.7, t0: 1.2, t1: 2.25 }, pal: { olho: '#e8344a', sobr: '#24103a', bochecha: 'rgba(255,120,170,0.45)', pele: '#7a54b4' } };
}

function formaRei(): Forma {
  const pc = new Pecas();
  const nuvem = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => {
    misturar(c, 0x2a1450, 0x6a40a8, 0.35 + n.y * 0.35 + Math.max(0, n.x) * 0.15);
    const espiral = Math.sin(Math.atan2(n.y, n.x) * 3 + Math.hypot(p.x, p.y) * 5);
    if (espiral > 0.75) misturar(c, c.getHex(), 0xb890f0, (espiral - 0.75) * 3);
  };
  // massa de nuvem: base larga em rolos, tronco e cabeça
  const bolas: [number, number, number, number][] = [
    [0, 0.45, 0.1, 0.62], [-0.75, 0.38, 0, 0.45], [0.75, 0.38, 0, 0.45], [-0.4, 0.3, 0.45, 0.35], [0.45, 0.3, 0.45, 0.35],
    [0, 1.15, 0, 0.72], [-0.55, 1.2, -0.1, 0.42], [0.55, 1.2, -0.1, 0.42], [0, 1.95, 0, 0.66], [-0.5, 2.15, -0.15, 0.32], [0.5, 2.15, -0.15, 0.32],
  ];
  for (const [x, y, z, r] of bolas) { const g = new THREE.SphereGeometry(r, 16, 12); colocar(g, x, y, z); pc.add(g, nuvem); }
  // rolos de fumaça (espirais) nos lados
  for (const s of [-1, 1]) for (const [y, r] of [[0.9, 0.26], [1.6, 0.22]] as const) {
    const t = new THREE.TorusGeometry(r, r * 0.38, 6, 14, Math.PI * 1.5); colocar(t, s * 1.0, y, -0.05, 1, [0, 0, s < 0 ? 0 : Math.PI]); pc.add(t, nuvem, P.corpo, false);
  }
  // bigode lilás
  for (const s of [-1, 1]) {
    const b = new THREE.CapsuleGeometry(0.09, 0.32, 3, 8); colocar(b, s * 0.22, 1.66, 0.6, 1, [0, -s * 0.3, s * 1.2]); pc.add(b, (_p, n, c) => misturar(c, 0xb890e0, 0xe8d8ff, 0.4 + n.y * 0.5), P.corpo, false);
    const ponta = new THREE.SphereGeometry(0.09, 8, 6); colocar(ponta, s * 0.42, 1.74, 0.52); pc.add(ponta, 0xc8a8f0, P.corpo, false);
  }
  // coroa dourada com gemas
  const coroa = new THREE.CylinderGeometry(0.42, 0.36, 0.26, 16, 1, true); colocar(coroa, 0, 2.62, -0.02, [1, 1, 0.9]);
  pc.add(coroa, (_p, n, c) => misturar(c, 0xc08a20, 0xffe070, 0.4 + n.y * 0.4 + Math.max(0, n.z) * 0.2));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const p = new THREE.ConeGeometry(0.08, 0.24, 6); colocar(p, Math.cos(a) * 0.4, 2.85, Math.sin(a) * 0.36); pc.add(p, 0xf0c040, P.corpo, false);
    const b = new THREE.SphereGeometry(0.05, 6, 5); colocar(b, Math.cos(a) * 0.4, 2.98, Math.sin(a) * 0.36); pc.add(b, 0xffe080, P.corpo, false);
  }
  const gema = new THREE.OctahedronGeometry(0.1, 0); colocar(gema, 0, 2.62, 0.4, [0.8, 1, 0.4]); pc.add(gema, 0xa050f0, P.corpo, false);
  // mãos com braceletes de ouro
  for (const s of [-1, 1]) {
    const parte = s < 0 ? P.maoE : P.maoD;
    const m = new THREE.SphereGeometry(0.22, 12, 9); colocar(m, s * 0.85, 1.25, 0.55, [1, 0.85, 0.9]); pc.add(m, (_p, n, c) => misturar(c, 0x9a70d0, 0xd0b0ff, 0.4 + n.y * 0.4), parte);
    for (let d = 0; d < 3; d++) { const dd = new THREE.CapsuleGeometry(0.05, 0.1, 2, 6); colocar(dd, s * (0.78 + d * 0.07), 1.45, 0.62, 1, [0.3, 0, -s * 0.3]); pc.add(dd, 0xb890e8, parte, false); }
    const br = new THREE.TorusGeometry(0.17, 0.06, 6, 14); colocar(br, s * 0.92, 1.08, 0.48, 1, [Math.PI / 2 - 0.4, 0, s * 0.3]); pc.add(br, (_p, n, c) => misturar(c, 0xc08a20, 0xffe070, 0.5 + n.y * 0.5), parte, false);
  }
  const [geo, contorno] = pc.juntar();
  return { geo, contorno, rosto: { y: 1.95, z: 0, r: 0.665, ex: 1, ey: 1, a: 0.7, t0: 1.05, t1: 2.0 }, pal: { olho: '#e8344a', sobr: '#1a0a30', bochecha: 'rgba(255,110,170,0.35)', pele: '#4a2a80' } };
}

const FORMAS: Record<TipoInimigo, () => Forma> = { bolotinha: formaBolotinha, morcego: formaMorcego, cogumelo: formaCogumelo, espinhudo: formaEspinhudo, rei: formaRei };

// ---------------------------------------------------------------- rosto
const QUADROS = 4;
function texturaRosto(tipo: TipoInimigo, f: Forma): THREE.CanvasTexture {
  const T = 256;
  const c = document.createElement('canvas'); c.width = T * QUADROS; c.height = T;
  const g = c.getContext('2d')!;
  const { a, t0, t1 } = f.rosto;
  const px = (ang: number) => ((ang + a) / (2 * a)) * T;
  const py = (th: number) => ((th - t0) / (t1 - t0)) * T;
  const olhoY = py(Math.PI / 2 + (tipo === 'rei' ? -0.02 : 0.02)), dx = tipo === 'rei' ? 0.3 : 0.32;
  const olhos = [px(-dx), px(dx)];
  const OW = tipo === 'rei' ? 30 : 34, OH = tipo === 'rei' ? 24 : 30;
  const bocaY = olhoY + (tipo === 'rei' ? 70 : 58);
  for (let q = 0; q < QUADROS; q++) {
    g.save(); g.translate(q * T, 0);
    g.fillStyle = f.pal.pele; g.fillRect(0, 0, T, T);
    // bochechas
    for (const x of olhos) {
      const bx = x + (x < T / 2 ? -14 : 14), by = olhoY + 38;
      const gr = g.createRadialGradient(bx, by, 2, bx, by, 26); gr.addColorStop(0, f.pal.bochecha); gr.addColorStop(1, 'rgba(255,120,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, T, T);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const sono = tipo === 'morcego';
    olhos.forEach((x, k) => {
      const s = k === 0 ? -1 : 1;
      if (q === 1 || (q === 3 && tipo !== 'rei' && tipo !== 'cogumelo')) { // piscando: tracinho
        g.strokeStyle = '#1a0a20'; g.lineWidth = 8; g.beginPath(); g.moveTo(x - OW + 6, olhoY + 2); g.quadraticCurveTo(x, olhoY + 10, x + OW - 6, olhoY + 2); g.stroke();
      } else if (q === 2) { // dor: > <
        g.strokeStyle = '#1a0a20'; g.lineWidth = 9; g.beginPath();
        g.moveTo(x - s * 20, olhoY - 16); g.lineTo(x + s * 12, olhoY); g.lineTo(x - s * 20, olhoY + 16); g.stroke();
      } else if (q === 3 && tipo === 'rei') { // tonto: espiral
        g.strokeStyle = '#fff0f8'; g.lineWidth = 6; g.beginPath();
        for (let t = 0; t < 1; t += 0.03) { const an = t * 14 * s, r = 4 + t * 24; g.lineTo(x + Math.cos(an) * r, olhoY + Math.sin(an) * r); }
        g.stroke();
      } else {
        // olho emburrado: branco, íris vermelha, pupila e brilho; pálpebra de cima reta e inclinada (cara de bravo)
        g.save();
        g.beginPath(); g.ellipse(x, olhoY, OW, OH, 0, 0, Math.PI * 2); g.clip();
        g.fillStyle = '#fff6f6'; g.fillRect(x - OW, olhoY - OH, OW * 2, OH * 2);
        const ir = g.createRadialGradient(x + s * 4, olhoY + 2, 2, x + s * 4, olhoY + 2, OH * 0.95);
        ir.addColorStop(0, '#ff8a9a'); ir.addColorStop(0.55, f.pal.olho); ir.addColorStop(1, '#7a1028');
        g.fillStyle = ir; g.beginPath(); g.ellipse(x + s * 4, olhoY + 3, OW * 0.66, OH * 0.82, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a0812'; g.beginPath(); g.ellipse(x + s * 4, olhoY + 4, OW * 0.28, OH * 0.38, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 6 + s * 2, olhoY - 6, 7, 8, 0, 0, Math.PI * 2); g.fill();
        // pálpebra (cobre o alto do olho, inclinada para o meio)
        const cai = sono ? OH * 0.95 : OH * 0.62;
        g.fillStyle = f.pal.pele; g.beginPath();
        g.moveTo(x - OW - 4, olhoY - OH - 4); g.lineTo(x + OW + 4, olhoY - OH - 4);
        g.lineTo(x + OW + 4, olhoY - OH + (s > 0 ? cai * 0.55 : cai)); g.lineTo(x - OW - 4, olhoY - OH + (s > 0 ? cai : cai * 0.55)); g.fill();
        g.restore();
        g.strokeStyle = '#1a0a20'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(x - OW - 2, olhoY - OH + (s > 0 ? cai * 0.55 : cai)); g.lineTo(x + OW + 2, olhoY - OH + (s > 0 ? cai : cai * 0.55)); g.stroke();
        g.beginPath(); g.ellipse(x, olhoY, OW, OH, 0, 0.15, Math.PI - 0.15); g.lineWidth = 4; g.stroke();
      }
      // sobrancelha brava (grossa, apontando para o meio)
      g.strokeStyle = f.pal.sobr; g.lineWidth = tipo === 'rei' ? 14 : 10;
      const lev = q === 2 ? -8 : q === 3 && tipo === 'rei' ? -16 : 0;
      g.beginPath(); g.moveTo(x - s * (OW - 2), olhoY - OH - 16 + lev); g.lineTo(x + s * (OW - 6), olhoY - OH - 2 + lev + (q === 2 ? -6 : 6)); g.stroke();
    });
    // boca
    g.strokeStyle = '#2a0a18'; g.fillStyle = '#5a1430'; g.lineWidth = 6;
    const cx = T / 2;
    if (q === 2) { // dor: boca em zigue-zague
      g.beginPath(); g.moveTo(cx - 22, bocaY); for (let i = 1; i <= 4; i++) g.lineTo(cx - 22 + i * 11, bocaY + (i % 2 ? -7 : 0)); g.stroke();
    } else if (q === 3 && tipo === 'cogumelo') { // soprando: bico redondo, bochechas cheias
      g.beginPath(); g.ellipse(cx + 22, bocaY - 4, 10, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (q === 3 && tipo === 'rei') { // "ohh" de tonto
      g.beginPath(); g.ellipse(cx, bocaY + 4, 14, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (tipo === 'morcego') { // emburrado com dentinhos
      g.beginPath(); g.moveTo(cx - 20, bocaY + 4); g.quadraticCurveTo(cx, bocaY - 8, cx + 20, bocaY + 4); g.stroke();
      g.fillStyle = '#ffffff';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 12 - 5, bocaY); g.lineTo(cx + s * 12 + 5, bocaY - 1); g.lineTo(cx + s * 12, bocaY + 12); g.fill(); }
    } else if (tipo !== 'rei') { // biquinho emburrado
      g.beginPath(); g.moveTo(cx - 14, bocaY + 4); g.quadraticCurveTo(cx, bocaY - 7, cx + 14, bocaY + 4); g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / QUADROS, 1);
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- materiais
let gradiente: THREE.DataTexture | null = null;
function gradienteToon() {
  if (gradiente) return gradiente;
  gradiente = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  gradiente.minFilter = gradiente.magFilter = THREE.LinearFilter;
  gradiente.needsUpdate = true;
  return gradiente;
}

interface Uniformes { uAnda: { value: number }; uBater: { value: number }; uMaos: { value: number }; uFlash: { value: number } }

/** Animação por `parte` (pés, asas, mãos), comum ao corpo e ao contorno. */
const ANIMA_GLSL = /* glsl */ `
{
  float pt = parte;
  if (pt > 0.5 && pt < 2.5) { // pés: passinhos alternados
    float lado = pt < 1.5 ? 0.0 : 3.14159;
    float s = sin(uAnda + lado);
    transformed.y += max(0.0, s) * 0.05;
    transformed.z += s * 0.035;
  } else if (pt > 2.5 && pt < 4.5) { // asas: giram no ombro
    float lado = pt < 3.5 ? -1.0 : 1.0;
    vec2 piv = vec2(lado * 0.16, 0.29);
    vec2 d = transformed.xy - piv;
    float a = uBater * lado;
    float c = cos(a), s = sin(a);
    transformed.xy = piv + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    transformed.z += abs(d.x) * sin(uBater) * 0.25;
  } else if (pt > 4.5) { // mãos: sobem e descem
    float lado = pt < 5.5 ? 0.0 : 1.6;
    transformed.y += sin(uMaos + lado) * 0.06;
    transformed.x += cos(uMaos * 0.7 + lado) * 0.02;
  }
}`;

function materialBicho(u: Uniformes, map: THREE.Texture | null): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({ vertexColors: !map, map, gradientMap: gradienteToon() });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uAnda, uBater, uMaos;\n${map ? '' : 'attribute float parte;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${map ? '' : ANIMA_GLSL}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash;')
      .replace('#include <opaque_fragment>', `{
  float fr = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
  outgoingLight += vec3(1.0, 0.72, 0.95) * 0.45 * smoothstep(0.55, 0.95, fr) * (0.6 + 0.4 * normal.y);
  outgoingLight = mix(outgoingLight, vec3(1.0, 0.97, 1.0), uFlash);
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => (map ? 'edm-bicho-rosto' : 'edm-bicho');
  return mat;
}

function materialContorno(u: Uniformes, espessura: number): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: 0x1e0c30, side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.uniforms.uEsp = { value: espessura };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uAnda, uBater, uMaos, uEsp;\nattribute float parte;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${ANIMA_GLSL}\ntransformed += normalize(normal) * uEsp;`);
  };
  mat.customProgramCacheKey = () => `edm-bicho-contorno-${espessura}`;
  return mat;
}

// ---------------------------------------------------------------- bichinhos em cena
interface Bicho {
  tipo: TipoInimigo;
  raiz: THREE.Group; corpo: THREE.Group;
  u: Uniformes;
  tex: THREE.Texture;
  estrela: THREE.Mesh | null;
  pisca: number; piscando: number; dor: number; especial: number; achata: number; estouro: number;
  yaw: number; vivoAntes: boolean; anda: number; xAntes: number;
}

export class Bichinhos {
  readonly raiz = new THREE.Group();
  private lista: Bicho[] = [];

  constructor(fase: Fase, q: Qualidade) {
    const defs = fase.inimigos ?? [];
    const cache = new Map<TipoInimigo, { f: Forma; tex: THREE.CanvasTexture; geoRosto: THREE.BufferGeometry }>();
    for (const d of defs) {
      let c = cache.get(d.tipo);
      if (!c) {
        const f = FORMAS[d.tipo]();
        const r = f.rosto;
        const geoRosto = new THREE.SphereGeometry(r.r * 1.015, 18, 12, Math.PI / 2 - r.a, 2 * r.a, r.t0, r.t1 - r.t0);
        geoRosto.scale(r.ex, r.ey, 1); geoRosto.translate(0, r.y, r.z);
        c = { f, tex: texturaRosto(d.tipo, f), geoRosto };
        cache.set(d.tipo, c);
      }
      const u: Uniformes = { uAnda: { value: 0 }, uBater: { value: 0 }, uMaos: { value: 0 }, uFlash: { value: 0 } };
      const raiz = new THREE.Group(), corpo = new THREE.Group();
      raiz.add(corpo);
      corpo.add(new THREE.Mesh(c.f.geo, materialBicho(u, null)));
      if (q !== 'baixa') corpo.add(new THREE.Mesh(c.f.contorno, materialContorno(u, d.tipo === 'rei' ? 0.03 : 0.014)));
      const tex = c.tex.clone(); // a imagem é a mesma (uma subida à GPU); só o deslocamento do quadro muda
      corpo.add(new THREE.Mesh(c.geoRosto, materialBicho(u, tex)));
      let estrela: THREE.Mesh | null = null;
      if (d.tipo === 'rei') {
        // ponto fraco: estrela de 4 pontas no peito (acende quando à mostra)
        const s = new THREE.Shape();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.07 : 0.3; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
        estrela = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false }));
        estrela.position.set(0, 1.15, 0.73);
        corpo.add(estrela);
      }
      this.raiz.add(raiz);
      this.lista.push({ tipo: d.tipo, raiz, corpo, u, tex, estrela, pisca: 1 + Math.random() * 3, piscando: 0, dor: 0, especial: 0, achata: 0, estouro: 0, yaw: (d.dir ?? -1) * 0.5, vivoAntes: true, anda: Math.random() * 6, xAntes: d.x });
    }
  }

  /** Posição do centro do bichinho k (para efeitos). */
  centro(n: EstadoInimigo) { return { x: n.x, y: n.y + INIMIGO[n.tipo].h / 2 }; }

  atualizar(inimigos: readonly EstadoInimigo[], eventos: readonly string[], dt: number, relogio: number, fx: Particulas) {
    for (const ev of eventos) {
      const [nome, ks, extra] = ev.split(':');
      const k = Number(ks), b = this.lista[k], n = inimigos[k];
      if (!b || !n) continue;
      const c = this.centro(n);
      if (nome === 'acerto') {
        b.dor = 0.4; b.achata = 1; b.u.uFlash.value = 0.85;
        fx.explosao(c.x, c.y, 6, 0xfff0a0, 3.5, 0.3, 0.35);
      } else if (nome === 'defendeu') {
        b.achata = 0.4;
        fx.emitir({ x: c.x, y: c.y + 0.4, z: 0.9, vida: 0.3, tam: 0.6, tamFim: 1.6, cor: 0xc8d8ff, alfa: 0.8, cel: Cel.Anel });
        fx.explosao(c.x, c.y + 0.4, 4, 0xc8d8ff, 2.5, 0.22, 0.3, 0.9);
      } else if (nome === 'derrota') {
        b.estouro = 0.32; b.u.uFlash.value = 1;
        void extra;
      } else if (nome === 'pisao') {
        const kk = Number(extra), bb = this.lista[kk];
        if (bb) { bb.achata = 1.4; bb.dor = Math.max(bb.dor, 0.3); }
      } else if (nome === 'esporo') {
        b.especial = 0.45; b.achata = -0.8;
      } else if (nome === 'ponto-fraco') {
        b.especial = 99; b.achata = 1;
      } else if (nome === 'fecha') {
        b.especial = 0;
      }
    }
    for (let k = 0; k < this.lista.length; k++) {
      const b = this.lista[k], n = inimigos[k];
      if (!n) { b.raiz.visible = false; continue; }
      const m = INIMIGO[b.tipo];
      // derrotado: incha, fica branco e estoura em brilho (uma vez)
      if (!n.vivo) {
        if (b.vivoAntes && b.estouro <= 0) b.estouro = 0.32;
        b.vivoAntes = false;
        if (b.estouro > 0) {
          b.estouro -= dt;
          const t = 1 - Math.max(0, b.estouro) / 0.32;
          b.corpo.scale.setScalar(1 + t * 0.35);
          b.u.uFlash.value = 0.6 + t * 0.4;
          b.raiz.visible = true;
          if (b.estouro <= 0) {
            b.raiz.visible = false;
            const cx = b.raiz.position.x, cy = b.raiz.position.y + m.h / 2, z = b.raiz.position.z + 0.3;
            const grande = b.tipo === 'rei' ? 3 : 1;
            fx.emitir({ x: cx, y: cy, z, vida: 0.45, tam: 0.5 * grande, tamFim: 2.6 * grande, cor: 0xffd8f0, alfa: 0.9, cel: Cel.Anel });
            fx.emitir({ x: cx, y: cy, z, vida: 0.35, tam: 2.2 * grande, tamFim: 0.6, cor: 0xfff0c0, alfa: 0.9, cel: Cel.Halo });
            fx.explosao(cx, cy, 14 * grande, 0xffe28a, 5 * Math.sqrt(grande), 0.45, 0.8, z);
            fx.explosao(cx, cy, 8 * grande, 0xff9ad8, 3.5 * Math.sqrt(grande), 0.35, 0.7, z);
          }
        } else b.raiz.visible = false;
        continue;
      }
      // voltou (convidado reconectou, checkpoint): reaparece normal
      if (!b.vivoAntes) { b.corpo.scale.setScalar(1); b.u.uFlash.value = 0; }
      b.vivoAntes = true;
      b.raiz.visible = true;
      b.raiz.position.set(n.x, n.y, b.tipo === 'rei' ? -0.2 : 0.05);
      // virado para onde anda, três-quartos de frente (o rosto sempre aparece)
      const alvoYaw = n.dir * (b.tipo === 'rei' ? 0.25 : 0.55);
      b.yaw += (alvoYaw - b.yaw) * Math.min(1, dt * 8);
      b.raiz.rotation.y = b.yaw;
      const vel = Math.abs(n.x - b.xAntes) / Math.max(dt, 1e-3);
      b.xAntes = n.x;
      b.anda += dt * (vel > 0.1 ? 4 + vel * 5 : 0);
      b.u.uAnda.value = b.anda;
      b.u.uBater.value = b.tipo === 'morcego' ? Math.sin(relogio * 14 + k) * 0.75 : 0;
      b.u.uMaos.value = relogio * (b.tipo === 'rei' ? 2.2 + n.fase * 0.8 : 3) + k;
      b.u.uFlash.value = Math.max(0, b.u.uFlash.value - dt * 4);
      // corpo: quiquinho ao andar, respiração, achatado ao levar faísca/pisão, inflado ao cuspir
      b.achata += (0 - b.achata) * Math.min(1, dt * 9);
      const resp = Math.sin(relogio * 2.6 + k * 1.3) * 0.03;
      const quique = b.tipo === 'morcego' ? 0 : Math.abs(Math.sin(b.anda)) * (vel > 0.1 ? 0.06 : 0);
      const sy = 1 + resp - b.achata * 0.22, sx = 1 / Math.sqrt(Math.max(0.5, sy));
      b.corpo.scale.set(sx, sy, sx);
      b.corpo.position.y = quique;
      b.corpo.rotation.z = b.dor > 0 ? Math.sin(relogio * 40) * 0.12 * b.dor : (b.tipo === 'bolotinha' && vel > 0.1 ? Math.sin(b.anda) * 0.08 : 0);
      if (b.tipo === 'rei') {
        // pula no ataque da fase 3; balança mais bravo nas fases altas
        b.corpo.rotation.z += Math.sin(relogio * (1.5 + n.fase)) * 0.04 * n.fase;
        if (b.estrela) {
          const ab = n.aberto;
          const pulso = ab ? 1.25 + Math.sin(relogio * 10) * 0.2 : 0.75;
          b.estrela.scale.setScalar(pulso);
          (b.estrela.material as THREE.MeshBasicMaterial).color.setHex(ab ? 0xfff6c0 : 0x8a6ab8);
          b.estrela.rotation.z = Math.sin(relogio * 2) * 0.2;
          if (ab) {
            const sx2 = n.x + b.estrela.position.x, sy2 = n.y + 1.15;
            fx.ponto(sx2, sy2, 0.9, 2.2 + Math.sin(relogio * 10) * 0.3, 0xffd870, 0.85, Cel.Halo);
            fx.ponto(sx2, sy2, 0.95, 1.2, 0xffffff, 0.9, Cel.Brilho, relogio * 1.5);
          }
        }
      }
      // expressão
      b.dor = Math.max(0, b.dor - dt);
      if (b.especial < 50) b.especial = Math.max(0, b.especial - dt);
      b.pisca -= dt;
      if (b.pisca <= 0) { b.piscando = 0.14; b.pisca = 2 + Math.random() * 3.5; }
      b.piscando = Math.max(0, b.piscando - dt);
      let quadro = 0;
      if (b.dor > 0) quadro = 2;
      else if (b.especial > 0 && (b.tipo === 'cogumelo' || b.tipo === 'rei')) quadro = 3;
      else if (b.piscando > 0) quadro = 1;
      b.tex.offset.x = quadro / QUADROS;
    }
  }
}
