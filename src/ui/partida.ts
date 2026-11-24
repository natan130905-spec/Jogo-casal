// Uma partida = uma fase em andamento: laço de quadros, simulação (anfitrião/treino) ou interpolação (convidado),
// cena 3D, controles e HUD. O fluxo cria uma Partida por capítulo e a destrói ao sair da fase.
import { DT, estadoInicial, passo } from '../core/sim';
import { instantaneo, interpolar, restaurar } from '../core/instantaneo';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from '../core/types';
import { Controles } from '../input/controles';
import type { Conexao, Mensagem } from '../net/rede';
import { EntradasDoConvidado, Preditor } from '../net/predicao';
import { Cena, type Qualidade } from '../render/cena';
import { DIAG, criarDiag, type Diag } from './diag';
import { faseDoCap } from './historia';
import { IndicadorParceiro } from './indicador';
import { som } from './som';
import { Limitador, metaDeFps } from './ritmo';
import { $, Hud, mostrarCarregando, mostrarTela, quadroPintado, type Carga } from './telas';

export type Modo = 'treino' | 'anfitriao' | 'convidado';

export interface OpcoesPartida {
  modo: Modo;
  con: Conexao | null;
  cap: number;
  qualidade: Qualidade;
  hud: Hud;
  /** anfitrião/treino: chamado uma vez, um pouco depois de os dois tocarem o pedaço da estrela */
  aoConcluir: (e: Estado) => void;
  /** dupla: o outro aparelho parou de mandar (entradas, no anfitrião; instantâneos, no convidado) por
   *  SUMIDO_MS com o jogo rodando (on), ou voltou (off). O fluxo pausa com aviso (R26). */
  aoSumir?: (on: boolean) => void;
}

/** anfitrião: a última entrada do convidado vale no máximo este número de ticks sem entrada nova (100 ms); depois
 *  vira neutra (a página dele congelou, o app foi para segundo plano sem avisar). Com a fila de até 6 entradas
 *  (MAX_FILA) e os 6 ticks que a Bruna leva para frear de 5,2 m/s, ela para em ≤ 18 ticks (0,3 s) depois da última
 *  mensagem. Contado em ticks de jogo, e não em ms reais: num aparelho lento os dois lados andam no mesmo ritmo. */
export const TICKS_ENTRADA_VALIDA = 6;
/** sem nada do outro aparelho por este tempo, com o jogo rodando: pausa com "… saiu do jogo" */
export const SUMIDO_MS = 1500;

const DEPURAR = new URLSearchParams(location.search).has('debug');

export class Partida {
  readonly fase: Fase;
  readonly cap: number;
  /** null até a montagem (em etapas, atrás da tela de carregamento) terminar */
  private cena: Cena | null = null;
  private controles: Controles | null = null;
  private estado: Estado;
  private ultimo: Estado;
  /** anfitrião: entradas do convidado, uma por tick (src/net/predicao.ts) */
  private remota = new EntradasDoConvidado();
  /** convidado: predição do próprio personagem */
  private preditor: Preditor | null = null;
  private euControlo: number;
  private buffer: { t: number; s: Estado }[] = [];
  private eventosPendentes: string[] = [];
  private eventosParaEnviar: string[] = [];
  private pausada = false;
  private vivo = true;
  private concluiuEm = 0;
  private avisou = false;
  /** gancho de teste: entradas gravadas dos dois jogadores, uma por tick (anfitrião/treino) */
  private roteiro: [Input, Input][] | null = null;
  /** gancho de teste: passos de simulação por passo de tempo (1 = tempo real) */
  private aceleracao = 1;
  /** gancho de teste: quantos eventos de cada tipo este aparelho mostrou (ex.: 'derrota', 'estrelinha') */
  private contagem: Record<string, number> = {};
  /** gancho de teste (anfitrião/treino): posições [x0, y0, x1, y1] dos últimos 512 ticks, para conferir a sincronia */
  private historico = new Float32Array(512 * 4);
  private indicador: IndicadorParceiro;
  /** painel ?diag=1 (src/ui/diag.ts) */
  private diag: Diag | null = null;
  /** dupla: quando chegou a última mensagem de jogo do outro aparelho ('in' no anfitrião, 'st' no convidado) */
  private ultimaDoOutro = 0;
  /** dupla: intervalo típico (média móvel, ms) entre as mensagens de jogo do outro aparelho */
  private intervaloDoOutro = 50;
  /** gancho de teste: tick do anfitrião quando chegou a última mensagem do outro */
  private tickUltimaDoOutro = 0;
  /** anfitrião: ticks seguidos sem entrada nova do convidado */
  private semEntrada = 0;
  private sumido = false;
  private ajustar = () => { this.cena?.redimensionar(innerWidth, innerHeight); this.indicador?.recalcular(); this.desenhouPausada = false; };
  /** pausada: a cena já foi desenhada uma vez (não precisa redesenhar até continuar ou mudar o tamanho) */
  private desenhouPausada = false;

