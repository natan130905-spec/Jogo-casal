// Materiais do cenário. O "material do mundo" usa a cor por vértice e acrescenta, no shader, uma textura procedural
// (ruído em coordenadas do mundo, sem UV nem imagem) que dá o aspecto pintado de rocha, casca e grama.
import * as THREE from 'three';
import type { Qualidade } from './cena';

/** Relógio compartilhado por todos os shaders animados (vento, água, brilhos). */
export const TEMPO = { value: 0 };

const RUIDO_GLSL = /* glsl */ `
float edmHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float edmRuido(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(edmHash(i), edmHash(i + vec3(1,0,0)), f.x), mix(edmHash(i + vec3(0,1,0)), edmHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(edmHash(i + vec3(0,0,1)), edmHash(i + vec3(1,0,1)), f.x), mix(edmHash(i + vec3(0,1,1)), edmHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

export interface OpcoesMundo { vento?: boolean; ruido?: boolean; escalaRuido?: number; forcaRuido?: number }

export function materialMundo(q: Qualidade, o: OpcoesMundo = {}): THREE.Material {
  // Lambert (barato por pixel) na baixa e na média; Standard só na alta
  const mat = q !== 'alta'
    ? new THREE.MeshLambertMaterial({ vertexColors: true })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const ruido = o.ruido !== false;
  const oitavas = q === 'baixa' ? 1 : 2;
  const esc = (o.escalaRuido ?? 1.6).toFixed(3), forca = (o.forcaRuido ?? 0.26).toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = TEMPO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTempo; varying vec3 vMundoP; varying vec3 vMundoN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${o.vento ? `{
  vec4 raizV = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    raizV = instanceMatrix * raizV;
  #endif
  raizV = modelMatrix * raizV;
  float h = max(position.y, 0.0);
  float onda = sin(uTempo * 1.7 + raizV.x * 0.55 + raizV.z * 0.4) + 0.4 * sin(uTempo * 3.1 + raizV.x * 1.3);
  transformed.x += onda * 0.22 * h * h;
  transformed.z += onda * 0.08 * h * h;
}` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 mp = vec4(transformed, 1.0);
  vec3 nn = objectNormal;
  #ifdef USE_INSTANCING
    mp = instanceMatrix * mp; nn = mat3(instanceMatrix) * nn;
  #endif
  vMundoP = (modelMatrix * mp).xyz;
  vMundoN = normalize(mat3(modelMatrix) * nn);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMundoP; varying vec3 vMundoN;\n${RUIDO_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${ruido ? `{
  vec3 pr = vMundoP * ${esc};
  float rn = edmRuido(pr)${oitavas > 1 ? ' * 0.62 + edmRuido(pr * 3.7 + 11.0) * 0.38' : ''};
  diffuseColor.rgb *= 1.0 + ${forca} * (rn * 2.0 - 1.0);
}` : ''}
{
  // luz quente do pôr do sol nas faces voltadas para cima, tom arroxeado nas de baixo (pintura, não física)
  float cima = vMundoN.y;
  diffuseColor.rgb *= mix(vec3(0.86, 0.8, 1.0), vec3(1.1, 1.03, 0.9), smoothstep(-0.6, 0.9, cima));
}`);
  };
  mat.customProgramCacheKey = () => `mundo-${q}-${o.vento ? 1 : 0}-${ruido ? 1 : 0}-${esc}-${forca}`;
  return mat;
}

/** Material sem luz para coisas que brilham (janelas, lanternas, cogumelos mágicos). Cor por vértice. */
export function materialBrilho(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
}

/**
 * Quadros "de luz" (halos, raios de sol, névoa): textura de atlas × cor por vértice (RGBA), com cintilação.
 * Aditivo para brilho, normal para névoa. Uma chamada de desenho por material.
 */
export function materialQuadros(mapa: THREE.Texture, aditivo: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: mapa }, uTempo: TEMPO },
    vertexShader: /* glsl */ `
      attribute vec4 cor; attribute float pisca;
      varying vec2 vUv; varying vec4 vCor;
      uniform float uTempo;
      void main(){
        vUv = uv;
        float k = pisca > 0.0 ? 0.72 + 0.28 * sin(uTempo * (0.7 + fract(pisca * 7.31) * 1.6) + pisca * 6.283) : 1.0;
        vCor = vec4(cor.rgb, cor.a * k);
        vec3 p = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMapa; varying vec2 vUv; varying vec4 vCor;
      void main(){
        vec4 t = texture2D(uMapa, vUv);
        gl_FragColor = vec4(vCor.rgb * t.rgb, t.a * vCor.a);
        #include <colorspace_fragment>
        ${aditivo ? 'gl_FragColor.rgb *= gl_FragColor.a; gl_FragColor.a = 1.0;' : ''}
      }`,
    transparent: true,
    depthWrite: false,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}
