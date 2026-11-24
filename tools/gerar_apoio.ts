// Gera o mapa de apoio de cada capítulo (grafo de alcance + pontos de cooperação) FORA DO CELULAR [R59] e grava
// src/core/fases/apoio/capN.json com o hashFase. Rode depois de mudar uma fase, o campo `apoio` dela, a física ou a
// colisão (o teste T14, test/apoio.test.ts, falha até regenerar):
//   npm run apoio            → todos os capítulos
//   npm run apoio -- 3 6     → só os capítulos 3 e 6
// Também imprime os pontos de cooperação (para revisar as anotações à mão do campo `apoio`) e os avisos.
import { writeFileSync } from 'node:fs';
import { CAPITULOS } from '../src/core/fases';
import { codificarMapa } from '../src/core/companheiro/apoio';
import { montarMapaApoio } from '../test/fases/apoio';

const pedidos = process.argv.slice(2).map(Number).filter((n) => n > 0);
const raiz = new URL('../src/core/fases/apoio/', import.meta.url);
let avisosTotal = 0;
for (const f of CAPITULOS) {
  if (pedidos.length && !pedidos.includes(f.capitulo)) continue;
  const t0 = Date.now();
  const { mapa, avisos } = montarMapaApoio(f);
  const json = JSON.stringify(codificarMapa(mapa));
  writeFileSync(new URL(`cap${f.capitulo}.json`, raiz), json + '\n');
  const lig = mapa.lig.reduce((s, l) => s + l.length, 0);
  console.log(`cap ${f.capitulo} ${f.id}: ${mapa.nos.length} nós, ${lig} ligações, ${mapa.coop.length / 2} pontos de cooperação (+ inversos), ${(json.length / 1024).toFixed(1)} KB, ${Date.now() - t0} ms, hash ${mapa.hashFase}`);
  for (const p of mapa.coop.filter((q) => q.origem === 'caminho')) {
    const g = p.gatilho;
    console.log(`   ${p.id.padEnd(22)} ${p.tipo.padEnd(10)} ${p.lig}${p.porta ? `(${p.porta})` : ''} jogador ${g.x.toFixed(1)}…${(g.x + g.w).toFixed(1)} y ${(g.y + 0.1).toFixed(1)} → (${p.papel.ate.x0.toFixed(1)}…${p.papel.ate.x1.toFixed(1)}, y ${p.papel.ate.y}); companheiro x ${p.papel.x} y ${p.papel.y}${p.papel.placa ? ` placa ${p.papel.placa}` : ''}`);
  }
  for (const a of avisos) console.log(`   AVISO ${a}`);
  avisosTotal += avisos.length;
}
if (avisosTotal) console.log(`${avisosTotal} aviso(s): anote os pontos no campo \`apoio\` da fase (src/core/fases/capN_*.ts) e rode de novo.`);
