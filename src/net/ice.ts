// Servidores ICE (STUN e TURN) da conexão entre os dois celulares, e a escolha da política por tentativa.
//
// Por que existe (REGISTRO R91): o PeerJS 1.5.5 usa por padrão o TURN `eu-0/us-0.turn.peerjs.com`, mas esses nomes
// NÃO existem mais no DNS (consulta de 2026-11-24: sem registro A, AAAA nem CNAME). Sem TURN, entre um celular no 4G
// (NAT de operadora) e outro num Wi-Fi a conexão direta muitas vezes não passa. O STUN só descobre o endereço público;
// quem atravessa NAT simétrico é o TURN (retransmissão).
//
// De onde vêm os servidores, em ordem (os próprios primeiro):
//   1. `public/rede.json` (opcional, servido junto do jogo): { "iceServers": [...] } e/ou { "turnApi": "https://…" }
//      (turnApi = endereço que devolve a lista de servidores, como o da Metered/Open Relay:
//       https://<app>.metered.live/api/v1/turn/credentials?apiKey=<chave>);
//   2. variáveis do build: VITE_TURN_URLS (separadas por vírgula), VITE_TURN_USUARIO, VITE_TURN_SENHA, VITE_TURN_API;
//   3. STUN do Google e da Cloudflare (gratuitos, sem conta) e o TURN do PeerJS (fica na lista caso volte).
// A credencial de TURN de navegador é sempre visível para quem abre o jogo (vai para o RTCPeerConnection); por isso
// usar só credenciais feitas para o navegador (como a chave da Metered) e nunca uma chave mestra.

export const STUN_PADRAO: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
/** o padrão do PeerJS 1.5.5; sem DNS desde pelo menos 2026-11 (R91), mantido caso volte */
export const TURN_PEERJS: RTCIceServer = {
  urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp',
};
const HOSTS_TURN_MORTOS = ['eu-0.turn.peerjs.com', 'us-0.turn.peerjs.com'];

export interface ConfigRede {
  /** servidores próprios (STUN/TURN), já validados */
  proprios: RTCIceServer[];
  /** de onde vieram (para a tela "Testar conexão") */
  origem: string[];
}

