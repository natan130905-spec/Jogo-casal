// Verificação no navegador da câmera por jogador e do indicador do parceiro (equipe camera-hud, lote 0).
// Mede com a câmera REAL do render (window.__edm.camera(): pés e cabeça projetados pela PerspectiveCamera da cena):
//  1. tamanho do personagem seguido em vários pontos das partidas dos bots, nos 7 capítulos;
//  2. indicador: aparece no MESMO quadro em que o parceiro sai do quadro, some quando ele volta, fica a ≥ 12 px dos
//     botões, do joystick e do HUD, e mostra o estado "ajuda" quando o parceiro vira bolha;
//  3. treino: ⇄ troca a câmera para o outro personagem.
// Uso: node tools/revisao/camera-hud/verificar.mjs [--raiz <cópia>] [--porta 4913] [--tam 844x390] [--saida <dir>]
// Sem GPU: fps não vale; posições e tamanhos valem.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const raiz = resolve(opt('raiz', resolve(aqui, '../../..')));
const porta = Number(opt('porta', 4913));
const [W, H] = opt('tam', '844x390').split('x').map(Number);
const saida = resolve(opt('saida', join(raiz, 'test-out/revisao/camera-hud')));
const caps = opt('caps', '1,2,3,4,5,6,7').split(',').map(Number);
mkdirSync(saida, { recursive: true });

const req = createRequire(join(raiz, 'package.json'));
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const { createServer } = await import(req.resolve('vite'));
const vs = await createServer({ root: raiz, configFile: existsSync(join(raiz, 'vite.config.ts')) ? join(raiz, 'vite.config.ts') : false, server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await vs.listen();
const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');

const nav = await chromium.launch();
const QUADRO = 1000 / 60;
const rel = { tam: `${W}x${H}`, alturas: [], indicador: {}, falhas: [] };
const falha = (m) => { rel.falhas.push(m); console.log('FALHA: ' + m); };

async function abrir(n) {
  const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => falha(`cap${n}: erro na página: ${e.message}`));
  await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); try { screen.orientation.lock = () => Promise.resolve(); } catch {} });
  await p.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await p.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
  await p.goto(`http://127.0.0.1:${porta}/?q=baixa&resfixa`);
  await p.waitForSelector('#bt-treino');
  await p.clock.runFor(500);
  await p.click('#bt-treino');
  await p.waitForSelector('#mapa:not([hidden])');
  await p.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
  await p.click('#bt-jogar');
  for (let k = 0; k < 400 && !(await p.evaluate((n) => window.__edm?.cap === n, n)); k++) await p.clock.runFor(50);
  for (let k = 0; k < 3; k++) await p.clock.runFor(QUADRO);
  return { ctx, p };
}

/** distância (px) do círculo do indicador até o retângulo mais próximo dos controles/HUD */
const folgaIndicador = (p) => p.evaluate(() => {
  const el = document.querySelector('#indicador');
  if (el.hidden) return null;
  const r = el.getBoundingClientRect(), cx = r.left + 22, cy = r.top + 22;
  let menor = Infinity, quem = '';
  for (const s of ['#joystick', '#botoes button', '#hud-p1 .rosto', '#hud-p2 .rosto', '#hud-estrelinhas', '#bt-pausa', '#hud-cap', '#hud-info']) {
    document.querySelectorAll(s).forEach((n) => {
      const q = n.getBoundingClientRect(); if (!q.width || !q.height) return;
      const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom);
      const d = Math.hypot(dx, dy) - 22;
      if (d < menor) { menor = d; quem = s; }
    });
  }
  return { folga: menor, quem, x: cx, y: cy, classe: el.className, texto: el.querySelector('.dist').textContent };
});

