// Rastro tick a tick do teleporte do cap. 6 (mesma situação de teleporte_cap6.ts).
import { CAP6_ESPELHOS as f } from '../../../src/core/fases/index';
import { estadoInicial } from '../../../src/core/sim';
import { jogar, posicionar, ir, darImpulso, superpulo, esperar } from '../../../test/fases/bot';
const e = estadoInicial(f);
posicionar(e, [30.4, 0], [31.1, 0]);
let t0 = -1;
jogar(f, [{ nome: 's', limite: 4, p: [[ir(30.4), superpulo(20), esperar((c) => c.t > 100)], [ir(31.1), darImpulso()]] }], { e, limite: 4,
  entradas: (en) => { (globalThis as any).ent = en[0]; },
  cada: (s) => { const j = s.jogadores[0]; if (!j.noChao && t0 < 0) t0 = s.tick; if (t0 >= 0 && s.tick - t0 < 16) console.log(s.tick, 'x', j.x.toFixed(3), 'y', j.y.toFixed(3), 'vx', j.vx.toFixed(2), 'vy', j.vy.toFixed(2), 'in', JSON.stringify((globalThis as any).ent?.x)); } });
