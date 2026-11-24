// Predição local do próprio personagem no convidado (jogo 2.5D), com o anfitrião como autoridade.
//
// Antes: o convidado mandava a entrada e só via o próprio personagem se mexer quando o instantâneo do anfitrião
// voltava e era desenhado 100 ms no passado (≈ 160 ms + 2 × uma via; docs/revisao/AUDITORIA_MOVIMENTO.md §4).
//
// Agora:
// - O convidado roda os ticks dele (60 Hz) com a própria entrada, numera cada entrada (`seq`) e a guarda.
// - O anfitrião (EntradasDoConvidado) aplica as entradas do convidado UMA POR TICK, na ordem, e devolve no
//   instantâneo o `sq` da última que aplicou. Um toque curto vira pelo menos um tick com o botão apertado: não se
//   perde mais entre dois envios.
// - A cada instantâneo novo, o convidado rebobina: parte do estado do anfitrião (tick k, entradas até `sq`) e
//   reaplica as entradas que o anfitrião ainda não viu. A diferença entre o que estava na tela e o novo resultado vira
//   um desvio que some em ~80 ms (sem tranco); acima de 2,5 m (caiu, renasceu) é salto direto.
// - Só o PRÓPRIO personagem vem da predição; o parceiro, os bichinhos, as portas e o resto continuam do anfitrião,
//   interpolados no passado recente. Em cima de plataforma que se move, o personagem é desenhado relativo à
//   plataforma que está na tela (senão ficaria "adiantado" em relação a ela). Pendurado no Fio Vermelho ou em bolha,
//   quem manda no movimento é o parceiro: volta a mostrar o estado do anfitrião (com a mesma transição suave).
import { DT, normalizarInput, passo } from '../core/sim';
import { INPUT_NEUTRO, type Estado, type EstadoJogador, type Fase, type Input } from '../core/types';

/** anfitrião: no máximo esta fila de entradas do convidado (6 ticks = 100 ms); o excesso é juntado */
export const MAX_FILA = 6;
/** convidado: sem confirmação por mais que isto (anfitrião pausado, conexão parada), para de prever */
const MAX_PENDENTES = 180;
/** acima disto, o erro da predição é teletransporte (caiu, renasceu): salta em vez de deslizar */
const SALTO = 2.5;
/** rapidez com que o desvio da reconciliação some (1/s): e^(−12·0,08 s) ≈ 0,38 */
const SUAVE = 12;
/** eventos do próprio movimento que o convidado mostra na hora (da predição) em vez de esperar o anfitrião */
const EVENTOS_PROPRIOS = new Set(['pulo', 'superpulo', 'pouso', 'quique']);

/** botões apertados em qualquer uma das duas entradas (a mais nova manda no joystick); a troca de arma e o dar (L4)
 *  também não se perdem quando a fila junta entradas */
const juntarBotoes = (velha: Input, nova: Input): Input => ({
  ...nova, jump: nova.jump || velha.jump, act: nova.act || velha.act, shoot: nova.shoot || velha.shoot,
  ...(nova.troca || velha.troca ? { troca: nova.troca || velha.troca } : {}), ...(nova.dar || velha.dar ? { dar: true } : {}),
});

/** Mensagem de entrada do convidado: `i` é a entrada de número `seq`; `l` (opcional) são as entradas novas desde o
 *  último envio, em ordem, terminando em `i`. */
export interface MensagemEntrada { i: unknown; seq: number; l?: unknown[] }

/** Anfitrião: fila das entradas do convidado, consumida uma por tick. */
export class EntradasDoConvidado {
  private fila: { seq: number; i: Input }[] = [];
  private ultima: Input = INPUT_NEUTRO;
  private maior = -1;
  /** seq da última entrada aplicada (vai no instantâneo; -1 = nenhuma ainda) */
  aplicada = -1;

  receber(m: MensagemEntrada) {
    const seq = Number.isFinite(m.seq) ? Math.floor(m.seq) : -1;
    if (seq < 0) return;
    // o convidado recomeçou a contagem (fase nova do lado dele): recomeça também
    if (seq < this.maior - 600) { this.fila = []; this.maior = -1; this.aplicada = -1; }
    const lista = Array.isArray(m.l) && m.l.length ? m.l.slice(-60) : [m.i];
    const s0 = seq - lista.length + 1;
    lista.forEach((bruta, k) => {
      const s = s0 + k;
      if (s > this.maior) { this.fila.push({ seq: s, i: normalizarInput(bruta) }); this.maior = s; }
    });
    while (this.fila.length > MAX_FILA) {
      const velha = this.fila.shift()!;
      this.fila[0].i = juntarBotoes(velha.i, this.fila[0].i);
      this.aplicada = velha.seq;
    }
  }

