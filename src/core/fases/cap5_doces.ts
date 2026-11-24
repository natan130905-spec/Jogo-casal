// Capítulo 5 — O reino dos doces (o primeiro bolo que fizeram juntos, e queimaram).
// Novidade: gelatinas que quicam (segurando o pulo, quica mais alto), biscoitos que quebram, chuva de confeitos
// (muitos bichinhos-pesadelo, inclusive morcegos voando baixo).
//
//   0–40    chão de biscoito, cupcakes e os primeiros bichinhos          lanterna em 28
//   40–48   poço da gelatina: quica para subir no balcão                lanterna em 52
//   48–104  portão de pirulito: um quica até a torre de bolo e segura a placa; o outro passa e segura a de lá
//                                                                      lanterna em 94
//   104–140 biscoitos que quebram e a chuva de confeitos                lanterna em 130
//   140–175 muro de chocolate (mãos dadas); gelatina do segredo até a nuvem de algodão-doce   lanterna em 162
//   175–210 gelatinas sobre o poço até o bolo com o pedaço da estrela
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP5_DOCES: FaseCapitulo = {
  id: 'cap5-doces',
  nome: 'O reino dos doces',
  capitulo: 5,
  tema: 'doces',
  lembranca: 'O primeiro bolo que fizeram juntos (e queimaram).',
  frase: 'Queimou tudo, e mesmo assim foi o bolo mais gostoso da minha vida.',
  novidade: 'Gelatinas que quicam e chuva de confeitos',
  largura: 210,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -8,
  plataformas: [
    chao(-2, 22),                    // 0  biscoito
    bloco(8, 0, 1.4, 1),             // 1  cupcake
    chao(25, 40),                    // 2
    bloco(32, 0, 1.4, 1.2),          // 3  cupcake do cogumelo
    chao(48, 104, 2.5, 3.5),         // 4  balcão
    tabua(80, 84, 7.5),              // 5  torre de bolo (flutuante: passa-se por baixo)
    bloco(89.6, 5.7, 1.3, 6),        // 6  batente do portão de pirulito
    chao(114.5, 175, 2.5, 3.5),      // 7
    bloco(124, 2.5, 1.4, 1),         // 8  cupcake do cogumelo
    bloco(150, 2.5, 4, 3.4),         // 9  muro de chocolate
    bloco(154, 2.5, 1.2, 1.7),       // 10 degrau do lado de lá (para voltar)
    tabua(161, 165, 9),              // 11 nuvem de algodão-doce (segredo)
    tabua(181, 184, 4.5),            // 12 bala no meio do poço
    chao(190, 210, 6, 7),            // 13 o bolo
    bloco(208, 6, 2, 10),            // 14 fim
  ],
  placas: [
    { id: 'placa-torre', x: 81, y: 7.5, w: 1.4, h: 0.15, abre: 'portao-pirulito' },
    { id: 'placa-pirulito', x: 91.1, y: 2.5, w: 1.4, h: 0.15, abre: 'portao-pirulito' },
  ],
  portas: [{ id: 'portao-pirulito', x: 90, y: 2.5, w: 0.5, h: 3.2 }],
  portal: { x: 198, y: 6, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 12, y: 0 },
    { tipo: 'bolotinha', x: 18, y: 0, dir: 1 },
    { tipo: 'cogumelo', x: 32.7, y: 1.2 },
    { tipo: 'bolotinha', x: 60, y: 2.5, dir: 1 },
    { tipo: 'morcego', x: 64, y: 5.4, alcance: 3 },
    { tipo: 'espinhudo', x: 70, y: 2.5 },
    { tipo: 'bolotinha', x: 98, y: 2.5, dir: 1 },
    { tipo: 'morcego', x: 118, y: 4.6, alcance: 2 },
    { tipo: 'bolotinha', x: 120, y: 2.5 },
    { tipo: 'cogumelo', x: 124.7, y: 3.5 },
    { tipo: 'morcego', x: 128, y: 5, alcance: 2.5 },
    { tipo: 'bolotinha', x: 132, y: 2.5, dir: 1 },
    { tipo: 'morcego', x: 138, y: 4.6, alcance: 2 },
    { tipo: 'espinhudo', x: 143, y: 2.5 },
    { tipo: 'bolotinha', x: 168, y: 2.5 },
    { tipo: 'bolotinha', x: 200, y: 6, dir: 1 },
  ],
  estrelinhas: [
    ...arco(7.4, 10, 1.4, 1.2, 3),         // por cima do cupcake
    ...arco(21.6, 25.4, 0.8, 1.4, 3),      // primeiro vão
    // o quique da gelatina: posições tiradas da trajetória REAL do quique segurado (busca sobre a simulação,
    // test/fases/busca.ts), não de uma fórmula. A última (era 47,6; 1,2, só saía com quique fraco encostado no
    // balcão) foi para a quina do balcão, onde o quique segurado passa.
    { x: 44.4, y: 1.2 }, { x: 45.47, y: 3.87 }, { x: 46.53, y: 3.87 }, { x: 47.5, y: 3.5 },
    ...fileira(54, 58, 3.1, 3),
    ...fileira(78, 78, 5.5, 1), ...fileira(78.6, 78.6, 7, 1), // subindo pela gelatina da torre (7,0: era 7,5, acima da tela)
    ...fileira(80.8, 83.2, 8.1, 2),        // torre de bolo
    ...fileira(93, 96, 3.1, 2),
    ...arco(105, 114, 3.1, 1.2, 5),        // biscoitos que quebram
    ...fileira(150.5, 153.5, 6.5, 3),      // em cima do muro de chocolate
    ...fileira(161.5, 164.5, 9.6, 4),      // segredo: nuvem de algodão-doce
    // gelatinas do poço: na trajetória REAL do quique segurado até a bala e até o bolo (o arco por fórmula passava
    // 1–3 m longe do corpo; ver docs/revisao/AUDITORIA_MOVIMENTO.md §2.3)
    { x: 177.5, y: 3 }, { x: 178.5, y: 4.6 }, { x: 179.5, y: 5.6 }, { x: 180.5, y: 5.6 }, // primeira gelatina
    { x: 184.5, y: 5.2 }, { x: 186.6, y: 6 }, { x: 188.4, y: 7.1 }, { x: 189.6, y: 7.2 }, // segunda gelatina
  ],
  lanternas: [{ x: 28, y: 0 }, { x: 52, y: 2.5 }, { x: 94, y: 2.5 }, { x: 130, y: 2.5 }, { x: 162, y: 2.5 }],
  especiais: [
    // 0: gelatina do poço
    { tipo: 'quicante', x: 43.4, y: -1.6, w: 2, h: 0.4 },
    // 1: gelatina da torre de bolo (segurando o pulo chega à torre)
    { tipo: 'quicante', x: 77, y: 2.5, w: 2, h: 0.4 },
    // 2–4: biscoitos que quebram
    { tipo: 'cai', x: 105.5, y: 2.2, w: 1.6, h: 0.3, espera: 0.5, volta: 3 },
    { tipo: 'cai', x: 108.6, y: 2.2, w: 1.6, h: 0.3, espera: 0.5, volta: 3 },
    { tipo: 'cai', x: 111.7, y: 2.2, w: 1.6, h: 0.3, espera: 0.5, volta: 3 },
    // 5: gelatina do segredo (até a nuvem)
    { tipo: 'quicante', x: 158.6, y: 2.5, w: 1.8, h: 0.4, forca: 19 },
    // 6, 7: gelatinas sobre o poço do fim
    { tipo: 'quicante', x: 176.5, y: 0, w: 2, h: 0.4 },
    { tipo: 'quicante', x: 185.5, y: 1.5, w: 2, h: 0.4 },
  ],
};
