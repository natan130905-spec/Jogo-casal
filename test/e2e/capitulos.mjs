// E2E dos 7 capítulos de ponta a ponta, no jogo de verdade (build de produção), pelo fluxo normal das telas:
// mapa → fase → capítulo concluído → lembrança → mapa → próximo capítulo … → capítulo 7 → fuga do Rei → Arena do
// Coração (luta 3D gravada do bot de test/arena_bot.ts) → concluído → lembrança → final → créditos.
// As entradas são as dos bots cooperativos (test/fases), gravadas na simulação em Node e reproduzidas no navegador
// por window.__edm.roteiro (a simulação é determinística). Mede chamadas de desenho e triângulos por capítulo.
// Uso:
//   node test/e2e/capitulos.mjs treino [baixa,media,alta]   treino sozinho (Pixel 7 em paisagem), uma volta por qualidade
//   node test/e2e/capitulos.mjs dupla                       dupla (Pixel 7 × iPhone 14 em paisagem, PeerJS local)
// Opções por ambiente: PORTA (vite preview, padrão 4841), CAPS=1,3 (só alguns capítulos), ACEL (padrão 6).
// Capturas em test-out/capitulos/. Orçamento: média ≤ 80 chamadas e ≤ 250 mil triângulos.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gravarRoteiros } from './roteiros.mjs';
import { gravarRoteiroArena } from './roteiro_arena.mjs';

const modo = process.argv[2] === 'dupla' ? 'dupla' : 'treino';
const qualidades = modo === 'dupla' ? ['media'] : (process.argv[3] ?? 'media').split(',');
const caps = (process.env.CAPS ?? '1,2,3,4,5,6,7').split(',').map(Number);
const ACEL = Number(process.env.ACEL ?? 6);
const porta = Number(process.env.PORTA ?? 4841);
const ORCAMENTO = { media: { ch: 80, tri: 250000 } };
const saida = new URL('../../test-out/capitulos/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };

console.log(`gravando as entradas dos bots (capítulos ${caps.join(', ')})…`);
const roteiros = await gravarRoteiros(caps);
const lutaArena = caps.includes(7) ? await gravarRoteiroArena({ treino: modo === 'treino' }) : null;
for (const n of caps) console.log(`  cap ${n}: ${roteiros[n].segundos.toFixed(1)} s, ${roteiros[n].estrelinhas} estrelinhas, ${roteiros[n].derrotados} bichinhos`);

let sinal = null, portaSinal = 0;
if (modo === 'dupla') portaSinal = await new Promise((r) => { sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const medidas = {};

async function novaPagina(dispositivo, nome, log) {
  const p = await (await navegador.newContext({ ...devices[dispositivo] })).newPage();
  p.on('console', (m) => { if (m.type() === 'error') log.push(`${nome}: ${m.text()}`); });
  p.on('pageerror', (e) => log.push(`${nome}: ${e.message}`));
  return p;
}

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

/** Joga o capítulo n já aberto em `A` (que simula); `B` (convidado) opcional. Devolve o resumo. */
async function jogarCapitulo(n, q, A, B) {
  const r = roteiros[n], total = r.lista.length;
  await A.waitForFunction((n) => window.__edm?.cap === n, n, { timeout: 30000 });
  if (B) await B.waitForFunction((n) => window.__edm?.cap === n, n, { timeout: 30000 });
  await pausa(600);
  const aceitou = await A.evaluate(([lista, k]) => { window.__edm.acelerar(k); return window.__edm.roteiro(lista); }, [r.lista, ACEL]);
  checar(aceitou, `cap ${n} [${q}]: roteiro aceito`);
  const m = { ch: 0, tri: 0, chB: 0, triB: 0 };
  const fotos = [0.08, 0.3, 0.55, 0.8, 0.97];
  let desvio = 0, amostras = 0;
  const t0 = Date.now();
  for (;;) {
    const s = await A.evaluate(() => { const e = window.__edm?.estado(); const i = window.__edm?.info(); return e && { tick: e.tick, c: e.concluida, i }; }).catch(() => null);
    if (!s) break; // a fase acabou e a tela mudou
    m.ch = Math.max(m.ch, s.i.chamadas); m.tri = Math.max(m.tri, s.i.triangulos);
    if (B) {
      const i = await B.evaluate(() => window.__edm?.info()).catch(() => null);
      if (i) { m.chB = Math.max(m.chB, i.chamadas); m.triB = Math.max(m.triB, i.triangulos); }
      const d = await desvioDoConvidado(A, B);
      if (d !== null) { desvio = Math.max(desvio, d); amostras++; }
    }
    while (fotos.length && s.tick >= fotos[0] * total) {
      const f = fotos.shift(); const nome = `cap${n}_${q}_${modo}_${Math.round(f * 100)}`;
      await A.evaluate(() => window.__edm.acelerar(1));
      await pausa(500);
      await A.screenshot({ path: `${saida}${nome}_A.png` });
      if (B) await B.screenshot({ path: `${saida}${nome}_B.png` });
      await A.evaluate((k) => window.__edm?.acelerar(k), ACEL).catch(() => {});
    }
    if (s.c) break;
    if (Date.now() - t0 > 240000) break;
    await pausa(120);
  }
  // capítulo 7: o Rei foge com o pedaço → Arena do Coração (3D) → só então o capítulo conta
  if (n === 7) await jogarArena(q, A, B);
  // capítulo concluído aparece nos dois
  const viu = await A.waitForSelector('#concluido:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false);
  const viuB = B ? await B.waitForSelector('#concluido:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false) : true;
  checar(viu && viuB, `cap ${n} [${q}]: concluído em ${((Date.now() - t0) / 1000).toFixed(0)} s reais${B ? ' (nos dois aparelhos)' : ''}`);
  if (B) checar(amostras > 5 && desvio < 0.75, `cap ${n}: convidado em sincronia (${amostras} amostras, maior desvio ${desvio.toFixed(2)} m)`);
  await A.screenshot({ path: `${saida}cap${n}_${q}_${modo}_concluido_A.png` });
  medidas[`${n}_${q}`] = m;
  const orc = ORCAMENTO[q];
  const resumo = `cap ${n} [${q}]: ${m.ch} chamadas, ${(m.tri / 1000).toFixed(0)} mil triângulos${B ? ` (convidado ${m.chB} / ${(m.triB / 1000).toFixed(0)} mil)` : ''}`;
  if (orc) checar(Math.max(m.ch, m.chB) <= orc.ch && Math.max(m.tri, m.triB) <= orc.tri, resumo + ' — dentro do orçamento');
  else console.log('   ' + resumo);
  return m;
}

/** Cena da fuga → arena nos dois → luta gravada até a vitória. */
async function jogarArena(q, A, B) {
  const fuga = await A.waitForFunction(() => window.__edmFluxo.tela().cena === 'fuga', null, { timeout: 30000 }).then(() => true).catch(() => false);
  checar(fuga && !(await A.evaluate(() => window.__edmFluxo.progresso().capitulos[7])), 'cap 7: o Rei foge com o pedaço (o capítulo ainda não conta)');
  await A.click('#bt-pular');
  await A.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 30000 });
  if (B) await B.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 30000 });
  await A.evaluate(([l, k]) => { window.__edm.acelerar(k); return window.__edm.roteiro(l); }, [lutaArena.lista, ACEL * 2]);
  const m = { ch: 0, tri: 0 };
  const t0 = Date.now();
  for (;;) {
    const s = await A.evaluate(() => window.__edm?.arena && { v: window.__edm.estado().vitoria, i: window.__edm.info() }).catch(() => null);
    if (!s) break;
    m.ch = Math.max(m.ch, s.i.chamadas); m.tri = Math.max(m.tri, s.i.triangulos);
    if (s.v || Date.now() - t0 > 300000) break;
    await pausa(200);
  }
  await A.screenshot({ path: `${saida}arena_${q}_${modo}_A.png` });
  checar(Date.now() - t0 < 300000, `cap 7 [${q}]: Arena do Coração vencida em ${((Date.now() - t0) / 1000).toFixed(0)} s reais (${m.ch} chamadas, ${(m.tri / 1000).toFixed(0)} mil triângulos)`);
  medidas[`arena_${q}`] = m;
}

/** Concluído → lembrança → mapa (ou final → créditos → mapa). */
async function voltarAoMapa(n, A, B) {
  await A.click('#bt-conc-continuar');
  await A.waitForSelector('#quadrinhos:not([hidden])', { timeout: 10000 });
  if (B) await B.waitForSelector('#quadrinhos:not([hidden])', { timeout: 10000 });
  await A.click('#bt-pular');
  if (n === 7) { // final em quadrinhos
    await A.waitForFunction(() => window.__edmFluxo.tela().cena === 'final', null, { timeout: 10000 });
    await A.screenshot({ path: `${saida}final_${modo}_A.png` });
    if (B) checar(await B.evaluate(() => window.__edmFluxo.tela().cena === 'final'), 'convidado também vê o final');
    await A.click('#bt-pular');
    await A.waitForSelector('#creditos:not([hidden])', { timeout: 10000 });
    if (B) await B.waitForSelector('#creditos:not([hidden])', { timeout: 10000 });
    await A.click('#creditos');
  }
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 10000 });
  if (B) await B.waitForSelector('#mapa:not([hidden])', { timeout: 10000 });
}

