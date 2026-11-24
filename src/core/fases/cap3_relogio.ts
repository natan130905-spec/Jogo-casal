// Capítulo 3 — A cidade do tempo (o dia em que um esperou o outro por horas e não desistiu).
// Novidade: ponteiros de relógio que giram (plataformas giratórias, sentido horário) e portas duplas, que só abrem
// com os dois em placas ao mesmo tempo.
//
//   0–38    telhados, primeira bolotinha e espinhudo                      lanterna em 30
//   38–64   relógio 1 sobre o vão: sobe no ponteiro e pula para o prédio na hora certa   lanterna em 56
//   64–100  rua do relojoeiro: porta dupla na rua (placas A e B) e, na sacada, uma porta comum cuja placa fica
//           do lado de lá. Quem passou pela rua sobe a escada e abre a sacada para o outro, que veio pelo
//           ponteiro do relógio 2                                         lanterna em 97,5
//   100–128 engrenagens: plataforma móvel, relógio de dois ponteiros, plataformas que caem   lanterna em 131
//   128–186 portão do tempo (porta dupla com uma placa de cada lado, colada): um sobe no telhado com mãos dadas e
//           desce do lado de lá (do lado de lá há degraus até o telhado, para voltar)                                           lanterna em 168
//   186–214 o relógio grande leva à torre do pedaço da estrela
import { arco, bloco, chao, fileira, tabua, type FaseCapitulo } from './comum';

