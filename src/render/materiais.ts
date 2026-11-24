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

export interface OpcoesMundo {
  vento?: boolean; ruido?: boolean; escalaRuido?: number; forcaRuido?: number;
  /**
   * Regras do plano 2.5D (padrão: sim): névoa colorida só ATRÁS da faixa de jogo (z < −2,5, por profundidade e por
   * altura nos abismos) e primeiro plano (z > +2,3) mais escuro. A arena 3D passa `plano: false` (névoa padrão).
   */
  plano?: boolean;
}

/**
 * Estilo do capítulo compartilhado por todos os materiais do mundo (definido por `configurarEstilo`, chamado ao
 * montar o cenário): cor da sombra própria (a rampa de toon tinge o lado sem sol com ela, nunca cinza) e as duas
 * cores da névoa em gradiente (perto/baixo = tom médio-escuro; longe = cor de atmosfera do capítulo).
 */
export const ESTILO = {
  uSombra: { value: new THREE.Color(0x7080c0) },
  uNevoaPerto: { value: new THREE.Color(0x4a3a78) },
  uNevoaLonge: { value: new THREE.Color(0x8a6ab8) },
  uNevoaForca: { value: 0.85 },
};

export interface EstiloMundo { sombra: number; nevoaPerto: number; nevoaLonge: number; nevoaForca?: number }
export function configurarEstilo(e: EstiloMundo) {
  ESTILO.uSombra.value.setHex(e.sombra);
  ESTILO.uNevoaPerto.value.setHex(e.nevoaPerto);
  ESTILO.uNevoaLonge.value.setHex(e.nevoaLonge);
  ESTILO.uNevoaForca.value = e.nevoaForca ?? 0.85;
}

/**
 * Rampa de toon MACIA do cenário (todas as qualidades): 3 faixas com transição suave em vez do cosseno de Lambert.
 * Lado sem sol = cor de sombra do capítulo × 0,42; face de lado para o sol (frente dos barrancos) = 0,8; face ao sol
 * = 1. Os personagens têm a rampa dura deles (personagem.ts).
 */
const RAMPA_GLSL = /* glsl */ `
uniform vec3 uSombra;
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float d = dot( normal, lightDirection );
  vec3 sombra = uSombra * 0.42;
  vec3 c = mix( sombra, vec3( 0.8 ), smoothstep( -0.04, 0.14, d ) );
  return mix( c, vec3( 1.0 ), smoothstep( 0.42, 0.62, d ) );
}`;

