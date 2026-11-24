// L4: fotos de perto das armas na mão (Estilingue, Espada, Martelo) com entradas fixas no treino do cap. 1.
// Uso: node tools/revisao/l4/foto_armas.mjs --dist <pasta> [--saida pasta] [--porta 4994]
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const arg = (n, pad) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : pad; };
const DIST = resolve(arg('dist', 'dist')), SAIDA = resolve(arg('saida', 'test-out/l4')), PORTA = Number(arg('porta', 4994));
mkdirSync(SAIDA, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(PORTA, '127.0.0.1');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto(`http://127.0.0.1:${PORTA}/?q=alta`);
await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[0].click());
await p.click('#bt-jogar');
await p.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 120000 });
// Natan anda até x 6 e ataca com cada arma; o Martelo vem pelo estado (mochila)
const N = { x: 0, y: 0, jump: false, act: false, shoot: false };
const lista = [];
for (let t = 0; t < 1200; t++) {
  const a = { ...N };
  if (t < 50) a.x = 1;
  else if (t < 60) a.x = 0;
  const fase = Math.floor((t - 60) / 180); // 0 estilingue, 1 espada, 2 estilingue para cima, 3.. espada
  if (t >= 60) { a.shoot = (t - 60) % 180 > 10; // segurado: o Estilingue fica mirando e o corpo a corpo repete o golpe
    if (t % 180 === 61) a.troca = [2, 1, 2, 1, 2, 1][fase] ?? 0; if (fase === 2) a.y = 0.8; }
  lista.push([a, { ...N }]);
}
await p.evaluate((l) => window.__edm.roteiro(l), lista);
// tick em que o golpe/tiro acabou de sair (a pose dura 0,3–0,4 s do relógio da tela)
for (const [nome, tick, martelo] of [['estilingue', 110, false], ['espada', 300, false], ['estilingue_cima', 470, false], ['martelo', 660, true]]) {
  if (martelo) await p.evaluate(() => { window.__edm.estado().jogadores[0].arsenal.itens[0] = 2; });
  await p.waitForFunction((k) => window.__edm.estado().tick >= k, tick, { timeout: 120000, polling: 'raf' });
  const st = await p.evaluate(() => { const e = window.__edm.estado(); return { k: e.tick, a: e.jogadores[0].arsenal, x: e.jogadores[0].x }; });
  await p.screenshot({ path: join(SAIDA, `mao_${nome}.png`), clip: { x: 220, y: 110, width: 400, height: 210 } });
  console.log(nome, st.k, st.x.toFixed(2), JSON.stringify(st.a.itens), st.a.atual);
}
console.log('erros', erros);
await nav.close(); srv.close();
