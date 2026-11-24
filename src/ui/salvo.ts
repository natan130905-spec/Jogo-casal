// Salvamento v2 (ARQUITETURA_MODOS §5; L2b; R22–R24). Substitui src/ui/progresso.ts.
// - O progresso é do casal e da campanha, não do aparelho: cada aparelho guarda uma cópia de cada campanha (slot) em
//   que jogou, identificada por `id`. Os dois aparelhos gravam (o convidado também) e se acertam ao conectar.
// - Só cresce, então a fusão não perde nada: conjuntos por união, recordes por máximo, marcas por OU. fundir(a, b) =
//   fundir(b, a) e fundir(a, a) = a (T9).
// - A retomada no meio do capítulo (ResumoLanterna, ≈ 200 B) não é monotônica: vence a mais nova por (rev, salvoEm).
//   Concluir o capítulo apaga a retomada e marca `fimRetomada` com o rev, para a fusão não trazer de volta a velha.
// - O treino nunca lê nem grava esta chave (só a dele, CHAVE_TREINO; T12).
import { estadoInicial, pontoCheckpoint } from '../core/sim';
import type { Estado, Fase } from '../core/types';

export const TOTAL_CAPITULOS = 7;
export const CHAVE_SALVO = 'edm-salvo-v2';
/** formato antigo: lido uma vez para migrar e nunca apagado nem escrito (dá para voltar à versão anterior) */
export const CHAVE_V1 = 'edm-progresso-v1';
/** preferências do Quintal de Treino; nunca lido pela campanha */
export const CHAVE_TREINO = 'edm-treino-v1';
export const MAX_SLOTS = 3;

// ---------- conjuntos de índices em texto (bitset em base64url) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** índices (0…1023) → bitset em base64url, 6 bits por caractere, sem zeros à direita (forma única) */
export function bitsDe(ix: Iterable<number>): string {
  const v: number[] = [];
  for (const i of ix) {
    if (!Number.isInteger(i) || i < 0 || i > 1023) continue;
    const k = Math.floor(i / 6);
    while (v.length <= k) v.push(0);
    v[k] |= 1 << (i % 6);
  }
  while (v.length && v[v.length - 1] === 0) v.pop();
  return v.map((x) => B64[x]).join('');
}
export function indicesDe(s: string): number[] {
  const r: number[] = [];
  for (let k = 0; k < s.length; k++) {
    const x = B64.indexOf(s[k]);
    if (x < 0) continue;
    for (let b = 0; b < 6; b++) if (x & (1 << b)) r.push(k * 6 + b);
  }
  return r;
}
const uniao = (a: string, b: string) => bitsDe([...indicesDe(a), ...indicesDe(b)]);
const normalBits = (s: unknown) => (typeof s === 'string' ? bitsDe(indicesDe(s.slice(0, 200))) : '');

// ---------- tipos ----------
export interface ProgressoCapitulo {
  /** o pedaço da estrela foi recuperado (no cap. 7, a Arena foi vencida) · OU */
  concluido: boolean;
  /** cap. 7: a parte 2.5D foi feita e o Rei fugiu com o pedaço (a Arena fica pendente enquanto não concluído) · OU */
  fuga: boolean;
  /** índices de fase.estrelinhas já pegos em qualquer passada · união (as estrelas grandes saem daqui) */
  pegas: string;
  /** melhor total do casal numa só passada (o placar do mapa) · máximo */
  melhorPassada: number;
  /** estrelinhas possíveis (as da fase + uma por bichinho) · máximo */
  total: number;
  /** baús abertos (L4) · união */
  baus: string;
}

export interface ResumoLanterna {
  v: 1;
  cap: number;
  /** última lanterna acesa (-1 = início da fase) */
  lanterna: number;
  /** mantém as plataformas que dependem do tempo onde estavam */
  tick: number;
  /** estrelinhas desta passada (índices de fase.estrelinhas) */
  coletadas: number[];
  est: [number, number];
  casal: number;
  /** bichinhos já derrotados (bitset): não voltam, já deram a estrelinha */
  derrotados: string;
  /** reservado ao L4 (arsenal na lanterna, DESIGN_ARMAS §11) */
  arsenal?: unknown;
  rev: number;
  salvoEm: number;
}

