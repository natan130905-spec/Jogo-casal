// A ilha da Arena do Coração (como a arte conceitual): gramado redondo de 12 m de raio com flores, praça de pedra
// no meio com a estrela dourada, borda de blocos de pedra com estrelas douradas, rocha flutuante por baixo com
// musgo, cascatas caindo no vazio, ruínas de arcos atrás e as 6 lembranças (ilhazinhas dos capítulos) flutuando
// em volta. Tudo procedural, pintado por vértice e juntado por material.
// Chamadas: ilha (1) + brilho dourado (1) + cascatas (1) + grama (1) + flores (1) + lembranças (1) + brilho das
// lembranças (1) + domo do oceano (1).
// O chão de jogo é plano em y = 0 até 12 m (o núcleo não tem relevo); os enfeites ficam fora do caminho ou rentes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Qualidade } from '../cena';
import { geoFlor, geoTufo } from '../cenario';
import { geoEstrela4 } from '../elementos';
import { TEMPO, materialMundo } from '../materiais';
import { colocar, deformar, fbm, misturar, pintar, sorteio } from '../util';
import { CRISTAIS, ILHA, PILARES } from '../../core/arena';
import { BALANCO_GLSL, materialToon } from './toon';

type Cor = number | ((p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => void);

/** Lotes de geometria pintada por material. */
class Lotes {
  toon: THREE.BufferGeometry[] = [];
  brilho: THREE.BufferGeometry[] = [];
  quedas: THREE.BufferGeometry[] = [];
  add(alvo: THREE.BufferGeometry[], g: THREE.BufferGeometry, cor: Cor, balanco = 0) {
    const p = pintar(g, cor);
    p.setAttribute('balanco', new THREE.BufferAttribute(new Float32Array(p.getAttribute('position').count).fill(balanco), 1));
    alvo.push(p);
    return p;
  }
}

const juntar = (gs: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(gs, false)!;
  for (const x of gs) x.dispose();
  g.computeBoundingSphere();
  return g;
};

// ---------------------------------------------------------------- cascatas
function queda(x: number, z: number, y0: number, comp: number, larg: number, balanco: number): THREE.BufferGeometry {
  const n = Math.hypot(x, z) || 1, dx = x / n, dz = z / n; // cai para fora
  const tx = -dz, tz = dx;
  const pos: number[] = [], uv: number[] = [], fim: number[] = [], idx: number[] = [];
  const linhas = 14;
  for (let j = 0; j <= linhas; j++) {
    const v = j / linhas;
    const fora = 0.35 + Math.sqrt(v) * 1.6;
    const y = y0 + 0.08 - comp * v;
    const w = larg * (1 + v * 0.5) / 2;
    for (let i = 0; i <= 2; i++) {
      const u = i / 2, s = (u * 2 - 1) * w;
      pos.push(x + dx * fora + tx * s, y, z + dz * fora + tz * s);
      uv.push(u, comp * v);
      fim.push(v);
    }
  }
  for (let j = 0; j < linhas; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i;
    idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('fim', new THREE.Float32BufferAttribute(fim, 1));
  g.setAttribute('balanco', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(balanco), 1));
  g.setIndex(idx);
  return g.toNonIndexed();
}

function materialQueda(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO },
    vertexShader: /* glsl */ `attribute float fim; attribute float balanco; uniform float uTempo; varying vec2 vUv; varying float vFim;
      void main(){ vUv = uv; vFim = fim; vec3 transformed = position; ${BALANCO_GLSL}
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTempo; varying vec2 vUv; varying float vFim;
      float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float r(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){
        float corre = vUv.y * 0.9 - uTempo * 3.0;
        float a1 = r(vec2(vUv.x * 6.0, corre)), a2 = r(vec2(vUv.x * 13.0 + 3.0, corre * 1.7 + 5.0));
        float listra = smoothstep(0.45, 0.9, a1 * 0.6 + a2 * 0.4);
        vec3 c = mix(mix(vec3(0.35, 0.62, 1.0), vec3(0.7, 0.9, 1.0), a1), vec3(1.0), listra * 0.85);
        float borda = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        float espuma = smoothstep(0.06, 0.0, vFim);
        c = mix(c, vec3(1.0), espuma);
        float alfa = borda * (0.75 + 0.25 * listra) * (1.0 - smoothstep(0.55, 1.0, vFim));
        gl_FragColor = vec4(c * 1.1, alfa);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  });
}

// ---------------------------------------------------------------- pedra e grama
const PEDRA = { clara: 0xb8a4c8, media: 0x8a74a4, escura: 0x5a4678, funda: 0x2e1c4a };
const GRAMA = { escura: 0x1f6a2a, media: 0x3f9a2a, clara: 0x86c82a, sol: 0xd8d040 };

/** Rocha flutuante (de baixo para cima: normais para fora) com camadas e musgo no alto. */
function rochaFlutuante(L: Lotes, alvo: THREE.BufferGeometry[], raio: number, fundo: number, cx: number, cy: number, cz: number, balanco: number, semente: number, seg = 48) {
  const pts: THREE.Vector2[] = [];
  const perfil: [number, number][] = [[0.02, -1], [0.1, -0.93], [0.24, -0.8], [0.42, -0.62], [0.6, -0.45], [0.78, -0.27], [0.92, -0.13], [1.02, -0.05], [1.02, 0]];
  for (const [r, y] of perfil) pts.push(new THREE.Vector2(r * raio, y * fundo));
  const g = new THREE.LatheGeometry(pts, seg);
  const amp = raio * 0.09;
  deformar(g, amp, 0.45 + semente * 0.01, (p) => (p.y > -fundo * 0.04 ? null : new THREE.Vector3(1, 0.4, 1)));
  g.translate(cx, cy, cz);
  L.add(alvo, g, (p, _n, c) => {
    const y = (p.y - cy) / fundo;
    const camada = Math.sin(p.y * 3.1 + fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) * 3) * 0.5 + 0.5;
    misturar(c, PEDRA.media, PEDRA.clara, camada * 0.7);
    if (y < -0.45) misturar(c, c.getHex(), PEDRA.funda, (-0.45 - y) * 1.3);
    if (y > -0.12) misturar(c, c.getHex(), GRAMA.escura, (y + 0.12) / 0.12 * 0.85);
  }, balanco);
}

export interface Ilha {
  grupo: THREE.Group;
  /** a praça brilha mais quando o Rei está vulnerável */
  brilho: THREE.MeshBasicMaterial;
}

export function construirIlha(q: Qualidade): Ilha {
  const L = new Lotes();
  const rnd = sorteio(42);
  const R = ILHA.raio;
  const grupo = new THREE.Group();
  grupo.name = 'ilha';

  // gramado: anel polar da beira da praça (3,8 m) até a borda de pedra, com manchas de cor (pintura)
  {
    const aneis = 20, seg = 128, r0 = 3.75, r1 = R - 0.32;
    const pos: number[] = [], idx: number[] = [];
    for (let j = 0; j <= aneis; j++) for (let i = 0; i <= seg; i++) {
      const r = r0 + (r1 - r0) * (j / aneis), a = (i / seg) * Math.PI * 2;
      pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
    }
    for (let j = 0; j < aneis; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // normal para cima (a ordem dos vértices acima já aponta para +y; garante)
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    L.add(L.toon, g, (p, _n, c) => {
      const m = fbm(p.x * 0.18, 0, p.z * 0.18) * 0.5 + 0.5, m2 = fbm(p.x * 0.7 + 9, 1, p.z * 0.7) * 0.5 + 0.5;
      misturar(c, GRAMA.media, GRAMA.clara, THREE.MathUtils.smoothstep(m, 0.4, 0.75));
      misturar(c, c.getHex(), GRAMA.escura, THREE.MathUtils.smoothstep(m2, 0.62, 0.85) * 0.6);
      // sol dourado no gramado da frente
      misturar(c, c.getHex(), GRAMA.sol, THREE.MathUtils.smoothstep(p.z, 2, 11) * 0.25 * m);
      // terra batida em volta da praça
      const r = Math.hypot(p.x, p.z);
      misturar(c, c.getHex(), 0x8a7a5a, THREE.MathUtils.smoothstep(4.6 - r, 0, 0.9) * 0.55);
    });
  }

  // praça de pedra: lajes em anéis (centro, 6, 12, 18) com a estrela dourada no meio
  {
    const base = new THREE.CircleGeometry(3.8, 64); base.rotateX(-Math.PI / 2); base.translate(0, -0.004, 0);
    L.add(L.toon, base, PEDRA.escura);
    const aneis: [number, number, number][] = [[0, 0.95, 1], [0.95, 1.95, 8], [1.95, 2.9, 14], [2.9, 3.75, 20]];
    aneis.forEach(([r0, r1, n], k) => {
      for (let i = 0; i < n; i++) {
        const fol = 0.035;
        const a0 = (i / n) * Math.PI * 2 + k * 0.3 + fol / Math.max(0.5, r1), a1 = ((i + 1) / n) * Math.PI * 2 + k * 0.3 - fol / Math.max(0.5, r1);
        const s = new THREE.Shape();
        if (n === 1) s.absarc(0, 0, r1 - fol, 0, Math.PI * 2, false);
        else {
          const ri = r0 + fol, re = r1 - fol;
          s.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
          s.absarc(0, 0, re, a0, a1, false);
          s.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
          s.absarc(0, 0, ri, a1, a0, true);
        }
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.03, bevelSegments: 1, curveSegments: Math.max(3, Math.round(12 / n * 4)) });
        g.rotateX(-Math.PI / 2); g.translate(0, -0.02, 0);
        const tom = rnd();
        L.add(L.toon, g, (_p, nn, c) => { misturar(c, PEDRA.media, PEDRA.clara, 0.35 + tom * 0.4 + nn.y * 0.25); });
      }
    });
    const est = geoEstrela4(0.85, 0.2, 0.03); est.rotateX(-Math.PI / 2); est.translate(0, 0.035, 0);
    L.add(L.brilho, est, 0xffd36a);
  }

  // borda: blocos de pedra rentes ao chão (topo em y = 0,03), com estrelas douradas na face de fora
  {
    const n = 52;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const larg = (2 * Math.PI * (R + 0.02)) / n - 0.07;
      const b = new THREE.BoxGeometry(larg, 0.95, 0.62, 1, 1, 1);
      colocar(b, 0, -0.445, 0, 1, [0, 0, 0]);
      b.rotateY(a); b.translate(Math.sin(a) * (R - 0.02), 0, Math.cos(a) * (R - 0.02));
      const tom = rnd();
      L.add(L.toon, b, (_p, nn, c) => { misturar(c, PEDRA.media, PEDRA.clara, 0.25 + tom * 0.35 + Math.max(0, nn.y) * 0.35); });
      if (i % 2 === 0) {
        const s = geoEstrela4(0.2, 0.06, 0.04);
        s.rotateY(a); s.translate(Math.sin(a) * (R + 0.31), -0.43, Math.cos(a) * (R + 0.31));
        L.add(L.brilho, s, 0xffd36a);
        const moldura = new THREE.BoxGeometry(0.5, 0.5, 0.03); moldura.rotateY(a);
        moldura.translate(Math.sin(a) * (R + 0.295), -0.43, Math.cos(a) * (R + 0.295));
        L.add(L.toon, moldura, 0xb8863a);
      }
    }
  }

  // rocha flutuante por baixo, trepadeiras e cascatas
  rochaFlutuante(L, L.toon, R + 0.35, 11, 0, -0.85, 0, 0, 1, 72);
  {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, comp = 0.8 + rnd() * 1.8;
      const v = new THREE.CylinderGeometry(0.05, 0.03, comp, 4, 3);
      v.translate(0, -comp / 2, 0);
      deformar(v, 0.1, 2, () => new THREE.Vector3(1, 0, 1));
      v.translate(Math.sin(a) * (R + 0.4), -0.55, Math.cos(a) * (R + 0.4));
      L.add(L.toon, v, (p, _n, c) => misturar(c, 0x3f8f3a, 0x8fcf4a, (p.y + 2.5) / 2));
      for (let k = 0; k < 3; k++) { // folhinhas
        const f = new THREE.SphereGeometry(0.09, 4, 3); f.scale(1, 0.5, 1.4);
        f.translate(Math.sin(a) * (R + 0.45), -0.7 - k * comp / 3, Math.cos(a) * (R + 0.45));
        L.add(L.toon, f, 0x6db23e);
      }
    }
  }
  const angQuedas = [18, 82, 152, 205, 262, 318];
  for (const g of angQuedas) {
    const a = (g * Math.PI) / 180;
    L.quedas.push(queda(Math.sin(a) * (R + 0.1), Math.cos(a) * (R + 0.1), -0.25, 16, 1.5, 0));
  }

  // ruínas atrás (fora do chão de jogo): arcos e colunas de pedra sobre pedaços de rocha presos à ilha
  for (const [g, esc] of [[160, 1], [200, 1.1], [128, 0.85], [232, 0.9]] as const) {
    const a = (g * Math.PI) / 180, r = R + 1.5;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
    rochaFlutuante(L, L.toon, 1.6 * esc, 3.2 * esc, cx, -0.15, cz, 0, 3 + g);
    const arco = new THREE.Group();
    const pecas: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const col = new THREE.BoxGeometry(0.45, 2.4, 0.45); col.translate(s * 0.85, 1.2, 0); pecas.push(col);
      const cap = new THREE.BoxGeometry(0.6, 0.18, 0.6); cap.translate(s * 0.85, 2.45, 0); pecas.push(cap);
    }
    const topo = new THREE.TorusGeometry(0.85, 0.24, 5, 10, Math.PI); topo.scale(1, 0.9, 1); topo.translate(0, 2.45, 0); pecas.push(topo);
    void arco;
    for (const p of pecas) {
      p.scale(esc, esc, esc);
      p.rotateY(a + Math.PI / 2);
      p.translate(cx, 0.02, cz);
      L.add(L.toon, p, (pp, nn, c) => misturar(c, PEDRA.media, PEDRA.clara, 0.3 + nn.y * 0.3 + fbm(pp.x, pp.y * 2, pp.z) * 0.2));
    }
  }

  // pedestais dos pilares de cristal e dos cristais da fase 3 (o cristal em si é desenhado em pilares.ts)
  const pedestal = (x: number, z: number, raio: number, alt: number) => {
    const p = new THREE.CylinderGeometry(raio * 0.92, raio, alt, 8, 1); p.translate(x, alt / 2, z);
    L.add(L.toon, p, (_pp, nn, c) => misturar(c, PEDRA.media, PEDRA.clara, 0.35 + Math.max(0, nn.y) * 0.4));
    const aro = new THREE.CylinderGeometry(raio * 1.02, raio * 1.02, 0.1, 8); aro.translate(x, alt - 0.08, z);
    L.add(L.toon, aro, 0xc8963e);
    const pe = new THREE.CylinderGeometry(raio * 1.12, raio * 1.2, 0.18, 8); pe.translate(x, 0.09, z);
    L.add(L.toon, pe, PEDRA.escura);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 8 + Math.atan2(x, z);
      const s = geoEstrela4(raio * 0.32, raio * 0.09, 0.03);
      s.rotateY(a); s.translate(x + Math.sin(a) * raio * 0.97, alt * 0.48, z + Math.cos(a) * raio * 0.97);
      L.add(L.brilho, s, 0xffd36a);
    }
  };
  for (const p of PILARES.pos) pedestal(p.x, p.z, PILARES.raio, 0.85);
  for (const c of CRISTAIS.pos) pedestal(c.x, c.z, CRISTAIS.raio, 0.45);

  // cristaizinhos de enfeite na beira (entre os pilares, rentes à borda)
  for (let i = 0; i < 14; i++) {
    const a = ((i + 0.5) / 14) * Math.PI * 2 + (rnd() - 0.5) * 0.2, r = R - 0.55;
    for (let k = 0; k < 3; k++) {
      const h = 0.35 + rnd() * 0.45;
      const c = new THREE.ConeGeometry(0.1 + rnd() * 0.05, h, 5); c.translate(0, h / 2, 0);
      c.rotateZ((rnd() - 0.5) * 0.8); c.rotateX((rnd() - 0.5) * 0.6);
      c.translate(Math.sin(a) * r + (rnd() - 0.5) * 0.35, 0, Math.cos(a) * r + (rnd() - 0.5) * 0.35);
      L.add(L.toon, c, (p, _n, cc) => misturar(cc, 0x8a5ad8, 0xe8c8ff, p.y / 0.7));
    }
  }

  // as 6 lembranças
  lembrancas(L, rnd);

  const matToon = materialToon({ vertexColors: true, proprio: 0.12, borda: 0xffd6f0, forcaBorda: 0.18, balanco: true });
  const ilha = new THREE.Mesh(juntar(L.toon), matToon);
  ilha.receiveShadow = q === 'alta'; ilha.castShadow = q === 'alta';
  const brilhoMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  brilhoMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = TEMPO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float balanco; uniform float uTempo;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BALANCO_GLSL}`);
  };
  brilhoMat.customProgramCacheKey = () => 'arena-brilho-balanco';
  const brilho = new THREE.Mesh(juntar(L.brilho), brilhoMat);
  const quedas = new THREE.Mesh(juntar(L.quedas), materialQueda());
  quedas.renderOrder = 4; quedas.frustumCulled = false;
  grupo.add(ilha, brilho, quedas);

  // grama e flores instanciadas (vento no shader), fora da praça, dos pilares e dos cristais
  const nTufos = q === 'baixa' ? 260 : q === 'media' ? 520 : 900;
  const nFlores = q === 'baixa' ? 160 : q === 'media' ? 340 : 560;
  const livre = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    if (r < 4.1 || r > R - 0.75) return false;
    for (const p of [...PILARES.pos, ...CRISTAIS.pos]) if (Math.hypot(x - p.x, z - p.z) < 1.0) return false;
    return true;
  };
  const sortear = (n: number, f: (m: THREE.Matrix4, i: number) => void) => {
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let i = 0, tent = 0;
    while (i < n && tent++ < n * 20) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!livre(x, z)) continue;
      qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      const e = 0.8 + rnd() * 0.9;
      m.compose(p.set(x, 0, z), qq, s.set(e, e * (0.8 + rnd() * 0.5), e));
      f(m, i++);
    }
    return i;
  };
  const tufos = new THREE.InstancedMesh(geoTufo({ gramaEscura: 0x1f6a2a, gramaClara: 0x9ad83a }), materialMundo(q, { vento: true, ruido: false, plano: false }), nTufos);
  tufos.count = sortear(nTufos, (m, i) => tufos.setMatrixAt(i, m));
  const coresFlor = [0xff8ac8, 0xffffff, 0xc89aff, 0xffe066, 0xff6fa8, 0xa8c8ff];
  const flores = new THREE.InstancedMesh(geoFlor(), materialMundo(q, { vento: true, ruido: false, plano: false }), nFlores);
  const cf = new THREE.Color();
  flores.count = sortear(nFlores, (m, i) => {
    m.scale(new THREE.Vector3(1.15, 1.1, 1.15));
    flores.setMatrixAt(i, m);
    flores.setColorAt(i, cf.setHex(coresFlor[Math.floor(rnd() * coresFlor.length)]));
  });
  tufos.computeBoundingSphere(); flores.computeBoundingSphere();
  tufos.receiveShadow = flores.receiveShadow = q === 'alta';
  grupo.add(tufos, flores);
  return { grupo, brilho: brilhoMat };
}

