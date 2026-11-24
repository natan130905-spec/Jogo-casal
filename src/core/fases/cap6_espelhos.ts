// Capítulo 6 — O labirinto dos espelhos (a primeira briga, e o primeiro pedido de desculpas).
// Novidade: caminhos separados e espelhados. O corredor de cima (piso em y = 5) e o de baixo (y = 0) correm lado a
// lado; cada porta tem a placa no corredor do OUTRO. Um vai na frente, segura a placa e abre o caminho do outro, e
// depois o outro faz o mesmo. Nas salas de espelho (x 22–30, 64–70 e 98–104) há tábuas para trocar de corredor,
// e é ali que ficam as lanternas: quem volta à lanterna pode escolher o corredor de novo.
//
//   0–30    sala de entrada; tábuas até o corredor de cima                lanterna em 26
//   30–64   1º trecho: porta de baixo (placa em cima, 38) e porta de cima (placa embaixo, 50)
//   64–70   sala de espelho 2                                             lanterna em 66
//   70–98   2º trecho, espelhado: porta de cima (placa embaixo, 75) e porta de baixo (placa em cima, 85)
//   98–190  salão final: plataforma móvel, muro (mãos dadas) e o palco do pedaço da estrela
//                                                                         lanternas em 100, 136 e 160
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP6_ESPELHOS: FaseCapitulo = {
  id: 'cap6-espelhos',
  nome: 'O labirinto dos espelhos',
  capitulo: 6,
  tema: 'espelhos',
  lembranca: 'A primeira briga, e o primeiro pedido de desculpas.',
  frase: 'A gente brigou de lados opostos do espelho. E cada um abriu a porta do outro.',
  novidade: 'Caminhos separados: cada um abre o caminho do outro',
  largura: 190,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -8,
  plataformas: [
    chao(-2, 34),                    // 0  chão de baixo (entrada e 1º trecho)
    chao(37, 120),                   // 1  chão de baixo depois do poço
    tabua(22, 24, 1.6, 0.3),         // 2  tábuas da sala de entrada
    tabua(24.6, 26.6, 3.2, 0.3),     // 3
    tabua(27.2, 29.2, 4.6, 0.3),     // 4
    chao(29.8, 64, 5, 0.8),          // 5  piso do corredor de cima, 1º trecho
    bloco(43.6, 3.2, 1.3, 1),        // 6  batente da porta de baixo 1 (até o piso de cima)
    bloco(55.6, 8.2, 1.3, 5),        // 7  batente da porta de cima 1
    bloco(33, 5, 1.2, 1),            // 8  espelhinho no corredor de cima
    tabua(66.2, 67.8, 1.7, 0.3),     // 9  tábuas da sala de espelho 2
    tabua(64.4, 65.8, 3.4, 0.3),     // 10
    tabua(68.2, 69.6, 3.4, 0.3),     // 11
    chao(70, 98, 5, 0.8),            // 12 piso do corredor de cima, 2º trecho
    bloco(79.6, 8.2, 1.3, 5),        // 13 batente da porta de cima 2
    bloco(89.6, 3.2, 1.3, 1),        // 14 batente da porta de baixo 2
    bloco(73, 0, 1.2, 1),            // 15 espelhinho no corredor de baixo
    tabua(100.2, 101.8, 1.7, 0.3),   // 16 tábuas da sala de espelho 3 (para voltar ao corredor de cima)
    tabua(98.4, 99.8, 3.4, 0.3),     // 17
    chao(131.8, 190),                // 18 salão final
    bloco(150, 0, 4, 3.4),           // 19 muro (mãos dadas)
    bloco(154, 0, 1.2, 1.7),         // 20 degrau do lado de lá
    bloco(172, 0, 8, 1.2),           // 21 palco
    bloco(188, 0, 2, 10),            // 22 fim
  ],
  placas: [
    { id: 'placa-baixo-1', x: 38, y: 5, w: 1.4, h: 0.15, abre: 'porta-baixo-1' },
    { id: 'placa-cima-1', x: 50, y: 0, w: 1.4, h: 0.15, abre: 'porta-cima-1' },
    { id: 'placa-cima-2', x: 75, y: 0, w: 1.4, h: 0.15, abre: 'porta-cima-2' },
    { id: 'placa-baixo-2', x: 85, y: 5, w: 1.4, h: 0.15, abre: 'porta-baixo-2' },
  ],
  portas: [
    { id: 'porta-baixo-1', x: 44, y: 0, w: 0.5, h: 3.2 },
    { id: 'porta-cima-1', x: 56, y: 5, w: 0.5, h: 3.2 },
    { id: 'porta-cima-2', x: 80, y: 5, w: 0.5, h: 3.2 },
    { id: 'porta-baixo-2', x: 90, y: 0, w: 0.5, h: 3.2 },
  ],
  portal: { x: 175, y: 1.2, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 14, y: 0 },
    { tipo: 'bolotinha', x: 40, y: 0, dir: 1 },
    { tipo: 'espinhudo', x: 47, y: 5 },
    { tipo: 'espinhudo', x: 84, y: 0, dir: 1 },
    { tipo: 'bolotinha', x: 92, y: 5 },
    { tipo: 'morcego', x: 110, y: 2.6, alcance: 3 },
    { tipo: 'cogumelo', x: 145, y: 0 },
    { tipo: 'bolotinha', x: 165, y: 0, dir: 1 },
  ],
  estrelinhas: [
    ...arco(33.6, 37.4, 0.8, 1.4, 3),      // poço do corredor de baixo
    ...arco(32.4, 34.8, 6.6, 1, 3),        // espelho: por cima do espelhinho de cima
    ...fileira(46, 54, 0.6, 3),            // corredor de baixo, 1º trecho
    ...fileira(46, 54, 5.6, 3),            // corredor de cima, 1º trecho (espelhado)
    ...fileira(66.6, 67.4, 2.3, 2),        // sala de espelho 2
    ...arco(72.4, 74.8, 1.6, 1, 3),        // espelhinho de baixo
    ...fileira(82, 88, 0.6, 3),            // corredor de baixo, 2º trecho
    ...fileira(82, 88, 5.6, 3),            // corredor de cima, 2º trecho
    ...fileira(121, 129, 1, 4),            // na plataforma móvel
    ...fileira(150.5, 153.5, 4, 3),        // em cima do muro
    ...arco(170.5, 174, 1.4, 1.4, 3),      // subindo ao palco
  ],
  lanternas: [{ x: 26, y: 0 }, { x: 66, y: 0 }, { x: 100, y: 0 }, { x: 136, y: 0 }, { x: 160, y: 0 }],
  especiais: [
    // 0: plataforma móvel do salão final
    { tipo: 'movel', w: 2.4, h: 0.4, trajeto: [{ x: 120.2, y: -0.4 }, { x: 129.4, y: -0.4 }], vel: 1.6 },
  ],
  // pontos de cooperação: anotações do mapa de apoio (npm run apoio; conferidas pelo T14 em test/apoio.test.ts)
  apoio: { pontos: [
    { id: 'cap6:porta-baixo-1', tipo: 'placa', x: 41.2,
      dica: 'Eu piso na placa aqui em cima e a sua porta abre.',
      dicaInverso: 'Pisa na placa daí de cima para eu passar.' },
    { id: 'cap6:porta-cima-1', tipo: 'placa', x: 53.2,
      dica: 'Agora eu piso na placa aqui embaixo e a sua porta abre.',
      dicaInverso: 'Pisa na placa daí de baixo para eu passar.' },
    { id: 'cap6:porta-cima-2', tipo: 'placa', x: 77.2,
      dica: 'Eu seguro a placa aqui embaixo para você.',
      dicaInverso: 'Segura a placa daí de baixo para eu passar.' },
    { id: 'cap6:porta-baixo-2', tipo: 'placa', x: 87.2,
      dica: 'Eu seguro a placa aqui em cima para você.',
      dicaInverso: 'Segura a placa daí de cima para eu passar.' },
    { id: 'cap6:muro-impulso', tipo: 'impulso', x: 148.2,
      dica: 'De mãos dadas comigo você sobe o muro.',
      dicaInverso: 'Me dá a mão que eu subo o muro.' },
    { id: 'cap6:muro-puxar', tipo: 'puxar', x: 148.2,
      dica: 'Lá de cima eu te puxo.',
      dicaInverso: 'Sobe e me puxa pela mão.' },
  ] },
};