for (const q of qualidades) {
  const log = [];
  const base = `http://127.0.0.1:${porta}/?q=${q}${modo === 'dupla' ? `&sinal=127.0.0.1:${portaSinal}` : ''}`;
  const A = await novaPagina('Pixel 7 landscape', 'A', log);
  let B = null;
  await A.goto(base);
  if (modo === 'treino') {
    await A.click('#bt-treino');
  } else {
    B = await novaPagina('iPhone 14 landscape', 'B', log);
    await B.goto(base);
    await A.click('#bt-criar');
    await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
    await B.fill('#codigo', await A.textContent('#sala-codigo')); await B.click('#bt-entrar');
    await A.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
    await A.click('#bt-pular');
  }
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  for (const n of caps) {
    // o mapa já vem com o próximo capítulo escolhido; se não, escolhe a ilha n
    const sel = await A.evaluate(() => window.__edmFluxo.tela().sel);
    if (sel !== n) await A.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
    await A.click('#bt-jogar');
    await jogarCapitulo(n, q, A, B);
    if (B) {
      const [pa, pb] = await Promise.all([A, B].map((p) => p.evaluate((n) => window.__edmFluxo.progresso().capitulos[n], n)));
      checar(pa && pb && pa.estrelinhas === pb.estrelinhas, `cap ${n}: progresso igual nos dois (★ ${pa?.estrelinhas}/${pa?.total})`);
    }
    await voltarAoMapa(n, A, B);
  }
  checar(log.length === 0, `[${q}] sem erros no console${log.length ? ': ' + log.slice(0, 4).join(' | ') : ''}`);
  await A.context().close(); await B?.context().close();
}

writeFileSync(`${saida}medidas_${modo}.json`, JSON.stringify(medidas, null, 1));
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'RESULTADO: APROVADO' : 'RESULTADO: REPROVADO');
process.exit(ok ? 0 : 1);
