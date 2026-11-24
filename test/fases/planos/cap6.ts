import { andar, esperar, ir, saltar, subirComMaos, type Etapa } from '../bot';
import { carona } from './comum';

const aberta = (id: string) => (c: { e: { portas: Record<string, number> } }) => (c.e.portas[id] ?? 0) > 0.95;

export const PLANO_CAP6: Etapa[] = [
  andar(20.5, 1),
  // 1º trecho: Natan sobe para o corredor de cima, Bruna fica no de baixo
  { nome: 'corredores espelhados 1', limite: 60, p: [
    [ir(21.4), saltar(23, { de: 21.5 }), saltar(25.6, { de: 23.7 }), saltar(28.2, { de: 26.3 }), saltar(31, { de: 28.9 }), ir(38.7),
      esperar((c) => c.outro.x > 45 && c.outro.noChao), ir(55), esperar(aberta('porta-cima-1')), ir(63.3), ir(65)],
    [ir(33.2), esperar((c) => c.outro.y > 4.9 && c.outro.x > 31), saltar(38.5, { de: 33.7 }), ir(43), esperar(aberta('porta-baixo-1')), ir(50.7),
      esperar((c) => c.outro.x > 57 && c.outro.noChao), ir(64.6)],
  ] },
  // 2º trecho, espelhado: agora Bruna vai em cima e Natan embaixo
  { nome: 'corredores espelhados 2', limite: 60, p: [
    [ir(71.5), ir(75.7), esperar((c) => c.outro.x > 81 && c.outro.noChao), ir(89), esperar(aberta('porta-baixo-2')), ir(100.5)],
    [ir(65.4), saltar(67, { de: 65.6 }), saltar(68.9, { de: 67.5 }), saltar(71.5, { de: 69.4 }), ir(79), esperar(aberta('porta-cima-2')),
      ir(85.7), esperar((c) => c.outro.x > 91 && c.outro.noChao), ir(97.9), ir(99.5)],
  ] },
  andar(118.5, 1),
  carona(0, 119.6, 120.2, 129.4, 134),
  andar(147),
  subirComMaos(149.4, 151.5, 150.3, 0, 149.5),
  { nome: 'descer do muro', p: [[ir(157)], [ir(156)]] },
  andar(170),
  { nome: 'pedaço da estrela', p: [[ir(176.6)], [ir(175.6)]] },
];
