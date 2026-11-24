// Mapa de apoio de uma fase: o grafo de alcance (lugares onde se fica em pé e como ir de um a outro) e os pontos de
// cooperação, onde um precisa do outro. É o que o companheiro controlado pelo jogo consulta para navegar e ajudar.
//
// GERADO FORA DO CELULAR [R59]: `npm run apoio` (tools/gerar_apoio.ts) monta o grafo com a simulação real e grava
// src/core/fases/apoio/capN.json com o `hashFase`. Montar no aparelho custaria de 0,13 a 3 s no PC (cap. 3) e 3–10×
// isso no celular. O teste T14 (test/apoio.test.ts) falha se a fase mudou e o mapa não foi regenerado.
//
// Formato e semântica (ARQUITETURA_MODOS §6.2, com os acréscimos do L2a):
// - `nos`: lugares de pé (`fixo`: topo de plataforma; `esp`: plataforma especial numa amostra do tempo; `quica`:
//   gelatina; `argola`). x0…x1 = posições possíveis do centro do corpo; y = altura dos pés.
// - `lig[a]`: ligações saindo do nó a. `tipo` 'solo' (sozinho), 'super' (mãos dadas), 'fio' (Fio Vermelho),
//   'porta' (alguém na placa). `manobra` diz qual primitiva de ./manobras.ts atravessa a ligação.
// - `coop`: pontos de cooperação. Cada um é UMA ligação de ajuda de um caminho mínimo (menos ajudas) do início ao
//   pedaço da estrela. `tipo` é sempre o papel do COMPANHEIRO; `gatilho` é onde o JOGADOR precisa estar para o
//   ponto acender; `papel` é onde o companheiro fica e o que faz. Todo ponto do caminho (`origem: 'caminho'`, o
//   companheiro ajuda) tem o `inverso` (`origem: 'inverso'`, o jogador ajuda e o companheiro passa), com os tipos
//   'passar' (porta), 'superpulo' (impulso), 'serPuxado' (puxar) e 'fioPendurado' (fio). Ids, dicas e ajustes de
//   posição vêm do campo `apoio` de cada fase (escrito à mão e conferido pelo T14).
import type { Fase, Retangulo } from '../types';

export type TipoNo = 'fixo' | 'esp' | 'quica' | 'argola';
export interface NoApoio { tipo: TipoNo; x0: number; x1: number; y: number; /** índice em fase.especiais ou fase.argolas */ k?: number }
export type TipoLigacao = 'solo' | 'super' | 'fio' | 'porta';
export type Manobra = 'saltar' | 'carona' | 'subirEm' | 'quicarPara' | 'atravessarArgola' | 'superpulo' | 'fio' | 'porta';
export interface LigApoio { para: number; tipo: TipoLigacao; porta?: string; manobra: Manobra }

/** Papel do companheiro. Os quatro primeiros e o fio vêm do ARQUITETURA_MODOS §2.1; 'passar', 'superpulo' e
 *  'serPuxado' são os papéis do companheiro nos pontos inversos (o jogador ajuda). */
export type TipoCoop =
  | 'placa' | 'placaDupla' | 'impulso' | 'puxar' | 'fioAncora' | 'fioPendurado'
  | 'passar' | 'superpulo' | 'serPuxado'
  | 'argolaEmpurrar' | 'ferramenta';

/** A ajuda acabou quando quem foi ajudado está em pé neste trecho (o nó de chegada da ligação). */
export interface CondicaoFim { no: number; x0: number; x1: number; y: number }

export interface PontoCoop {
  /** 'cap1:tampa' (inverso: 'cap1:tampa~inv') */
  id: string;
  tipo: TipoCoop;
  origem: 'caminho' | 'inverso';
  /** a ligação de ajuda que o ponto atravessa: quem é ajudado vai do nó `de` ao nó `para` */
  de: number; para: number; lig: TipoLigacao; porta?: string;
  /** onde o JOGADOR precisa estar para o ponto acender */
  gatilho: Retangulo;
  /** onde o companheiro fica (nó, x, y) e o que faz */
  papel: { no: number; x: number; y: number; placa?: string; segurar?: 'act'; ate: CondicaoFim };
  /** o mesmo ponto com os papéis trocados */
  inverso?: string;
  /** plano B (ARQUITETURA_MODOS §6.6) */
  dica: string;
  autoSolucao: 'tolerancia' | 'atalho';
}