export function materialMundo(q: Qualidade, o: OpcoesMundo = {}): THREE.Material {
  // toon (custo de Lambert) em todas as qualidades; a alta ganha sombras reais (cena.ts), não outro material
  const mat = new THREE.MeshToonMaterial({ vertexColors: true });
  const plano = o.plano !== false;
  const ruido = o.ruido !== false;
  const oitavas = q === 'baixa' ? 1 : 2;
  const esc = (o.escalaRuido ?? 1.6).toFixed(3), forca = (o.forcaRuido ?? 0.26).toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = TEMPO;
    Object.assign(sh.uniforms, ESTILO);
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
      .replace('#include <common>', `#include <common>\nvarying vec3 vMundoP; varying vec3 vMundoN;\nuniform vec3 uNevoaPerto, uNevoaLonge; uniform float uNevoaForca;\n${RUIDO_GLSL}`)
      .replace('#include <gradientmap_pars_fragment>', RAMPA_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
${ruido ? `{
  vec3 pr = vMundoP * ${esc};
  float rn = edmRuido(pr)${oitavas > 1 ? ' * 0.62 + edmRuido(pr * 3.7 + 11.0) * 0.38' : ''};
  diffuseColor.rgb *= 1.0 + ${forca} * (rn * 2.0 - 1.0);
}` : ''}
{
  // tom quente do pôr do sol nas faces voltadas para cima, arroxeado nas de baixo (pintura, não física; ≤ 1)
  float cima = vMundoN.y;
  diffuseColor.rgb *= mix(vec3(0.84, 0.78, 0.98), vec3(1.02, 0.98, 0.88), smoothstep(-0.6, 0.9, cima));
}
${plano ? `// primeiro plano (entre a câmera e a faixa de jogo) mais escuro: moldura, não destaque
diffuseColor.rgb *= mix(1.0, 0.42, smoothstep(2.3, 5.0, vMundoP.z));` : ''}`)
      .replace('#include <fog_fragment>', plano ? `{
  // névoa colorida só atrás da faixa de jogo: por profundidade (z) e por altura nos abismos; nada na frente
  float fz = pow(clamp((-vMundoP.z - 2.5) / 45.0, 0.0, 1.0), 0.8);
  float fy = smoothstep(-1.2, -7.5, vMundoP.y) * smoothstep(1.0, -3.0, vMundoP.z) * 0.55;
  float f = clamp(fz + fy * (1.0 - fz), 0.0, 1.0) * uNevoaForca;
  vec3 corN = mix(uNevoaPerto, uNevoaLonge, clamp(fz * 1.4, 0.0, 1.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, corN, f);
}` : '#include <fog_fragment>');
  };
  mat.customProgramCacheKey = () => `mundo2-${q}-${o.vento ? 1 : 0}-${ruido ? 1 : 0}-${plano ? 1 : 0}-${esc}-${forca}`;
  return mat;
}

/**
 * Marca de brilho seletivo. Fora do render da alta vale 1. Durante o render da alta (pos.ts) vale 3 e os materiais de
 * brilho gravam esse valor no ALFA do alvo de render (HalfFloat): o filtro do bloom só deixa passar pixels marcados.
 * A cor não muda (a média e a alta mostram a mesma janela/lanterna; a alta só ganha o halo).
 */
export const HDR_BRILHO = { value: 1 };

/** Faz um MeshBasicMaterial opaco entrar no brilho seletivo da alta (janelas, lanternas, cristais, estrelas). */
export function marcarBrilho<T extends THREE.MeshBasicMaterial>(m: T, chave = 'brilho-marca'): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHdr = HDR_BRILHO;
    // peça grande que é "luz" mas não deve espalhar halo (mostrador, espelho, cristal gigante): normal zerada (`semHalo`)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMarca;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMarca = step(0.5, length(normal));');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHdr; varying float vMarca;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = max(gl_FragColor.a, mix(1.0, uHdr, vMarca));');
  };
  m.customProgramCacheKey = () => chave;
  return m;
}

/** Tira uma peça do lote de brilho do halo da alta (continua sem luz e com a mesma cor): zera as normais. */
export function semHalo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (n) { for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0, 0); n.needsUpdate = true; }
  return g;
}

/** Material sem luz para coisas que brilham (janelas, lanternas, cogumelos mágicos). Cor por vértice. */
export function materialBrilho(): THREE.MeshBasicMaterial {
  return marcarBrilho(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }), 'brilho-vc');
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
    // aditivo: soma só a cor; o alfa do alvo fica como está (halos e raios de sol NÃO entram no brilho da alta)
    blending: aditivo ? THREE.CustomBlending : THREE.NormalBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    toneMapped: false,
  });
}

/**
 * Bolha de sabão: transparente no meio, borda clara e furta-cor (fresnel), com um reflexo de janelinha.
 * Usada na bolha do jogador sem corações e nas plataformas-bolha.
 */
export function materialBolha(tom = 0xbfe8ff): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO, uTom: { value: new THREE.Color(tom) }, uAlfa: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTempo, uAlfa; uniform vec3 uTom; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float fr = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float h = fr * 3.0 + vP.y * 2.0 + uTempo * 0.6;
        vec3 arco = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + h));
        vec3 c = mix(uTom, arco, 0.55) * (0.35 + fr * 1.3);
        // reflexo: manchinha clara no alto à esquerda
        float rf = smoothstep(0.82, 0.97, dot(vN, normalize(vec3(-0.45, 0.6, 0.65))));
        c += vec3(1.0) * rf * 1.2;
        float a = clamp(0.08 + fr * 0.85 + rf * 0.8, 0.0, 1.0) * uAlfa;
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
}
