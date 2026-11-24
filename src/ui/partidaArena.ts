// Partida da Arena do Coração (fim do capítulo 7, 3D): mesmo esquema da Partida 2.5D (src/ui/partida.ts).
// O anfitrião (ou o treino) simula a 60 Hz e manda um instantâneo a cada 3 ticks ('sta', com os eventos
// acumulados); o convidado manda a sua entrada a cada quadro ('ina') e desenha o passado recente (100 ms) interpolado.
// O desenho vem de src/render/arena/index.ts (classe CenaArena); se ele ainda não existir, usa o esboço
// src/ui/arenaEsboco.ts.
import {
  DT, ENTRADA_NEUTRA, estadoInicialArena, instantaneoArena, interpolarArena, normalizarEntradaArena, passoArena,
  restaurarArena, trocarSolo, type EntradaArena, type EstadoArena,
} from '../core/arena';
import { ControlesArena } from '../input/controlesArena';
import type { Conexao, Mensagem } from '../net/rede';
import type { Qualidade } from '../render/cena';
import { HudArena } from './hudArena';
import type { Modo } from './partida';
import { som } from './som';
import { $, mostrarTela } from './telas';

/** O que a partida usa do desenho da arena (src/render/arena). Só `yaw`, `desenhar` e `destruir` são obrigatórios. */
export interface CenaArenaApi {
  /** rotation.y da câmera (ordem 'YXZ'): o joystick é relativo a ela */
  readonly yaw: number;
  /** desenha o estado; o segundo número são os segundos desde o quadro anterior (0 na pausa) */
  desenhar(e: EstadoArena, alfa: number): void;
  destruir(): void;
  /** quem a câmera deste aparelho segue (0 Natan, 1 Bruna); a partida escreve aqui se a cena tiver o campo */
  eu?: number;
  redimensionar?(w: number, h: number): void;
  info?(): { chamadas: number; triangulos: number };
  /** se existir, a partida espera os modelos carregarem antes de começar a luta */
  pronta?: Promise<unknown>;
}
type ConstrutorCena = new (canvas: HTMLCanvasElement, qualidade: Qualidade) => CenaArenaApi;

// import.meta.glob: não quebra o build enquanto o render da arena não existir (lista vazia → esboço)
const RENDER = import.meta.glob<{ CenaArena?: ConstrutorCena }>('../render/arena/index.ts');

async function carregarCena(): Promise<ConstrutorCena> {
  const carregar = Object.values(RENDER)[0];
  if (carregar) {
    try { const m = await carregar(); if (m.CenaArena) return m.CenaArena; } catch (err) { console.warn('render da arena falhou; usando o esboço', err); }
  }
  return (await import('./arenaEsboco')).CenaArenaEsboco as unknown as ConstrutorCena;
}

export interface OpcoesPartidaArena {
  modo: Modo;
  con: Conexao | null;
  qualidade: Qualidade;
  /** anfitrião/treino: chamado uma vez, alguns segundos depois da vitória (o Rei vira vaga-lume) */
  aoVencer: (e: EstadoArena) => void;
}

/** SFX dos eventos da arena (nome do evento → arquivo em public/som). */
export const SFX_ARENA: Record<string, string> = {
  pulo: 'sfx_pulo', 'esquiva-perfeita': 'sfx_estrelinha', tiro: 'sfx_tiro', golpe: 'sfx_maos', 'acerto-rei': 'sfx_estouro',
  'tiro-pilar': 'sfx_porta', 'poder-cheio': 'sfx_estrelinha', poder: 'sfx_lanterna', 'fio-vermelho': 'sfx_corda', cura: 'sfx_bolha',
  dano: 'sfx_dano', bolha: 'sfx_bolha', renasce: 'sfx_lanterna', 'chefe-golpe': 'sfx_rei', 'chefe-fase': 'sfx_rei',
  'escudo-quebra': 'sfx_estouro', 'parede-sobe': 'sfx_porta', 'parede-cai': 'sfx_porta', cristal: 'sfx_estrelinha',
  'pilar-quebra': 'sfx_estouro', derrota: 'sfx_estouro', 'chefe-derrotado': 'sfx_pedaco_estrela', 'vaga-lume': 'sfx_estrelinha',
};