// ---------------------------------------------------------------- lembranças (os 6 capítulos)
function lembrancas(L: Lotes, rnd: () => number) {
  // ângulo (graus, 0 = +z, para onde a câmera costuma ficar), distância, altura
  const onde: [number, number, number][] = [[112, 27, -1.5], [152, 31, 1.5], [184, 35, 3.5], [214, 31, 1], [246, 28, -1.5], [298, 30, 0]];
  const kits = [brinquedos, floresta, relogio, oceano, doces, espelhos];
  onde.forEach(([g, d, h], k) => {
    const a = (g * Math.PI) / 180;
    const cx = Math.sin(a) * d, cz = Math.cos(a) * d;
    const b = k + 1;
    const raio = 3.2 + rnd() * 0.8;
    rochaFlutuante(L, L.toon, raio, raio * 1.6, cx, h, cz, b, 10 + k, 28);
    // gramado em cima
    const topo = new THREE.CylinderGeometry(raio * 1.0, raio * 1.02, 0.25, 28); topo.translate(cx, h + 0.05, cz);
    L.add(L.toon, topo, (_p, n, c) => misturar(c, GRAMA.escura, GRAMA.media, Math.max(0, n.y)), b);
    // cascata
    const qa = a + Math.PI * 0.75 + rnd();
    L.quedas.push(queda(cx + Math.sin(qa) * raio * 0.98, cz + Math.cos(qa) * raio * 0.98, h - 0.1, 9, 0.8, b));
    kits[k](L, cx, h + 0.17, cz, b, rnd, a);
  });
}

