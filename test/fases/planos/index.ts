import type { Etapa } from '../bot';
import { PLANO_CAP1 } from './cap1';
import { PLANO_CAP2 } from './cap2';
import { PLANO_CAP3 } from './cap3';
import { PLANO_CAP4 } from './cap4';
import { PLANO_CAP5 } from './cap5';
import { PLANO_CAP6 } from './cap6';

/** Plano dos bots de cada fase (por id). */
export const PLANOS: Record<string, Etapa[]> = {
  'cap1-brinquedos': PLANO_CAP1,
  'cap2-floresta': PLANO_CAP2,
  'cap3-relogio': PLANO_CAP3,
  'cap4-oceano': PLANO_CAP4,
  'cap5-doces': PLANO_CAP5,
  'cap6-espelhos': PLANO_CAP6,
};
