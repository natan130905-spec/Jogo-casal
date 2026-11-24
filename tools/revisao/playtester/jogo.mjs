// Playtest de JOGO com toque real (CDP): joystick, pulo, tiro, mão, multitoque, toque rápido, pausa, troca de
// personagem; e capturas com HUD dos capítulos 1, 2, 3 e 7 em pontos fixos (entradas gravadas dos bots).
// Uso: node tools/revisao/playtester/jogo.mjs --raiz <cópia> [--porta 4892] [--saida <dir>] [--aps iphone,android]
//      [--caps 1,2,3,7] [--q baixa]
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APARELHOS, auditarDom, celular, centro, pasta, playwright, subirVite } from './comum.mjs';

const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', '.'));
const porta = Number(opt('porta', 4892));
const saida = pasta(resolve(opt('saida', join(raiz, 'test-out/playtester/jogo'))));
const aps = opt('aps', 'iphone,android').split(',');
const caps = opt('caps', '1,2,3,7').split(',').map(Number);
const q = opt('q', 'baixa');
const soCapturas = args.includes('--so-capturas');

const vs = await subirVite(raiz, porta);
const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');
const roteiros = {};
for (const n of caps) {
  const f = faseDoCapitulo(n); const lista = [];
  jogar(f, PLANOS[f.id], { limite: 420, entradas: (e) => lista.push(e.map((i) => ({ ...i }))) });
  roteiros[n] = lista;
}
const { chromium } = playwright();
const nav = await chromium.launch();
const base = `http://127.0.0.1:${porta}/`;
const rel = {};

const est = (page) => page.evaluate(() => { const e = window.__edm.estado(); return { tick: e.tick, j: e.jogadores.map((j) => ({ x: j.x, y: j.y, vx: j.vx, vy: j.vy, noChao: j.noChao, maoSegurada: j.maoSegurada })) }; });
const contagem = (page) => page.evaluate(() => window.__edm.contagem());
/** espera n ticks de simulação (a máquina sem GPU roda a poucos quadros por segundo; o tempo real não serve) */
async function ticks(page, n) { const t0 = (await est(page)).tick; await page.waitForFunction((t) => window.__edm.estado().tick >= t, t0 + n, { timeout: 120000, polling: 50 }); }

async function entrarNoCapitulo(page, toque, n) {
  await page.goto(`${base}?resfixa&q=${q}`);
  await page.waitForSelector('#menu:not([hidden])');
  const tocarEl = async (sel) => { const b = await page.locator(sel).boundingBox(); const c = centro(b); await toque.tocar(c.x, c.y, 60, page); };
  await tocarEl('#bt-treino');
  await page.waitForSelector('#mapa:not([hidden])');
  await tocarEl(`.ilha[data-cap="${n}"]`);
  await page.waitForTimeout(200);
  await tocarEl('#bt-jogar');
  await page.waitForFunction(() => window.__edm?.estado()?.tick > 5, null, { timeout: 60000 });
  return tocarEl;
}

