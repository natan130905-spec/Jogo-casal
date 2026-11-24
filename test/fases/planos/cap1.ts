import { darImpulso, esperar, ir, puxar, superpulo } from '../../../src/core/companheiro/manobras';
import { andar, saltarJuntos, subirComMaos, type Etapa } from '../bot';
import { carona } from './comum';

const aberta = (id: string) => (c: { e: { portas: Record<string, number> } }) => (c.e.portas[id] ?? 0) > 0.95;

export const PLANO_CAP1: Etapa[] = [
  andar(24),
  saltarJuntos(25.8, 29.5),
  // tampa: Natan segura a placa de cá, Bruna passa e segura a de lá
  { nome: 'tampa da caixa', p: [
    [ir(35.7), esperar((c) => c.outro.x > 43.9 && c.outro.noChao), ir(46.5)],
    [ir(36.9), esperar(aberta('tampa')), ir(44.3), esperar((c) => c.outro.x > 45.5)],
  ] },
  andar(49.5),
  subirComMaos(51.2, 53.5, 52.4, 0, 51.6),
  andar(62.8),
  carona(0, 63.6, 64.2, 69.3, 74),
  andar(103),
  saltarJuntos(103.8, 107),
  saltarJuntos(108.3, 111.5),
  // segredo: Bruna dá o impulso, Natan sobe na prateleira e puxa Bruna
  { nome: 'prateleira secreta', p: [
    [ir(112.6), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - 112.2) < 0.4), superpulo(115), ir(113.5),
      esperar((c) => c.t > 20), ...puxar(), ir(116.3)],
    [ir(112.2), darImpulso(), esperar((c) => c.outro.y > 5), ir(112.7), superpulo(115, { esperarX: 112.7 }), ir(115.2)],
  ] },
  { nome: 'descer da prateleira', p: [[ir(117.2)], [ir(116.2)]] },
  saltarJuntos(117.3, 120.5),
  saltarJuntos(121.8, 125.5),
  andar(139.5),
  // prateleira da placa: Bruna dá o impulso, Natan sobe e segura a placa; Bruna passa e segura a de lá
  { nome: 'portão da prateleira', p: [
    [ir(140.3), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - 140.3) < 1.2), superpulo(143.2, { atraso: 16 }), ir(143.2),
      esperar((c) => c.outro.x > 151.3 && c.outro.noChao), ir(146), ir(153.5)],
    [ir(139.6), darImpulso(), esperar(aberta('portao')), ir(151.9), esperar((c) => c.outro.x > 152.5), ir(155)],
  ] },
  andar(165),
  { nome: 'pedaço da estrela', p: [[ir(173.6)], [ir(172.7)]] },
];

