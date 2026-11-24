// Capturas da vitrine (elementos de jogo e temas). Uso: PORTA=4821 node test/vitrine/capturar.mjs [cenas…]
// Sobe o servidor de desenvolvimento, abre a vitrine num "celular" em paisagem e salva PNGs em test-out/vitrine/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');

const porta = Number(process.env.PORTA ?? 4821);
const saida = new URL('../../test-out/vitrine/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const srv = await createServer({ server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await srv.listen();
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const pagina = await (await navegador.newContext({ ...devices['Pixel 7 landscape'] })).newPage();
const erros = [];
pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pagina.on('pageerror', (e) => erros.push(String(e)));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const abrir = async (q) => {
  await pagina.goto(`http://127.0.0.1:${porta}/test/vitrine/index.html?resfixa&q=${process.env.Q ?? 'media'}&${q}`);
  await pagina.waitForFunction(() => window.__vit, null, { timeout: 60000 });
  await pausa(1500);
};
const vit = (f, ...a) => pagina.evaluate(([f, a]) => window.__vit[f](...a), [f, a]);
const medidas = [];
const foto = async (nome) => {
  await pagina.screenshot({ path: `${saida}${nome}.png` });
  const i = await vit('info'); medidas.push(`${nome}: ${i.chamadas} ch, ${i.triangulos} tri`);
};

const cenas = {
  async inicio() { await abrir('fase=exemplo-mecanicas'); await vit('irPara', 3.5); await pausa(800); await foto('01_inicio'); },
  async tiro() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 2.5); await pausa(500);
    await vit('entradas', { shoot: true }, { shoot: true }); await pausa(450); await foto('02_tiro');
    await pausa(900); await vit('entradas', null); await pausa(250); await foto('03_estouro');
  },
  async fio() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 12.6, 0, 1.4); await pausa(600);
    // pose montada à mão (simulação pausada): Natan na beira segurando, Bruna pendurada sobre o abismo
    await vit('pausar', true);
    await pagina.evaluate(() => {
      const e = window.__vit.estado, [a, b] = e.jogadores;
      Object.assign(a, { x: 13.5, y: 0, vx: 0, vy: 0, noChao: true, segurando: true, olhando: 1 });
      Object.assign(b, { x: 16.2, y: -2.6, vx: 1.5, vy: 0, noChao: false, pendurado: true, olhando: 1 });
      Object.assign(e.fio, { zona: 0, comprimento: 3.2, ancora: 0, pendurado: 1, frouxo: false });
    });
    await pausa(1200); await foto('04_fio_pendurado');
    await pagina.evaluate(() => {
      const e = window.__vit.estado, [a, b] = e.jogadores;
      Object.assign(a, { x: 12.0, y: 0, segurando: false }); Object.assign(b, { x: 13.4, y: 0, noChao: true, pendurado: false });
    });
    await pausa(800); await foto('05_fio_frouxo');
    await pagina.evaluate(() => {
      const e = window.__vit.estado, [a, b] = e.jogadores;
      Object.assign(a, { x: 9, y: 0, olhando: -1, vx: -3 }); Object.assign(b, { x: 13, y: 0, olhando: 1, vx: 3 }); e.fio.comprimento = 4;
    });
    await pausa(800); await foto('06_fio_esticado');
  },
  async argola() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 16.5, 4.2, -3.5);
    await vit('entradas', { act: true }, {}); await pausa(300); await vit('entradas', { x: 1 }, {}); await pausa(700); await foto('07_argola');
  },
  async especiais() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 24.5, 0.6, 2); await pausa(1200); await foto('08_especiais');
    await vit('irPara', 30.5, 0.6, 1.5); await pausa(1500); await foto('09_especiais2');
  },
  async bichos() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 40.8, 0, 1.0); await pausa(2800); await foto('10_cogumelo_morcego');
  },
  async rei() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 52, 0, 1.2); await pausa(1500); await foto('11_rei');
    await pagina.evaluate(() => { const n = window.__vit.estado.inimigos.find((x) => x.tipo === 'rei'); n.aberto = true; n.t = 0; });
    await vit('entradas', { shoot: true, x: 0 }, { shoot: true }); await pausa(500); await foto('12_rei_aberto');
  },
  async bolha() {
    await abrir('fase=exemplo-mecanicas'); await vit('irPara', 4.5, 0, 2.5);
    await pausa(300); await vit('pausar', true);
    await pagina.evaluate(() => { const j = window.__vit.estado.jogadores[1]; Object.assign(j, { bolha: true, coracoes: 0, y: 1.4, invencivel: 0, noChao: false }); });
    await pausa(1000); await foto('13_bolha');
  },
  async temas() {
    for (const t of ['brinquedos', 'floresta', 'relogio', 'oceano', 'doces', 'espelhos', 'cosmos']) {
      await abrir(`fase=exemplo-mecanicas&tema=${t}`); await vit('irPara', 5.5); await pausa(600); await foto(`20_tema_${t}`);
    }
  },
  async cap1() {
    await abrir('fase=cap1-brinquedos'); await vit('irPara', 10); await pausa(700); await foto('30_cap1_a');
    await vit('irPara', 50); await pausa(700); await foto('31_cap1_b');
    await vit('irPara', 80); await pausa(700); await foto('32_cap1_c');
  },
  async floresta() {
    for (const [n, x] of [['a', 3], ['b', 22], ['c', 37], ['d', 50]]) { await abrir(`fase=floresta-1&x=${x}`); await pausa(1200); await foto(`40_floresta_${n}`); }
  },
};
const pedidas = process.argv.slice(2);
for (const [nome, f] of Object.entries(cenas)) if (!pedidas.length || pedidas.includes(nome)) { console.log('·', nome); await f(); }
console.log(medidas.join('\n'));
if (erros.length) console.log('ERROS:\n' + erros.slice(0, 10).join('\n'));
await navegador.close(); await srv.close();
process.exit(erros.length ? 1 : 0);
