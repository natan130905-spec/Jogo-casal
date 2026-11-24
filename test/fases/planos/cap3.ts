import { darImpulso, esperar, ir, saltar, saltarDaGiratoria, subirNaGiratoria, superpulo } from '../../../src/core/companheiro/manobras';
import { andar, saltarJuntos, type Etapa } from '../bot';
import { carona } from './comum';

const aberta = (id: string) => (c: { e: { portas: Record<string, number> } }) => (c.e.portas[id] ?? 0) > 0.95;

export const PLANO_CAP3: Etapa[] = [
  andar(15),
  saltarJuntos(15.8, 20.5),
  andar(37.6, 0.5),
  { nome: 'relógio 1', p: [
    [subirNaGiratoria(0, 232, 248), saltarDaGiratoria(0, 30, 62, 50.5), ir(53)],
    [esperar((c) => c.outro.noChao && c.outro.y > 3.9), subirNaGiratoria(1, 232, 248), saltarDaGiratoria(1, 30, 62, 50.5), ir(52)],
  ] },
  andar(65.5),
  // porta dupla da rua: Natan na placa B, Bruna na A (colada à porta) passa; Bruna sobe as tábuas e segura a placa
  // da sacada; Natan sobe pelo ponteiro e passa pela porta da sacada
  { nome: 'rua do relojoeiro', limite: 60, p: [
    [ir(75.7), esperar((c) => c.outro.x > 83.2), ir(70.6), subirNaGiratoria(2, 282, 300), saltarDaGiratoria(2, 40, 85, 75.5), ir(78.9),
      esperar((c) => (c.e.portas['porta-sacada'] ?? 0) > 0.95), ir(82.5), esperar((c) => c.outro.x > 85), ir(97.5)],
    [ir(80.9), esperar(aberta('porta-rua')), ir(92.4), saltar(90.6, { de: 92.2 }), saltar(87.6, { de: 89.9 }), saltar(85.1, { de: 86.8 }), saltar(82.5, { de: 84.6 }), ir(80.9),
      esperar((c) => c.outro.x > 82 && c.outro.y > 5), ir(96.5)],
  ] },
  carona(3, 99.6, 100.2, 105.8, 109.5),
  andar(110.3, 0.5),
  { nome: 'relógio de dois ponteiros', p: [
    [subirNaGiratoria(4, 186, 205), saltarDaGiratoria(4, 345, 15, 119.2), ir(120.6)],
    [esperar((c) => c.outro.noChao && c.outro.x > 118), subirNaGiratoria(5, 186, 205), saltarDaGiratoria(5, 345, 15, 119.2), ir(119.6)],
  ] },
  { nome: 'plataformas que caem', p: [
    [saltar(123.3, { de: 120.7 }), saltar(126.1, { de: 123.7 }), saltar(129.5, { de: 126.5 }), ir(131)],
    [esperar((c) => c.outro.x > 128.5 && c.e.especiais[6].s === 0 && c.e.especiais[7].s === 0), ir(120.2),
      saltar(123.3, { de: 120.7 }), saltar(126.1, { de: 123.7 }), saltar(129.5, { de: 126.5 }), ir(130)],
  ] },
  andar(157),
  // portão do tempo: Natan dá o impulso, Bruna sobe no telhado, desce do lado de lá e os dois seguram as placas
  { nome: 'portão do tempo', p: [
    [ir(158.9), darImpulso(), ir(159.6), esperar(aberta('portao-tempo')), ir(164.3), esperar((c) => c.t > 2)],
    [ir(159.6), superpulo(161, { atraso: 16 }), ir(162.6), esperar((c) => c.outro.x > 163.5)],
  ] },
  andar(194.6, 0.4),
  { nome: 'relógio grande', p: [
    [ir(195.4), subirNaGiratoria(8, 280, 300), saltarDaGiratoria(8, 35, 75, 202), ir(206.4)],
    [ir(195.4), esperar((c) => c.outro.noChao && c.outro.y > 5.9), subirNaGiratoria(9, 280, 300), saltarDaGiratoria(9, 35, 75, 202), ir(205.6)],
  ] },
];
