// Playtest das TELAS com toque real: menu, sala, prólogo, mapa, entrada na fase, HUD, pausa, capítulo concluído.
// Mede: tamanho das letras, alvos de toque, entalhe/barra do iPhone, tempo até cada tela e o que é baixado.
// Uso: node tools/revisao/playtester/telas.mjs --raiz <cópia do jogo> [--porta 4891] [--saida <dir>] [--aps iphone,android]
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APARELHOS, auditarDom, celular, centro, pasta, playwright, subirVite } from './comum.mjs';

const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', '.'));
const porta = Number(opt('porta', 4891));
const saida = pasta(resolve(opt('saida', join(raiz, 'test-out/playtester/telas'))));
const aps = opt('aps', 'iphone,iphoneSafari,android').split(',');

const vs = await subirVite(raiz, porta);
const { chromium } = playwright();
const nav = await chromium.launch();
const base = `http://127.0.0.1:${porta}/`;
const rel = {};

for (const nomeAp of aps) {
  const ap = APARELHOS[nomeAp];
  const r = (rel[nomeAp] = { aparelho: ap.nome, telas: {}, tempos: {}, rede: {} });
  const { page, toque, erros, ctx } = await celular(nav, ap);
  let fase = 'menu';
  const bytes = {};
  page.on('response', async (res) => {
    try { const b = (await res.body()).length; const u = new URL(res.url()); if (/\.(webp|png|mp3|glb|svg)$/.test(u.pathname)) { bytes[fase] = bytes[fase] ?? []; bytes[fase].push([u.pathname, b]); } } catch { /* */ }
  });
  const foto = async (nome) => { await page.screenshot({ path: join(saida, `${nomeAp}_${nome}.png`) }); };
  const auditar = async (nome) => { r.telas[nome] = await auditarDom(page, ap.seguro); await foto(nome); };
  const tocarEl = async (sel) => { const b = await page.locator(sel).boundingBox(); if (!b) throw new Error(`sem ${sel}`); const c = centro(b); await toque.tocar(c.x, c.y, 60, page); };

  let t0 = Date.now();
  await page.goto(`${base}?resfixa`);
  await page.waitForSelector('#menu:not([hidden])');
  r.tempos.menu = Date.now() - t0;
  await page.waitForTimeout(1200);
  await auditar('menu');

  // sala: criar (servidor público do PeerJS; aqui provavelmente sem rede) — o que a pessoa vê enquanto espera/erra
  fase = 'sala';
  await tocarEl('#bt-criar');
  await page.waitForTimeout(8000);
  await auditar('sala');
  r.salaStatus = await page.textContent('#sala-status');
  await page.goto(`${base}?resfixa`); await page.waitForSelector('#menu:not([hidden])');

  // entrar com código inválido
  await tocarEl('#codigo'); await page.keyboard.type('AB'); await tocarEl('#bt-entrar');
  await page.waitForTimeout(300);
  r.erroCodigo = await page.textContent('#menu-erro');
  await foto('menu_codigo_curto');

  // treino → mapa
  fase = 'mapa';
  t0 = Date.now();
  await tocarEl('#bt-treino');
  await page.waitForSelector('#mapa:not([hidden])');
  r.tempos.mapa = Date.now() - t0;
  await page.waitForTimeout(1500);
  await auditar('mapa');
  // prólogo pelo botão História
  fase = 'prologo';
  await tocarEl('#bt-historia');
  await page.waitForSelector('#quadrinhos:not([hidden])');
  t0 = Date.now();
  await page.waitForFunction(() => document.querySelector('#qd-arte img.pronta'), null, { timeout: 15000 }).catch(() => {});
  r.tempos.prologoArte1 = Date.now() - t0;
  await page.waitForTimeout(600);
  await auditar('prologo1');
  const nQuadros = await page.locator('#qd-pontos i').count();
  for (let k = 1; k < nQuadros; k++) { await toque.tocar(ap.w / 2, ap.h / 2, 60, page); await page.waitForTimeout(250); }
  await page.waitForTimeout(800);
  await auditar('prologo_ultimo');
  r.textosPrologo = await page.evaluate(() => document.querySelector('#qd-texto').textContent.length);
  await toque.tocar(ap.w / 2, ap.h / 2, 60, page);
  await page.waitForSelector('#mapa:not([hidden])');
  // ilha 3 (toque na ilha, depois Jogar)
  await tocarEl('.ilha[data-cap="3"]');
  await page.waitForTimeout(400);
  await auditar('mapa_sel3');
  await tocarEl('.ilha[data-cap="1"]');
  await page.waitForTimeout(300);

  // fase 1
  fase = 'fase1';
  t0 = Date.now();
  await tocarEl('#bt-jogar');
  await page.waitForFunction(() => window.__edm?.estado()?.tick > 0, null, { timeout: 60000 });
  r.tempos.fase1PrimeiroTick = Date.now() - t0;
  await page.waitForTimeout(2500);
  await auditar('fase1_inicio');
  r.hudInfo = await page.textContent('#hud-info');
  // pausa
  await tocarEl('#bt-pausa');
  await page.waitForTimeout(300);
  const tickP = await page.evaluate(() => window.__edm.estado().tick);
  await page.waitForTimeout(800);
  r.pausaPara = tickP === await page.evaluate(() => window.__edm.estado().tick);
  await auditar('pausa');
  await tocarEl('#bt-continuar');
  await page.waitForTimeout(300);

  // capítulo concluído (só no iPhone: bots gravados + aceleração)
  if (nomeAp === 'iphone') {
    const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
    const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
    const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');
    const f = faseDoCapitulo(1); const lista = [];
    jogar(f, PLANOS[f.id], { limite: 420, entradas: (e) => lista.push(e.map((i) => ({ ...i }))) });
    await page.evaluate((l) => { window.__edm.acelerar(40); window.__edm.roteiro(l); }, lista);
    fase = 'concluido';
    await page.waitForSelector('#concluido:not([hidden])', { timeout: 600000 });
    await page.waitForTimeout(900);
    await auditar('concluido');
    await tocarEl('#bt-conc-continuar');
    await page.waitForSelector('#quadrinhos:not([hidden])');
    await page.waitForTimeout(1500);
    await auditar('lembranca1');
  }
  r.rede = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, { arquivos: v.length, kB: Math.round(v.reduce((s, x) => s + x[1], 0) / 1024), lista: v.map(([p, b]) => `${p} ${Math.round(b / 1024)}k`) }]));
  r.erros = erros;
  await ctx.close();
  console.log(nomeAp, JSON.stringify(r.tempos), r.salaStatus);
}
writeFileSync(join(saida, 'telas.json'), JSON.stringify(rel, null, 1));
await nav.close();
await vs.close();
