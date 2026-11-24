// Pós-processamento: só "brilho" (bloom) e só na qualidade alta. Na média e na baixa os halos aditivos fazem o papel.
//
// O brilho é SELETIVO (docs/revisao/ARTE_DIAGNOSTICO.md §3 e §6.6). Antes, um limiar de luminância (0,82) deixava
// passar céu, névoa, cascatas, raios de sol e tampos claros: era a causa do véu leitoso da alta. Agora quem floresce é
// MARCADO: durante o render da alta, os materiais de brilho (janelas, lanternas, cristais, cogumelos mágicos, estrelas;
// `materialBrilho`/`marcarBrilho`) gravam 3 no alfa do alvo HalfFloat, e as faíscas e vaga-lumes aditivos somam no
// alfa; o filtro do bloom deixa passar só pixels com alfa > 1,5. Halos e raios de sol aditivos não somam no alfa
// (materialQuadros). A cor dos materiais não muda. O borrão roda a ¼ da resolução, com força e raio pequenos.
//
// `?bloom=0` na URL desliga só o brilho (o OutputPass continua), para medir alta × alta-sem-brilho.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HDR_BRILHO } from './materiais';

/** Parâmetros do brilho seletivo: força e raio do borrão; `marca` = valor gravado no alfa pelos materiais de brilho. */
export const BRILHO = { forca: 0.3, raio: 0.3, marca: 3 } as const;

const SEM_BRILHO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('bloom') === '0';

export class Pos {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  /** `_claro` (tema de céu claro) não muda mais nada: com o limiar acima do céu, todos os temas usam o mesmo brilho. */
  constructor(renderer: THREE.WebGLRenderer, cena: THREE.Scene, camera: THREE.Camera, _claro = false) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(cena, camera));
    if (!SEM_BRILHO) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BRILHO.forca, BRILHO.raio, 0);
      // filtro seletivo no lugar do filtro de luminância: só o que foi marcado no alfa (sem limiar de brilho)
      const f = this.bloom.materialHighPassFilter;
      f.fragmentShader = /* glsl */ `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() {
          vec4 t = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(t.rgb * smoothstep(1.5, 2.5, t.a), 1.0);
        }`;
      f.needsUpdate = true;
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
  }
  /** o alvo em que a cena é desenhada (para compilar os shaders da alta com o mesmo estado: espaço linear, sem curva) */
  get alvoCena() { return this.composer.readBuffer; }
  setSize(w: number, h: number, pr: number) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // o composer acabou de dar ao brilho o tamanho cheio (ele usa a metade); aqui vai para ¼ da resolução de desenho
    this.bloom?.setSize(Math.max(2, Math.round((w * pr) / 2)), Math.max(2, Math.round((h * pr) / 2)));
  }
  render() {
    // o ganho só vale dentro deste render (a média e a baixa nunca o veem, mesmo se a qualidade mudar na sessão)
    HDR_BRILHO.value = this.bloom ? BRILHO.marca : 1;
    try { this.composer.render(); } finally { HDR_BRILHO.value = 1; }
  }
}
