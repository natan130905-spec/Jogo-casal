// Medidor de desempenho e plataforma do "Entre Dois Mundos" (revisão técnica, 2026-11-24). Reutilizável.
// Roda contra um build (dist/) servido por um servidor estático próprio com gzip (como o GitHub Pages).
// Não altera o jogo: a sonda (sonda.js) embrulha o WebGL e o requestAnimationFrame dentro da página.
//
// Uso (rode a partir da RAIZ de uma cópia do repositório, ex.: uma worktree, porque `cenas` grava os roteiros dos bots
// com o Vite dessa raiz):
//   node tools/revisao/tecnico-desempenho/medir.mjs bundle  [--dist dist]
//   node tools/revisao/tecnico-desempenho/medir.mjs carga   [--perfis sem,4g,3g] [--disp redmi|iphone|pixel]
//   node tools/revisao/tecnico-desempenho/medir.mjs cenas   [--caps 1,2] [--q baixa,media,alta] [--disp redmi] [--acel 6]
//   node tools/revisao/tecnico-desempenho/medir.mjs cpu     [--caps 2] [--q media] [--seg 8]   (perfil CDP por módulo; precisa de build com --sourcemap)
//   node tools/revisao/tecnico-desempenho/medir.mjs rede    [--lat 0,80,200] [--jitter 30] [--perda 0,2,5] [--disp mini]
//   node tools/revisao/tecnico-desempenho/medir.mjs arena   [--q baixa,media,alta] [--perfis sem,4g]   (retrato da Arena do Coração)
// Opções gerais: --porta 4961 (servidor estático), --saida <dir> (JSON e capturas; padrão scratch/medidas), --fotos
// Sem GPU (SwiftShader) o fps NÃO vale: as medidas úteis são chamadas, triângulos, programas, memória estimada,
// bytes, tempos de CPU do JavaScript (proporcionais, não absolutos) e tempos de rede.
import { createRequire } from 'node:module';
import http from 'node:http';
import zlib from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const SONDA = readFileSync(join(AQUI, 'sonda.js'), 'utf8');

