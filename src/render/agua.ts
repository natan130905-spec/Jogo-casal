// Água: cascatas (faixas que escorrem, animadas no shader) e o lago lá embaixo, com ondinhas e brilhos dourados.
import * as THREE from 'three';
import { TEMPO } from './materiais';

const RUIDO2 = /* glsl */ `
float aHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float aRuido(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1,0)), f.x), mix(aHash(i + vec2(0,1)), aHash(i + vec2(1,1)), f.x), f.y); }`;

export interface Cascata { x0: number; x1: number; topo: number; base: number; z: number }

/** Todas as cascatas da fase numa só malha (uma chamada de desenho). */
export function cascatas(lista: Cascata[]): THREE.Mesh {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const c of lista) {
    // coluna com 2 colunas × N linhas; o topo faz uma curvinha para a frente (a borda de onde a água cai)
    const linhas = 12;
    for (let j = 0; j <= linhas; j++) {
      const v = j / linhas;
      const y = c.topo + (c.base - c.topo) * v;
      const curva = Math.max(0, 1 - v * 10) * 0.25;
      const larg = 1 + v * 0.25;
      const meio = (c.x0 + c.x1) / 2, mw = ((c.x1 - c.x0) / 2) * larg;
      for (let i = 0; i <= 2; i++) {
        const u = i / 2;
        pos.push(meio - mw + u * mw * 2, y + curva * 0.3, c.z + 0.25 - curva + v * 0.05);
        uv.push(u, 1 - v);
      }
    }
    const base = pos.length / 3 - (linhas + 1) * 3;
    for (let j = 0; j < linhas; j++) for (let i = 0; i < 2; i++) {
      const a = base + j * 3 + i, b = a + 1, c2 = a + 3, d = a + 4;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vP;
      void main(){ vUv = uv; vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTempo; varying vec2 vUv; varying vec3 vP; ${RUIDO2}
      void main(){
        float corre = vP.y * 0.9 + uTempo * 3.2;
        float a1 = aRuido(vec2(vP.x * 7.0, corre)), a2 = aRuido(vec2(vP.x * 15.0 + 3.0, corre * 1.7 + 5.0));
        float listra = smoothstep(0.45, 0.9, a1 * 0.6 + a2 * 0.4);
        vec3 fundo = mix(vec3(0.20, 0.55, 0.95), vec3(0.55, 0.85, 1.0), a1);
        vec3 c = mix(fundo, vec3(1.0, 0.98, 0.95), listra * 0.85);
        float borda = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float espuma = smoothstep(0.12, 0.0, vUv.y);
        c = mix(c, vec3(1.0), espuma * 0.8);
        c += vec3(1.0, 0.85, 0.6) * 0.25 * smoothstep(0.9, 1.0, vUv.y); // luz do sol na borda de cima
        float alfa = borda * (0.72 + 0.28 * listra) * smoothstep(1.0, 0.97, vUv.y);
        gl_FragColor = vec4(c, alfa);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  return m;
}

/** Lago no fundo dos abismos: degradê de profundidade, ondinhas e cintilação dourada. */
export function lago(y: number, x0: number, x1: number, corNevoa: THREE.Color): THREE.Mesh {
  const g = new THREE.PlaneGeometry(x1 - x0, 40, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, -14);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO, uNevoa: { value: corNevoa } },
    vertexShader: /* glsl */ `varying vec3 vP; varying float vDist;
      void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; vec4 mv = viewMatrix * vec4(vP,1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uTempo; uniform vec3 uNevoa; varying vec3 vP; varying float vDist; ${RUIDO2}
      void main(){
        vec2 q = vP.xz;
        float r = aRuido(q * vec2(1.2, 3.0) + vec2(uTempo * 0.3, uTempo * 0.5)) * 0.6 + aRuido(q * vec2(3.1, 7.0) - vec2(uTempo * 0.5, 0.0)) * 0.4;
        float fundoZ = smoothstep(6.0, -30.0, vP.z);
        vec3 c = mix(vec3(0.10, 0.16, 0.42), vec3(0.55, 0.42, 0.78), fundoZ);
        c += vec3(0.25, 0.35, 0.55) * smoothstep(0.55, 0.85, r) * 0.6;
        float faisca = smoothstep(0.93, 0.99, aRuido(q * 9.0 + vec2(uTempo * 0.8, -uTempo * 0.4)));
        c += vec3(1.0, 0.82, 0.45) * faisca * 1.2;
        c = mix(c, uNevoa, smoothstep(14.0, 60.0, vDist) * 0.85);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(g, mat);
}
