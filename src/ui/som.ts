// Som: música de fundo (uma por tela/capítulo) e efeitos ligados aos eventos da simulação.
// Usa os arquivos de public/som. Só começa depois do primeiro toque (regra dos navegadores). Liga/desliga salvo
// no aparelho.

const SFX: Record<string, string> = {
  tiro: 'sfx_tiro', derrota: 'sfx_estouro', estrelinha: 'sfx_estrelinha', dano: 'sfx_dano', bolha: 'sfx_bolha',
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

  /** Toca os efeitos dos eventos do quadro (no máximo um de cada tipo a cada 80 ms). */
  eventos(evs: readonly string[]) {
    if (!this.ligado || !this.ctx || this.ctx.state !== 'running' || !evs.length) return;
    const agora = performance.now();
    for (const ev of evs) {
      const nome = SFX[ev.split(':')[0]];
      if (!nome || agora - (this.ultimo.get(nome) ?? 0) < 80) continue;
      this.ultimo.set(nome, agora);
      const ctx = this.ctx;
      void this.carregar(nome).then((buf) => {
        if (!buf) return;
        const src = ctx.createBufferSource(), g = ctx.createGain();
        g.gain.value = nome === 'sfx_pulo' ? 0.35 : 0.7;
        src.buffer = buf; src.connect(g).connect(ctx.destination); src.start();
      });
    }
  }
}

export const som = new Som();