// ---------- argumentos ----------
const cmd = process.argv[2] ?? 'ajuda';
const arg = (n, pad) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? (process.argv[i + 1] ?? true) : pad; };
const lista = (n, pad) => String(arg(n, pad)).split(',').filter(Boolean);
const RAIZ = resolve(arg('raiz', process.cwd()));
const DIST = resolve(RAIZ, arg('dist', 'dist'));
const PORTA = Number(arg('porta', 4961));
const SAIDA = resolve(arg('saida', join(RAIZ, 'test-out', 'desempenho')));
mkdirSync(SAIDA, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (n) => Math.round(n / 1024);
const r1 = (v) => Math.round(v * 10) / 10;

// aparelhos-alvo em paisagem. Redmi Note 11: 1080×2400, DPR 2,75 (CSS 393×873), Chrome Android; tela de 90 Hz.
const DISP = {
  redmi: { viewport: { width: 873, height: 393 }, screen: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; 2201117TY) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  iphone: { ...devices['iPhone 14 landscape'], viewport: { width: 844, height: 390 } }, // a área útil do Safari em paisagem varia; 844×390 = tela cheia/PWA
  pixel: devices['Pixel 7 landscape'],
  // só para medir o custo de JavaScript por quadro sem GPU: tela pequena e DPR 1 (o SwiftShader consegue desenhar vários quadros por segundo)
  mini: { viewport: { width: 480, height: 216 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
// perfis de rede (CDP Network.emulateNetworkConditions). Kbps → bytes/s. "4g" = "Regular 4G" do DevTools com RTT
// de celular real; "3g" = o "Slow 4G/Fast 3G" do Lighthouse (pior caso razoável no Brasil fora de casa).
const REDE = {
  sem: null,
  '4g': { latency: 70, downloadThroughput: (9000 * 1024) / 8, uploadThroughput: (3000 * 1024) / 8 },
  '3g': { latency: 150, downloadThroughput: (1600 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
};

// ---------- servidor estático com gzip ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.map': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.ktx2': 'image/ktx2' };
const COMPRIME = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.map', '.glb']);
function servir(dir, porta) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let f = join(dir, decodeURIComponent(u.pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    const ext = extname(f); let corpo = readFileSync(f);
    const cab = { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': 'max-age=600' };
    if (COMPRIME.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) { corpo = zlib.gzipSync(corpo, { level: 6 }); cab['content-encoding'] = 'gzip'; }
    cab['content-length'] = corpo.length;
    res.writeHead(200, cab); res.end(corpo);
  });
  return new Promise((r) => srv.listen(porta, '127.0.0.1', () => r(srv)));
}

// ---------- página com a sonda ----------
async function abrir(nav, disp = 'redmi', { rede = null, cache = true } = {}) {
  const ctx = await nav.newContext({ ...DISP[disp] });
  await ctx.addInitScript(SONDA);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  if (!cache) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (rede) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...rede });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  return { ctx, p, cdp, erros };
}
async function heap(cdp, gc = false) {
  if (gc) { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await pausa(150); }
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  return { jsHeapMB: r1(m.JSHeapUsedSize / 2 ** 20), jsHeapTotalMB: r1(m.JSHeapTotalSize / 2 ** 20), nos: m.Nodes, ouvintes: m.JSEventListeners };
}
const sonda = (p) => p.evaluate(() => {
  const S = window.__sonda, c = S.ultimoCanvas, at = S.atributos ?? {};
  // memória do quadro padrão (cor + profundidade; ×(amostras+1) com antialias) — estimativa
  const fb = c ? c.width * c.height * 8 * (at.antialias ? 5 : 1) : 0;
  return { contextos: S.contextos, tex: S.tex, texMB: S.texBytes / 2 ** 20, buf: S.buf, bufMB: S.bufBytes / 2 ** 20, rb: S.rb, rbMB: S.rbBytes / 2 ** 20,
    fbMB: fb / 2 ** 20, canvas: c ? [c.width, c.height] : null, aa: !!at.antialias, programas: S.programas, compilacoes: S.compilacoes, compilarMs: S.compilarMs,
    maiorCompilarMs: S.maiorCompilarMs, texLista: S.texLista(), ctxCriadoEm: S.ctxCriadoEm, primeiroDesenhoEm: S.primeiroDesenhoEm, quadros: S.quadros.slice(-300), longas: S.longas.slice(-50) };
});

// ---------- bundle ----------
function tamanhos(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n); const s = statSync(f);
    if (s.isDirectory()) tamanhos(f, base, out);
    else { const b = readFileSync(f); out.push({ arq: f.slice(base.length + 1), bytes: b.length, gzip: COMPRIME.has(extname(f)) ? zlib.gzipSync(b, { level: 9 }).length : b.length, br: COMPRIME.has(extname(f)) ? zlib.brotliCompressSync(b).length : b.length }); }
  }
  return out;
}
async function cmdBundle() {
  const t = tamanhos(DIST).filter((x) => !x.arq.endsWith('.map'));
  const grupos = {};
  for (const x of t) { const g = x.arq.includes('/') ? x.arq.split('/')[0] : 'raiz'; (grupos[g] ??= { n: 0, bytes: 0, gzip: 0 }); grupos[g].n++; grupos[g].bytes += x.bytes; grupos[g].gzip += x.gzip; }
  const r = { grupos: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, { n: v.n, KB: kb(v.bytes), gzipKB: kb(v.gzip) }])),
    assets: t.filter((x) => x.arq.startsWith('assets/')).map((x) => ({ arq: x.arq, KB: kb(x.bytes), gzipKB: kb(x.gzip), brKB: kb(x.br) })),
    totalMB: r1(t.reduce((s, x) => s + x.bytes, 0) / 2 ** 20) };
  console.log(JSON.stringify(r, null, 1));
  writeFileSync(join(SAIDA, 'bundle.json'), JSON.stringify(r, null, 1));
}

