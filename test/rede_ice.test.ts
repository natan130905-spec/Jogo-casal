// Escolha dos servidores ICE e da política por tentativa (src/net/ice.ts) e as mensagens por tipo de falha
// (src/net/falhas.ts). R91 (o TURN do PeerJS não existe mais), R92 (quem criou a sala sai do jogo), R93 (versões).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STUN_PADRAO, TURN_PEERJS, carregarConfigRede, configRtc, esquecerConfigRede, lerCandidato, limparServidores, montarServidores,
  politicaDaTentativa, temTurnVivo,
} from '../src/net/ice';
import { classificarFalha, mensagemEspera, mensagemFalha, navegadorDeApp, vereditoTeste, type Observado } from '../src/net/falhas';

const TURN_PROPRIO: RTCIceServer = { urls: ['turn:turn.exemplo.com:3478?transport=udp', 'turns:turn.exemplo.com:443?transport=tcp'], username: 'u', credential: 's' };

describe('servidores ICE', () => {
  it('sem configuração: STUN do Google e da Cloudflare + o TURN do PeerJS, e nenhum TURN "vivo"', () => {
    const l = montarServidores();
    const urls = l.flatMap((s) => [s.urls].flat());
    expect(urls).toContain('stun:stun.l.google.com:19302');
    expect(urls).toContain('stun:stun.cloudflare.com:3478');
    expect(urls).toContain('turn:eu-0.turn.peerjs.com:3478');
    expect(l).toHaveLength(STUN_PADRAO.length + 1);
    // R91: os nomes do TURN do PeerJS não têm DNS; com só eles, não há retransmissão possível
    expect(temTurnVivo(l)).toBe(false);
  });
  it('o TURN próprio vem primeiro, sem repetir URL', () => {
    const l = montarServidores([TURN_PROPRIO, { urls: 'stun:stun.cloudflare.com:3478' }]);
    expect(l[0]).toEqual(TURN_PROPRIO);
    const urls = l.flatMap((s) => [s.urls].flat());
    expect(new Set(urls).size).toBe(urls.length);
    expect(temTurnVivo(l)).toBe(true);
  });
  it('limparServidores aceita a lista da API (array ou {iceServers}), descarta lixo, TURN sem senha e a porta 53', () => {
    const api = [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'turn:global.relay.metered.ca:80', username: 'a', credential: 'b' },
      { urls: 'turn:global.relay.metered.ca:53', username: 'a', credential: 'b' },
      { urls: 'turn:sem-senha.com:3478' },
      { urls: 'http://nao-e-ice.com' },
      null, 42, 'x',
    ];
    const l = limparServidores(api);
    expect(l.map((s) => [s.urls].flat()[0])).toEqual(['stun:stun.relay.metered.ca:80', 'turn:global.relay.metered.ca:80']);
    expect(limparServidores({ iceServers: api })).toEqual(l);
    expect(limparServidores('nada')).toEqual([]);
  });
  it('política: 1ª tentativa "all", 2ª "relay" (se houver TURN que funcione), depois alterna', () => {
    const com = montarServidores([TURN_PROPRIO]);
    expect([0, 1, 2, 3].map((n) => politicaDaTentativa(n, com))).toEqual(['all', 'relay', 'all', 'relay']);
    // sem TURN vivo, 'relay' não teria candidato nenhum: sempre 'all'
    const sem = montarServidores();
    expect([0, 1, 2, 3].map((n) => politicaDaTentativa(n, sem))).toEqual(['all', 'all', 'all', 'all']);
    expect(configRtc(com, 'relay')).toMatchObject({ iceServers: com, iceTransportPolicy: 'relay' });
  });
  it('lê o tipo e o protocolo do candidato', () => {
    expect(lerCandidato('candidate:842163049 1 udp 1677729535 200.1.2.3 51234 typ srflx raddr 0.0.0.0 rport 0 generation 0'))
      .toEqual({ tipo: 'srflx', protocolo: 'udp' });
    expect(lerCandidato('candidate:1 1 TCP 2105458943 abc.local 9 typ host tcptype active')).toEqual({ tipo: 'host', protocolo: 'tcp' });
    expect(lerCandidato('a=candidate:3 1 udp 41885439 10.0.0.1 3478 typ relay raddr 1.2.3.4 rport 5')?.tipo).toBe('relay');
    expect(lerCandidato('lixo')).toBeNull();
  });
});

