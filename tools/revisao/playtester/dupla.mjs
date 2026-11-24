// Playtest em DUPLA (dois "celulares": iPhone anfitrião e Android convidado, servidor PeerJS local).
// Confere o que só aparece com duas pessoas: o que o convidado vê no mapa e na pausa, e o que acontece com a Bruna
// quando o celular do convidado vai para segundo plano (página congelada via CDP Page.setWebLifecycleState) com o
// dedo no joystick.
// Uso: node tools/revisao/playtester/dupla.mjs --raiz <cópia> [--porta 4896] [--sinal 9196] [--saida <dir>]
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { APARELHOS, celular, centro, pasta, playwright, subirVite } from './comum.mjs';

const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', '.'));
const saida = pasta(resolve(opt('saida', join(raiz, 'test-out/playtester/dupla'))));
const porta = Number(opt('porta', 4896)), portaSinal = Number(opt('sinal', 9196));
const { PeerServer } = createRequire(join(raiz, 'package.json'))('peer');
await new Promise((r) => PeerServer({ port: portaSinal, path: '/', host: '127.0.0.1' }, r));
const vs = await subirVite(raiz, porta);
const { chromium } = playwright();
const nav = await chromium.launch();
const url = `http://127.0.0.1:${porta}/?resfixa&q=baixa&sinal=127.0.0.1:${portaSinal}`;
const A = await celular(nav, APARELHOS.iphone), B = await celular(nav, APARELHOS.android);
const tocar = async (C, sel) => { const c = centro(await C.page.locator(sel).boundingBox()); await C.toque.tocar(c.x, c.y, 60, C.page); };
const r = {};
await A.page.goto(url); await B.page.goto(url);
await tocar(A, '#bt-criar');
await A.page.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
const cod = await A.page.textContent('#sala-codigo');
await B.page.fill('#codigo', cod); await tocar(B, '#bt-entrar');
await A.page.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
await B.page.waitForSelector('#quadrinhos:not([hidden])', { timeout: 30000 });
await B.page.waitForTimeout(800);
await B.page.screenshot({ path: join(saida, 'convidado_prologo.png') });
r.convidadoPodePular = await B.page.isVisible('#bt-pular');
await tocar(A, '#bt-pular');
await B.page.waitForSelector('#mapa:not([hidden])'); await B.page.waitForTimeout(800);
await B.page.screenshot({ path: join(saida, 'convidado_mapa.png') });
await tocar(A, '#bt-jogar');
await A.page.waitForFunction(() => window.__edm?.estado()?.tick > 5, null, { timeout: 60000 });
await B.page.waitForFunction(() => window.__edm?.estado()?.tick > 5, null, { timeout: 60000 });
await B.page.waitForTimeout(1500);
await B.page.screenshot({ path: join(saida, 'convidado_cap1.png') });
// convidado segura o joystick para a esquerda (Bruna vai para a esquerda, para longe do caminho) e o celular "sai"
const jb = await B.page.locator('#joystick').boundingBox();
const J = centro(jb);
await B.toque.baixar(1, J.x, J.y); await B.toque.mover(1, J.x - 60, J.y);
const tickDe = () => A.page.evaluate(() => window.__edm.estado().tick);
let t0 = await tickDe(); console.log('tick', t0, await A.page.evaluate(() => window.__edmFluxo.pausado()), await B.page.evaluate(() => window.__edm.estado().tick));
await A.page.waitForFunction((t) => window.__edm.estado().tick > t + 30, t0, { timeout: 120000 });
const bx0 = await A.page.evaluate(() => window.__edm.estado().jogadores[1].x);
const cdpB = B.cdp;
await cdpB.send('Page.setWebLifecycleState', { state: 'frozen' });
t0 = await tickDe(); await A.page.waitForFunction((t) => window.__edm.estado().tick > t + 180, t0, { timeout: 300000 });
const s = await A.page.evaluate(() => { const e = window.__edm.estado(); return { bx: e.jogadores[1].x, vx: e.jogadores[1].vx, quedas: window.__edm.contagem().caiu ?? 0, pausado: window.__edmFluxo.pausado(), caiuTela: !document.querySelector('#caiu').hidden }; });
r.convidadoCongelado3s = { bxAntes: +bx0.toFixed(2), bxDepois: +s.bx.toFixed(2), vxBruna: +s.vx.toFixed(2), anfitriaoPausou: s.pausado, avisoConexao: s.caiuTela, quedas: s.quedas };
await A.page.screenshot({ path: join(saida, 'anfitriao_convidado_congelado.png') });
await cdpB.send('Page.setWebLifecycleState', { state: 'active' });
// pausa pelo convidado
await B.toque.soltarTudo();
await tocar(B, '#bt-pausa');
await A.page.waitForSelector('#pausa:not([hidden])', { timeout: 10000 }).catch(() => {});
await B.page.waitForTimeout(800);
r.pausaTextoAnfitriao = await A.page.textContent('#pausa-quem');
await A.page.screenshot({ path: join(saida, 'anfitriao_pausa_pelo_convidado.png') });
await B.page.screenshot({ path: join(saida, 'convidado_pausa.png') });
console.log(JSON.stringify(r));
writeFileSync(join(saida, 'dupla.json'), JSON.stringify(r, null, 1));
await nav.close(); await vs.close(); process.exit(0);
