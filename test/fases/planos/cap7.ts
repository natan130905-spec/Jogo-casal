import { andar, darImpulso, esperar, fazer, ir, lutarComORei, saltarJuntos, segurarFio, superpulo, type Etapa } from '../bot';
import { abismoDoFio } from './cap2';
import { carona } from './comum';

export const PLANO_CAP7: Etapa[] = [
  andar(13, 1),
  saltarJuntos(13.7, 17.5, { recuo: 1.2, apos: 0.6 }),
  andar(30.4, 0.6),
  carona(0, 30.4, 31.2, 36.8, 41.5),
  andar(45.4, 0.6),
  carona(1, 45.4, (c) => c.e.especiais[1].y < 0.7, (c) => c.e.especiais[1].y > 2.85, 51.5, { pular: true }),
  andar(71, 1),
  ...abismoDoFio(72, 77.6, 0.4),
  andar(107, 0.6),
  // ilha alta: Bruna dá o impulso, Natan sobe e segura o fio; Bruna desce no vão e sobe pela corda
  { nome: 'ilha alta: mãos dadas e corda', limite: 40, p: [
    [ir(107.6), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - 107.1) < 0.4), superpulo(110.3), ir(110.4),
      segurarFio((c) => c.outro.noChao && c.outro.y > 4.3 && c.t > 30), ir(113)],
    [ir(107.1), darImpulso(), esperar((c) => c.outro.noChao && c.outro.y > 4.3 && c.outro.maoSegurada && c.t > 10),
      fazer('descer no vão', () => ({ x: 1 }), (c) => !c.eu.noChao),
      fazer('subir pela corda', (c) => ({ y: 1, jump: true, x: c.eu.pendurado ? 1 : (c.eu.x < 110 ? 1 : 0.4) }), (c) => c.eu.noChao && c.eu.y > 4.3),
      ir(112)],
  ] },
  andar(123.6, 0.6),
  carona(2, 123.6, 124.2, 132.6, 138),
  andar(167, 1),
  andar(186, 1),
  { nome: 'Rei-Pesadelo', limite: 150, p: [
    [lutarComORei(-1, 181, 212)],
    [lutarComORei(1, 181, 212)],
  ] },
  { nome: 'pedaço da estrela', p: [[ir(199.4)], [ir(198.6)]] },
];
