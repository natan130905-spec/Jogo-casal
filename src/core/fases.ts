import type { Fase } from './types';
import { CAPITULOS } from './fases/index';

export { CAPITULOS, faseDoCapitulo, type FaseCapitulo, type TemaVisual } from './fases/index';

/** Fábrica de fase com padrões (placas/portas vazias, fundo -6, portal fora de alcance, largura pelas plataformas). */
export function criarFase(p: Partial<Fase> & Pick<Fase, 'id' | 'plataformas'>): Fase {
  const largura = p.largura ?? Math.max(10, ...p.plataformas.map((r) => r.x + r.w));
  return {
    nome: p.id, largura, inicio: [{ x: 1, y: 0 }, { x: 2, y: 0 }], placas: [], portas: [],
    portal: { x: largura + 100, y: -100, w: 1, h: 1 }, fundo: -6,
    ...p,
  };
}

// Fase de teste do capítulo 2 ("A floresta dos sonhos"): ensina andar, pular, atirar, a placa que abre a porteira
// para o parceiro e o impulso de mãos dadas para alcançar a casa na árvore. Medidas em metros; y para cima.
export const FLORESTA_1: Fase = {
  id: 'floresta-1',
  nome: 'A floresta dos sonhos',
  capitulo: 2,
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
  // pedaço da estrela, em cima da casa na árvore
  portal: { x: 52.5, y: 3.2, w: 1.6, h: 2 },
  inimigos: [
    { tipo: 'bolotinha', x: 19, y: 0, dir: -1 },          // anda de lado a lado na plataforma depois do vão
    { tipo: 'morcego', x: 36.5, y: 3.4, alcance: 2.5 },   // voa alto sobre a clareira (pisão com superpulo)
  ],
  estrelinhas: [
    { x: 6, y: 0.6 }, { x: 8, y: 2.2 }, { x: 14.7, y: 1.6 }, { x: 24.5, y: 1.1 }, { x: 28.5, y: 2.1 },
    { x: 36.5, y: 0.6 }, { x: 47, y: 0.6 }, { x: 51, y: 3.8 },
  ],
  lanternas: [{ x: 31.6, y: 0 }, { x: 44.6, y: 0 }],
};

/**
 * Fase de exemplo com TODAS as mecânicas, comentada, para o designer de fases copiar. Também é usada nos testes.
 * Trechos (da esquerda para a direita):
 *  0–12   chão com bolotinha, espinhudo e estrelinhas; lanterna em 11
 *  12–22  Fio Vermelho sobre um abismo (14–19); argola no teto em 16.5
 *  22–34  plataforma móvel, giratória (relógio), gelatina, plataforma que cai e bolha que sobe
 *  34–46  porta dupla (duas placas ao mesmo tempo); cogumelo-bravo e morcego-sono
 *  46–70  arena do Rei-Pesadelo; o pedaço da estrela só vale depois de derrotá-lo
 */
export const EXEMPLO_MECANICAS: Fase = {
  id: 'exemplo-mecanicas',
  nome: 'Oficina de mecânicas',
  largura: 70,
  inicio: [{ x: 1, y: 0 }, { x: 2.2, y: 0 }],
  fundo: -8,
  plataformas: [
    { x: -2, y: -1, w: 16, h: 1 },     // 0: chão inicial (até 14)
    { x: 19, y: -1, w: 4, h: 1 },      // 1: outro lado do abismo do fio
    { x: 16, y: 5.5, w: 1, h: 0.3 },   // 2: viga do teto (onde fica a argola)
    { x: 33, y: -1, w: 37, h: 1 },     // 3: chão da porta dupla e da arena
    { x: 68.5, y: 0, w: 1.5, h: 6 },   // 4: parede do fim
  ],
  placas: [
    { id: 'placa-a', x: 35, y: 0, w: 1.2, h: 0.15, abre: 'porta-dupla' },
    { id: 'placa-b', x: 37.5, y: 0, w: 1.2, h: 0.15, abre: 'porta-dupla' },
  ],
  portas: [{ id: 'porta-dupla', x: 40, y: 0, w: 0.5, h: 3.2, modo: 'todas' }],
  portal: { x: 66, y: 0, w: 1.6, h: 2 },
  inimigos: [
    { tipo: 'bolotinha', x: 6, y: 0 },
    { tipo: 'espinhudo', x: 9, y: 0, dir: 1 },
    { tipo: 'cogumelo', x: 44, y: 0 },
    { tipo: 'morcego', x: 42, y: 2.4, alcance: 2 },
    { tipo: 'rei', x: 60, y: 0, alcance: 5 },
  ],
  estrelinhas: [{ x: 3, y: 0.6 }, { x: 4, y: 0.6 }, { x: 16.5, y: 2 }, { x: 27, y: 3.5 }, { x: 45, y: 0.6 }],
  lanternas: [{ x: 11, y: 0 }, { x: 34, y: 0 }, { x: 47, y: 0 }],
  fio: [{ x0: 11.5, x1: 22.5, comprimento: 4 }],
  argolas: [{ x: 16.5, y: 5.4 }],
  especiais: [
    // 0: vai e volta entre 23 e 27 na altura 0
    { tipo: 'movel', w: 2, h: 0.4, trajeto: [{ x: 23, y: -0.4 }, { x: 26, y: -0.4 }], vel: 1.5 },
    // 1 e 2: ponteiros de um relógio (centro 29.5, 2), em lados opostos, sentido horário, 8 s por volta
    { tipo: 'giratoria', w: 1.6, h: 0.3, cx: 29.5, cy: 2, raio: 2, periodo: 8, inicio: 0 },
    { tipo: 'giratoria', w: 1.6, h: 0.3, cx: 29.5, cy: 2, raio: 2, periodo: 8, inicio: 180 },
    // 3: gelatina
    { tipo: 'quicante', x: 31.5, y: -0.6, w: 1.5, h: 0.4 },
    // 4: cai quando pisada
    { tipo: 'cai', x: 26, y: 3, w: 1.5, h: 0.3 },
    // 5: bolha que sobe
    { tipo: 'bolha', x: 32, y: 1, w: 1, h: 0.4, sobe: 4, vel: 1, pausa: 1 },
  ],
};

/** Todas as fases por id: a de teste, a oficina de mecânicas e as dos 7 capítulos (src/core/fases/). */
export const FASES: Record<string, Fase> = {
  [FLORESTA_1.id]: FLORESTA_1, [EXEMPLO_MECANICAS.id]: EXEMPLO_MECANICAS,
  ...Object.fromEntries(CAPITULOS.map((f) => [f.id, f])),
};