export interface Campanha {
  v: 2;
  /** 16 caracteres [A-Za-z0-9] */
  id: string;
  nome: string;
  criadaEm: number;
  salvoEm: number;
  /** sobe a cada gravação neste aparelho (máximo na fusão) */
  rev: number;
  prologoVisto: boolean;
  finalVisto: boolean;
  /** por capítulo (1–7) */
  capitulos: Record<number, ProgressoCapitulo>;
  /** desbloqueios do casal: armas e lembranças em bits (OU), segredos em bitset (união) */
  desbloqueios: { armas: number; lembrancas: number; segredos: string };
  /** onde parar e voltar (a mais nova vence) */
  retomada?: ResumoLanterna;
  /** rev em que a retomada foi apagada (conclusão do capítulo): na fusão, conta como uma "retomada vazia" desse rev */
  fimRetomada: number;
}

export interface Salvo { v: 2; ativo: string; slots: Campanha[] }

/** formato v1 (edm-progresso-v1) e a vista compatível que o mapa, o placar e os ganchos de teste leem */
export interface ResultadoCapitulo { estrelinhas: number; total: number }
export interface Progresso {
  v: 1;
  prologoVisto: boolean;
  capitulos: Record<number, ResultadoCapitulo>;
  finalVisto: boolean;
  arena7?: ResultadoCapitulo;
}

// ---------- criar e validar ----------
const num = (v: unknown, max = 1e15) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
const ID_OK = /^[A-Za-z0-9]{16}$/;

export function novoId(): string {
  const ab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => ab[x % 62]).join('');
}

export function novaCampanha(id = novoId(), agora = Date.now()): Campanha {
  return { v: 2, id, nome: 'Nossa jornada', criadaEm: agora, salvoEm: agora, rev: 0, prologoVisto: false, finalVisto: false,
    capitulos: {}, desbloqueios: { armas: 0, lembrancas: 0, segredos: '' }, fimRetomada: 0 };
}

function capitulo(c: Partial<ProgressoCapitulo>): ProgressoCapitulo {
  return { concluido: !!c.concluido, fuga: !!c.fuga, pegas: c.pegas ?? '', melhorPassada: c.melhorPassada ?? 0, total: c.total ?? 0, baus: c.baus ?? '' };
}

/** Sempre na mesma ordem de campos (a fusão compara por JSON e o T9 também). */
function montar(c: Omit<Campanha, 'v'>): Campanha {
  const caps: Record<number, ProgressoCapitulo> = {};
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) if (c.capitulos[n]) caps[n] = capitulo(c.capitulos[n]);
  const r: Campanha = { v: 2, id: c.id, nome: c.nome, criadaEm: c.criadaEm, salvoEm: c.salvoEm, rev: c.rev,
    prologoVisto: c.prologoVisto, finalVisto: c.finalVisto, capitulos: caps,
    desbloqueios: { armas: c.desbloqueios.armas, lembrancas: c.desbloqueios.lembrancas, segredos: c.desbloqueios.segredos },
    fimRetomada: c.fimRetomada };
  if (c.retomada) r.retomada = c.retomada;
  return r;
}

export function limparResumo(x: unknown): ResumoLanterna | undefined {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.v !== 1) return undefined;
  const cap = num(o.cap, TOTAL_CAPITULOS);
  if (cap < 1) return undefined;
  const lanterna = typeof o.lanterna === 'number' && Number.isFinite(o.lanterna) ? Math.max(-1, Math.min(99, Math.round(o.lanterna))) : -1;
  const col = Array.isArray(o.coletadas) ? [...new Set(o.coletadas.filter((v) => Number.isInteger(v) && v >= 0 && v < 1024) as number[])].sort((a, b) => a - b) : [];
  const est = Array.isArray(o.est) ? o.est : [];
  const r: ResumoLanterna = { v: 1, cap, lanterna, tick: num(o.tick, 1e9), coletadas: col.slice(0, 512), est: [num(est[0], 9999), num(est[1], 9999)],
    casal: num(o.casal, 9999), derrotados: normalBits(o.derrotados), rev: num(o.rev), salvoEm: num(o.salvoEm) };
  if (o.arsenal !== undefined) r.arsenal = o.arsenal;
  return r;
}

