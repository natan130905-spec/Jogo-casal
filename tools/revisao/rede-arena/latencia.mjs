// Latência "apertei → o MEU personagem se mexe no MEU quadro" no anfitrião e no convidado (2.5D), com dois
// "celulares" no mesmo Chromium e servidor PeerJS local. Mede o pulo (Espaço → y sobe 2 cm) e a corrida
// (→ segurado → x anda 2 cm). Atraso de rede emulado de uma via, nas duas direções (embrulha RTCDataChannel.send).
// Também confere o toque curto: Espaço apertado e solto no MESMO quadro tem de virar pulo no anfitrião.
// Uso: node tools/revisao/rede-arena/latencia.mjs [atrasoMsUmaVia=0] [repeticoes=6] [pastaDist=dist]
// Base: tools/revisao/auditoria-movimento/latencia.mjs (mesma ideia; esta mede também a corrida e o toque curto).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';

const atraso = Number(process.argv[2] ?? 0);
const reps = Number(process.argv[3] ?? 6);
const outDir = resolve(process.argv[4] ?? 'dist');
const porta = Number(process.env.PORTA ?? 4833);
const portaSinal = await new Promise((r) => { PeerServer({ port: Number(process.env.PORTA_SINAL ?? 9233), path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ build: { outDir }, preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const base = `http://127.0.0.1:${porta}/?q=baixa&sinal=127.0.0.1:${portaSinal}`;
const nav = await chromium.launch();
const A = await (await nav.newContext({ ...devices['Pixel 7 landscape'] })).newPage();
const B = await (await nav.newContext({ ...devices['iPhone 14 landscape'] })).newPage();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
if (atraso > 0) {
  for (const p of [A, B]) await p.addInitScript((ms) => {
    const orig = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (d) { setTimeout(() => { try { orig.call(this, d); } catch { /* fechado */ } }, ms); };
  }, atraso);
}
await A.goto(base); await B.goto(base);
await A.click('#bt-criar');
await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
await B.fill('#codigo', await A.textContent('#sala-codigo')); await B.click('#bt-entrar');
await A.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
await A.click('#bt-pular');
await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
await A.click('#bt-jogar');
// a fase é montada atrás da tela de carregamento (L1, R33): espera a partida pronta
await A.waitForFunction(() => !!window.__edm?.estado, null, { timeout: 120000 });
await B.waitForFunction(() => !!window.__edm?.estado, null, { timeout: 120000 });
await pausa(2500);

/** tipo 'pulo' (Espaço) ou 'corre' (→ e depois ← para voltar). Mede até o personagem `i` se mexer no estado desenhado. */
async function medir(p, i, tipo, sentido = 1) {
  return p.evaluate(async ([i, tipo, sentido]) => {
    const est = () => window.__edm.estado().jogadores[i];
    const quadro = () => new Promise((r) => requestAnimationFrame(r));
    for (let k = 0; k < 200 && !(Math.abs(est().vy) < 1e-6 && Math.abs(est().vx) < 1e-3 && est().noChao); k++) await quadro();
    const x0 = est().x, y0 = est().y;
    const tecla = tipo === 'pulo' ? 'Space' : sentido > 0 ? 'ArrowRight' : 'ArrowLeft';
    const t0 = performance.now(); let n = 0, tVer = NaN; const qs = [];
    window.dispatchEvent(new KeyboardEvent('keydown', { code: tecla }));
    while (performance.now() - t0 < 3000) {
      qs.push(await quadro()); n++;
      const e = est();
      if (tipo === 'pulo' ? e.y > y0 + 0.02 : Math.abs(e.x - x0) > 0.02) { tVer = performance.now() - t0; break; }
    }
    if (tipo === 'corre') for (let k = 0; k < 10; k++) await quadro();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: tecla }));
    const iv = qs.length > 1 ? (qs[qs.length - 1] - qs[0]) / (qs.length - 1) : NaN;
    return { ms: tVer, quadros: n, intervalo: iv };
  }, [i, tipo, sentido]);
}

/** Toque curto no convidado: keydown e keyup no mesmo quadro. Conta quantos viraram pulo no anfitrião. */
async function toqueCurto(n) {
  let pulos = 0;
  for (let k = 0; k < n; k++) {
    await pausa(1100);
    const c0 = await A.evaluate(() => window.__edm.contagem().pulo ?? 0);
    await B.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); });
    await pausa(900 + atraso * 2);
    const c1 = await A.evaluate(() => window.__edm.contagem().pulo ?? 0);
    if (c1 > c0) pulos++;
  }
  return pulos;
}

const res = { anfitriao_pulo: [], convidado_pulo: [], anfitriao_corre: [], convidado_corre: [] };
for (let k = 0; k < reps; k++) {
  res.anfitriao_pulo.push(await medir(A, 0, 'pulo')); await pausa(900);
  res.convidado_pulo.push(await medir(B, 1, 'pulo')); await pausa(900);
  const s = k % 2 ? -1 : 1;
  res.anfitriao_corre.push(await medir(A, 0, 'corre', s)); await pausa(700);
  res.convidado_corre.push(await medir(B, 1, 'corre', s)); await pausa(700);
}
const curtos = await toqueCurto(5);
const resumo = (l) => {
  const ms = l.map((r) => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)];
  const iv = l.map((r) => r.intervalo).filter(Number.isFinite);
  const mIv = iv.reduce((a, b) => a + b, 0) / (iv.length || 1);
  return { mediana_ms: Math.round(med), min_ms: Math.round(ms[0]), max_ms: Math.round(ms[ms.length - 1]), intervalo_quadro_ms: +mIv.toFixed(1), mediana_quadros: +(med / mIv).toFixed(1), n: ms.length };
};
const out = { atraso_uma_via_ms: atraso, dist: outDir };
for (const [k, v] of Object.entries(res)) out[k] = resumo(v);
out.toque_curto_convidado = `${curtos}/5 viraram pulo no anfitrião`;
out.predicao_convidado = await B.evaluate(() => window.__edm.predicao?.() ?? 'sem predição');
console.log(JSON.stringify(out));
await nav.close(); await srv.close(); process.exit(0);