export interface MapaApoio {
  /** versão do formato */
  v: 1;
  fase: string;
  /** hash da fase (hashFase) quando o mapa foi gerado */
  hashFase: string;
  nos: NoApoio[];
  lig: LigApoio[][];
  coop: PontoCoop[];
  /** estrelinhas (índices em fase.estrelinhas) que se pegam sozinho a partir de cada nó */
  estrelas: number[][];
}

/** Formato gravado em capN.json: igual a MapaApoio, mas nós e ligações em listas curtas (o cap. 3 tem 5 mil
 *  ligações): nó = [tipo, x0, x1, y, k?]; ligação = [para, tipo, manobra, porta?] com tipo e manobra como índice em
 *  TIPOS_NO, TIPOS_LIG e MANOBRAS. `lerMapa` devolve o MapaApoio. */
export interface MapaApoioJson {
  v: 1; fase: string; hashFase: string;
  nos: (number)[][];
  lig: (number | string)[][][];
  coop: PontoCoop[];
  estrelas: number[][];
}
export const TIPOS_NO: readonly TipoNo[] = ['fixo', 'esp', 'quica', 'argola'];
export const TIPOS_LIG: readonly TipoLigacao[] = ['solo', 'super', 'fio', 'porta'];
export const MANOBRAS: readonly Manobra[] = ['saltar', 'carona', 'subirEm', 'quicarPara', 'atravessarArgola', 'superpulo', 'fio', 'porta'];

export function codificarMapa(m: MapaApoio): MapaApoioJson {
  return {
    v: m.v, fase: m.fase, hashFase: m.hashFase,
    nos: m.nos.map((n) => [TIPOS_NO.indexOf(n.tipo), n.x0, n.x1, n.y, ...(n.k !== undefined ? [n.k] : [])]),
    lig: m.lig.map((ls) => ls.map((l) => [l.para, TIPOS_LIG.indexOf(l.tipo), MANOBRAS.indexOf(l.manobra), ...(l.porta ? [l.porta] : [])])),
    coop: m.coop, estrelas: m.estrelas,
  };
}
export function lerMapa(j: MapaApoioJson): MapaApoio {
  if (j.v !== 1) throw new Error(`mapa de apoio ${j.fase}: versão ${j.v} desconhecida`);
  return {
    v: 1, fase: j.fase, hashFase: j.hashFase,
    nos: j.nos.map(([t, x0, x1, y, k]) => ({ tipo: TIPOS_NO[t], x0, x1, y, ...(k !== undefined ? { k } : {}) })),
    lig: j.lig.map((ls) => ls.map(([para, t, m, porta]) => ({ para: para as number, tipo: TIPOS_LIG[t as number], manobra: MANOBRAS[m as number], ...(porta !== undefined ? { porta: porta as string } : {}) }))),
    coop: j.coop, estrelas: j.estrelas,
  };
}

/** Anotação à mão de um ponto de cooperação (campo `apoio` da fase). Casa com o ponto gerado do mesmo `tipo` cujo
 *  gatilho tem o centro mais perto de `x` (até 8 m). */
export interface ApoioManual {
  id: string;
  tipo: TipoCoop;
  /** desempate entre dois pontos do mesmo tipo no mesmo lugar: a placa em que o companheiro fica */
  placa?: string;
  /** x aproximado do gatilho (onde o jogador espera a ajuda) */
  x: number;
  dica: string;
  /** dica do ponto inverso (o jogador ajuda) */
  dicaInverso: string;
  /** x exato onde o companheiro fica, quando a geometria pede (tem de cair dentro do nó do papel) */
  papelX?: number;
  autoSolucao?: 'tolerancia' | 'atalho';
}
export interface ApoioFase { pontos: ApoioManual[] }

/** FNV-1a de 32 bits sobre o JSON da fase inteira (inclusive o campo `apoio`). Mesma fase, mesmo hash. */
export function hashFase(f: Fase): string {
  const s = JSON.stringify(f);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Nó de chão fixo onde fica em pé quem está em (x, y) (ou o primeiro abaixo). -1 se nenhum. */
export function noSobApoio(m: MapaApoio, x: number, y: number, tol = 0.05): number {
  let melhor = -1, yMelhor = -Infinity;
  for (let id = 0; id < m.nos.length; id++) {
    const n = m.nos[id];
    if (n.tipo !== 'fixo' || x < n.x0 || x > n.x1) continue;
    if (n.y <= y + tol && n.y > yMelhor) { yMelhor = n.y; melhor = id; }
  }
  return melhor;
}
