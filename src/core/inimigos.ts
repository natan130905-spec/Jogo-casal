// Bichinhos-pesadelo: emburrados e engraçados. Derrotá-los "devolve a lembrança" (estouram em brilho e soltam
// uma estrelinha). Tudo determinístico: só relógios internos, sem sorteio.
import { moverEixo, pontoDentro } from './colisao';
import type { DefInimigo, Esporo, EstadoInimigo, EstadoJogador, Fase, Retangulo, TipoInimigo } from './types';

export const DT = 1 / 60;

export const INIMIGO: Readonly<Record<TipoInimigo, { w: number; h: number; vida: number; vel: number }>> = Object.freeze({
  bolotinha: { w: 0.8, h: 0.7, vida: 1, vel: 1.2 },
  morcego: { w: 0.8, h: 0.5, vida: 1, vel: 1.6 },
  cogumelo: { w: 0.9, h: 0.9, vida: 2, vel: 0 },
  espinhudo: { w: 0.9, h: 0.8, vida: 2, vel: 0.8 },
  rei: { w: 2.4, h: 2.8, vida: 20, vel: 1.5 },
});

export const COGUMELO = Object.freeze({ intervalo: 2.6, alcance: 9, velEsporo: 2.2, vidaEsporo: 4.5 });
/** Rei-Pesadelo: por fase de ataque (1–3): tempo atacando, tempo com o ponto fraco à mostra, velocidade, intervalo de cuspe, esporos por cuspe */
export const REI = Object.freeze({
  fases: [
    { ataque: 4, aberto: 2.6, vel: 1.5, cuspe: 1.6, leque: 1, pulo: 0 },
    { ataque: 3.5, aberto: 2.3, vel: 2.2, cuspe: 1.3, leque: 3, pulo: 0 },
    { ataque: 3, aberto: 2.0, vel: 3.0, cuspe: 1.0, leque: 3, pulo: 2 },
  ],
  /** vida em que muda para a fase 2 e para a fase 3 */
  limites: [14, 7],
  velEsporo: 3.2,
});

export function inimigosIniciais(fase: Fase): EstadoInimigo[] {
  return (fase.inimigos ?? []).map((d) => ({
    tipo: d.tipo, x: d.x, y: d.y, vx: 0, vy: 0, vida: INIMIGO[d.tipo].vida, vivo: true,
    dir: d.dir ?? -1, noChao: false, t: 0, fase: 1, aberto: false,
  }));
}

export const caixaInimigo = (n: EstadoInimigo): Retangulo => {
  const m = INIMIGO[n.tipo];
  return { x: n.x - m.w / 2, y: n.y, w: m.w, h: m.h };
};

function andarilho(n: EstadoInimigo, sol: readonly Retangulo[], vel: number) {
  const m = INIMIGO[n.tipo];
  // vira na beira (sem chão à frente) e na parede
  if (n.noChao) {
    const frente = n.x + n.dir * (m.w / 2 + 0.1);
    const temChao = sol.some((r) => pontoDentro(r, frente, n.y - 0.1));
    if (!temChao) n.dir = n.dir === 1 ? -1 : 1;
  }
  n.vx = n.dir * vel;
  n.vy = Math.max(-18, n.vy - 30 * DT);
  n.noChao = false;
  if (moverEixo(n, m.w, m.h, sol, n.vx * DT, 0)) n.dir = n.dir === 1 ? -1 : 1;
  moverEixo(n, m.w, m.h, sol, 0, n.vy * DT);
}

function maisPerto(n: EstadoInimigo, jogadores: readonly EstadoJogador[]): EstadoJogador | null {
  let melhor: EstadoJogador | null = null, dMelhor = Infinity;
  for (const j of jogadores) {
    if (j.bolha) continue;
    const d = Math.abs(j.x - n.x) + Math.abs(j.y - n.y) * 0.5;
    if (d < dMelhor) { dMelhor = d; melhor = j; }
  }
  return melhor;
}

