// QA da fatia 1 (L1, L2a, L2b, L4, L8a): joga pelo TOQUE de verdade (CDP Input.dispatchTouchEvent, vários dedos)
// em 844×390 (iPhone 14, área segura) e 915×412 (Pixel/Redmi). Nada de page.click: todo botão é tocado com um dedo.
//  1. menu com os 3 modos (Jogar sozinho, Jogar juntos online, Treino), tudo dentro da tela e sem sobreposição;
//  2. campanha solo do cap. 1: andar, pular, ATACAR (Estilingue: pedrinha sai), ⇆ (próxima arma), balões e dicas;
//     pausa com o polegar no joystick, Continuar e o joystick ainda anda; segundo plano (visibilitychange) pausa;
//     entradas gravadas dos bots até a lanterna, recarregar, tocar em "Continuar" → mesma lanterna e estrelinhas;
//  3. treino: Quintal de Treino pelo mapa, andar e ⇄ (trocar de personagem);
//  4. dupla (anfitrião 844×390, convidado 915×412): sala por toque, joystick e pulo do convidado chegam ao anfitrião.
// Capturas em test-out/qa-fatia1/. Uso: DIST=test-out/dist-qa node tools/revisao/qa/fatia1_toque.mjs [--so solo|treino|dupla]
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { APARELHOS, playwright, celular, centro } from '../playtester/comum.mjs';
import { gravarRoteiros } from '../../../test/e2e/roteiros.mjs';

const { chromium } = playwright();
const so = (() => { const i = process.argv.indexOf('--so'); return i > 0 ? process.argv[i + 1] : null; })();
const saida = new URL('../../../test-out/qa-fatia1/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const porta = Number(process.env.PORTA ?? 4911);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const res = [];
const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); res.push({ ok: !!c, msg }); ok &&= !!c; };

const roteiro1 = (await gravarRoteiros([1]))[1];
let sinal = null;
const portaSinal = await new Promise((r) => { sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}), preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const base = `http://127.0.0.1:${porta}/?q=media&sinal=127.0.0.1:${portaSinal}`;
const navegador = await chromium.launch();

/** toca no centro do elemento com um dedo próprio (id 7); devolve false se o elemento não está visível */
async function tocar(C, sel, ms = 70, id = 7) {
  const r = await C.page.locator(sel).first().boundingBox().catch(() => null);
  if (!r || !(await C.page.isVisible(sel))) return false;
  const p = centro(r);
  await C.toque.baixar(id, p.x, p.y); await pausa(ms); await C.toque.soltar(id);
  await pausa(120);
  return true;
}
const est = (C) => C.page.evaluate(() => {
  const e = window.__edm?.estado();
  return e && { tick: e.tick, cp: e.checkpoint, col: [...e.coletadas].sort((a, b) => a - b), casal: e.estrelinhasCasal, faiscas: e.faiscas.length,
    j: e.jogadores.map((j) => ({ x: j.x, y: j.y, vx: j.vx, arma: j.arsenal?.atual, itens: j.arsenal?.itens })) };
});
const foto = (C, nome) => C.page.screenshot({ path: `${saida}${nome}.png` });
const joyCentro = async (C) => centro(await C.page.locator('#joystick').boundingBox());
/** segura o joystick para a direita (dedo 1) por ms e solta */
async function andar(C, ms, dx = 60) {
  const j = await joyCentro(C);
  await C.toque.baixar(1, j.x, j.y); await C.toque.mover(1, j.x + dx / 2, j.y); await C.toque.mover(1, j.x + dx, j.y);
  await pausa(ms); await C.toque.soltar(1);
}

