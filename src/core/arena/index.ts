// Arena do Coração (capítulo 7, fase 3D final): ponto de entrada do núcleo. Ver docs/ARENA_FINAL.md.
export * from './numeros';
export type * from './tipos';
export { ENTRADA_NEUTRA, normalizarEntradaArena, direcaoNoChao, entradaParaDirecao } from './entrada';
export { estadoInicialArena, passoArena, trocarSolo, alvoDaTrava } from './sim';
export { raioOnda, ladoParede } from './rei';
export { vidaInicioFase, vidaFimFase, reiVulneravel, emJogo } from './comum';
export { instantaneoArena, restaurarArena, interpolarArena, type InstantaneoArena } from './instantaneo';
