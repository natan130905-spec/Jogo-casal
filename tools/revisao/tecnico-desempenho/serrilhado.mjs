// Confere o serrilhado (antialias) por qualidade: mesmo capítulo, mesmo enquadramento inicial, recorte ampliado 3×
// em volta dos personagens. Hipótese testada: na alta, o EffectComposer desenha a cena num alvo sem MSAA, então o
// antialias do canvas não vale para a cena (só para o quadro final, que é um retângulo de tela cheia).
// Uso: node tools/revisao/tecnico-desempenho/serrilhado.mjs <dist> <saida.png> [porta]
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [dist, saida, porta = 4971] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let f = join(dist, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(Number(porta), '127.0.0.1');
const nav = await chromium.launch();
const fotos = [];
for (const q of ['baixa', 'media', 'alta']) {
  const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.clock.install();
  await p.goto(`http://127.0.0.1:${porta}/?q=${q}&resfixa`);
  await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
  await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[1].click());
  await p.click('#bt-jogar');
  // relógio controlado (como tools/revisao/capturas.mjs): 120 quadros de 1/60 s, câmera assentada, mesmo tick nas três
  for (let k = 0; k < 400 && !(await p.evaluate(() => window.__edm?.cap === 2)); k++) await p.clock.runFor(50);
  for (let k = 0; k < 120; k++) await p.clock.runFor(1000 / 60);
  // recorte em pixels CSS em volta do centro (os personagens começam perto do centro da tela)
  const b = await p.screenshot({ clip: { x: 300, y: 150, width: 140, height: 110 } });
  fotos.push([q, b.toString('base64')]);
  await ctx.close();
}
// monta lado a lado, ampliado sem suavizar (pixel a pixel), com rótulos
const ctx = await nav.newContext({ viewport: { width: 1200, height: 420 } });
const p = await ctx.newPage();
await p.setContent(`<body style="margin:0;background:#111;color:#fff;font:16px sans-serif;display:flex;gap:6px">${fotos.map(([q, b]) => `<div><div style="padding:4px">${q}</div><img src="data:image/png;base64,${b}" style="width:396px;image-rendering:pixelated"></div>`).join('')}</body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: saida, fullPage: true });
await nav.close(); srv.close();
console.log('ok', saida);