// 1. tamanho do personagem na tela, com a câmera do render, em 7 pontos de cada capítulo
for (const n of args.includes('--so-indicador') ? [] : caps) {
  const f = faseDoCapitulo(n); const lista = [];
  jogar(f, PLANOS[f.id], { limite: 420, entradas: (e) => lista.push(e.map((i) => ({ ...i }))) });
  const { ctx, p } = await abrir(n);
  for (const pt of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
    const alvo = Math.round(pt * lista.length);
    await p.evaluate(([l]) => { window.__edm.acelerar(30); return window.__edm.roteiro(l); }, [lista.slice(0, alvo)]);
    for (let k = 0; k < 3000 && (await p.evaluate(() => window.__edm.estado().tick)) < alvo; k++) await p.clock.runFor(QUADRO);
    await p.evaluate(() => window.__edm.acelerar(1));
    for (let k = 0; k < 150; k++) await p.clock.runFor(QUADRO); // 2,5 s: zoom assentado
    const c = await p.evaluate(() => window.__edm.camera());
    const a = c.alt[c.eu];
    rel.alturas.push({ cap: n, ponto: pt, eu: c.eu, alt: +a.toFixed(4), alvoV: +c.alvo.V.toFixed(3), parceiro: +c.alvo.parceiro.toFixed(2), estrela: +c.alvo.estrela.toFixed(2), fov: c.fov, px: Math.round(a * H) });
    console.log(`cap ${n} p${pt}: personagem ${(a * 100).toFixed(1)} % (${Math.round(a * H)} px) · enquadra parceiro ${c.alvo.parceiro.toFixed(2)} · estrelinha ${c.alvo.estrela.toFixed(2)}`);
    if (a < 0.15) falha(`cap ${n} p${pt}: personagem a ${(a * 100).toFixed(1)} % (< 15 %)`);
    if (Math.abs(c.alvo.V - 1.1 / 0.23) < 1e-6 && c.alvo.estrela === 0 && (a < 0.21 || a > 0.25)) falha(`cap ${n} p${pt}: quadro normal com ${(a * 100).toFixed(1)} %`);
  }
  await ctx.close();
}

// 2. indicador: a Bruna se afasta 0,05 m por quadro para a direita até 18 m e volta (o Natan parado); em cada quadro o
//    indicador tem de estar visível exatamente quando o centro dela está fora do quadro da câmera (≤ 1 quadro)
{
  const { ctx, p } = await abrir(2);
  await p.evaluate(() => window.__edm.roteiro([]));
  for (let k = 0; k < 30; k++) await p.clock.runFor(QUADRO);
  let erros = 0, apareceu = -1, sumiu = -1, piorFolga = Infinity, quadros = 0;
  for (let k = 0; k < 720; k++) {
    const d = (k < 360 ? k : 720 - k) * 0.05;
    await p.evaluate((d) => { const e = window.__edm.estado(); const [a, b] = e.jogadores; b.x = a.x + d; b.y = a.y; b.vx = b.vy = 0; }, d);
    await p.clock.runFor(QUADRO);
    const r = await p.evaluate(() => {
      const c = window.__edm.camera(), e = window.__edm.estado(), o = e.jogadores[1 - c.eu];
      const el = document.querySelector('#indicador');
      // projeção independente do código do indicador: enquadramento da câmera (x, pés, V, fração dos pés) no plano z = 0
      const q = c.quadro, asp = innerWidth / innerHeight;
      const nx = (o.x - q.x) / (q.V * asp / 2), ny = (o.y + 0.55 - q.yPes) * 2 / q.V - 1 + 2 * q.pes;
      return { tick: e.tick, visivel: !el.hidden, fora: Math.abs(nx) > 1 || Math.abs(ny) > 1 };
    });
    quadros++;
    if (r.visivel !== r.fora) erros++;
    if (r.visivel && apareceu < 0) { apareceu = +d.toFixed(2); await p.screenshot({ path: join(saida, 'indicador_aparece.png') }); }
    if (!r.visivel && apareceu >= 0 && k > 360 && sumiu < 0) sumiu = +d.toFixed(2);
    if (r.visivel) { const fo = await folgaIndicador(p); if (fo && fo.folga < piorFolga) piorFolga = fo.folga; }
  }
  rel.indicador.ida = { quadros, apareceuComDistanciaM: apareceu, sumiuComDistanciaM: sumiu, divergencias: erros, menorFolgaPx: +piorFolga.toFixed(1) };
  console.log('indicador (afasta e volta):', JSON.stringify(rel.indicador.ida));
  if (apareceu < 0) falha('indicador nunca apareceu');
  if (sumiu < 0) falha('indicador não sumiu quando o parceiro voltou ao quadro');
  if (erros) falha(`indicador divergiu da projeção em ${erros} quadros`);
  if (piorFolga < 12) falha(`indicador a ${piorFolga.toFixed(1)} px de um controle (< 12 px)`);
  await ctx.close();
}

