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
    // alvo da cena com MSAA 4× (R35): antes o compositor desenhava num alvo sem amostras e a alta perdia o antialias
    // (o MSAA do canvas só valia para o retângulo final). O canvas da alta é criado sem antialias (cena.ts).
    const alvo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, alvo);
    // a cena vai para o readBuffer (renderTarget2, o clone com MSAA); o writeBuffer (renderTarget1) não recebe nada
    // nesta cadeia (o brilho escreve no readBuffer, a saída na tela, e nada troca os dois; ver a saída abaixo): sem
    // amostras, sem profundidade e 1×1, para não gastar memória de vídeo à toa
    this.composer.renderTarget1.samples = 0;
    this.composer.renderTarget1.depthBuffer = false;
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
    // a saída vai para a tela e não troca os alvos: assim a cena cai SEMPRE no mesmo alvo (o readBuffer, com MSAA);
    // com a troca padrão, um quadro sim e outro não ia para o writeBuffer
    const saida = new OutputPass();
    saida.needsSwap = false;
    this.composer.addPass(saida);
  }
  /** o alvo em que a cena é desenhada (o RenderPass usa o readBuffer): para compilar os shaders da alta com o mesmo
   *  estado (espaço linear, sem curva de tons) e para os testes conferirem o MSAA */
  get alvoCena() { return this.composer.readBuffer; }
  setSize(w: number, h: number, pr: number) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // o writeBuffer não é usado nesta cadeia (ver o construtor): 1×1 em vez de mais uma tela cheia em HalfFloat
    this.composer.renderTarget1.setSize(1, 1);
    // o composer acabou de dar ao brilho o tamanho cheio (ele usa a metade); aqui vai para ¼ da resolução de desenho
    this.bloom?.setSize(Math.max(2, Math.round((w * pr) / 2)), Math.max(2, Math.round((h * pr) / 2)));
  }
  render() {
    // o ganho só vale dentro deste render (a média e a baixa nunca o veem, mesmo se a qualidade mudar na sessão)
    HDR_BRILHO.value = this.bloom ? BRILHO.marca : 1;
    try { this.composer.render(); } finally { HDR_BRILHO.value = 1; }
  }
}
