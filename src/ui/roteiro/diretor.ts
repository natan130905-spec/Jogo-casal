// Diretor dos balões de fala: lê o estado e os eventos de cada passo e decide quem fala o quê (NARRATIVA_CASAL §4).
// Puro e determinístico (sem DOM, sem relógio, sem sorteio): os dois celulares, com o mesmo estado e os mesmos
// eventos, mostram a mesma fala sem mensagem nova na rede. As opções do jogador (todos / só história / desligados)
// só filtram o que se DESENHA (src/ui/baloes.ts); o diretor corre igual, para os dois aparelhos não se separarem.
//
// Regras:
//   - no máximo 1 balão por pessoa (Natan, Bruna, Dona Lume);
//   - prioridade história > dica > reação > ociosidade; história e dica interrompem reação e ociosidade;
//   - nada durante perigo (bichinho a < 4 m de alguém), salvo as falas marcadas `emPerigo`;
//   - fala sem `espera` sai uma vez por partida (momento visto não repete, nem depois de voltar à lanterna);
//   - fala com `espera` (pools) repete, com no máximo uma do mesmo pool a cada `espera` s;
//   - nunca mexe nas entradas nem no estado: o balão não trava o controle.
import type { Estado, Fase } from '../../core/types';
import { Dicas, MECANICAS } from '../dicas';
import type { CtxFala, Fala, Gatilho, Pool, Quem, Roteiro, Texto } from './tipos';

/** Tempo de leitura (s): 1,2 s + 0,06 s por caractere, teto de 4,5 s (NARRATIVA_CASAL §2.2). */
export const LEITURA = Object.freeze({ base: 1.2, porCaractere: 0.06, teto: 4.5 });
export const leitura = (texto: string) => Math.min(LEITURA.teto, LEITURA.base + LEITURA.porCaractere * [...texto].length);
export const MAX_CARACTERES = 48;

export const PRIORIDADE: Record<Pool, number> = { historia: 3, dica: 2, reacao: 1, resgate: 1, ocioso: 0 };
/** quanto tempo (s) uma fala pode esperar a vez na fila antes de perder o sentido */
const VALIDADE: Record<Pool, number> = { historia: 12, dica: 8, reacao: 4, resgate: 4, ocioso: 2 };
/** perigo: bichinho vivo a menos disto de alguém (m) */
export const PERIGO = Object.freeze({ dx: 4, dy: 3 });
/** pausa entre uma fala e a resposta encadeada (ticks) */
const RESPIRO = 12;

/** 0 Natan, 1 Bruna, 2 Dona Lume */
export type Falante = 0 | 1 | 2;

export interface Balao {
  id: string;
  quem: Falante;
  texto: string;
  pool: Pool;
  /** tick em que começou e em que termina */
  desde: number;
  ate: number;
  /** repetição da dica (20 s): com o botão da mecânica piscando */
  repeticao: boolean;
  botao?: string;
}

interface Pendente { fala: Fala; p: number; criado: number; naoAntes: number; repeticao: boolean }

/** hash FNV-1a de 32 bits (variante da fala: igual nos dois celulares) */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function perigo(e: Estado) {
  return e.inimigos.some((n) => n.vivo && (n.aberto || e.jogadores.some((j) => !j.bolha && Math.abs(j.x - n.x) < PERIGO.dx && Math.abs(j.y - n.y) < PERIGO.dy)));
}

const EVENTO_DE_JOGADOR = new Set(['pulo', 'superpulo', 'pouso', 'caiu', 'maos', 'quique', 'tiro', 'pisao', 'dano', 'bolha', 'renasce',
  'estrelinha', 'soltou', 'escalou', 'argola', 'solta-argola', 'empurrao']);

/** quem disparou um evento: o índice do jogador, ou quem está mais perto do bichinho/lanterna do evento */
export function quemDoEvento(ev: string, e: Estado, f: Fase): number {
  const [tipo, a] = ev.split(':');
  if (EVENTO_DE_JOGADOR.has(tipo)) return Number(a) === 1 ? 1 : 0;
  let alvo: number | undefined;
  if (tipo === 'derrota' || tipo === 'acerto' || tipo === 'defendeu') alvo = e.inimigos[Number(a)]?.x;
  else if (tipo === 'lanterna') alvo = f.lanternas?.[Number(a)]?.x;
  if (alvo === undefined) return 0;
  const [j0, j1] = e.jogadores;
  return Math.abs(j1.x - alvo) < Math.abs(j0.x - alvo) ? 1 : 0;
}

const casa = (ev: string, g: string) => ev === g || ev.startsWith(g + ':');

