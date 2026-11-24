// Som: música de fundo (uma por tela/capítulo) e efeitos ligados aos eventos da simulação.
// Usa os arquivos de public/som. Só começa depois do primeiro toque (regra dos navegadores). Liga/desliga salvo
// no aparelho. As armas de brinquedo (L4) são sintetizadas na hora (src/ui/somArmas.ts), como o pulo.
import { SONS_ARMAS, somDoEvento } from './somArmas';

const SFX: Record<string, string> = {
  derrota: 'sfx_estouro', estrelinha: 'sfx_estrelinha', dano: 'sfx_dano', bolha: 'sfx_bolha',
  lanterna: 'sfx_lanterna', 'porta-abriu': 'sfx_porta', pedaco: 'sfx_pedaco_estrela', maos: 'sfx_maos',
  pulo: 'sfx_pulo', superpulo: 'sfx_pulo', 'fio-preso': 'sfx_corda', 'ponto-fraco': 'sfx_rei', 'chefe-derrotado': 'sfx_rei',
};
const MUSICA_CAP = ['cap1_brinquedos', 'cap2_floresta', 'cap3_relogio', 'cap4_oceano', 'cap5_doces', 'cap6_espelhos', 'cap7_cosmos'];
const CHAVE = 'edm-som';

class Som {
  ligado = (() => { try { return localStorage.getItem(CHAVE) !== '0'; } catch { return true; } })();
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private musica: HTMLAudioElement | null = null;
  private faixa = '';
  private ultimo = new Map<string, number>();

  /** Chamar num toque do usuário (desbloqueia o áudio). */
  destravar() {
    if (!this.ctx) { try { this.ctx = new AudioContext(); } catch { return; } }
    void this.ctx.resume().catch(() => {});
    if (this.musica && this.ligado && this.musica.paused) void this.musica.play().catch(() => {});
  }

  /** App em segundo plano (R39): para a música e suspende o AudioContext (não gasta bateria nem toca escondido). */
  suspender() {
    this.musica?.pause();
    void this.ctx?.suspend().catch(() => {});
  }

  /** Volta do segundo plano: retoma o que estava ligado. */
  retomar() {
    if (!this.ligado) return;
    void this.ctx?.resume().catch(() => {});
    if (this.musica?.paused) void this.musica.play().catch(() => {});
  }

  /** O AudioContext, se o som está ligado e rodando (efeitos sintetizados de fora, como o murmúrio dos balões). */
  contexto(): AudioContext | null {
    return this.ligado && this.ctx?.state === 'running' ? this.ctx : null;
  }

  alternar() {
    this.ligado = !this.ligado;
    try { localStorage.setItem(CHAVE, this.ligado ? '1' : '0'); } catch { /* sem armazenamento */ }
    if (!this.ligado) this.musica?.pause(); else void this.musica?.play().catch(() => {});
  }

  /** Troca a música: 'menu', 'final', 'chefe' ou o número do capítulo. */
  tocarMusica(qual: 'menu' | 'final' | 'chefe' | number) {
    const nome = typeof qual === 'number' ? MUSICA_CAP[qual - 1] ?? 'menu' : qual;
    if (nome === this.faixa) return;
    this.faixa = nome;
    this.musica?.pause();
    const a = new Audio(`./som/musica_${nome}.mp3`);
    a.loop = true; a.volume = 0.45; a.preload = 'auto';
    this.musica = a;
    if (this.ligado) void a.play().catch(() => {});
  }

  private carregar(nome: string) {
    let p = this.buffers.get(nome);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`./som/${nome}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).catch(() => null);
      this.buffers.set(nome, p);
    }
    return p;
  }

  /** Toca os efeitos dos eventos do quadro (no máximo um de cada tipo a cada 80 ms). `tabela`: evento → arquivo
   *  (a arena tem a sua; o padrão é a do 2.5D). */
  eventos(evs: readonly string[], tabela: Record<string, string> = SFX) {
    if (!this.ligado || !this.ctx || this.ctx.state !== 'running' || !evs.length) return;
    const agora = performance.now();
    for (const ev of evs) {
      // armas (só no 2.5D; a arena tem a tabela dela)
      const sint = tabela === SFX ? somDoEvento(ev) : null;
      if (sint) {
        if (agora - (this.ultimo.get(sint) ?? 0) < 80) continue;
        this.ultimo.set(sint, agora);
        try { SONS_ARMAS[sint](this.ctx, ev); } catch { /* áudio indisponível */ }
        continue;
      }
      const nome = tabela[ev.split(':')[0]];
      if (!nome || agora - (this.ultimo.get(nome) ?? 0) < 80) continue;
      this.ultimo.set(nome, agora);
      const ctx = this.ctx;
      // Pulo: sintetizado (curto e fofo). O arquivo antigo durava 1 s e soava estranho.
      if (nome === 'sfx_pulo') { pulo(ctx, Number(ev.split(':')[1]) || 0, ev.startsWith('superpulo')); continue; }
      void this.carregar(nome).then((buf) => {
        if (!buf) return;
        const src = ctx.createBufferSource(), g = ctx.createGain();
        g.gain.value = nome === 'sfx_pulo' ? 0.35 : 0.7;
        src.buffer = buf; src.connect(g).connect(ctx.destination); src.start();
      });
    }
  }
}

/** "Puín" de desenho animado: subida rápida de tom (seno + um pouco de triângulo), ~0,16 s, com um sopro suave.
 *  Natan (0) um pouco mais grave, Bruna (1) mais aguda; o superpulo sobe mais e dura um pouco mais.
 *  Variação de ±4 % no tom para não cansar. */
export function pulo(ctx: AudioContext, quem: number, superpulo = false) {
  const t0 = ctx.currentTime + 0.005;
  const dur = superpulo ? 0.26 : 0.16;
  const base = (quem === 1 ? 520 : 400) * (0.96 + Math.random() * 0.08);
  const fim = base * (superpulo ? 2.6 : 1.9);
  const saida = ctx.createGain();
  saida.gain.value = 0.22;
  saida.connect(ctx.destination);

  for (const [tipo, vol] of [['sine', 1], ['triangle', 0.25]] as const) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(fim, t0 + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(saida);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // sopro: ruído filtrado bem baixinho
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const r = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gr = ctx.createGain();
  r.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.8; gr.gain.value = 0.12;
  r.connect(f).connect(gr).connect(saida);
  r.start(t0);
}

export const som = new Som();
