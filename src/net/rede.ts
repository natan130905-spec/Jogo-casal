// Sala privada por código, via WebRTC (PeerJS). O anfitrião (quem cria a sala) roda a simulação e decide o fluxo
// (prólogo, mapa, fase, telas); o convidado manda os comandos e pedidos e recebe instantâneos e telas.
// Entre redes diferentes (Wi-Fi × 4G): sinalização pelo servidor público do PeerJS; caminho de rede pelos servidores
// ICE de src/net/ice.ts (STUN público e o TURN que estiver configurado; o TURN padrão do PeerJS não existe mais, R91).
// Quem cria a sala sai do jogo para mandar o código (R92): a sinalização dele é renovada ao voltar, com o MESMO
// código, e o convidado insiste por até 60 s, uma tentativa nova a cada 8 s, alternando a política ICE ('all' e
// 'relay'), com a mensagem do que está acontecendo (src/net/falhas.ts).
//
// Mensagens de fluxo (anfitrião → convidado): 'salvo' (nos dois sentidos), 'mapa', 'cena', 'fase', 'arena', 'pausa'.
// Jogo 2.5D: 'in' (convidado → anfitrião) e 'st'; Arena do Coração (3D): 'ina' e 'sta', no mesmo esquema.
// Pedidos (convidado → anfitrião): 'pedido' (avançar quadrinho, pular, pausar, continuar, voltar ao mapa).
// Segundo plano (nos dois sentidos): 'ausente' (saiu do app / voltou).
// A rede mede o ping sozinha e declara a conexão caída se nada chegar por PRAZO_SILENCIO ms.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { Input } from '../core/types';
import type { Instantaneo } from '../core/instantaneo';
import type { EntradaArena, InstantaneoArena } from '../core/arena';
import type { Campanha } from '../ui/salvo';
import { carregarConfigRede, configRtc, montarServidores, politicaDaTentativa } from './ice';
import { classificarFalha, mensagemEspera, mensagemFalha, type Observado, type TipoFalha } from './falhas';

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
  /** `build`: o hash do pacote do jogo (versões diferentes nos dois celulares, R93) */
  | { t: 'oi'; versao: string; build?: string }
  /** entrada do convidado número `seq`; `l` = as entradas novas desde o envio anterior, uma por tick, terminando em
   *  `i` (predição: o anfitrião aplica uma por tick, na ordem; ver src/net/predicao.ts) */
  | { t: 'in'; i: Input; seq: number; l?: Input[] }
  /** instantâneo compacto do estado (anfitrião → convidado) */
  | { t: 'st'; s: Instantaneo }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  /** a campanha do casal (src/ui/salvo.ts): anfitrião → convidado a cada gravação (o convidado grava e funde);
   *  convidado → anfitrião ao conectar (a cópia dele) e quando a fusão dele achou algo novo. Validar com limparCampanha. */
  | { t: 'salvo'; c: Campanha }
  /** tela do mapa da jornada; `sel` = capítulo destacado; `c` = a campanha (como em 'salvo') */
  | { t: 'mapa'; c: Campanha; sel: number }
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
  /** o aparelho foi para segundo plano (on) ou voltou: o outro solta a entrada dele e pausa com aviso (R26) */
  | { t: 'ausente'; on: boolean }
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
  /** Depois de cair: anfitrião espera o convidado voltar; convidado liga de novo. Rejeita se não der em ~25 s. */
  reconectar(): Promise<void>;
  /** O app voltou do segundo plano depois de `ms` ms: renova a ligação com o servidor de sinalização (o celular
   *  pode tê-la derrubado sem aviso, e aí a sala some para quem tenta entrar, R92). */
  aoVoltarAoApp(ms: number): void;
  /** a ligação com o servidor de sinalização está aberta agora? */
  readonly sinalOk: boolean;
  /** por onde o canal passa agora (caminhoDo) */
  caminho(): Promise<string>;
  fechar(): void;
}

/** Erro de conexão com o tipo (para a mensagem e para a tela "Testar conexão"). */
export class ErroRede extends Error {
  constructor(readonly tipo: TipoFalha) { super(mensagemFalha(tipo)); }
}

