import type { Etapa } from '../bot';
import { PLANO_CAP1 } from './cap1';

/** Plano dos bots de cada fase (por id). */
export const PLANOS: Record<string, Etapa[]> = {
  'cap1-brinquedos': PLANO_CAP1,
};
