// Fases dos sete capítulos (uma por capítulo), na ordem da história.
import type { FaseCapitulo, TemaVisual } from './comum';
import { CAP1_BRINQUEDOS } from './cap1_brinquedos';
import { CAP2_FLORESTA } from './cap2_floresta';
import { CAP3_RELOGIO } from './cap3_relogio';
import { CAP4_OCEANO } from './cap4_oceano';
import { CAP5_DOCES } from './cap5_doces';
import { CAP6_ESPELHOS } from './cap6_espelhos';
import { CAP7_COSMOS } from './cap7_cosmos';

export type { FaseCapitulo, TemaVisual };
export { CAP1_BRINQUEDOS, CAP2_FLORESTA, CAP3_RELOGIO, CAP4_OCEANO, CAP5_DOCES, CAP6_ESPELHOS, CAP7_COSMOS };

export const CAPITULOS: readonly FaseCapitulo[] = [CAP1_BRINQUEDOS, CAP2_FLORESTA, CAP3_RELOGIO, CAP4_OCEANO, CAP5_DOCES, CAP6_ESPELHOS, CAP7_COSMOS];

/** Fase do capítulo n (1–7). */
export const faseDoCapitulo = (n: number): FaseCapitulo | undefined => CAPITULOS.find((f) => f.capitulo === n);
