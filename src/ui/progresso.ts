// Progresso da campanha: fica no aparelho do anfitrião (localStorage) e é copiado ao convidado pela rede.
// O treino sozinho usa uma cópia com tudo liberado e não salva nada.

export const TOTAL_CAPITULOS = 7;
const CHAVE = 'edm-progresso-v1';

export interface ResultadoCapitulo {
  /** melhor número de estrelinhas do casal neste capítulo */
  estrelinhas: number;
  /** estrelinhas possíveis (as da fase + uma por bichinho) */
  total: number;
}

export interface Progresso {
  v: 1;
  prologoVisto: boolean;
  /** capítulos concluídos (o pedaço da estrela foi pego), por número 1–7 */
  capitulos: Record<number, ResultadoCapitulo>;
  finalVisto: boolean;
  /** capítulo 7: a parte 2.5D já foi feita (com estas estrelinhas) e falta vencer a Arena do Coração */
  arena7?: ResultadoCapitulo;
}

export const progressoVazio = (): Progresso => ({ v: 1, prologoVisto: false, capitulos: {}, finalVisto: false });

/** Valida um progresso vindo do armazenamento ou da rede (qualquer coisa estranha vira vazio). */
export function limparProgresso(x: unknown): Progresso {
  const o = (x ?? {}) as Record<string, unknown>;
  const p = progressoVazio();
  if (o.v !== 1) return p;
  p.prologoVisto = o.prologoVisto === true;
  p.finalVisto = o.finalVisto === true;
  const caps = (o.capitulos ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : 0);
  const a7 = o.arena7 as Record<string, unknown> | undefined;
  if (a7 && typeof a7 === 'object') p.arena7 = { estrelinhas: num(a7.estrelinhas), total: num(a7.total) };
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) {
    const c = caps[n] as Record<string, unknown> | undefined;
    if (!c) continue;
    p.capitulos[n] = { estrelinhas: num(c.estrelinhas), total: num(c.total) };
  }
  return p;
}

export function carregarProgresso(): Progresso {
  try { return limparProgresso(JSON.parse(localStorage.getItem(CHAVE) ?? 'null')); } catch { return progressoVazio(); }
}
export function salvarProgresso(p: Progresso) {
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* aba anônima ou armazenamento cheio: segue sem salvar */ }
}

export const concluido = (p: Progresso, n: number) => !!p.capitulos[n];
/** Liberado: o primeiro, ou o seguinte a um concluído (em ordem). */
export const liberado = (p: Progresso, n: number) => n === 1 || concluido(p, n - 1);
/** Próximo capítulo a jogar (o primeiro liberado e não concluído; 7 se todos). */
export function proximoCapitulo(p: Progresso): number {
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) if (!concluido(p, n)) return n;
  return TOTAL_CAPITULOS;
}
export const pedacos = (p: Progresso) => Object.keys(p.capitulos).length;
export const estrelinhasTotais = (p: Progresso) => Object.values(p.capitulos).reduce((s, c) => s + c.estrelinhas, 0);

/** Registra a conclusão de um capítulo, guardando o melhor resultado. Devolve um novo objeto. */
export function registrar(p: Progresso, n: number, r: ResultadoCapitulo): Progresso {
  const antes = p.capitulos[n];
  const melhor = antes && antes.estrelinhas >= r.estrelinhas ? antes : r;
  return { ...p, capitulos: { ...p.capitulos, [n]: { estrelinhas: melhor.estrelinhas, total: Math.max(r.total, antes?.total ?? 0) } } };
}
