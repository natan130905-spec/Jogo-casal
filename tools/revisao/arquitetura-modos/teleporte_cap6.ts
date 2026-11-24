// Reproduz o teleporte do cap. 6 (superpulo de mãos dadas em x 30,4–30,71 para a esquerda leva Natan de 29,5 a 66,1).
import { CAP6_ESPELHOS as f } from '../../../src/core/fases/index';
import { estadoInicial } from '../../../src/core/sim';
import { jogar, posicionar, ir, darImpulso, superpulo, esperar } from '../../../test/fases/bot';
for (const x of [30.4, 30.71, 31, 31.5]) for (const alvo of [20, 26, 29]) {
  const e = estadoInicial(f);
  posicionar(e, [x, 0], [x + 0.7, 0]);
  let maxX = 0, salto = '';
  let ant = x;
  const r = jogar(f, [{ nome: 's', limite: 6, p: [[ir(x), superpulo(alvo), esperar((c) => c.t > 200)], [ir(x + 0.7), darImpulso()]] }], { e, limite: 8, cada: (s) => { const j = s.jogadores[0]; if (Math.abs(j.x - ant) > 2) salto = `TELEPORTE ${ant.toFixed(2)}→${j.x.toFixed(2)} y ${j.y.toFixed(2)} tick ${s.tick}`; ant = j.x; maxX = Math.max(maxX, j.x); } });
  const j = r.e.jogadores[0];
  console.log(`x=${x} alvo=${alvo}: fim (${j.x.toFixed(2)}, ${j.y.toFixed(2)}) ${salto}`);
}