type Kit = (L: Lotes, x: number, y: number, z: number, b: number, rnd: () => number, a: number) => void;

const brinquedos: Kit = (L, x, y, z, b, rnd) => {
  const cores = [0xe84a4a, 0x4a8ae8, 0xf2c94a, 0x5ac86a, 0xe88ad8, 0xff9a40];
  const pilhas: [number, number, number][] = [[-0.9, 0.3, 3], [0.4, -0.6, 2], [1.2, 0.8, 1], [-0.2, 1.1, 1]];
  for (const [px, pz, n] of pilhas) for (let k = 0; k < n; k++) {
    const c = new THREE.BoxGeometry(0.75, 0.75, 0.75); c.rotateY(rnd() * 0.6);
    c.translate(x + px + (rnd() - 0.5) * 0.1, y + 0.375 + k * 0.75, z + pz);
    L.add(L.toon, c, cores[Math.floor(rnd() * cores.length)], b);
  }
  const bola = new THREE.SphereGeometry(0.45, 14, 10); bola.translate(x + 1.4, y + 0.45, z - 0.8);
  L.add(L.toon, bola, (p, _n, c) => c.setHex(Math.sin(Math.atan2(p.z - (z - 0.8), p.x - (x + 1.4)) * 3) > 0 ? 0xffffff : 0xe84a4a), b);
  // ursinho
  const ux = x - 1.4, uz = z - 0.9;
  const parte = (g: THREE.BufferGeometry, px: number, py: number, pz: number, cor: number) => { g.translate(ux + px, y + py, uz + pz); L.add(L.toon, g, cor, b); };
  parte(new THREE.SphereGeometry(0.42, 12, 9), 0, 0.42, 0, 0xb07a48);
  parte(new THREE.SphereGeometry(0.32, 12, 9), 0, 1.05, 0, 0xb07a48);
  for (const s of [-1, 1]) { parte(new THREE.SphereGeometry(0.12, 8, 6), s * 0.24, 1.32, 0, 0x8a5a32); parte(new THREE.SphereGeometry(0.14, 8, 6), s * 0.4, 0.5, 0.15, 0xb07a48); }
  parte(new THREE.SphereGeometry(0.13, 8, 6), 0, 1.0, 0.27, 0xe8c8a0);
};

