// L2a: janelas de decolagem de um capítulo (a mesma medida do npm run test:lento), as menores primeiro.
// Uso: tools/revisao/l2a/rodar.sh janela [cap…]
import { CAPITULOS } from '../../../src/core/fases';
import { janelas } from '../../../test/fases/janela';

const caps = process.argv.slice(2).map(Number);
for (const f of CAPITULOS) {
  if (caps.length && !caps.includes(f.capitulo)) continue;
  const t0 = Date.now();
  const r = janelas(f);
  const est = f.estrelinhas ?? [];
  const lista = r.map((w, k) => ({ w, k })).filter(({ w }) => w).sort((a, b) => Math.max(a.w!.m, a.w!.coyoteM) - Math.max(b.w!.m, b.w!.coyoteM)).slice(0, 5);
  console.log(`cap ${f.capitulo}: ${r.filter((w) => !w).length} sem salto de chão fixo · ${((Date.now() - t0) / 1000).toFixed(0)} s · menores: ${lista.map(({ w, k }) => `#${k} (${est[k].x}, ${est[k].y}) ${w!.m} m / coyote ${w!.coyoteM} m ${w!.perfil}`).join(' · ')}`);
}
