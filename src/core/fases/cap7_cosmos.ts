// Capítulo 7 — O coração do universo (a noite da estrela).
// Novidade: ilhas flutuantes, o Fio Vermelho o tempo todo (de 4 a 176 os dois estão sempre amarrados, 5,5 m) e o
// Rei-Pesadelo, o chefe final: ele anda pela arena, cospe esporos em leque e, de tempos em tempos, para e mostra
// o ponto fraco brilhante. Só então as faíscas contam (20 faíscas, em três fases de ataque). O pedaço da estrela
// aparece no meio da arena e só vale depois que ele vira vaga-lume.
//
//   0–30    ilha de partida, já amarrados                                 lanterna em 24
//   30–64   ilhas que flutuam: a ilha móvel leva os dois juntos           lanterna em 54
//   64–92   ponte de luz até 72; o abismo do fio (o outro lado é 3 m mais baixo)   lanterna em 86
//   92–124  ilha alta: um sobe com mãos dadas e segura o fio; o outro cai no vão e sobe pela corda   lanterna em 116
//   124–180 ilha móvel, cometas e a descida até a arena                    lanternas em 150 e 182
//   180–216 arena do Rei-Pesadelo
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP7_COSMOS: FaseCapitulo = {
  id: 'cap7-cosmos',
  nome: 'O coração do universo',
  capitulo: 7,
  tema: 'cosmos',
  lembranca: 'A noite da estrela.',
  frase: 'Algumas coisas a gente não precisa lembrar sozinho.',
  novidade: 'Ilhas flutuantes, o fio o tempo todo e o Rei-Pesadelo',
  largura: 216,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -12,
  plataformas: [
    chao(-2, 14, 0, 2),              // 0  ilha de partida
    bloco(8, 0, 1.2, 1),             // 1  pedra da lua
    chao(16.5, 31, 0.5, 2),          // 2
    chao(40, 46, 0.9, 2),            // 3  ilha do meio (entre as ilhas móveis)
    chao(50, 64, 3.4, 2),            // 4  ilha alta
    tabua(64, 72, 3.4, 0.6),         // 5  ponte de luz (dá para balançar por baixo)
    chao(77.6, 92, 0.4, 7),          // 6  outro lado do abismo, 3 m abaixo
    chao(92, 108, 0.4, 7),           // 7
    chao(110, 124, 4.4, 8),          // 8  ilha alta (mãos dadas + corda)
    chao(136, 160, 4.4, 6),          // 9
    chao(160, 164, 3, 4),            // 10 degraus da descida (e da volta)
    chao(164, 168, 1.5, 3),          // 10b
    chao(168, 216),                  // 11 arena
    bloco(214, 0, 2, 14),            // 12 fim da arena
  ],
  placas: [],
  portas: [],
  portal: { x: 197.8, y: 0, w: 2.4, h: 2.4 },
  inimigos: [
    { tipo: 'bolotinha', x: 11.5, y: 0 },
    { tipo: 'morcego', x: 22, y: 3, alcance: 3 },
    { tipo: 'bolotinha', x: 58, y: 3.4, dir: 1 },
    { tipo: 'morcego', x: 85, y: 3.2, alcance: 2.5 },
    { tipo: 'espinhudo', x: 100, y: 0.4 },
    { tipo: 'bolotinha', x: 120, y: 4.4 },
    { tipo: 'bolotinha', x: 148, y: 4.4, dir: 1 },
    { tipo: 'morcego', x: 154, y: 7.4, alcance: 2.5 },
    { tipo: 'cogumelo', x: 162, y: 3 },
    { tipo: 'rei', x: 199, y: 0, alcance: 5 },
  ],
  estrelinhas: [
    ...arco(7.4, 10, 1.4, 1.2, 3),         // por cima da pedra da lua
    ...arco(13.8, 16.8, 0.8, 1.4, 3),      // primeiro vão
    ...fileira(33, 38, 1.2, 3),            // na ilha móvel
    ...fileira(41, 45, 1.6, 3),            // ilha do meio
    ...fileira(65, 71, 4, 4),              // ponte de luz
    ...fileira(79, 83, 1, 3),              // depois do abismo
    ...fileira(111, 115, 5, 3),            // ilha alta
    ...fileira(126, 134, 5.2, 4),          // ilha móvel
    // a descida: a última (era 170; 3,6, 2,1 m acima do degrau, só saía num pulo correndo exato) baixou para 2,9
    ...arco(160.5, 170, 3.6, 1.2, 5).slice(0, 4), { x: 169.5, y: 2.9 },
    ...fileira(183, 186, 0.6, 3),          // arena
  ],
  lanternas: [{ x: 24, y: 0.5 }, { x: 54, y: 3.4 }, { x: 86, y: 0.4 }, { x: 116, y: 4.4 }, { x: 150, y: 4.4 }, { x: 182, y: 0 }],
  fio: [{ x0: 4, x1: 176, comprimento: 5.5 }],
  especiais: [
    // 0: ilha móvel entre a ilha de partida e a do meio
    { tipo: 'movel', w: 3.2, h: 0.5, trajeto: [{ x: 31.2, y: 0 }, { x: 36.8, y: 0.5 }], vel: 1.3 },
    // 1: elevador de luz até a ilha alta
    { tipo: 'movel', w: 3.2, h: 0.5, trajeto: [{ x: 46.4, y: 0.4 }, { x: 46.4, y: 2.9 }], vel: 1 },
    // 2: ilha móvel depois da ilha alta
    { tipo: 'movel', w: 3.4, h: 0.5, trajeto: [{ x: 124.2, y: 3.9 }, { x: 132.6, y: 3.9 }], vel: 1.5 },
  ],
};