// 2b. indicador em várias direções (parceiro acima, abaixo, à esquerda) e estado "ajuda"
{
  const { ctx, p } = await abrir(2);
  await p.evaluate(() => window.__edm.roteiro([]));
  for (let k = 0; k < 30; k++) await p.clock.runFor(QUADRO);
  const casos = [['direita', 14, 0], ['esquerda', -14, 0], ['acima', 1, 9], ['abaixo', 2, -7], ['diagonal', 12, 6], ['diagonal-baixo', 13, -4], ['esquerda-baixo', -13, -4]];
  // o Natan longe do começo da fase (a Bruna à esquerda não pode cair fora do mapa)
  await p.evaluate(() => { const a = window.__edm.estado().jogadores[0]; window.__base = { x: a.x + 18, y: a.y }; });
  rel.indicador.direcoes = [];
  for (const [nome, dx, dy] of casos) {
    await p.evaluate(([dx, dy]) => { const e = window.__edm.estado(); const [a, b] = e.jogadores; const B = window.__base; a.x = B.x; a.y = B.y; a.vx = a.vy = 0; b.x = a.x + dx; b.y = a.y + dy; b.vx = b.vy = 0; }, [dx, dy]);
    // a simulação continua (a Bruna cai se estiver no ar): reposiciona a cada quadro por 40 quadros
    for (let k = 0; k < 40; k++) { await p.evaluate(([dx, dy]) => { const e = window.__edm.estado(); const [a, b] = e.jogadores; const B = window.__base; a.x = B.x; a.y = B.y; a.vx = a.vy = 0; b.x = a.x + dx; b.y = a.y + dy; b.vx = b.vy = 0; }, [dx, dy]); await p.clock.runFor(QUADRO); }
    const fo = await folgaIndicador(p);
    rel.indicador.direcoes.push({ nome, ...fo });
    console.log(`indicador ${nome}:`, JSON.stringify(fo));
    if (!fo) falha(`indicador ${nome}: não apareceu`);
    else if (fo.folga < 12) falha(`indicador ${nome}: a ${fo.folga.toFixed(1)} px de ${fo.quem}`);
    await p.screenshot({ path: join(saida, `indicador_${nome}.png`) });
  }
  // bolha: estado "ajuda"
  for (let k = 0; k < 10; k++) { await p.evaluate(() => { const e = window.__edm.estado(); const [a, b] = e.jogadores; const B = window.__base; a.x = B.x; a.y = B.y; b.x = a.x + 14; b.y = a.y + 1; b.bolha = true; }); await p.clock.runFor(QUADRO); }
  const fo = await folgaIndicador(p);
  rel.indicador.bolha = fo;
  console.log('indicador bolha:', JSON.stringify(fo));
  if (!fo || !fo.classe.includes('ajuda')) falha('indicador: parceiro em bolha sem o estado "ajuda"');
  await p.screenshot({ path: join(saida, 'indicador_ajuda.png') });
  // 3. treino: ⇄ passa a seguir a Bruna
  await p.evaluate(() => { const e = window.__edm.estado(); e.jogadores[1].bolha = false; });
  const antes = await p.evaluate(() => window.__edm.camera().eu);
  await p.evaluate(() => document.querySelector('#bt-trocar').click());
  for (let k = 0; k < 5; k++) await p.clock.runFor(QUADRO);
  const depois = await p.evaluate(() => window.__edm.camera().eu);
  rel.treinoTroca = { antes, depois };
  console.log(`treino ⇄: câmera seguia ${antes}, passou a seguir ${depois}`);
  if (antes !== 0 || depois !== 1) falha('⇄ no treino não trocou a câmera');
  await ctx.close();
}

writeFileSync(join(saida, 'verificar.json'), JSON.stringify(rel, null, 1));
await nav.close(); await vs.close();
console.log(rel.falhas.length ? `${rel.falhas.length} falha(s)` : 'tudo certo');
process.exit(rel.falhas.length ? 1 : 0);