/** Roteiro compacto dos testes: [x, y, bits] por jogador (bits: 1 pulo, 2 golpe, 4 tiro, 8 esquiva, 16 poder), yaw 0. */
type Compacta = [number, number, number];
const descompactar = (c: Compacta | EntradaArena): EntradaArena => Array.isArray(c)
  ? { x: c[0], y: c[1], yaw: 0, pulo: !!(c[2] & 1), golpe: !!(c[2] & 2), tiro: !!(c[2] & 4), esquiva: !!(c[2] & 8), poder: !!(c[2] & 16) }
  : normalizarEntradaArena(c);

const BOTOES = ['pulo', 'golpe', 'tiro', 'esquiva', 'poder'] as const;
const bitsBotoes = (i: EntradaArena) => BOTOES.reduce((s, b, k) => s | (i[b] ? 1 << k : 0), 0);
/** a entrada com os botões `bits` também apertados */
const comBotoes = (i: EntradaArena, bits: number): EntradaArena => {
  if (!bits) return i;
  const o = { ...i };
  BOTOES.forEach((b, k) => { if (bits & (1 << k)) o[b] = true; });
  return o;
};

/** convidado: atraso da interpolação (6 ticks = 100 ms) */
const ATRASO_TICKS = 6;
const DEPURAR = new URLSearchParams(location.search).has('debug');
/** segundos da festa do vaga-lume antes de passar para a história */
const FESTA = 4;
/** anfitrião: quanto espera a arena do convidado carregar (o primeiro 'ina') antes de começar assim mesmo */
const ESPERA_CONVIDADO = 12000;

export class PartidaArena {
  readonly cap = 7;
  readonly arena = true;
  private cena: CenaArenaApi | null = null;
  private canvas: HTMLCanvasElement;
  private controles: ControlesArena;
  private hud = new HudArena();
  private estado: EstadoArena;
  private ultimo: EstadoArena;
  private entradaRemota: EntradaArena = ENTRADA_NEUTRA;
  /** botões do convidado apertados desde o último tick (um toque curto entre dois ticks não se perde) */
  private remotoPego = 0;
  private euControlo: 0 | 1;
  private buffer: { t: number; s: EstadoArena }[] = [];
  /** convidado: tick que está sendo mostrado (fracionário) */
  private relogioTick: number | null = null;
  private eventosPendentes: string[] = [];
  private eventosParaEnviar: string[] = [];
  private pausada = false;
  private vivo = true;
  private pronta = false;
  private convidadoPronto = false;
  private inicio = performance.now();
  private avisou = false;
  private musicaFinal = false;
  private seq = 0;
  private roteiro: EntradaArena[][] | null = null;
  private aceleracao = 1;
  private contagem: Record<string, number> = {};
  /** gancho de teste (anfitrião/treino): [x0, z0, x1, z1] dos últimos 512 ticks */
  private historico = new Float32Array(512 * 4);
  private ajustar = () => this.cena?.redimensionar?.(innerWidth, innerHeight);