  /** A entrada do convidado para este tick (sem entrada nova: repete a última, com os botões como estavam). */
  consumir(): Input {
    const p = this.fila.shift();
    if (p) { this.ultima = p.i; this.aplicada = p.seq; }
    return this.ultima;
  }

  /** pausa: solta tudo (a fila é descartada, mas a contagem continua) */
  limpar() {
    if (this.fila.length) this.aplicada = this.fila[this.fila.length - 1].seq;
    this.fila = []; this.ultima = INPUT_NEUTRO;
  }

  get tamanho() { return this.fila.length; }
}

/** Campos do jogador que vêm da predição (o resto — vida, estrelinhas, bolha, fio — vem do anfitrião). */
const CAMPOS_MOVIMENTO = ['x', 'y', 'vx', 'vy', 'noChao', 'olhando', 'plataforma', 'argola', 'raioArgola', 'arTicks', 'lancado'] as const;

/** Convidado: simula o próprio personagem com a própria entrada e reconcilia com o anfitrião. */
export class Preditor {
  /** número da próxima entrada */
  private seq = 0;
  private pendentes: { seq: number; i: Input }[] = [];
  private novas: Input[] = [];
  private pred: Estado | null = null;
  private base: { e: Estado; sq: number; k: number } | null = null;
  private ultimoK = -1;
  private acumulado = 0;
  private desvio = { x: 0, y: 0 };
  private comp = { x: 0, y: 0 };
  private mostrado: { x: number; y: number } | null = null;
  private usandoPredicao = false;
  private eventosLocais: string[] = [];
  /** gancho de teste: quantas reconciliações, maior erro (m) antes de suavizar, quantos saltos */
  readonly medidas = { reconciliacoes: 0, maiorErro: 0, erroMedio: 0, acima5cm: 0, saltos: 0, pendentes: 0 };

  constructor(private fase: Fase, private eu: 0 | 1, private enviar: (m: MensagemEntrada) => void) {}

  /** Instantâneo novo do anfitrião (já restaurado). Sem `sq` (anfitrião antigo ou jogando roteiro) não há predição. */
  receber(e: Estado, sq: number | undefined) {
    if (sq === undefined) { this.base = null; this.pred = null; this.pendentes = []; return; }
    if (e.tick <= this.ultimoK) return;
    this.ultimoK = e.tick;
    this.base = { e, sq, k: e.tick };
  }

  /** pausa ou volta da pausa: esquece a predição até o próximo instantâneo */
  limpar() {
    this.pendentes = []; this.novas = []; this.pred = null; this.base = null; this.acumulado = 0;
    this.desvio = { x: 0, y: 0 };
  }

  /**
   * Um quadro do convidado: roda os ticks locais (lendo a entrada uma vez por tick), reconcilia com o instantâneo
   * mais novo e manda as entradas novas. Devolve os eventos do próprio movimento gerados agora.
   */
  quadro(dt: number, ler: () => Input): string[] {
    // reconcilia primeiro (o instantâneo chegou antes deste quadro)
    if (this.base) this.reconciliar();
    this.acumulado += dt;
    let n = 0;
    while (this.acumulado >= DT && n < 12) {
      this.acumulado -= DT; n++;
      const i = ler();
      const seq = this.seq++;
      this.pendentes.push({ seq, i });
      this.novas.push(i);
      if (this.pred) {
        passo(this.fase, this.pred, this.eu === 1 ? [INPUT_NEUTRO, i] : [i, INPUT_NEUTRO]);
        if (this.usandoPredicao) for (const ev of this.pred.eventos) if (this.ehProprio(ev)) this.eventosLocais.push(ev);
      }
    }
    if (n === 12) this.acumulado = 0;
    if (this.pendentes.length > MAX_PENDENTES) { this.pendentes = this.pendentes.slice(-MAX_PENDENTES); this.pred = null; }
    this.medidas.pendentes = this.pendentes.length;
    if (this.novas.length) {
      const l = this.novas; this.novas = [];
      this.enviar({ i: l[l.length - 1], seq: this.seq - 1, l });
    }
    const k = Math.exp(-SUAVE * dt);
    this.desvio.x *= k; this.desvio.y *= k;
    const ev = this.eventosLocais; this.eventosLocais = [];
    return ev;
  }

