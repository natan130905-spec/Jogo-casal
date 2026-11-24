import type { Etapa } from '../bot';
import { PLANO_CAP1 } from './cap1';
import { PLANO_CAP2 } from './cap2';
import { PLANO_CAP3 } from './cap3';

/** Plano dos bots de cada fase (por id). */
export const PLANOS: Record<string, Etapa[]> = {
  'cap1-brinquedos': PLANO_CAP1,
  'cap2-floresta': PLANO_CAP2,
  'cap3-relogio': PLANO_CAP3,
};
