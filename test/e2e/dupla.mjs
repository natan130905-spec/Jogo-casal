// E2E: dois "celulares" em paisagem (Pixel 7 e iPhone 14); A cria a sala, B entra pelo código; os dois veem o prólogo
// e o mapa juntos, A escolhe o capítulo 1; confere sincronização, o pulo, o tiro (✨/J), a pausa sincronizada; depois
// o anfitrião joga o capítulo 1 inteiro com as entradas gravadas dos bots (window.__edm.roteiro): o convidado tem de
// ver bichinho derrotado por faísca, estrelinha pega, o mesmo placar e o "capítulo concluído"; por fim, a conexão perdida.
// Os 7 capítulos inteiros (treino e dupla): test/e2e/capitulos.mjs.
// Uso: node test/e2e/dupla.mjs [--publico]   (sem --publico usa um servidor PeerJS local)
// Portas: PORTA (vite preview, padrão 4719) e PORTA_SINAL (PeerJS, padrão 9137; 0 = qualquer livre).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { gravarRoteiros } from './roteiros.mjs';

const publico = process.argv.includes('--publico');
const saida = new URL('../../test-out/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
let sinal = null;
const porta = Number(process.env.PORTA ?? 4719);
let portaSinal = Number(process.env.PORTA_SINAL ?? 9137);
if (!publico) {
  const pronto = new Promise((r) => { sinal = PeerServer({ port: portaSinal, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
  portaSinal = await pronto;
}
// DIST=pasta usa outro build (padrão: dist)
const srv = await preview({ ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}), preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const base = `http://127.0.0.1:${porta}/?q=media${publico ? '' : `&sinal=127.0.0.1:${portaSinal}`}`;
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const roteiro1 = (await gravarRoteiros([1]))[1];
const A = await (await navegador.newContext({ ...devices['Pixel 7 landscape'] })).newPage();
const B = await (await navegador.newContext({ ...devices['iPhone 14 landscape'] })).newPage();
const log = [];
for (const [n, p] of [['A', A], ['B', B]]) p.on('console', (m) => { if (m.type() === 'error') log.push(`${n}: ${m.text()}`); });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= c; };

/** Sincronia: o que o convidado mostra (posições, tick) bate com o que o anfitrião simulou perto daquele tick?
 *  Devolve a menor diferença (m) entre o convidado e o anfitrião nos ticks [t-24, t+3], ou null. */
async function desvioDoConvidado(A, B) {
  const g = await B.evaluate(() => { const e = window.__edm?.estado(); return e && { tick: e.tick, p: e.jogadores.map((j) => [j.x, j.y]) }; }).catch(() => null);
  if (!g) return null;
  return A.evaluate((g) => {
    let melhor = null;
    for (let t = g.tick - 24; t <= g.tick + 3; t++) {
      const h = window.__edm?.posicoes?.(t); if (!h) continue;
      const d = Math.max(...h.map((p, i) => Math.hypot(p[0] - g.p[i][0], p[1] - g.p[i][1])));
      if (melhor === null || d < melhor) melhor = d;
    }
    return melhor;
  }, g).catch(() => null);
}

await A.goto(base); await B.goto(base);
await A.click('#bt-criar');
await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
const codigo = await A.textContent('#sala-codigo');
checar(true, `sala criada com código ${codigo}`);
await B.fill('#codigo', codigo); await B.click('#bt-entrar');
// fluxo: prólogo em quadrinhos nos dois → avança (B pede, A decide) → pula → mapa nos dois → A escolhe o capítulo 1
await A.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
await B.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
checar(true, 'os dois veem o prólogo');
const textoQ = (p) => p.textContent('#qd-texto');
const q0 = await textoQ(A);
await B.click('#qd-painel');
await A.waitForFunction((t) => document.querySelector('#qd-texto').textContent !== t, q0, { timeout: 5000 }).catch(() => {});
const [qa, qb] = [await textoQ(A), await textoQ(B)];
await pausa(300);
checar(qa !== q0 && qa === (await textoQ(B)), `toque do convidado avança o quadrinho nos dois (${qb === qa ? 'igual' : 'diferente'})`);
await A.screenshot({ path: saida + 'A_prologo.png' });
await A.click('#bt-pular');
await A.waitForSelector('#mapa:not([hidden])', { timeout: 10000 });
await B.waitForSelector('#mapa:not([hidden])', { timeout: 10000 });
const progB = await B.evaluate(() => window.__edmFluxo.progresso());
checar(progB.prologoVisto === true, 'convidado recebeu o progresso do anfitrião');
{
  // L2b (R23): o convidado também grava a campanha do casal, com o mesmo id da do anfitrião
  const [sa, sb] = await Promise.all([A, B].map((p) => p.evaluate(() => JSON.parse(localStorage.getItem('edm-salvo-v2') ?? 'null'))));
  const ca = sa?.slots.find((c) => c.id === sa.ativo), cb = sb?.slots.find((c) => c.id === sb.ativo);
  checar(!!ca && !!cb && ca.id === cb.id && cb.prologoVisto === true, `convidado grava edm-salvo-v2 com o mesmo id (${ca?.id} / ${cb?.id})`);
}
checar(await B.isHidden('#bt-jogar') && await A.isVisible('#bt-jogar'), 'só o anfitrião escolhe o capítulo');
await A.screenshot({ path: saida + 'A_mapa.png' }); await B.screenshot({ path: saida + 'B_mapa.png' });
await A.click('#bt-jogar');
// a fase é montada atrás da tela de carregamento (L1, R33): espera a partida pronta, não só a tela do jogo
await A.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 120000 });
await B.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 120000 });
checar(true, 'os dois entraram no jogo');
await pausa(1500);
await A.screenshot({ path: saida + 'A_inicio.png' }); await B.screenshot({ path: saida + 'B_inicio.png' });