const floresta: Kit = (L, x, y, z, b) => {
  // cogumelo grande vermelho de pintas brancas
  const pe = new THREE.CylinderGeometry(0.4, 0.55, 1.8, 12); pe.translate(x - 0.6, y + 0.9, z);
  L.add(L.toon, pe, 0xf6ead2, b);
  const chapeu = new THREE.SphereGeometry(1.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); chapeu.scale(1, 0.62, 1); chapeu.translate(x - 0.6, y + 1.7, z);
  L.add(L.toon, chapeu, (p, _n, c) => {
    const pinta = Math.sin(p.x * 3.1) * Math.sin(p.z * 3.3) * Math.sin(p.y * 4.0) > 0.35;
    c.setHex(pinta ? 0xffffff : 0xe0393c);
  }, b);
  // arvorezinha
  const tronco = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 7); tronco.translate(x + 1.5, y + 0.8, z + 0.6);
  L.add(L.toon, tronco, 0x7a4a30, b);
  for (const [dx, dy, r] of [[0, 2.0, 0.9], [0.5, 1.7, 0.6], [-0.4, 1.8, 0.65]] as const) {
    const c = new THREE.SphereGeometry(r, 12, 9); c.translate(x + 1.5 + dx, y + dy, z + 0.6);
    L.add(L.toon, c, (p, _n, cc) => misturar(cc, 0x2f7a3a, 0x8fd25a, (p.y - y - 1.2) / 1.6), b);
  }
  const mini = new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); mini.translate(x + 0.4, y + 0.5, z - 1.3);
  L.add(L.toon, mini, 0xff6a8a, b);
  const pmini = new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8); pmini.translate(x + 0.4, y + 0.25, z - 1.3);
  L.add(L.toon, pmini, 0xf6ead2, b);
};