  constructor(private o: OpcoesPartida) {
    this.cap = o.cap;
    this.fase = faseDoCap(o.cap);
    this.estado = estadoInicial(this.fase);
    this.ultimo = this.estado;
    this.euControlo = o.modo === 'convidado' ? 1 : 0;
    if (o.modo === 'convidado') this.preditor = new Preditor(this.fase, 1, (m) => o.con?.enviar({ t: 'in', i: m.i as Input, seq: m.seq, l: m.l as Input[] }));
    this.indicador = new IndicadorParceiro($('#indicador'), this.fase);
    // o gancho da partida anterior sai já (não prende a fase velha na memória, R54; os testes esperam o novo)
    delete (window as unknown as { __edm?: unknown }).__edm;
    // R33: a tela de carregamento é pintada ANTES de montar a fase; a montagem vem depois, em etapas
    mostrarTela('jogo');
    $('#bt-trocar').hidden = o.modo !== 'treino';
    this.carga = mostrarCarregando(o.cap);
    void this.montar();
  }

  /** medidas da carga (gancho de teste e painel ?diag): toque → tela pintada → pronta, em ms de performance.now() */
  readonly carga: Carga;

  private async montar() {
    const o = this.o;
    await quadroPintado();
    this.carga.pintada = performance.now();
    if (!this.vivo) return;
    // um canvas novo por fase (o contexto WebGL anterior é descartado em destruir())
    const velho = $<HTMLCanvasElement>('#canvas');
    const canvas = velho.cloneNode() as HTMLCanvasElement;
    velho.replaceWith(canvas);
    const cena = (this.cena = new Cena(canvas, this.fase, o.qualidade, { adiar: true }));
    this.ajustar();
    addEventListener('resize', this.ajustar);
    const ok = await cena.montar(this.estado, (f, etapa) => this.carga.progresso(f, etapa), () => this.vivo);
    if (!ok || !this.vivo) return;
    this.controles = new Controles($('#controles'));
    if (DIAG) this.diag = criarDiag(cena.renderer);
    // cada celular segue o próprio personagem; no treino, o controlado (⇄ troca a câmera junto)
    const seguir = () => { cena.seguir(this.euControlo); this.indicador.configurar(this.euControlo); };
    seguir();
    $('#bt-trocar').onclick = () => { this.euControlo = 1 - this.euControlo; o.hud.eu(this.euControlo); seguir(); };
    o.hud.configurar(o.cap, this.euControlo);
    som.tocarMusica(o.cap);
    // gancho de teste e depuração. roteiro/acelerar só valem no anfitrião e no treino (o convidado não simula):
    // roteiro(lista) recomeça a fase e joga as entradas gravadas (uma [P1, P2] por tick); acelerar(k) roda k passos
    // por passo de tempo, para o teste não demorar o tempo real da fase.
    (window as unknown as { __edm: unknown }).__edm = {
      estado: () => this.ultimo, modo: o.modo, cap: o.cap, info: () => cena.info(),
      /** carga desta fase: tocou, pintada, pronta (ms) e a duração de cada etapa */
      carga: () => this.carga.resumo(),
      /** câmera deste aparelho: quem segue, fração da tela de cada personagem (projetada), enquadramento e indicador */
      camera: () => ({ ...cena.medirCamera(this.ultimo), indicador: { ...this.indicador.ultimo } }),
      roteiro: (lista: [Input, Input][]) => {
        if (o.modo === 'convidado') return false;
        this.estado = estadoInicial(this.fase); this.roteiro = lista; this.acumulado = 0; this.concluiuEm = 0; this.avisou = false;
        return true;
      },
      contagem: () => ({ ...this.contagem }),
      /** dupla: intervalo típico (ms) entre as mensagens do outro aparelho e o prazo para "saiu do jogo" (R26) */
      sumico: () => ({ intervalo: this.intervaloDoOutro, prazo: Math.max(SUMIDO_MS, 8 * this.intervaloDoOutro), ultimaEm: this.ultimaDoOutro, ultimaTick: this.tickUltimaDoOutro }),
      /** ?diag=1: custo do painel por quadro (ms) e o relatório que o botão "Copiar" manda */
      diag: () => (this.diag ? { ...this.diag.custo(), gpu: this.diag.gpu, relatorio: this.diag.relatorio() } : null),
      /** programas de shader vivos (nome e começo da chave): para achar compilação no meio do jogo (R38) */
      programas: (cheia = false) => (cena.renderer.info.programs ?? []).map((p) => (cheia ? `${p.name}|${p.cacheKey}` : `${p.name} ${String(p.cacheKey).slice(0, 60)}`)),
      /** convidado: medidas da predição (reconciliações, maior erro em m, saltos, entradas sem confirmação) */
      predicao: () => (this.preditor ? { ...this.preditor.medidas } : null),
      /** posições dos dois no tick t (anfitrião/treino; só os últimos 512 ticks) */
      posicoes: (t: number) => {
        if (o.modo === 'convidado' || t < 0 || t > this.estado.tick || this.estado.tick - t >= 512) return null;
        const k = (t % 512) * 4, h = this.historico;
        return [[h[k], h[k + 1]], [h[k + 2], h[k + 3]]];
      },
      acelerar: (k: number) => { this.aceleracao = Math.max(1, Math.min(60, Math.round(k) || 1)); },
    };
    this.carga.terminar();
    this.anterior = performance.now();
    requestAnimationFrame(this.quadro);
  }

