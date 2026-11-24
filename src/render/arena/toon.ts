// Materiais "em desenho" da Arena do Coração: sombreamento em 3 faixas (toon/cel), luz de borda recortada e
// contorno escuro (casco invertido expandido na tela, com espessura em pixels). O contorno usa uma normal suavizada
// (`normalContorno`), senão os modelos do Meshy (vértices duplicados nas costuras de UV) racham o traço.
import * as THREE from 'three';
import { TEMPO } from '../materiais';

/** Resolução da tela (px) para o contorno em pixels; atualizada em `CenaArena.redimensionar`. */
export const RESOLUCAO = { value: new THREE.Vector2(1280, 720) };

/**
 * Recorte de visão: o que estiver entre a câmera e quem joga (no chão, a menos de `uRecorteRaio` m da linha) fica
 * pontilhado (some 3 de cada 4 pixels), para um pilar de cristal não tapar o personagem. Atualizado em
 * `CenaArena.desenhar`; câmera = alvo desliga.
 */
export const RECORTE = { uCamP: { value: new THREE.Vector3() }, uAlvoP: { value: new THREE.Vector3() }, uRecorteRaio: { value: 1.4 } };
const RECORTE_VERT_DECL = 'varying vec3 vMundoR;';
const RECORTE_VERT = `{
  vec4 mR = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mR = instanceMatrix * mR;
  #endif
  vMundoR = (modelMatrix * mR).xyz;
}`;
const RECORTE_FRAG_DECL = 'varying vec3 vMundoR; uniform vec3 uCamP, uAlvoP; uniform float uRecorteRaio;';
const RECORTE_FRAG = `{
  vec2 segR = (uAlvoP - uCamP).xz; float l2R = dot(segR, segR);
  if (l2R > 0.01) {
    float uR = dot(vMundoR.xz - uCamP.xz, segR) / l2R;
    float dR = length(vMundoR.xz - (uCamP.xz + segR * clamp(uR, 0.0, 1.0)));
    float qR = smoothstep(uRecorteRaio, uRecorteRaio * 0.55, dR) * step(0.0, uR) * step(uR, 0.93);
    vec2 pR = mod(floor(gl_FragCoord.xy), 2.0);
    float bR = (pR.x * 2.0 + pR.y + 0.5) / 4.0;
    if (bR < qR * 0.8) discard;
  }
}`;
function comRecorte(sh: { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> }) {
  Object.assign(sh.uniforms, RECORTE);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${RECORTE_VERT_DECL}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${RECORTE_VERT}`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${RECORTE_FRAG_DECL}`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${RECORTE_FRAG}`);
}

let gradiente: THREE.DataTexture | null = null;
/** Rampa de 3 tons (sombra, meio-tom, luz) com filtro "mais próximo": as faixas ficam com borda dura. */
export function rampaToon(): THREE.DataTexture {
  if (gradiente) return gradiente;
  const d = new Uint8Array([105, 105, 105, 255, 178, 178, 178, 255, 255, 255, 255, 255]);
  gradiente = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  gradiente.minFilter = gradiente.magFilter = THREE.NearestFilter;
  gradiente.generateMipmaps = false;
  gradiente.needsUpdate = true;
  return gradiente;
}

export interface OpcoesToon {
  cor?: number;
  mapa?: THREE.Texture | null;
  vertexColors?: boolean;
  /** luz própria (fração da cor da textura): deixa os modelos mais vivos à sombra */
  proprio?: number;
  /** cor e força da luz de borda */
  borda?: number;
  forcaBorda?: number;
  lados?: THREE.Side;
  /** ilhas flutuantes: sobe e desce pelo atributo `balanco` (0 = parado; senão a fase da onda) */
  balanco?: boolean;
  /** pontilha o que estiver entre a câmera e quem joga (pilares); ver RECORTE */
  recorte?: boolean;
}

/** Trecho de vertex shader: ilhazinhas que sobem e descem (atributo `balanco`, uniform `uTempo`). */
export const BALANCO_GLSL = 'transformed.y += step(0.5, balanco) * sin(uTempo * 0.55 + balanco * 1.9) * 0.45;';

/** Uniforms que a cena muda por objeto: clarão de acerto (0…1) e a cor de borda. */
export interface UniformsToon { uProprio: { value: number }; uClarao: { value: number }; uBorda: { value: THREE.Color }; uTinta: { value: THREE.Color } }

export function materialToon(o: OpcoesToon = {}): THREE.MeshToonMaterial & { userData: { u: UniformsToon } } {
  const mat = new THREE.MeshToonMaterial({
    color: o.cor ?? 0xffffff,
    map: o.mapa ?? null,
    vertexColors: !!o.vertexColors,
    gradientMap: rampaToon(),
    side: o.lados ?? THREE.FrontSide,
  });
  const u: UniformsToon = {
    uProprio: { value: o.proprio ?? 0 },
    uClarao: { value: 0 },
    uBorda: { value: new THREE.Color(o.borda ?? 0xffd9a0).multiplyScalar(o.forcaBorda ?? 0.35) },
    uTinta: { value: new THREE.Color(1, 1, 1) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (o.balanco) {
      sh.uniforms.uTempo = TEMPO;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float balanco; uniform float uTempo;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BALANCO_GLSL}`);
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uClarao, uProprio; uniform vec3 uBorda; uniform vec3 uTinta;')
      // luz própria = a própria cor (textura × vértice), sem lavar de branco
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uProprio;')
      .replace('#include <opaque_fragment>', `{
  vec3 vd = normalize(vViewPosition);
  float fr = 1.0 - clamp(dot(normal, vd), 0.0, 1.0);
  outgoingLight += uBorda * smoothstep(0.55, 0.62, fr);
  outgoingLight *= uTinta;
  outgoingLight = mix(outgoingLight, vec3(1.0, 0.97, 0.9), uClarao);
}
#include <opaque_fragment>`);
    if (o.recorte) comRecorte(sh);
  };
  mat.customProgramCacheKey = () => `arena-toon-${o.balanco ? 1 : 0}-${o.recorte ? 1 : 0}`;
  return mat as THREE.MeshToonMaterial & { userData: { u: UniformsToon } };
}

