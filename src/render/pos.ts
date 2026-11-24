// Pós-processamento: só "brilho" (bloom) e só na qualidade alta. Na média e na baixa os halos aditivos fazem o papel.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class Pos {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  /** `claro`: tema de céu claro (oceano, doces, espelhos): brilho mais fraco e limiar mais alto, senão a tela lava */
  constructor(renderer: THREE.WebGLRenderer, cena: THREE.Scene, camera: THREE.Camera, claro = false) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(cena, camera));
    // limiar alto: só o que já é muito claro (janelas, lanternas, portal, sol, cascatas) floresce
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), claro ? 0.2 : 0.55, claro ? 0.4 : 0.65, claro ? 0.97 : 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, pr: number) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // o brilho em meia resolução basta (é borrado de qualquer jeito)
    this.bloom.resolution.set(w / 2, h / 2);
  }
  render() { this.composer.render(); }
}
