// Sala privada por código, via WebRTC (PeerJS). O anfitrião (quem cria a sala) roda a simulação;
// o convidado manda os comandos e recebe instantâneos. Funciona entre redes diferentes: sinalização pelo
// servidor público do PeerJS e, quando a conexão direta não passa (NAT), retransmissão pelos servidores TURN
// públicos que o PeerJS já configura.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { Input } from '../core/types';
import type { Instantaneo } from '../core/instantaneo';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PREFIXO = 'entre-dois-mundos-v1-';

export function gerarCodigo(n = 5): string {
  const v = new Uint32Array(n);
  crypto.getRandomValues(v);
  return Array.from(v, (x) => ALFABETO[x % ALFABETO.length]).join('');
}
export const normalizarCodigo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

export type Mensagem =
  | { t: 'oi'; versao: string }
  | { t: 'in'; i: Input; seq: number }
  /** instantâneo compacto do estado (anfitrião → convidado) */
  | { t: 'st'; s: Instantaneo }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number };

export interface Conexao {
  papel: 'anfitriao' | 'convidado';
  codigo: string;
  enviar(m: Mensagem): void;
  aoReceber: (m: Mensagem) => void;
  aoMudarEstado: (estado: 'aguardando' | 'conectado' | 'caiu', detalhe?: string) => void;
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

function ligar(con: Conexao, dc: DataConnection) {
  dc.on('data', (d) => con.aoReceber(d as Mensagem));
  dc.on('close', () => con.aoMudarEstado('caiu', 'o outro jogador saiu'));
  dc.on('error', (e) => con.aoMudarEstado('caiu', String(e)));
}

export function criarSala(versao: string): Promise<Conexao> {
  return new Promise((resolve, reject) => {
    const codigo = gerarCodigo();
    const peer = new Peer(PREFIXO + codigo, opcoesPeer());
    let dc: DataConnection | null = null;
    const con: Conexao = {
      papel: 'anfitriao', codigo,
      enviar: (m) => { if (dc?.open) dc.send(m); },
      aoReceber: () => {}, aoMudarEstado: () => {},
      fechar: () => { dc?.close(); peer.destroy(); },
    };
    peer.on('open', () => { resolve(con); con.aoMudarEstado('aguardando'); });
    peer.on('error', (e) => { if (!dc) reject(e); else con.aoMudarEstado('caiu', String(e)); });
    peer.on('connection', (nova) => {
      if (dc?.open) { nova.close(); return; } // sala para dois
      dc = nova;
      nova.on('open', () => { ligar(con, nova); con.aoMudarEstado('conectado'); nova.send({ t: 'oi', versao }); });
    });
  });
}

export function entrarSala(codigo: string, versao: string): Promise<Conexao> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(opcoesPeer());
    const con: Conexao = {
      papel: 'convidado', codigo,
      enviar: () => {}, aoReceber: () => {}, aoMudarEstado: () => {},
      fechar: () => peer.destroy(),
    };
    const prazo = setTimeout(() => reject(new Error('Sala não encontrada ou sem resposta.')), 15000);
    peer.on('error', (e: Error & { type?: string }) => {
      clearTimeout(prazo);
      reject(new Error(e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : String(e)));
    });
    peer.on('open', () => {
      const dc = peer.connect(PREFIXO + codigo, { reliable: true });
      dc.on('open', () => {
        clearTimeout(prazo);
        con.enviar = (m) => { if (dc.open) dc.send(m); };
        ligar(con, dc);
        resolve(con);
        con.aoMudarEstado('conectado');
        dc.send({ t: 'oi', versao });
      });
    });
  });
}
