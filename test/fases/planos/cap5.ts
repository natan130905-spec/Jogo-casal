import { andar, esperar, ir, quicarPara, saltar, saltarJuntos, subirComMaos, type Etapa } from '../bot';

const aberta = (id: string) => (c: { e: { portas: Record<string, number> } }) => (c.e.portas[id] ?? 0) > 0.95;

export const PLANO_CAP5: Etapa[] = [
  andar(21),
  saltarJuntos(21.8, 26.5),
  andar(39, 1),
  { nome: 'poço da gelatina', p: [
    [quicarPara(44.4, 50, { de: 39.7 }), ir(51)],
    [esperar((c) => c.outro.noChao && c.outro.x > 48), ir(39), quicarPara(44.4, 49.5, { de: 39.7 }), ir(50)],
  ] },
  andar(75),
  // portão de pirulito: Natan quica até a torre e segura a placa; Bruna passa e segura a de lá
  { nome: 'portão de pirulito', p: [
    [ir(75.6), quicarPara(78, 81.8), ir(81.7), esperar((c) => c.outro.noChao && c.outro.x > 91.2), ir(85.5), ir(93)],
    [ir(74.5), esperar((c) => c.outro.noChao && c.outro.y > 7), ir(88.5), esperar(aberta('portao-pirulito')), ir(91.8), esperar((c) => c.outro.x > 92.5)],
  ] },
  andar(103.4, 1),
  { nome: 'biscoitos que quebram', p: [
    [saltar(106.3, { de: 103.7 }), saltar(109.4, { de: 106.8 }), saltar(112.5, { de: 109.9 }), saltar(116, { de: 113 }), ir(117)],
    [esperar((c) => c.outro.x > 115 && [2, 3, 4].every((k) => c.e.especiais[k].s === 0)), ir(103.2),
      saltar(106.3, { de: 103.7 }), saltar(109.4, { de: 106.8 }), saltar(112.5, { de: 109.9 }), saltar(116, { de: 113 }), ir(116)],
  ] },
  andar(147),
  subirComMaos(149.4, 151.5, 150.3, 0, 149.5),
  { nome: 'descer do muro', p: [[ir(157)], [ir(156)]] },
  // segredo: nuvem de algodão-doce
  { nome: 'nuvem de algodão-doce', p: [
    [ir(157.8), quicarPara(159.5, 162.5), ir(164.6), ir(167)],
    [esperar((c) => c.outro.x > 165.5 && c.outro.noChao), ir(157.8), quicarPara(159.5, 162.5), ir(164.6), ir(166)],
  ] },
  andar(174.3, 1),
  { nome: 'gelatinas do poço', p: [
    [quicarPara(177.5, 182.5, { soDescer: true }), ir(183.6), quicarPara(186.5, 191.5, { soDescer: true }), ir(196)],
    [esperar((c) => c.outro.noChao && c.outro.x > 190), ir(174.3), quicarPara(177.5, 182.5, { soDescer: true }), ir(183.6), quicarPara(186.5, 191.5, { soDescer: true }), ir(195)],
  ] },
  { nome: 'pedaço da estrela', p: [[ir(199.6)], [ir(198.6)]] },
];