  /** Mensagens de jogo vindas da rede ('in' no anfitrião, 'st' no convidado). */
  receber(m: Mensagem) {
    if (m.t === 'in' || m.t === 'st') this.voltou();
    if (m.t === 'in') this.remota.receber(m);
    else if (m.t === 'st') {
      const s = restaurar(this.fase, m.s);
      this.buffer.push({ t: performance.now(), s });
      this.eventosPendentes.push(...s.eventos);
      this.preditor?.receber(s, m.s.sq);
      while (this.buffer.length > 8) this.buffer.shift();
    }
  }

  /** chegou mensagem de jogo do outro aparelho */
  private voltou() {
    const t = performance.now();
    if (this.ultimaDoOutro && !this.pausada) this.intervaloDoOutro += (Math.min(5000, t - this.ultimaDoOutro) - this.intervaloDoOutro) * 0.1;
    this.ultimaDoOutro = t;
    this.tickUltimaDoOutro = this.estado.tick;
    if (this.sumido) { this.sumido = false; this.o.aoSumir?.(false); }
  }

  /** Este aparelho vai para segundo plano: solta os controles (o fluxo pausa e avisa o outro). */
  soltar() { this.controles?.limpar(); }

  pausar(on: boolean) {
    this.pausada = on;
    this.desenhouPausada = false;
    // ao pausar, solta os botões, mas o joystick que continua segurado segue valendo; ao continuar, nada é solto: o
    // polegar no joystick (ou que voltou a ele durante a pausa: a sobreposta deixa o toque passar fora do cartão) já
    // vale sem levantar e tocar de novo (R27). Pausada, a entrada local é ignorada de qualquer jeito.
    if (on) { this.controles?.limpar({ manterJoystick: true }); this.remota.limpar(); }
    // o prazo de "sumiu" só conta com o jogo rodando e depois da primeira mensagem do outro
    if (!on && this.ultimaDoOutro) this.ultimaDoOutro = performance.now();
    this.preditor?.limpar();
  }

