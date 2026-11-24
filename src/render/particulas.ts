// Partículas dos efeitos de jogo: faíscas do Lança-Estrelas e seu rastro, esporos, estouros em brilho, coletas,
// lanternas que acendem, bolhas que estouram… Tudo em quadros instanciados virados para a câmera, em dois lotes:
// um aditivo (brilhos) e um de mistura normal (esporos e fumacinha). São 2 chamadas de desenho no total.
// Duas formas de uso: `emitir` (partícula com vida, física simples) e `ponto` (só neste quadro: para o que já
// tem posição vinda do estado, como as faíscas e os esporos).
import * as THREE from 'three';
import { texturaEfeitos } from './texturas';

export const Cel = { Halo: 0, Brilho: 1, Anel: 2, Esporo: 3 } as const;
export type Cel = (typeof Cel)[keyof typeof Cel];

interface Particula {
  x: number; y: number; z: number; vx: number; vy: number; g: number; arrasto: number;
  vida: number; total: number; t0: number; t1: number; rot: number; vrot: number;
  r: number; gr: number; b: number; a: number; cel: Cel; aditivo: boolean;
}

export interface Emissao {
  x: number; y: number; z?: number; vx?: number; vy?: number;
  /** gravidade (m/s², positivo puxa para baixo) */
  g?: number; arrasto?: number;
  vida: number; tam: number; tamFim?: number; rot?: number; vrot?: number;
  cor: number; alfa?: number; cel?: Cel; aditivo?: boolean;
}

const tmp = new THREE.Color();

export class Lote {
  readonly malha: THREE.Mesh;
  private pos: Float32Array; private cor: Float32Array; private tr: Float32Array;
  private n = 0;
  constructor(private cap: number, mapa: THREE.Texture, aditivo: boolean) {
    const base = new THREE.InstancedBufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    base.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(cap * 3); this.cor = new Float32Array(cap * 4); this.tr = new Float32Array(cap * 3);
    base.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    base.setAttribute('iCor', new THREE.InstancedBufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage));
    base.setAttribute('iTr', new THREE.InstancedBufferAttribute(this.tr, 3).setUsage(THREE.DynamicDrawUsage)); // tamanho, giro, célula
    base.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMapa: { value: mapa } },
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec4 iCor; attribute vec3 iTr;
        varying vec2 vUv; varying vec4 vCor;
        void main(){
          float c = cos(iTr.y), s = sin(iTr.y);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iTr.x;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
          vUv = vec2((position.x + 0.5 + iTr.z) * 0.25, position.y + 0.5);
          vCor = iCor;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMapa; varying vec2 vUv; varying vec4 vCor;
        void main(){
          vec4 t = texture2D(uMapa, vUv);
          ${aditivo ? 'gl_FragColor = vec4(vCor.rgb * t.rgb * t.a * vCor.a, 1.5 * t.a * vCor.a);' : 'gl_FragColor = vec4(vCor.rgb * t.rgb, t.a * vCor.a); if (gl_FragColor.a < 0.01) discard;'}
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, toneMapped: false, fog: false,
      // aditivo: soma a cor (1·src + 1·dst, igual ao AdditiveBlending com alfa 1) e soma no alfa do alvo SÓ a forma da
      // partícula (1,5 × alfa da textura). Com alfa 1 no quadrado inteiro, cada faísca marcava um QUADRADO para o
      // brilho seletivo da alta (pos.ts) e o fundo claro florescia em quadrado (cap. 3, estrelinha no mostrador).
      blending: aditivo ? THREE.CustomBlending : THREE.NormalBlending,
      blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.malha = new THREE.Mesh(base, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = aditivo ? 7 : 6;
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

export class Particulas {
  readonly raiz = new THREE.Group();
  private vivas: Particula[] = [];
  private livres: Particula[] = [];
  private brilho: Lote; private normal: Lote;
  /** semente simples (só visual; não precisa ser determinística) */
  aleatorio = Math.random;

  constructor(private max = 700) {
    const mapa = texturaEfeitos();
    this.brilho = new Lote(max + 200, mapa, true);
    this.normal = new Lote(220, mapa, false);
    this.raiz.add(this.normal.malha, this.brilho.malha);
  }

  emitir(o: Emissao) {
    if (this.vivas.length >= this.max) return;
    const p = this.livres.pop() ?? ({} as Particula);
    tmp.setHex(o.cor);
    Object.assign(p, {
      x: o.x, y: o.y, z: o.z ?? 0.3, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, arrasto: o.arrasto ?? 0,
      vida: o.vida, total: o.vida, t0: o.tam, t1: o.tamFim ?? o.tam, rot: o.rot ?? 0, vrot: o.vrot ?? 0,
      r: tmp.r, gr: tmp.g, b: tmp.b, a: o.alfa ?? 1, cel: o.cel ?? Cel.Brilho, aditivo: o.aditivo ?? true,
    });
    this.vivas.push(p);
  }

  /** Leque de brilhos saindo de (x, y). */
  explosao(x: number, y: number, n: number, cor: number, vel: number, tam = 0.35, vida = 0.6, z = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.aleatorio() * 0.6, v = vel * (0.55 + this.aleatorio() * 0.6);
      this.emitir({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 3, arrasto: 2.2, vida: vida * (0.7 + this.aleatorio() * 0.5), tam, tamFim: 0, cor, vrot: (this.aleatorio() - 0.5) * 8, cel: Cel.Brilho });
    }
  }

  /** Quadro só deste quadro de desenho (não guarda nada). */
  ponto(x: number, y: number, z: number, tam: number, cor: number, alfa = 1, cel: Cel = Cel.Halo, rot = 0, aditivo = true) {
    tmp.setHex(cor);
    (aditivo ? this.brilho : this.normal).add(x, y, z, tam, rot, cel, tmp.r, tmp.g, tmp.b, alfa);
  }

  /** Começo do quadro: zera os lotes (antes dos `ponto`). */
  comecar() { this.brilho.limpar(); this.normal.limpar(); }

  /** Fim do quadro: avança as partículas com vida e envia tudo à GPU. */
  terminar(dt: number) {
    const v = this.vivas;
    for (let i = v.length - 1; i >= 0; i--) {
      const p = v[i];
      p.vida -= dt;
      if (p.vida <= 0) { v[i] = v[v.length - 1]; v.pop(); this.livres.push(p); continue; }
      const k = Math.max(0, 1 - p.arrasto * dt);
      p.vx *= k; p.vy = (p.vy - p.g * dt) * k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
      const t = 1 - p.vida / p.total;
      const tam = p.t0 + (p.t1 - p.t0) * t;
      const a = p.a * Math.min(1, p.vida / (p.total * 0.35));
      (p.aditivo ? this.brilho : this.normal).add(p.x, p.y, p.z, tam, p.rot, p.cel, p.r, p.gr, p.b, a);
    }
    this.brilho.enviar(); this.normal.enviar();
  }
}
