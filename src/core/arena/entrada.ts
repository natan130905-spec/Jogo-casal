// Entrada da arena: neutra, limpeza da entrada vinda da rede e conversão do joystick (relativo à câmera) para o chão.
import type { EntradaArena } from './tipos';

export const ENTRADA_NEUTRA: EntradaArena = Object.freeze({
  x: 0, y: 0, yaw: 0, pulo: false, golpe: false, tiro: false, esquiva: false, poder: false,
});

/** Limpa uma entrada recebida pela rede (valores fora do formato viram neutros; joystick limitado ao círculo). */
export function normalizarEntradaArena(i: unknown): EntradaArena {
  const o = (i ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  let x = num(o.x), y = num(o.y);
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  const yaw = typeof o.yaw === 'number' && Number.isFinite(o.yaw) ? Math.atan2(Math.sin(o.yaw), Math.cos(o.yaw)) : 0;
  return {
    x, y, yaw,
    pulo: o.pulo === true, golpe: o.golpe === true, tiro: o.tiro === true, esquiva: o.esquiva === true, poder: o.poder === true,
  };
}

/**
 * Joystick relativo à câmera → direção no chão (x, z), com o tamanho do joystick (0…1).
 * Com yaw = 0 (câmera olhando para -z): para a frente = -z, para a direita = +x (como no Three.js).
 */
export function direcaoNoChao(i: EntradaArena): { x: number; z: number; m: number } {
  const m = Math.min(1, Math.hypot(i.x, i.y));
  if (m < 0.05) return { x: 0, z: 0, m: 0 };
  const c = Math.cos(i.yaw), s = Math.sin(i.yaw);
  const x = i.x * c - i.y * s;
  const z = -i.x * s - i.y * c;
  const n = Math.hypot(x, z) || 1;
  return { x: x / n, z: z / n, m };
}

/** Entrada que move o jogador na direção do mundo (dx, dz) — para bots e testes (yaw = 0). */
export function entradaParaDirecao(dx: number, dz: number, extra: Partial<EntradaArena> = {}): EntradaArena {
  const n = Math.hypot(dx, dz);
  const x = n > 1e-6 ? dx / n : 0, y = n > 1e-6 ? -dz / n : 0;
  return { ...ENTRADA_NEUTRA, x, y, yaw: 0, ...extra };
}
