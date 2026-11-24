// O que deu errado ao entrar na sala, com uma mensagem clara para cada tipo (sem PeerJS: testável no Node).
//   webrtc       este navegador não tem WebRTC (navegador de app antigo, modo restrito);
//   sinalizacao  não alcança o servidor que apresenta os dois celulares (internet deste aparelho, servidor fora do ar);
//   sala         o servidor não conhece a sala: código errado, ou quem criou saiu do jogo e o celular dele derrubou a
//                ligação com o servidor (H1, R92);
//   ausente      a sala existe mas quem criou não responde (o jogo dele está parado em segundo plano);
//   nat          os dois se acharam e combinaram, mas nenhum caminho de rede passou (NAT/firewall; falta TURN, R91);
//   versao       os dois celulares estão com versões diferentes do jogo;
//   cheia        a sala já tem duas pessoas.

export type TipoFalha = 'webrtc' | 'sinalizacao' | 'sala' | 'ausente' | 'nat' | 'versao' | 'cheia';

export interface Observado {
  semWebrtc?: boolean;
  /** o servidor de sinalização abriu para este aparelho */
  sinalOk: boolean;
  /** quantas vezes o servidor disse que a sala não existe ('peer-unavailable') */
  salaSumiu: number;
  /** a última tentativa ainda teve 'peer-unavailable'? (a sala pode ter voltado depois) */
  salaSumiuNaUltima: boolean;
  /** alguma tentativa recebeu a resposta de quem criou (SDP answer): o outro está lá e respondeu */
  respondeu: boolean;
  cheia?: boolean;
}

export function classificarFalha(o: Observado): TipoFalha {
  if (o.semWebrtc) return 'webrtc';
  if (!o.sinalOk) return 'sinalizacao';
  if (o.cheia) return 'cheia';
  if (o.respondeu) return 'nat';
  if (o.salaSumiu > 0 && o.salaSumiuNaUltima) return 'sala';
  return 'ausente';
}

export function mensagemFalha(t: TipoFalha): string {
  switch (t) {
    case 'webrtc': return 'Este navegador não deixa o jogo conectar (sem WebRTC). Abra o link no Chrome ou no Safari, não dentro do Instagram ou do Facebook.';
    case 'sinalizacao': return 'Não deu para falar com o servidor do jogo. Confira a internet deste celular e tente de novo.';
    case 'sala': return 'Sala não encontrada. Confira o código. Se ele está certo, quem criou a sala precisa voltar para o jogo e deixar a tela da sala aberta.';
    case 'ausente': return 'A sala existe, mas quem criou não respondeu. Peça para essa pessoa voltar para o jogo (sem fechar) e tente de novo.';
    case 'nat': return 'Os dois celulares se acharam, mas a internet de um deles bloqueou a conexão. Tente os dois no mesmo Wi-Fi ou toque em "Testar conexão" e mande o print.';
    case 'versao': return 'Os celulares estão com versões diferentes do jogo. Fechem o jogo nos dois e abram de novo pelo link.';
    case 'cheia': return 'Essa sala já tem duas pessoas.';
  }
}

/** Mensagem enquanto o convidado ainda tenta (segundos que faltam). */
export function mensagemEspera(o: Observado, faltam: number, passou = 0): string {
  const s = `(${Math.max(0, Math.ceil(faltam))} s)`;
  if (!o.sinalOk) return `Conectando ao servidor do jogo… ${s}`;
  if (o.respondeu) return `Achamos a sala; procurando um caminho pela internet… ${s}`;
  if (o.salaSumiu > 0) return `Esperando quem criou a sala voltar para o jogo… ${s}`;
  // a sala existe, mas ninguém responde: o jogo de quem criou está parado em segundo plano
  if (passou >= 10) return `Esperando quem criou a sala voltar para o jogo (ele precisa abrir o jogo de novo)… ${s}`;
  return `Chamando quem criou a sala… ${s}`;
}

/** Navegador embutido de app (abre o link dentro do app): alguns bloqueiam WebRTC ou o derrubam em segundo plano. */
export function navegadorDeApp(ua: string): string | null {
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'Facebook';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
  if (/\bLine\//.test(ua)) return 'Line';
  return null;
}

export interface ContagemCandidatos { host: number; srflx: number; prflx: number; relay: number }

/** Conclusão da tela "Testar conexão" a partir do que este aparelho obteve. */
export function vereditoTeste(r: { webrtc: boolean; sinalOk: boolean; c: ContagemCandidatos; relayFunciona: boolean | null }): string {
  if (!r.webrtc) return mensagemFalha('webrtc');
  if (!r.sinalOk) return 'Não alcança o servidor do jogo: sem ele não dá para criar nem entrar na sala. Confira a internet.';
  if (r.c.relay > 0 && r.relayFunciona) return 'Tudo certo: a retransmissão (TURN) funciona, então dá para jogar com cada um numa rede (Wi-Fi e 4G).';
  if (r.c.srflx > 0) return 'Conexão direta ok, mas sem retransmissão (TURN): com cada um numa rede, pode não conectar (principalmente no 4G). No mesmo Wi-Fi funciona.';
  if (r.c.host > 0) return 'Só a rede local: este aparelho não alcança o STUN. Só conecta com os dois no mesmo Wi-Fi.';
  return 'Nenhum caminho de rede: confira a internet deste celular.';
}
