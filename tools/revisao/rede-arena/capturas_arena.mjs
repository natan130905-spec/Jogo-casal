// Capturas REPRODUTÍVEIS da Arena do Coração (3D) para comparar antes/depois: relógio falso (Playwright clock), luta
// gravada dos bots em dupla (test/e2e/roteiro_arena.mjs) reproduzida num aparelho só (treino + __edm.roteiro(l,
// { dupla: true })), câmera do Natan. Em cada ponto: a foto e as medidas da câmera (__edm.camera(): altura de cada
// personagem em fração da tela, distância). No Golpe do Fio Vermelho e num acerto de golpe, também a CURVA de
// luminância quadro a quadro (média da tela e da região central), para medir o clarão.
// Uso: node tools/revisao/rede-arena/capturas_arena.mjs --rotulo antes [--raiz <cópia>] [--q media] [--porta 4890]
// Saída: test-out/revisao/arena/<rótulo>/ (fotos, medidas.json). Sem GPU (SwiftShader): imagem certa, fps não vale.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', resolve(aqui, '../../..')));
const rotulo = opt('rotulo', 'arena');
const q = opt('q', 'media');
const porta = Number(opt('porta', 4890));
const [W, H] = opt('tam', '844x390').split('x').map(Number);
const saida = resolve(opt('saida', join(raiz, 'test-out/revisao/arena', rotulo)));
mkdirSync(saida, { recursive: true });

const req = createRequire(join(raiz, 'package.json'));
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const { createServer } = await import(req.resolve('vite'));
const vs = await createServer({ root: raiz, configFile: existsSync(join(raiz, 'vite.config.ts')) ? join(raiz, 'vite.config.ts') : false, server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await vs.listen();
const { BotArena } = await vs.ssrLoadModule('/test/arena_bot.ts');
const { estadoInicialArena, passoArena } = await vs.ssrLoadModule('/src/core/arena/index.ts');

// luta em dupla dos bots (mesma de test/e2e/roteiro_arena.mjs) e os ticks dos eventos
const comprimir = (i) => [Math.round(i.x * 1000) / 1000, Math.round(i.y * 1000) / 1000, (i.pulo ? 1 : 0) | (i.golpe ? 2 : 0) | (i.tiro ? 4 : 0) | (i.esquiva ? 8 : 0) | (i.poder ? 16 : 0)];
const des = ([x, y, b]) => ({ x, y, yaw: 0, pulo: !!(b & 1), golpe: !!(b & 2), tiro: !!(b & 4), esquiva: !!(b & 8), poder: !!(b & 16) });
const e = estadoInicialArena({ treino: false });
const bots = [new BotArena(0, { acerto: 1, desvio: 1, semente: 11 }), new BotArena(1, { acerto: 1, desvio: 1, semente: 17 })];
const lista = []; const marcos = {};
while (!e.vitoria && e.tick < 900 * 60) {
  const ents = [bots[0].entrada(e), bots[1].entrada(e)].map(comprimir);
  lista.push(ents); passoArena(e, ents.map(des));
  for (const ev of e.eventos) (marcos[ev.split(':').slice(0, 3).join(':')] ??= []).push(e.tick);
}
const fio = marcos['fio-vermelho'][0];
const golpe = marcos['acerto-rei:0:golpe'][0];
const parede = marcos['parede-ergueu'][0];
// pontos de foto: [nome, tick]; curvas: [nome, tick inicial, ticks]
const fotos = [
  ['inicio_golpes', golpe - 4], ['golpe_acerto', golpe + 1], ['golpe_depois', golpe + 5],
  ['fio_0', fio + 1], ['fio_6', fio + 6], ['fio_12', fio + 12], ['fio_20', fio + 20],
  ['fase3_parede', parede + 40], ['fase3_parede_2', parede + 160],
].sort((a, b) => a[1] - b[1]);
const curvas = [['curva_golpe', golpe - 2, 16], ['curva_fio', fio - 2, 40]];
console.log(`luta de ${lista.length} ticks; golpe ${golpe}, fio ${fio}, parede ${parede}`);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const log = [];
p.on('pageerror', (er) => log.push(er.message));
await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); try { screen.orientation.lock = () => Promise.resolve(); } catch {} });
await p.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
await p.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
await p.goto(`http://127.0.0.1:${porta}/?q=${q}&resfixa`);
await p.waitForSelector('#bt-treino');
await p.clock.runFor(500);
await p.click('#bt-treino');
await p.waitForSelector('#mapa:not([hidden])');
await p.evaluate(() => document.querySelectorAll('#mapa .ilha')[6].click());
await p.click('#bt-arena');
const QUADRO = 1000 / 60;
for (let k = 0; k < 2000 && !(await p.evaluate(() => window.__edm?.arena && window.__edm.pronta()).catch(() => false)); k++) await p.clock.runFor(50);
await p.addStyleTag({ content: '#jogo > :not(canvas){visibility:hidden !important}' });
for (let k = 0; k < 3; k++) await p.clock.runFor(QUADRO);
const aceito = await p.evaluate((l) => window.__edm.roteiro(l, { dupla: true }), lista);
if (!aceito) throw new Error('roteiro recusado');
const tick = () => p.evaluate(() => window.__edm.estado().tick);
/** luminância média (0–255) da tela e do terço central */
const luminancia = (buf) => p.evaluate(async (b64) => {
  const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = new OffscreenCanvas(160, 74); const g = c.getContext('2d'); g.drawImage(im, 0, 0, 160, 74);
  const d = g.getImageData(0, 0, 160, 74).data;
  let s = 0, sc = 0, n = 0, nc = 0, br = 0;
  for (let y = 0; y < 74; y++) for (let x = 0; x < 160; x++) {
    const i = (y * 160 + x) * 4, l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    s += l; n++; if (l > 235) br++;
    if (x > 53 && x < 107 && y > 18 && y < 56) { sc += l; nc++; }
  }
  return { media: +(s / n).toFixed(1), centro: +(sc / nc).toFixed(1), quaseBranco: +(br / n).toFixed(3) };
}, buf.toString('base64'));