  constructor(private o: OpcoesPartidaArena) {
    mostrarTela('jogo');
    $('#jogo').classList.add('arena');
    $('#dica-teclas').textContent = 'PC: WASD andar · Espaço pular · J golpe · K tiro · Shift esquiva · Q poder · Esc pausa';
    const velho = $<HTMLCanvasElement>('#canvas');
    this.canvas = velho.cloneNode() as HTMLCanvasElement;
    velho.replaceWith(this.canvas);
    this.controles = new ControlesArena($('#controles-arena'));
    this.euControlo = o.modo === 'convidado' ? 1 : 0;
    this.estado = estadoInicialArena({ treino: o.modo === 'treino', solo: this.euControlo });
    this.ultimo = this.estado;
    const bTrocar = $('#bt-trocar');
    bTrocar.hidden = o.modo !== 'treino';
    bTrocar.onclick = () => {
      trocarSolo(this.estado);
      this.euControlo = this.estado.solo;
      this.hud.eu(this.euControlo);
      if (this.cena && 'eu' in this.cena) this.cena.eu = this.euControlo;
    };
    this.hud.configurar(this.euControlo);
    som.tocarMusica('chefe');
    this.aviso('Arena do Coração', 2600);
    addEventListener('resize', this.ajustar);
    void this.montarCena();
    this.ganchos();
    requestAnimationFrame(this.quadro);
  }

  private async montarCena() {
    const C = await carregarCena();
    if (!this.vivo) return;
    const cena = new C(this.canvas, this.o.qualidade);
    if (!this.vivo) { cena.destruir(); return; }
    if ('eu' in cena) cena.eu = this.euControlo;
    this.cena = cena;
    this.ajustar();
    try { await cena.pronta; } catch { /* sem os modelos, joga com o que carregou */ }
    if (!this.vivo) return;
    this.pronta = true;
    this.anterior = performance.now();
  }

  private tAviso: ReturnType<typeof setTimeout> | undefined;
  private aviso(texto: string, ms: number) {
    const el = $('#aviso');
    el.textContent = texto; el.hidden = false;
    clearTimeout(this.tAviso);
    this.tAviso = setTimeout(() => { el.hidden = true; }, ms);
  }

  /** Gancho de teste e depuração (window.__edm), como no 2.5D. roteiro/acelerar só no anfitrião e no treino. */
  private ganchos() {
    const o = this.o;
    (window as unknown as { __edm: unknown }).__edm = {
      arena: true, cap: 7, modo: o.modo,
      estado: () => this.ultimo,
      pronta: () => this.pronta && (o.modo !== 'anfitriao' || this.convidadoPronto),
      info: () => this.cena?.info?.() ?? { chamadas: 0, triangulos: 0 },
      /** recomeça a luta e joga as entradas gravadas (uma [Natan, Bruna] por tick; aceita o formato compacto) */
      roteiro: (lista: (Compacta | EntradaArena)[][]) => {
        if (o.modo === 'convidado') return false;
        this.roteiro = lista.map((par) => par.map(descompactar));
        // os roteiros gravados jogam com o Natan no treino (solo 0)
        this.estado = estadoInicialArena({ treino: o.modo === 'treino', solo: 0 });
        this.euControlo = 0;
        this.hud.eu(this.euControlo);
        this.acumulado = 0; this.avisou = false; this.musicaFinal = false;
        som.tocarMusica('chefe');
        return true;
      },
      /** enche a barra de poder dos dois (anfitrião/treino), para conferir o aviso "Usem o poder juntos!" */
      encherPoder: () => {
        if (o.modo === 'convidado') return false;
        for (const j of this.estado.jogadores) j.poder = 100;
        return true;
      },
      acelerar: (k: number) => { this.aceleracao = Math.max(1, Math.min(60, Math.round(k) || 1)); },
      contagem: () => ({ ...this.contagem }),
      /** posições (x, z) dos dois no tick t (anfitrião/treino; só os últimos 512 ticks) */
      posicoes: (t: number) => {
        if (o.modo === 'convidado' || t < 0 || t > this.estado.tick || this.estado.tick - t >= 512) return null;
        const k = (t % 512) * 4, h = this.historico;
        return [[h[k], h[k + 1]], [h[k + 2], h[k + 3]]];
      },
    };
  }

