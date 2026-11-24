// Capítulo 4 — O oceano das lembranças (a primeira viagem à praia).
// Novidade: bolhas que sobem (elevadores que estouram lá em cima), argolas de pêndulo sobre a água (o parceiro na
// beira empurra o balanço) e o Fio Vermelho como cabo de pêndulo entre o píer e a jangada.
//
//   0–40    areia, castelinho, caranguejo-bolotinha e gaivota-morcego       lanterna em 28
//   40–58   bolha-elevador até o píer alto                                   lanterna em 47
//   58–84   argola sobre a água até a plataforma do outro lado               lanterna em 70
//   82–103  Fio Vermelho: ponta do píer fino (90), jangada 3 m abaixo (96,2)
//   104–162 bolha até o cais; no mastro, a placa que abre a comporta para o outro   lanternas em 110 e 148
//   162–220 argola (ou o barquinho, que vai e volta) até a ilha; castelo de areia com o pedaço da estrela
//                                                                            lanterna em 174
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP4_OCEANO: FaseCapitulo = {
  id: 'cap4-oceano',
  nome: 'O oceano das lembranças',
  capitulo: 4,
  tema: 'oceano',
  lembranca: 'A primeira viagem à praia.',
  frase: 'Você disse que o mar era grande demais. Eu disse que dava, se fosse junto.',
  novidade: 'Bolhas, argolas de pêndulo e o fio como cabo sobre a água',
  largura: 220,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -8,
  plataformas: [
    chao(-2, 20),                    // 0  areia
    bloco(7, 0, 1.6, 1.2),           // 1  castelinho
    chao(23, 40),                    // 2  areia depois da poça
    chao(46, 58, 4, 5),              // 3  píer alto
    chao(64, 84, 3, 4),              // 4  plataforma do outro lado da argola
    tabua(84, 90, 3, 0.6),           // 5  píer fino (dá para balançar por baixo)
    chao(96.2, 104, 0, 7),           // 6  jangada (3 m abaixo da ponta; vão de 6,2 m: com o coyote 5,6 passava sozinho)
    chao(107.5, 131, 4, 5),          // 7  cais
    chao(133.6, 162, 4, 5),          // 8  cais depois do buraco da bolha
    tabua(134, 138, 7.6),            // 9  mastro
    bloco(141.6, 7.2, 1.3, 5),       // 10 batente da comporta
    chao(169, 220, 2, 6),            // 11 ilha
    bloco(196, 2, 3, 1),             // 12 castelo de areia
    bloco(199, 2, 6, 2),             // 13
    bloco(205, 2, 1.5, 1),           // 13b degrau do outro lado do castelo
    bloco(218, 2, 2, 12),            // 14 fim
  ],
  placas: [
    { id: 'placa-mastro', x: 135.6, y: 7.6, w: 1.4, h: 0.15, abre: 'comporta' },
    { id: 'placa-cais', x: 143.1, y: 4, w: 1.4, h: 0.15, abre: 'comporta' },
  ],
  portas: [{ id: 'comporta', x: 142, y: 4, w: 0.5, h: 3.2 }],
  portal: { x: 201, y: 4, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 13, y: 0 },
    { tipo: 'morcego', x: 33, y: 3, alcance: 2.5 },
    { tipo: 'bolotinha', x: 76, y: 3, dir: 1 },
    { tipo: 'cogumelo', x: 121, y: 4 },
    { tipo: 'bolotinha', x: 116, y: 4, dir: 1 },
    { tipo: 'bolotinha', x: 152, y: 4 },
    { tipo: 'espinhudo', x: 157, y: 4, dir: 1 },
    { tipo: 'bolotinha', x: 186, y: 2 },
    { tipo: 'morcego', x: 191, y: 5, alcance: 3 },
  ],
  estrelinhas: [
    ...arco(6.4, 9.2, 1.6, 1.2, 3),        // por cima do castelinho
    ...arco(19.6, 23.4, 0.8, 1.4, 3),      // a poça
    ...fileira(43.2, 43.2, 2.5, 1), ...fileira(43.2, 43.2, 4.5, 1), // no caminho da bolha
    ...fileira(49, 55, 4.6, 3),            // píer alto
    ...arco(58.6, 63.4, 4.6, 2, 3),        // o balanço da argola
    ...fileira(85, 89, 3.6, 3),            // píer fino
    ...fileira(97, 102, 0.6, 3),           // jangada
    ...fileira(105.2, 105.2, 2.5, 1),      // bolha do cais
    ...fileira(134.6, 137.4, 8.2, 2),      // mastro
    ...fileira(144.5, 147.5, 4.6, 3),      // depois da comporta
    ...arco(164, 168.5, 5, 1.5, 3),        // a última argola
    ...arco(192.5, 196.5, 3.2, 1.4, 3),    // castelo de areia
  ],
  lanternas: [{ x: 28, y: 0 }, { x: 47, y: 4 }, { x: 70, y: 3 }, { x: 110, y: 4 }, { x: 148, y: 4 }, { x: 174, y: 2 }],
  argolas: [{ x: 59.6, y: 7.4 }, { x: 164.4, y: 7.2 }],
  fio: [{ x0: 82, x1: 103, comprimento: 5 }],
  especiais: [
    // 0: bolha-elevador da areia até o píer alto
    { tipo: 'bolha', x: 42.4, y: -1.2, w: 1.6, h: 0.4, sobe: 5.6, vel: 1.2, pausa: 1 },
    // 1: bolha da jangada até o cais
    { tipo: 'bolha', x: 104.4, y: -1.2, w: 1.6, h: 0.4, sobe: 5.2, vel: 1.2, pausa: 1 },
    // 2: bolha do buraco do cais até o mastro
    { tipo: 'bolha', x: 131.5, y: 0, w: 1.6, h: 0.4, sobe: 7.8, vel: 1.5, pausa: 1 },
    // 3: barquinho entre o cais e a ilha (o caminho lento, e a volta para quem foi na frente)
    { tipo: 'movel', w: 2.4, h: 0.4, trajeto: [{ x: 162.1, y: 3.6 }, { x: 166.5, y: 1.6 }], vel: 1 },
  ],
};