/** Valida uma campanha vinda do armazenamento ou da rede; null se não for uma campanha v2. */
export function limparCampanha(x: unknown): Campanha | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.v !== 2 || typeof o.id !== 'string' || !ID_OK.test(o.id)) return null;
  const caps: Record<number, ProgressoCapitulo> = {};
  const oc = (o.capitulos ?? {}) as Record<string, Record<string, unknown>>;
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) {
    const c = oc[n];
    if (!c || typeof c !== 'object') continue;
    caps[n] = capitulo({ concluido: c.concluido === true, fuga: c.fuga === true, pegas: normalBits(c.pegas), melhorPassada: num(c.melhorPassada, 9999),
      total: num(c.total, 9999), baus: normalBits(c.baus) });
  }
  const d = (o.desbloqueios ?? {}) as Record<string, unknown>;
  return montar({ id: o.id, nome: typeof o.nome === 'string' ? o.nome.slice(0, 40) : 'Nossa jornada', criadaEm: num(o.criadaEm), salvoEm: num(o.salvoEm),
    rev: num(o.rev), prologoVisto: o.prologoVisto === true, finalVisto: o.finalVisto === true, capitulos: caps,
    desbloqueios: { armas: num(d.armas, 0x7fffffff), lembrancas: num(d.lembrancas, 0x7fffffff), segredos: normalBits(d.segredos) },
    retomada: limparResumo(o.retomada), fimRetomada: num(o.fimRetomada) });
}

// ---------- fusão (T9) ----------
const chaveRetomada = (c: Campanha) => [c.retomada ? c.retomada.rev : c.fimRetomada, c.retomada ? c.retomada.salvoEm : 0, c.retomada ? JSON.stringify(c.retomada) : ''] as const;
function maisNova(a: Campanha, b: Campanha): Campanha {
  const ka = chaveRetomada(a), kb = chaveRetomada(b);
  for (let k = 0; k < 3; k++) if (ka[k] !== kb[k]) return ka[k] > kb[k] ? a : b;
  return a;
}

/** União, máximo e OU; a retomada pela regra (rev, salvoEm). Comutativa e idempotente (T9). */
export function fundir(a: Campanha, b: Campanha): Campanha {
  const caps: Record<number, ProgressoCapitulo> = {};
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) {
    const x = a.capitulos[n], y = b.capitulos[n];
    if (!x && !y) continue;
    if (!x || !y) { caps[n] = capitulo((x ?? y)!); continue; }
    caps[n] = capitulo({ concluido: x.concluido || y.concluido, fuga: x.fuga || y.fuga, pegas: uniao(x.pegas, y.pegas),
      melhorPassada: Math.max(x.melhorPassada, y.melhorPassada), total: Math.max(x.total, y.total), baus: uniao(x.baus, y.baus) });
  }
  const r = maisNova(a, b);
  // o nome do slot: o de quem gravou por último (empate: a ordem do texto, para a fusão continuar comutativa)
  const nomeDe = a.salvoEm !== b.salvoEm ? (a.salvoEm > b.salvoEm ? a : b).nome : a.nome <= b.nome ? a.nome : b.nome;
  return montar({
    id: a.id <= b.id ? a.id : b.id, nome: nomeDe, criadaEm: Math.min(a.criadaEm, b.criadaEm), salvoEm: Math.max(a.salvoEm, b.salvoEm),
    rev: Math.max(a.rev, b.rev), prologoVisto: a.prologoVisto || b.prologoVisto, finalVisto: a.finalVisto || b.finalVisto, capitulos: caps,
    desbloqueios: { armas: a.desbloqueios.armas | b.desbloqueios.armas, lembrancas: a.desbloqueios.lembrancas | b.desbloqueios.lembrancas,
      segredos: uniao(a.desbloqueios.segredos, b.desbloqueios.segredos) },
    retomada: r.retomada, fimRetomada: Math.max(a.fimRetomada, b.fimRetomada),
  });
}

