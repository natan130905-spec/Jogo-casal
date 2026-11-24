// Capturas REPRODUTÍVEIS do jogo 2.5D para comparação antes/depois (arte e render).
//
// Mesma cena, mesmo enquadramento e mesmo tick em toda execução: o relógio da página é falso (Playwright clock), então
// requestAnimationFrame, performance.now e o tempo das animações (vento, nuvens, brilhos) avançam sempre igual; a
// simulação é determinística e os jogadores são levados até o tick pedido pelas entradas gravadas dos bots
// cooperativos (test/fases/planos), reproduzidas com window.__edm.roteiro (src/ui/partida.ts). A câmera assenta
// durante 90 quadros em tempo normal antes da foto. A resolução dinâmica fica desligada (?resfixa).
//
// Uso (a partir da raiz de qualquer cópia do repositório — worktree "antes" e "depois", por exemplo):
//   node tools/revisao/capturas.mjs [opções]
//     --raiz <dir>        cópia do jogo a capturar (padrão: a raiz deste repositório). Usa o servidor de
//                         desenvolvimento do Vite nessa pasta (não precisa de build).
//     --caps 1,2,…,7      capítulos (padrão: todos)
//     --q baixa,media,alta qualidades (padrão: as três)
//     --tam 844x390@2,915x412@1   tamanhos CSS @ deviceScaleFactor (padrão: Redmi Note 11 ≈ 844×390@2 e 915×412@1)
//     --pontos 0.12,0.5   onde fotografar: fração da partida dos bots (0–1) ou tick absoluto (inteiro > 1)
//     --hud               mantém HUD e controles na foto (padrão: só o canvas, para medir a arte)
//     --saida <dir>       pasta das imagens (padrão: test-out/revisao/capturas/<rótulo>)
//     --rotulo <nome>     nome da rodada (padrão: data-hora); vai no nome da pasta
//     --porta <n>         porta do servidor (padrão 4870)
//     --url <param=v&…>   parâmetros extras na URL do jogo (ex.: tema=floresta)
//     --medir             grava medidas.json (luminância, contraste, saturação; ver tools/revisao/medir.mjs)
//     --folha             grava folha.webp com todas as capturas em grade (capítulo × qualidade)
// Exemplo antes/depois:
//   node tools/revisao/capturas.mjs --raiz ../wt-antes  --rotulo antes  --medir --folha
//   node tools/revisao/capturas.mjs --raiz ../wt-depois --rotulo depois --medir --folha
//   node tools/revisao/comparar.mjs test-out/revisao/capturas/antes test-out/revisao/capturas/depois
// Nome de cada arquivo: cap<N>_<qualidade>_<W>x<H>@<dsf>_p<ponto>.png
// Limites: o navegador daqui não tem GPU (SwiftShader); a imagem é a mesma de uma GPU salvo precisão/MSAA, mas fps
// não vale. Se o núcleo (física) ou as fases mudarem, as entradas dos bots mudam e o mesmo "ponto" pode cair noutro
// lugar: compare sempre com o mesmo commit de src/core + test/fases, ou use --pontos com ticks absolutos.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { medirArquivos, folhaWebp } from './medir.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, pad) => { const i = args.indexOf(`--${n}`); return i < 0 ? pad : args[i + 1]; };
const flag = (n) => args.includes(`--${n}`);