const debug = new URLSearchParams(location.search).get('debugrede') ? 2 : 0;
/** quanto o convidado insiste até desistir (quem criou a sala pode estar no WhatsApp mandando o código) */
export const PRAZO_ENTRAR = 60000;
/** uma tentativa nova (outra oferta, outra política ICE) a cada INTERVALO_TENTATIVA sem abrir */
export const INTERVALO_TENTATIVA = 8000;
const MAX_TENTATIVAS_VIVAS = 6;
/** com a sala sumida do servidor (quem criou saiu do jogo), uma tentativa a cada 2,5 s */
const INTERVALO_SALA_SUMIDA = 2500;

export function opcoesPeer(config?: RTCConfiguration): PeerOptions {
  // ?sinal=host:porta usa um servidor PeerJS próprio (testes locais); sem isso, o público.
  const sinal = new URLSearchParams(location.search).get('sinal');
  const base: PeerOptions = { debug, ...(config ? { config } : {}) };
  if (sinal) {
    const [host, porta] = sinal.split(':');
    return { ...base, host, port: Number(porta), path: '/', secure: false };
  }
  return base;
}

const temWebrtc = () => typeof RTCPeerConnection !== 'undefined';
/** ?ice=relay: toda tentativa só pela retransmissão (TURN), para testar o TURN e para diagnóstico */
const soRelay = () => new URLSearchParams(location.search).get('ice') === 'relay';