// ---------- migração do v1 (T10) ----------
export function limparProgressoV1(x: unknown): Progresso {
  const o = (x ?? {}) as Record<string, unknown>;
  const p: Progresso = { v: 1, prologoVisto: false, capitulos: {}, finalVisto: false };
  if (o.v !== 1) return p;
  p.prologoVisto = o.prologoVisto === true;
  p.finalVisto = o.finalVisto === true;
  const caps = (o.capitulos ?? {}) as Record<string, unknown>;
  const a7 = o.arena7 as Record<string, unknown> | undefined;
  if (a7 && typeof a7 === 'object') p.arena7 = { estrelinhas: num(a7.estrelinhas, 999), total: num(a7.total, 999) };
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) {
    const c = caps[n] as Record<string, unknown> | undefined;
    if (!c || typeof c !== 'object') continue;
    p.capitulos[n] = { estrelinhas: num(c.estrelinhas, 999), total: num(c.total, 999) };
  }
  return p;
}

/** v1 → slot "Nossa jornada". O v1 não diz quais estrelinhas foram pegas: `pegas` fica vazio e o placar vem de
 *  `melhorPassada` (ninguém perde estrela). arena7 → cap. 7 com a fuga feita e a Arena pendente. */
export function migrarV1(x: unknown, id = novoId(), agora = Date.now()): Campanha {
  const p = limparProgressoV1(x);
  const c = novaCampanha(id, agora);
  c.prologoVisto = p.prologoVisto;
  c.finalVisto = p.finalVisto;
  for (const [n, r] of Object.entries(p.capitulos)) c.capitulos[Number(n)] = capitulo({ concluido: true, melhorPassada: r.estrelinhas, total: r.total });
  if (p.arena7) {
    const a = c.capitulos[7];
    c.capitulos[7] = capitulo({ concluido: a?.concluido, fuga: true, melhorPassada: Math.max(a?.melhorPassada ?? 0, p.arena7.estrelinhas), total: Math.max(a?.total ?? 0, p.arena7.total) });
  }
  return montar(c);
}

// ---------- consultas (o que o mapa e o menu mostram) ----------
export const concluido = (c: Campanha, n: number) => !!c.capitulos[n]?.concluido;
/** Liberado: o primeiro, ou o seguinte a um concluído (em ordem). */
export const liberado = (c: Campanha, n: number) => n === 1 || concluido(c, n - 1);
export function proximoCapitulo(c: Campanha): number {
  for (let n = 1; n <= TOTAL_CAPITULOS; n++) if (!concluido(c, n)) return n;
  return TOTAL_CAPITULOS;
}
export const pedacos = (c: Campanha) => Object.values(c.capitulos).filter((p) => p.concluido).length;
export const estrelinhasTotais = (c: Campanha) => Object.values(c.capitulos).reduce((s, p) => s + (p.concluido ? p.melhorPassada : 0), 0);
/** cap. 7: a parte 2.5D foi feita e falta vencer a Arena */
export const arenaPendente = (c: Campanha) => !!c.capitulos[TOTAL_CAPITULOS]?.fuga && !concluido(c, TOTAL_CAPITULOS);
/** algo para continuar (o menu mostra "Continuar") */
export const temProgresso = (c: Campanha) => c.prologoVisto || !!c.retomada || Object.keys(c.capitulos).length > 0;

/** A vista no formato v1 (mapa, placar, __edmFluxo.progresso() dos e2e). */
export function vista(c: Campanha): Progresso {
  const p: Progresso = { v: 1, prologoVisto: c.prologoVisto, capitulos: {}, finalVisto: c.finalVisto };
  for (const [n, r] of Object.entries(c.capitulos)) if (r.concluido) p.capitulos[Number(n)] = { estrelinhas: r.melhorPassada, total: r.total };
  const c7 = c.capitulos[TOTAL_CAPITULOS];
  if (arenaPendente(c) && c7) p.arena7 = { estrelinhas: c7.melhorPassada, total: c7.total };
  return p;
}

