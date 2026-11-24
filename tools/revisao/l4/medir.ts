// L4: medidas do arsenal com os bots dos 7 planos (test/fases/planos):
//   tamanho médio do instantâneo de rede (JSON, 1 a cada 3 ticks = 20/s), tick de conclusão, fração do tempo com
//   bichinho vivo a < 8 m de alguém (combate), tiros/golpes e elementos usados.
// Uso: tools/revisao/l4/rodar.sh medir [--json saida.json] [--sem-potes]
import { writeFileSync } from 'node:fs';
import { CAPITULOS } from '../../../src/core/fases/index';
import { estadoInicial } from '../../../src/core/sim';
import { instantaneo } from '../../../src/core/instantaneo';
import { jogar } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const semPotes = process.argv.includes('--sem-potes');
const res: Record<string, unknown> = {};
for (const f of CAPITULOS) {
  const e = estadoInicial(f);
  if (semPotes) (e as { semPotes?: boolean }).semPotes = true;
  let bytes = 0, n = 0, combate = 0, ticks = 0;
  const r = jogar(f, PLANOS[f.id], {
    e, limite: 420,
    cada: (s) => {
      ticks++;
      if (s.inimigos.some((b) => b.vivo && s.jogadores.some((j) => !j.bolha && Math.hypot(j.x - b.x, j.y - b.y) < 8))) combate++;
      if (s.tick % 3 === 0) { bytes += JSON.stringify(instantaneo(f, s)).length; n++; }
    },
  });
  const ev = r.eventos;
  res[f.id] = {
    concluida: r.concluida, tick: r.e.tick, erro: r.erro, instantaneoMedio: Math.round(bytes / n), combate: +(combate / ticks).toFixed(3),
    tiros: ev.tiro ?? 0, golpes: ev.golpe ?? 0, defendeu: ev.defendeu ?? 0, derrotados: r.derrotados, danos: r.danos, bolhas: r.bolhas,
    sino: ev.sino ?? 0, barbante: ev.barbante ?? 0, racha: ev.racha ?? 0, bau: ev.bau ?? 0, pote: ev.pote ?? 0, estrelinhas: r.estrelinhas,
  };
  console.log(f.id, JSON.stringify(res[f.id]));
}
const saida = arg('json');
if (saida) writeFileSync(saida, JSON.stringify(res, null, 1));
