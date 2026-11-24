// E2E dos balões de fala (L8a), no navegador:
//  T-U1  nenhum balão cruza o joystick, ⬆, ✨, ✋, os rostos nem os corações, nem entra no terço de baixo da tela, nos 4
//        tamanhos (844×390, 844×340, 873×393, 915×412): (a) jogando a passada dos bots do cap. 1, com amostras a cada
//        ~100 ms; (b) com o texto mais longo do roteiro ancorado numa grade que cobre a tela inteira e fora dela
//  T-P1  balões não acrescentam chamadas de desenho: mesma passada com ?baloes=todos e ?baloes=desligados, chamadas
//        comparadas nos mesmos ticks
//  C14   soma do tempo de balão da passada no navegador (≤ 90 s)
//  opção "Balões: todos / só história / desligados" na pausa (troca e fica salva)
// Uso: npx vite build && node test/e2e/baloes.mjs   (PORTA, padrão 4741; DIST=pasta usa outro build)
import { createRequire } from 'node:module';
import { preview } from 'vite';
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
    for (const o of obs) if (q.l < o.r && q.r > o.l && q.t < o.b && q.b > o.t) ruins.push(`"${q.texto}" cruza ${o.s}`);
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
  const com = await amostra('&baloes=todos'), sem = await amostra('&baloes=desligados');
  const comuns = Object.keys(com).filter((t) => sem[t]);
  const comBalao = comuns.filter((t) => com[t].n > 0);
  const difs = comBalao.map((t) => com[t].ch - sem[t].ch);
  const maior = Math.max(0, ...difs.map(Math.abs));
  checar(comBalao.length >= 5 && maior === 0, `T-P1: chamadas de desenho iguais com e sem balões em ${comBalao.length} ticks com balão na tela (maior diferença ${maior}; chamadas ${Math.min(...comBalao.map((t) => com[t].ch))}–${Math.max(...comBalao.map((t) => com[t].ch))})`);
  medidas.chamadas = { ticksComBalao: comBalao.length, maiorDiferenca: maior };
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

writeFileSync(saida + 'medidas.json', JSON.stringify(medidas, null, 1));
await nav.close(); await srv.close();
console.log(ok ? 'TUDO OK' : 'HOUVE FALHAS');
process.exit(ok ? 0 : 1);
