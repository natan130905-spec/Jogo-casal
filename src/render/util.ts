// Utilidades de geometria procedural para o cenário: sorteio determinístico, ruído, pintura por vértice e junção
// de malhas (uma chamada de desenho por grupo). Nada aqui conhece a simulação.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Gerador pseudoaleatório determinístico (o cenário sai igual em todos os aparelhos e nas capturas). */
export function sorteio(semente = 7) {
  let s = semente;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------- ruído de valor 3D (o mesmo ponto sempre dá o mesmo valor: sem rachaduras entre faces) ----------
const hash = (x: number, y: number, z: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
const suave = (t: number) => t * t * (3 - 2 * t);
export function ruido(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = suave(x - xi), yf = suave(y - yi), zf = suave(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  ) * 2 - 1;
}
export const fbm = (x: number, y: number, z: number) => ruido(x, y, z) * 0.65 + ruido(x * 2.1, y * 2.1, z * 2.1) * 0.35;

/** Posiciona/escala/gira uma geometria no mundo (aplica na própria geometria). */
export function colocar(geo: THREE.BufferGeometry, x: number, y: number, z: number, esc: number | [number, number, number] = 1, rot: [number, number, number] = [0, 0, 0]) {
  const e = typeof esc === 'number' ? [esc, esc, esc] : esc;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(e[0], e[1], e[2]),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Desloca os vértices com ruído (em coordenadas do mundo). `peso` decide quanto cada vértice mexe. */
export function deformar(geo: THREE.BufferGeometry, amp: number, freq: number, peso: (p: THREE.Vector3) => THREE.Vector3 | null) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const w = peso(p);
    if (!w) continue;
    const n1 = fbm(p.x * freq, p.y * freq, p.z * freq), n2 = fbm(p.x * freq + 31, p.y * freq + 17, p.z * freq + 5), n3 = fbm(p.x * freq - 13, p.y * freq + 47, p.z * freq - 29);
    pos.setXYZ(i, p.x + n1 * amp * w.x, p.y + n2 * amp * w.y, p.z + n3 * amp * w.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const tmpC = new THREE.Color();
/**
 * Deixa a geometria pronta para juntar: sem índice, sem UV e com cor por vértice.
 * `cor` pode ser fixa ou uma função do ponto e da normal (para faixas de rocha, musgo, degradê etc.).
 */
export function pintar(geo: THREE.BufferGeometry, cor: number | ((p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => void), manterUv = false) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!manterUv) g.deleteAttribute('uv');
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const cores = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  if (typeof cor === 'number') tmpC.setHex(cor);
  for (let i = 0; i < pos.count; i++) {
    if (typeof cor !== 'number') { p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i); cor(p, n, tmpC); }
    cores[i * 3] = tmpC.r; cores[i * 3 + 1] = tmpC.g; cores[i * 3 + 2] = tmpC.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  g.groups.length = 0;
  if (g !== geo) geo.dispose();
  return g;
}

/** Mistura de duas cores hex (em espaço linear) com fator t. */
export function misturar(c: THREE.Color, a: number, b: number, t: number) {
  const k = Math.max(0, Math.min(1, t));
  c.setHex(a);
  const r = c.r, g = c.g, bl = c.b;
  c.setHex(b);
  c.setRGB(r + (c.r - r) * k, g + (c.g - g) * k, bl + (c.b - bl) * k);
  return c;
}

/**
 * Junta muitas geometrias pintadas em pedaços ao longo de x (largura `faixa` metros): cada pedaço é uma chamada de
 * desenho e é descartado pelo recorte da câmera quando sai da tela.
 */
export class Juntador {
  private baldes = new Map<number, THREE.BufferGeometry[]>();
  constructor(private faixa = 16) {}
  add(geo: THREE.BufferGeometry) {
    geo.computeBoundingBox();
    const cx = (geo.boundingBox!.min.x + geo.boundingBox!.max.x) / 2;
    const k = Math.floor(cx / this.faixa);
    (this.baldes.get(k) ?? this.baldes.set(k, []).get(k)!).push(geo);
  }
  malhas(mat: THREE.Material): THREE.Mesh[] {
    const r: THREE.Mesh[] = [];
    for (const geos of this.baldes.values()) {
      const junto = mergeGeometries(geos, false);
      for (const x of geos) x.dispose();
      if (!junto) continue;
      // volta a indexar: vértices iguais (posição, normal e cor) viram um só — 3 a 6× menos vértices para a GPU
      const g = mergeVertices(junto, 1e-4);
      junto.dispose();
      g.computeBoundingSphere();
      r.push(new THREE.Mesh(g, mat));
    }
    this.baldes.clear();
    return r;
  }
}