async function menu3Modos(C, tag) {
  await C.page.goto(base);
  await C.page.waitForSelector('#menu:not([hidden])');
  await pausa(400);
  const caixas = await C.page.evaluate(() => ['#bt-solo', '#bt-criar', '#codigo', '#bt-entrar', '#bt-treino'].map((s) => {
    const el = document.querySelector(s); const r = el.getBoundingClientRect(); return { s, x: r.x, y: r.y, w: r.width, h: r.height, vis: r.width > 0 && getComputedStyle(el).visibility !== 'hidden' };
  }));
  const W = await C.page.evaluate(() => [innerWidth, innerHeight]);
  const dentro = caixas.every((c) => c.vis && c.x >= 0 && c.y >= 0 && c.x + c.w <= W[0] && c.y + c.h <= W[1]);
  const cruza = caixas.some((a, i) => caixas.some((b, k) => k > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  checar(dentro && !cruza, `${tag}: menu com Jogar sozinho, Criar sala/código/Entrar e Treino, dentro de ${W[0]}×${W[1]} e sem sobreposição`);
  await foto(C, `${tag}_1_menu`);
}

// ---------- solo ----------
async function solo(ap, tag) {
  const C = await celular(navegador, ap);
  await menu3Modos(C, tag);
  checar(await tocar(C, '#bt-solo'), `${tag}: toque em "Jogar sozinho"`);
  await C.page.waitForSelector('#quadrinhos:not([hidden])', { timeout: 20000 });
  await tocar(C, '#bt-pular');
  await C.page.waitForSelector('#mapa:not([hidden])', { timeout: 20000 });
  await foto(C, `${tag}_2_mapa`);
  await tocar(C, '#bt-jogar');
  const entrou = await C.page.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 90000 }).then(() => true).catch(() => false);
  checar(entrou && (await C.page.evaluate(() => window.__edmFluxo.modo())) === 'solo', `${tag}: "Jogar" no mapa → cap. 1 no modo solo`);
  await pausa(800);
  // balões da abertura e dica
  await C.page.evaluate(() => window.__edm.acelerar(2));
  // andar com o joystick
  const e0 = await est(C);
  await andar(C, 2500);
  const e1 = await est(C);
  checar(e1.j[0].x - e0.j[0].x > 1.5, `${tag}: joystick para a direita anda (x ${e0.j[0].x.toFixed(2)} → ${e1.j[0].x.toFixed(2)})`);
  // pulo
  const yAntes = e1.j[0].y; let yMax = yAntes;
  { const r = centro(await C.page.locator('#bt-pulo').boundingBox()); await C.toque.baixar(2, r.x, r.y);
    for (let k = 0; k < 12; k++) { const e = await est(C); yMax = Math.max(yMax, e.j[0].y); await pausa(60); } await C.toque.soltar(2); }
  checar(yMax - yAntes > 0.8, `${tag}: ⬆ pula (subiu ${(yMax - yAntes).toFixed(2)} m)`);
  // atacar: o Estilingue solta pedrinha
  const armaNome = (await C.page.textContent('#bt-tiro')).trim();
  let maxF = 0;
  const cont0 = await C.page.evaluate(() => window.__edm.contagem());
  { const r = centro(await C.page.locator('#bt-tiro').boundingBox()); await C.toque.baixar(3, r.x, r.y);
    for (let k = 0; k < 10; k++) { const e = await est(C); maxF = Math.max(maxF, e.faiscas); await pausa(50); } await C.toque.soltar(3); }
  for (let k = 0; k < 10; k++) { const e = await est(C); maxF = Math.max(maxF, e.faiscas); await pausa(50); }
  const cont1 = await C.page.evaluate(() => window.__edm.contagem());
  const tiros = (cont1.tiro ?? 0) - (cont0.tiro ?? 0);
  checar(tiros > 0, `${tag}: ATACAR (${armaNome}) atira (${tiros} evento(s) de tiro, ${maxF} projétil(eis) vistos no ar; contagem ${JSON.stringify(cont1)})`);
  // ⇆: próxima arma
  const a0 = (await est(C)).j[0];
  await tocar(C, '#bt-troca', 80);
  await pausa(400);
  const a1 = (await est(C)).j[0];
  checar(a1.arma !== a0.arma, `${tag}: ⇆ troca de arma (espaço ${a0.arma} → ${a1.arma}; itens ${JSON.stringify(a1.itens)}; botão "${(await C.page.textContent('#bt-tiro')).trim()}")`);
  // corpo a corpo com a arma nova
  { const r = centro(await C.page.locator('#bt-tiro').boundingBox()); await C.toque.baixar(3, r.x, r.y); await pausa(200); await C.toque.soltar(3); }
  await foto(C, `${tag}_3_jogo_armas`);
  // balões e dicas
  let b = null;
  for (let k = 0; k < 40; k++) { b = await C.page.evaluate(() => window.__edm.baloes()); if (b?.log?.length) break; await pausa(250); }
  checar(b?.log?.length > 0, `${tag}: balões falam no cap. 1 (${b?.log?.length ?? 0} até agora: ${(b?.log ?? []).slice(0, 4).map((x) => `${x.id}"${x.texto}"`).join(' | ')})`);
  if (b?.ativos?.length) await foto(C, `${tag}_4_balao`);
  // pausa com o polegar no joystick
  {
    const j = await joyCentro(C);
    // para a esquerda: à direita do ponto de partida há um bloco de montar (x ≈ 7,7)
    await C.page.evaluate(() => window.__edm.acelerar(1));
    await C.toque.baixar(1, j.x, j.y); await C.toque.mover(1, j.x - 60, j.y);
    checar(await tocar(C, '#bt-pausa', 70, 4), `${tag}: ❚❚ tocado com o polegar no joystick`);
    const pausou = await C.page.waitForSelector('#pausa:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
    checar(pausou, `${tag}: pausa abre com o polegar no joystick`);
    await foto(C, `${tag}_5_pausa`);
    const tp0 = (await est(C)).tick; await pausa(800); const tp1 = (await est(C)).tick;
    checar(tp1 === tp0, `${tag}: pausado o tick não anda (${tp0} = ${tp1})`);
    await tocar(C, '#bt-continuar', 70, 4);
    const cont = await C.page.waitForSelector('#pausa', { state: 'hidden', timeout: 5000 }).then(() => true).catch(() => false);
    const x0 = (await est(C)).j[0].x;
    await C.toque.mover(1, j.x - 62, j.y); await pausa(500);
    const x1 = (await est(C)).j[0].x;
    await C.toque.soltar(1);
    checar(cont && x0 - x1 > 0.5, `${tag}: Continuar e o polegar que ficou no joystick segue andando (x ${x0.toFixed(2)} → ${x1.toFixed(2)})`);
  }
  // segundo plano
  {
    await C.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await pausa(500);
    const p = await C.page.evaluate(() => ({ pausado: window.__edmFluxo.pausado(), vis: !document.querySelector('#pausa').hidden, salvo: JSON.parse(localStorage.getItem('edm-salvo-v2') ?? 'null') }));
    const ret = p.salvo?.slots?.find((s) => s.id === p.salvo.ativo)?.retomada;
    checar(p.pausado && p.vis, `${tag}: app em segundo plano pausa o jogo`);
    checar(!!ret, `${tag}: segundo plano grava a retomada (tick ${ret?.tick}, lanterna ${ret?.lanterna})`);
    await C.page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await pausa(300);
    await tocar(C, '#bt-continuar', 70, 4);
    await C.page.waitForSelector('#pausa', { state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  // até a lanterna pelas entradas dos bots, pausa por toque, recarrega e Continuar por toque
  await C.page.evaluate(([l]) => { window.__edm.acelerar(8); return window.__edm.roteiro(l); }, [roteiro1.lista]);
  let r = null;
  for (let t0 = Date.now(); Date.now() - t0 < 400000;) {
    const s = await C.page.evaluate(() => JSON.parse(localStorage.getItem('edm-salvo-v2') ?? 'null'));
    r = s?.slots.find((c) => c.id === s.ativo)?.retomada;
    if (r && r.lanterna >= 2) break;
    await pausa(400);
  }
  await pausa(1500);
  await tocar(C, '#bt-pausa', 70, 4);
  await C.page.waitForSelector('#pausa:not([hidden])', { timeout: 8000 }).catch(() => {});
  await pausa(300);
  const antes = await est(C);
  await C.page.reload();
  await C.page.waitForSelector('#menu:not([hidden])');
  await pausa(400);
  const rot = (await C.page.textContent('#bt-continuar-jornada')).trim().replace(/\s+/g, ' ');
  await foto(C, `${tag}_6_menu_continuar`);
  checar(await tocar(C, '#bt-continuar-jornada'), `${tag}: menu oferece "${rot}" e o toque funciona`);
  await C.page.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 90000 }).catch(() => {});
  await pausa(300);
  const dep = await est(C);
  checar(dep && dep.cp === antes.cp && JSON.stringify(dep.col) === JSON.stringify(antes.col) && dep.casal === antes.casal,
    `${tag}: Continuar volta na lanterna ${dep?.cp} (= ${antes.cp}), ${dep?.col.length} estrelinhas (= ${antes.col.length}), ★ ${dep?.casal} (= ${antes.casal})`);
  await foto(C, `${tag}_7_continuou`);
  checar(C.erros.length === 0, `${tag}: sem erro no console (${C.erros.slice(0, 3).join(' | ')})`);
  await C.ctx.close();
}

// ---------- treino ----------
async function treino(ap, tag) {
  const C = await celular(navegador, ap);
  await C.page.goto(base);
  await C.page.waitForSelector('#menu:not([hidden])');
  await pausa(300);
  checar(await tocar(C, '#bt-treino'), `${tag}: toque em "Treino"`);
  await C.page.waitForSelector('#mapa:not([hidden])', { timeout: 20000 });
  await foto(C, `${tag}_8_mapa_treino`);
  checar(await tocar(C, '#bt-quintal'), `${tag}: mapa do treino tem "Quintal de Treino"`);
  const entrou = await C.page.waitForFunction(() => window.__edm?.fase && /quintal/.test(window.__edm.fase), null, { timeout: 90000 }).then(() => true).catch(() => false);
  checar(entrou, `${tag}: Quintal de Treino abre (${await C.page.evaluate(() => window.__edm?.fase)})`);
  const salvoAntes = await C.page.evaluate(() => localStorage.getItem('edm-salvo-v2'));
  await pausa(500);
  const e0 = await est(C); await andar(C, 2000); const e1 = await est(C);
  checar(e1.j[0].x - e0.j[0].x > 1, `${tag}: treino, joystick anda (x ${e0.j[0].x.toFixed(2)} → ${e1.j[0].x.toFixed(2)})`);
  const eu0 = await C.page.evaluate(() => window.__edm.eu());
  await tocar(C, '#bt-trocar');
  await pausa(300);
  const eu1 = await C.page.evaluate(() => window.__edm.eu());
  const e2 = await est(C); await andar(C, 2000); const e3 = await est(C);
  checar(eu1 !== eu0 && e3.j[eu1].x - e2.j[eu1].x > 1, `${tag}: ⇄ troca de personagem (${eu0} → ${eu1}) e o joystick move o outro`);
  await foto(C, `${tag}_9_quintal`);
  const salvoDepois = await C.page.evaluate(() => localStorage.getItem('edm-salvo-v2'));
  checar(salvoAntes === salvoDepois, `${tag}: o Quintal não mexe no edm-salvo-v2`);
  checar(C.erros.length === 0, `${tag}: treino sem erro no console (${C.erros.slice(0, 3).join(' | ')})`);
  await C.ctx.close();
}

// ---------- dupla ----------
async function dupla() {
  const A = await celular(navegador, APARELHOS.iphone), B = await celular(navegador, APARELHOS.android);
  await A.page.goto(base); await B.page.goto(base);
  await A.page.waitForSelector('#menu:not([hidden])'); await B.page.waitForSelector('#menu:not([hidden])');
  await pausa(300);
  await tocar(A, '#bt-criar');
  await A.page.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  const codigo = (await A.page.textContent('#sala-codigo')).trim();
  await foto(A, 'dupla_1_sala');
  await tocar(B, '#codigo'); await B.page.keyboard.type(codigo);
  checar(await tocar(B, '#bt-entrar'), `dupla: convidado digita ${codigo} e toca em Entrar`);
  const viram = await Promise.all([A, B].map((C) => C.page.waitForSelector('#quadrinhos:not([hidden])', { timeout: 40000 }).then(() => true).catch(() => false)));
  checar(viram.every(Boolean), 'dupla: os dois veem o prólogo');
  await tocar(A, '#bt-pular');
  await Promise.all([A, B].map((C) => C.page.waitForSelector('#mapa:not([hidden])', { timeout: 30000 }).catch(() => {})));
  await tocar(A, '#bt-jogar');
  const jogam = await Promise.all([A, B].map((C) => C.page.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 90000 }).then(() => true).catch(() => false)));
  checar(jogam.every(Boolean), 'dupla: os dois entram no cap. 1');
  await pausa(1500);
  const e0 = await est(A); await andar(B, 2500); await pausa(600); const e1 = await est(A);
  checar(e1.j[1].x - e0.j[1].x > 1, `dupla: joystick do convidado move a Bruna no anfitrião (x ${e0.j[1].x.toFixed(2)} → ${e1.j[1].x.toFixed(2)})`);
  let yMax = e1.j[1].y;
  { const r = centro(await B.page.locator('#bt-pulo').boundingBox()); await B.toque.baixar(2, r.x, r.y);
    for (let k = 0; k < 14; k++) { const e = await est(A); yMax = Math.max(yMax, e.j[1].y); await pausa(70); } await B.toque.soltar(2); }
  checar(yMax - e1.j[1].y > 0.8, `dupla: ⬆ do convidado faz a Bruna pular no anfitrião (+${(yMax - e1.j[1].y).toFixed(2)} m)`);
  const eA = await est(A); await andar(A, 2000); const eA1 = await est(A);
  checar(eA1.j[0].x - eA.j[0].x > 1, `dupla: joystick do anfitrião move o Natan (x ${eA.j[0].x.toFixed(2)} → ${eA1.j[0].x.toFixed(2)})`);
  await pausa(800);
  const g = await est(B), h = await est(A);
  checar(Math.abs(g.j[0].x - h.j[0].x) < 1 && Math.abs(g.j[1].x - h.j[1].x) < 1, `dupla: o convidado vê as mesmas posições (Natan ${g.j[0].x.toFixed(2)}/${h.j[0].x.toFixed(2)}, Bruna ${g.j[1].x.toFixed(2)}/${h.j[1].x.toFixed(2)})`);
  await foto(A, 'dupla_2_anfitriao'); await foto(B, 'dupla_3_convidado');
  // pausa pelo convidado, com o polegar no joystick
  {
    const j = await joyCentro(B);
    await B.toque.baixar(1, j.x, j.y); await B.toque.mover(1, j.x - 60, j.y); // à direita está o bloco de montar
    await tocar(B, '#bt-pausa', 70, 4);
    const p = await Promise.all([A, B].map((C) => C.page.waitForSelector('#pausa:not([hidden])', { timeout: 8000 }).then(() => true).catch(() => false)));
    checar(p.every(Boolean), 'dupla: ❚❚ do convidado (polegar no joystick) pausa os dois');
    await tocar(B, '#bt-continuar', 70, 4);
    await Promise.all([A, B].map((C) => C.page.waitForSelector('#pausa', { state: 'hidden', timeout: 8000 }).catch(() => {})));
    const x0 = (await est(A)).j[1].x; await B.toque.mover(1, j.x - 62, j.y); await pausa(700); const x1 = (await est(A)).j[1].x;
    await B.toque.soltar(1);
    checar(x0 - x1 > 0.5, `dupla: depois de Continuar, o polegar do convidado no joystick segue movendo a Bruna (x ${x0.toFixed(2)} → ${x1.toFixed(2)})`);
  }
  checar(A.erros.length + B.erros.length === 0, `dupla: sem erro no console (${[...A.erros, ...B.erros].slice(0, 3).join(' | ')})`);
  await A.ctx.close(); await B.ctx.close();
}

try {
  for (const [ap, tag] of [[APARELHOS.iphone, 'iphone844'], [APARELHOS.android, 'android915']]) {
    if (!so || so === 'solo') await solo(ap, tag);
    if (!so || so === 'treino') await treino(ap, tag);
  }
  if (!so || so === 'dupla') await dupla();
} catch (e) { checar(false, `erro: ${e.stack ?? e}`); }
writeFileSync(`${saida}resultado${so ? '_' + so : ''}.json`, JSON.stringify(res, null, 1));
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'TUDO OK' : 'FALHOU');
process.exit(ok ? 0 : 1);
