// Latência "apertei o pulo → o MEU personagem começa a subir no MEU quadro", no anfitrião e no convidado, com dois
// "celulares" no mesmo Chromium (rede local ≈ 0 ms: é o PISO do pipeline; some a rede real por cima) e, opcionalmente,
// atraso de rede emulado no convidado (embrulha RTCDataChannel.send com setTimeout).
// Uso (de uma cópia do repositório, depois de `vite build`):
//   node tools/revisao/auditoria-movimento/latencia.mjs [atrasoMsUmaVia=0] [repeticoes=8]
// Portas próprias: PORTA (4791) e PORTA_SINAL (9191). Sem GPU: o quadro do headless é lento; por isso o resultado
// também mostra o intervalo médio entre quadros, e a latência em quadros.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';

const atraso = Number(process.argv[2] ?? 0);
const reps = Number(process.argv[3] ?? 8);
const porta = Number(process.env.PORTA ?? 4791);
const portaSinal = await new Promise((r) => { PeerServer({ port: Number(process.env.PORTA_SINAL ?? 9191), path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const base = `http://127.0.0.1:${porta}/?q=baixa&sinal=127.0.0.1:${portaSinal}`;
const nav = await chromium.launch();
const A = await (await nav.newContext({ ...devices['Pixel 7 landscape'] })).newPage();
const B = await (await nav.newContext({ ...devices['iPhone 14 landscape'] })).newPage();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
if (atraso > 0) {
  // atraso de rede de uma via nas duas direções (cada página atrasa o que envia)
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

/** Aperta Espaço nesta página e mede quanto tempo (e quantos quadros) até o personagem `i` subir no estado desenhado. */
async function medir(p, i) {
  return p.evaluate(async (i) => {
    const est = () => window.__edm.estado().jogadores[i];
    // espera estar no chão e parado
    for (let k = 0; k < 200 && !(Math.abs(est().vy) < 1e-6 && est().y < 0.05); k++) await new Promise((r) => requestAnimationFrame(r));
    const y0 = est().y;
    const quadros = [];
    const t0 = performance.now();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    let n = 0, tVer = NaN;
    while (performance.now() - t0 < 3000) {
      const t = await new Promise((r) => requestAnimationFrame(r));
      quadros.push(t); n++;
      if (est().y > y0 + 0.02) { tVer = performance.now() - t0; break; }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    const iv = quadros.length > 1 ? (quadros[quadros.length - 1] - quadros[0]) / (quadros.length - 1) : NaN;
    return { ms: tVer, quadros: n, intervalo: iv };
  }, i);
}

const res = { anfitriao: [], convidado: [] };
for (let k = 0; k < reps; k++) {
  res.anfitriao.push(await medir(A, 0)); await pausa(900);
  res.convidado.push(await medir(B, 1)); await pausa(900);
}
const resumo = (l) => {
  const ms = l.map((r) => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)];
  const iv = l.map((r) => r.intervalo).filter(Number.isFinite);
  const mIv = iv.reduce((a, b) => a + b, 0) / (iv.length || 1);
  return { mediana_ms: Math.round(med), min_ms: Math.round(ms[0]), max_ms: Math.round(ms[ms.length - 1]), intervalo_quadro_ms: +mIv.toFixed(1), mediana_quadros: +(med / mIv).toFixed(1), n: ms.length };
};
console.log(JSON.stringify({ atraso_uma_via_ms: atraso, anfitriao: resumo(res.anfitriao), convidado: resumo(res.convidado) }));
await nav.close(); await srv.close(); process.exit(0);
