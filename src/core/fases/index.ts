// Fases dos sete capítulos (uma por capítulo), na ordem da história.
import type { FaseCapitulo, TemaVisual } from './comum';
import { CAP1_BRINQUEDOS } from './cap1_brinquedos';

export type { FaseCapitulo, TemaVisual };
export { CAP1_BRINQUEDOS };

export const CAPITULOS: readonly FaseCapitulo[] = [CAP1_BRINQUEDOS];

/** Fase do capítulo n (1–7). */
export const faseDoCapitulo = (n: number): FaseCapitulo | undefined => CAPITULOS.find((f) => f.capitulo === n);
