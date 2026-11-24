// Capítulo 2 — A floresta dos sonhos (o primeiro passeio, quando se perderam na trilha e riram disso).
// Novidade: o Fio Vermelho. Nos dois abismos, um segura (✋) na ponta do galho e o outro balança pendurado e solta
// para alcançar o outro lado, mais baixo; depois quem chegou segura e o outro pula: o fio o pega e ele sobe pela
// corda (⬆) até a beira. No segundo, a ilha do meio ainda pede mãos dadas para subir.
//
//   0–38    trilha, tronco, primeira bolotinha e morcego-sono            lanterna em 26
//   36–63   Fio Vermelho 1: galho fino até 44, abismo, chão mais baixo
//   63–92   cogumelo-bravo no toco, folhas que caem sobre o vão          lanterna em 64
//   92–116  clareira; segredo no galho alto (mãos dadas)                 lanterna em 95
//   112–134 Fio Vermelho 2: galho até 120, ilha em 125,6–130, parede de 3 m (mãos dadas)
//   130–200 espinhudo, raízes e a casa na árvore com o pedaço da estrela  lanternas em 134 e 162
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP2_FLORESTA: FaseCapitulo = {
  id: 'cap2-floresta',
  nome: 'A floresta dos sonhos',
  capitulo: 2,
  tema: 'floresta',
  lembranca: 'O primeiro passeio, quando se perderam numa trilha e riram disso.',
  frase: 'A gente se perdeu, e foi o melhor caminho que eu já fiz.',
  novidade: 'O Fio Vermelho: um segura o outro sobre o abismo',
  largura: 200,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -12,
  plataformas: [
    chao(-2, 18),                     // 0  trilha
    bloco(9, 0, 1.4, 1.2),            // 1  tronco deitado
    chao(21, 38),                     // 2
    bloco(33, 0, 1.2, 0.8),           // 3  toco
    tabua(38, 44, 0, 0.6),            // 4  galho fino (dá para balançar por baixo)
    chao(50.2, 62, -3, 7),            // 5  outro lado do abismo, 3 m abaixo (6,2 m: com o coyote time 5,6 m passava sozinho)
    bloco(59.5, -3, 2.5, 1.5),        // 6  degrau de raiz
    chao(62, 84, 0, 10),              // 7
    bloco(72, 0, 1.6, 1.2),           // 8  toco do cogumelo
    chao(92, 116),                    // 9  clareira
    tabua(100, 104, 3.2),             // 10 galho alto (segredo)
    tabua(116, 120, 0, 0.6),          // 11 galho fino do segundo abismo
    chao(125.6, 130, -3, 7),          // 12 ilha do meio
    chao(130, 156, 0, 10),            // 13 paredão de 3 m e trilha
    chao(159, 200),                   // 14
    bloco(170, 0, 3, 1.2),            // 15 raízes
    bloco(173, 0, 4.8, 2.4),          // 16
    bloco(177.8, 0, 1.2, 1.2),        // 17 raiz do lado de lá (quem desceu volta)
    tabua(177.6, 186, 5.2, 0.6),      // 18 casa na árvore
    bloco(198, 0, 2, 10),             // 19 fim
  ],
  placas: [],
  portas: [],
  portal: { x: 181, y: 5.2, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 14, y: 0 },
    { tipo: 'morcego', x: 30, y: 2.8, alcance: 2.5 },
    { tipo: 'bolotinha', x: 67, y: 0, dir: 1 },
    { tipo: 'cogumelo', x: 72.8, y: 1.2 },
    { tipo: 'morcego', x: 109, y: 2.8, alcance: 2.5 },
    { tipo: 'espinhudo', x: 142, y: 0 },
    { tipo: 'bolotinha', x: 151, y: 0, dir: 1 },
    { tipo: 'bolotinha', x: 165, y: 0 },
  ],
  estrelinhas: [
    ...arco(8.4, 11.2, 1.8, 1.2, 3),       // por cima do tronco
    ...arco(17.6, 21.4, 0.8, 1.4, 3),      // primeiro vão
    ...fileira(39, 43, 0.6, 3),            // no galho fino
    ...fileira(51, 55, -2.4, 3),           // do outro lado do abismo
    ...fileira(66, 70, 0.6, 2),
    ...arco(84.4, 91.6, 0.8, 1, 4),        // nas folhas que caem
    ...fileira(100.6, 103.4, 3.8, 3),      // segredo: galho alto
    ...fileira(126.3, 129.3, -2.4, 3),     // ilha do meio
    ...fileira(136, 140, 0.6, 3),
    ...arco(155.6, 159.4, 0.8, 1.4, 3),    // vão antes das raízes
    ...fileira(173.6, 176.8, 3, 3),        // em cima das raízes
  ],
  // ponto de dupla: daqui, de mãos dadas, o superpulo alcança o galho alto (estrelinhas 18–20)
  marcas: [{ tipo: 'maos-dadas', x: 97.5, y: 0 }],
  lanternas: [{ x: 26, y: 0 }, { x: 64, y: 0 }, { x: 95, y: 0 }, { x: 134, y: 0 }, { x: 162, y: 0 }],
  fio: [
    { x0: 36, x1: 63, comprimento: 5 },
    { x0: 112, x1: 134, comprimento: 5 },
  ],
  especiais: [
    // folhas que caem quando pisadas, sobre o vão de 84 a 92
    { tipo: 'cai', x: 86, y: -0.3, w: 1.6, h: 0.3, espera: 0.7, volta: 3 },
    { tipo: 'cai', x: 89.2, y: -0.3, w: 1.6, h: 0.3, espera: 0.7, volta: 3 },
  ],
};