describe('carregarConfigRede', () => {
  afterEach(() => { vi.unstubAllGlobals(); esquecerConfigRede(); });
  it('rede.json com iceServers e turnApi: junta os dois; a API só é chamada por https ou no próprio aparelho', async () => {
    const pedidos: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      pedidos.push(url);
      if (url.endsWith('rede.json')) return new Response(JSON.stringify({ iceServers: [TURN_PROPRIO], turnApi: 'https://app.metered.live/api/v1/turn/credentials?apiKey=k' }));
      if (url.startsWith('https://app.metered.live')) return new Response(JSON.stringify([{ urls: 'turn:global.relay.metered.ca:443', username: 'x', credential: 'y' }]));
      return new Response('', { status: 404 });
    }));
    const c = await carregarConfigRede('./');
    expect(c.origem).toEqual(['rede.json', 'turnApi']);
    expect(c.proprios.map((s) => [s.urls].flat()[0])).toEqual(['turn:turn.exemplo.com:3478?transport=udp', 'turn:global.relay.metered.ca:443']);
    expect(pedidos).toHaveLength(2);
  });
  it('sem rede.json (404) ou com a rede caída: lista própria vazia, sem travar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const c = await carregarConfigRede('./');
    expect(c).toEqual({ proprios: [], origem: [] });
    const urls = (l: RTCIceServer[]) => l.flatMap((s) => [s.urls].flat());
    expect(urls(montarServidores(c.proprios))).toEqual(urls([...STUN_PADRAO, TURN_PEERJS]));
  });
  it('turnApi por http de fora é ignorada (credencial não pode ir em texto aberto)', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('rede.json') ? new Response(JSON.stringify({ turnApi: 'http://exemplo.com/api' })) : new Response('[]')));
    vi.stubGlobal('fetch', f);
    await carregarConfigRede('./');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('falhas', () => {
  const base: Observado = { sinalOk: true, salaSumiu: 0, salaSumiuNaUltima: false, respondeu: false };
  it('classifica pelo que aconteceu', () => {
    expect(classificarFalha({ ...base, semWebrtc: true })).toBe('webrtc');
    expect(classificarFalha({ ...base, sinalOk: false })).toBe('sinalizacao');
    expect(classificarFalha({ ...base, salaSumiu: 3, salaSumiuNaUltima: true })).toBe('sala');
    // a sala voltou no fim e respondeu, mas não abriu: caminho de rede
    expect(classificarFalha({ ...base, salaSumiu: 3, respondeu: true })).toBe('nat');
    // existe e não responde: o jogo de quem criou está parado em segundo plano
    expect(classificarFalha(base)).toBe('ausente');
    expect(classificarFalha({ ...base, salaSumiu: 2, salaSumiuNaUltima: false })).toBe('ausente');
  });
  it('cada tipo tem uma mensagem diferente e sem termos técnicos soltos', () => {
    const tipos = ['webrtc', 'sinalizacao', 'sala', 'ausente', 'nat', 'versao', 'cheia'] as const;
    const msgs = tipos.map(mensagemFalha);
    expect(new Set(msgs).size).toBe(tipos.length);
    expect(mensagemFalha('sala')).toMatch(/quem criou a sala precisa voltar para o jogo/);
    expect(mensagemFalha('versao')).toMatch(/versões diferentes/);
  });
  it('mensagem de espera: diz que espera quem criou a sala voltar', () => {
    expect(mensagemEspera({ ...base, salaSumiu: 1 }, 41.2)).toBe('Esperando quem criou a sala voltar para o jogo… (42 s)');
    expect(mensagemEspera(base, 50, 12)).toMatch(/Esperando quem criou a sala voltar/);
    expect(mensagemEspera(base, 58, 2)).toMatch(/Chamando/);
    expect(mensagemEspera({ ...base, sinalOk: false }, 60)).toMatch(/servidor do jogo/);
  });
  it('reconhece o navegador embutido dos apps', () => {
    expect(navegadorDeApp('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0')).toBe('Instagram');
    expect(navegadorDeApp('Mozilla/5.0 (Linux; Android 14) [FBAN/EMA;FBAV/400.0]')).toBe('Facebook');
    expect(navegadorDeApp('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36')).toBeNull();
  });
  it('veredito do teste de conexão', () => {
    const c = { host: 1, srflx: 1, prflx: 0, relay: 1 };
    expect(vereditoTeste({ webrtc: true, sinalOk: true, c, relayFunciona: true })).toMatch(/^Tudo certo/);
    expect(vereditoTeste({ webrtc: true, sinalOk: true, c: { ...c, relay: 0 }, relayFunciona: null })).toMatch(/sem retransmissão/);
    expect(vereditoTeste({ webrtc: true, sinalOk: false, c, relayFunciona: true })).toMatch(/servidor do jogo/);
  });
});
