import type { Fase } from './types';

// Fase de teste do capítulo 2 ("A floresta dos sonhos"): ensina andar, pular, a placa que abre a porteira
// para o parceiro e o impulso de mãos dadas para alcançar a casa na árvore. Medidas em metros; y para cima.
export const FLORESTA_1: Fase = {
  id: 'floresta-1',
  nome: 'A floresta dos sonhos',
  largura: 60,
  inicio: [{ x: 1.5, y: 1 }, { x: 3, y: 1 }],
  fundo: -6,
  plataformas: [
    { x: -2, y: -1, w: 16, h: 1 },          // chão inicial
    { x: 15.5, y: -1, w: 6, h: 1 },          // depois do primeiro vão
    { x: 23, y: 0, w: 3, h: 0.5 },           // degrau
    { x: 27, y: 1, w: 3, h: 0.5 },           // degrau
    { x: 31, y: -1, w: 12, h: 1 },           // clareira da placa e da porteira
    { x: 44, y: -1, w: 16, h: 1 },           // chão final
    { x: 50, y: 2.6, w: 6, h: 0.6 },         // casa na árvore (só com impulso)
  ],
  // Duas placas, uma de cada lado da porteira: quem passou segura a do outro lado para o parceiro passar.
  placas: [
    { id: 'placa-1', x: 33, y: 0, w: 1.4, h: 0.15, abre: 'porteira-1' },
    { id: 'placa-2', x: 41.6, y: 0, w: 1.4, h: 0.15, abre: 'porteira-1' },
  ],
  portas: [{ id: 'porteira-1', x: 40, y: 0, w: 0.5, h: 3.2 }],
  portal: { x: 52.5, y: 3.2, w: 1.6, h: 2 },
};

export const FASES: Record<string, Fase> = { [FLORESTA_1.id]: FLORESTA_1 };