export class Diretor {
  readonly dicas: Dicas;
  /** balão ativo de cada falante (0 Natan, 1 Bruna, 2 Dona Lume) */
  readonly ativos: (Balao | null)[] = [null, null, null];
  /** tudo o que já saiu nesta partida (testes e medidas) */
  readonly log: Balao[] = [];
  private porId = new Map<string, Fala>();
  private comGatilho: Fala[];
  private fila: Pendente[] = [];
  private vezes = new Map<string, number>();
  private ultimaVez = new Map<string, number>();
  private poolLivre = new Map<Pool, number>();
  private desde = new Map<string, number>();
  private mem = new Map<string, Record<string, number>>();
  private parados = 0;
  private ultimoTick = -1;

  constructor(private f: Fase, roteiro: Roteiro | null) {
    this.dicas = new Dicas(f);
    for (const fala of roteiro?.falas ?? []) this.porId.set(fala.id, fala);
    this.comGatilho = (roteiro?.falas ?? []).filter((x) => x.gatilho);
  }

  /** Recomeço da fase (o gancho de teste `roteiro` volta o tick a 0). */
  zerar() {
    this.ativos.fill(null);
    this.log.length = 0;
    this.fila = [];
    this.vezes.clear(); this.ultimaVez.clear(); this.poolLivre.clear(); this.desde.clear(); this.mem.clear();
    this.parados = 0; this.ultimoTick = -1;
    this.dicas.zerar();
  }

  /** Um passo (ou um quadro: os eventos de todos os ticks desde o último). Devolve os balões que começaram. */
  passo(e: Estado, eventos: readonly string[]): Balao[] {
    // recomeço de verdade (gancho `roteiro`): o tick volta mais de 2 s. Voltar poucos ticks acontece no convidado
    // (a interpolação troca o par de instantâneos); aí só se ignora o quadro, sem perder os eventos dele.
    if (e.tick < this.ultimoTick - 120) this.zerar();
    const t = Math.max(e.tick, this.ultimoTick);
    const dt = this.ultimoTick < 0 ? 1 : t - this.ultimoTick;
    if (dt <= 0 && !eventos.length) return [];
    this.ultimoTick = t;
    this.dicas.observar(eventos, e);

    // fim dos balões; a resposta encadeada entra na fila
    for (let q = 0; q < 3; q++) {
      const b = this.ativos[q];
      if (b && t >= b.ate) {
        this.ativos[q] = null;
        const fala = this.porId.get(b.id), prox = fala?.depois && this.porId.get(fala.depois);
        if (prox) this.fila.push({ fala: prox, p: this.pDe.get(b.id) ?? 0, criado: t, naoAntes: t + RESPIRO, repeticao: false });
      }
    }

    const parado = e.jogadores.every((j) => j.bolha || (Math.abs(j.vx) < 0.1 && Math.abs(j.vy) < 0.1));
    this.parados = parado ? this.parados + Math.max(1, dt) : 0;

    // gatilhos
    for (const fala of this.comGatilho) {
      const n = this.vezes.get(fala.id) ?? 0;
      const mec = fala.mecanica;
      let repeticao = false;
      if (mec && this.dicas.feita(mec)) { this.desde.delete(fala.id); continue; }
      if (n > 0) {
        if (fala.espera === undefined) {
          // dica: volta uma vez, 20 s depois, se a mecânica ainda não foi usada e a situação continua
          if (!mec || !this.dicas.repetir(mec, t)) continue;
          repeticao = true;
        } else if (t - (this.ultimaVez.get(fala.id) ?? -1e9) < fala.espera * 60) continue;
      }
      if (fala.espera !== undefined && (this.poolLivre.get(fala.pool ?? 'historia') ?? -1) > t) continue;
      if (this.fila.some((x) => x.fala === fala) || this.ativos.some((b) => b?.id === fala.id)) continue;
      const p = this.avaliar(fala, fala.gatilho!, e, eventos, repeticao, t);
      if (p < 0) continue;
      if (repeticao) this.dicas.repetiu(mec!);
      this.fila.push({ fala, p, criado: t, naoAntes: t, repeticao });
    }

    // fila: maior prioridade primeiro; quem está ocupado espera; perigo segura quase tudo
    const novos: Balao[] = [];
    if (!this.fila.length) return novos;
    const emPerigo = perigo(e);
    this.fila = this.fila.filter((x) => t - x.criado <= VALIDADE[x.fala.pool ?? 'historia'] * 60 && !(x.fala.mecanica && this.dicas.feita(x.fala.mecanica)));
    this.fila.sort((a, b) => PRIORIDADE[b.fala.pool ?? 'historia'] - PRIORIDADE[a.fala.pool ?? 'historia'] || a.criado - b.criado);
    for (let k = 0; k < this.fila.length; k++) {
      const x = this.fila[k];
      if (t < x.naoAntes || (emPerigo && !x.fala.emPerigo)) continue;
      const pool = x.fala.pool ?? 'historia';
      const vez = this.vezes.get(x.fala.id) ?? 0;
      const v = hash(`${x.fala.id}#${vez}`);
      const quemL = Array.isArray(x.fala.quem) ? x.fala.quem : [x.fala.quem];
      const textos = Array.isArray(x.fala.texto) ? x.fala.texto : [x.fala.texto];
      const iv = v % Math.max(quemL.length, textos.length);
      const q = falante(quemL[iv % quemL.length], x.p);
      const atual = this.ativos[q];
      if (atual) {
        const interrompe = PRIORIDADE[pool] >= PRIORIDADE.dica && PRIORIDADE[atual.pool] <= PRIORIDADE.reacao;
        if (!interrompe) continue;
      }
      // o mesmo pool não sai duas vezes dentro da espera (ex.: dois "ocioso" seguidos)
      if (x.fala.espera !== undefined && (this.poolLivre.get(pool) ?? -1) > t) { this.fila.splice(k--, 1); continue; }
      if (atual) atual.ate = t; // interrompido: a resposta dele não sai
      const texto = textoDe(textos[iv % textos.length], q);
      const mec = x.fala.mecanica;
      const b: Balao = { id: x.fala.id, quem: q, texto, pool, desde: t, ate: t + Math.round(leitura(texto) * 60), repeticao: x.repeticao,
        botao: x.repeticao && mec ? MECANICAS[mec]?.botao : undefined };
      this.ativos[q] = b;
      this.log.push(b);
      novos.push(b);
      this.pDe.set(b.id, x.p);
      this.vezes.set(x.fala.id, vez + 1);
      this.ultimaVez.set(x.fala.id, t);
      if (x.fala.espera !== undefined) this.poolLivre.set(pool, t + x.fala.espera * 60);
      if (mec) this.dicas.mostrou(mec, t);
      this.fila.splice(k--, 1);
    }
    return novos;
  }

