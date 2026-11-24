// Alvos de balanceamento da Arena do Coração (docs/ARENA_FINAL.md, "Balanceamento"), verificados com bots que jogam a
// luta inteira na simulação de verdade.
import { describe, expect, it } from 'vitest';
import { estadoInicialArena, passoArena } from '../src/core/arena';
import { BotArena, lutar, type PerfilBot } from './arena_bot';

const perfil = (acerto: number, desvio: number, semente: number): PerfilBot => ({ acerto, desvio, semente });
const dupla = (acerto: number, desvio: number, s: number): [PerfilBot, PerfilBot] => [perfil(acerto, desvio, s * 11), perfil(acerto, desvio, s * 17)];
const SEMENTES = [1, 2, 3, 4, 5, 6];

describe('arena: balanceamento com bots', () => {
  it('dupla mediana (60 % de acerto, reage a 70 % dos avisos) vence em 3 a 5 minutos', () => {
    const tempos: number[] = [];
    for (const s of SEMENTES) {
      const r = lutar(dupla(0.6, 0.7, s), {}, 900);
      expect(r.vitoria, `semente ${s}`).toBe(true);
      tempos.push(r.tempo);
      expect(r.tempo, `semente ${s}`).toBeGreaterThanOrEqual(180);
      expect(r.tempo, `semente ${s}`).toBeLessThanOrEqual(300);
      // as três fases foram jogadas
      expect(r.fases.length).toBe(3);
    }
    const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    expect(media).toBeGreaterThan(200);
    expect(media).toBeLessThan(280);
  });

  it('nem a dupla perfeita (100 % de acerto, desvia de tudo) vence em menos de 2 minutos', () => {
    const r = lutar(dupla(1, 1, 1), {}, 900);
    expect(r.vitoria).toBe(true);
    expect(r.tempo).toBeGreaterThanOrEqual(120);
  });

  it('bot que sempre desvia não toma dano (todo ataque é avisado e desviável)', () => {
    for (const s of SEMENTES) {
      const r = lutar(dupla(0.6, 1, s), {}, 900);
      expect(r.vitoria, `semente ${s}`).toBe(true);
      expect(r.danos, `semente ${s}`).toEqual([0, 0]);
      expect(r.eventos.caiu ?? 0, `semente ${s}`).toBe(0);
    }
  });

  it('todo ataque tem aviso de pelo menos 0,8 s', () => {
    const e = estadoInicialArena();
    const bots = [new BotArena(0, perfil(0.6, 0.7, 5)), new BotArena(1, perfil(0.6, 0.7, 9))];
    const avisos = new Map<string, number>();
    while (!e.vitoria && e.tick < 900 * 60) {
      passoArena(e, [bots[0].entrada(e), bots[1].entrada(e)]);
      for (const s of e.eventos) {
        if (!s.startsWith('aviso:')) continue;
        const [, tipo, id] = s.split(':');
        const p = e.perigos.find((q) => q.id === Number(id));
        // o perigo nasce no passo de lacaios/Rei; os perigos já descontaram no máximo um passo
        const a = (p?.aviso ?? 0) + 1 / 60;
        avisos.set(tipo, Math.min(avisos.get(tipo) ?? 99, a));
      }
    }
    expect(e.vitoria).toBe(true);
    expect([...avisos.keys()].sort()).toEqual(['bote', 'esporo', 'investida', 'mergulho', 'onda']);
    for (const [tipo, a] of avisos) expect(a, tipo).toBeGreaterThanOrEqual(0.8 - 1e-9);
  });

  it('uma pessoa sozinha (treino) vence, mais devagar', () => {
    for (const s of [1, 2, 3]) {
      const r = lutar(dupla(0.6, 0.7, s), { treino: true }, 1200);
      expect(r.vitoria, `semente ${s}`).toBe(true);
      expect(r.tempo).toBeGreaterThan(300);
      expect(r.tempo).toBeLessThan(900);
      expect(r.danos[1]).toBe(0); // o parceiro só acompanha
    }
  });

  it('a mesma luta dá sempre o mesmo resultado (determinismo)', () => {
    const a = lutar(dupla(0.6, 0.7, 3), {}, 900);
    const b = lutar(dupla(0.6, 0.7, 3), {}, 900);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