  destruir() {
    this.vivo = false;
    removeEventListener('resize', this.ajustar);
    this.indicador.esconder();
    this.carga.esconder();
    this.diag?.destruir();
    this.controles?.destruir();
    this.cena?.renderer.dispose();
    this.cena?.renderer.forceContextLoss();
  }

  /** anfitrião: a entrada do convidado para este tick; repetir a última só vale por TICKS_ENTRADA_VALIDA ticks */
  private entradaDoConvidado(): Input {
    if (this.remota.tamanho > 0) { this.semEntrada = 0; return this.remota.consumir(); }
    if (++this.semEntrada === TICKS_ENTRADA_VALIDA) this.remota.limpar();
    return this.remota.consumir();
  }

  private anterior = performance.now();
  private acumulado = 0;
  private fps = { n: 0, t: performance.now() };

  /** no máximo 60 quadros por segundo (30 com ?fps=30) mesmo em tela de 90/120 Hz (R39) */
  private limitador = new Limitador(metaDeFps());

  private quadro = (agora: number) => {
    if (!this.vivo || !this.cena || !this.controles) return;
    const cena = this.cena, controles = this.controles;
    if (!this.limitador.quadro(agora)) { requestAnimationFrame(this.quadro); return; }
    // pausada e já desenhada: não redesenha a mesma cena a cada quadro (bateria; a tela da pausa responde na hora)
    if (this.pausada && this.desenhouPausada) { this.anterior = agora; requestAnimationFrame(this.quadro); return; }
    this.desenhouPausada = this.pausada;
    const o = this.o;
    const dt = Math.min(0.1, Math.max(0, (agora - this.anterior) / 1000));
    this.anterior = agora;
    // o convidado lê a entrada uma vez por tick, dentro da predição
    const local = this.pausada || o.modo === 'convidado' ? INPUT_NEUTRO : controles.ler();
    let mostrar: Estado = this.estado;
    let eventos: string[] = [];
    const tSim = this.diag ? performance.now() : 0;

    if (o.modo === 'convidado') {
      const proprios = this.pausada ? [] : this.preditor!.quadro(dt, () => controles.ler());
      const alvo = agora - 100;
      const buf = this.buffer;
      let a = buf[0], b = buf[buf.length - 1];
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= alvo && buf[i + 1].t >= alvo) { a = buf[i]; b = buf[i + 1]; }
      if (a && b) {
        const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (alvo - a.t) / (b.t - a.t)));
        mostrar = interpolar(this.fase, a.s, b.s, k);
        eventos = [...this.preditor!.filtrarEventos(this.eventosPendentes), ...proprios]; this.eventosPendentes = [];
        this.preditor!.aplicar(mostrar, this.pausada ? 0 : dt);
        mostrar.eventos = eventos;
      } else mostrar = this.ultimo;
    } else if (!this.pausada) {
      this.acumulado += dt * this.aceleracao;
      while (this.acumulado >= DT) {
        const ent: [Input, Input] = this.roteiro ? (this.roteiro[this.estado.tick] ?? [INPUT_NEUTRO, INPUT_NEUTRO]) : o.modo === 'treino'
          ? (this.euControlo === 0 ? [local, INPUT_NEUTRO] : [INPUT_NEUTRO, local])
          : [local, this.entradaDoConvidado()];
        passo(this.fase, this.estado, ent);
        { const k = (this.estado.tick % 512) * 4, [j0, j1] = this.estado.jogadores; this.historico.set([j0.x, j0.y, j1.x, j1.y], k); }
        eventos.push(...this.estado.eventos);
        this.eventosParaEnviar.push(...this.estado.eventos);
        this.acumulado -= DT;
        if (o.modo === 'anfitriao' && this.estado.tick % 3 === 0) {
          // sq: a última entrada do convidado aplicada (sem ela no roteiro de teste, que ignora o convidado)
          o.con?.enviar({ t: 'st', s: instantaneo(this.fase, this.estado, this.eventosParaEnviar, this.roteiro ? undefined : this.remota.aplicada) });
          this.eventosParaEnviar = [];
        }
      }
      mostrar.eventos = eventos;
    } else {
      this.acumulado = 0;
      mostrar.eventos = [];
    }

    // dupla: o outro aparelho sumiu (página congelada, app em segundo plano sem aviso, sinal ruim)?
    // o prazo cresce se o outro aparelho já vinha mandando devagar (aparelho muito lento, máquina de teste sem GPU):
    // assim só a parada de verdade pausa; acima de 7 s a rede declara a conexão caída
    if (o.modo !== 'treino' && !this.pausada && !this.sumido && this.ultimaDoOutro && agora - this.ultimaDoOutro > Math.max(SUMIDO_MS, 8 * this.intervaloDoOutro)) {
      this.sumido = true;
      o.aoSumir?.(true);
    }

    const tDes = this.diag ? performance.now() : 0;
    cena.desenhar(mostrar, this.pausada ? 0 : dt);
    if (this.diag) {
      const fim = performance.now();
      this.diag.quadro(agora, tDes - tSim, fim - tDes, { qualidade: o.qualidade, ping: o.con?.ping, cargaMs: this.carga.pronta - this.carga.inicio });
    }
    this.indicador.atualizar(mostrar, eventos, cena, this.pausada ? 0 : dt);
    this.ultimo = mostrar;
    o.hud.atualizar(mostrar, eventos);
    for (const ev of eventos) { const tipo = ev.split(':')[0]; this.contagem[tipo] = (this.contagem[tipo] ?? 0) + 1; }
    som.eventos(eventos);
    // música do chefe enquanto o Rei-Pesadelo está vivo e alguém chegou perto da arena
    if ((this.fps.n & 15) === 0) {
      const rei = mostrar.inimigos.find((n) => n.tipo === 'rei' && n.vivo);
      som.tocarMusica(rei && mostrar.jogadores.some((j) => Math.abs(j.x - rei.x) < 16) ? 'chefe' : o.cap);
    }

    this.fps.n++;
    // fps, ping e contagens só com ?debug (R34: o jogador via "24 fps" e achava que estava quebrado)
    if (DEPURAR && agora - this.fps.t > 1000) {
      const inf = cena.info();
      const ping = o.con ? ` · ${Math.round(o.con.ping)} ms` : '';
      $('#hud-info').textContent = `${Math.round((this.fps.n * 1000) / (agora - this.fps.t))} fps${ping} · ${inf.chamadas} ch · ${inf.triangulos} tri`;
      this.fps = { n: 0, t: agora };
    } else if (!DEPURAR && agora - this.fps.t > 1000) this.fps = { n: 0, t: agora };

    // fim do capítulo: deixa a festa do pedaço da estrela aparecer um instante e avisa o fluxo
    if (o.modo !== 'convidado' && this.estado.concluida && !this.avisou) {
      if (!this.concluiuEm) this.concluiuEm = agora;
      else if (agora - this.concluiuEm > 1600) { this.avisou = true; o.aoConcluir(this.estado); }
    }
    requestAnimationFrame(this.quadro);
  };
}
