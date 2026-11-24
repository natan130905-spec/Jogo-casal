// Céu da Arena do Coração (como a arte conceitual): roxo profundo no alto, faixa de galáxia rosada com estrelas,
// brilho dourado em volta do horizonte, mar de nuvens lilás lá embaixo e a grande estrela de 4 pontas no alto.
// E os anéis dourados que giram em volta da ilha (trilhas de luz com brilhinhos).
import * as THREE from 'three';
import { TEMPO } from '../materiais';

export function ceuArena(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(300, 40, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTempo: TEMPO, uFase: { value: 1 }, uFim: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */ `
      uniform float uTempo, uFase, uFim; varying vec3 vD;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        float az = atan(d.z, d.x);
        // degradê: dourado no horizonte, magenta, roxo, anil no alto
        vec3 c = mix(vec3(1.0, 0.68, 0.4), vec3(0.72, 0.28, 0.66), smoothstep(-0.01, 0.07, y));
        c = mix(c, vec3(0.34, 0.12, 0.54), smoothstep(0.05, 0.25, y));
        c = mix(c, vec3(0.09, 0.04, 0.24), smoothstep(0.22, 0.8, y));
        // galáxia: faixa inclinada de nebulosa rosa e lilás
        vec3 eixo = normalize(vec3(0.35, 0.55, -0.75));
        float faixa = 1.0 - abs(dot(d, normalize(cross(eixo, vec3(0.0, 1.0, 0.25)))));
        vec2 uvg = vec2(az * 3.0, y * 6.0);
        float neb = fbm(uvg * 1.3 + vec2(uTempo * 0.004, 0.0));
        float g = smoothstep(0.55, 1.0, faixa) * (0.4 + 0.9 * neb);
        c += vec3(0.75, 0.38, 0.85) * g * 0.55 * smoothstep(0.0, 0.25, y);
        c += vec3(1.0, 0.8, 0.95) * pow(g, 3.0) * 0.35 * smoothstep(0.05, 0.3, y);
        // nuvens roxas soltas no céu
        float nv = fbm(d.xz / (abs(y) + 0.25) * 1.2 + vec2(uTempo * 0.006, 0.0));
        c = mix(c, vec3(0.55, 0.28, 0.7), smoothstep(0.55, 0.8, nv) * smoothstep(0.02, 0.15, y) * (1.0 - smoothstep(0.3, 0.6, y)) * 0.6);
        // estrelas (mais na galáxia), piscando
        vec2 ce = floor(vec2(az * 150.0, y * 160.0));
        float est = step(0.993 - g * 0.012, h2(ce)) * smoothstep(0.02, 0.2, y);
        est *= 0.6 + 0.4 * sin(uTempo * (1.0 + h2(ce + 3.0) * 3.0) + h2(ce) * 30.0);
        c += vec3(1.0, 0.95, 0.85) * est * 1.2;
        // a grande estrela de 4 pontas no alto (atrás do Rei)
        vec3 ds = normalize(vec3(0.0, 0.62, -1.0));
        float s = max(dot(d, ds), 0.0);
        vec3 lado = normalize(cross(ds, vec3(0.0, 1.0, 0.0))), cima = normalize(cross(lado, ds));
        vec2 q = vec2(dot(d, lado), dot(d, cima)) / 0.06;
        float raio = exp(-abs(q.x) * 6.0) * exp(-abs(q.y) * 0.5) + exp(-abs(q.y) * 6.0) * exp(-abs(q.x) * 0.5);
        float est4 = (raio * 0.9 + pow(s, 3000.0) * 3.0 + pow(s, 200.0) * 0.6) * step(0.0, dot(d, ds));
        c += vec3(1.0, 0.86, 0.5) * est4 * (1.0 + 0.15 * sin(uTempo * 2.0));
        // mar de nuvens embaixo (lilás e rosa, com brilho dourado na beira)
        float baixo = smoothstep(0.02, -0.12, y);
        vec2 uvn = d.xz / (abs(y) + 0.05) * 0.9 + vec2(uTempo * 0.01, uTempo * 0.004);
        float nb = fbm(uvn);
        vec3 nuvem = mix(vec3(0.16, 0.07, 0.34), vec3(0.62, 0.32, 0.72), smoothstep(0.4, 0.8, nb));
        nuvem = mix(nuvem, vec3(0.95, 0.62, 0.55), smoothstep(-0.06, 0.0, y) * 0.5);
        c = mix(c, nuvem, baixo);
        // fim: o céu clareia (amanhecer dourado)
        c = mix(c, c * vec3(1.15, 1.05, 0.9) + vec3(0.12, 0.08, 0.02), uFim);
        // fase 3: o céu escurece um pouco (medo de se perder)
        c *= mix(1.0, 0.82, step(2.5, uFase) * (1.0 - uFim));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

/** Anéis dourados em volta da ilha (elipses inclinadas com brilhinhos que correm). 1 chamada. */
export function aneisDourados(): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const conf: [number, number, number, number][] = [ // raio, largura, inclinação x, inclinação z
    [27, 0.5, 0.12, 0.05], [34, 0.42, -0.08, 0.14], [41, 0.36, 0.18, -0.1],
  ];
  conf.forEach(([r, w, ix, iz], k) => {
    const g = new THREE.RingGeometry(r - w / 2, r + w / 2, 160, 1);
    g.rotateX(-Math.PI / 2);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(ix, k * 1.3, iz)));
    g.translate(0, -2 + k * 1.5, 0);
    const n = g.getAttribute('position').count;
    const qual = new Float32Array(n).fill(k);
    g.setAttribute('qual', new THREE.BufferAttribute(qual, 1));
    // RingGeometry com 1 faixa: os 161 primeiros vértices são a borda de dentro, os outros a de fora
    const lado = new Float32Array(n).map((_, i) => (i < 161 ? 0 : 1));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 ? lado[(i - 1) / 2] : 0)), 2));
    geos.push(g);
  });
  const geo = mergeGeos(geos);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO },
    vertexShader: /* glsl */ `attribute float qual; varying vec2 vUv; varying float vQ; varying vec3 vP;
      void main(){ vUv = uv; vQ = qual; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTempo; varying vec2 vUv; varying float vQ; varying vec3 vP;
      void main(){
        float ang = atan(vP.z, vP.x);
        float corre = fract(ang / 6.2832 * (6.0 + vQ * 2.0) - uTempo * (0.05 + vQ * 0.02));
        float brilho = smoothstep(0.0, 0.08, corre) * (1.0 - smoothstep(0.08, 0.5, corre));
        float trilha = 0.25 + 0.75 * brilho;
        float centro = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float pisca = step(0.985, fract(sin(floor(ang * 160.0) * 91.7 + vQ) * 4375.5)) * (0.5 + 0.5 * sin(uTempo * 3.0 + ang * 50.0));
        vec3 c = vec3(1.0, 0.78, 0.38) * trilha * 0.9 + vec3(1.0, 0.95, 0.8) * pisca;
        gl_FragColor = vec4(c * (0.35 + 0.65 * centro), 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 5;
  return m;
}

function mergeGeos(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // RingGeometry tem índice, uv e normal: junta à mão (sem depender da ordem dos atributos)
  let nv = 0, ni = 0;
  for (const g of gs) { nv += g.getAttribute('position').count; ni += g.index!.count; }
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), q = new Float32Array(nv), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of gs) {
    const p = g.getAttribute('position'), u = g.getAttribute('uv'), qq = g.getAttribute('qual');
    pos.set(p.array as Float32Array, ov * 3); uv.set(u.array as Float32Array, ov * 2); q.set(qq.array as Float32Array, ov);
    const ix = g.index!.array;
    for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
    ov += p.count; oi += ix.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('qual', new THREE.BufferAttribute(q, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
