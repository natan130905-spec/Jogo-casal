// E2E: dois "celulares" em paisagem; A cria a sala, B entra pelo código; confere sincronização e o pulo cooperativo.
// Uso: node test/e2e/dupla.mjs [--publico]   (sem --publico usa um servidor PeerJS local na porta 9137)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const publico = process.argv.includes('--publico');
const saida = new URL('../../test-out/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
let sinal = null;
if (!publico) sinal = PeerServer({ port: 9137, path: '/', host: '127.0.0.1' });
const srv = await preview({ preview: { port: 4719, host: '127.0.0.1' }, logLevel: 'error' });
const base = `http://127.0.0.1:4719/?q=media${publico ? '' : '&sinal=127.0.0.1:9137'}`;
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const cel = { ...devices['Pixel 7 landscape'] };
const A = await (await navegador.newContext(cel)).newPage();
const B = await (await navegador.newContext(cel)).newPage();
const log = [];
for (const [n, p] of [['A', A], ['B', B]]) p.on('console', (m) => { if (m.type() === 'error') log.push(`${n}: ${m.text()}`); });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= c; };

await A.goto(base); await B.goto(base);
await A.click('#bt-criar');
await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
const codigo = await A.textContent('#sala-codigo');
checar(true, `sala criada com código ${codigo}`);
await B.fill('#codigo', codigo); await B.click('#bt-entrar');
await A.waitForSelector('#jogo:not([hidden])', { timeout: 30000 });
await B.waitForSelector('#jogo:not([hidden])', { timeout: 30000 });
checar(true, 'os dois entraram no jogo');
await pausa(1500);
await A.screenshot({ path: saida + 'A_inicio.png' }); await B.screenshot({ path: saida + 'B_inicio.png' });

// B (P2) anda para a direita pelo teclado; A deve ver o P2 andar
const xP2 = async (p) => p.evaluate(() => window.__edm?.estado().jogadores[1].x);
const antes = await xP2(A);
await B.keyboard.down('ArrowRight'); await pausa(1200); await B.keyboard.up('ArrowRight'); await pausa(400);
const depois = await xP2(A);
checar(depois - antes > 3, `P2 andou no anfitrião: ${antes?.toFixed(2)} → ${depois?.toFixed(2)}`);
const xEmB = await B.evaluate(() => window.__edm?.estado().jogadores[1].x);
checar(Math.abs(xEmB - depois) < 0.6, `convidado vê a mesma posição (${xEmB?.toFixed(2)})`);
// A (P1) pula; B deve ver
await A.keyboard.down('Space');
let yP1emB = 0;
for (let k = 0; k < 10; k++) { await pausa(120); yP1emB = Math.max(yP1emB, await B.evaluate(() => window.__edm?.estado().jogadores[0].y)); }
await A.keyboard.up('Space');
checar(yP1emB > 0.5, `pulo do P1 aparece no convidado (y=${yP1emB?.toFixed(2)})`);
await pausa(800);
await A.screenshot({ path: saida + 'A_depois.png' }); await B.screenshot({ path: saida + 'B_depois.png' });
const info = await A.textContent('#hud-info');
console.log('HUD A:', info);
checar(log.length === 0, `sem erros no console${log.length ? ': ' + log.slice(0, 3).join(' | ') : ''}`);
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'RESULTADO: APROVADO' : 'RESULTADO: REPROVADO');
process.exit(ok ? 0 : 1);
