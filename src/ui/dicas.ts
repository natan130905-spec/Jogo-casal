// Dicas da primeira vez (PLANO C16: um sistema só para dicas, balões e plano B). Cada mecânica nova de um capítulo
// tem uma fala `pool: 'dica'` no roteiro (src/ui/roteiro/capN.ts) com `mecanica: <id>`. Este módulo sabe quando a
// mecânica já foi usada (aí a dica não sai mais) e há quanto tempo a dica está pendente:
//   0 s  o balão da dica (roteiro)
//   20 s a mesma dica de novo, com o botão da mecânica piscando (src/ui/baloes.ts)
//   45 s "Deixa comigo" e 60 s o Atalho da Dona Lume: do companheiro (L6), que lê `nivel()`.
// Puro (sem DOM): roda igual nos dois celulares com o mesmo estado e os mesmos eventos.
import type { Estado, Fase } from '../core/types';

export interface Mecanica {
  id: string;
  nome: string;
  /** botão que pisca na repetição (seletor do DOM) */
  botao?: string;
  /** a mecânica foi usada (pelo evento do passo, olhando o estado do mesmo passo) */
  feito: (ev: string, e: Estado, f: Fase) => boolean;
  /** ou pelo estado (andar, estar em cima do trenzinho) */
  feitoEstado?: (e: Estado, f: Fase) => boolean;
  /** a dica sai quando a coisa acontece (lanterna, bolha) e conta como feita: não repete */
  aoAcontecer?: true;
}

const tipo = (ev: string) => ev.split(':')[0];
const nunca = () => false;

export const MECANICAS: Record<string, Mecanica> = {
  andar: { id: 'andar', nome: 'andar', botao: '#joystick', feito: nunca,
    feitoEstado: (e, f) => e.jogadores.some((j, i) => Math.abs(j.x - f.inicio[i].x) > 1.5) },
  pular: { id: 'pular', nome: 'pular (segurar = mais alto)', botao: '#bt-pulo', feito: (ev) => tipo(ev) === 'pulo' || tipo(ev) === 'superpulo' },
  atirar: { id: 'atirar', nome: 'atirar no bichinho', botao: '#bt-tiro', feito: (ev) => tipo(ev) === 'tiro' },
  // as que se explicam quando acontecem: a dica sai no próprio evento, uma vez
  lanterna: { id: 'lanterna', nome: 'lanterna (volta aqui)', feito: nunca, aoAcontecer: true },
  bolha: { id: 'bolha', nome: 'bolha (encostar no parceiro)', feito: nunca, aoAcontecer: true },
  placa: { id: 'placa', nome: 'placa que abre a porta', feito: (ev) => tipo(ev) === 'porta-abriu' },
  maos: { id: 'maos', nome: 'mãos dadas (impulso)', botao: '#bt-mao', feito: (ev) => tipo(ev) === 'maos' },
  puxar: { id: 'puxar', nome: 'puxar de cima pela mão', botao: '#bt-mao',
    feito: (ev, e) => tipo(ev) === 'maos' && (() => { const i = Number(ev.split(':')[1]) || 0; return e.jogadores[i].y - e.jogadores[1 - i].y > 1.5; })() },
  trem: { id: 'trem', nome: 'plataforma que anda', botao: '#bt-pulo', feito: nunca,
    feitoEstado: (e, f) => e.jogadores.some((j) => j.noChao && j.plataforma >= 0 && f.especiais?.[j.plataforma]?.tipo === 'movel') },
  marca: { id: 'marca', nome: 'marca das mãos (segredo)', botao: '#bt-mao',
    feito: (ev, e, f) => tipo(ev) === 'superpulo' && (f.marcas ?? []).some((m) => Math.abs(e.jogadores[Number(ev.split(':')[1]) || 0].x - m.x) < 3) },
  'placa-alta': { id: 'placa-alta', nome: 'placa no alto abre o portão do outro', feito: (ev) => ev === 'porta-abriu:portao' },
};

/** Mecânicas que cada capítulo ensina (cada uma precisa de uma dica no roteiro; teste em test/roteiro.test.ts). */
export const MECANICAS_CAP: Record<number, string[]> = {
  1: ['andar', 'pular', 'atirar', 'lanterna', 'bolha', 'placa', 'maos', 'puxar', 'trem', 'marca', 'placa-alta'],
};

/** Escada de ajuda, em s desde a primeira vez que a dica saiu (C16). */
export const ESCADA = Object.freeze({ repetir: 20, deixaComigo: 45, atalho: 60 });

export class Dicas {
  private feitas = new Set<string>();
  private primeira = new Map<string, number>();
  private repetidas = new Set<string>();

  constructor(private f: Fase) {}

  /** Recomeço da fase: tudo volta (o roteiro também recomeça). */
  zerar() { this.feitas.clear(); this.primeira.clear(); this.repetidas.clear(); }

  /** Eventos do passo (com o estado do mesmo passo). */
  observar(eventos: readonly string[], e: Estado) {
    for (const m of Object.values(MECANICAS)) {
      if (this.feitas.has(m.id)) continue;
      if (m.feitoEstado?.(e, this.f) || eventos.some((ev) => m.feito(ev, e, this.f))) this.feitas.add(m.id);
    }
  }

  feita(id: string) { return this.feitas.has(id); }
  /** a dica saiu (primeira vez) neste tick */
  mostrou(id: string, tick: number) {
    if (!this.primeira.has(id)) this.primeira.set(id, tick);
    if (MECANICAS[id]?.aoAcontecer) this.feitas.add(id);
  }
  /** já está na hora de repetir (20 s depois da primeira, uma vez só, se ainda não foi feita) */
  repetir(id: string, tick: number) {
    const t0 = this.primeira.get(id);
    return t0 !== undefined && !this.feitas.has(id) && !this.repetidas.has(id) && tick - t0 >= ESCADA.repetir * 60;
  }
  repetiu(id: string) { this.repetidas.add(id); }
  /** 0 nada pendente · 1 dica · 2 repetida (20 s) · 3 "deixa comigo" (45 s) · 4 atalho (60 s): para o companheiro (L6) */
  nivel(id: string, tick: number) {
    const t0 = this.primeira.get(id);
    if (t0 === undefined || this.feitas.has(id)) return 0;
    const s = (tick - t0) / 60;
    return s >= ESCADA.atalho ? 4 : s >= ESCADA.deixaComigo ? 3 : s >= ESCADA.repetir ? 2 : 1;
  }
}
