// Partículas 3D da arena: quadros instanciados virados para a câmera, em dois lotes (aditivo para brilhos e
// mistura normal para névoa, esporos, pétalas e números). 2 chamadas de desenho no total.
// `emitir` cria uma partícula com vida e física simples; `ponto` desenha só neste quadro (o que já tem posição
// vinda do estado: disparos, vaga-lume, estrela do peito).
import * as THREE from 'three';
import { texturaAtlas } from './atlas';

export interface Emissao {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  /** gravidade (m/s², positivo puxa para baixo) e arrasto (1/s) */
  g?: number; arrasto?: number;
  vida: number; tam: number; tamFim?: number;
  rot?: number; vrot?: number;
  cor: number; alfa?: number; cel?: number; aditivo?: boolean;
  /** cresce rápido no começo (números de dano) */
  saltar?: boolean;
}

interface P {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; arrasto: number;
  vida: number; total: number; t0: number; t1: number; rot: number; vrot: number;
  r: number; gr: number; b: number; a: number; cel: number; aditivo: boolean; saltar: boolean;
}

const tmp = new THREE.Color();

class Lote {
  readonly malha: THREE.Mesh;
  private pos: Float32Array; private cor: Float32Array; private tr: Float32Array;
  private n = 0;
  constructor(private cap: number, aditivo: boolean) {
    const base = new THREE.InstancedBufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    base.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(cap * 3); this.cor = new Float32Array(cap * 4); this.tr = new Float32Array(cap * 3);
    base.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    base.setAttribute('iCor', new THREE.InstancedBufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage));
    base.setAttribute('iTr', new THREE.InstancedBufferAttribute(this.tr, 3).setUsage(THREE.DynamicDrawUsage));
    base.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMapa: { value: texturaAtlas() } },
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec4 iCor; attribute vec3 iTr;
        varying vec2 vUv; varying vec4 vCor;
        void main(){
          float c = cos(iTr.y), s = sin(iTr.y);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iTr.x;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
          float col = mod(iTr.z, 8.0), lin = floor(iTr.z / 8.0);
          vUv = vec2((col + position.x + 0.5) / 8.0, 1.0 - (lin + 1.0) / 4.0 + (position.y + 0.5) / 4.0);
          vCor = iCor;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMapa; varying vec2 vUv; varying vec4 vCor;
        void main(){
          vec4 t = texture2D(uMapa, vUv);
          ${aditivo ? 'gl_FragColor = vec4(vCor.rgb * t.rgb * t.a * vCor.a, 1.0);' : 'gl_FragColor = vec4(vCor.rgb * t.rgb, t.a * vCor.a); if (gl_FragColor.a < 0.01) discard;'}
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, toneMapped: false, fog: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malha = new THREE.Mesh(base, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = aditivo ? 9 : 8;
  }
  limpar() { this.n = 0; }
  add(x: number, y: number, z: number, tam: number, rot: number, cel: number, r: number, g: number, b: number, a: number) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.cor[i * 4] = r; this.cor[i * 4 + 1] = g; this.cor[i * 4 + 2] = b; this.cor[i * 4 + 3] = a;
    this.tr[i * 3] = tam; this.tr[i * 3 + 1] = rot; this.tr[i * 3 + 2] = cel;
  }
  enviar() {
    const g = this.malha.geometry as THREE.InstancedBufferGeometry;
    g.instanceCount = this.n;
    for (const k of ['iPos', 'iCor', 'iTr']) {
      const at = g.getAttribute(k) as THREE.InstancedBufferAttribute;
      at.clearUpdateRanges(); at.addUpdateRange(0, this.n * at.itemSize); at.needsUpdate = true;
    }
    this.malha.visible = this.n > 0;
  }
}

export class Particulas3D {
  readonly raiz = new THREE.Group();
  private vivas: P[] = [];
  private livres: P[] = [];
  private brilho: Lote; private normal: Lote;
  sorte = Math.random;

  constructor(private max = 900) {
    this.brilho = new Lote(max + 300, true);
    this.normal = new Lote(500, false);
    this.raiz.add(this.normal.malha, this.brilho.malha);
  }

