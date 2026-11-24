// Tela "Testar conexão" (R91, R92): mostra ao jogador o que este celular consegue na internet, para ele mandar um
// print se a sala não conectar: o navegador (e se é o navegador embutido de um app), a sinalização (o servidor que
// apresenta os dois celulares), os servidores ICE em uso, os tipos de caminho obtidos (host = rede local, srflx =
// endereço público pelo STUN, relay = retransmissão pelo TURN) e se a retransmissão funciona de ponta a ponta (duas
// conexões dentro do próprio aparelho, uma delas obrigada a passar pelo TURN).
import Peer from 'peerjs';
import { carregarConfigRede, configRtc, lerCandidato, montarServidores, type TipoCandidato } from '../net/ice';
import { navegadorDeApp, vereditoTeste, type ContagemCandidatos } from '../net/falhas';
import { opcoesPeer } from '../net/rede';
import { $ } from './telas';

const PRAZO_COLETA = 10000;

function campo(id: string, texto: string) { $(`#${id}`).textContent = texto; }

function nomeNavegador(ua: string): string {
  const app = navegadorDeApp(ua);
  const so = /iP(hone|ad|od)/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'outro';
  const nav = /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  return `${nav} · ${so}${app ? ` · dentro do ${app}` : ''}`;
}

/** Coleta os candidatos de um RTCPeerConnection (até terminar ou PRAZO_COLETA). */
async function coletar(servidores: RTCIceServer[], politica: RTCIceTransportPolicy) {
  const pc = new RTCPeerConnection(configRtc(servidores, politica));
  const cont: ContagemCandidatos = { host: 0, srflx: 0, prflx: 0, relay: 0 };
  const detalhes = new Set<string>();
  const fim = new Promise<void>((ok) => {
    const t = setTimeout(ok, PRAZO_COLETA);
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) { clearTimeout(t); ok(); return; }
      const c = lerCandidato(ev.candidate.candidate);
      if (!c) return;
      cont[c.tipo as TipoCandidato]++;
      const url = (ev.candidate as RTCIceCandidate & { url?: string }).url;
      if (c.tipo !== 'host') detalhes.add(`${c.tipo}/${c.protocolo}${url ? ` via ${url.replace(/\?.*/, '')}` : ''}`);
    };
  });
  pc.createDataChannel('teste');
  await pc.setLocalDescription(await pc.createOffer());
  await fim;
  pc.close();
  return { cont, detalhes: [...detalhes] };
}

/** Duas conexões no próprio aparelho, a primeira obrigada a usar o TURN: abre o canal? */
async function relayPontaAPonta(servidores: RTCIceServer[]): Promise<number | null> {
  const a = new RTCPeerConnection(configRtc(servidores, 'relay'));
  const b = new RTCPeerConnection(configRtc(servidores, 'all'));
  a.onicecandidate = (e) => { if (e.candidate) void b.addIceCandidate(e.candidate).catch(() => {}); };
  b.onicecandidate = (e) => { if (e.candidate) void a.addIceCandidate(e.candidate).catch(() => {}); };
  const t0 = performance.now();
  const canal = a.createDataChannel('relay');
  const aberto = new Promise<boolean>((ok) => { canal.onopen = () => ok(true); setTimeout(() => ok(false), PRAZO_COLETA); });
  await a.setLocalDescription(await a.createOffer());
  await b.setRemoteDescription(a.localDescription!);
  await b.setLocalDescription(await b.createAnswer());
  await a.setRemoteDescription(b.localDescription!);
  const ok = await aberto;
  a.close(); b.close();
  return ok ? Math.round(performance.now() - t0) : null;
}