// B (P2) anda para a direita pelo teclado; A deve ver o P2 andar
const xP2 = async (p) => p.evaluate(() => window.__edm?.estado().jogadores[1].x);
const tickA = async () => A.evaluate(() => window.__edm?.estado().tick);
const antes = await xP2(A), t0P2 = await tickA();
await B.keyboard.down('ArrowRight'); await pausa(1200);
const t1P2 = await tickA(); await B.keyboard.up('ArrowRight'); await pausa(400);
const depois = await xP2(A);
// em ticks de jogo, não em ms reais: sem GPU e com a máquina carregada o anfitrião roda a 3–4 fps e cada quadro anda
// no máximo 0,1 s de jogo, então 1,2 s reais podem ser só 0,5 s de jogo (5,2 m/s × 0,5 s = 2,6 m)
const esperado = 5.2 * ((t1P2 - t0P2) / 60);
checar(depois - antes > Math.min(3, 0.6 * esperado) && depois - antes > 1, `P2 andou no anfitrião: ${antes?.toFixed(2)} → ${depois?.toFixed(2)} (${t1P2 - t0P2} ticks com a tecla, esperado ≥ ${Math.min(3, 0.6 * esperado).toFixed(2)} m)`);
// o convidado mostra o passado recente (interpolação de 100 ms + rede): espera assentar até 3 s
let xEmB = NaN, xEmA = depois;
for (let k = 0; k < 15; k++) {
  xEmA = await xP2(A); xEmB = await B.evaluate(() => window.__edm?.estado().jogadores[1].x);
  if (Math.abs(xEmB - xEmA) < 0.6) break;
  await pausa(200);
}
checar(Math.abs(xEmB - xEmA) < 0.6, `convidado vê a mesma posição (${xEmB?.toFixed(2)} × ${xEmA?.toFixed(2)})`);
// A (P1) pula; B deve ver
await A.keyboard.down('Space');
let yP1emB = 0;
for (let k = 0; k < 10; k++) { await pausa(120); yP1emB = Math.max(yP1emB, await B.evaluate(() => window.__edm?.estado().jogadores[0].y)); }
await A.keyboard.up('Space');
checar(yP1emB > 0.5, `pulo do P1 aparece no convidado (y=${yP1emB?.toFixed(2)})`);
// predição do convidado (src/net/predicao.ts): o próprio pulo aparece no quadro seguinte, não ~220 ms depois
const latB = await B.evaluate(async () => {
  const est = () => window.__edm.estado().jogadores[1];
  const quadro = () => new Promise((r) => requestAnimationFrame(r));
  for (let k = 0; k < 200 && !(est().noChao && Math.abs(est().vy) < 1e-6); k++) await quadro();
  const y0 = est().y; let n = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  while (n < 60) { await quadro(); n++; if (est().y > y0 + 0.02) break; }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  return n;
});
checar(latB <= 2, `convidado vê o próprio pulo em ${latB} quadro(s) (predição local; antes ≈ 220 ms)`);
await pausa(1200);
// toque curto no convidado (apertou e soltou no mesmo quadro) não se perde: vira pulo no anfitrião
{
  let pulos = 0;
  for (let k = 0; k < 3; k++) {
    const c0 = await A.evaluate(() => window.__edm.contagem().pulo ?? 0);
    await B.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); });
    await pausa(1100);
    if ((await A.evaluate(() => window.__edm.contagem().pulo ?? 0)) > c0) pulos++;
  }
  checar(pulos === 3, `toque curto do convidado vira pulo no anfitrião (${pulos}/3)`);
  const pr = await B.evaluate(() => window.__edm.predicao());
  checar(pr && pr.reconciliacoes > 0 && pr.saltos === 0 && pr.maiorErro < 0.5, `predição reconcilia sem salto (${pr?.reconciliacoes} vezes, maior erro ${pr?.maiorErro?.toFixed(3)} m, médio ${pr?.erroMedio?.toFixed(4)} m)`);
}
// o instantâneo novo traz vida, bichinhos e estrelinhas
const extra = await B.evaluate(() => { const e = window.__edm?.estado(); return { cor: e.jogadores.map((j) => j.coracoes), bichos: e.inimigos.length, casal: e.estrelinhasCasal }; });
checar(extra.cor.every((c) => c >= 1 && c <= 3) && extra.bichos > 0 && extra.casal >= 0, `convidado recebe corações ${extra.cor} e ${extra.bichos} bichinhos`);
// B atira (tecla J): A deve ver o tiro da Bruna (L4: a pedrinha do Estilingue; ela pode bater no cubo logo à frente
// e sumir antes da amostra, por isso vale também a contagem de tiros e a cadência do arsenal)
const tiros0 = await A.evaluate(() => window.__edm.contagem().tiro ?? 0);
await B.keyboard.down('KeyJ');
let viuFaisca = false;
for (let k = 0; k < 40 && !viuFaisca; k++) { await pausa(80); viuFaisca = await A.evaluate((t0) => { const e = window.__edm?.estado(); return e.faiscas.some((f) => f.dono === 1) || e.jogadores[1].arsenal.espera > 0 || (window.__edm.contagem().tiro ?? 0) > t0; }, tiros0); }
await B.keyboard.up('KeyJ');
checar(viuFaisca, 'tiro do convidado (J) aparece no anfitrião');
// HUD: corações dos dois
const cor = await B.evaluate(() => [0, 1].map((i) => document.querySelectorAll(`#cor-${i} i:not(.vazio)`).length));
checar(cor[0] >= 1 && cor[1] >= 1, `HUD mostra corações ${cor}`);
await pausa(800);
await A.screenshot({ path: saida + 'A_depois.png' }); await B.screenshot({ path: saida + 'B_depois.png' });
// pausa sincronizada: B pausa, A também fica pausado; A continua
await B.click('#bt-pausa');
await A.waitForSelector('#pausa:not([hidden])', { timeout: 5000 }).catch(() => {});
const tick1 = await A.evaluate(() => window.__edm.estado().tick); await pausa(500);
const tick2 = await A.evaluate(() => window.__edm.estado().tick);
checar(await A.isVisible('#pausa') && await B.isVisible('#pausa') && tick1 === tick2, `pausa do convidado para a simulação nos dois (tick ${tick1} → ${tick2})`);
await A.click('#bt-continuar');
await B.waitForSelector('#pausa', { state: 'hidden', timeout: 5000 }).catch(() => {});
checar(await B.isHidden('#pausa'), 'continuar tira a pausa nos dois');
const info = await A.textContent('#hud-info');
console.log('HUD A:', info);
// capítulo 1 inteiro: o anfitrião reproduz as entradas dos bots (Natan e Bruna) e o convidado acompanha
checar(await A.evaluate((l) => { window.__edm.acelerar(3); return window.__edm.roteiro(l); }, roteiro1.lista), 'anfitrião começa o capítulo 1 com as entradas gravadas');
const contB0 = await B.evaluate(() => window.__edm.contagem());
let maxDesvio = 0, amostras = 0, ondeMax = -1;
for (let k = 0; k < 900; k++) {
  const h = await A.evaluate(() => window.__edm?.estado().concluida).catch(() => null);
  if (h !== false) break;
  const d = await desvioDoConvidado(A, B);
  if (d !== null) { if (d > maxDesvio) { maxDesvio = d; ondeMax = amostras; } amostras++; }
  if (k === 60) { await A.screenshot({ path: saida + 'A_cap1_meio.png' }); await B.screenshot({ path: saida + 'B_cap1_meio.png' }); }
  await pausa(100);
}
const fimB = await B.evaluate(() => { const e = window.__edm.estado(); return { casal: e.estrelinhasCasal, mortos: e.inimigos.filter((n) => !n.vivo).length, c: e.concluida, cont: window.__edm.contagem() }; });
const fimA = await A.evaluate(() => { const e = window.__edm.estado(); return { casal: e.estrelinhasCasal, mortos: e.inimigos.filter((n) => !n.vivo).length, cont: window.__edm.contagem() }; });
const delta = (t) => (fimB.cont[t] ?? 0) - (contB0[t] ?? 0);
checar(delta('tiro') > 0 && delta('acerto') > 0 && delta('derrota') > 0 && fimB.mortos > 0, `convidado vê tiros (${delta('tiro')}), acertos (${delta('acerto')}) e bichinhos estourando (${fimB.mortos})`);
checar(delta('estrelinha') > 0 && fimB.casal > 0, `convidado vê estrelinhas pegas (★ ${fimB.casal})`);
checar(fimB.casal === fimA.casal && fimB.mortos === fimA.mortos, `placar igual nos dois (★ ${fimA.casal}/${fimB.casal}, bichinhos ${fimA.mortos}/${fimB.mortos})`);
// A8 (L4): arsenal, elementos das armas e mochila iguais no anfitrião e no convidado no fim do capítulo
const arsenal = () => { const e = window.__edm.estado(); return JSON.stringify({ a: e.jogadores.map((j) => [j.arsenal.itens, j.arsenal.atual, j.arsenal.carga, j.arsenal.reserva, j.arsenal.bolsa]),
  el: [e.alvos.map((v) => v > 0), e.barbantes.map((v) => v >= 0), e.rachados, e.baus], db: e.desbloqueadas, f: e.faiscas.length, po: e.potes.length }); };
