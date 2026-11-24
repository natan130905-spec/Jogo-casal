// L2a: busca completa de alcance de um capítulo (a mesma do npm run test:lento) e as menores folgas.
// Uso: tools/revisao/l2a/rodar.sh busca_completa <cap>
import { CAPITULOS } from '../../../src/core/fases';
import { alcanceDoCapitulo, soEmDupla } from '../../../test/fases/busca';

const cap = Number(process.argv[2]);
const f = CAPITULOS.find((c) => c.capitulo === cap)!;
const r = alcanceDoCapitulo(f, { completa: true, limite: 60000 });
const est = f.estrelinhas ?? [];
const folga = est.map((_, k) => Math.max(r.A.folga[k], r.B.folga[k]));
const ordem = folga.map((v, k) => [v, k]).sort((a, b) => a[0] - b[0]).slice(0, 8);
console.log(`cap ${cap}: ${r.segundos.toFixed(0)} s, estados A ${r.A.estados} B ${r.B.estados}${r.A.esgotou || r.B.esgotou ? ' LIMITE' : ''}; gestos ${r.A.gestos + r.B.gestos}; só em dupla ${JSON.stringify(soEmDupla(r))}; pedaço ${r.B.portal}`);
console.log(`   menores folgas: ${ordem.map(([v, k]) => `#${k} (${est[k].x}, ${est[k].y}) ${v}`).join(' · ')}`);
console.log(JSON.stringify({ cap, folga, estadosA: r.A.estados, estadosB: r.B.estados, esgotou: r.A.esgotou || r.B.esgotou, segundos: r.segundos }));