/** Por onde o canal está passando agora: 'direto/udp', 'stun/udp', 'relay/udp'… (getStats do par escolhido). */
export async function caminhoDo(dc: DataConnection | null): Promise<string> {
  const pc = dc?.peerConnection;
  if (!pc) return '—';
  try {
    const st = await pc.getStats();
    let par: { localCandidateId?: string } | undefined;
    st.forEach((r) => { if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded') par = r; });
    const local = par?.localCandidateId ? st.get(par.localCandidateId) : undefined;
    if (!local) return '?';
    const tipo = local.candidateType === 'host' ? 'direto' : local.candidateType === 'relay' ? 'relay' : 'stun';
    return `${tipo}/${local.protocol ?? '?'}`;
  } catch { return '?'; }
}
async function servidoresIce(): Promise<RTCIceServer[]> {
  return montarServidores((await carregarConfigRede()).proprios);
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
    const velho = this.dc;
    this.dc = dc; this.caiu = false; this.ultimo = performance.now();
    // o mesmo convidado voltou por um canal novo: o velho (meio morto) sai sem derrubar o novo
    if (velho && velho !== dc) velho.close();
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

type ErroPeer = Error & { type?: string };

/**
 * Anfitrião. O id da sala no servidor é PREFIXO + código. A ligação com o servidor cai quando o celular põe o jogo
 * em segundo plano (o sistema mata o socket); ao cair, ou ao voltar ao app, ela é refeita com o MESMO id (o token do
 * Peer é o mesmo, então o servidor aceita mesmo antes de perceber a queda). Se o Peer morrer de vez, um novo pede o
 * mesmo id de novo a cada 3 s (o servidor só libera o id quando percebe a queda).
 */
export async function criarSala(versao: string, build = ''): Promise<Conexao> {
  if (!temWebrtc()) throw new ErroRede('webrtc');
  const servidores = await servidoresIce();
  let codigo = gerarCodigo();
  let peer: Peer | null = null;
  let fechado = false;
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const con: Conexao = {
    papel: 'anfitriao', get codigo() { return codigo; }, set codigo(_v) { /* só leitura */ },
    get ping() { return canal.ping; },
    get conectado() { return canal.conectado; },
    get sinalOk() { return !!peer?.open; },
    caminho: () => caminhoDo(canal.dc),
    enviar: (m) => canal.enviar(m),
    aoReceber: () => {}, aoMudarEstado: () => {},
    reconectar: () => { religar(); return canal.esperar(25000); },
    aoVoltarAoApp: (ms) => {
      if (fechado || !peer) return;
      if (peer.destroyed || peer.disconnected) { religar(); return; }
      // ficou fora: o socket pode estar morto sem que o navegador saiba; desliga e liga de novo (a conexão de jogo,
      // se houver, continua: o PeerJS só fecha a sinalização)
      if (ms >= 2000) { peer.disconnect(); religar(); }
    },
    fechar: () => { fechado = true; clearTimeout(relogio); canal.fechar(); peer?.destroy(); },
  };
  const canal = new Canal(con);
  const agendar = (ms: number) => { clearTimeout(relogio); relogio = setTimeout(religar, ms); };
  function religar() {
    if (fechado || !peer) return;
    if (peer.destroyed) { abrir().catch(() => agendar(3000)); return; }
    if (peer.disconnected) { try { peer.reconnect(); } catch { /* ainda conectando */ } }
  }
  const aceitar = (nova: DataConnection) => {
    // o convidado escolhe o canal: o primeiro em que ele fala (ele pode ter várias tentativas abertas)
    nova.on('data', function primeiro(d) {
      nova.off('data', primeiro);
      if (canal.conectado && canal.dc && canal.dc.peer !== nova.peer) { nova.close(); return; } // sala para dois
      if (canal.dc === nova) return;
      canal.ligar(nova);
      nova.send({ t: 'oi', versao, build } satisfies Mensagem);
      const m = d as Mensagem;
      if (m && m.t !== 'ping' && m.t !== 'pong') con.aoReceber(m);
    });
  };
  /** cria o Peer com o código atual; `novoCodigo`: se o id já for de outro, sorteia outro (só antes de a sala existir) */
  function abrir(novoCodigo = false): Promise<void> {
    return new Promise((ok, falha) => {
      let tentativasId = 0;
      const criar = () => {
        const p = new Peer(PREFIXO + codigo, opcoesPeer(configRtc(servidores)));
        peer = p;
        let abriu = false;
        p.on('open', () => { if (peer !== p) return; abriu = true; ok(); if (!canal.conectado) con.aoMudarEstado('aguardando'); });
        p.on('error', (e: ErroPeer) => {
          if (peer !== p || fechado) return;
          if (abriu) { if (p.disconnected && !p.destroyed) agendar(2000); return; }
          if (e.type === 'unavailable-id' && novoCodigo && ++tentativasId < 4) { p.destroy(); codigo = gerarCodigo(); criar(); return; }
          if (!novoCodigo) { p.destroy(); agendar(3000); return; } // o mesmo id ainda preso no servidor: insiste
          p.destroy(); falha(e.type === 'browser-incompatible' ? new ErroRede('webrtc') : new ErroRede('sinalizacao'));
        });
        p.on('disconnected', () => { if (peer === p && !fechado && !p.destroyed) agendar(800); });
        p.on('close', () => { if (peer === p && !fechado) agendar(3000); });
        p.on('connection', aceitar);
      };
      criar();
    });
  }
  await abrir(true);
  return con;
}

/** Convidado: tenta várias vezes até PRAZO_ENTRAR; `aoAviso` recebe o texto do que está acontecendo. */
export async function entrarSala(codigo: string, versao: string, build = '', aoAviso: (texto: string) => void = () => {},
  prazoMs = PRAZO_ENTRAR): Promise<Conexao> {
  if (!temWebrtc()) throw new ErroRede('webrtc');
  const servidores = await servidoresIce();
  const alvo = PREFIXO + codigo;
  const peer = new Peer(opcoesPeer(configRtc(servidores)));
  let fechado = false;
  const obs: Observado = { sinalOk: false, salaSumiu: 0, salaSumiuNaUltima: false, respondeu: false };
  let buscando: { tentar: () => void; antecipar: (ms: number) => void } | null = null;

  peer.on('open', () => { obs.sinalOk = true; buscando?.tentar(); });
  peer.on('disconnected', () => {
    if (!fechado) setTimeout(() => { if (!fechado && peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch { /* ok */ } }, 1000);
  });
  peer.on('error', (e: ErroPeer) => {
    if (e.type === 'peer-unavailable') { obs.salaSumiu++; obs.salaSumiuNaUltima = true; buscando?.antecipar(1000); }
    else if (e.type === 'browser-incompatible') obs.semWebrtc = true;
  });

  /** procura a sala até `prazo`: uma oferta nova a cada INTERVALO_TENTATIVA (ou 2 s depois de "sala não existe"),
   *  alternando a política ICE; as anteriores continuam valendo até a primeira abrir. */
  function buscar(prazo: number): Promise<DataConnection> {
    return new Promise((ok, falha) => {
      const inicio = performance.now();
      const tentativas: DataConnection[] = [];
      let n = 0, ultima = -Infinity, feito = false;
      const encerrar = () => { feito = true; buscando = null; clearInterval(relogio); };
      const vencer = (dc: DataConnection) => {
        if (feito) { if (!tentativas.includes(dc)) dc.close(); return; }
        encerrar();
        for (const t of tentativas) if (t !== dc) t.close();
        ok(dc);
      };
      const tentar = () => {
        if (feito || !peer.open) return;
        ultima = performance.now();
        obs.salaSumiuNaUltima = false;
        // a política vale para o RTCPeerConnection criado agora, dentro de connect()
        (peer.options as PeerOptions).config = configRtc(servidores, soRelay() ? 'relay' : politicaDaTentativa(n, servidores));
        const dc = peer.connect(alvo, { reliable: true, metadata: { tentativa: n } });
        n++;
        tentativas.push(dc);
        if (tentativas.length > MAX_TENTATIVAS_VIVAS) tentativas.shift()?.close();
        dc.on('open', () => vencer(dc));
      };
      const relogio = setInterval(() => {
        if (fechado) { encerrar(); falha(new ErroRede('sinalizacao')); return; }
        const agora = performance.now();
        // a resposta de quem criou chegou em alguma tentativa? então a sala existe e o problema é o caminho de rede
        if (tentativas.some((t) => t.peerConnection?.remoteDescription)) obs.respondeu = true;
        if (agora - inicio > prazo || (peer.destroyed && !obs.sinalOk)) {
          encerrar();
          for (const t of tentativas) t.close();
          falha(new ErroRede(classificarFalha(obs)));
          return;
        }
        aoAviso(mensagemEspera(obs, (prazo - (agora - inicio)) / 1000, (agora - inicio) / 1000));
        // enquanto o servidor diz que a sala não existe, pergunta mais vezes: assim que quem criou volta, entra
        const intervalo = obs.salaSumiu > 0 && !obs.respondeu ? INTERVALO_SALA_SUMIDA : INTERVALO_TENTATIVA;
        if (agora - ultima >= intervalo) tentar();
      }, 500);
      buscando = { tentar, antecipar: (ms) => { ultima = Math.min(ultima, performance.now() - INTERVALO_SALA_SUMIDA + ms); } };
      aoAviso(mensagemEspera(obs, prazo / 1000));
      tentar();
    });
  }

  const con: Conexao = {
    papel: 'convidado', codigo,
    get ping() { return canal.ping; },
    get conectado() { return canal.conectado; },
    get sinalOk() { return peer.open; },
    caminho: () => caminhoDo(canal.dc),
    enviar: (m) => canal.enviar(m),
    aoReceber: () => {}, aoMudarEstado: () => {},
    reconectar: async () => {
      if (peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch { /* ok */ }
      const dc = await buscar(25000);
      canal.ligar(dc);
      dc.send({ t: 'oi', versao, build } satisfies Mensagem);
    },
    aoVoltarAoApp: () => { if (!fechado && peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch { /* ok */ } },
    fechar: () => { fechado = true; canal.fechar(); peer.destroy(); },
  };
  const canal = new Canal(con);
  try {
    const dc = await buscar(prazoMs);
    canal.ligar(dc);
    dc.send({ t: 'oi', versao, build } satisfies Mensagem);
    return con;
  } catch (e) {
    fechado = true; peer.destroy(); canal.fechar();
    throw e;
  }
}
