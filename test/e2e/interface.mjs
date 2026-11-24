// E2E da interface e da plataforma (L1): confere no navegador, com toque de verdade (CDP), o que o L1 prometeu.
//  R27  ❚❚ e Continuar respondem com o polegar segurando o joystick; o joystick vale ao continuar sem levantar o dedo
//  R28  um toque só em ✕ (mapa), Sair ou Mapa da jornada nunca sai da fase nem da sala; o segundo toque sai
//  R34  sem ?debug não há fps na tela; o nome do capítulo some depois de 3 s
//  R33  a tela de carregamento aparece e nenhuma tarefa > 200 ms acontece entre o toque em Jogar e ela pintada
//  R31  cartão "Adicionar à Tela de Início" no iPhone (uma vez), nunca no Android nem no app da Tela de Início
//  R55  ?diag=1 mostra o painel e ele custa < 0,3 ms por quadro
//  R26  dupla: o convidado some (página congelada: nada chega dele) com o joystick segurado → a Bruna para em ≤ 0,3 s de jogo e o
//       anfitrião pausa com aviso em ≤ 2 s; o anfitrião vai para segundo plano → o convidado vê a pausa com aviso
//  R39  treino: esconder o app pausa o jogo e suspende o som
// Uso: npx vite build && node test/e2e/interface.mjs [--so treino|dupla]   (DIST=pasta usa outro build)
// Portas: PORTA (vite preview, padrão 4729) e PORTA_SINAL (PeerJS, padrão 9147).
import { createRequire } from 'node:module';
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');

const so = (() => { const i = process.argv.indexOf('--so'); return i > 0 ? process.argv[i + 1] : null; })();
const saida = new URL('../../test-out/interface/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const porta = Number(process.env.PORTA ?? 4729);
let portaSinal = Number(process.env.PORTA_SINAL ?? 9147);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const medidas = {};
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };

const srv = await preview({ ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}), preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const nav = await chromium.launch();
const IPHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['iPhone 14 landscape'].userAgent };
const ANDROID = { viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7 landscape'].userAgent };

/** toque multi-dedo de verdade (Input.dispatchTouchEvent gera pointerdown/move/up de toque) */
class Toque {
  constructor(cdp) { this.cdp = cdp; this.dedos = new Map(); }
  async enviar(type) { await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...this.dedos].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 11, radiusY: 11, force: 1 })) }); }
  async baixar(id, x, y) { this.dedos.set(id, { x, y }); await this.enviar('touchStart'); }
  async mover(id, x, y) { this.dedos.set(id, { x, y }); await this.enviar('touchMove'); }
  // touchEnd leva SÓ o dedo que sai (com os que ficam, o CDP solta os que ficam: ver REGISTRO R71)
  async soltar(id) { const p = this.dedos.get(id); this.dedos.delete(id); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: p.x, y: p.y }] }); }
  async tocar(x, y) { await this.baixar(99, x, y); await pausa(60); await this.soltar(99); }
}
async function celular(perfil, url, { init } = {}) {
  const ctx = await nav.newContext(perfil);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url);
  return { ctx, page, cdp, toque: new Toque(cdp), erros };
}
const centro = async (page, sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const tocarEl = async (C, sel) => { const c = await centro(C.page, sel); await C.toque.tocar(c.x, c.y); };
const tela = (page) => page.evaluate(() => window.__edmFluxo.tela().t);
const estado = (page) => page.evaluate(() => { const e = window.__edm?.estado(); return e && { tick: e.tick, j: e.jogadores.map((j) => ({ x: j.x, vx: j.vx })) }; });
/** espera n ticks de jogo (sem GPU a página roda a poucos quadros por segundo; tempo real não serve) */
const ticks = async (page, n) => { const t0 = (await estado(page)).tick; await page.waitForFunction((t) => window.__edm.estado().tick >= t, t0 + n, { timeout: 120000, polling: 30 }); };
const base = `http://127.0.0.1:${porta}/?q=baixa&resfixa`;

/** entra no capítulo n pelo treino com toques; devolve a carga medida (tarefas longas até a tela pintada) */
async function entrar(C, n = 1) {
  await C.page.waitForSelector('#menu:not([hidden])');
  await tocarEl(C, '#bt-treino');
  await C.page.waitForSelector('#mapa:not([hidden])');
  await tocarEl(C, `.ilha[data-cap="${n}"]`);
  await pausa(200);
  await C.page.evaluate(() => {
    window.__longas = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longas.push([e.startTime, e.duration]); }).observe({ type: 'longtask' });
    // o toque começa aqui: o pointerdown do Jogar
    document.querySelector('#bt-jogar').addEventListener('pointerdown', () => { window.__toqueJogar = performance.now(); }, { once: true });
  });
  await tocarEl(C, '#bt-jogar');
  const viuCarregando = await C.page.waitForSelector('#carregando:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false);
  await C.page.waitForFunction((n) => window.__edm?.cap === n && window.__edm.estado().tick > 2, n, { timeout: 180000, polling: 50 });
  const c = await C.page.evaluate(() => {
    const k = window.__edm.carga(), t0 = window.__toqueJogar;
    const pintadaEm = t0 + k.pintadaMs; // aproximação: a carga começa no click, logo depois do pointerup
    const antes = window.__longas.filter(([s, d]) => s < pintadaEm && s + d > t0);
    return { ...k, maiorAntesDePintar: Math.round(Math.max(0, ...antes.map((x) => x[1]))), tarefasAntesDePintar: antes.map((x) => Math.round(x[1])),
      maiorTarefa: Math.round(Math.max(0, ...window.__longas.map((x) => x[1]))) };
  });
  return { viuCarregando, ...c };
}

