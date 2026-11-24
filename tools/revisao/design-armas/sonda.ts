import { CAPITULOS } from '../../../src/core/fases/index';
import { jogar } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';
for (const c of [3, 5, 7]) {
  const f = CAPITULOS[c - 1];
  const danos: string[] = [];
  const r = jogar(f, PLANOS[f.id], { limite: 600, entradas: (ents) => { ents[0].shoot = false; ents[1].shoot = false; },
    cada: (e) => { for (const ev of e.eventos) if (ev.startsWith('dano:') || ev.startsWith('bolha') || ev.startsWith('caiu')) {
      const j = e.jogadores[+ev.split(':')[1]];
      const perto = e.inimigos.filter((n) => n.vivo && Math.abs(n.x - j.x) < 2.5).map((n) => `${n.tipo}@${n.x.toFixed(1)},${n.y.toFixed(1)}`);
      danos.push(`${(e.tick / 60).toFixed(1)}s ${ev} em (${j.x.toFixed(1)},${j.y.toFixed(1)}) perto: ${perto.join(' ') || (e.esporos.length ? 'esporo' : '-')}`); } } });
  console.log(`cap ${c}: ${r.concluida} ${r.erro ?? ''}`);
  for (const d of danos.slice(0, 14)) console.log('   ', d);
  const vivos = r.e.inimigos.filter((n) => n.vivo).map((n) => `${n.tipo}@${n.x.toFixed(1)},${n.y.toFixed(1)}`);
  console.log('   vivos no fim:', vivos.join(' '));
}