const relogio: Kit = (L, x, y, z, b, _r, a) => {
  const ouro = 0xd8a040, ouroClaro = 0xf2c860;
  const torre = new THREE.BoxGeometry(1.5, 2.6, 1.5); torre.translate(x, y + 1.3, z);
  L.add(L.toon, torre, (_p, n, c) => misturar(c, ouro, ouroClaro, Math.max(0, n.y) * 0.6), b);
  const teto = new THREE.ConeGeometry(1.25, 1.3, 4); teto.rotateY(Math.PI / 4); teto.translate(x, y + 3.25, z);
  L.add(L.toon, teto, 0x9a5a3a, b);
  for (const s of [-1, 1]) {
    const t = new THREE.CylinderGeometry(0.35, 0.4, 1.8, 8); t.translate(x + s * 1.3, y + 0.9, z + 0.3);
    L.add(L.toon, t, ouro, b);
    const c = new THREE.ConeGeometry(0.45, 0.8, 8); c.translate(x + s * 1.3, y + 2.2, z + 0.3);
    L.add(L.toon, c, 0x9a5a3a, b);
  }
  // mostrador virado para o centro da arena
  const f = -1;
  const dx = Math.sin(a) * f, dz = Math.cos(a) * f;
  const mostr = new THREE.CircleGeometry(0.55, 24); mostr.rotateY(Math.atan2(dx, dz)); mostr.translate(x + dx * 0.77, y + 1.9, z + dz * 0.77);
  L.add(L.brilho, mostr, 0xfff2d0, b);
  const aro = new THREE.TorusGeometry(0.58, 0.07, 5, 24); aro.rotateY(Math.atan2(dx, dz)); aro.translate(x + dx * 0.78, y + 1.9, z + dz * 0.78);
  L.add(L.toon, aro, ouroClaro, b);
  for (const [comp, ang] of [[0.4, 0.4], [0.3, 2.1]] as const) {
    const p = new THREE.BoxGeometry(0.05, comp, 0.02); p.translate(0, comp / 2, 0); p.rotateZ(ang); p.rotateY(Math.atan2(dx, dz));
    p.translate(x + dx * 0.8, y + 1.9, z + dz * 0.8);
    L.add(L.toon, p, 0x3a2a3a, b);
  }
  // engrenagem
  const eng = new THREE.TorusGeometry(0.5, 0.12, 4, 12); eng.rotateY(Math.atan2(dx, dz) + Math.PI / 2); eng.translate(x - 1.1, y + 1.0, z - 0.9);
  L.add(L.toon, eng, ouro, b);
};

