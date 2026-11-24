// Câmera POR JOGADOR do 2.5D (docs/revisao/PESQUISA_ARTE_CAMERA.md §6): cada celular segue o próprio personagem
// ("eu"). Lógica pura (sem DOM nem WebGL): calcula o enquadramento a partir do Estado; `aplicarCamera` põe o resultado
// numa PerspectiveCamera do Three. Os testes (test/camera.test.ts) rodam esta mesma classe sobre os bots dos 7
// capítulos e medem o tamanho do personagem por projeção.
//
// Regras:
// - personagem (1,1 m de colisão) a 23 % da altura da tela; FOV vertical 35° → distância ≈ 7,6 m;
// - olho 1,7 m acima dos pés, SEM inclinar: os pés ficam a 30 % da altura da tela por deslocamento de lente
//   (vê-se a face dos barrancos, não o tampo das plataformas);
// - zona morta horizontal ±0,35 m; foco à frente 1,0 m parado → 1,8 m correndo, para o lado em que olha;
// - vertical por encaixe na plataforma: a âncora só muda ao pousar; no ar, só se sair da faixa −0,8 / +2,4 m
//   (pulo no plano não mexe a câmera);
// - parceiro perto (|dx| ≤ 8 m, transição até 12 m; |dy| ≤ 5,2 m, os dois corredores do cap. 6 a 5 m): enquadra os dois, afastando até 15 %;
// - estrelinha logo acima do personagem e fora do quadro: baixa os pés na tela (até 18 %) e, se preciso, afasta um
//   pouco, para o coletável não ficar invisível (o superpulo chega a 4,5 m);
// - suavização exponencial por meia-vida (igual em 30 e 60 fps).
import * as THREE from 'three';
import type { Estado, EstadoJogador, Fase } from '../core/types';

export const CAM = Object.freeze({
  fov: 35,
  /** fração da altura da tela ocupada pelo personagem no normal, e o mínimo ao enquadrar os dois */
  alt: 0.23, altMin: 0.15,
  /** altura da colisão do personagem (sim.ts) */
  corpo: 1.1,
  olho: 1.7,
  /** pés a esta fração da altura da tela (de baixo para cima); até `pesMin` quando há estrelinha acima */
  pes: 0.3, pesMin: 0.18,
  zonaMorta: 0.35,
  frenteParado: 1.0, frenteCorrendo: 1.8,
  /** faixa vertical (em relação à âncora) fora da qual a câmera segue no ar */
  faixaBaixo: 0.8, faixaCima: 2.4,
  /** parceiro: enquadra os dois até `pertoX`, some de vez em `longeX` */
  pertoX: 8, longeX: 12, pertoY: 5.2, longeY: 6.5,
  /** meias-vidas (s) */
  mvX: 0.14, mvY: 0.25, mvAncora: 0.18, mvFrente: 0.45, mvZoom: 0.6,
});

/** Distância da câmera para uma altura visível V (m) com o FOV da câmera. */
export const distanciaPara = (V: number) => V / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)));
/** Altura visível (m) com o personagem a `alt` da tela. */
export const alturaVisivel = (alt: number) => CAM.corpo / alt;

/** Enquadramento: centro x, y de referência dos pés (âncora), altura visível V (m) e fração da tela dos pés. */
export interface Quadro { x: number; yPes: number; V: number; pes: number }

const meia = (dt: number, h: number) => 1 - Math.exp((-dt * Math.LN2) / h);
const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 1 até `perto`, 0 a partir de `longe`, linear entre os dois */
const rampa = (d: number, perto: number, longe: number) => limitar((longe - d) / (longe - perto), 0, 1);

export class CameraJogador {
  /** âncora vertical (pés) de cada jogador: só muda ao pousar ou ao sair da faixa */
  private anc: [number, number] = [0, 0];
  private x = 0; private y = 0; private frente = 0;
  private V = alturaVisivel(CAM.alt); private pes = CAM.pes;
  private iniciou = false;
  /** alvo do último quadro (para testes e medidas): altura visível e pés pedidos antes da suavização */
  alvo = { V: alturaVisivel(CAM.alt), pes: CAM.pes, parceiro: 0, estrela: 0 };

  constructor(private fase: Fase) {}

  /** Recomeça do zero no próximo quadro (troca de personagem no treino, teleporte). */
  reiniciar() { this.iniciou = false; }

  private ancorar(i: number, j: EstadoJogador, dt: number, salto: boolean) {
    if (salto || j.bolha) { this.anc[i] = salto ? j.y : this.anc[i] + (j.y - this.anc[i]) * meia(dt, CAM.mvY); return; }
    if (j.noChao) this.anc[i] += (j.y - this.anc[i]) * meia(dt, CAM.mvAncora);
    else if (j.y > this.anc[i] + CAM.faixaCima) this.anc[i] = j.y - CAM.faixaCima;
    else if (j.y < this.anc[i] - CAM.faixaBaixo) this.anc[i] = j.y + CAM.faixaBaixo;
  }

