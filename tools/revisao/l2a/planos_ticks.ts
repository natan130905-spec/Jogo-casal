// L2a: roda os 7 planos de bots e imprime, por capítulo, o tick de conclusão, as estrelinhas e um hash de todas as
// posições tick a tick (prova de "fecham igual" antes/depois de mover as manobras ou de mexer na colisão).
// Também mede o maior deslocamento horizontal de um corpo num tick além de |vx·dt| (guardião T15).
// Uso (de uma cópia): tools/revisao/l2a/rodar.sh planos_ticks
import { CAPITULOS } from '../../../src/core/fases';
import { DT } from '../../../src/core/sim';
import { jogar } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';

const saida: Record<string, unknown> = {};
for (const f of CAPITULOS) {
  let h = 2166136261 >>> 0;
  const mix = (v: number) => { h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619) >>> 0; };
  let ant: { x: number; vx: number }[] | null = null;
  let excesso = 0;
  const r = jogar(f, PLANOS[f.id], { limite: 420, cada: (e) => {
    for (const j of e.jogadores) { mix(j.x); mix(j.y); }
    const agora = e.jogadores.map((j) => ({ x: j.x, vx: j.vx }));
    if (ant) for (let i = 0; i < 2; i++) {
      const j = e.jogadores[i];
      if (j.bolha || e.eventos.includes(`caiu:${i}`) || e.eventos.includes('volta-checkpoint') || e.eventos.includes(`renasce:${i}`)) continue;
      const d = Math.abs(j.x - ant[i].x) - Math.max(Math.abs(ant[i].vx), Math.abs(j.vx)) * DT;
      excesso = Math.max(excesso, d);
    }
    ant = agora;
  } });
  saida[f.id] = { concluida: r.concluida, tick: r.e.tick, estrelinhas: r.estrelinhas, hash: h.toString(16), excessoMax: +excesso.toFixed(4) };
  console.log(`${f.id}: ${r.concluida ? 'conclui' : 'NÃO conclui'} tick ${r.e.tick} estrelinhas ${r.estrelinhas} hash ${h.toString(16)} excesso ${excesso.toFixed(4)} m${r.erro ? ' ' + r.erro : ''}`);
}
console.log(JSON.stringify(saida));
