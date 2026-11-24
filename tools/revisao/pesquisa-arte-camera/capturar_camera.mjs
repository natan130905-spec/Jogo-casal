// Capturas antes/depois da câmera (pesquisa-arte-camera). Roda numa WORKTREE com o experimento aplicado
// (parâmetros ?cam=nova&eu=0&frente&tom=&exp= em src/render/cena.ts e o indicador em test/vitrine/vitrine.ts).
// Uso: RAIZ=<worktree> PORTA=4877 SAIDA=<pasta> node capturar_camera.mjs [modo…]   modos: antes depois tom
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const RAIZ = process.env.RAIZ; if (!RAIZ) throw new Error('defina RAIZ=<worktree>');
const req = createRequire(RAIZ + '/package.json');
const { createServer } = req('vite');
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const porta = Number(process.env.PORTA ?? 4877);
const saida = process.env.SAIDA ?? RAIZ + '/test-out/camera/'; mkdirSync(saida, { recursive: true });
const srv = await createServer({ root: RAIZ, server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await srv.listen();
const nav = await chromium.launch();
const aparelhos = { iphone14: { width: 750, height: 340 }, redmi11: { width: 873, height: 393 } };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
// cenas: [nome, fase, x, dx(parceiro), y]
const cenas = [
  ['c2_inicio', 'cap2-floresta', 4, 1.2, 3],
  ['c2_clareira', 'cap2-floresta', 98, 1.2, 4],
  ['c2_sep8', 'cap2-floresta', 64, 8, 4],
  ['c2_sep20', 'cap2-floresta', 70, 20, 4],
  ['c1_meio', 'cap1-brinquedos', 30, 1.2, 4],
  ['c5_doces', 'cap5-doces', 20, 1.2, 4],
];
const modos = { antes: '', depois: 'cam=nova&eu=0&frente', depois_eu1: 'cam=nova&eu=1&frente' };
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : ['antes', 'depois'];
const linhas = [];
for (const modo of pedidos) {
  const [base, extra] = modo.includes(':') ? modo.split(':') : [modo, ''];
  for (const q of (process.env.QS ?? 'media').split(',')) for (const [ap, vp] of Object.entries(aparelhos).filter(([k]) => !process.env.APARELHOS || process.env.APARELHOS.split(',').includes(k))) {
    const pg = await (await nav.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
    for (const [nome, fase, x, dx, y] of cenas) {
      if (process.env.CENAS && !process.env.CENAS.split(',').includes(nome)) continue;
      await pg.goto(`http://127.0.0.1:${porta}/test/vitrine/index.html?resfixa&q=${q}&fase=${fase}&${modos[base] ?? ''}&${extra}`);
      await pg.waitForFunction(() => window.__vit, null, { timeout: 90000 });
      await pg.evaluate(([x, y, dx]) => { window.__vit.irPara(x, y, dx); for (const j of window.__vit.estado.jogadores) j.invencivel = 1e6; }, [x, y, dx]);
      // espera os dois pousarem (a simulação anda devagar sem GPU) e a câmera assentar
      await pg.waitForFunction(() => window.__vit.estado.jogadores.every((j) => j.noChao), null, { timeout: 30000 }).catch(() => {});
      await pausa(Number(process.env.ESPERA ?? 4000));
      // congela a simulação e tira a invencibilidade (o personagem pisca quando invencível e pode sumir na foto)
      await pg.evaluate(() => { window.__vit.pausar(true); for (const j of window.__vit.estado.jogadores) j.invencivel = 0; });
      await pausa(800);
      await pg.evaluate(() => { const i = document.querySelector('#info'); if (i) i.style.display = 'none'; });
      const tag = `${modo.replace(/[:=&]/g, '_')}_${q}_${ap}_${nome}`;
      await pg.screenshot({ path: `${saida}${tag}.png` });
      const m = await pg.evaluate(() => {
        const v = window.__vit, c = v.cena, H = innerHeight, W = innerWidth;
        return v.estado.jogadores.map((j) => {
          const a = c.projetar(j.x, j.y), b = c.projetar(j.x, j.y + 1.1);
          return { x: +j.x.toFixed(1), y: +j.y.toFixed(2), alturaPx: Math.round((b.y - a.y) / 2 * H), pct: +((b.y - a.y) / 2 * 100).toFixed(1), naTela: Math.abs(a.x) <= 1 && Math.abs(b.y) <= 1, pesPctDeBaixo: +((a.y + 1) / 2 * 100).toFixed(0), xPct: +((a.x + 1) / 2 * 100).toFixed(0) };
        }).concat([{ ...v.info(), W, H }]);
      });
      linhas.push({ tag, m });
      console.log(tag, JSON.stringify(m));
    }
    await pg.context().close();
  }
}
writeFileSync(`${saida}medidas_${pedidos.join('+').replace(/[:=&]/g, '_')}.json`, JSON.stringify(linhas, null, 1));
await nav.close(); await srv.close();