  atualizar(e: Estado, eu: number, aspecto: number, dt: number): Quadro {
    const me = e.jogadores[eu], ou = e.jogadores[1 - eu];
    // teleporte (caiu e renasceu, início): encaixa sem deslizar pela fase
    const salto = !this.iniciou || Math.abs(me.x - this.x) > 14 || Math.abs(me.y - this.anc[eu]) > 9;
    this.ancorar(eu, me, dt, salto);
    this.ancorar(1 - eu, ou, dt, !this.iniciou);
    const aE = this.anc[eu], aO = this.anc[1 - eu];

    // foco à frente
    const corre = Math.min(1, Math.abs(me.vx) / 5);
    const frente = me.olhando * (CAM.frenteParado + (CAM.frenteCorrendo - CAM.frenteParado) * corre);
    this.frente = salto ? frente : this.frente + (frente - this.frente) * meia(dt, CAM.mvFrente);

    const Vbase = alturaVisivel(CAM.alt), Vmax = alturaVisivel(CAM.altMin);
    let fx = me.x + this.frente, fy = aE, V = Vbase, pes = CAM.pes;

    // parceiro perto: enquadra os dois (com as âncoras, para o pulo do outro também não balançar a câmera)
    const dx = ou.x - me.x, dy = aO - aE;
    const peso = ou.bolha ? 0 : Math.min(rampa(Math.abs(dx), CAM.pertoX, CAM.longeX), rampa(Math.abs(dy), CAM.pertoY, CAM.longeY));
    if (peso > 0) {
      fx = me.x + this.frente * (1 - 0.5 * peso) + dx * 0.5 * peso;
      let fyDois = aE + limitar(dy * 0.5, -1.5, 1.5);
      // largura que cabe os dois com 1,5 m de folga de cada lado (a tela é simétrica em torno de fx)
      const precisaX = Math.max(Math.abs(fx - me.x), Math.abs(fx - ou.x)) * 2 + 3;
      const baixo = Math.min(aE, aO) - 0.25, cima = Math.max(aE, aO) + CAM.corpo + 0.35;
      const precisa = Math.max(precisaX / aspecto, (fyDois - baixo) / pes, (cima - fyDois) / (1 - pes));
      const Vdois = limitar(precisa, Vbase, Vmax);
      // com o afastamento já no teto, desliza o y para a faixa em que os dois cabem (se couberem). Sem isso, com o
      // parceiro 4–5 m ABAIXO (cap. 6, dois andares), os pés a 30 % da tela deixavam o parceiro fora do quadro.
      const fyMin = cima - (1 - pes) * Vdois, fyMax = baixo + pes * Vdois;
      if (fyMin <= fyMax) fyDois = limitar(fyDois, fyMin, fyMax);
      fy = aE + (fyDois - aE) * peso;
      V = Vbase + (Vdois - Vbase) * peso;
    }

    // estrelinha logo acima e fora do quadro: abaixa os pés na tela e, se ainda faltar, afasta
    let estrela = 0;
    const est = this.fase.estrelinhas ?? [];
    for (let k = 0; k < est.length; k++) {
      const p = est[k];
      const h = p.y - aE;
      if (h <= 0 || h > 5.4 || e.coletadas.includes(k)) continue;
      const w = rampa(Math.abs(p.x - me.x), 2.0, 3.2);
      if (w <= 0) continue;
      const topo = fy + (1 - pes) * V;
      const falta = p.y + 0.5 - topo;
      if (falta <= 0) continue;
      estrela = Math.max(estrela, w);
      // primeiro os pés descem na tela; o resto vira afastamento
      const pesNovo = Math.max(CAM.pesMin, 1 - (p.y + 0.5 - fy) / V);
      const Vnovo = Math.max(V, (p.y + 0.5 - fy) / (1 - pesNovo));
      pes = pes + (pesNovo - pes) * w;
      V = Math.min(Vmax, V + (Vnovo - V) * w);
    }
    this.alvo = { V, pes, parceiro: peso, estrela };

    // suavização: zona morta em x, meia-vida em tudo
    if (salto) { this.x = fx; this.y = fy; this.V = V; this.pes = pes; this.iniciou = true; }
    else {
      const zx = fx - this.x;
      if (Math.abs(zx) > CAM.zonaMorta) this.x += (zx - Math.sign(zx) * CAM.zonaMorta) * meia(dt, CAM.mvX);
      this.y += (fy - this.y) * meia(dt, CAM.mvY);
      const kz = meia(dt, CAM.mvZoom);
      this.V += (V - this.V) * kz;
      this.pes += (pes - this.pes) * kz;
    }
    // trava dura: o próprio personagem nunca sai do quadro (queda rápida num vão, lançamento de gelatina)
    if (!me.bolha) {
      const baixo = this.y - this.pes * this.V, cima = this.y + (1 - this.pes) * this.V;
      if (me.y - 0.3 < baixo) this.y += me.y - 0.3 - baixo;
      else if (me.y + CAM.corpo + 0.3 > cima) this.y += me.y + CAM.corpo + 0.3 - cima;
      const meiaL = (this.V * aspecto) / 2 - 0.8;
      if (me.x < this.x - meiaL) this.x = me.x + meiaL; else if (me.x > this.x + meiaL) this.x = me.x - meiaL;
    }
    return { x: this.x, yPes: this.y, V: this.V, pes: this.pes };
  }
}

/**
 * Põe o enquadramento na câmera: FOV 35°, olho 1,7 m acima dos pés, olhando reto para −z, e os pés na fração `pes`
 * da tela por deslocamento de lente (elemento [9] da matriz de projeção). Chamar a cada quadro (o
 * updateProjectionMatrix do redimensionamento apaga o deslocamento).
 */
export function aplicarCamera(camera: THREE.PerspectiveCamera, q: Quadro) {
  if (camera.fov !== CAM.fov) camera.fov = CAM.fov;
  const olhoY = q.yPes + CAM.olho;
  camera.position.set(q.x, olhoY, distanciaPara(q.V));
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  // ndc_y = 2·(y − olhoY)/V − e9; queremos ndc_y(pés) = −1 + 2·pes
  camera.projectionMatrix.elements[9] = (2 * (q.yPes - olhoY)) / q.V + 1 - 2 * q.pes;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