/** Avança todos os bichinhos um passo. */
export function passoInimigos(fase: Fase, inimigos: EstadoInimigo[], sol: readonly Retangulo[], jogadores: readonly EstadoJogador[], esporos: Esporo[], eventos: string[]) {
  const defs = fase.inimigos ?? [];
  for (let k = 0; k < inimigos.length; k++) {
    const n = inimigos[k], d: DefInimigo = defs[k];
    if (!n.vivo) continue;
    n.t += DT;
    switch (n.tipo) {
      case 'bolotinha':
      case 'espinhudo':
        andarilho(n, sol, INIMIGO[n.tipo].vel);
        break;
      case 'morcego': {
        const alc = d.alcance ?? 3;
        n.vx = n.dir * INIMIGO.morcego.vel;
        n.x += n.vx * DT;
        if (n.x > d.x + alc) { n.x = d.x + alc; n.dir = -1; }
        if (n.x < d.x - alc) { n.x = d.x - alc; n.dir = 1; }
        n.y = d.y + Math.sin(n.t * 2.5) * 0.6;
        break;
      }
      case 'cogumelo': {
        const alvo = maisPerto(n, jogadores);
        if (alvo) n.dir = alvo.x >= n.x ? 1 : -1;
        if (n.t >= COGUMELO.intervalo) {
          n.t = 0;
          if (alvo && Math.abs(alvo.x - n.x) <= COGUMELO.alcance && Math.abs(alvo.y - n.y) < 4) {
            esporos.push({ x: n.x + n.dir * 0.4, y: n.y + 0.6, vx: n.dir * COGUMELO.velEsporo, vy: 0, t: COGUMELO.vidaEsporo });
            eventos.push(`esporo:${k}`);
          }
        }
        break;
      }
      case 'rei': passoRei(n, k, d, sol, jogadores, esporos, eventos); break;
    }
    if (n.y < fase.fundo) n.vivo = false; // caiu no vão: some sem estrelinha
  }
}

function passoRei(n: EstadoInimigo, k: number, d: DefInimigo, sol: readonly Retangulo[], jogadores: readonly EstadoJogador[], esporos: Esporo[], eventos: string[]) {
  const f = REI.fases[n.fase - 1];
  const m = INIMIGO.rei;
  const alc = d.alcance ?? 6;
  if (n.aberto) {
    n.vx = 0;
    if (n.t >= f.aberto) { n.aberto = false; n.t = 0; eventos.push(`fecha:${k}`); }
  } else {
    // anda pela arena, cospe esporos em leque na direção do jogador mais perto, pula na fase 3
    const alvo = maisPerto(n, jogadores);
    if (n.x >= d.x + alc) n.dir = -1;
    else if (n.x <= d.x - alc) n.dir = 1;
    n.vx = n.dir * f.vel;
    const antes = Math.floor((n.t - DT) / f.cuspe), agora = Math.floor(n.t / f.cuspe);
    if (agora > antes && n.t > 0.3 && alvo) {
      const lado = alvo.x >= n.x ? 1 : -1;
      for (let s = 0; s < f.leque; s++) {
        const ang = f.leque === 1 ? 0 : (s - (f.leque - 1) / 2) * 0.35;
        esporos.push({ x: n.x + lado * 1.3, y: n.y + 1.4, vx: lado * REI.velEsporo * Math.cos(ang), vy: REI.velEsporo * Math.sin(ang), t: 5 });
      }
      eventos.push(`esporo:${k}`);
    }
    if (f.pulo > 0 && n.noChao && Math.floor(n.t / f.pulo) > Math.floor((n.t - DT) / f.pulo)) n.vy = 9;
    if (n.t >= f.ataque && n.noChao) { n.aberto = true; n.t = 0; eventos.push(`ponto-fraco:${k}`); }
  }
  n.vy = Math.max(-18, n.vy - 30 * DT);
  n.noChao = false;
  moverEixo(n, m.w, m.h, sol, n.vx * DT, 0);
  moverEixo(n, m.w, m.h, sol, 0, n.vy * DT);
}

/**
 * Tira vida de um bichinho. Devolve true se foi derrotado. O Rei só sofre com o ponto fraco à mostra; ao mudar de
 * fase de ataque, fecha o ponto fraco.
 */
export function ferir(n: EstadoInimigo, k: number, dano: number, eventos: string[]): boolean {
  if (!n.vivo) return false;
  if (n.tipo === 'rei' && !n.aberto) { eventos.push(`defendeu:${k}`); return false; }
  n.vida = Math.max(0, n.vida - dano);
  eventos.push(`acerto:${k}`);
  if (n.vida <= 0) {
    n.vivo = false;
    eventos.push(`derrota:${k}:${n.tipo}`);
    if (n.tipo === 'rei') eventos.push('chefe-derrotado');
    return true;
  }
  if (n.tipo === 'rei') {
    const nova = n.vida <= REI.limites[1] ? 3 : n.vida <= REI.limites[0] ? 2 : 1;
    if (nova !== n.fase) { n.fase = nova; n.aberto = false; n.t = 0; eventos.push(`chefe-fase:${nova}`); }
  }
  return false;
}