export const CAP3_RELOGIO: FaseCapitulo = {
  id: 'cap3-relogio',
  nome: 'A cidade do tempo',
  capitulo: 3,
  tema: 'relogio',
  lembranca: 'O dia em que um esperou o outro por horas e não desistiu.',
  frase: 'Você chegou atrasado três horas. Eu teria esperado a vida inteira.',
  novidade: 'Ponteiros que giram e portas duplas',
  largura: 214,
  inicio: [{ x: 1.5, y: 0 }, { x: 3, y: 0 }],
  fundo: -10,
  plataformas: [
    chao(-2, 16),                    // 0  telhado
    bloco(7, 0, 1.4, 1),             // 1  chaminé baixa
    chao(19, 38),                    // 2
    chao(48.5, 64, 4, 5),            // 3  prédio depois do relógio 1
    chao(64, 100),                   // 4  rua do relojoeiro
    tabua(74, 84, 5.5),              // 5  sacada (a porta da sacada fica em 79,5)
    bloco(81.6, 3.2, 1.3, 1.8),      // 6  batente da porta da rua até a sacada
    bloco(79.1, 8.7, 1.3, 5),        // 7  batente da porta da sacada
    tabua(84.2, 86, 4.5, 0.3),       // 8  tábuas do lado de lá até a sacada (passa-se por baixo)
    tabua(86.5, 88.5, 3.1, 0.3),     // 9
    tabua(89.5, 91.5, 1.6, 0.3),     // 10
    tabua(108.2, 110.6, 0.6),        // 11 engrenagens
    tabua(118, 121, 1.4),            // 12
    chao(128, 186),                  // 13
    bloco(160, 3.2, 2, 1),           // 14 telhado em cima do portão do tempo
    tabua(163.2, 164.6, 2.8, 0.3),   // 14b degraus do lado de lá até o telhado (quem passou pode voltar)
    bloco(165, 0, 1.4, 1.4),         // 14c
    chao(186, 214),                  // 15 praça do relógio grande
    bloco(200, 0, 12, 6),            // 16 torre
    bloco(212, 0, 2, 14),            // 17 fim
  ],
  placas: [
    { id: 'placa-rua-a', x: 80.2, y: 0, w: 1.4, h: 0.15, abre: 'porta-rua' },
    { id: 'placa-rua-b', x: 75, y: 0, w: 1.4, h: 0.15, abre: 'porta-rua' },
    { id: 'placa-sacada', x: 80.2, y: 5.5, w: 1.4, h: 0.15, abre: 'porta-sacada' },
    { id: 'placa-tempo-a', x: 158.8, y: 0, w: 1.4, h: 0.15, abre: 'portao-tempo' },
    { id: 'placa-tempo-b', x: 161.8, y: 0, w: 1.4, h: 0.15, abre: 'portao-tempo' },
  ],
  portas: [
    { id: 'porta-rua', x: 82, y: 0, w: 0.5, h: 3.2, modo: 'todas' },
    { id: 'porta-sacada', x: 79.5, y: 5.5, w: 0.5, h: 3.2 },
    { id: 'portao-tempo', x: 160.75, y: 0, w: 0.5, h: 3.2, modo: 'todas' },
  ],
  portal: { x: 205, y: 6, w: 2.2, h: 2.2 },
  inimigos: [
    { tipo: 'bolotinha', x: 12, y: 0 },
    { tipo: 'espinhudo', x: 28, y: 0 },
    { tipo: 'morcego', x: 58, y: 6.6, alcance: 2 },
    { tipo: 'bolotinha', x: 67, y: 0, dir: 1 },
    { tipo: 'espinhudo', x: 87, y: 0, dir: 1 },
    { tipo: 'cogumelo', x: 140, y: 0 },
    { tipo: 'bolotinha', x: 150, y: 0, dir: 1 },
    { tipo: 'bolotinha', x: 176, y: 0 },
    { tipo: 'espinhudo', x: 192, y: 0 },
  ],
  estrelinhas: [
    ...arco(6.4, 9, 1.6, 1.2, 3),          // por cima da chaminé
    ...arco(15.6, 19.4, 0.8, 1.4, 3),      // primeiro vão
    ...arco(39.5, 46.5, 2.5, 3.5, 5),      // a volta do ponteiro
    ...fileira(51, 54, 4.6, 3),            // no prédio
    ...fileira(75.2, 78.6, 6.1, 3),        // sacada (lado de cá)
    ...fileira(84.8, 90.8, 2.2, 3),        // por baixo das tábuas
    ...fileira(101, 106, 0.8, 3),          // na plataforma móvel
    ...arco(111.5, 116.5, 2.4, 1.6, 3),    // relógio de dois ponteiros
    ...fileira(123, 126.6, 2, 2),          // plataformas que caem
    ...fileira(160.4, 161.6, 4.8, 2),      // no telhado do portão
    // relógio grande: o arco ia até 7,2 m, 2,5 m acima da tela com a dupla no chão; agora até 4,3 m (à vista do chão)
    // e as duas do meio ainda pedem subir no ponteiro
    ...arco(193.5, 198.5, 3.4, 1, 4),
  ],
  lanternas: [{ x: 30, y: 0 }, { x: 56, y: 4 }, { x: 97.5, y: 0 }, { x: 131, y: 0 }, { x: 168, y: 0 }],
  especiais: [
    // 0, 1: relógio 1 sobre o vão (centro 43, 2), 8 s por volta, sentido horário
    { tipo: 'giratoria', w: 2, h: 0.3, cx: 43, cy: 2, raio: 3, periodo: 8, inicio: 270 },
    { tipo: 'giratoria', w: 2, h: 0.3, cx: 43, cy: 2, raio: 3, periodo: 8, inicio: 90 },
    // 2: relógio 2 da rua: leva até a sacada
    { tipo: 'giratoria', w: 1.8, h: 0.3, cx: 71, cy: 3, raio: 2.4, periodo: 8, inicio: 270 },
    // 3: plataforma móvel das engrenagens
    { tipo: 'movel', w: 2.2, h: 0.4, trajeto: [{ x: 100.2, y: -0.4 }, { x: 105.8, y: -0.4 }], vel: 1.5 },
    // 4, 5: relógio de dois ponteiros
    { tipo: 'giratoria', w: 1.8, h: 0.3, cx: 114, cy: 1.6, raio: 2.2, periodo: 9, inicio: 180 },
    { tipo: 'giratoria', w: 1.8, h: 0.3, cx: 114, cy: 1.6, raio: 2.2, periodo: 9, inicio: 0 },
    // 6, 7: plataformas que caem
    { tipo: 'cai', x: 122.6, y: 1, w: 1.4, h: 0.3 },
    { tipo: 'cai', x: 125.4, y: 0.7, w: 1.4, h: 0.3 },
    // 8, 9: relógio grande da praça
    { tipo: 'giratoria', w: 1.8, h: 0.3, cx: 196, cy: 3.4, raio: 2.8, periodo: 10, inicio: 270 },
    { tipo: 'giratoria', w: 1.8, h: 0.3, cx: 196, cy: 3.4, raio: 2.8, periodo: 10, inicio: 90 },
  ],
  // pontos de cooperação: anotações do mapa de apoio (npm run apoio; conferidas pelo T14 em test/apoio.test.ts)
  apoio: { pontos: [
    { id: 'cap3:porta-rua', tipo: 'placaDupla', x: 79.2,
      dica: 'Porta dupla: cada um numa placa ao mesmo tempo.',
      dicaInverso: 'Fica na outra placa comigo.' },
    { id: 'cap3:sacada', tipo: 'placa', x: 76.7,
      dica: 'Eu piso na placa da sacada e a porta abre para você.',
      dicaInverso: 'Pisa na placa da sacada que eu passo.' },
    { id: 'cap3:telhado', tipo: 'impulso', x: 158.6,
      dica: 'De mãos dadas comigo você sobe no telhado.',
      dicaInverso: 'Me dá a mão que eu subo no telhado.' },
    { id: 'cap3:portao-tempo', tipo: 'placaDupla', x: 157.9,
      dica: 'O portão do tempo pede as duas placas juntas.',
      dicaInverso: 'Fica na placa do lado de cá que eu seguro a de lá.' },
  ] },
};