const urlsDe = (s: RTCIceServer): string[] => (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string');
const ehTurn = (u: string) => /^turns?:/i.test(u);
const hostDe = (u: string) => u.replace(/^[a-z]+:/i, '').replace(/^\/\//, '').split(/[:?]/)[0].toLowerCase();

/** Valida uma lista de servidores vinda de fora (arquivo ou API): só stun:/turn:/turns:, TURN com usuário e senha. */
export function limparServidores(x: unknown): RTCIceServer[] {
  const lista = Array.isArray(x) ? x : (x && typeof x === 'object' && Array.isArray((x as { iceServers?: unknown }).iceServers))
    ? (x as { iceServers: unknown[] }).iceServers : [];
  const saida: RTCIceServer[] = [];
  for (const s of lista) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const urls = (Array.isArray(o.urls) ? o.urls : [o.urls ?? o.url]).filter((u): u is string => typeof u === 'string' && /^(stun|turns?):[^\s]+$/i.test(u))
      // a porta 53 é bloqueada pelos navegadores e só atrasa (aviso da Cloudflare)
      .filter((u) => !/:53(\?|$)/.test(u));
    if (!urls.length) continue;
    const turn = urls.some(ehTurn);
    if (turn && (typeof o.username !== 'string' || typeof o.credential !== 'string')) continue;
    saida.push(turn ? { urls, username: o.username as string, credential: o.credential as string } : { urls });
  }
  return saida;
}

/** Lista final para o RTCPeerConnection: próprios primeiro, depois STUN público e o TURN do PeerJS, sem repetir URL. */
export function montarServidores(proprios: RTCIceServer[] = []): RTCIceServer[] {
  const vistos = new Set<string>();
  const saida: RTCIceServer[] = [];
  for (const s of [...proprios, ...STUN_PADRAO, TURN_PEERJS]) {
    const urls = urlsDe(s).filter((u) => !vistos.has(u));
    if (!urls.length) continue;
    urls.forEach((u) => vistos.add(u));
    saida.push({ ...s, urls });
  }
  return saida;
}

/** Há algum TURN que possa funcionar (fora os do PeerJS sem DNS)? */
export const temTurnVivo = (servidores: RTCIceServer[]) =>
  servidores.some((s) => urlsDe(s).some((u) => ehTurn(u) && !HOSTS_TURN_MORTOS.includes(hostDe(u))));

/**
 * Política da tentativa `n` (0, 1, 2…) do convidado. A 1ª usa tudo (direta, STUN, TURN); se ela não abrir em
 * ~8 s, a 2ª obriga a retransmissão ('relay'), que atravessa NAT simétrico e alguns firewalls e não depende dos
 * candidatos "host"/"srflx" que às vezes travam a checagem. Depois alterna. Sem TURN que funcione, 'relay' não
 * gera candidato nenhum: então é sempre 'all'.
 */
export function politicaDaTentativa(n: number, servidores: RTCIceServer[]): RTCIceTransportPolicy {
  if (!temTurnVivo(servidores)) return 'all';
  return n % 2 === 1 ? 'relay' : 'all';
}

export function configRtc(servidores: RTCIceServer[], politica: RTCIceTransportPolicy = 'all'): RTCConfiguration {
  return { iceServers: servidores, iceTransportPolicy: politica, sdpSemantics: 'unified-plan' } as RTCConfiguration;
}

export type TipoCandidato = 'host' | 'srflx' | 'prflx' | 'relay';
/** Lê o tipo e o protocolo de uma linha de candidato ICE ("candidate:… udp … typ srflx …"). */
export function lerCandidato(linha: string): { tipo: TipoCandidato; protocolo: string } | null {
  const tipo = /\btyp (host|srflx|prflx|relay)\b/.exec(linha)?.[1] as TipoCandidato | undefined;
  if (!tipo) return null;
  const protocolo = (/^(?:a=)?candidate:\S+ \d+ (\w+)/i.exec(linha)?.[1] ?? '?').toLowerCase();
  return { tipo, protocolo };
}

// ---------- carregar a configuração ----------
let cache: Promise<ConfigRede> | null = null;

async function buscarJson(url: string, ms: number): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

function doBuild(): { servidores: RTCIceServer[]; api?: string } {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  const urls = String(env.VITE_TURN_URLS ?? '').split(',').map((u: string) => u.trim()).filter(Boolean);
  const servidores = urls.length ? limparServidores([{ urls, username: env.VITE_TURN_USUARIO, credential: env.VITE_TURN_SENHA }]) : [];
  return { servidores, api: env.VITE_TURN_API || undefined };
}

/** Lê rede.json e as variáveis do build (uma vez por página; no máximo ~3 s + 5 s da API, sem travar se faltar). */
export function carregarConfigRede(base = './'): Promise<ConfigRede> {
  cache ??= (async () => {
    const proprios: RTCIceServer[] = [], origem: string[] = [];
    const arq = await buscarJson(`${base}rede.json`, 3000) as { iceServers?: unknown; turnApi?: unknown } | null;
    const b = doBuild();
    if (arq?.iceServers) { const l = limparServidores(arq.iceServers); if (l.length) { proprios.push(...l); origem.push('rede.json'); } }
    if (b.servidores.length) { proprios.push(...b.servidores); origem.push('build'); }
    for (const api of [typeof arq?.turnApi === 'string' ? arq.turnApi : undefined, b.api]) {
      // só https (o celular) ou o próprio aparelho (testes locais)
      if (!api || !/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(api)) continue;
      const l = limparServidores(await buscarJson(api, 5000));
      if (l.length) { proprios.push(...l); origem.push('turnApi'); }
    }
    return { proprios, origem };
  })();
  return cache;
}
/** só para testes */
export function esquecerConfigRede() { cache = null; }
