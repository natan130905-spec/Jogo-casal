// Temas visuais por capítulo: paleta do céu, da luz e da névoa, cores do chão e das plataformas e o "kit" de
// adereços de cada mundo. A floresta (capítulo 2) é a referência e usa exatamente as cores de antes.
import type { Fase } from '../core/types';

export type ChaveTema = 'brinquedos' | 'floresta' | 'relogio' | 'oceano' | 'doces' | 'espelhos' | 'cosmos';

/** Capítulo (1–7) → tema. Sem capítulo, a floresta. */
export const TEMA_DO_CAPITULO: readonly ChaveTema[] = ['brinquedos', 'floresta', 'relogio', 'oceano', 'doces', 'espelhos', 'cosmos'];

/** Cores do chão (mesmas chaves de `CORES` em cenario.ts que mudam por tema). */
export interface CoresChao {
  grama: number; gramaClara: number; gramaEscura: number; gramaSol: number; terra: number;
  rocha1: number; rocha2: number; rocha3: number; musgo: number;
}

export interface Tema {
  chave: ChaveTema;
  ceu: { topo: number; lilas: number; rosa: number; horiz: number; baixo: number; sol: number; nuvens: number; estrelas: number };
  nevoa: { cor: number; perto: number; longe: number };
  luz: { ceu: number; chao: number; forca: number; sol: number; forcaSol: number; contra: number; forcaContra: number };
  /** três camadas de silhueta ao fundo, da mais longe para a mais perto: [baixo, cima] */
  silhuetas: [number, number][];
  /** cor dos vaga-lumes (ou bolhas, poeira de estrela…) */
  vagalumes: [number, number];
  /** lago lá embaixo: [perto, longe]; null = sem lago e sem cascatas (vazio de estrelas) */
  agua: [number, number] | null;
  chao: CoresChao;
  /** plataformas especiais: topo, lado e detalhe */
  plataforma: { topo: number; lado: number; detalhe: number };
  /** densidade da grama (1 = floresta) e se há flores */
  tufos: number; flores: boolean;
  /** cor das lanternas de checkpoint acesas e do brilho mágico do mundo */
  brilho: number;
  /**
   * Hierarquia de valor (docs/revisao/ARTE_DIAGNOSTICO.md §6.2 e §6.5): cor da sombra própria do cenário (tinge a
   * rampa de toon), névoa em gradiente só atrás da faixa de jogo (perto/baixo = tom médio-escuro, longe = cor de
   * atmosfera, L* 40–60) e quanto ela pesa no máximo.
   */
  estilo: { sombra: number; nevoaPerto: number; nevoaLonge: number; nevoaForca?: number };
  /** cascatas nos vãos e ao fundo: só onde há água de verdade no mundo (floresta e oceano) */
  cascatas: boolean;
}

const FLORESTA: Tema = {
  chave: 'floresta',
  ceu: { topo: 0x2a1c63, lilas: 0x7a55c4, rosa: 0xf09ab8, horiz: 0xffd394, baixo: 0x8a6ac0, sol: 0xffd9a0, nuvens: 0.55, estrelas: 0.8 },
  nevoa: { cor: 0xa88bd2, perto: 20, longe: 95 },
  luz: { ceu: 0xffe4c4, chao: 0x4a3486, forca: 1.3, sol: 0xffcf8f, forcaSol: 2.6, contra: 0xff9fd8, forcaContra: 0.9 },
  silhuetas: [[0xa284bc, 0xbe9cc4], [0x72609e, 0x8e76b0], [0x4a3e78, 0x62508e]],
  vagalumes: [0xffdb59, 0xbfff8c],
  agua: [0x1a296b, 0x8c6bc7],
  chao: {
    grama: 0x58a03e, gramaClara: 0x9fcf4a, gramaEscura: 0x2a5f36, gramaSol: 0xd9d45a, terra: 0x4d3126,
    rocha1: 0xb495a8, rocha2: 0x84688a, rocha3: 0xc09a78, musgo: 0x5f9e3a,
  },
  plataforma: { topo: 0x6fb04a, lado: 0x8a6a8e, detalhe: 0x9a6538 },
  tufos: 1, flores: true,
  brilho: 0xffb347,
  estilo: { sombra: 0x7078c8, nevoaPerto: 0x2a3149, nevoaLonge: 0x7a6aa8, nevoaForca: 0.8 },
  cascatas: true,
};