  /** Mensagens de jogo da arena vindas da rede ('ina' no anfitrião, 'sta' no convidado). */
  receber(m: Mensagem) {
    if (m.t === 'ina') {
      this.entradaRemota = normalizarEntradaArena(m.i);
      this.remotoPego |= bitsBotoes(this.entradaRemota);
      if (!this.convidadoPronto) { this.convidadoPronto = true; this.anterior = performance.now(); this.acumulado = 0; }
    } else if (m.t === 'sta') {
      let s: EstadoArena;
      try { s = restaurarArena(m.s); } catch { return; }
      this.buffer.push({ t: performance.now(), s });
      this.eventosPendentes.push(...s.eventos);
      // o anfitrião recomeçou (tick voltou): descarta o que é de antes
      if (this.buffer.length > 1 && s.tick < this.buffer[this.buffer.length - 2].s.tick) { this.buffer = [this.buffer[this.buffer.length - 1]]; this.relogioTick = null; }
      while (this.buffer.length > 12) this.buffer.shift();
    }
  }

  pausar(on: boolean) {
    this.pausada = on;
    this.controles.limpar();
    if (on) { this.entradaRemota = ENTRADA_NEUTRA; this.remotoPego = 0; }
  }

  destruir() {
    this.vivo = false;
    clearTimeout(this.tAviso);
    $('#aviso').hidden = true;
    $('#hud-juntos').hidden = true;
    $('#jogo').classList.remove('arena');
    $('#dica-teclas').textContent = 'PC: setas/WASD andar · Espaço pular · J atirar · E mão · Esc pausa';
    removeEventListener('resize', this.ajustar);
    this.controles.destruir();
    this.cena?.destruir();
    this.cena = null;
  }

  private anterior = performance.now();
  private acumulado = 0;
  private fps = { n: 0, t: performance.now() };

  /** o anfitrião só começa a luta quando a arena dos dois aparelhos carregou (ou o convidado demorou demais) */
  private podeSimular() {
    if (!this.pronta || this.pausada) return false;
    if (this.o.modo !== 'anfitriao' || this.convidadoPronto) return true;
    return performance.now() - this.inicio > ESPERA_CONVIDADO;
  }

