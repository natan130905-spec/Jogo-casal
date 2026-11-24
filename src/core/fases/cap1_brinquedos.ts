// Capítulo 1 — Pequenos em um mundo gigante (a loja de brinquedos onde se conheceram).
// Ensina: andar, pular, atirar, a placa que abre a tampa da caixa, mãos dadas (impulso e puxar de cima) e o
// trenzinho (plataforma móvel). Brinquedos gigantes viram plataforma.
//
//   0–26    blocos de montar, primeira bolotinha (atirar)          lanterna em 31
//   28–64   tampa da caixa (placa dos dois lados), caixa alta (mãos dadas)   lanterna em 60
//   64–72   trenzinho sobre o vão
//   72–104  pirâmide de blocos e bolotinha                          lanterna em 96
//   104–124 blocos de montar sobre o vão; segredo na prateleira alta (mãos dadas)
//   124–152 prateleira com placa: um sobe e abre o portão do outro  lanterna em 127
//   152–184 pódio com o pedaço da estrela                           lanterna em 156
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP1_BRINQUEDOS: FaseCapitulo = {
  id: 'cap1-brinquedos',
  nome: 'Pequenos em um mundo gigante',
  capitulo: 1,
  tema: 'brinquedos',
  lembranca: 'A tarde em que se conheceram, numa loja de brinquedos.',
  frase: 'Você riu do mesmo urso de pelúcia que eu. Foi ali que tudo começou.',
  novidade: 'Andar, pular, atirar, placas e mãos dadas',
  largura: 184,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -8,
  plataformas: [
    chao(-2, 26),                    // 0  chão da loja
    bloco(8, 0, 1.2, 1),             // 1  cubo
    bloco(13, 0, 1.6, 1.6),          // 2  cubo maior
    chao(28, 64),                    // 3  corredor da caixa de brinquedos
    bloco(39.6, 3.2, 1.3, 5),        // 4  batente em cima da tampa (não dá para pular por cima)
    bloco(52, 0, 6, 2.8),            // 5  caixa alta (mãos dadas)
    bloco(58, 0, 1.2, 1.4),          // 5b degrau do lado de lá (quem passou volta para ajudar)
    chao(72, 104),                   // 6  depois do trenzinho
    bloco(78, 0, 2, 1),              // 7  pirâmide de blocos
    bloco(80, 0, 2, 2),              // 8
    bloco(82, 0, 2, 3),              // 9
    bloco(84, 0, 2, 2),              // 10
    bloco(86, 0, 2, 1),              // 11
    tabua(106, 108.5, 1),            // 12 blocos de montar sobre o vão
    tabua(110.5, 113, 2),            // 13
    tabua(115, 117.5, 1.5),          // 14
    tabua(119.5, 122, 0.8),          // 15
    tabua(113.5, 116.5, 5.2),        // 16 prateleira secreta (mãos dadas)
    chao(124, 152),                  // 17
    tabua(141, 145, 3.2),            // 18 prateleira da placa
    bloco(149.6, 3.2, 1.3, 5),       // 19 batente do portão final
    chao(152, 184),                  // 20 pódio
    bloco(166, 0, 3, 0.8),           // 21 degrau
    bloco(169, 0, 8, 1.6),           // 22 pódio
    bloco(182, 0, 2, 8),             // 23 parede do fim
  ],
  placas: [
    { id: 'placa-tampa-a', x: 35, y: 0, w: 1.4, h: 0.15, abre: 'tampa' },
    { id: 'placa-tampa-b', x: 43.6, y: 0, w: 1.4, h: 0.15, abre: 'tampa' },
    { id: 'placa-prateleira', x: 142.5, y: 3.2, w: 1.4, h: 0.15, abre: 'portao' },
    { id: 'placa-portao', x: 151.2, y: 0, w: 1.4, h: 0.15, abre: 'portao' },
  ],
  portas: [
    { id: 'tampa', x: 40, y: 0, w: 0.5, h: 3.2 },
    { id: 'portao', x: 150, y: 0, w: 0.5, h: 3.2 },
  ],
  portal: { x: 172, y: 1.6, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 20, y: 0 },
    { tipo: 'bolotinha', x: 47, y: 0, dir: 1 },
    { tipo: 'bolotinha', x: 93, y: 0 },
    { tipo: 'bolotinha', x: 136, y: 0 },
    { tipo: 'bolotinha', x: 160, y: 0, dir: 1 },
  ],
  estrelinhas: [
    ...arco(7.2, 10, 1.4, 1.2, 3),       // por cima do cubo
    ...fileira(13.3, 14.3, 2.3, 2),      // em cima do cubo maior
    ...arco(25.6, 28.4, 0.6, 1.4, 3),    // o primeiro vão
    ...fileira(45.5, 47.5, 0.6, 3),      // depois da tampa
    ...fileira(53, 57, 3.4, 3),          // em cima da caixa alta
    ...fileira(65, 69, 1.4, 3),          // no caminho do trenzinho
    ...fileira(78.5, 86.5, 4, 5),        // por cima da pirâmide
    ...fileira(114, 116, 5.8, 3),        // segredo: prateleira alta
    ...arco(117.7, 119.3, 1.8, 1, 2),    // entre os blocos
    ...fileira(141.7, 144.3, 3.8, 2),    // prateleira da placa
    ...arco(164.5, 168.5, 1.2, 1.6, 4),  // subindo para o pódio
  ],
  lanternas: [{ x: 31, y: 0 }, { x: 60, y: 0 }, { x: 96, y: 0 }, { x: 127, y: 0 }, { x: 156, y: 0 }],
  especiais: [
    // trenzinho de brinquedo: vai e volta sobre o vão de 64 a 72
    { tipo: 'movel', w: 2.4, h: 0.4, trajeto: [{ x: 64.1, y: -0.4 }, { x: 69.4, y: -0.4 }], vel: 1.6 },
  ],
};