// ---------- mudanças (cada uma devolve uma campanha nova com rev + 1) ----------
function gravacao(c: Campanha, agora: number): Campanha {
  return { ...c, capitulos: { ...c.capitulos }, desbloqueios: { ...c.desbloqueios }, rev: c.rev + 1, salvoEm: Math.max(agora, c.salvoEm) };
}

export function comMarca(c: Campanha, m: 'prologoVisto' | 'finalVisto', agora = Date.now()): Campanha {
  if (c[m]) return c;
  const r = gravacao(c, agora);
  r[m] = true;
  return montar(r);
}

/** Conclusão de um capítulo (no 7, `fuga`: a parte 2.5D, e a Arena fica pendente; sem `fuga`, a Arena vencida). */
export function registrarConclusao(c: Campanha, cap: number, r: { estrelinhas: number; total: number; coletadas?: readonly number[]; fuga?: boolean }, agora = Date.now()): Campanha {
  const n = gravacao(c, agora);
  const a = capitulo(c.capitulos[cap] ?? {});
  n.capitulos[cap] = capitulo({
    concluido: a.concluido || !r.fuga, fuga: a.fuga || !!r.fuga, pegas: uniao(a.pegas, bitsDe(r.coletadas ?? [])),
    melhorPassada: Math.max(a.melhorPassada, r.estrelinhas), total: Math.max(a.total, r.total), baus: a.baus,
  });
  if (n.retomada?.cap === cap) { n.retomada = undefined; n.fimRetomada = n.rev; }
  return montar(n);
}

/** Lanterna acesa (ou saída do app no meio da fase): guarda a retomada e o que a passada já pegou. */
export function registrarRetomada(c: Campanha, r: Omit<ResumoLanterna, 'rev' | 'salvoEm'>, agora = Date.now()): Campanha {
  const n = gravacao(c, agora);
  n.retomada = { ...r, rev: n.rev, salvoEm: n.salvoEm };
  const a = capitulo(c.capitulos[r.cap] ?? {});
  const pegas = uniao(a.pegas, bitsDe(r.coletadas));
  if (pegas !== a.pegas || c.capitulos[r.cap]) n.capitulos[r.cap] = { ...a, pegas };
  return montar(n);
}

// ---------- resumo e retomada (T8) ----------
export function resumir(cap: number, e: Estado): Omit<ResumoLanterna, 'rev' | 'salvoEm'> {
  return { v: 1, cap, lanterna: e.checkpoint, tick: e.tick, coletadas: [...e.coletadas].sort((a, b) => a - b),
    est: [e.jogadores[0].estrelinhas, e.jogadores[1].estrelinhas], casal: e.estrelinhasCasal,
    derrotados: bitsDe(e.inimigos.flatMap((n, k) => (n.vivo ? [] : [k]))) };
}

/**
 * Recria o estado só com o resumo (as regras da medida de ARQUITETURA_MODOS §2.2): bichinhos derrotados continuam
 * derrotados, as estrelinhas pegas continuam pegas, portas e fio no começo (as placas recalculam), os dois renascem
 * na lanterna com 3 corações e o relógio da fase (tick) onde estava.
 */
export function retomar(f: Fase, r: ResumoLanterna): Estado {
  const e = estadoInicial(f);
  const nEst = f.estrelinhas?.length ?? 0, nLan = f.lanternas?.length ?? 0;
  e.tick = r.tick;
  e.checkpoint = r.lanterna < nLan ? r.lanterna : -1;
  e.coletadas = r.coletadas.filter((k) => k < nEst);
  e.estrelinhasCasal = r.casal;
  for (const k of indicesDe(r.derrotados)) if (e.inimigos[k]) e.inimigos[k].vivo = false;
  for (const i of [0, 1] as const) {
    const p = pontoCheckpoint(f, e, i), j = e.jogadores[i];
    j.x = j.seguroX = p.x; j.y = j.seguroY = p.y; j.estrelinhas = r.est[i];
  }
  return e;
}