for (const nomeAp of aps) {
  const ap = APARELHOS[nomeAp];
  const r = (rel[nomeAp] = { aparelho: ap.nome });
  const { page, toque, erros, ctx } = await celular(nav, ap);
  await entrarNoCapitulo(page, toque, 1);
  const rects = await page.evaluate(() => Object.fromEntries(['#joystick', '#bt-pulo', '#bt-tiro', '#bt-mao', '#bt-pausa', '#bt-trocar', '#hud-p1', '#hud-p2', '.hud-meio'].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [s, { x: b.x, y: b.y, w: b.width, h: b.height }]; })));
  r.rects = rects;
  const J = { x: rects['#joystick'].x + rects['#joystick'].w / 2, y: rects['#joystick'].y + rects['#joystick'].h / 2, r: rects['#joystick'].w / 2 };
  const P = centro({ x: rects['#bt-pulo'].x, y: rects['#bt-pulo'].y, width: rects['#bt-pulo'].w, height: rects['#bt-pulo'].h });
  const T = centro({ x: rects['#bt-tiro'].x, y: rects['#bt-tiro'].y, width: rects['#bt-tiro'].w, height: rects['#bt-tiro'].h });
  const M = centro({ x: rects['#bt-mao'].x, y: rects['#bt-mao'].y, width: rects['#bt-mao'].w, height: rects['#bt-mao'].h });

  if (!soCapturas) {
    // 1) curva do joystick: dedo no centro, arrasta dx px; mede a velocidade de Natan depois de 12 ticks
    r.curva = [];
    let lado = 1;
    for (const dx of [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 100]) {
      await toque.baixar(1, J.x, J.y);
      await toque.mover(1, J.x + lado * dx, J.y);
      await ticks(page, 12);
      const s = await est(page);
      r.curva.push({ dxPx: dx, fracRaio: +(dx / J.r).toFixed(2), vx: +Math.abs(s.j[0].vx).toFixed(2) });
      await toque.soltar(1);
      await ticks(page, 6);
      lado = -lado;
    }
    // 2) dedo pousa fora do centro (o polegar raramente cai no meio): 30 px à direita do centro, sem arrastar
    await toque.baixar(1, J.x + 30, J.y); await ticks(page, 10);
    r.pousoForaDoCentro = { dxPx: 30, vx: +(await est(page)).j[0].vx.toFixed(2) };
    await toque.soltar(1); await ticks(page, 6);
    // dedo pousa 12 px fora da borda do joystick (na mesma linha) e arrasta para a direita: nada acontece?
    await toque.baixar(1, J.x - J.r - 12, J.y); await toque.mover(1, J.x - J.r + 40, J.y); await ticks(page, 10);
    r.pousoForaDaBorda = { vx: +(await est(page)).j[0].vx.toFixed(2) };
    await toque.soltar(1); await ticks(page, 6);
    // dedo pousa acima do joystick (polegar alto, comum em paisagem) 20 px acima da borda
    await toque.baixar(1, J.x, J.y - J.r - 20); await toque.mover(1, J.x + 50, J.y - J.r - 20); await ticks(page, 10);
    r.pousoAcima = { vx: +(await est(page)).j[0].vx.toFixed(2) };
    await toque.soltar(1); await ticks(page, 6);
    // 3) diagonal para cima-direita a 45° (quem quer "andar e subir"): x efetivo
    await toque.baixar(1, J.x, J.y); await toque.mover(1, J.x + 45, J.y - 45); await ticks(page, 12);
    r.diagonal45 = { vx: +(await est(page)).j[0].vx.toFixed(2) };
    await toque.soltar(1); await ticks(page, 6);
    // 4) multitoque: joystick para a direita segurado + pulo
    await toque.baixar(1, J.x, J.y); await toque.mover(1, J.x + 60, J.y); await ticks(page, 6);
    const c0 = await contagem(page);
    await toque.baixar(2, P.x, P.y); await ticks(page, 8);
    const s4 = await est(page);
    await toque.soltar(2); await ticks(page, 30);
    await toque.soltar(1); await ticks(page, 10);
    const c1 = await contagem(page);
    r.multitoque = { pulos: (c1.pulo ?? 0) - (c0.pulo ?? 0), vxNoAr: +s4.j[0].vx.toFixed(2), vyNoAr: +s4.j[0].vy.toFixed(2) };
    // 5) toque rápido: 12 toques de pulo com dedo baixado e solto no mesmo instante (≈ toque de 0–30 ms)
    //    e 12 toques de 120 ms; quantos viram pulo? (a entrada é lida 1 vez por quadro; não há memória do toque)
    const quadroMs = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 20 ? requestAnimationFrame(f) : res((performance.now() - t0) / 20)); requestAnimationFrame(f); }));
    r.msPorQuadroAqui = Math.round(quadroMs);
    for (const ms of [0, 120]) {
      const a = await contagem(page);
      for (let k = 0; k < 12; k++) {
        await page.waitForFunction(() => window.__edm.estado().jogadores[0].noChao, null, { timeout: 60000, polling: 30 });
        await ticks(page, 2);
        await toque.baixar(2, P.x, P.y); if (ms) await page.waitForTimeout(ms); await toque.soltar(2);
        await ticks(page, 4);
      }
      await ticks(page, 40);
      const b = await contagem(page);
      r[`toqueRapido_${ms}ms`] = { toques: 12, pulos: (b.pulo ?? 0) - (a.pulo ?? 0) };
    }
    // 6) tiro segurado por 180 ticks (3 s de jogo): quantas faíscas
    {
      const a = await contagem(page);
      await toque.baixar(3, T.x, T.y); await ticks(page, 180); await toque.soltar(3); await ticks(page, 4);
      const b = await contagem(page);
      r.tiroSegurado3s = (b.tiro ?? 0) - (a.tiro ?? 0);
    }
    // 7) mão: anda até a Bruna (parada) e segura ✋
    {
      const s = await est(page);
      const alvo = s.j[1].x - 0.9;
      await toque.baixar(1, J.x, J.y); await toque.mover(1, J.x + Math.sign(alvo - s.j[0].x) * 40, J.y);
      for (let k = 0; k < 60; k++) { const e = await est(page); if (Math.abs(e.j[0].x - alvo) < 0.4) break; await ticks(page, 2); }
      await toque.soltar(1);
      const a = await contagem(page);
      await toque.baixar(4, M.x, M.y); await ticks(page, 20);
      const e = await est(page);
      const b = await contagem(page);
      r.mao = { maos: (b.maos ?? 0) - (a.maos ?? 0), distancia: +Math.abs(e.j[0].x - e.j[1].x).toFixed(2), segurada: e.j[0].maoSegurada || e.j[1].maoSegurada };
      await page.screenshot({ path: join(saida, `${nomeAp}_maos_dadas.png`) });
      await toque.soltar(4);
    }
    // 8) pausa com o joystick segurado: ao continuar, o dedo ainda está no joystick
    {
      await toque.baixar(1, J.x, J.y); await toque.mover(1, J.x + 60, J.y); await ticks(page, 6);
      const bp = await page.locator('#bt-pausa').boundingBox();
      await toque.baixar(5, bp.x + bp.width / 2, bp.y + bp.height / 2); await toque.soltar(5);
      await page.waitForSelector('#pausa:not([hidden])');
      const bc = await page.locator('#bt-continuar').boundingBox();
      await toque.baixar(5, bc.x + bc.width / 2, bc.y + bc.height / 2); await toque.soltar(5);
      await page.waitForSelector('#pausa', { state: 'hidden' });
      await ticks(page, 10);
      r.depoisDaPausaComDedoNoJoystick = { vx: +(await est(page)).j[0].vx.toFixed(2) };
      await toque.mover(1, J.x + 62, J.y); await ticks(page, 6);
      r.depoisDaPausaMexendoODedo = { vx: +(await est(page)).j[0].vx.toFixed(2) };
      await toque.soltarTudo(); await ticks(page, 4);
    }
    // 9) ⇄ troca: depois de trocar, o joystick move a Bruna?
    {
      const bt = await page.locator('#bt-trocar').boundingBox();
      await toque.tocar(bt.x + bt.width / 2, bt.y + bt.height / 2, 60, page);
      await page.waitForTimeout(200);
      await toque.baixar(1, J.x, J.y); await toque.mover(1, J.x + 60, J.y); await ticks(page, 10);
      const e = await est(page);
      r.troca = { vxNatan: +e.j[0].vx.toFixed(2), vxBruna: +e.j[1].vx.toFixed(2) };
      await toque.soltarTudo(); await ticks(page, 4);
      await toque.tocar(bt.x + bt.width / 2, bt.y + bt.height / 2, 60, page);
    }
    console.log(nomeAp, JSON.stringify(r));
  }

  // capturas com HUD (o que o jogador vê) em pontos fixos de cada capítulo
  r.capturas = {};
  for (const n of caps) {
    if (n !== 1) await entrarNoCapitulo(page, toque, n);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(saida, `${nomeAp}_cap${n}_inicio.png`) });
    const lista = roteiros[n];
    const pontos = [0.25, 0.5, 0.75, 0.97].map((f) => Math.floor(lista.length * f));
    r.capturas[n] = [];
    for (const p of pontos) {
      await page.evaluate(([l]) => { window.__edm.acelerar(30); window.__edm.roteiro(l); }, [lista.slice(0, p)]);
      await page.waitForFunction((t) => window.__edm.estado().tick >= t, p, { timeout: 600000, polling: 100 });
      await page.evaluate(() => window.__edm.acelerar(1));
      await page.waitForTimeout(1200);
      const nome = `${nomeAp}_cap${n}_t${p}`;
      await page.screenshot({ path: join(saida, `${nome}.png`) });
      const e = await est(page);
      r.capturas[n].push({ tick: p, nome, j: e.j.map((j) => [+j.x.toFixed(1), +j.y.toFixed(1)]) });
    }
  }
  r.erros = erros;
  await ctx.close();
}
writeFileSync(join(saida, 'jogo.json'), JSON.stringify(rel, null, 1));
await nav.close();
await vs.close();