let rodando = false;
/** Roda o teste e preenche a tela; devolve o texto para copiar. */
export async function testarRede(versao: string, build: string): Promise<string> {
  if (rodando) return $<HTMLTextAreaElement>('#tr-texto').value;
  rodando = true;
  try {
    for (const id of ['tr-sinal', 'tr-ice', 'tr-cand', 'tr-relay']) campo(id, '…');
    campo('tr-fim', 'Testando… (até 30 s)');
    delete $('#tr-fim').dataset.pronto;
    $<HTMLTextAreaElement>('#tr-texto').value = '';
    const ua = navigator.userAgent;
    campo('tr-nav', nomeNavegador(ua));
    const webrtc = typeof RTCPeerConnection !== 'undefined';
    const linhas = [`Entre Dois Mundos · versão ${versao} (${build}) · ${new Date().toISOString()}`, `navegador: ${nomeNavegador(ua)} · ${ua}`];
    if (!webrtc) {
      const v = vereditoTeste({ webrtc, sinalOk: false, c: { host: 0, srflx: 0, prflx: 0, relay: 0 }, relayFunciona: null });
      campo('tr-fim', v);
      linhas.push('WebRTC: não existe neste navegador', `resultado: ${v}`);
      return ($<HTMLTextAreaElement>('#tr-texto').value = linhas.join('\n'));
    }
    const cfg = await carregarConfigRede();
    const servidores = montarServidores(cfg.proprios);
    const nomes = servidores.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls])).map((u) => u.replace(/\?.*/, ''));
    campo('tr-ice', `${nomes.filter((u) => u.startsWith('stun')).length} STUN · ${nomes.filter((u) => u.startsWith('turn')).length} TURN${cfg.proprios.length ? ` (próprio: ${cfg.origem.join(', ')})` : ' (sem TURN próprio)'}`);

    // sinalização e caminhos ao mesmo tempo
    const sinal = new Promise<{ ok: boolean; ms: number; erro?: string }>((ok) => {
      const t0 = performance.now();
      const p = new Peer(opcoesPeer());
      const t = setTimeout(() => { p.destroy(); ok({ ok: false, ms: 0, erro: 'sem resposta em 10 s' }); }, PRAZO_COLETA);
      p.on('open', () => { clearTimeout(t); ok({ ok: true, ms: Math.round(performance.now() - t0) }); p.destroy(); });
      p.on('error', (e: Error & { type?: string }) => { clearTimeout(t); ok({ ok: false, ms: 0, erro: e.type ?? e.message }); p.destroy(); });
    });
    const [s, todos, soRelay] = await Promise.all([sinal, coletar(servidores, 'all'), coletar(servidores, 'relay')]);
    campo('tr-sinal', s.ok ? `ok (${s.ms} ms)` : `falhou (${s.erro})`);
    const c = todos.cont;
    c.relay = Math.max(c.relay, soRelay.cont.relay);
    campo('tr-cand', `host ${c.host} · srflx ${c.srflx} · relay ${c.relay}`);
    let relayFunciona: boolean | null = null, relayMs: number | null = null;
    if (c.relay > 0) {
      campo('tr-relay', 'testando de ponta a ponta…');
      relayMs = await relayPontaAPonta(servidores);
      relayFunciona = relayMs !== null;
      campo('tr-relay', relayFunciona ? `funciona (${relayMs} ms)` : 'tem candidato, mas não abriu');
    } else campo('tr-relay', 'nenhum servidor TURN respondeu');
    const v = vereditoTeste({ webrtc, sinalOk: s.ok, c, relayFunciona });
    campo('tr-fim', v);
    linhas.push(
      `sinalização: ${s.ok ? `ok ${s.ms} ms` : `falhou ${s.erro}`}`,
      `servidores: ${nomes.join(' ')}${cfg.origem.length ? ` (próprios de ${cfg.origem.join(', ')})` : ''}`,
      `candidatos: host ${c.host} srflx ${c.srflx} prflx ${c.prflx} relay ${c.relay}; ${[...new Set([...todos.detalhes, ...soRelay.detalhes])].join('; ') || '—'}`,
      `relay ponta a ponta: ${relayFunciona === null ? 'não testado' : relayFunciona ? `ok ${relayMs} ms` : 'falhou'}`,
      `resultado: ${v}`,
    );
    return ($<HTMLTextAreaElement>('#tr-texto').value = linhas.join('\n'));
  } finally { rodando = false; $('#tr-fim').dataset.pronto = '1'; }
}
