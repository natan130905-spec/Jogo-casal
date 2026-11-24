// Tempo de montarGrafo por capítulo e tamanho do grafo serializado (para decidir pré-calcular no build).
import { CAPITULOS } from '../../../src/core/fases/index';
import { montarGrafo } from '../../../test/fases/alcance';
for (const f of CAPITULOS) { montarGrafo(f); const t = performance.now(); const g = montarGrafo(f); const ms = performance.now() - t;
  const nl = g.lig.reduce((s, l) => s + l.length, 0);
  const json = JSON.stringify({ n: g.nos.map((n) => [n.tipo[0], +n.x0.toFixed(2), +n.x1.toFixed(2), +n.y.toFixed(2), n.k ?? -1]), l: g.lig.map((ls) => ls.map((l) => [l.para, l.tipo[0], l.porta ?? 0])) });
  console.log(`${f.id}: ${ms.toFixed(0)} ms, ${g.nos.length} nós, ${nl} ligações, ${g.saltos} saltos simulados, JSON ${json.length} B`); }