  private quadro = (agora: number) => {
    if (!this.vivo) return;
    const o = this.o;
    const dt = Math.min(0.1, Math.max(0, (agora - this.anterior) / 1000));
    this.anterior = agora;
    const yaw = this.cena?.yaw ?? 0;
    const local = this.pausada ? { ...ENTRADA_NEUTRA, yaw } : this.controles.ler(yaw);
    let mostrar: EstadoArena = this.estado;
    let eventos: string[] = [];

    if (o.modo === 'convidado') {
      if (this.pronta) { o.con?.enviar({ t: 'ina', i: local, seq: this.seq++ }); this.controles.consumir(); }
      // relógio de ticks do convidado: anda 60 por segundo e persegue (mais novo − 6 ticks = 100 ms de atraso).
      // Interpolar pelo tick (e não pela hora de chegada) não deforma o Corte Cometa quando os instantâneos chegam
      // em rajada (rede engasgada).
      const buf = this.buffer;
      const ultimo = buf[buf.length - 1];
      if (ultimo) {
        const alvo = ultimo.s.tick - ATRASO_TICKS;
        if (this.relogioTick === null || Math.abs(alvo - this.relogioTick) > 30) this.relogioTick = alvo;
        else if (!this.pausada) this.relogioTick += dt * 60 + (alvo - this.relogioTick) * Math.min(1, dt * 3);
        this.relogioTick = Math.min(this.relogioTick, ultimo.s.tick);
      }
      const rt = this.relogioTick ?? 0;
      let a = buf[0], b = ultimo;
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].s.tick <= rt && buf[i + 1].s.tick >= rt) { a = buf[i]; b = buf[i + 1]; }
      if (a && b) {
        const k = b.s.tick === a.s.tick ? 1 : Math.max(0, Math.min(1, (rt - a.s.tick) / (b.s.tick - a.s.tick)));
        mostrar = interpolarArena(a.s, b.s, k);
        eventos = this.eventosPendentes; this.eventosPendentes = [];
        mostrar.eventos = eventos;
      } else mostrar = this.ultimo;
    } else if (this.podeSimular()) {
      this.acumulado += dt * this.aceleracao;
      while (this.acumulado >= DT) {
        const t = this.estado.tick;
        const ent: [EntradaArena, EntradaArena] = this.roteiro
          ? ((this.roteiro[t] as [EntradaArena, EntradaArena]) ?? [ENTRADA_NEUTRA, ENTRADA_NEUTRA])
          : o.modo === 'treino'
            ? (this.estado.solo === 0 ? [local, ENTRADA_NEUTRA] : [ENTRADA_NEUTRA, local])
            : [local, comBotoes(this.entradaRemota, this.remotoPego)];
        passoArena(this.estado, ent);
        this.controles.consumir(); this.remotoPego = 0;
        { const k = (this.estado.tick % 512) * 4, [j0, j1] = this.estado.jogadores; this.historico.set([j0.x, j0.z, j1.x, j1.z], k); }
        eventos.push(...this.estado.eventos);
        this.eventosParaEnviar.push(...this.estado.eventos);
        this.acumulado -= DT;
        if (o.modo === 'anfitriao' && this.estado.tick % 3 === 0) {
          o.con?.enviar({ t: 'sta', s: instantaneoArena(this.estado, this.eventosParaEnviar) });
          this.eventosParaEnviar = [];
        }
      }
      mostrar = this.estado;
      mostrar.eventos = eventos;
    } else {
      this.acumulado = 0;
      mostrar.eventos = [];
    }

    if (this.cena) {
      if ('eu' in this.cena && this.cena.eu !== this.euControlo) this.cena.eu = this.euControlo;
      this.cena.desenhar(mostrar, this.pausada ? 0 : dt);
    }
    this.ultimo = mostrar;
    this.hud.atualizar(mostrar, eventos);
    const eu = mostrar.jogadores[this.euControlo];
    this.controles.mostrarPoder(eu.poder / 100);
    for (const ev of eventos) {
      const tipo = ev.split(':')[0];
      this.contagem[tipo] = (this.contagem[tipo] ?? 0) + 1;
      if (tipo === 'chefe-fase' && Number(ev.split(':')[1]) > 1) this.aviso(Number(ev.split(':')[1]) === 2 ? 'Névoa Teimosa: só o poder quebra o escudo!' : 'Medo de se Perder: acendam os dois cristais juntos!', 2600);
      else if (tipo === 'recomeca-fase') this.aviso('Os dois viraram bolha… de novo, juntos!', 2200);
      else if (tipo === 'fio-vermelho') this.aviso('Golpe do Fio Vermelho! ❤', 1800);
    }
    som.eventos(eventos, SFX_ARENA);
    if (mostrar.vitoria && !this.musicaFinal) { this.musicaFinal = true; som.tocarMusica('final'); }

    this.fps.n++;
    if (agora - this.fps.t > 1000) {
      const inf = this.cena?.info?.();
      const ping = o.con ? ` · ${Math.round(o.con.ping)} ms` : '';
      $('#hud-info').textContent = `${Math.round((this.fps.n * 1000) / (agora - this.fps.t))} fps${ping}${DEPURAR && inf ? ` · ${inf.chamadas} ch · ${inf.triangulos} tri` : ''}`;
      this.fps = { n: 0, t: agora };
    }

    // vitória: deixa o Rei virar vaga-lume e avisa o fluxo (quadrinhos da lembrança e o final)
    if (o.modo !== 'convidado' && this.estado.vitoria && this.estado.tVitoria >= FESTA && !this.avisou) {
      this.avisou = true;
      o.aoVencer(this.estado);
    }
    requestAnimationFrame(this.quadro);
  };
}
