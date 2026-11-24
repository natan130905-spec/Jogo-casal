// Céu do crepúsculo (roxo → rosa → dourado, com sol, halo e nuvens finas) e as camadas de floresta pintadas ao fundo.
import * as THREE from 'three';
import { TEMPO } from './materiais';
import type { Tema } from './tema';

/** Direção do sol (de onde vem a luz dourada): um pouco à esquerda, baixo no céu, atrás da floresta. */
export const DIR_SOL = new THREE.Vector3(-0.22, 0.2, -1).normalize();

const lin = (hex: number) => new THREE.Color(hex);

/** Domo do céu. Deve acompanhar a posição da câmera (o sol fica sempre no mesmo lugar do quadro). */
export function ceu(t?: Tema['ceu']): THREE.Mesh {
  const k = t ?? { topo: 0x2a1c63, lilas: 0x7a55c4, rosa: 0xf09ab8, horiz: 0xffd394, baixo: 0x8a6ac0, sol: 0xffd9a0, nuvens: 0.55, estrelas: 0.8 };
  const geo = new THREE.SphereGeometry(190, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTempo: TEMPO, uSol: { value: DIR_SOL },
      cTopo: { value: lin(k.topo) }, cLilas: { value: lin(k.lilas) }, cRosa: { value: lin(k.rosa) },
      cHoriz: { value: lin(k.horiz) }, cBaixo: { value: lin(k.baixo) }, cSol: { value: lin(k.sol) },
      uNuvens: { value: k.nuvens }, uEstrelas: { value: k.estrelas },
    },
    vertexShader: /* glsl */ 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.99999; }',
    fragmentShader: /* glsl */ `
      uniform float uTempo, uNuvens, uEstrelas; uniform vec3 uSol, cTopo, cLilas, cRosa, cHoriz, cBaixo, cSol; varying vec3 vD;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 c = mix(cHoriz, cRosa, smoothstep(0.0, 0.16, y));
        c = mix(c, cLilas, smoothstep(0.12, 0.38, y));
        c = mix(c, cTopo, smoothstep(0.32, 0.85, y));
        c = mix(c, cBaixo, smoothstep(0.0, -0.25, y));
        float s = max(dot(d, uSol), 0.0);
        c += cSol * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.9 + pow(s, 8.0) * 0.35 + pow(s, 2.0) * 0.08);
        // nuvens finas, iluminadas por baixo pelo sol
        vec2 uv = d.xz / (abs(y) + 0.18) * 1.6 + vec2(uTempo * 0.01, 0.0);
        float nv = n2(uv) * 0.6 + n2(uv * 2.7 + 3.0) * 0.4;
        float nuvem = smoothstep(0.55, 0.85, nv) * smoothstep(0.02, 0.12, y) * smoothstep(0.55, 0.2, y);
        c = mix(c, mix(vec3(1.0, 0.72, 0.62), vec3(1.0, 0.92, 0.7), pow(s, 4.0)), nuvem * uNuvens);
        // estrelinhas no alto
        float est = step(0.996, h2(floor(d.xy * 260.0 + d.z * 91.0))) * smoothstep(0.35, 0.7, y);
        c += vec3(est) * uEstrelas;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2; // depois dos opacos: com teste de profundidade, só pinta onde nada cobriu (menos sobreposição)
  m.frustumCulled = false;
  return m;
}

/**
 * Camadas de silhueta (planos longos com a textura repetida), da mais distante para a mais próxima. A cor de cada
 * camada já é a da névoa naquela distância (perspectiva atmosférica), por isso elas não usam a névoa da cena.
 */
export function camadasFundo(mapa: THREE.Texture, x0: number, x1: number, cores?: [number, number][]): THREE.Mesh {
  const k = cores ?? [[0xe0b4d8, 0xf6cfd6], [0xa286cc, 0xcfa6d6], [0x6c5eae, 0x9a84c6]];
  const camadas = [
    { z: -75, base: -22, alto: 30, faixa: 0, repete: 90, baixo: k[0][0], cima: k[0][1], desloc: 0.0 },
    { z: -52, base: -16, alto: 26, faixa: 1, repete: 70, baixo: k[1][0], cima: k[1][1], desloc: 0.37 },
    { z: -34, base: -12, alto: 24, faixa: 1, repete: 52, baixo: k[2][0], cima: k[2][1], desloc: 0.71 },
  ];
  const pos: number[] = [], uv: number[] = [], cor: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  for (const k of camadas) {
    const b = pos.length / 3;
    const u0 = k.desloc, u1 = k.desloc + (x1 - x0) / k.repete;
    const v0 = k.faixa === 0 ? 0.5 : 0.0, v1 = v0 + 0.5;
    const yT = k.base + k.alto;
    pos.push(x0, k.base, k.z, x1, k.base, k.z, x1, yT, k.z, x0, yT, k.z);
    uv.push(u0, v0 + 0.002, u1, v0 + 0.002, u1, v1 - 0.002, u0, v1 - 0.002);
    for (const h of [k.baixo, k.baixo, k.cima, k.cima]) { c.setHex(h); cor.push(c.r, c.g, c.b); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: mapa, vertexColors: true, alphaTest: 0.35, fog: false });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 1; // idem: desenhado depois do cenário próximo
  return m;
}
