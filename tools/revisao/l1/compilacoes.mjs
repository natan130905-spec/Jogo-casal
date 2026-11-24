// L1 (R38/R37/R35): por capítulo × qualidade, joga a fase inteira (entradas gravadas dos bots, acelerado) num build
// servido localmente com a sonda WebGL (tools/revisao/tecnico-desempenho/sonda.js) e mede:
//   compilações de shader DEPOIS do 1º quadro desenhado (meta 0), programas vivos, chamadas e triângulos máximos,
//   VRAM estimada (texturas + buffers + renderbuffers + quadro padrão) e a carga (tela pintada / pronta).
// Uso (na raiz de uma cópia do repositório): node tools/revisao/l1/compilacoes.mjs --dist <pasta> [--caps 1,2] [--q baixa,media,alta]
//      [--acel 20] [--saida arq.json] [--porta 4981]
// Sem GPU (SwiftShader) o fps não vale; programas, compilações, chamadas, triângulos e bytes valem.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const SONDA = readFileSync(join(AQUI, '../tecnico-desempenho/sonda.js'), 'utf8');
// marca quantas compilações já tinham acontecido no fim do 1º quadro com desenho de cada contexto WebGL
const MARCA = `(() => { const raf = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => raf((ts) => { cb(ts);
  const S = window.__sonda; if (S && S.primeiroDesenhoEm > 0 && S.ctxMarcado !== S.contextos) { S.ctxMarcado = S.contextos; S.compPrimeiro = S.compilacoes; S.progPrimeiro = S.programas; } }); })();`;
const arg = (n, pad) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : pad; };
const RAIZ = process.cwd();
const DIST = resolve(arg('dist', 'dist'));
const PORTA = Number(arg('porta', 4981));
const caps = arg('caps', '1,2,3,4,5,6,7').split(',').map(Number), qs = arg('q', 'baixa,media,alta').split(','), acel = Number(arg('acel', 20));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => { let f = join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(PORTA, '127.0.0.1');
const { gravarRoteiros } = await import(join(RAIZ, 'test/e2e/roteiros.mjs'));
const R = await gravarRoteiros(caps);
const nav = await chromium.launch();
const res = {};
for (const q of qs) for (const n of caps) {
  const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
  await ctx.addInitScript(SONDA); await ctx.addInitScript(MARCA);
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORTA}/?q=${q}&resfixa`);
  await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
  await p.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
  await p.click('#bt-jogar');
  await p.waitForFunction((n) => window.__edm?.cap === n && window.__sonda.compPrimeiro !== undefined, n, { timeout: 300000, polling: 100 });
  const carga = await p.evaluate(() => window.__edm.carga?.() ?? null);
  await p.evaluate(([l, k]) => { window.__edm.acelerar(k); window.__edm.roteiro(l); }, [R[n].lista, acel]);
  const m = { ch: 0, tri: 0, texMB: 0, bufMB: 0, rbMB: 0 };
  const t0 = Date.now();
  for (;;) {
    const st = await p.evaluate(() => { const e = window.__edm.estado(), i = window.__edm.info(), S = window.__sonda; return { c: e.concluida, i, texMB: S.texBytes / 2 ** 20, bufMB: S.bufBytes / 2 ** 20, rbMB: S.rbBytes / 2 ** 20 }; }).catch(() => null);
    if (!st) break;
    m.ch = Math.max(m.ch, st.i.chamadas); m.tri = Math.max(m.tri, st.i.triangulos); m.texMB = Math.max(m.texMB, st.texMB); m.bufMB = Math.max(m.bufMB, st.bufMB); m.rbMB = Math.max(m.rbMB, st.rbMB);
    if (st.c || Date.now() - t0 > 600000) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const s = await p.evaluate(() => { const S = window.__sonda, c = S.ultimoCanvas, at = S.atributos ?? {}; return { comp: S.compilacoes, compPrimeiro: S.compPrimeiro, progPrimeiro: S.progPrimeiro, programas: S.programas, rbMB: S.rbBytes / 2 ** 20, fbMB: c ? (c.width * c.height * 8 * (at.antialias ? 5 : 1)) / 2 ** 20 : 0, aa: !!at.antialias }; });
  const r1 = (v) => Math.round(v * 10) / 10;
  res[`${n}_${q}`] = { cap: n, q, compilacoesDepoisDo1oQuadro: s.comp - s.compPrimeiro, compilacoesNo1oQuadro: s.compPrimeiro, programas: s.programas, chamadasMax: m.ch, triMaxK: Math.round(m.tri / 1000),
    vramEstimadaMB: r1(m.texMB + m.bufMB + m.rbMB + s.fbMB), texMB: r1(m.texMB), rbMB: r1(m.rbMB), fbMB: r1(s.fbMB), aaCanvas: s.aa, carga, erros: erros.slice(0, 2), terminou: Date.now() - t0 < 600000 };
  console.log(JSON.stringify(res[`${n}_${q}`]));
  await ctx.close();
}
writeFileSync(resolve(arg('saida', 'test-out/compilacoes.json')), JSON.stringify(res, null, 1));
await nav.close(); srv.close();
