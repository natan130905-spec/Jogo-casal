import { andar, atravessarArgola, esperar, ir, saltarDe, saltarJuntos, subirEm, topoEsp, type Etapa } from '../bot';
import { abismoDoFio } from './cap2';

const aberta = (id: string) => (c: { e: { portas: Record<string, number> } }) => (c.e.portas[id] ?? 0) > 0.95;

export const PLANO_CAP4: Etapa[] = [
  andar(19),
  saltarJuntos(19.8, 24.5),
  andar(39.6, 0.5),
  { nome: 'bolha até o píer', p: [
    [subirEm(0, (c) => topoEsp(c, 0) < -0.4 && topoEsp(c, 0) > -0.8), saltarDe(0, (c) => topoEsp(c, 0) > 4.4, 47.5), ir(49)],
    [esperar((c) => c.outro.noChao && c.outro.y > 3.9), subirEm(0, (c) => topoEsp(c, 0) < -0.4 && topoEsp(c, 0) > -0.8), saltarDe(0, (c) => topoEsp(c, 0) > 4.4, 47.5), ir(48)],
  ] },
  andar(57.6, 1),
  { nome: 'argola sobre a água', limite: 60, p: [
    [atravessarArgola(0, 64.3, 3), ir(66.5)],
    [esperar((c) => c.outro.noChao && c.outro.x > 64), ir(57.6), atravessarArgola(0, 64.3, 3), ir(65.5)],
  ] },
  andar(88),
  ...abismoDoFio(90, 95.6, 0),
  andar(103.5, 0.6),
  { nome: 'bolha até o cais', p: [
    [subirEm(1, (c) => topoEsp(c, 1) < -0.3 && topoEsp(c, 1) > -0.8), saltarDe(1, (c) => topoEsp(c, 1) > 4.1, 108.5), ir(110)],
    [esperar((c) => c.outro.noChao && c.outro.y > 3.9), subirEm(1, (c) => topoEsp(c, 1) < -0.3 && topoEsp(c, 1) > -0.8), saltarDe(1, (c) => topoEsp(c, 1) > 4.1, 108.5), ir(109)],
  ] },
  andar(130.4, 1.2),
  // comporta: Natan sobe pela bolha até o mastro e segura a placa; Bruna passa e segura a de lá
  { nome: 'comporta do cais', p: [
    [subirEm(2, (c) => topoEsp(c, 2) > 3.7 && topoEsp(c, 2) < 4.3), saltarDe(2, (c) => topoEsp(c, 2) > 7.9, 135.2), ir(136.3),
      esperar((c) => c.outro.noChao && c.outro.x > 143.3), ir(139), ir(146)],
    [ir(133.8), esperar(aberta('comporta')), ir(143.8), esperar((c) => c.outro.x > 145)],
  ] },
  andar(160.2, 1),
  { nome: 'argola até a ilha', limite: 60, p: [
    [atravessarArgola(1, 169.5, 2, { de: 161.6 }), ir(172)],
    [esperar((c) => c.outro.noChao && c.outro.x > 169.5), ir(160.2), atravessarArgola(1, 169.5, 2, { de: 161.6 }), ir(171)],
  ] },
  andar(195),
  { nome: 'pedaço da estrela', p: [[ir(202.6)], [ir(201.7)]] },
];
