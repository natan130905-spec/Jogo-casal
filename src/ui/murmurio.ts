// Murmúrio dos balões (NARRATIVA_CASAL §4): sílabas sintetizadas no lugar da voz. Natan grave, Bruna aguda, Dona
// Lume no meio com um "hu" que desce no fim. Um oscilador e um filtro por balão, nenhum arquivo. O desenho das
// sílabas sai do texto (a mesma fala soa sempre igual), com 2 a 6 sílabas e no máximo ≈ 0,6 s.

const BASE = [140, 245, 200];

function semente(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Duração (s) do murmúrio de um texto (para teste). */
export function duracaoMurmurio(texto: string, quem: number) {
  const n = Math.max(2, Math.min(6, Math.round([...texto].length / 8)));
  return n * 0.085 + (quem === 2 ? 0.16 : 0);
}

export function murmurio(ctx: AudioContext, quem: number, texto: string, volume = 0.09) {
  const t0 = ctx.currentTime + 0.01;
  const n = Math.max(2, Math.min(6, Math.round([...texto].length / 8)));
  let h = semente(texto);
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'triangle';
  f.type = 'lowpass'; f.frequency.value = quem === 0 ? 900 : 1500; f.Q.value = 2;
  g.gain.value = 0.0001;
  o.connect(f).connect(g).connect(ctx.destination);
  const base = BASE[quem] ?? 200;
  let t = t0;
  for (let k = 0; k < n; k++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const tom = base * (0.88 + (h % 1000) / 1000 * 0.3) * (texto.endsWith('?') && k === n - 1 ? 1.25 : 1);
    const dur = 0.06 + ((h >>> 10) % 30) / 1000;
    o.frequency.setValueAtTime(tom, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    t += dur + 0.025;
  }
  if (quem === 2) {
    // "hu" da coruja: desce uma quinta, mais longo
    o.frequency.setValueAtTime(base * 1.1, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.73, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    t += 0.16;
  }
  o.start(t0); o.stop(t + 0.03);
}