// ---------- carga (rede simulada, cache frio) ----------
async function cmdCarga(nav) {
  const res = {};
  for (const perfil of lista('perfis', 'sem,4g,3g')) {
    const { ctx, p, cdp } = await abrir(nav, arg('disp', 'redmi'), { rede: REDE[perfil], cache: false });
    const pedidos = new Map();
    cdp.on('Network.responseReceived', (e) => pedidos.set(e.requestId, { url: e.response.url.replace(/^https?:\/\/[^/]+\//, ''), tipo: e.type, inicio: e.timestamp }));
    cdp.on('Network.loadingFinished', (e) => { const q = pedidos.get(e.requestId); if (q) { q.bytes = e.encodedDataLength; q.fim = e.timestamp; } });
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${PORTA}/?resfixa`, { waitUntil: 'load', timeout: 180000 });
    const nav0 = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: fcp?.startTime ?? null, ttfb: n.responseStart }; });
    const menuMs = Date.now() - t0;
    // treino → mapa → jogar o capítulo 1: quanto tempo até o primeiro quadro da fase e o que foi baixado até lá
    const bytesMenu = [...pedidos.values()].reduce((s, q) => s + (q.bytes ?? 0), 0);
    const t1 = Date.now();
    await p.click('#bt-treino');
    await p.waitForSelector('#mapa:not([hidden])', { timeout: 60000 });
    const tMapa = Date.now() - t1;
    const t2 = Date.now();
    await p.click('#bt-jogar');
    await p.waitForFunction(() => window.__sonda.primeiroDesenhoEm > 0 && window.__sonda.quadros.length > 2, null, { timeout: 180000 });
    const tFase = Date.now() - t2;
    const s = await sonda(p);
    await pausa(perfil === 'sem' ? 1500 : 4000);
    const todos = [...pedidos.values()];
    const porTipo = {};
    for (const q of todos) { const k = q.url.split('?')[0].split('/')[0].replace(/\..*$/, '') || 'pagina'; (porTipo[k] ??= { n: 0, KB: 0 }); porTipo[k].n++; porTipo[k].KB += kb(q.bytes ?? 0); }
    res[perfil] = { ttfbMs: Math.round(nav0.ttfb), fcpMs: Math.round(nav0.fcp), dclMs: Math.round(nav0.dcl), loadMs: Math.round(nav0.load), menuProntoMs: menuMs,
      bytesAteMenuKB: kb(bytesMenu), treinoAteMapaMs: tMapa, jogarAtePrimeiroQuadroMs: tFase, montarFaseMs: Math.round(s.primeiroDesenhoEm - s.ctxCriadoEm),
      compilarShadersMs: Math.round(s.compilarMs), programas: s.programas, tarefasLongas: s.longas.filter((l) => l[1] > 50).map((l) => Math.round(l[1])).slice(-8),
      porPasta: porTipo, maiores: todos.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 8).map((q) => `${q.url} ${kb(q.bytes ?? 0)} KB`) };
    console.log(perfil, JSON.stringify(res[perfil]));
    await ctx.close();
  }
  writeFileSync(join(SAIDA, `carga_${arg('disp', 'redmi')}.json`), JSON.stringify(res, null, 1));
}

// ---------- cenas: capítulo × qualidade ----------
async function voltarAoMapa(p) {
  for (let i = 0; i < 20; i++) {
    const t = await p.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return e && !e.hidden && e.offsetParent !== null; }; return v('#mapa') ? 'mapa' : v('#concluido') ? 'concluido' : v('#quadrinhos') ? 'quadrinhos' : v('#pausa') ? 'pausa' : 'jogo'; });
    if (t === 'mapa') return true;
    if (t === 'concluido') await p.click('#bt-conc-continuar').catch(() => {});
    else if (t === 'quadrinhos') await p.click('#bt-pular').catch(() => {});
    else if (t === 'pausa') await p.click('#bt-pausa-mapa').catch(() => {});
    else await p.evaluate(() => document.querySelector('#bt-pausa')?.click());
    await pausa(400);
  }
  return false;
}
async function roteiros(caps) {
  process.chdir(RAIZ);
  const { gravarRoteiros } = await import(join(RAIZ, 'test/e2e/roteiros.mjs'));
  return gravarRoteiros(caps);
}
const resumoQuadros = (qs) => {
  if (!qs.length) return {};
  const ord = (i) => qs.map((q) => q[i]).sort((a, b) => a - b);
  const pc = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const cpu = ord(1), ch = ord(2), tri = ord(3);
  return { n: qs.length, cpuMed: r1(pc(cpu, 0.5)), cpuP95: r1(pc(cpu, 0.95)), chMed: pc(ch, 0.5), chMax: ch.at(-1), triMedK: Math.round(pc(tri, 0.5) / 1000), triMaxK: Math.round(tri.at(-1) / 1000) };
};
async function cmdCenas(nav) {
  const caps = lista('caps', '1,2,3,4,5,6,7').map(Number);
  const qs = lista('q', 'baixa,media,alta');
  const disp = arg('disp', 'redmi');
  const acel = Number(arg('acel', 6));
  const R = await roteiros(caps);
  const res = {};
  for (const q of qs) for (const n of caps) {
    const { ctx, p, cdp, erros } = await abrir(nav, disp);
    await p.goto(`http://127.0.0.1:${PORTA}/?q=${q}&resfixa`);
    await p.click('#bt-treino');
    await p.waitForSelector('#mapa:not([hidden])');
    const h0 = await heap(cdp, true);
    await p.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
    const tc = Date.now();
    await p.click('#bt-jogar');
    await p.waitForFunction((n) => window.__edm?.cap === n && window.__sonda.quadros.length > 3, n, { timeout: 120000 });
    const tPronto = Date.now() - tc;
    const s0 = await sonda(p);
    const h1 = await heap(cdp, true);
    // primeiro um trecho em tempo real (acelerar 1): custo de CPU por quadro sem passos extras de simulação
    await p.evaluate(([l]) => { window.__edm.acelerar(1); window.__edm.roteiro(l); window.__sonda.zerar(); }, [R[n].lista]);
    await pausa(Number(arg('seg', 6)) * 1000);
    const real = await p.evaluate(() => window.__sonda.quadros.slice());
    // depois a fase inteira acelerada (máximos de chamadas, triângulos, texturas e programas)
    await p.evaluate(([l, k]) => { window.__sonda.zerar(); window.__edm.acelerar(k); return window.__edm.roteiro(l); }, [R[n].lista, acel]);
    const m = { ch: 0, tri: 0, texMax: 0, texMBMax: 0, bufMBMax: 0, progMax: 0, quadros: [] };
    const fotos = arg('fotos', false) ? [0.3, 0.6] : [];
    const total = R[n].lista.length; const t0 = Date.now();
    for (;;) {
      const st = await p.evaluate(() => { const e = window.__edm?.estado(); const i = window.__edm?.info(); const S = window.__sonda; return e && { tick: e.tick, c: e.concluida, i, tex: S.tex, texMB: S.texBytes / 2 ** 20, lista: S.texLista(), bufMB: S.bufBytes / 2 ** 20, prog: S.programas, q: S.quadros.splice(0) }; }).catch(() => null);
      if (!st) break;
      m.ch = Math.max(m.ch, st.i.chamadas); m.tri = Math.max(m.tri, st.i.triangulos); m.texMax = Math.max(m.texMax, st.tex);
      if (st.texMB >= m.texMBMax) m.texLista = st.lista;
      m.texMBMax = Math.max(m.texMBMax, st.texMB); m.bufMBMax = Math.max(m.bufMBMax, st.bufMB); m.progMax = Math.max(m.progMax, st.prog);
      m.quadros.push(...st.q);
      while (fotos.length && st.tick >= fotos[0] * total) { const f = fotos.shift(); await p.evaluate(() => window.__edm.acelerar(1)); await pausa(400); await p.screenshot({ path: join(SAIDA, `cap${n}_${q}_${Math.round(f * 100)}.png`) }); await p.evaluate((k) => window.__edm.acelerar(k), acel); }
      if (st.c || Date.now() - t0 > 240000) break;
      await pausa(150);
    }
    const s1 = await sonda(p);
    const h2 = await heap(cdp, true);
    // volta ao mapa (pausa → mapa, ou concluído → lembrança → mapa): a memória da fase é devolvida?
    await voltarAoMapa(p);
    await pausa(500);
    const h3 = await heap(cdp, true);
    const tempoReal = real.length > 2 ? (real.at(-1)[0] - real[0][0]) / 1000 : 0;
    res[`${n}_${q}`] = {
      cap: n, q, disp, abrirFaseMs: tPronto, montarAtePrimeiroDesenhoMs: Math.round(s0.primeiroDesenhoEm - s0.ctxCriadoEm),
      programas: s1.programas, compilacoesNoInicio: s0.compilacoes, compilacoes: s1.compilacoes, compilarShadersMs: Math.round(s1.compilarMs), maiorCompilarMs: Math.round(s1.maiorCompilarMs),
      chamadasMax: m.ch, triMaxK: Math.round(m.tri / 1000), quadrosAcel: resumoQuadros(m.quadros), quadrosTempoReal: { ...resumoQuadros(real), fpsSwiftShader: tempoReal ? r1(real.length / tempoReal) : 0 },
      texturas: m.texMax, texMB: r1(m.texMBMax), buffers: s1.buf, bufMB: r1(m.bufMBMax), renderbuffers: s1.rb, rbMB: r1(s1.rbMB), framebufferPadraoMB: r1(s1.fbMB), canvas: s1.canvas, antialias: s1.aa,
      vramEstimadaMB: r1(m.texMBMax + m.bufMBMax + s1.rbMB + s1.fbMB), maioresTexturas: m.texLista ?? s1.texLista,
      heap: { mapaAntes: h0, faseAberta: h1, fimDaFase: h2, mapaDepois: h3 }, tarefasLongas: s0.longas.filter((l) => l[1] > 50).map((l) => Math.round(l[1])).slice(-6), erros: erros.slice(0, 3),
    };
    console.log(`cap ${n} [${q}] ${JSON.stringify({ ...res[`${n}_${q}`], heap: undefined })}`);
    await ctx.close();
  }
  writeFileSync(join(SAIDA, `cenas_${disp}.json`), JSON.stringify(res, null, 1));
}

// ---------- cpu: perfil CDP agrupado por módulo de origem (sourcemap) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function lerMapa(arq) {
  const m = JSON.parse(readFileSync(arq + '.map', 'utf8'));
  const linhas = m.mappings.split(';'); let src = 0; const tabela = [];
  for (const ml of linhas) {
    let col = 0; const segs = [];
    for (const s of ml.split(',')) {
      if (!s) continue; const v = []; let x = 0, sh = 0;
      for (const ch of s) { const d = B64.indexOf(ch); x += (d & 31) << sh; if (d & 32) sh += 5; else { v.push(x & 1 ? -(x >> 1) : x >> 1); x = 0; sh = 0; } }
      col += v[0]; if (v.length > 1) src += v[1]; segs.push([col, src]);
    }
    tabela.push(segs);
  }
  return (linha, coluna) => {
    const segs = tabela[linha]; if (!segs?.length) return '?';
    let lo = 0, hi = segs.length - 1, r = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid][0] <= coluna) { r = mid; lo = mid + 1; } else hi = mid - 1; }
    return m.sources[segs[r][1]] ?? '?';
  };
}
const grupo = (s) => {
  if (s.includes('three/examples/jsm/postprocessing')) return 'three: pós-processo';
  if (s.includes('node_modules/three/src/renderers')) return 'three: WebGLRenderer';
  if (s.includes('node_modules/three')) return 'three: núcleo (matrizes, cena)';
  if (s.includes('node_modules/')) return 'bibliotecas (peerjs…)';
  const m = s.match(/src\/(.+)$/); if (!m) return s || '?';
  const f = m[1];
  if (f.startsWith('core/')) return `simulação: ${f}`;
  return f;
};
async function cmdCpu(nav) {
  const caps = lista('caps', '2').map(Number); const qs = lista('q', 'media'); const seg = Number(arg('seg', 8));
  const R = await roteiros(caps);
  const js = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  if (!existsSync(join(DIST, 'assets', js[0] + '.map'))) throw new Error('o build precisa de --sourcemap (npx vite build --sourcemap --outDir …) e --dist apontando para ele');
  const mapas = Object.fromEntries(js.map((f) => [f, lerMapa(join(DIST, 'assets', f))]));
  const res = {};
  for (const q of qs) for (const n of caps) {
    const { ctx, p, cdp } = await abrir(nav, arg('disp', 'redmi'));
    await p.goto(`http://127.0.0.1:${PORTA}/?q=${q}&resfixa`);
    await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
    await p.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await p.click('#bt-jogar');
    await p.waitForFunction((n) => window.__edm?.cap === n && window.__sonda.quadros.length > 3, n, { timeout: 120000 });
    const montar = await cdp.send('Profiler.stop');
    await p.evaluate(([l]) => { window.__edm.acelerar(1); window.__edm.roteiro(l); window.__sonda.zerar(); }, [R[n].lista]);
    await pausa(1500);
    await cdp.send('Profiler.start');
    await pausa(seg * 1000);
    const jogo = await cdp.send('Profiler.stop');
    const nq = await p.evaluate(() => window.__sonda.quadros.length);
    const agrupar = ({ profile }) => {
      const por = {}; const dt = {}; const nos = new Map(profile.nodes.map((x) => [x.id, x]));
      profile.samples.forEach((id, i) => { dt[id] = (dt[id] ?? 0) + (profile.timeDeltas[i] ?? 0); });
      let total = 0;
      for (const [id, us] of Object.entries(dt)) {
        const no = nos.get(Number(id)); const cf = no.callFrame; let g;
        const arq = cf.url.split('/').pop();
        if (mapas[arq]) g = grupo(mapas[arq](cf.lineNumber, cf.columnNumber));
        else if (cf.functionName === '(idle)' || cf.functionName === '(program)') g = cf.functionName;
        else if (cf.functionName === '(garbage collector)') g = '(coleta de lixo)';
        else if (!cf.url) g = `(nativo: ${cf.functionName || 'anônimo'})`;
        else g = '(outros scripts)';
        por[g] = (por[g] ?? 0) + us; if (g !== '(idle)') total += us;
      }
      const js = Object.entries(por).filter(([g]) => !g.startsWith('(')).reduce((s, [, us]) => s + us, 0);
      return { ocupadoMs: Math.round(total / 1000), jsMs: Math.round(js / 1000), top: Object.entries(por).filter(([g]) => g !== '(idle)').sort((a, b) => b[1] - a[1]).slice(0, 16).map(([g, us]) => [g, Math.round(us / 1000), Math.round((100 * us) / total)]) };
    };
    const g = agrupar(jogo);
    res[`${n}_${q}`] = { montarFase: agrupar(montar), jogo: { ...g, segundos: seg, quadros: nq, jsMsPorQuadro: nq ? r1(g.jsMs / nq) : null } };
    console.log(n, q, JSON.stringify(res[`${n}_${q}`], null, 1));
    await ctx.close();
  }
  writeFileSync(join(SAIDA, 'cpu.json'), JSON.stringify(res, null, 1));
}

