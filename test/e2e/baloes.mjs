// E2E dos balões de fala (L8a), no navegador:
//  T-U1  nenhum balão cruza o joystick, ⬆, ✨, ✋, os rostos nem os corações, nem entra no terço de baixo da tela, nos 4
//        tamanhos (844×390, 844×340, 873×393, 915×412): (a) jogando a passada dos bots do cap. 1, com amostras a cada
//        ~100 ms; (b) com o texto mais longo do roteiro ancorado numa grade que cobre a tela inteira e fora dela
//  T-P1  balões não acrescentam chamadas de desenho: mesma passada com ?baloes=todos e ?baloes=desligados, chamadas
//        comparadas nos mesmos ticks
//  C14   soma do tempo de balão da passada no navegador (≤ 90 s)
//  opção "Balões: todos / só história / desligados" na pausa (troca e fica salva)
//  dupla: anfitrião e convidado mostram as mesmas falas, de quem e com o mesmo texto (sem mensagem nova na rede)
// Uso: npx vite build && node test/e2e/baloes.mjs   (PORTA, padrão 4741; DIST=pasta usa outro build)
import { createRequire } from 'node:module';
import { preview } from 'vite';
import { PeerServer } from 'peer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gravarRoteiros } from './roteiros.mjs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');

const saida = new URL('../../test-out/baloes/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const porta = Number(process.env.PORTA ?? 4741);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };
const medidas = {};

const roteiros = await gravarRoteiros([1]);
const lista = roteiros[1].lista;
console.log(`cap. 1: passada dos bots com ${lista.length} ticks (${roteiros[1].segundos.toFixed(1)} s)`);

const srv = await preview({ ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}), preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const nav = await chromium.launch();
const TAMANHOS = [['iphone-app', 844, 390], ['iphone-safari', 844, 340], ['redmi', 873, 393], ['pixel', 915, 412]];
const OBST = ['#joystick', '#botoes button', '.hud-jogador .rosto', '.hud-jogador .coracoes', '#bt-pausa', '#hud-estrelinhas'];

async function abrir(W, H, extra = '') {
  const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto(`http://127.0.0.1:${porta}/?q=baixa&resfixa${extra}`);
  await page.waitForSelector('#menu:not([hidden])');
  await page.click('#bt-treino');
  await page.waitForSelector('#mapa:not([hidden])');
  const sel = await page.evaluate(() => window.__edmFluxo.tela().sel);
  if (sel !== 1) await page.evaluate(() => document.querySelectorAll('#mapa .ilha')[0].click());
  await page.click('#bt-jogar');
  await page.waitForFunction(() => window.__edm?.cap === 1 && window.__edm.estado().tick > 2, null, { timeout: 180000, polling: 100 });
  return { ctx, page, erros };
}

/** retângulos dos balões na tela × obstáculos medidos aqui (independente do que o jogo mediu) */
const conferir = (page) => page.evaluate((OBST) => {
  const obs = [];
  for (const s of OBST) document.querySelectorAll(s).forEach((n) => { const r = n.getBoundingClientRect(); if (r.width > 0 && getComputedStyle(n).display !== 'none') obs.push({ s, l: r.left, t: r.top, r: r.right, b: r.bottom }); });
  const bal = [...document.querySelectorAll('#baloes .balao')].filter((b) => !b.hidden && b.style.visibility !== 'hidden').map((b) => { const r = b.getBoundingClientRect(); return { texto: b.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const H = innerHeight, W = innerWidth, ruins = [];
  for (const q of bal) {
    for (const o of obs) if (q.l < o.r && q.r > o.l && q.t < o.b && q.b > o.t) ruins.push(`"${q.texto}" [${[q.l, q.t, q.r, q.b].map(Math.round)}] cruza ${o.s} [${[o.l, o.t, o.r, o.b].map(Math.round)}]; o jogo media ${JSON.stringify(window.__edm.baloes().ativos.map((a) => [a.texto, Math.round(a.l), Math.round(a.t)]))}`);
    if (q.b > H * 2 / 3 + 0.5) ruins.push(`"${q.texto}" no terço de baixo (b=${q.b.toFixed(0)} de ${H})`);
    if (q.l < -0.5 || q.r > W + 0.5 || q.t < -0.5) ruins.push(`"${q.texto}" fora da tela`);
  }
  return { n: bal.length, ruins, tick: window.__edm?.estado()?.tick ?? -1, ch: window.__edm?.info()?.chamadas ?? -1 };
}, OBST);

for (const [nome, W, H] of TAMANHOS) {
  const { ctx, page, erros } = await abrir(W, H, '&baloes=todos');
  const viu = await page.waitForFunction(() => window.__edm.baloes()?.ativos.length > 0, null, { timeout: 30000, polling: 100 }).then(() => true).catch(() => false);
  checar(viu, `${nome} ${W}×${H}: o primeiro balão aparece na abertura`);
  await page.screenshot({ path: `${saida}${nome}_abertura.png` });
  // (a) passada dos bots
  await page.evaluate((l) => { window.__edm.acelerar(2); return window.__edm.roteiro(l); }, lista);
  let amostras = 0, comBalao = 0; const ruins = new Set(); const fotos = [0.2, 0.45, 0.7, 0.9]; const total = lista.length;
  for (let guarda = 0; guarda < 4000; guarda++) {
    const r = await conferir(page).catch(() => null);
    if (!r || r.tick < 0) break;
    amostras++; if (r.n) comBalao++;
    for (const x of r.ruins) ruins.add(x);
    if (fotos.length && r.tick >= fotos[0] * total && r.n) { fotos.shift(); await page.screenshot({ path: `${saida}${nome}_t${r.tick}.png` }); }
    const fim = await page.evaluate(() => window.__edm.estado().concluida).catch(() => true);
    if (fim) break;
    await pausa(100);
  }
  const log = await page.evaluate(() => window.__edm?.baloes()?.log ?? []).catch(() => []);
  const soma = log.reduce((s, b) => s + (b.ate - b.desde) / 60, 0);
  checar(ruins.size === 0 && comBalao > 10, `${nome}: T-U1 jogando — ${amostras} amostras, ${comBalao} com balão, ${ruins.size} problemas ${[...ruins].slice(0, 3).join('; ')}`);
  checar(soma <= 90 && log.length >= 15, `${nome}: C14 — ${log.length} balões, ${soma.toFixed(1)} s de balão na passada`);
  medidas[nome] = { amostras, comBalao, problemas: [...ruins], baloes: log.length, segundosDeBalao: +soma.toFixed(1) };
  // (b) grade de âncoras com o texto mais longo e um curto, para os 3 falantes
  const grade = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, ancoras = [];
    for (const texto of ['Um sobe na prateleira e abre o portão pro outro.', 'Que dama.'])
      for (const quem of [0, 1, 2]) for (let ax = -100; ax <= W + 100; ax += 37) for (let ay = -80; ay <= H + 80; ay += 29) ancoras.push({ quem, texto, ax, ay });
    return { ancoras, rets: window.__edm.baloesLugares(ancoras) };
  });
  const obs = await page.evaluate((OBST) => { const o = []; for (const s of OBST) document.querySelectorAll(s).forEach((n) => { const r = n.getBoundingClientRect(); if (r.width > 0 && getComputedStyle(n).display !== 'none') o.push({ s, l: r.left, t: r.top, r: r.right, b: r.bottom }); }); return o; }, OBST);
  let ruimGrade = 0, nulos = 0;
  for (const r of grade.rets) {
    if (!r) { nulos++; continue; }
    if (r.b > H * 2 / 3 + 0.5 || obs.some((o) => r.l < o.r && r.r > o.l && r.t < o.b && r.b > o.t)) ruimGrade++;
  }
  checar(ruimGrade === 0 && nulos === 0, `${nome}: T-U1 grade — ${grade.rets.length} âncoras, ${ruimGrade} cruzam controles/HUD ou o terço de baixo, ${nulos} sem lugar`);
  medidas[nome].grade = { ancoras: grade.rets.length, ruins: ruimGrade, semLugar: nulos };
  checar(erros.length === 0, `${nome}: sem erro de página ${erros.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// T-P1: chamadas de desenho com e sem balões, nos mesmos ticks da mesma passada
{
  const amostra = async (extra) => {
    const { ctx, page } = await abrir(873, 393, extra);
    await page.evaluate((l) => { window.__edm.acelerar(1); return window.__edm.roteiro(l); }, lista.slice(0, 1500));
    const por = {};
    for (let guarda = 0; guarda < 2000; guarda++) {
      const r = await page.evaluate(() => ({ tick: window.__edm.estado().tick, ch: window.__edm.info().chamadas, n: window.__edm.baloes()?.ativos.length ?? 0 })).catch(() => null);
      if (!r || r.tick >= 1450) break;
      por[r.tick] = r;
      await pausa(40);
    }
    await ctx.close();
    return por;
  };
  // a câmera suaviza com o tempo real do quadro: duas rodadas iguais podem diferir de 1 chamada num tick (um objeto na
  // borda do quadro entra ou sai). Por isso há um controle: duas rodadas SEM balões. O balão não pode mudar mais do que
  // esse ruído, nem deslocar a média.
  const com = await amostra('&baloes=todos'), sem = await amostra('&baloes=desligados'), sem2 = await amostra('&baloes=desligados');
  const comuns = Object.keys(com).filter((t) => sem[t] && sem2[t]);
  const comBalao = comuns.filter((t) => com[t].n > 0);
  const difs = comBalao.map((t) => com[t].ch - sem[t].ch), ctrl = comBalao.map((t) => sem2[t].ch - sem[t].ch);
  const maior = Math.max(0, ...difs.map(Math.abs)), maiorCtrl = Math.max(0, ...ctrl.map(Math.abs));
  const media = difs.reduce((s, x) => s + x, 0) / Math.max(1, difs.length), mediaCtrl = ctrl.reduce((s, x) => s + x, 0) / Math.max(1, ctrl.length);
  const difere = difs.filter((x) => x !== 0).length, difereCtrl = ctrl.filter((x) => x !== 0).length;
  checar(comBalao.length >= 5 && maior <= Math.max(1, maiorCtrl) && Math.abs(media) <= 0.15,
    `T-P1: ${comBalao.length} ticks com balão na tela; com × sem balões: ${difere} ticks diferem, maior diferença ${maior}, média ${media.toFixed(2)} · controle sem × sem: ${difereCtrl} diferem, maior ${maiorCtrl}, média ${mediaCtrl.toFixed(2)} (chamadas ${Math.min(...comBalao.map((t) => com[t].ch))}–${Math.max(...comBalao.map((t) => com[t].ch))})`);
  medidas.chamadas = { ticksComBalao: comBalao.length, diferem: difere, maiorDiferenca: maior, media: +media.toFixed(3), controle: { diferem: difereCtrl, maior: maiorCtrl, media: +mediaCtrl.toFixed(3) } };
}

// opção na pausa
{
  const { ctx, page } = await abrir(873, 393);
  await page.click('#bt-pausa');
  await page.waitForSelector('#pausa:not([hidden])');
  const textos = [await page.textContent('#bt-baloes')];
  for (let k = 0; k < 3; k++) { await page.click('#bt-baloes'); textos.push(await page.textContent('#bt-baloes')); }
  const salvo = await page.evaluate(() => localStorage.getItem('edm-baloes'));
  checar(textos.join(' → ') === 'Balões: todos → Balões: só história → Balões: desligados → Balões: todos' && salvo === 'todos', `opção na pausa: ${textos.join(' → ')} (salvo: ${salvo})`);
  await ctx.close();
}

// dupla: o convidado decide as mesmas falas com o estado e os eventos que recebe
{
  const portaSinal = await new Promise((r) => { const s = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (x) => r(x.address().port)); globalThis.__sinal = s; });
  const base = `http://127.0.0.1:${porta}/?q=baixa&resfixa&sinal=127.0.0.1:${portaSinal}`;
  const novo = async (W, H) => { const c = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); const p = await c.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(String(e))); await p.goto(base); return { c, p, erros }; };
  const A = await novo(873, 393), B = await novo(844, 390);
  await A.p.click('#bt-criar');
  await A.p.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  await B.p.fill('#codigo', await A.p.textContent('#sala-codigo')); await B.p.click('#bt-entrar');
  await A.p.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
  await A.p.click('#bt-pular');
  await A.p.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  const sel = await A.p.evaluate(() => window.__edmFluxo.tela().sel);
  if (sel !== 1) await A.p.evaluate(() => document.querySelectorAll('#mapa .ilha')[0].click());
  await A.p.click('#bt-jogar');
  for (const X of [A, B]) await X.p.waitForFunction(() => window.__edm?.cap === 1 && window.__edm.estado().tick > 2, null, { timeout: 180000, polling: 100 });
  await pausa(600);
  await A.p.evaluate((l) => { window.__edm.acelerar(1); return window.__edm.roteiro(l); }, lista);
  const t0 = Date.now();
  let logA = [], logB = [];
  for (;;) {
    const s = await A.p.evaluate(() => ({ c: window.__edm.estado().concluida, log: window.__edm.baloes().log })).catch(() => null);
    const g = await B.p.evaluate(() => window.__edm?.baloes()?.log ?? null).catch(() => null);
    if (s) logA = s.log; if (g) logB = g;
    if (!s || s.c || Date.now() - t0 > 600000) break;
    await pausa(300);
  }
  const chave = (b) => `${b.id}|${b.quem}|${b.texto}`;
  const a = logA.map(chave), b = logB.map(chave);
  const iguais = a.filter((x) => b.includes(x)).length;
  const difTick = logA.map((x) => { const y = logB.find((z) => z.id === x.id); return y ? Math.abs(y.desde - x.desde) : null; }).filter((x) => x !== null);
  checar(a.length >= 15 && iguais === a.length && b.length === a.length, `dupla: ${a.length} falas no anfitrião, ${b.length} no convidado, ${iguais} iguais (id, quem e texto); diferença de tick até ${Math.max(0, ...difTick)}${iguais < a.length ? ' · só no anfitrião: ' + a.filter((x) => !b.includes(x)).join(', ') + ' · só no convidado: ' + b.filter((x) => !a.includes(x)).join(', ') : ''}`);
  medidas.dupla = { anfitriao: a.length, convidado: b.length, iguais, maiorDiferencaTick: Math.max(0, ...difTick) };
  checar(A.erros.length + B.erros.length === 0, `dupla: sem erro de página ${[...A.erros, ...B.erros].slice(0, 2).join(' | ')}`);
  await A.c.close(); await B.c.close(); globalThis.__sinal?.close?.();
}

writeFileSync(saida + 'medidas.json', JSON.stringify(medidas, null, 1));
await nav.close(); await srv.close();
console.log(ok ? 'TUDO OK' : 'HOUVE FALHAS');
process.exit(ok ? 0 : 1);
