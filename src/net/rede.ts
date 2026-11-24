// Sala privada por código, via WebRTC (PeerJS). O anfitrião (quem cria a sala) roda a simulação e decide o fluxo
// (prólogo, mapa, fase, telas); o convidado manda os comandos e pedidos e recebe instantâneos e telas.
// Funciona entre redes diferentes: sinalização pelo servidor público do PeerJS e, quando a conexão direta não
// passa (NAT), retransmissão pelos servidores TURN públicos que o PeerJS já configura.
//
// Mensagens de fluxo (anfitrião → convidado): 'progresso', 'mapa', 'cena', 'fase', 'arena', 'pausa'.
// Jogo 2.5D: 'in' (convidado → anfitrião) e 'st'; Arena do Coração (3D): 'ina' e 'sta', no mesmo esquema.
// Pedidos (convidado → anfitrião): 'pedido' (avançar quadrinho, pular, pausar, continuar, voltar ao mapa).
// A rede mede o ping sozinha e declara a conexão caída se nada chegar por PRAZO_SILENCIO ms.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { Input } from '../core/types';
import type { Instantaneo } from '../core/instantaneo';
import type { EntradaArena, InstantaneoArena } from '../core/arena';
import type { Progresso } from '../ui/progresso';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PREFIXO = 'entre-dois-mundos-v1-';
const PRAZO_SILENCIO = 7000;
const INTERVALO_PING = 1500;

export function gerarCodigo(n = 5): string {
  const v = new Uint32Array(n);
  crypto.getRandomValues(v);
  return Array.from(v, (x) => ALFABETO[x % ALFABETO.length]).join('');
}
export const normalizarCodigo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

/** 'fuga': o Rei arranca o pedaço da estrela e foge para a Arena (cap. 7); 'creditos': depois do final */
export type NomeCena = 'prologo' | 'lembranca' | 'final' | 'concluido' | 'fuga' | 'creditos';
export type Pedido = 'avancar' | 'pular' | 'pausa' | 'continuar' | 'mapa';

export type Mensagem =
  | { t: 'oi'; versao: string }
  /** entrada do convidado número `seq`; `l` = as entradas novas desde o envio anterior, uma por tick, terminando em
   *  `i` (predição: o anfitrião aplica uma por tick, na ordem; ver src/net/predicao.ts) */
  | { t: 'in'; i: Input; seq: number; l?: Input[] }
  /** instantâneo compacto do estado (anfitrião → convidado) */
  | { t: 'st'; s: Instantaneo }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  /** progresso da campanha do anfitrião (enviado ao entrar e a cada mudança) */
  | { t: 'progresso'; p: Progresso }
  /** tela do mapa da jornada; `sel` = capítulo destacado */
  | { t: 'mapa'; p: Progresso; sel: number }
  /** cena em quadrinhos ou tela de capítulo concluído; `quadro` = quadro atual */
  | { t: 'cena'; cena: NomeCena; quadro: number; cap?: number; est?: number; total?: number }
  /** começa (ou retoma) a fase do capítulo */
  | { t: 'fase'; cap: number }
  /** começa (ou retoma) a Arena do Coração, a fase 3D do fim do capítulo 7 */
  | { t: 'arena' }
  /** arena: entrada do convidado (o primeiro 'ina' também avisa que a arena dele terminou de carregar) */
  | { t: 'ina'; i: EntradaArena; seq: number }
  /** arena: instantâneo compacto (anfitrião → convidado, a cada 3 ticks, com os eventos acumulados) */
  | { t: 'sta'; s: InstantaneoArena }
  | { t: 'pausa'; on: boolean }
  | { t: 'pedido'; acao: Pedido };

export type EstadoConexao = 'aguardando' | 'conectado' | 'caiu';

export interface Conexao {
  papel: 'anfitriao' | 'convidado';
  codigo: string;
  /** ida e volta, em ms (0 até a primeira medida) */
  readonly ping: number;
  readonly conectado: boolean;
  enviar(m: Mensagem): void;
  aoReceber: (m: Mensagem) => void;
  aoMudarEstado: (estado: EstadoConexao, detalhe?: string) => void;
  /** Depois de cair: anfitrião espera o convidado voltar; convidado liga de novo. Rejeita se não der em ~20 s. */
  reconectar(): Promise<void>;
  fechar(): void;
}

const debug = new URLSearchParams(location.search).get('debugrede') ? 2 : 0;
function opcoesPeer(): PeerOptions {
  // ?sinal=host:porta usa um servidor PeerJS próprio (testes locais); sem isso, o público.
  const sinal = new URLSearchParams(location.search).get('sinal');
  if (sinal) {
    const [host, porta] = sinal.split(':');
    return { host, port: Number(porta), path: '/', secure: false, debug };
  }
  return { debug };
}