async function irAte(alvo) {
  let t = await tick();
  if (t < alvo - 100) {
    await p.setViewportSize({ width: Math.round(W / 4), height: Math.round(H / 4) });
    await p.evaluate(() => window.__edm.acelerar(30));
    for (let k = 0; k < 4000 && (t = await tick()) < alvo - 90; k++) await p.clock.runFor(QUADRO);
    await p.evaluate(() => window.__edm.acelerar(1));
    await p.setViewportSize({ width: W, height: H });
  }
  for (let k = 0; k < 400 && (t = await tick()) < alvo; k++) await p.clock.runFor(QUADRO);
  return t;
}

const medidas = { rotulo, raiz, q, tam: `${W}x${H}`, marcos: { golpe, fio, parede }, fotos: [], curvas: {} };
const pendentes = [...fotos];
async function foto(n) {
  const buf = await p.screenshot({ path: join(saida, `${n}.png`) });
  const cam = await p.evaluate(() => window.__edm.camera?.() ?? null);
  const lum = await luminancia(buf);
  const t = await tick();
  medidas.fotos.push({ nome: n, tick: t, camera: cam, luminancia: lum });
  console.log(`${n} tick ${t}  ${JSON.stringify(cam)}  ${JSON.stringify(lum)}`);
}
const naCurva = (t) => curvas.find(([, t0, d]) => t >= t0 && t < t0 + d);
while (pendentes.length) {
  const [, t0] = naCurva(pendentes[0][1]) ?? [null, pendentes[0][1]];
  let t = await irAte(Math.min(t0, pendentes[0][1]));
  // dentro de uma curva: quadro a quadro, medindo a luz e tirando as fotos que caem nela
  while (naCurva(t) || (pendentes.length && pendentes[0][1] <= t)) {
    const c = naCurva(t);
    if (c) { const buf = await p.screenshot(); (medidas.curvas[c[0]] ??= []).push({ tick: t, ...(await luminancia(buf)) }); }
    while (pendentes.length && pendentes[0][1] <= t) await foto(pendentes.shift()[0]);
    if (!naCurva(t) && !(pendentes.length && naCurva(pendentes[0][1]))) break;
    await p.clock.runFor(QUADRO); t = await tick();
    if (!naCurva(t) && pendentes.length && pendentes[0][1] > t) break;
  }
}
for (const [n, serie] of Object.entries(medidas.curvas)) {
  const base = serie[0].centro, pico = Math.max(...serie.map((s) => s.centro));
  const acima = serie.filter((s) => s.centro > base + 15).length;
  medidas.curvas[n] = { base, pico, quadrosAcimaBase15: acima, picoQuaseBranco: Math.max(...serie.map((s) => s.quaseBranco)), serie };
  console.log(`${n}: base ${base}, pico ${pico} (centro), ${acima} quadros > base+15, pico de pixels quase brancos ${medidas.curvas[n].picoQuaseBranco}`);
}
medidas.erros = log;
writeFileSync(join(saida, 'medidas.json'), JSON.stringify(medidas, null, 1));
await nav.close(); await vs.close();
console.log(`ok: ${saida}`);
process.exit(0);
