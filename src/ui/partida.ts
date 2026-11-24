// Uma partida = uma fase em andamento: laço de quadros, simulação (anfitrião/treino) ou interpolação (convidado),
// cena 3D, controles e HUD. O fluxo cria uma Partida por capítulo e a destrói ao sair da fase.
import { DT, estadoInicial, normalizarInput, passo } from '../core/sim';
import { instantaneo, interpolar, restaurar } from '../core/instantaneo';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from '../core/types';
import { Controles } from '../input/controles';
import type { Conexao, Mensagem } from '../net/rede';
import { Cena, type Qualidade } from '../render/cena';
import { faseDoCap } from './historia';
import { som } from './som';
import { $, Hud, mostrarTela } from './telas';

export type Modo = 'treino' | 'anfitriao' | 'convidado';

export interface OpcoesPartida {
  modo: Modo;
  con: Conexao | null;
  cap: number;
  qualidade: Qualidade;
  hud: Hud;
  /** anfitrião/treino: chamado uma vez, um pouco depois de os dois tocarem o pedaço da estrela */
  aoConcluir: (e: Estado) => void;
}

const DEPURAR = new URLSearchParams(location.search).has('debug');

export class Partida {
  readonly fase: Fase;
  readonly cap: number;
  private cena: Cena;
  private controles: Controles;
  private estado: Estado;
  private ultimo: Estado;
  private entradaRemota: Input = INPUT_NEUTRO;
  private euControlo: number;
  private buffer: { t: number; s: Estado }[] = [];
  private eventosPendentes: string[] = [];
  private eventosParaEnviar: string[] = [];
  private pausada = false;
  private vivo = true;
  private concluiuEm = 0;
  private avisou = false;
  private seq = 0;
  private ajustar = () => this.cena.redimensionar(innerWidth, innerHeight);

  constructor(private o: OpcoesPartida) {
    this.cap = o.cap;
    this.fase = faseDoCap(o.cap);
    mostrarTela('jogo');
    // um canvas novo por fase (o contexto WebGL anterior é descartado em destruir())
    const velho = $<HTMLCanvasElement>('#canvas');
    const canvas = velho.cloneNode() as HTMLCanvasElement;
    velho.replaceWith(canvas);
    this.cena = new Cena(canvas, this.fase, o.qualidade);
    this.ajustar();
    addEventListener('resize', this.ajustar);
    this.controles = new Controles($('#controles'));
    this.estado = estadoInicial(this.fase);
    this.ultimo = this.estado;
    this.euControlo = o.modo === 'convidado' ? 1 : 0;
    const bTrocar = $('#bt-trocar');
    bTrocar.hidden = o.modo !== 'treino';
    bTrocar.onclick = () => { this.euControlo = 1 - this.euControlo; o.hud.eu(this.euControlo); };
    o.hud.configurar(o.cap, this.euControlo);
    som.tocarMusica(o.cap);
    // gancho de teste e depuração (só leitura)
    (window as unknown as { __edm: unknown }).__edm = { estado: () => this.ultimo, modo: o.modo, cap: o.cap, info: () => this.cena.info() };
    requestAnimationFrame(this.quadro);
  }

  /** Mensagens de jogo vindas da rede ('in' no anfitrião, 'st' no convidado). */
  receber(m: Mensagem) {
    if (m.t === 'in') this.entradaRemota = normalizarInput(m.i);
    else if (m.t === 'st') {
      const s = restaurar(this.fase, m.s);
      this.buffer.push({ t: performance.now(), s });
      this.eventosPendentes.push(...s.eventos);
      while (this.buffer.length > 8) this.buffer.shift();
    }
  }

  pausar(on: boolean) {
    this.pausada = on;
    this.controles.limpar();
    if (on) this.entradaRemota = INPUT_NEUTRO;
  }

  destruir() {
    this.vivo = false;
    removeEventListener('resize', this.ajustar);
    this.controles.destruir();
    this.cena.renderer.dispose();
    this.cena.renderer.forceContextLoss();
  }

  private anterior = performance.now();
  private acumulado = 0;
  private fps = { n: 0, t: performance.now() };

  private quadro = (agora: number) => {
    if (!this.vivo) return;
    const o = this.o;
    const dt = Math.min(0.1, Math.max(0, (agora - this.anterior) / 1000));
    this.anterior = agora;
    const local = this.pausada ? INPUT_NEUTRO : this.controles.ler();
    let mostrar: Estado = this.estado;
    let eventos: string[] = [];

    if (o.modo === 'convidado') {
      o.con?.enviar({ t: 'in', i: local, seq: this.seq++ });
      const alvo = agora - 100;
      const buf = this.buffer;
      let a = buf[0], b = buf[buf.length - 1];
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= alvo && buf[i + 1].t >= alvo) { a = buf[i]; b = buf[i + 1]; }
      if (a && b) {
        const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (alvo - a.t) / (b.t - a.t)));
        mostrar = interpolar(this.fase, a.s, b.s, k);
        eventos = this.eventosPendentes; this.eventosPendentes = [];
        mostrar.eventos = eventos;
      } else mostrar = this.ultimo;
    } else if (!this.pausada) {
      this.acumulado += dt;
      while (this.acumulado >= DT) {
        const ent: [Input, Input] = o.modo === 'treino'
          ? (this.euControlo === 0 ? [local, INPUT_NEUTRO] : [INPUT_NEUTRO, local])
          : [local, this.entradaRemota];
        passo(this.fase, this.estado, ent);
        eventos.push(...this.estado.eventos);
        this.eventosParaEnviar.push(...this.estado.eventos);
        this.acumulado -= DT;
        if (o.modo === 'anfitriao' && this.estado.tick % 3 === 0) {
          o.con?.enviar({ t: 'st', s: instantaneo(this.fase, this.estado, this.eventosParaEnviar) });
          this.eventosParaEnviar = [];
        }
      }
      mostrar.eventos = eventos;
    } else {
      this.acumulado = 0;
      mostrar.eventos = [];
    }

    this.cena.desenhar(mostrar, this.pausada ? 0 : dt);
    this.ultimo = mostrar;
    o.hud.atualizar(mostrar, eventos);
    som.eventos(eventos);

    this.fps.n++;
    if (agora - this.fps.t > 1000) {
      const inf = this.cena.info();
      const ping = o.con ? ` · ${Math.round(o.con.ping)} ms` : '';
      $('#hud-info').textContent = `${Math.round((this.fps.n * 1000) / (agora - this.fps.t))} fps${ping}${DEPURAR ? ` · ${inf.chamadas} ch · ${inf.triangulos} tri` : ''}`;
      this.fps = { n: 0, t: agora };
    }

    // fim do capítulo: deixa a festa do pedaço da estrela aparecer um instante e avisa o fluxo
    if (o.modo !== 'convidado' && this.estado.concluida && !this.avisou) {
      if (!this.concluiuEm) this.concluiuEm = agora;
      else if (agora - this.concluiuEm > 1600) { this.avisou = true; o.aoConcluir(this.estado); }
    }
    requestAnimationFrame(this.quadro);
  };
}
