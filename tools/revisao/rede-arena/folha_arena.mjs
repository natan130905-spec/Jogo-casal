// Folha antes | depois das capturas da arena (tools/revisao/rede-arena/capturas_arena.mjs) e o resumo das medidas.
// Uso: node tools/revisao/rede-arena/folha_arena.mjs <pasta-antes> <pasta-depois> <destino.webp>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { folhaWebp } from '../medir.mjs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const [antes, depois, destino] = process.argv.slice(2);
const ma = JSON.parse(readFileSync(join(antes, 'medidas.json'))), md = JSON.parse(readFileSync(join(depois, 'medidas.json')));
const nomes = md.fotos.map((f) => f.nome);
const nav = await chromium.launch();
await folhaWebp(nav, nomes.map((n) => [join(antes, `${n}.png`), join(depois, `${n}.png`)]), destino, {
  largura: 560, rotulos: nomes.map((n) => [`ANTES · ${n}`, `DEPOIS · ${n}`]),
});
await nav.close();
const linha = (n) => {
  const a = ma.fotos.find((f) => f.nome === n), d = md.fotos.find((f) => f.nome === n);
  const h = (f) => f?.camera?.herois?.[f.camera.eu]?.altura;
  return `| ${n} | ${a?.tick}/${d?.tick} | ${h(a)} → ${h(d)} | ${a?.camera?.distancia} → ${d?.camera?.distancia} | ${a?.luminancia.media} → ${d?.luminancia.media} | ${a?.luminancia.quaseBranco} → ${d?.luminancia.quaseBranco} |`;
};
const curva = (n) => { const a = ma.curvas[n], d = md.curvas[n]; return `| ${n} | ${a.base} → ${d.base} | ${a.pico} → ${d.pico} | ${a.quadrosAcimaBase15} → ${d.quadrosAcimaBase15} | ${a.picoQuaseBranco} → ${d.picoQuaseBranco} |`; };
const md_ = [
  '| foto | tick | altura do próprio personagem (fração da tela) | distância (m) | luminância média | pixels quase brancos |', '|---|---|---|---|---|---|',
  ...nomes.map(linha), '',
  '| curva | base (centro) | pico (centro) | quadros acima de base+15 | pico de pixels quase brancos |', '|---|---|---|---|---|',
  ...Object.keys(md.curvas).map(curva),
].join('\n');
writeFileSync(destino.replace(/\.webp$/, '.md'), md_ + '\n');
console.log(md_);
