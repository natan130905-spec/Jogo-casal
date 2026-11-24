import { andar, balancar, darImpulso, descerDaBeira, esperar, ir, puxar, saltar, saltarJuntos, segurarFio, subirComMaos, superpulo, type Etapa } from '../bot';

/** Abismo do fio: Natan segura na ponta do galho (`ponta`), Bruna balança e solta até o outro lado (`la`, chão
 *  `yLa`); depois Bruna segura na beira de lá e Natan pula: o fio o pega e ele sobe pela corda. */
export const abismoDoFio = (ponta: number, la: number, yLa: number): Etapa[] => [
  { nome: `fio: Bruna balança sobre o abismo em ${ponta}`, limite: 30, p: [
    [ir(ponta - 0.4), segurarFio((c) => c.outro.noChao && c.outro.x > la - 0.3 && Math.abs(c.outro.y - yLa) < 0.1)],
    [ir(ponta - 1.4), esperar((c) => c.outro.segurando && Math.abs(c.outro.x - (ponta - 0.4)) < 0.3), descerDaBeira(1), balancar(1, la + 0.1, yLa), ir(la + 0.4)],
  ] },
  { nome: `fio: Natan pula e sobe pela corda até ${la}`, limite: 30, p: [
    [esperar((c) => c.outro.maoSegurada && c.outro.noChao && Math.abs(c.outro.x - (la + 0.4)) < 0.3), saltar(la + 0.4, { de: ponta - 0.1 }), ir(la + 1.5)],
    [segurarFio((c) => c.outro.noChao && c.outro.x > la - 0.3 && Math.abs(c.outro.y - yLa) < 0.1)],
  ] },
];

export const PLANO_CAP2: Etapa[] = [
  andar(17),
  saltarJuntos(17.8, 22),
  andar(40),
  ...abismoDoFio(44, 50.2, -3),
  andar(56.5),
  { nome: 'subir as raízes', p: [[ir(63.5)], [ir(62.6)]] },
  andar(82.5),
  { nome: 'folhas que caem', p: [
    [ir(83.4), saltar(86.8, { de: 83.7 }), saltar(90, { de: 87.2 }), saltar(93.5, { de: 90.4 }), ir(94)],
    [ir(82.2), esperar((c) => c.outro.x > 92.5 && c.e.especiais[0].s === 0 && c.e.especiais[1].s === 0),
      ir(83.4), saltar(86.8, { de: 83.7 }), saltar(90, { de: 87.2 }), saltar(93.5, { de: 90.4 }), ir(93)],
  ] },
  // segredo: galho alto da clareira
  { nome: 'galho alto', p: [
    [ir(99.2), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - 98.6) < 0.4), superpulo(101.5, { atraso: 12 }), ir(100.4), ...puxar(), ir(103.5)],
    [ir(98.6), darImpulso(), esperar((c) => c.outro.y > 3), ir(99.6), superpulo(101.5, { atraso: 12, esperarX: 99.6 }), ir(102.5)],
  ] },
  { nome: 'descer do galho', p: [[ir(106)], [ir(105)]] },
  andar(117),
  ...abismoDoFio(120, 125.6, -3),
  andar(128.6, 0.6),
  subirComMaos(129.4, 131.5, 130.3, 0, 129.5),
  andar(155),
  saltarJuntos(155.7, 160),
  andar(176.6, 1.2),
  { nome: 'casa na árvore', p: [
    [ir(177.2), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - 176.5) < 0.4), superpulo(179.5, { atraso: 14 }), ir(177.9), ...puxar(), ir(182.6)],
    [ir(176.5), darImpulso(), esperar((c) => c.outro.y > 5), ir(177.3), superpulo(179.5, { atraso: 14, esperarX: 177.3 }), ir(181.7)],
  ] },
];