/** Parte comum: canal atual, ping, vigia de silêncio e avisos de queda (só do canal atual). */
class Canal {
  dc: DataConnection | null = null;
  ping = 0;
  private ultimo = 0;
  private caiu = true;
  private relogio: ReturnType<typeof setInterval>;
  esperando: ((ok: boolean) => void) | null = null;

  constructor(private con: Conexao) {
    this.relogio = setInterval(() => {
      if (this.caiu || !this.dc) return;
      if (performance.now() - this.ultimo > PRAZO_SILENCIO) { this.cair('sem resposta do outro aparelho'); this.dc.close(); return; }
      this.enviar({ t: 'ping', at: performance.now() });
    }, INTERVALO_PING);
  }
  get conectado() { return !this.caiu && !!this.dc?.open; }
  enviar(m: Mensagem) { if (!this.caiu && this.dc?.open) this.dc.send(m); }
  ligar(dc: DataConnection) {
    this.dc = dc; this.caiu = false; this.ultimo = performance.now();
    dc.on('data', (d) => {
      if (this.dc !== dc) return;
      this.ultimo = performance.now();
      const m = d as Mensagem;
      if (m?.t === 'ping') { this.enviar({ t: 'pong', at: m.at }); return; }
      if (m?.t === 'pong') { this.ping = performance.now() - m.at; return; }
      this.con.aoReceber(m);
    });
    dc.on('close', () => { if (this.dc === dc) this.cair('o outro jogador saiu'); });
    dc.on('error', (e) => { if (this.dc === dc) this.cair(String(e)); });
    this.esperando?.(true); this.esperando = null;
    this.con.aoMudarEstado('conectado');
  }
  cair(det: string) { if (this.caiu) return; this.caiu = true; this.con.aoMudarEstado('caiu', det); }
  esperar(ms: number): Promise<void> {
    return new Promise((ok, falha) => {
      const prazo = setTimeout(() => { this.esperando = null; falha(new Error('O outro aparelho não respondeu.')); }, ms);
      this.esperando = (v) => { clearTimeout(prazo); if (v) ok(); };
    });
  }
  fechar() { clearInterval(this.relogio); this.caiu = true; this.dc?.close(); }
}

export function criarSala(versao: string): Promise<Conexao> {
  return new Promise((resolve, reject) => {
    const codigo = gerarCodigo();
    const peer = new Peer(PREFIXO + codigo, opcoesPeer());
    let aberta = false;
    const con: Conexao = {
      papel: 'anfitriao', codigo,
      get ping() { return canal.ping; },
      get conectado() { return canal.conectado; },
      enviar: (m) => canal.enviar(m),
      aoReceber: () => {}, aoMudarEstado: () => {},
      reconectar: () => { if (peer.disconnected && !peer.destroyed) peer.reconnect(); return canal.esperar(20000); },
      fechar: () => { canal.fechar(); peer.destroy(); },
    };
    const canal = new Canal(con);
    peer.on('open', () => { if (aberta) return; aberta = true; resolve(con); con.aoMudarEstado('aguardando'); });
    peer.on('error', (e) => { if (!aberta) reject(e); else if (!canal.conectado) { /* espera nova ligação */ } else canal.cair(String(e)); });
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (peer.disconnected && !peer.destroyed) peer.reconnect(); }, 1000); });
    peer.on('connection', (nova) => {
      if (canal.conectado) { nova.close(); return; } // sala para dois
      nova.on('open', () => { canal.ligar(nova); nova.send({ t: 'oi', versao }); });
    });
  });
}

export function entrarSala(codigo: string, versao: string): Promise<Conexao> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(opcoesPeer());
    const con: Conexao = {
      papel: 'convidado', codigo,
      get ping() { return canal.ping; },
      get conectado() { return canal.conectado; },
      enviar: (m) => canal.enviar(m),
      aoReceber: () => {}, aoMudarEstado: () => {},
      reconectar: () => {
        const espera = canal.esperar(20000);
        const ligar = () => abrir();
        if (peer.disconnected && !peer.destroyed) { peer.once('open', ligar); peer.reconnect(); } else ligar();
        return espera;
      },
      fechar: () => { canal.fechar(); peer.destroy(); },
    };
    const canal = new Canal(con);
    let primeira = true;
    const prazo = setTimeout(() => reject(new Error('Sala não encontrada ou sem resposta.')), 15000);
    const abrir = () => {
      const dc = peer.connect(PREFIXO + codigo, { reliable: true });
      dc.on('open', () => {
        clearTimeout(prazo);
        canal.ligar(dc);
        dc.send({ t: 'oi', versao });
        if (primeira) { primeira = false; resolve(con); }
      });
    };
    peer.on('error', (e: Error & { type?: string }) => {
      if (primeira) {
        clearTimeout(prazo);
        reject(new Error(e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : String(e)));
      }
    });
    peer.on('open', () => { if (primeira) abrir(); });
  });
}