// ---------- rede: dupla com servidor PeerJS local, tamanho/frequência dos instantâneos, latência e perda ----------
async function cmdRede(nav) {
  process.chdir(RAIZ);
  const { PeerServer } = require(join(RAIZ, 'node_modules/peer'));
  let sinal; const portaSinal = await new Promise((r) => { sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
  const R = await roteiros([1]);
  const res = {};
  const cenarios = [];
  for (const lat of lista('lat', '0,80,200').map(Number)) for (const perda of lista('perda', '0,3').map(Number)) cenarios.push({ lat, perda, jitter: Number(arg('jitter', 30)) * (lat ? 1 : 0) });
  for (const c of cenarios) {
    const base = `http://127.0.0.1:${PORTA}/?q=baixa&resfixa&sinal=127.0.0.1:${portaSinal}`;
    const A = await abrir(nav, arg('disp', 'mini')); const B = await abrir(nav, arg('disp', 'mini')); // tela pequena: sem GPU, quadros fluindo
    // latência de ida em cada sentido (cada lado atrasa o que recebe)
    for (const x of [A, B]) await x.p.addInitScript((c) => { window.__redeSim = c; }, c);
    await A.p.goto(base); await B.p.goto(base);
    await A.p.click('#bt-criar');
    await A.p.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
    await B.p.fill('#codigo', await A.p.textContent('#sala-codigo')); await B.p.click('#bt-entrar');
    await A.p.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
    await A.p.click('#bt-pular');
    await A.p.waitForSelector('#mapa:not([hidden])');
    await A.p.click('#bt-jogar');
    await A.p.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 60000 });
    await B.p.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 60000 });
    // já na fase: encolhe as duas janelas (sem GPU, para a simulação do anfitrião não atrasar por quadro lento)
    for (const x of [A, B]) await x.p.evaluate(() => { Object.defineProperty(window, 'innerWidth', { get: () => 200 }); Object.defineProperty(window, 'innerHeight', { get: () => 90 }); dispatchEvent(new Event('resize')); });
    await pausa(800);
    await A.p.evaluate(() => { window.__sonda.rede.hist.length = 0; window.__sonda.rede.env = 0; window.__sonda.rede.envBytes = 0; });
    await B.p.evaluate(() => { window.__sonda.rede.hist.length = 0; window.__sonda.rede.env = 0; window.__sonda.rede.envBytes = 0; });
    // tempo do botão do convidado até ele ver o próprio boneco reagir (pulo do P2): ida + simulação + volta + buffer.
    // Antes do roteiro (com roteiro, o anfitrião ignora a entrada remota). 3 tentativas, mediana.
    const reacoes = [];
    for (let k = 0; k < 3; k++) {
      reacoes.push(await B.p.evaluate(async () => {
        const t = performance.now();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        return await new Promise((r) => { const f = () => { const j = window.__edm.estado().jogadores[1]; if (j.vy > 1) { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })); r(performance.now() - t); } else if (performance.now() - t > 4000) { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })); r(null); } else requestAnimationFrame(f); }; f(); });
      }).catch(() => null));
      await pausa(1500);
    }
    const reacao = reacoes.filter((x) => x !== null).sort((x, y) => x - y)[1] ?? null;
    await A.p.evaluate(([l]) => { window.__edm.acelerar(1); return window.__edm.roteiro(l); }, [R[1].lista]);
    // amostra: o convidado mostra qual tick, e o quanto ele está atrás/desviado do anfitrião
    const am = []; const t0 = Date.now(); let congel = 0, ultimoTick = -1, iguais = 0;
    while (Date.now() - t0 < Number(arg('seg', 12)) * 1000) {
      const [a, b] = await Promise.all([A.p.evaluate(() => window.__edm.estado().tick), B.p.evaluate(() => { const e = window.__edm.estado(); return { tick: e.tick, p: e.jogadores.map((j) => [j.x, j.y]) }; })]);
      const h = await A.p.evaluate((t) => window.__edm.posicoes(t), b.tick);
      const desvio = h ? Math.max(...h.map((pp, i) => Math.hypot(pp[0] - b.p[i][0], pp[1] - b.p[i][1]))) : null;
      am.push({ atrasoTicks: a - b.tick, desvio });
      if (b.tick === ultimoTick) { iguais++; if (iguais === 3) congel++; } else iguais = 0;
      ultimoTick = b.tick;
      await pausa(50);
    }
    const ra = await A.p.evaluate(() => window.__sonda.rede); const rb = await B.p.evaluate(() => window.__sonda.rede);
    const dur = (h) => (h.length > 1 ? (h.at(-1)[0] - h[0][0]) / 1000 : 1);
    const tamMed = (h) => { const a = h.map((x) => x[1]).sort((x, y) => x - y); return a.length ? { med: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)], max: a.at(-1) } : {}; };
    const desv = am.map((x) => x.desvio).filter((x) => x !== null).sort((x, y) => x - y);
    const atr = am.map((x) => x.atrasoTicks).sort((x, y) => x - y);
    const k = `lat${c.lat}_jit${c.jitter}_perda${c.perda}`;
    res[k] = { ...c, anfitriao: { msgPorSeg: r1(ra.hist.length / dur(ra.hist)), KBps: r1(ra.hist.reduce((s, x) => s + x[1], 0) / 1024 / dur(ra.hist)), bytesMsg: tamMed(ra.hist) },
      convidado: { msgPorSeg: r1(rb.hist.length / dur(rb.hist)), KBps: r1(rb.hist.reduce((s, x) => s + x[1], 0) / 1024 / dur(rb.hist)), bytesMsg: tamMed(rb.hist) },
      atrasoConvidadoTicks: { med: atr[Math.floor(atr.length / 2)], p95: atr[Math.floor(atr.length * 0.95)] },
      desvioPosicaoM: { med: r1(desv[Math.floor(desv.length / 2)] ?? 0), p95: r1(desv[Math.floor(desv.length * 0.95)] ?? 0) }, congelamentos: congel, reacaoPuloConvidadoMs: reacao && Math.round(reacao), reacoes: reacoes.map((x) => x && Math.round(x)),
      fps: { anfitriao: await A.p.evaluate(() => { const q = window.__sonda.quadros; return q.length > 2 ? Math.round(1000 * (q.length - 1) / (q.at(-1)[0] - q[0][0])) : 0; }), convidado: await B.p.evaluate(() => { const q = window.__sonda.quadros; return q.length > 2 ? Math.round(1000 * (q.length - 1) / (q.at(-1)[0] - q[0][0])) : 0; }) } };
    console.log(k, JSON.stringify(res[k]));
    await A.ctx.close(); await B.ctx.close();
  }
  writeFileSync(join(SAIDA, 'rede.json'), JSON.stringify(res, null, 1));
  sinal.close?.();
}


