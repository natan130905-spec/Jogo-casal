// Quanto tempo a tela "congela" ao tocar em Jogar ▶ (o construtor da fase roda síncrono no toque) e quanto tempo até
// o primeiro quadro do jogo. Mede tarefas longas (PerformanceObserver 'longtask') do toque até o tick 1.
// Uso: node tools/revisao/playtester/carga.mjs --raiz <cópia> [--porta 4895] [--caps 1,2,3,7] [--q baixa,media,alta]
// Limite: máquina sem GPU (SwiftShader compila shaders na CPU) e processador de computador: compare entre si, não
// como número do celular.
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { APARELHOS, celular, centro, pasta, playwright, subirVite } from './comum.mjs';

const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', '.'));
const saida = pasta(resolve(opt('saida', join(raiz, 'test-out/playtester'))));
const caps = opt('caps', '1,2,3,7').split(',').map(Number);
const qs = opt('q', 'baixa,media,alta').split(',');
const porta = Number(opt('porta', 4895));
const vs = await subirVite(raiz, porta);
const { chromium } = playwright();
const nav = await chromium.launch();
const res = [];
for (const q of qs) for (const n of caps) {
  const { page, toque, ctx } = await celular(nav, APARELHOS.android);
  await page.goto(`http://127.0.0.1:${porta}/?resfixa&q=${q}`);
  await page.waitForSelector('#menu:not([hidden])');
  const tocar = async (sel) => { const c = centro(await page.locator(sel).boundingBox()); await toque.tocar(c.x, c.y, 50, page); };
  await tocar('#bt-treino'); await page.waitForSelector('#mapa:not([hidden])');
  await tocar(`.ilha[data-cap="${n}"]`); await page.waitForTimeout(300);
  // aquece o módulo da fase com uma visita (o 1º carregamento do Vite de desenvolvimento transforma arquivos)
  await page.evaluate(() => { window.__longas = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longas.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); window.__t0 = performance.now(); });
  await tocar('#bt-jogar');
  await page.waitForFunction(() => window.__edm?.estado()?.tick > 0, null, { timeout: 120000, polling: 20 });
  const m = await page.evaluate(() => ({ ateTick1: Math.round(performance.now() - window.__t0), maiorTarefa: Math.round(Math.max(0, ...window.__longas.map((x) => x[1]))), somaTarefas: Math.round(window.__longas.reduce((s, x) => s + x[1], 0)), mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));
  res.push({ q, cap: n, ...m });
  console.log(JSON.stringify(res.at(-1)));
  await ctx.close();
}
writeFileSync(join(saida, 'carga.json'), JSON.stringify(res, null, 1));
await nav.close(); await vs.close();