// ------------------------------------------------------------------ treino (um celular)
if (so !== 'dupla') {
  const C = await celular(ANDROID, base);
  const carga = await entrar(C, 1);
  medidas.carga = carga;
  checar(carga.viuCarregando, 'R33: a tela de carregamento aparece ao tocar em Jogar');
  checar(carga.maiorAntesDePintar <= 200, `R33: nenhuma tarefa > 200 ms entre o toque e a tela pintada (maior ${carga.maiorAntesDePintar} ms; pintada em ${carga.pintadaMs} ms; pronta em ${carga.prontaMs} ms; maior tarefa depois ${carga.maiorTarefa} ms)`);
  // R34
  const info = await C.page.evaluate(() => { const el = document.querySelector('#hud-info'); return { texto: el.textContent, visivel: getComputedStyle(el).display !== 'none' }; });
  checar(!/fps/.test(info.texto) && !info.visivel, `R34: sem ?debug, nada de fps na tela ("${info.texto}")`);
  await C.page.waitForFunction(() => document.querySelector('#hud-cap').classList.contains('some'), null, { timeout: 15000 }).catch(() => {});
  await pausa(1000); // a transição de opacidade leva 0,6 s
  const cap = await C.page.evaluate(() => getComputedStyle(document.querySelector('#hud-cap')).opacity);
  checar(Number(cap) < 0.05, `R34: o nome do capítulo some depois de 3 s (opacidade ${cap})`);
  // R27: joystick segurado + ❚❚
  const J = await centro(C.page, '#joystick');
  await C.toque.baixar(1, J.x, J.y); await C.toque.mover(1, J.x + 60, J.y); await ticks(C.page, 6);
  const P = await centro(C.page, '#bt-pausa');
  await C.toque.baixar(5, P.x, P.y); await pausa(80); await C.toque.soltar(5);
  const pausou = await C.page.waitForSelector('#pausa:not([hidden])', { timeout: 4000 }).then(() => true).catch(() => false);
  checar(pausou, 'R27: ❚❚ pausa com o polegar segurando o joystick');
  await C.page.screenshot({ path: saida + 'pausa.png' });
  // R28 na pausa: um toque em Mapa da jornada e um em Sair não saem
  if (pausou) {
    await tocarEl(C, '#bt-pausa-mapa'); await pausa(400);
    const t1 = await tela(C.page), txt = await C.page.textContent('#bt-pausa-mapa');
    checar(t1 === 'fase', `R28: um toque em "Mapa da jornada" não sai da fase (tela ${t1}; botão: "${txt}")`);
    await C.page.screenshot({ path: saida + 'pausa_confirmar.png' });
    await tocarEl(C, '#bt-pausa-sair'); await pausa(400);
    checar(await tela(C.page) === 'fase' && new URL(C.page.url()).search.includes('q=baixa'), 'R28: um toque em "Sair" não sai');
    await pausa(3200); // o pedido de confirmação expira
    checar(!(await C.page.textContent('#bt-pausa-sair')).includes('de novo'), 'R28: o pedido de confirmação expira em 3 s');
    // R27: Continuar com o dedo ainda no joystick; o joystick vale sem levantar o dedo
    const Cn = await centro(C.page, '#bt-continuar');
    await C.toque.baixar(5, Cn.x, Cn.y); await pausa(80); await C.toque.soltar(5);
    const continuou = await C.page.waitForSelector('#pausa', { state: 'hidden', timeout: 4000 }).then(() => true).catch(() => false);
    checar(continuou, 'R27: Continuar responde com o polegar segurando o joystick');
    // o mesmo dedo (sem levantar) vai para o outro lado (para a direita o Natan pode estar parado numa parede)
    await C.toque.mover(1, J.x - 60, J.y); await ticks(C.page, 8);
    const vx = (await estado(C.page)).j[0].vx;
    checar(vx < -3, `R27: depois de continuar, o joystick segurado anda sem levantar o dedo (vx ${vx.toFixed(2)})`);
  }
  await C.toque.soltar(1); await ticks(C.page, 4);
  // ⇄ com o dedo no joystick
  await C.toque.baixar(1, J.x, J.y);
  const T = await centro(C.page, '#bt-trocar');
  await C.toque.baixar(6, T.x, T.y); await pausa(80); await C.toque.soltar(6); await pausa(200);
  await C.toque.mover(1, J.x + 60, J.y); await ticks(C.page, 10);
  const e = await estado(C.page);
  checar(Math.abs(e.j[1].vx) > 3 && Math.abs(e.j[0].vx) < 0.5, `R27: ⇄ troca com o polegar no joystick (vx Natan ${e.j[0].vx.toFixed(2)}, Bruna ${e.j[1].vx.toFixed(2)})`);
  await C.toque.soltar(1);
  await tocarEl(C, '#bt-trocar');
  // R39: esconder o app pausa (e o som fica suspenso)
  await C.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await pausa(300);
  checar(await C.page.evaluate(() => window.__edmFluxo.pausado()), 'R39: treino, app escondido → pausa');
  await C.page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  // R28 no mapa: Continuar → (dois toques em Mapa) → mapa; um toque no ✕ não sai
  await tocarEl(C, '#bt-pausa-mapa'); await pausa(300); await tocarEl(C, '#bt-pausa-mapa');
  await C.page.waitForSelector('#mapa:not([hidden])', { timeout: 10000 }).catch(() => {});
  checar(await tela(C.page) === 'mapa', 'R28: o segundo toque em "Mapa da jornada" volta ao mapa');
  await tocarEl(C, '#bt-mapa-sair'); await pausa(500);
  checar(await tela(C.page) === 'mapa' && await C.page.isVisible('#mapa'), `R28: um toque no ✕ do mapa não sai ("${await C.page.textContent('#bt-mapa-sair')}")`);
  await C.page.screenshot({ path: saida + 'mapa_confirmar.png' });
  await tocarEl(C, '#bt-mapa-sair');
  await C.page.waitForSelector('#menu:not([hidden])', { timeout: 15000 }).catch(() => {});
  checar(await C.page.isVisible('#menu'), 'R28: o segundo toque no ✕ sai para o menu');
  checar(!C.erros.length, `sem erros na página (${C.erros.slice(0, 2).join(' | ')})`);
  await C.ctx.close();

  // R55: painel ?diag=1
  const D = await celular(ANDROID, `${base}&diag=1`);
  await entrar(D, 2);
  await ticks(D.page, 120);
  const dg = await D.page.evaluate(() => ({ ...window.__edm.diag(), texto: document.querySelector('#diag')?.textContent }));
  medidas.diag = { media: dg.media, p95: dg.p95, gpu: dg.gpu };
  checar(!!dg.texto && /fps/.test(dg.texto), `R55: ?diag=1 mostra o painel ("${dg.texto?.slice(0, 50)}")`);
  checar(dg.media < 0.3, `R55: o painel custa < 0,3 ms por quadro (média ${dg.media.toFixed(3)} ms, p95 ${dg.p95.toFixed(3)} ms)`);
  checar(/GPU/.test(dg.relatorio) && dg.relatorio.split('\n').length > 5, 'R55: o relatório tem a GPU e as linhas do painel');
  await D.page.locator('#diag').tap(); await pausa(600);
  await D.page.screenshot({ path: saida + 'diag.png' });
  await D.ctx.close();

  // R31: cartão do iPhone
  const I = await celular(IPHONE, base);
  checar(await I.page.isVisible('#aviso-ios'), 'R31: iPhone no Safari vê o cartão "Adicionar à Tela de Início"');
  await I.page.screenshot({ path: saida + 'aviso_ios.png' });
  await tocarEl(I, '#bt-aviso-ios'); await pausa(200);
  await I.page.reload(); await I.page.waitForSelector('#menu:not([hidden])');
  checar(await I.page.isHidden('#aviso-ios'), 'R31: o cartão aparece uma vez só');
  await I.ctx.close();
  const Ip = await celular(IPHONE, base, { init: () => Object.defineProperty(navigator, 'standalone', { get: () => true }) });
  checar(await Ip.page.isHidden('#aviso-ios'), 'R31: aberto pelo ícone da Tela de Início, sem cartão');
  await Ip.ctx.close();
  const An = await celular(ANDROID, base);
  checar(await An.page.isHidden('#aviso-ios'), 'R31: Android, sem cartão');
  // controles acima da barra de início (iPhone com área segura de 21 px embaixo)
  await An.ctx.close();
  const Is = await celular({ ...IPHONE, viewport: { width: 844, height: 390 } }, base);
  await Is.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 47, right: 47, bottom: 21, top: 0 } }).catch(() => {});
  await tocarEl(Is, '#bt-aviso-ios');
  await entrar(Is, 1);
  const r = await Is.page.evaluate(() => ['#joystick', '#bt-pulo'].map((s) => document.querySelector(s).getBoundingClientRect().bottom));
  checar(r.every((b) => b <= 390 - 21), `R31: joystick e ⬆ acima da barra de início (fundo em ${r.map(Math.round).join(' e ')} px; limite ${390 - 21})`);
  await Is.ctx.close();
}