const raiz = resolve(opt('raiz', resolve(aqui, '../..')));
const caps = opt('caps', '1,2,3,4,5,6,7').split(',').map(Number);
const qs = opt('q', 'baixa,media,alta').split(',');
const tams = opt('tam', '844x390@2,915x412@1').split(',').map((s) => { const [wh, d] = s.split('@'); const [w, h] = wh.split('x').map(Number); return { w, h, dsf: Number(d ?? 1) }; });
const pontos = opt('pontos', '0.12,0.5').split(',').map(Number);
const rotulo = opt('rotulo', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
const saida = resolve(opt('saida', join(raiz, 'test-out/revisao/capturas', rotulo)));
const porta = Number(opt('porta', 4870));
const extra = opt('url', '');
const comHud = flag('hud');
mkdirSync(saida, { recursive: true });

const req = createRequire(join(raiz, 'package.json'));
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const { createServer } = await import(req.resolve('vite'));

// servidor de desenvolvimento na cópia pedida (serve a página e grava as entradas dos bots com o núcleo DESSA cópia)
const vs = await createServer({ root: raiz, configFile: existsSync(join(raiz, 'vite.config.ts')) ? join(raiz, 'vite.config.ts') : false, server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await vs.listen();
const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');
const roteiros = {};
for (const n of caps) {
  const f = faseDoCapitulo(n); const lista = [];
  const r = jogar(f, PLANOS[f.id], { limite: 420, entradas: (e) => lista.push(e.map((i) => ({ ...i }))) });
  if (!r.concluida) console.warn(`aviso: bots não venceram o capítulo ${n} (${r.erro}); uso as entradas até onde foram`);
  roteiros[n] = lista;
}

const navegador = await chromium.launch();
const QUADRO = 1000 / 60;
const arquivos = [];
const log = [];

for (const tam of tams) for (const q of qs) {
  const ctx = await navegador.newContext({ viewport: { width: tam.w, height: tam.h }, deviceScaleFactor: tam.dsf, isMobile: true, hasTouch: true });
  for (const n of caps) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => log.push(`cap${n} ${q}: ${e.message}`));
    // o jogo pede tela cheia ao começar; aqui não (a janela precisa poder mudar de tamanho durante o avanço rápido)
    await p.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); try { screen.orientation.lock = () => Promise.resolve(); } catch {} });
    // relógio falso e PARADO: só anda com runFor (sem isso ele corre no tempo real e o tick da foto varia)
    await p.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
    await p.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
    await p.goto(`http://127.0.0.1:${porta}/?q=${q}&resfixa${extra ? '&' + extra : ''}`);
    await p.waitForSelector('#bt-treino');
    await p.clock.runFor(500);
    await p.click('#bt-treino');
    await p.waitForSelector('#mapa:not([hidden])');
    await p.evaluate((n) => document.querySelectorAll('#mapa .ilha')[n - 1].click(), n);
    await p.click('#bt-jogar');
    for (let k = 0; k < 400 && !(await p.evaluate((n) => window.__edm?.cap === n, n)); k++) await p.clock.runFor(50);
    for (let k = 0; k < 3; k++) await p.clock.runFor(QUADRO); // alinha o "último quadro" do laço antes do roteiro
    if (!comHud) await p.addStyleTag({ content: '#jogo > :not(canvas){visibility:hidden !important}' });
    const lista = roteiros[n];
    for (const pt of pontos) {
      const alvo = pt > 1 ? Math.round(pt) : Math.round(pt * lista.length);
      // avanço rápido em janela pequena (mesma proporção: a câmera só depende da proporção), foto no tamanho real
      await p.setViewportSize({ width: Math.round(tam.w / 4), height: Math.round(tam.h / 4) });
      await p.evaluate(([l]) => { window.__edm.acelerar(30); return window.__edm.roteiro(l); }, [lista.slice(0, alvo)]);
      for (let k = 0; k < 2000 && (await p.evaluate(() => window.__edm.estado().tick)) < alvo; k++) await p.clock.runFor(QUADRO);
      await p.evaluate(() => window.__edm.acelerar(1));
      for (let k = 0; k < 86; k++) await p.clock.runFor(QUADRO); // a câmera assenta (lerp dt*4)
      await p.setViewportSize({ width: tam.w, height: tam.h });
      for (let k = 0; k < 4; k++) await p.clock.runFor(QUADRO);
      const e = await p.evaluate(() => { const s = window.__edm.estado(); return { tick: s.tick, j: s.jogadores.map((j) => [+j.x.toFixed(2), +j.y.toFixed(2)]), info: window.__edm.info() }; });
      const nome = `cap${n}_${q}_${tam.w}x${tam.h}@${tam.dsf}_p${String(pt).replace('.', '')}.png`;
      // às vezes (SwiftShader + troca de tamanho) a foto sai toda preta: desenha mais quadros e tenta de novo
      for (let tent = 0; ; tent++) {
        const buf = await p.screenshot({ path: join(saida, nome) });
        const preta = await p.evaluate(async (b64) => {
          const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
          const c = new OffscreenCanvas(64, 32); const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 32);
          return g.getImageData(0, 0, 64, 32).data.every((v, i) => i % 4 === 3 || v < 3);
        }, buf.toString('base64'));
        if (!preta || tent >= 4) { if (preta) log.push(`${nome}: imagem preta depois de 5 tentativas`); break; }
        for (let k = 0; k < 3; k++) await p.clock.runFor(QUADRO);
      }
      arquivos.push({ arquivo: nome, cap: n, q, tam: `${tam.w}x${tam.h}@${tam.dsf}`, ponto: pt, ...e });
      console.log(`${nome}  tick ${e.tick}  jogadores ${JSON.stringify(e.j)}  ${e.info.chamadas} ch / ${(e.info.triangulos / 1000).toFixed(0)} mil tri`);
    }
    await p.close();
  }
  await ctx.close();
}

writeFileSync(join(saida, 'capturas.json'), JSON.stringify({ raiz, rotulo, quando: new Date().toISOString(), pontos, arquivos, erros: log }, null, 1));
if (flag('medir')) {
  const m = await medirArquivos(navegador, arquivos.map((a) => join(saida, a.arquivo)));
  arquivos.forEach((a, i) => Object.assign(a, { medidas: m[i] }));
  writeFileSync(join(saida, 'medidas.json'), JSON.stringify(arquivos, null, 1));
  console.log(`medidas: ${join(saida, 'medidas.json')}`);
}
if (flag('folha')) {
  for (const tam of tams) {
    const t = `${tam.w}x${tam.h}@${tam.dsf}`;
    const linhas = caps.map((n) => qs.map((q) => join(saida, `cap${n}_${q}_${t}_p${String(pontos[0]).replace('.', '')}.png`)));
    await folhaWebp(navegador, linhas, join(saida, `folha_${t}.webp`), { largura: 360, rotulos: caps.map((n) => qs.map((q) => `cap ${n} · ${q}`)) });
  }
}
if (log.length) console.warn('erros na página:\n' + log.join('\n'));
await navegador.close(); await vs.close();
console.log(`${arquivos.length} capturas em ${saida}`);