  emitir(o: Emissao) {
    if (this.vivas.length >= this.max) return;
    const p = this.livres.pop() ?? ({} as P);
    tmp.setHex(o.cor);
    p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.g = o.g ?? 0; p.arrasto = o.arrasto ?? 0; p.vida = p.total = o.vida;
    p.t0 = o.tam; p.t1 = o.tamFim ?? o.tam; p.rot = o.rot ?? 0; p.vrot = o.vrot ?? 0;
    p.r = tmp.r; p.gr = tmp.g; p.b = tmp.b; p.a = o.alfa ?? 1; p.cel = o.cel ?? 1; p.aditivo = o.aditivo ?? true; p.saltar = !!o.saltar;
    this.vivas.push(p);
  }

  /** Leque esférico de brilhos saindo de (x, y, z). */
  explosao(x: number, y: number, z: number, n: number, cor: number, vel: number, tam = 0.3, vida = 0.6, cel = 1, g = 4) {
    const s = this.sorte;
    for (let i = 0; i < n; i++) {
      const a = s() * Math.PI * 2, el = (s() - 0.3) * Math.PI * 0.8, v = vel * (0.5 + s() * 0.7);
      this.emitir({
        x, y, z, vx: Math.cos(a) * Math.cos(el) * v, vy: Math.sin(el) * v + vel * 0.3, vz: Math.sin(a) * Math.cos(el) * v,
        g, arrasto: 2.4, vida: vida * (0.7 + s() * 0.5), tam, tamFim: 0, cor, vrot: (s() - 0.5) * 8, cel,
      });
    }
  }

  /** Anel de partículas no chão, espalhando para fora (poeira de pouso, onda). */
  anel(x: number, y: number, z: number, n: number, cor: number, vel: number, tam = 0.4, vida = 0.5, cel = 3, aditivo = false, alfa = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.sorte() * 0.3;
      this.emitir({ x, y, z, vx: Math.cos(a) * vel, vy: 0.4 + this.sorte() * 0.6, vz: Math.sin(a) * vel, arrasto: 3, vida, tam, tamFim: tam * 1.8, cor, alfa, cel, aditivo, rot: this.sorte() * 6 });
    }
  }

  /** Número que sobe (dano no Rei). */
  numero(valor: number, x: number, y: number, z: number, cor: number, tam = 0.55) {
    const s = String(Math.max(0, Math.round(valor)));
    const vx = (this.sorte() - 0.5) * 1.2, vz = (this.sorte() - 0.5) * 1.2;
    for (let k = 0; k < s.length; k++) {
      const off = (k - (s.length - 1) / 2) * tam * 0.58;
      this.emitir({ x: x + off, y, z, vx, vy: 2.6, vz, g: 3.2, arrasto: 1.2, vida: 0.95, tam, tamFim: tam * 0.85, cor, cel: 8 + Number(s[k]), aditivo: false, saltar: true });
    }
  }

  ponto(x: number, y: number, z: number, tam: number, cor: number, alfa = 1, cel = 0, rot = 0, aditivo = true) {
    tmp.setHex(cor);
    (aditivo ? this.brilho : this.normal).add(x, y, z, tam, rot, cel, tmp.r, tmp.g, tmp.b, alfa);
  }

  comecar() { this.brilho.limpar(); this.normal.limpar(); }

  terminar(dt: number) {
    const v = this.vivas;
    for (let i = v.length - 1; i >= 0; i--) {
      const p = v[i];
      p.vida -= dt;
      if (p.vida <= 0) { v[i] = v[v.length - 1]; v.pop(); this.livres.push(p); continue; }
      const k = Math.max(0, 1 - p.arrasto * dt);
      p.vx *= k; p.vz *= k; p.vy = (p.vy - p.g * dt) * k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vrot * dt;
      const t = 1 - p.vida / p.total;
      let tam = p.t0 + (p.t1 - p.t0) * t;
      if (p.saltar) tam *= t < 0.12 ? 0.4 + (t / 0.12) * 0.9 : t < 0.22 ? 1.3 - ((t - 0.12) / 0.1) * 0.3 : 1;
      const a = p.a * Math.min(1, p.vida / (p.total * 0.35));
      (p.aditivo ? this.brilho : this.normal).add(p.x, p.y, p.z, tam, p.rot, p.cel, p.r, p.gr, p.b, a);
    }
    this.brilho.enviar(); this.normal.enviar();
  }

  get quantas() { return this.vivas.length; }
}