  /** P de cada fala que saiu (as respostas encadeadas herdam) */
  private pDe = new Map<string, number>();

  /** -1 = não dispara; 0/1 = quem disparou (P) */
  private avaliar(fala: Fala, g: Gatilho, e: Estado, eventos: readonly string[], repeticao: boolean, t: number): number {
    let mem = this.mem.get(fala.id);
    if (!mem) this.mem.set(fala.id, (mem = {}));
    const ctx: CtxFala = { e, f: this.f, mem };
    let p = -1;
    if (g.inicio) p = e.tick < 180 ? 0 : -1;
    else if (g.evento) {
      for (const ev of eventos) {
        if (!casa(ev, g.evento)) continue;
        p = g.cond ? g.cond({ ...ctx, ev }) : quemDoEvento(ev, e, this.f);
        if (p >= 0) break;
      }
      return p;
    } else if (g.zona) {
      const [x0, x1] = g.zona;
      const dentro = [0, 1].filter((i) => { const j = e.jogadores[i]; return !j.bolha && j.x >= x0 && j.x <= x1; });
      const ok = g.ambos ? dentro.length === 2 : dentro.length > 0;
      // quem disparou: o que está mais à frente (chegou primeiro)
      p = ok ? dentro.reduce((a, i) => (e.jogadores[i].x > e.jogadores[a].x ? i : a), dentro[0]) : -1;
      if (p >= 0 && g.cond && g.cond(ctx) < 0) p = -1;
    } else if (g.ocioso !== undefined) {
      p = this.parados >= g.ocioso * 60 ? 0 : -1;
      if (p >= 0 && g.cond && g.cond(ctx) < 0) p = -1;
    } else if (g.cond) p = g.cond(ctx);
    // `por`: a condição precisa valer seguida (a repetição da dica só confere que a situação continua)
    if (g.por && !repeticao) {
      if (p < 0) { this.desde.delete(fala.id); return -1; }
      const d = this.desde.get(fala.id);
      if (d === undefined) { this.desde.set(fala.id, t); return g.por <= 0 ? p : -1; }
      if (t - d < g.por * 60) return -1;
      this.desde.delete(fala.id);
    }
    return p;
  }
}

export function falante(q: Quem, p: number): Falante {
  switch (q) {
    case 'N': return 0;
    case 'B': return 1;
    case 'L': return 2;
    case 'P': return p === 1 ? 1 : 0;
    case 'O': return p === 1 ? 0 : 1;
  }
}

export const textoDe = (t: Texto, q: Falante) => (typeof t === 'string' ? t : q === 1 ? t.B : t.N);