const arsA = await A.evaluate(arsenal), arsB = await B.evaluate(arsenal);
checar(arsA === arsB && JSON.parse(arsA).db !== 3, `arsenal, sino/barbante/bloco/baú e mochila iguais nos dois (${arsA.slice(0, 120)}…)`);
checar(amostras > 20 && maxDesvio < 0.75, `posições em sincronia durante o capítulo (${amostras} amostras, maior desvio ${maxDesvio.toFixed(2)} m na amostra ${ondeMax})`);
const concA = await A.waitForSelector('#concluido:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false);
const concB = await B.waitForSelector('#concluido:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false);
checar(concA && concB, 'capítulo 1 concluído aparece nos dois');
await A.screenshot({ path: saida + 'A_concluido.png' }); await B.screenshot({ path: saida + 'B_concluido.png' });
const [pA, pB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__edmFluxo.progresso().capitulos[1])));
checar(pA?.estrelinhas === fimA.casal && pB?.estrelinhas === pA?.estrelinhas, `progresso salvo e enviado ao convidado (★ ${pA?.estrelinhas}/${pA?.total})`);
checar(log.length === 0, `sem erros no console${log.length ? ': ' + log.slice(0, 3).join(' | ') : ''}`);
// conexão perdida: B fecha; A mostra a tela de conexão perdida (e fica esperando a volta)
await B.close();
await A.waitForSelector('#caiu:not([hidden])', { timeout: 15000 }).catch(() => {});
checar(await A.isVisible('#caiu'), 'anfitrião mostra "Conexão perdida" quando o convidado sai');
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'RESULTADO: APROVADO' : 'RESULTADO: REPROVADO');
process.exit(ok ? 0 : 1);
