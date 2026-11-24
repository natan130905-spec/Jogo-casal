// Pilares de cristal (cobertura que trinca e quebra), os dois cristais da fase 3 e a parede de névoa.
// Cristais: um só lote instanciado (6 pilares + 2 cristais da fase 3) + contorno; rachaduras e cacos instanciados.
// Chamadas: cristais (1) + contorno (1) + rachaduras (1) + cacos (1) + parede (1, só na fase 3).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEMPO } from '../materiais';
import { colocar, misturar, pintar, sorteio } from '../util';
import { CRISTAIS, PAREDE, PILARES, type EstadoArena } from '../../core/arena';
import { contornoDe, materialContorno, materialToon } from './toon';
import type { Particulas3D } from './particulas';
import { C } from './atlas';

const ALT_PEDESTAL = 0.85, ALT_PEDESTAL_CRISTAL = 0.45;

/** Cristal grande de 6 faces com dois menores encostados (cor: violeta escuro na base, lilás claro na ponta). */
function geoCristal(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];
  const add = (h: number, r: number, x: number, z: number, rx: number, rz: number) => {
    const corpo = new THREE.CylinderGeometry(r * 0.86, r, h, 6, 1); corpo.translate(0, h / 2, 0);
    const ponta = new THREE.ConeGeometry(r * 0.86, h * 0.36, 6, 1); ponta.translate(0, h + h * 0.18, 0);
    for (const g of [corpo, ponta]) {
      colocar(g, x, 0, z, 1, [rx, 0, rz]);
      pecas.push(pintar(g, (p, n, c) => {
        misturar(c, 0x5a18c0, 0xd0a0ff, Math.min(1, p.y / 2.2));
        misturar(c, c.getHex(), 0xffffff, Math.max(0, n.x * 0.5 + n.z * 0.3) * 0.35);
      }));
    }
  };
  add(1.5, 0.48, 0, 0, 0, 0);
  add(0.9, 0.24, 0.36, 0.18, 0.1, -0.42);
  add(0.7, 0.2, -0.3, -0.24, -0.25, 0.4);
  add(0.55, 0.16, -0.18, 0.36, 0.45, 0.2);
  const g = mergeGeometries(pecas)!;
  for (const p of pecas) p.dispose();
  return g;
}

