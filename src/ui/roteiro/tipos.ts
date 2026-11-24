// Formato do roteiro de balões de fala (docs/revisao/NARRATIVA_CASAL.md §4). Só interface: o núcleo não depende
// disto. Um roteiro por capítulo em src/ui/roteiro/capN.ts; o diretor (diretor.ts) decide o que aparece.
import type { Estado, Fase } from '../../core/types';

/** Quem fala: P = quem disparou o gatilho, O = o outro, N = Natan, B = Bruna, L = Dona Lume (voz do alto). */
export type Quem = 'P' | 'O' | 'N' | 'B' | 'L';

/** Prioridade: história > dica > reação > ociosidade (resgate conta como reação). */
export type Pool = 'historia' | 'dica' | 'reacao' | 'resgate' | 'ocioso';

/** Texto fixo, ou com a variante de cada personagem (concordância: "obrigado/obrigada"). */
export type Texto = string | { N: string; B: string };

/** Contexto das condições. `mem` é um rascunho só desta fala (zera ao recomeçar a fase). */
export interface CtxFala {
  e: Estado;
  f: Fase;
  mem: Record<string, number>;
  /** o evento que disparou (gatilho com `evento`) */
  ev?: string;
}

export interface Gatilho {
  /** começo da fase */
  inicio?: true;
  /** alguém (ou os dois, com `ambos`) com o x dentro de [x0, x1] (m, na fase) */
  zona?: [number, number];
  ambos?: boolean;
  /** evento da simulação (src/core/sim.ts): o tipo ('derrota') ou o tipo com o id ('porta-abriu:portao') */
  evento?: string;
  /** os dois parados (sem andar) por este tempo, em s */
  ocioso?: number;
  /** a condição (zona + cond) precisa valer por este tempo seguido, em s */
  por?: number;
  /** condição extra: devolve quem disparou (0 Natan, 1 Bruna) ou -1 (não dispara) */
  cond?: (c: CtxFala) => number;
}

export interface Fala {
  /** 'c1-21' */
  id: string;
  /** sem gatilho: só sai como resposta de outra fala (`depois`) */
  gatilho?: Gatilho;
  /** uma lista sorteia junto com `texto` (mesmo índice), pelo hash do id e da vez */
  quem: Quem | Quem[];
  texto: Texto | Texto[];
  /** id da resposta: sai depois que esta termina, com o mesmo P */
  depois?: string;
  /** padrão: 'historia' */
  pool?: Pool;
  /** pode repetir: espera mínima em s entre duas vezes (sem isto: uma vez por partida; momento visto não repete) */
  espera?: number;
  /** dica da primeira vez desta mecânica (src/ui/dicas.ts): não sai se a mecânica já foi usada */
  mecanica?: string;
  /** pode sair com bichinho perto (padrão: não; "nada durante perigo") */
  emPerigo?: boolean;
}

export interface Roteiro {
  cap: number;
  falas: Fala[];
}
