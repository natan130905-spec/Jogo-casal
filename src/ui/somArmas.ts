// Sons das armas de brinquedo (L4), sintetizados na hora como o pulo (src/ui/som.ts): curtos, fofos, de desenho
// animado, nada de tiro de verdade. Cada função recebe o AudioContext já destravado e o evento (para variar por
// jogador). Variação de ±4 % no tom para não cansar.
type Ctx = AudioContext;

function saida(ctx: Ctx, vol: number) {
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(ctx.destination);
  return g;
}
const varia = () => 0.96 + Math.random() * 0.08;

/** Tom com envelope rápido e rampa de frequência. */
function tom(ctx: Ctx, destino: AudioNode, tipo: OscillatorType, f0: number, f1: number, t0: number, dur: number, vol = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(destino);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/** Ruído filtrado (sopro, corte, estalo). */
function ruido(ctx: Ctx, destino: AudioNode, t0: number, dur: number, tipo: BiquadFilterType, f0: number, f1: number, vol = 1, q = 1) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const r = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  r.buffer = buf; f.type = tipo; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  g.gain.value = vol;
  r.connect(f).connect(g).connect(destino);
  r.start(t0);
}

const quem = (ev: string) => Number(ev.split(':')[1]) || 0;

export const SONS_ARMAS: Record<string, (ctx: Ctx, ev: string) => void> = {
  /** Estilingue: o "tlec" do elástico (estalo agudo que cai) e um assobio curtinho da pedrinha. */
  estilingue(ctx, ev) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.2), b = (quem(ev) ? 1.1 : 1) * varia();
    tom(ctx, s, 'triangle', 900 * b, 260 * b, t, 0.07);
    ruido(ctx, s, t, 0.04, 'highpass', 3000, 2000, 0.6);
    tom(ctx, s, 'sine', 1400 * b, 1900 * b, t + 0.03, 0.09, 0.25);
  },
  /** Espada de papelão: "vush" de ar (ruído que sobe) com um toque de papelão batendo. */
  espada(ctx, ev) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.22), b = (quem(ev) ? 1.1 : 1) * varia();
    ruido(ctx, s, t, 0.14, 'bandpass', 700 * b, 2600 * b, 1, 1.4);
    tom(ctx, s, 'square', 180 * b, 120 * b, t + 0.05, 0.05, 0.12);
  },
  /** Martelo de brinquedo: o "pó-pó" de plástico (dois toques ocos com apito). */
  martelo(ctx, ev) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.25), b = (quem(ev) ? 1.08 : 1) * varia();
    tom(ctx, s, 'square', 520 * b, 300 * b, t, 0.07, 0.5);
    tom(ctx, s, 'sine', 1300 * b, 900 * b, t, 0.08, 0.35);
    tom(ctx, s, 'square', 600 * b, 340 * b, t + 0.1, 0.07, 0.45);
    tom(ctx, s, 'sine', 1500 * b, 1000 * b, t + 0.1, 0.08, 0.3);
  },
  /** Martelada caindo: "bum" fofo de baixo com o apito do martelo. */
  martelada(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.3);
    tom(ctx, s, 'sine', 160, 50, t, 0.25);
    ruido(ctx, s, t, 0.18, 'lowpass', 900, 200, 0.7);
    tom(ctx, s, 'sine', 1600, 1100, t + 0.02, 0.1, 0.25);
  },
  /** Alvo-sino: "dlim" com três parciais que somem devagar. */
  sino(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.18), b = varia();
    for (const [m, v, d] of [[1, 1, 0.9], [2.76, 0.4, 0.5], [5.4, 0.2, 0.3]] as const) tom(ctx, s, 'sine', 880 * b * m, 870 * b * m, t, d, v);
  },
  /** Barbante cortado: "tsic" agudo e o "plof" do pacote. */
  barbante(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.2);
    ruido(ctx, s, t, 0.05, 'highpass', 5000, 4000, 0.8);
    tom(ctx, s, 'sine', 300, 140, t + 0.25, 0.12, 0.6);
  },
  /** Bloco rachado quebrando: estalo seco e blocos caindo. */
  racha(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.28);
    ruido(ctx, s, t, 0.12, 'bandpass', 1800, 500, 1, 0.8);
    for (let k = 0; k < 3; k++) tom(ctx, s, 'triangle', 420 - k * 60, 200, t + 0.06 + k * 0.07, 0.06, 0.4);
  },
  /** Golpe que não quebra (Espada no bloco): "toc". */
  bate(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.18);
    tom(ctx, s, 'triangle', 380, 260, t, 0.06);
  },
  /** Baú aberto: arpejo brilhante subindo. */
  bau(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.16);
    [523, 659, 784, 1047].forEach((f, k) => tom(ctx, s, 'triangle', f, f, t + k * 0.07, 0.22, 0.8));
  },
  /** Troca de arma: dois cliques de mochila. */
  troca(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.12);
    tom(ctx, s, 'square', 1200, 900, t, 0.025);
    tom(ctx, s, 'square', 1500, 1100, t + 0.05, 0.025);
  },
  /** Miçangas pegas: "tlin-tlin" de contas. */
  micanga(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.12), b = varia();
    tom(ctx, s, 'sine', 1800 * b, 1700 * b, t, 0.08);
    tom(ctx, s, 'sine', 2400 * b, 2300 * b, t + 0.05, 0.08);
  },
  /** Tiro no Rei fechado: "boing" de borracha. */
  defendeu(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.16);
    tom(ctx, s, 'sine', 300, 600, t, 0.12);
    tom(ctx, s, 'sine', 600, 250, t + 0.1, 0.12, 0.6);
  },
  /** Dar ao parceiro: assobio curto de arremesso. */
  dar(ctx) {
    const t = ctx.currentTime + 0.005, s = saida(ctx, 0.14);
    tom(ctx, s, 'sine', 700, 1400, t, 0.18);
  },
};

/** Evento da simulação → nome do som sintetizado (o golpe depende da arma: `golpe:i:<id>`). */
export function somDoEvento(ev: string): string | null {
  const p = ev.split(':');
  switch (p[0]) {
    case 'tiro': return 'estilingue';
    case 'golpe': return p[2] === '2' ? 'martelo' : 'espada';
    case 'martelada': return 'martelada';
    case 'sino': case 'barbante': case 'racha': case 'bate': case 'bau': case 'troca': case 'defendeu': case 'dar': return p[0];
    case 'mochila': return 'troca';
    case 'pote': return 'micanga';
    default: return null;
  }
}