// ---------- armazenamento ----------
type Armazem = Pick<Storage, 'getItem' | 'setItem'>;
const armazem = (): Armazem | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const campanhaAtiva = (s: Salvo): Campanha => s.slots.find((c) => c.id === s.ativo) ?? s.slots[0];

/** Põe a campanha no salvo (substitui o slot do mesmo id; sem lugar, sai o slot mais velho que não é o ativo). */
export function comCampanha(s: Salvo, c: Campanha, ativar = true): Salvo {
  let slots = s.slots.filter((x) => x.id !== c.id);
  slots.push(c);
  const ativo = ativar ? c.id : s.ativo;
  while (slots.length > MAX_SLOTS) {
    const velho = slots.filter((x) => x.id !== ativo && x.id !== c.id).sort((a, b) => a.salvoEm - b.salvoEm)[0];
    slots = slots.filter((x) => x !== velho);
  }
  slots.sort((a, b) => a.criadaEm - b.criadaEm || (a.id < b.id ? -1 : 1));
  return { v: 2, ativo, slots };
}

export function limparSalvo(x: unknown): Salvo | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || o.v !== 2 || !Array.isArray(o.slots)) return null;
  const slots = o.slots.map(limparCampanha).filter((c): c is Campanha => !!c).slice(0, MAX_SLOTS);
  if (!slots.length) return null;
  const ativo = typeof o.ativo === 'string' && slots.some((c) => c.id === o.ativo) ? o.ativo : slots[0].id;
  return { v: 2, ativo, slots };
}

/**
 * Lê o salvo. Sem v2: migra o v1 (se houver) e grava o v2 já (o id fica estável); sem nada, uma campanha nova que só
 * vai para o armazenamento na primeira gravação.
 */
export function carregarSalvo(a: Armazem | null = armazem()): { salvo: Salvo; migrou: boolean } {
  let bruto: string | null = null, v1: string | null = null;
  try { bruto = a?.getItem(CHAVE_SALVO) ?? null; v1 = a?.getItem(CHAVE_V1) ?? null; } catch { /* sem armazenamento */ }
  let s: Salvo | null = null;
  try { s = limparSalvo(JSON.parse(bruto ?? 'null')); } catch { s = null; }
  if (s) return { salvo: s, migrou: false };
  if (v1) {
    let p: unknown = null;
    try { p = JSON.parse(v1); } catch { p = null; }
    const c = migrarV1(p);
    const salvo: Salvo = { v: 2, ativo: c.id, slots: [c] };
    gravarSalvo(salvo, a);
    return { salvo, migrou: true };
  }
  const c = novaCampanha();
  return { salvo: { v: 2, ativo: c.id, slots: [c] }, migrou: false };
}

export function gravarSalvo(s: Salvo, a: Armazem | null = armazem()) {
  try { a?.setItem(CHAVE_SALVO, JSON.stringify(s)); } catch { /* aba anônima ou cheia: segue sem salvar */ }
}

/** Uma vez por sessão: pede armazenamento persistente (o iOS e o Chrome podem apagar o localStorage sem uso). */
export function pedirPersistencia() {
  try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* sem a API */ }
}

// ---------- Quintal de Treino (chave própria) ----------
export interface PrefsTreino { v: 1; eu: 0 | 1; visitas: number }
export function carregarTreino(a: Armazem | null = armazem()): PrefsTreino {
  try {
    const o = JSON.parse(a?.getItem(CHAVE_TREINO) ?? 'null') as Record<string, unknown> | null;
    if (o && o.v === 1) return { v: 1, eu: o.eu === 1 ? 1 : 0, visitas: num(o.visitas, 1e6) };
  } catch { /* lixo */ }
  return { v: 1, eu: 0, visitas: 0 };
}
export function gravarTreino(p: PrefsTreino, a: Armazem | null = armazem()) {
  try { a?.setItem(CHAVE_TREINO, JSON.stringify(p)); } catch { /* sem armazenamento */ }
}