// ---------- arena: retrato da Arena do Coração (em desenvolvimento por outra equipe; só um instantâneo) ----------
async function cmdArena(nav) {
  const res = {};
  for (const q of lista('q', 'baixa,media,alta')) for (const perfil of lista('perfis', 'sem,4g')) {
    const { ctx, p, cdp } = await abrir(nav, arg('disp', 'redmi'), { rede: REDE[perfil], cache: false });
    let bytes = 0; const modelos = [];
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
    cdp.on('Network.responseReceived', (e) => { if (/modelos\//.test(e.response.url)) modelos.push(e.response.url.split('/').pop()); });
    await p.goto(`http://127.0.0.1:${PORTA}/?q=${q}&resfixa`);
    await p.click('#bt-treino'); await p.waitForSelector('#mapa:not([hidden])');
    await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[6].click());
    await p.waitForSelector('#bt-arena:not([hidden])', { timeout: 10000 });
    const b0 = bytes, t0 = Date.now();
    await p.click('#bt-arena');
    await p.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 300000 });
    const tPronta = Date.now() - t0, bArena = bytes - b0;
    await pausa(4000);
    const s = await sonda(p); const i = await p.evaluate(() => window.__edm.info());
    const h = await heap(cdp, true);
    res[`${q}_${perfil}`] = { q, perfil, prontaMs: tPronta, baixadoKB: kb(bArena), modelos: modelos.length, chamadas: i.chamadas, triK: Math.round(i.triangulos / 1000), programas: s.programas,
      compilarShadersMs: Math.round(s.compilarMs), texturas: s.tex, texMB: r1(s.texMB), bufMB: r1(s.bufMB), rbMB: r1(s.rbMB), fbMB: r1(s.fbMB), canvas: s.canvas, maioresTexturas: s.texLista, heap: h,
      tarefasLongas: s.longas.filter((l) => l[1] > 50).map((l) => Math.round(l[1])).slice(-6) };
    console.log('arena', q, perfil, JSON.stringify(res[`${q}_${perfil}`]));
    await ctx.close();
  }
  writeFileSync(join(SAIDA, 'arena.json'), JSON.stringify(res, null, 1));
}

// ---------- principal ----------
if (cmd === 'bundle') { await cmdBundle(); process.exit(0); }
if (!['carga', 'cenas', 'cpu', 'rede', 'arena'].includes(cmd)) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 16).join('\n')); process.exit(1); }
const srv = await servir(DIST, PORTA);
const nav = await chromium.launch();
try {
  if (cmd === 'carga') await cmdCarga(nav);
  if (cmd === 'cenas') await cmdCenas(nav);
  if (cmd === 'cpu') await cmdCpu(nav);
  if (cmd === 'rede') await cmdRede(nav);
  if (cmd === 'arena') await cmdArena(nav);
} finally { await nav.close(); srv.close(); }
process.exit(0);