const oceano: Kit = (L, x, y, z, b) => {
  // redoma de vidro azul com recifes e arcos dentro (o vidro é brilho azul translúcido falso)
  const domo = new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); domo.translate(x, y, z);
  L.add(L.brilho, domo, (p, n, c) => {
    const k = Math.pow(1 - Math.abs(n.y), 2);
    misturar(c, 0x2a68c8, 0x9ae8ff, k * 0.9 + (p.y - y) / 2.4 * 0.2);
  }, b);
  for (const [dx, dz, cor, h] of [[-1, 0.5, 0xff7a9a, 0.8], [0.8, -0.6, 0xffb36a, 0.6], [0.2, 1.1, 0xc87aff, 0.7]] as const) {
    const c = new THREE.ConeGeometry(0.3, h, 6); c.translate(x + dx, y + h / 2, z + dz);
    L.add(L.toon, c, cor, b);
  }
};

const doces: Kit = (L, x, y, z, b, rnd) => {
  const rosa = 0xf6a8c8, creme = 0xfff0dc, morango = 0xe85a8a;
  const base = new THREE.BoxGeometry(2.4, 1.3, 1.6); base.translate(x, y + 0.65, z);
  L.add(L.toon, base, creme, b);
  const glace = new THREE.BoxGeometry(2.5, 0.25, 1.7); glace.translate(x, y + 1.35, z);
  L.add(L.toon, glace, rosa, b);
  for (const [dx, dz, h] of [[-1.1, -0.7, 2.4], [1.1, -0.7, 2.2], [0, -0.4, 2.9], [-1.1, 0.7, 2.0], [1.1, 0.7, 2.1]] as const) {
    const t = new THREE.CylinderGeometry(0.32, 0.36, h, 10); t.translate(x + dx, y + h / 2, z + dz);
    L.add(L.toon, t, (p, _n, c) => c.setHex(Math.sin((p.y - y) * 6) > 0.6 ? morango : creme), b);
    const c = new THREE.ConeGeometry(0.45, 0.8, 10); c.translate(x + dx, y + h + 0.4, z + dz);
    L.add(L.toon, c, rosa, b);
  }
  for (let k = 0; k < 3; k++) { // pirulitos
    const px = x + (rnd() - 0.5) * 4, pz = z + 1.4 + rnd() * 0.6;
    const cabo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 5); cabo.translate(px, y + 0.65, pz);
    L.add(L.toon, cabo, 0xffffff, b);
    const disco = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 18); disco.rotateX(Math.PI / 2); disco.translate(px, y + 1.5, pz);
    L.add(L.toon, disco, (p, _n, c) => c.setHex(Math.sin(Math.atan2(p.y - y - 1.5, p.x - px) * 2 + Math.hypot(p.x - px, p.y - y - 1.5) * 14) > 0 ? 0xff5a8a : 0xffffff), b);
  }
};

