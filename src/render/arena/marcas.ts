// Marcas no chão da arena, todas num só lote instanciado (1 chamada de desenho): sombras-bolha, avisos dos ataques
// (círculo enchendo, faixa da investida enchendo, onda de choque), marcador da trava, círculo do Jardim de Luz,
// aura de poder cheio e clarões de impacto. Desenhadas logo acima do chão (y = 0), sem escrever profundidade.
import * as THREE from 'three';
import { TEMPO } from '../materiais';

export const M = { sombra: 0, circulo: 1, anel: 2, linha: 3, trava: 4, jardim: 5, aura: 6, clarao: 7, runa: 8 } as const;

export class Marcas {
  readonly malha: THREE.Mesh;
  private a: Float32Array; private b: Float32Array; private c: Float32Array; private d: Float32Array;
  private n = 0;
  private tmp = new THREE.Color();

  constructor(private cap = 96) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    this.a = new Float32Array(cap * 4); this.b = new Float32Array(cap * 4); this.c = new Float32Array(cap * 3); this.d = new Float32Array(cap * 2);
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(this.a, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(this.b, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iC', new THREE.InstancedBufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iD', new THREE.InstancedBufferAttribute(this.d, 2).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTempo: TEMPO },
      vertexShader: /* glsl */ `
        attribute vec4 iA, iB; attribute vec3 iC; attribute vec2 iD;
        varying vec2 vL; varying vec4 vB; varying vec3 vC; varying vec2 vD; varying float vComp;
        void main(){
          float r = iB.x, tipo = iB.y;
          vec2 pos;
          vComp = 0.0;
          if (abs(tipo - 3.0) < 0.5) {
            vec2 d = iA.zw - iA.xy; float L = length(d);
            vec2 u = L > 1e-4 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-u.y, u.x);
            float meio = L * 0.5 + r * 0.5;
            vec2 m = (iA.xy + iA.zw) * 0.5;
            pos = m + u * position.x * meio + n * position.y * r;
            vL = vec2(position.x * meio + L * 0.5, position.y * r);
            vComp = L;
          } else {
            float R = r + iD.x;
            pos = iA.xy + position.xy * R;
            vL = position.xy * R;
          }
          vB = iB; vC = iC; vD = iD;
          gl_Position = projectionMatrix * viewMatrix * vec4(pos.x, 0.035, pos.y, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTempo;
        varying vec2 vL; varying vec4 vB; varying vec3 vC; varying vec2 vD; varying float vComp;
        float faixa(float x, float a, float b, float s){ return smoothstep(a - s, a, x) * (1.0 - smoothstep(b, b + s, x)); }
        void main(){
          float r = vB.x, tipo = vB.y, k = vB.z, alfa = vB.w;
          vec3 cor = vC; float a = 0.0;
          float d = length(vL);
          if (tipo < 0.5) {                      // sombra-bolha
            a = (1.0 - smoothstep(r * 0.35, r, d)) * 0.55;
          } else if (tipo < 1.5) {               // círculo de aviso: borda forte + miolo enchendo do centro
            float borda = faixa(d, r - 0.12, r, 0.04);
            float miolo = (1.0 - smoothstep(r * k - 0.05, r * k, d)) * 0.42;
            float listra = 0.75 + 0.25 * sin((vL.x + vL.y) * 5.0 - uTempo * 6.0);
            float fundo = (1.0 - smoothstep(r - 0.05, r, d)) * 0.16;
            a = max(borda * (0.75 + 0.25 * sin(uTempo * 14.0)), max(miolo * listra, fundo));
            if (k >= 0.999) { a = (1.0 - smoothstep(r - 0.05, r, d)) * 0.8; cor = mix(cor, vec3(1.0), 0.45); }
          } else if (tipo < 2.5) {               // onda de choque: anel de raio r, largura vD.x
            float w = vD.x;
            float x = abs(d - r) / w;
            a = (1.0 - smoothstep(0.55, 1.0, x)) * 0.9;
            cor = mix(cor, vec3(1.0, 0.95, 1.0), 1.0 - smoothstep(0.0, 0.35, x));
          } else if (tipo < 3.5) {               // faixa da investida: borda + enchendo do começo ao fim
            float L = vComp; float y = abs(vL.y);
            float dentro = step(0.0, vL.x) * step(vL.x, L);
            float borda = (smoothstep(r - 0.14, r - 0.06, y) * step(y, r)) * dentro;
            float enche = step(vL.x, L * k) * dentro * (1.0 - smoothstep(r - 0.06, r, y));
            float seta = step(0.6, fract(vL.x * 0.6 - y * 0.25 - uTempo * 1.8)) * dentro * step(y, r * 0.8);
            a = max(borda * 0.9, enche * 0.38 + seta * 0.12 + 0.1 * dentro * step(y, r));
            if (k >= 0.999) a = dentro * step(y, r) * 0.7;
          } else if (tipo < 4.5) {               // marcador da trava: anel tracejado girando
            float ang = atan(vL.y, vL.x);
            float tr = step(0.5, fract(ang * 6.0 / 6.2832 + uTempo * 0.35));
            a = faixa(d, r - 0.09, r, 0.03) * (0.35 + 0.65 * tr) + faixa(d, r * 0.55, r * 0.6, 0.03) * 0.4;
          } else if (tipo < 5.5) {               // Jardim de Luz: roseta de pétalas + anel dourado
            float ang = atan(vL.y, vL.x);
            float pet = 0.5 + 0.5 * cos(ang * 8.0 + uTempo * 0.6);
            float rosa = 1.0 - smoothstep(0.0, 0.08, d / r - (0.35 + 0.5 * pet * pet));
            float borda = faixa(d, r - 0.16, r, 0.05);
            float brilho = (1.0 - smoothstep(0.0, r, d)) * 0.25;
            a = (max(borda, rosa * 0.32) + brilho) * k;
            cor = mix(cor, vec3(1.0, 0.95, 0.6), borda);
          } else if (tipo < 6.5) {               // aura de poder cheio (anel pulsando)
            float p = fract(uTempo * 1.2);
            a = faixa(d, r * (0.55 + p * 0.45), r * (0.62 + p * 0.45), 0.04) * (1.0 - p) + faixa(d, r - 0.07, r, 0.03) * 0.6;
          } else if (tipo < 7.5) {               // clarão de impacto
            a = (1.0 - smoothstep(0.0, r, d)) * 0.8;
          } else {                                // runa: anéis concêntricos com marcas (decoração que acende)
            float ang = atan(vL.y, vL.x);
            float m = step(0.85, fract(ang * 12.0 / 6.2832));
            a = faixa(d, r - 0.08, r, 0.03) + faixa(d, r * 0.78, r * 0.81, 0.03) * 0.8 + faixa(d, r * 0.81, r - 0.08, 0.02) * m * 0.7;
          }
          a *= alfa;
          if (a < 0.004) discard;
          gl_FragColor = vec4(cor, a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.malha = new THREE.Mesh(g, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 3;
  }

  comecar() { this.n = 0; }

  /** Marca circular (ou anel/aura/trava). `extra` = largura do anel. */
  circulo(tipo: number, x: number, z: number, r: number, cor: number, k = 0, alfa = 1, extra = 0) {
    this.add(tipo, x, z, 0, 0, r, cor, k, alfa, extra);
  }

  linha(x: number, z: number, x2: number, z2: number, meia: number, cor: number, k: number, alfa = 1) {
    this.add(M.linha, x, z, x2, z2, meia, cor, k, alfa, 0);
  }

  private add(tipo: number, x: number, z: number, x2: number, z2: number, r: number, cor: number, k: number, alfa: number, extra: number) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.a.set([x, z, x2, z2], i * 4);
    this.b.set([r, tipo, k, alfa], i * 4);
    this.tmp.setHex(cor);
    this.c.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.d.set([extra, i], i * 2);
  }

  terminar() {
    const g = this.malha.geometry as THREE.InstancedBufferGeometry;
    g.instanceCount = this.n;
    for (const k of ['iA', 'iB', 'iC', 'iD']) {
      const at = g.getAttribute(k) as THREE.InstancedBufferAttribute;
      at.clearUpdateRanges(); at.addUpdateRange(0, this.n * at.itemSize); at.needsUpdate = true;
    }
    this.malha.visible = this.n > 0;
  }
}