  private ehProprio(ev: string) {
    const [tipo, quem] = ev.split(':');
    return EVENTOS_PROPRIOS.has(tipo) && Number(quem) === this.eu;
  }

  private reconciliar() {
    const b = this.base!; this.base = null;
    this.pendentes = this.pendentes.filter((p) => p.seq > b.sq);
    const antes = this.pred?.jogadores[this.eu];
    const pred = structuredClone(b.e);
    for (const p of this.pendentes) passo(this.fase, pred, this.eu === 1 ? [INPUT_NEUTRO, p.i] : [p.i, INPUT_NEUTRO]);
    pred.eventos = [];
    this.medidas.reconciliacoes++;
    if (antes) {
      const dj = pred.jogadores[this.eu];
      const ex = antes.x - dj.x, ey = antes.y - dj.y, erro = Math.hypot(ex, ey);
      const m = this.medidas;
      m.maiorErro = Math.max(m.maiorErro, erro);
      m.erroMedio += (erro - m.erroMedio) / m.reconciliacoes;
      if (erro > 0.05) m.acima5cm++;
      if (erro > SALTO) { this.desvio = { x: 0, y: 0 }; this.medidas.saltos++; } else { this.desvio.x += ex; this.desvio.y += ey; }
    }
    this.pred = pred;
  }

  /**
   * Põe o próprio personagem previsto no estado que vai ser desenhado (`mostrar`, interpolado do anfitrião).
   * Sem predição (ainda sem instantâneo com `sq`, pendurado, bolha), deixa o do anfitrião, com transição suave.
   */
  aplicar(mostrar: Estado, dt: number) {
    const real = mostrar.jogadores[this.eu];
    const p = this.pred?.jogadores[this.eu];
    const usar = !!p && !p.bolha && !real.bolha && !p.pendurado && !real.pendurado && mostrar.fio.pendurado !== this.eu;
    // plataforma que se move: a da tela está no passado; desenha o personagem relativo a ela
    let cx = 0, cy = 0;
    if (usar && p.noChao && p.plataforma >= 0) {
      const a = mostrar.especiais[p.plataforma], b = this.pred!.especiais[p.plataforma];
      if (a && b) { cx = a.x - b.x; cy = a.y - b.y; }
    }
    const f = Math.min(1, dt * 15);
    this.comp.x += (cx - this.comp.x) * f; this.comp.y += (cy - this.comp.y) * f;
    if (Math.hypot(cx - this.comp.x, cy - this.comp.y) > SALTO) this.comp = { x: cx, y: cy };
    let alvo: { x: number; y: number };
    if (usar) {
      for (const c of CAMPOS_MOVIMENTO) (real as unknown as Record<string, unknown>)[c] = (p as EstadoJogador)[c];
      alvo = { x: p.x + this.comp.x + this.desvio.x, y: p.y + this.comp.y + this.desvio.y };
    } else alvo = { x: real.x, y: real.y };
    // trocou de fonte (predição ↔ anfitrião): começa de onde estava na tela e desliza até a nova
    if (usar !== this.usandoPredicao && this.mostrado && Math.hypot(this.mostrado.x - alvo.x, this.mostrado.y - alvo.y) < SALTO) {
      this.transicao = { x: this.mostrado.x - alvo.x, y: this.mostrado.y - alvo.y };
    }
    this.usandoPredicao = usar;
    const k = Math.exp(-SUAVE * dt);
    this.transicao.x *= k; this.transicao.y *= k;
    real.x = alvo.x + this.transicao.x;
    real.y = alvo.y + this.transicao.y;
    this.mostrado = { x: real.x, y: real.y };
  }

  private transicao = { x: 0, y: 0 };

  /** Eventos do anfitrião sem os do próprio movimento (esses já saíram da predição, na hora). */
  filtrarEventos(eventos: string[]): string[] {
    return this.usandoPredicao ? eventos.filter((ev) => !this.ehProprio(ev)) : eventos;
  }
}