const espelhos: Kit = (L, x, y, z, b, rnd, a) => {
  for (let k = 0; k < 7; k++) {
    const h = 1.2 + rnd() * 2.2, r = 0.22 + rnd() * 0.2;
    const c = new THREE.CylinderGeometry(0, r, h * 0.25, 6); c.translate(0, h * 0.875, 0);
    const corpo = new THREE.CylinderGeometry(r, r, h * 0.75, 6); corpo.translate(0, h * 0.375, 0);
    const g = mergeGeometries([c.toNonIndexed(), corpo.toNonIndexed()])!;
    g.rotateZ((rnd() - 0.5) * 0.7); g.rotateX((rnd() - 0.5) * 0.5);
    g.translate(x + (rnd() - 0.5) * 3, y, z + (rnd() - 0.5) * 2.4);
    L.add(L.toon, g, (p, n, cc) => misturar(cc, 0x7a4ad0, 0xe0d0ff, (p.y - y) / 3 * 0.7 + Math.max(0, n.x) * 0.3), b);
  }
  // espelhos de moldura dourada virados para a arena
  for (const s of [-1, 1]) {
    const ang = a + Math.PI + s * 0.5;
    const mx = x + Math.sin(a + Math.PI) * 1.2 + s * 1.2 * Math.cos(a), mz = z + Math.cos(a + Math.PI) * 1.2 - s * 1.2 * Math.sin(a);
    const mold = new THREE.BoxGeometry(1.1, 1.8, 0.12); mold.translate(0, 0.9, 0); mold.rotateY(ang); mold.translate(mx, y, mz);
    L.add(L.toon, mold, 0xd8a040, b);
    const vid = new THREE.PlaneGeometry(0.85, 1.55); vid.translate(0, 0.9, 0.07); vid.rotateY(ang); vid.translate(mx, y, mz);
    L.add(L.brilho, vid, (p, _n, c) => misturar(c, 0xb8c8ff, 0xf0e8ff, (p.y - y) / 1.8), b);
  }
};