// ------------------------------------------------------------------ dupla (dois celulares)
if (so !== 'treino') {
  const sinal = await new Promise((r) => { const s = PeerServer({ port: portaSinal, path: '/', host: '127.0.0.1' }, (x) => r({ s, porta: x.address().port })); });
  const url = `${base}&sinal=127.0.0.1:${sinal.porta}`;
  const A = await celular(ANDROID, url), B = await celular(IPHONE, url);
  await tocarEl(B, '#bt-aviso-ios').catch(() => {});
  await A.page.click('#bt-criar');
  await A.page.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  await B.page.fill('#codigo', await A.page.textContent('#sala-codigo')); await B.page.click('#bt-entrar');
  await A.page.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
  await A.page.click('#bt-pular');
  await A.page.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  await A.page.click('#bt-jogar');
  for (const C of [A, B]) await C.page.waitForFunction(() => window.__edm?.cap === 1 && window.__edm.estado().tick > 5, null, { timeout: 180000 });
  // convidado segura o joystick para a esquerda; espera a Bruna correr no anfitrião
  const J = await centro(B.page, '#joystick');
  await B.toque.baixar(1, J.x, J.y); await B.toque.mover(1, J.x - 60, J.y);
  await A.page.waitForFunction(() => Math.abs(window.__edm.estado().jogadores[1].vx) > 4, null, { timeout: 60000, polling: 30 });
  // congela o convidado (como o app em segundo plano sem aviso) e acompanha no anfitrião, tick a tick
  await A.page.evaluate(() => {
    window.__vigia = { t0: performance.now(), tick0: window.__edm.estado().tick, parouTick: -1, pausouMs: -1, aviso: '' };
    const f = () => {
      const v = window.__vigia, e = window.__edm.estado();
      if (v.parouTick < 0 && Math.abs(e.jogadores[1].vx) < 0.05) v.parouTick = e.tick;
      if (v.pausouMs < 0 && window.__edmFluxo.pausado()) { v.pausouMs = performance.now() - v.t0; v.aviso = document.querySelector('#pausa-quem').textContent; }
      if (v.pausouMs < 0 || v.parouTick < 0) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  // o Page.setWebLifecycleState 'frozen' do CDP não congela uma página visível (medido: o anfitrião seguiu recebendo
  // ~6 mensagens/s; REGISTRO R72): o "congelado" é simulado cortando tudo o que o convidado manda pela rede, que é o
  // que o anfitrião vê de uma página congelada
  const prazo = await A.page.evaluate(() => window.__edm.sumico());
  await B.page.evaluate(() => { window.__sendOrig = RTCDataChannel.prototype.send; RTCDataChannel.prototype.send = function () {}; });
  await A.page.waitForFunction(() => window.__vigia.pausouMs >= 0 && window.__vigia.parouTick >= 0, null, { timeout: 60000, polling: 50 }).catch(() => {});
  const v = await A.page.evaluate(() => window.__vigia);
  const fim = await A.page.evaluate(() => window.__edm.sumico());
  // conta da ÚLTIMA mensagem que chegou do convidado (a que já estava a caminho quando ele "congelou" ainda vale):
  // até 6 entradas na fila + 6 ticks repetindo a última + 6 ticks freando de 5,2 m/s = 18 ticks (0,3 s)
  const parouEm = v.parouTick - Math.max(v.tick0, fim.ultimaTick);
  v.pausouMs -= Math.max(0, fim.ultimaEm - v.t0);
  medidas.convidadoCongelado = { ticksAteParar: parouEm, msAteParar: Math.round(parouEm * 1000 / 60), msAtePausar: Math.round(v.pausouMs), aviso: v.aviso };
  checar(parouEm >= 0 && parouEm <= 18, `R26: convidado congelado → vxBruna = 0 em ${parouEm} ticks (${Math.round(parouEm * 1000 / 60)} ms de jogo; limite 18 = 0,3 s)`);
  // no celular (mensagens a cada 16–33 ms) o prazo é 1,5 s; numa máquina sem GPU que manda devagar ele cresce (8 ×
  // o intervalo típico), para não pausar à toa: o limite aqui é esse prazo + 500 ms de quadro
  medidas.convidadoCongelado.prazoMs = Math.round(prazo.prazo); medidas.convidadoCongelado.intervaloMs = Math.round(prazo.intervalo);
  checar(v.pausouMs >= 0 && v.pausouMs <= Math.max(2000, prazo.prazo + 500), `R26: o anfitrião pausa com aviso ${Math.round(v.pausouMs)} ms depois da última mensagem do convidado ("${v.aviso}"; prazo ${Math.round(prazo.prazo)} ms com mensagens a cada ${Math.round(prazo.intervalo)} ms; no celular 1,5 s)`);
  await A.page.screenshot({ path: saida + 'anfitriao_convidado_sumiu.png' });
  await B.page.evaluate(() => { RTCDataChannel.prototype.send = window.__sendOrig; });
  await B.toque.soltar(1);
  // o convidado volta: a pausa continua até alguém tocar em Continuar
  await pausa(1500);
  checar(await A.page.evaluate(() => window.__edmFluxo.pausado()), 'R26: a pausa continua quando o convidado volta (ninguém é pego de surpresa)');
  await A.page.click('#bt-continuar');
  await B.page.waitForSelector('#pausa', { state: 'hidden', timeout: 10000 }).catch(() => {});
  // anfitrião vai para segundo plano (visibilitychange): o convidado vê a pausa com aviso
  await A.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const viu = await B.page.waitForFunction(() => !document.querySelector('#pausa').hidden && /Natan saiu/.test(document.querySelector('#pausa-quem').textContent), null, { timeout: 10000 }).then(() => true).catch(() => false);
  checar(viu, `R26: anfitrião escondido → o convidado vê "pausado" com aviso ("${await B.page.textContent('#pausa-quem')}")`);
  await B.page.screenshot({ path: saida + 'convidado_anfitriao_saiu.png' });
  await A.page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  const voltou = await B.page.waitForFunction(() => /voltou|Pausado/.test(document.querySelector('#pausa-quem').textContent), null, { timeout: 10000 }).then(() => true).catch(() => false);
  checar(voltou, `R26: anfitrião voltou → o aviso muda ("${await B.page.textContent('#pausa-quem')}")`);
  // R28 na dupla: um toque em Sair (convidado) não derruba a sala
  await A.page.click('#bt-continuar').catch(() => {});
  await B.page.waitForSelector('#pausa', { state: 'hidden', timeout: 10000 }).catch(() => {});
  await tocarEl(B, '#bt-pausa');
  await B.page.waitForSelector('#pausa:not([hidden])', { timeout: 10000 }).catch(() => {});
  await tocarEl(B, '#bt-pausa-sair'); await pausa(1500);
  checar(await A.page.evaluate(() => !document.querySelector('#caiu').hidden) === false && await tela(B.page) === 'fase', 'R28: um toque em Sair no convidado não derruba a sala');
  checar(!A.erros.length && !B.erros.length, `dupla sem erros na página (${[...A.erros, ...B.erros].slice(0, 2).join(' | ')})`);
  await A.ctx.close(); await B.ctx.close(); sinal.s.close?.();
}

writeFileSync(saida + 'medidas.json', JSON.stringify(medidas, null, 1));
console.log(JSON.stringify(medidas));
console.log(ok ? 'APROVADO' : 'REPROVADO');
await nav.close(); await srv.close();
process.exit(ok ? 0 : 1);
