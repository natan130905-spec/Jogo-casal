// L4: no navegador (build servido localmente), cap. 1 no treino com as entradas gravadas dos bots: fotos nos
// momentos das armas (sino, barbante, baú, bloco rachado), contagem dos eventos que chegaram à tela e medida dos
// botões em 4 tamanhos de tela (Ø, sobreposição, distância entre bordas). Sem GPU: fps não vale.
// Uso (na raiz de uma cópia do repositório): node tools/revisao/l4/ver.mjs --dist <pasta> [--saida pasta] [--porta 4993]
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const arg = (n, pad) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : pad; };
const DIST = resolve(arg('dist', 'dist')), SAIDA = resolve(arg('saida', 'test-out/l4')), PORTA = Number(arg('porta', 4993));
mkdirSync(SAIDA, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(PORTA, '127.0.0.1');
const { gravarRoteiros } = await import(join(process.cwd(), 'test/e2e/roteiros.mjs'));
const R = await gravarRoteiros([1]);
const nav = await chromium.launch();
const res = { botoes: {}, eventos: {}, erros: [], fotos: [] };

// botões em 4 tamanhos (A9 parcial: só os botões do 2.5D; o L5 refaz o layout inteiro)
for (const [w, h] of [[844, 390], [844, 340], [873, 393], [915, 412]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PORTA}/?q=baixa`);
  await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
  await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[0].click());
  await p.click('#bt-jogar');
  await p.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 120000 });
  await p.waitForTimeout(300);
  res.botoes[`${w}x${h}`] = await p.evaluate(() => {
    const ids = ['bt-pulo', 'bt-tiro', 'bt-mao', 'bt-troca'];
    const r = Object.fromEntries(ids.map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return [id, { x: b.left, y: b.top, w: b.width, h: b.height }]; }));
    // distância entre bordas de círculos
    const dist = (a, b) => Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) - a.w / 2 - b.w / 2;
    const pares = {};
    for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) pares[`${ids[i]}~${ids[k]}`] = Math.round(dist(r[ids[i]], r[ids[k]]));
    const t = document.getElementById('bt-tiro').textContent, chip = document.getElementById('arma-0').textContent;
    return { diam: Object.fromEntries(ids.map((id) => [id, Math.round(r[id].w)])), menorFolga: Math.min(...Object.values(pares)), pares, iconeAtacar: t, chip };
  });
  await p.screenshot({ path: join(SAIDA, `botoes_${w}x${h}.png`) });
  await ctx.close();
}

// cap. 1 com os bots, fotos nos eventos das armas
const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => res.erros.push(String(e)));
await p.goto(`http://127.0.0.1:${PORTA}/?q=media`);
await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[0].click());
await p.click('#bt-jogar');
await p.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 120000 });
await p.evaluate(() => { window.__evs = {}; window.__marcas = []; });
// achar no roteiro os ticks dos eventos (simulando de novo no node seria igual; aqui pegamos pelo estado na página)
await p.evaluate((l) => window.__edm.roteiro(l), R[1].lista);
const quer = ['sino', 'barbante', 'bau', 'racha', 'golpe', 'tiro'];
const feitas = new Set();
const t0 = Date.now();
for (;;) {
  const st = await p.evaluate(() => { const e = window.__edm.estado(); return { k: e.tick, c: e.concluida, ev: e.eventos, i: window.__edm.info() }; }).catch(() => null);
  if (!st) break;
  for (const ev of st.ev) { const tp = ev.split(':')[0]; res.eventos[tp] = (res.eventos[tp] ?? 0) + 1;
    if (quer.includes(tp) && !feitas.has(tp)) { feitas.add(tp); await p.waitForTimeout(120); const nome = `cap1_${tp}_t${st.k}.png`; await p.screenshot({ path: join(SAIDA, nome) }); res.fotos.push(nome); } }
  if (st.c || Date.now() - t0 > 400000) break;
  await p.waitForTimeout(16);
}
res.contagem = await p.evaluate(() => window.__edm.contagem?.() ?? null);
writeFileSync(join(SAIDA, 'ver.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ botoes: res.botoes, eventos: res.eventos, contagem: res.contagem, erros: res.erros, fotos: res.fotos }, null, 1));
await nav.close(); srv.close();