/** Rachaduras: linhas em zigue-zague coladas nas faces do cristal grande. */
function geoRachas(): THREE.BufferGeometry {
  const rnd = sorteio(77);
  const pos: number[] = [];
  const ap = (y: number) => (0.48 - 0.0672 * (y / 1.5)) * Math.cos(Math.PI / 6) * 1.03;
  for (let f = 0; f < 6; f++) {
    if (f === 3) continue;
    const phi = (f / 6) * Math.PI * 2 + Math.PI / 6;
    const sx = Math.sin(phi), sz = Math.cos(phi), tx = Math.cos(phi), tz = -Math.sin(phi);
    let u = (rnd() - 0.5) * 0.2, y = 0.15 + rnd() * 0.3;
    const pts: [number, number][] = [[u, y]];
    while (y < 1.35) { u += (rnd() - 0.5) * 0.22; u = Math.max(-0.2, Math.min(0.2, u)); y += 0.12 + rnd() * 0.16; pts.push([u, y]); }
    for (let k = 0; k < pts.length - 1; k++) {
      const [u0, y0] = pts[k], [u1, y1] = pts[k + 1];
      const w = 0.03 * (1 - k / pts.length) + 0.012;
      const p = (uu: number, yy: number) => [sx * ap(yy) + tx * uu, yy, sz * ap(yy) + tz * uu];
      const a = p(u0 - w, y0), b = p(u0 + w, y0), c = p(u1 - w * 0.7, y1), d = p(u1 + w * 0.7, y1);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      if (rnd() < 0.4) { // galhinho
        const e = p(u0 + (rnd() - 0.5) * 0.3, y0 + 0.12);
        pos.push(...a, ...b, ...e);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Cacos que sobram no pedestal quando o pilar quebra. */
function geoCacos(): THREE.BufferGeometry {
  const rnd = sorteio(5);
  const pecas: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const h = 0.18 + rnd() * 0.32;
    const g = new THREE.ConeGeometry(0.08 + rnd() * 0.08, h, 5); g.translate(0, h / 2, 0);
    colocar(g, (rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7, 1, [(rnd() - 0.5) * 1.2, rnd() * 3, (rnd() - 0.5) * 1.2]);
    pecas.push(pintar(g, (p, _n, c) => misturar(c, 0x5a2aa8, 0xd9b8ff, p.y / 0.5)));
  }
  return mergeGeometries(pecas)!;
}

export class Pilares {
  readonly grupo = new THREE.Group();
  private cristais: THREE.InstancedMesh;
  private contorno: THREE.Mesh;
  private rachas: THREE.InstancedMesh;
  private cacos: THREE.InstancedMesh;
  private parede: THREE.Mesh;
  private uParede = { uAlt: { value: 0 }, uAlfa: { value: 0 }, uTempo: TEMPO };
  private abalo: number[] = PILARES.pos.map(() => 0);
  private vidaAntes: number[] = PILARES.pos.map(() => PILARES.vida);
  private brilhoCristal = CRISTAIS.pos.map(() => 0);
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(contorno: boolean) {
    const n = PILARES.pos.length + CRISTAIS.pos.length;
    this.cristais = new THREE.InstancedMesh(geoCristal(), materialToon({ vertexColors: true, proprio: 0.55, borda: 0xf0d8ff, forcaBorda: 0.4, recorte: true }), n);
    this.cristais.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.cristais.setColorAt(i, this.c.setScalar(1));
    this.contorno = contornoDe(this.cristais, materialContorno(0x2a1050, 2.2, 12, true));
    this.contorno.visible = contorno;
    this.rachas = new THREE.InstancedMesh(geoRachas(), new THREE.MeshBasicMaterial({ color: 0xfff4ff, toneMapped: false, side: THREE.DoubleSide }), PILARES.pos.length);
    this.cacos = new THREE.InstancedMesh(geoCacos(), this.cristais.material as THREE.Material, PILARES.pos.length);
    for (const im of [this.rachas, this.cacos]) im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cristais.frustumCulled = this.contorno.frustumCulled = this.rachas.frustumCulled = this.cacos.frustumCulled = false;

    const gp = new THREE.PlaneGeometry(24.4, 6, 1, 1); gp.rotateY(Math.PI / 2); gp.translate(0, 3, 0);
    this.parede = new THREE.Mesh(gp, new THREE.ShaderMaterial({
      uniforms: this.uParede,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uAlt, uAlfa, uTempo; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n(p); p = p * 2.1 + 3.7; a *= 0.5; } return s; }
        void main(){
          float topo = uAlt * 5.5;
          vec2 uv = vec2(vP.z * 0.35, vP.y * 0.45 - uTempo * 0.25);
          float f = fbm(uv + vec2(uTempo * 0.05, 0.0)), f2 = fbm(uv * 2.3 - vec2(uTempo * 0.12, uTempo * 0.1));
          float borda = topo - vP.y + (f - 0.5) * 1.6;
          float a = smoothstep(0.0, 1.2, borda);
          float largura = sqrt(max(0.0, 144.0 - 0.0)) ; // a ilha vai até |z| = 12
          a *= 1.0 - smoothstep(11.0, 12.3, abs(vP.z));
          a *= 0.45 + 0.55 * smoothstep(0.3, 0.75, f * 0.7 + f2 * 0.5);
          vec3 c = mix(vec3(0.28, 0.12, 0.46), vec3(0.78, 0.52, 0.98), f2);
          c += vec3(1.0, 0.75, 1.0) * smoothstep(0.65, 0.9, f2) * 0.35;
          c = mix(c, vec3(0.95, 0.8, 1.0), smoothstep(0.6, 0.0, borda) * step(0.0, borda) * 0.6);
          gl_FragColor = vec4(c, a * uAlfa * (largura > 0.0 ? 0.88 : 0.0));
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    }));
    this.parede.renderOrder = 6;
    this.parede.visible = false;
    this.grupo.add(this.contorno, this.cristais, this.rachas, this.cacos, this.parede);
  }

  atualizar(e: EstadoArena, dt: number, t: number, fx: Particulas3D) {
    const m = this.m, q = this.q, v = this.v, s = this.s;
    // tremida ao trincar / quebrar
    for (const ev of e.eventos) {
      const [nome, k] = ev.split(':');
      if (nome === 'pilar-trinca' || nome === 'pilar-quebra') {
        const i = Number(k);
        this.abalo[i] = 1;
        const p = PILARES.pos[i];
        fx.explosao(p.x, ALT_PEDESTAL + 1, p.z, nome === 'pilar-quebra' ? 26 : 10, 0xd8b8ff, nome === 'pilar-quebra' ? 6 : 3.5, 0.32, 0.8, C.brilho, 9);
        if (nome === 'pilar-quebra') fx.explosao(p.x, ALT_PEDESTAL + 0.8, p.z, 14, 0x8a5ad8, 5, 0.4, 0.9, C.faisca, 12);
      } else if (nome === 'cristal') {
        const i = Number(k), p = CRISTAIS.pos[i];
        fx.explosao(p.x, 1.2, p.z, 18, 0xbff0ff, 4.5, 0.35, 0.7, C.brilho, 2);
        fx.emitir({ x: p.x, y: 1.1, z: p.z, vida: 0.5, tam: 0.6, tamFim: 4, cor: 0xbff0ff, cel: C.anel, alfa: 0.9 });
      }
    }
    PILARES.pos.forEach((p, i) => {
      const vida = e.pilares[i];
      if (vida > this.vidaAntes[i]) { this.abalo[i] = 0; fx.explosao(p.x, ALT_PEDESTAL + 1, p.z, 14, 0xf0e0ff, 3, 0.3, 0.6, C.brilho, -1); }
      this.vidaAntes[i] = vida;
      this.abalo[i] = Math.max(0, this.abalo[i] - dt * 3);
      const ab = this.abalo[i];
      const trem = Math.sin(t * 60 + i) * 0.06 * ab;
      const incl = vida >= 3 ? 0 : vida === 2 ? 0.05 : 0.11;
      const ang = Math.atan2(p.x, p.z) + i * 1.3;
      q.setFromEuler(new THREE.Euler(incl * Math.cos(ang) + trem, ang, incl * Math.sin(ang)));
      const vivo = vida > 0;
      const esc = vivo ? (vida === 1 ? 0.92 : 1) : 0;
      m.compose(v.set(p.x, ALT_PEDESTAL, p.z), q, s.setScalar(esc));
      this.cristais.setMatrixAt(i, m);
      this.cristais.setColorAt(i, this.c.setRGB(vida === 1 ? 0.82 : 1, vida === 1 ? 0.78 : 1, vida === 1 ? 0.95 : 1));
      m.compose(v.set(p.x, ALT_PEDESTAL, p.z), q, s.setScalar(vivo && vida < 3 ? (vida === 1 ? 1.02 : 1.01) * esc : 0));
      this.rachas.setMatrixAt(i, m);
      m.compose(v.set(p.x, ALT_PEDESTAL, p.z), q.setFromAxisAngle(v.set(0, 1, 0), i), s.setScalar(vivo ? 0 : 1));
      this.cacos.setMatrixAt(i, m.setPosition(p.x, ALT_PEDESTAL, p.z));
      if (vivo) fx.ponto(p.x, ALT_PEDESTAL + 1.0, p.z, 2.4, 0x9a6aff, 0.22 + 0.05 * Math.sin(t * 2 + i), C.halo);
    });
    // cristais da fase 3: apagados fora da fase 3; pulsando quando a parede está de pé; acesos quando acertados
    const fase3 = e.rei.fase === 3 && !e.vitoria;
    CRISTAIS.pos.forEach((p, k) => {
      const i = PILARES.pos.length + k;
      const aceso = e.cristais[k] > 0;
      this.brilhoCristal[k] += ((aceso ? 1 : 0) - this.brilhoCristal[k]) * Math.min(1, dt * 10);
      const b = this.brilhoCristal[k];
      const chama = fase3 && e.parede === 2 && !aceso ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
      const ang = t * (0.4 + b * 2) + k;
      m.compose(v.set(p.x, ALT_PEDESTAL_CRISTAL + Math.sin(t * 2 + k) * 0.05, p.z), q.setFromAxisAngle(this.s.set(0, 1, 0), ang), s.setScalar(0.62 + b * 0.08));
      this.cristais.setMatrixAt(i, m);
      const base = fase3 ? 1 : 0.7;
      this.cristais.setColorAt(i, this.c.setRGB(base * (1 - b) + 0.75 * b + chama * 0.2, base * (1 - b) + 1.35 * b + chama * 0.15, base * (1 - b) + 1.5 * b + chama * 0.25));
      if (fase3) {
        fx.ponto(p.x, 1.1, p.z, 1.6 + b * 2.4 + chama * 0.8, aceso ? 0xbff0ff : 0xc08aff, 0.35 + b * 0.5 + chama * 0.2, C.halo);
        if (aceso) {
          // o tempo aceso que resta: anel que encolhe
          fx.ponto(p.x, 1.1, p.z, 1.2 + e.cristais[k] * 0.9, 0xbff0ff, 0.6, C.anel);
        }
      }
    });
    if (fase3 && e.cristais.every((c) => c > 0)) {
      // os dois acesos: raio de luz ligando os cristais por cima da parede
      const [a, b] = CRISTAIS.pos;
      for (let k = 0; k <= 16; k++) {
        const u = k / 16, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = 1.2 + Math.sin(u * Math.PI) * 4;
        fx.ponto(x, y, z, 0.9, 0xbff0ff, 0.8, C.halo);
      }
    }
    this.cristais.instanceMatrix.needsUpdate = true;
    if (this.cristais.instanceColor) this.cristais.instanceColor.needsUpdate = true;
    this.rachas.instanceMatrix.needsUpdate = true;
    this.cacos.instanceMatrix.needsUpdate = true;

    // parede de névoa (fase 3): sobe durante o aviso, fica de pé, some quando cai
    const alvoAlt = e.parede === 2 ? 1 : e.parede === 1 ? 1 - e.tParede / PAREDE.aviso : this.uParede.uAlt.value;
    this.uParede.uAlt.value += (alvoAlt - this.uParede.uAlt.value) * Math.min(1, dt * 8);
    const alvoAlfa = e.parede === 0 || e.vitoria ? 0 : 1;
    this.uParede.uAlfa.value += (alvoAlfa - this.uParede.uAlfa.value) * Math.min(1, dt * (alvoAlfa ? 6 : 2.5));
    if (e.parede === 0 && this.uParede.uAlfa.value < 0.02) this.uParede.uAlt.value = 0;
    this.parede.visible = this.uParede.uAlfa.value > 0.01;
    // fumaça ao longo da parede: dá volume quando a câmera a vê de lado
    if (this.parede.visible) {
      for (let k = 0; k < Math.floor(dt * 70 + Math.random()); k++) {
        const z = (Math.random() - 0.5) * 22;
        fx.emitir({ x: (Math.random() - 0.5) * 0.8, y: 0.3 + Math.random() * 4 * this.uParede.uAlt.value, z, vx: (Math.random() - 0.5) * 0.5, vy: 0.3, vz: 0, vida: 1.8, tam: 2.2, tamFim: 3.4, cor: 0x9a6ad8, alfa: 0.32 * this.uParede.uAlfa.value, cel: C.halo, aditivo: false, rot: Math.random() * 6 });
      }
    }
  }
}