/**
 * Contorno: casco de faces de trás, empurrado na tela ao longo da normal suavizada. `px` é a espessura em pixels
 * numa tela de 720 linhas (escala com a altura); longe da câmera (mais de `longe` m) afina.
 */
export function materialContorno(cor = 0x1c0c2c, px = 2.4, longe = 12, recorte = false): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: cor, side: THREE.BackSide, fog: false });
  const uEsp = { value: px }, uLonge = { value: longe };
  mat.userData.uEsp = uEsp;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEsp = uEsp; sh.uniforms.uLonge = uLonge; sh.uniforms.uRes = RESOLUCAO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 normalContorno; uniform float uEsp, uLonge; uniform vec2 uRes;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalContorno;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  #ifdef USE_SKINNING
    vec3 nObj = objectNormal;
  #else
    vec3 nObj = normalContorno;
    #ifdef USE_INSTANCING
      nObj = mat3(instanceMatrix) * nObj;
    #endif
  #endif
  vec3 nV = normalize(normalMatrix * nObj);
  vec2 d = nV.xy; float l = length(d);
  if (l > 1e-4) d /= l;
  float esp = uEsp * uRes.y / 720.0;
  gl_Position.xy += d * esp * 2.0 / uRes * min(gl_Position.w, uLonge);
}`);
    if (recorte) comRecorte(sh);
  };
  mat.customProgramCacheKey = () => `arena-contorno-${recorte ? 1 : 0}`;
  return mat;
}

/**
 * Normal suavizada para o contorno: média das normais de todos os vértices na mesma posição (as costuras de UV e
 * as quinas duras deixam de abrir o traço). Guarda em `normalContorno`.
 */
export function suavizarContorno(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.getAttribute('normalContorno')) return g;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const mapa = new Map<string, number>();
  const soma: number[] = [];
  const chave = new Array<number>(pos.count);
  const q = (v: number) => Math.round(v * 1e4);
  for (let i = 0; i < pos.count; i++) {
    const k = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
    let s = mapa.get(k);
    if (s === undefined) { s = soma.length / 3; mapa.set(k, s); soma.push(0, 0, 0); }
    chave[i] = s;
    soma[s * 3] += nor.getX(i); soma[s * 3 + 1] += nor.getY(i); soma[s * 3 + 2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = chave[i];
    const x = soma[s * 3], y = soma[s * 3 + 1], z = soma[s * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  g.setAttribute('normalContorno', new THREE.BufferAttribute(out, 3));
  return g;
}

/** Cria a malha de contorno de uma malha (mesmo esqueleto, se tiver). */
export function contornoDe(m: THREE.Mesh, mat: THREE.Material): THREE.Mesh {
  suavizarContorno(m.geometry);
  let c: THREE.Mesh;
  if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
    const s = m as THREE.SkinnedMesh;
    const cs = new THREE.SkinnedMesh(s.geometry, mat);
    cs.bind(s.skeleton, s.bindMatrix);
    c = cs;
  } else if ((m as THREE.InstancedMesh).isInstancedMesh) {
    const im = m as THREE.InstancedMesh;
    const ci = new THREE.InstancedMesh(im.geometry, mat, im.instanceMatrix.count);
    ci.instanceMatrix = im.instanceMatrix;
    c = ci;
  } else c = new THREE.Mesh(m.geometry, mat);
  c.position.copy(m.position); c.quaternion.copy(m.quaternion); c.scale.copy(m.scale);
  c.frustumCulled = m.frustumCulled;
  c.renderOrder = -1;
  return c;
}