export const TEMAS: Record<ChaveTema, Tema> = {
  floresta: FLORESTA,
  // 1. Pequenos em um mundo gigante: quarto de criança ao entardecer (tapete, madeira, blocos de brinquedo)
  brinquedos: {
    chave: 'brinquedos',
    ceu: { topo: 0x2e2a6a, lilas: 0x6a4a8e, rosa: 0xc8707a, horiz: 0xf0b070, baixo: 0x6a3a5a, sol: 0xffd8a0, nuvens: 0.35, estrelas: 0.5 },
    nevoa: { cor: 0xa05a68, perto: 22, longe: 100 },
    luz: { ceu: 0xfff0d8, chao: 0x7a4a7a, forca: 1.2, sol: 0xffd8a0, forcaSol: 1.9, contra: 0xffb0c8, forcaContra: 0.7 },
    silhuetas: [[0xb06a78, 0xc88a86], [0x84485e, 0x9e5e70], [0x5a2e44, 0x723e54]],
    vagalumes: [0xfff0a0, 0xffb8e0],
    agua: [0x2a3a80, 0x9a7ac8],
    chao: {
      grama: 0xc2525e, gramaClara: 0xdc7d6b, gramaEscura: 0x7a2a40, gramaSol: 0xf0a868, terra: 0x7a4a2c,
      rocha1: 0xd8aa74, rocha2: 0xa87448, rocha3: 0xeec48c, musgo: 0xb88a5c,
    },
    plataforma: { topo: 0x58a8e0, lado: 0xf0c860, detalhe: 0xe0503c },
    tufos: 0.15, flores: false,
    brilho: 0xffd070,
    estilo: { sombra: 0xa85a7a, nevoaPerto: 0x521b2b, nevoaLonge: 0x995657, nevoaForca: 0.8 },
    cascatas: false,
  },
  // 3. A cidade do tempo: latão, engrenagens e torres de relógio sob um céu âmbar
  relogio: {
    chave: 'relogio',
    ceu: { topo: 0x3a2448, lilas: 0x8a5a6a, rosa: 0xe0906a, horiz: 0xffcc80, baixo: 0x7a5a5a, sol: 0xffd090, nuvens: 0.6, estrelas: 0.4 },
    nevoa: { cor: 0x8b5a4a, perto: 18, longe: 90 },
    luz: { ceu: 0xffe0b0, chao: 0x5a3a30, forca: 0.95, sol: 0xffc070, forcaSol: 1.8, contra: 0xffa070, forcaContra: 0.8 },
    silhuetas: [[0xb08262, 0xc89a72], [0x80564a, 0x9a6a54], [0x4a2e2c, 0x603c34]],
    vagalumes: [0xffc860, 0xffe8b0],
    agua: [0x2a2030, 0x8a6058],
    chao: {
      grama: 0x7a9a42, gramaClara: 0xb4c45a, gramaEscura: 0x3e5a2a, gramaSol: 0xe8c860, terra: 0x4a3020,
      rocha1: 0xc8a478, rocha2: 0x8a6a4c, rocha3: 0xe2c08a, musgo: 0x6a8a3a,
    },
    plataforma: { topo: 0xd8a848, lado: 0x8a5a30, detalhe: 0xf0d070 },
    tufos: 0.5, flores: true,
    brilho: 0xffc060,
    estilo: { sombra: 0xa86a70, nevoaPerto: 0x432826, nevoaLonge: 0x8b5a4a, nevoaForca: 0.8 },
    cascatas: false,
  },
  // 4. O oceano das lembranças: ruínas submersas, corais e luz azul-turquesa
  oceano: {
    chave: 'oceano',
    ceu: { topo: 0x0a2a5a, lilas: 0x1a5a9a, rosa: 0x2a90c0, horiz: 0x5ac8d8, baixo: 0x1a4a7a, sol: 0xc0fff0, nuvens: 0.25, estrelas: 0.2 },
    nevoa: { cor: 0x1a6a9e, perto: 14, longe: 80 },
    luz: { ceu: 0xc0f0ff, chao: 0x1a3a7a, forca: 1.15, sol: 0xa0f0ff, forcaSol: 1.9, contra: 0x80a0ff, forcaContra: 0.9 },
    silhuetas: [[0x2a8ab4, 0x3ea6c4], [0x14649a, 0x2282b0], [0x0a4274, 0x125a8c]],
    vagalumes: [0xa0f8ff, 0xd0fff0],
    agua: [0x0a2050, 0x2a80b0],
    chao: {
      grama: 0x18a8a8, gramaClara: 0x5ad8c8, gramaEscura: 0x0a5a78, gramaSol: 0xf0e6a0, terra: 0x1a3a6a,
      rocha1: 0x4a8ac0, rocha2: 0x2a5a98, rocha3: 0xc8b090, musgo: 0xe07a9a,
    },
    plataforma: { topo: 0xf0d8a0, lado: 0x5a8ab0, detalhe: 0xf07a8a },
    tufos: 0.8, flores: false,
    brilho: 0x80f0ff,
    estilo: { sombra: 0x4a78c8, nevoaPerto: 0x043861, nevoaLonge: 0x1a6a9e, nevoaForca: 0.8 },
    cascatas: true,
  },
  // 5. O reino dos doces: cobertura rosa, biscoito, chocolate e pirulitos
  doces: {
    chave: 'doces',
    ceu: { topo: 0x5a3a9a, lilas: 0xa070c0, rosa: 0xe890b0, horiz: 0xf8d0a8, baixo: 0x9a5a8a, sol: 0xfff0d0, nuvens: 0.7, estrelas: 0.3 },
    nevoa: { cor: 0xb06a80, perto: 22, longe: 100 },
    luz: { ceu: 0xfff0f0, chao: 0x8a4a80, forca: 1.85, sol: 0xffe0c0, forcaSol: 2.3, contra: 0xff9fe0, forcaContra: 0.8 },
    silhuetas: [[0xc07a98, 0xd496aa], [0x9a5a78, 0xb2708e], [0x5a2a30, 0x6d3945]],
    vagalumes: [0xfff0b0, 0xffb0e8],
    agua: [0x8a3a6a, 0xe0a0d0],
    chao: {
      grama: 0xea7e9a, gramaClara: 0xf6acb4, gramaEscura: 0x8a3048, gramaSol: 0xffd0a8, terra: 0x4f1810,
      rocha1: 0xb06a3c, rocha2: 0x6d3420, rocha3: 0xd09a64, musgo: 0xfff0e0,
    },
    plataforma: { topo: 0xfff0f4, lado: 0xd89050, detalhe: 0xf05a8a },
    tufos: 0.3, flores: true,
    brilho: 0xff90c8,
    estilo: { sombra: 0xa05068, nevoaPerto: 0x4f1810, nevoaLonge: 0xb06a80, nevoaForca: 0.75 },
    cascatas: false,
  },
  // 6. O labirinto dos espelhos: cristais violeta e reflexos frios
  espelhos: {
    chave: 'espelhos',
    ceu: { topo: 0x0b082a, lilas: 0x211559, rosa: 0x511a8b, horiz: 0x7a44b0, baixo: 0x0d1850, sol: 0x9080d0, nuvens: 0.3, estrelas: 1.0 },
    nevoa: { cor: 0x3a2a8c, perto: 16, longe: 85 },
    luz: { ceu: 0xe0d8ff, chao: 0x3a2a80, forca: 1.0, sol: 0xd8c8ff, forcaSol: 1.5, contra: 0x80c8ff, forcaContra: 1.1 },
    silhuetas: [[0x4a3a9a, 0x5e4cb0], [0x2a2070, 0x3a2c88], [0x140f40, 0x211559]],
    vagalumes: [0xc8e8ff, 0xe8c0ff],
    agua: [0x140a40, 0x5a40b0],
    chao: {
      grama: 0x7b62b9, gramaClara: 0x92acd6, gramaEscura: 0x26368c, gramaSol: 0xc8f0ff, terra: 0x2a2050,
      rocha1: 0x7a6ab8, rocha2: 0x3e3278, rocha3: 0xa898e0, musgo: 0x88e0ff,
    },
    plataforma: { topo: 0x92acd6, lado: 0x3a2c88, detalhe: 0x9ae8ff },
    tufos: 0.2, flores: false,
    brilho: 0xb0e0ff,
    estilo: { sombra: 0x5a50c0, nevoaPerto: 0x0d1850, nevoaLonge: 0x3a2a8c, nevoaForca: 0.8 },
    cascatas: false,
  },
  // 7. O coração do universo: ilhas flutuando no céu estrelado
  cosmos: {
    chave: 'cosmos',
    ceu: { topo: 0x05051a, lilas: 0x1a1450, rosa: 0x4a2a8a, horiz: 0x9a6ac8, baixo: 0x0a0a30, sol: 0xffe0a0, nuvens: 0.15, estrelas: 1.6 },
    nevoa: { cor: 0x2a2060, perto: 18, longe: 95 },
    luz: { ceu: 0xd0c8ff, chao: 0x2a1a60, forca: 1.2, sol: 0xffe0b0, forcaSol: 2.0, contra: 0xa080ff, forcaContra: 1.2 },
    silhuetas: [[0x4a3a8a, 0x6a5aa8], [0x2e2468, 0x4a3a88], [0x1a1448, 0x2e2668]],
    vagalumes: [0xfff0c0, 0xb0c8ff],
    agua: null,
    chao: {
      grama: 0x4a8ac0, gramaClara: 0x9ad0ff, gramaEscura: 0x283e80, gramaSol: 0xffe8a0, terra: 0x2a2040,
      rocha1: 0x6a5a98, rocha2: 0x3e3470, rocha3: 0x8a78b8, musgo: 0x5ab0d0,
    },
    plataforma: { topo: 0x9ad0ff, lado: 0x4a3a88, detalhe: 0xffe08a },
    tufos: 0.5, flores: false,
    brilho: 0xffe08a,
    estilo: { sombra: 0x5a58c8, nevoaPerto: 0x100e46, nevoaLonge: 0x2b1963, nevoaForca: 0.8 },
    cascatas: false,
  },
};

/** Tema da fase: `?tema=` na URL (para conferência) tem prioridade; depois `fase.tema`, depois o capítulo; sem nada, a floresta. */
export function temaDaFase(fase: Fase): Tema {
  const pedido = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tema') : null;
  if (pedido && pedido in TEMAS) return TEMAS[pedido as ChaveTema];
  const proprio = (fase as Fase & { tema?: string }).tema;
  if (proprio && proprio in TEMAS) return TEMAS[proprio as ChaveTema];
  const c = fase.capitulo;
  return TEMAS[(c && TEMA_DO_CAPITULO[c - 1]) || 'floresta'];
}
