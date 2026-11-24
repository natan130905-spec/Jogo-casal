// E2E da Arena do Coração (fim do capítulo 7, 3D), no build de produção:
//  1. treino (Pixel 7 em paisagem): mapa → capítulo 7 → "Arena do Coração ⚔" → controles e HUD da arena, teclado
//     (andar, pular, golpe, tiro), troca de personagem → luta inteira com as entradas gravadas do bot
//     (window.__edm.roteiro) → vitória → capítulo concluído → lembrança → final → créditos → mapa.
//  2. dupla (Pixel 7 × iPhone 14 em paisagem, PeerJS local): o anfitrião já tem os capítulos 1–6; joga o capítulo 7
//     2.5D (roteiro dos bots) → cena da fuga do Rei nos dois (o capítulo 7 ainda NÃO conta) → arena nos dois →
//     entrada do convidado, pausa sincronizada → luta inteira gravada, convidado em sincronia → vitória → concluído,
//     lembrança, final e créditos nos dois → conexão perdida.
// Uso: node test/e2e/arena.mjs [treino|dupla]   (sem argumento: os dois). Capturas em test-out/arena/.
// Ambiente: PORTA (vite preview, padrão 4863), ACEL (padrão 6; o treino usa o dobro), LIMITE_LUTA (s reais, padrão 900).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { gravarRoteiros } from './roteiros.mjs';
import { gravarRoteiroArena } from './roteiro_arena.mjs';

const partes = process.argv[2] ? [process.argv[2]] : ['treino', 'dupla'];
const ACEL = Number(process.env.ACEL ?? 6);
const porta = Number(process.env.PORTA ?? 4863);
const ORCAMENTO = { ch: 80, tri: 250000 };
// tempo real máximo de cada luta gravada: no SwiftShader (sem GPU) e com a máquina carregada a cena real roda a 2–4 fps,
// e cada quadro anda no máximo 0,1 s × ACEL de jogo; 300 s não bastava para a dupla (dois aparelhos desenhando).
const LIMITE_LUTA = Number(process.env.LIMITE_LUTA ?? 900);
const saida = new URL('../../test-out/arena/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };

console.log('gravando as lutas dos bots…');
const luta = { treino: await gravarRoteiroArena({ treino: true }), dupla: await gravarRoteiroArena({ treino: false }) };
for (const [k, r] of Object.entries(luta)) console.log(`  ${k}: ${r.segundos.toFixed(0)} s de luta, vitória ${r.vitoria}`);
const cap7 = partes.includes('dupla') ? (await gravarRoteiros([7]))[7] : null;

let sinal = null, portaSinal = 0;
if (partes.includes('dupla')) portaSinal = await new Promise((r) => { sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const log = [];

async function novaPagina(dispositivo, nome, progresso) {
  const ctx = await navegador.newContext({ ...devices[dispositivo] });
  if (progresso) await ctx.addInitScript((p) => { try { localStorage.setItem('edm-progresso-v1', p); } catch { /* */ } }, JSON.stringify(progresso));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') log.push(`${nome}: ${m.text()}`); });
  p.on('pageerror', (e) => log.push(`${nome}: ${e.message}`));
  return p;
}
const tela = (p) => p.evaluate(() => window.__edmFluxo.tela()).catch(() => null);
const estado = (p) => p.evaluate(() => { const e = window.__edm?.arena && window.__edm.estado(); return e && {
  tick: e.tick, vitoria: e.vitoria, fase: e.rei.fase, vida: e.rei.vida, solo: e.solo,
  j: e.jogadores.map((j) => ({ x: j.x, y: j.y, z: j.z, c: j.coracoes, p: j.poder })) }; }).catch(() => null);

/** Espera o jogo andar n ticks (1/60 s de jogo cada), não importa o fps: no SwiftShader carregado a cena real
 *  roda a poucos quadros por segundo e o passo é limitado a 0,1 s por quadro, então esperar em ms reais media o fps. */
async function esperarTicks(p, n, limiteMs = 60000) {
  const k0 = (await estado(p))?.tick ?? 0; const fim = Date.now() + limiteMs;
  while (Date.now() < fim) { const k = (await estado(p))?.tick ?? 0; if (k - k0 >= n) return; await pausa(40); }
}
/** Quadros por segundo da página (requestAnimationFrame) medidos em ms reais. */
const medirFps = (p, ms = 2000) => p.evaluate((ms) => new Promise((r) => { let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); }), ms);

/** Desvio (m) entre o que o convidado mostra e o que o anfitrião simulou perto daquele tick. */
async function desvioDoConvidado(A, B) {
  const g = await B.evaluate(() => { const e = window.__edm?.arena && window.__edm.estado(); return e && { tick: e.tick, p: e.jogadores.map((j) => [j.x, j.z]) }; }).catch(() => null);
  if (!g) return null;
  return A.evaluate((g) => {
    let melhor = null;
    for (let t = g.tick - 24; t <= g.tick + 3; t++) {
      const h = window.__edm?.posicoes?.(t); if (!h) continue;
      const d = Math.max(...h.map((p, i) => Math.hypot(p[0] - g.p[i][0], p[1] - g.p[i][1])));
      if (melhor === null || d < melhor) melhor = d;
    }
    return melhor;
  }, g).catch(() => null);
}

/** Controles da arena no toque: os 5 botões e o joystick, grandes o bastante para o polegar. */
async function conferirControles(p, nome) {
  const caixas = await p.evaluate(() => [...document.querySelectorAll('#controles-arena [data-b], #controles-arena .base')].map((el) => {
    const r = el.getBoundingClientRect(); return { b: el.dataset.b ?? 'joystick', w: r.width, h: r.height, x: r.x, y: r.y, vis: r.width > 0 && getComputedStyle(el).display !== 'none' };
  }));
  const tam = Object.fromEntries(caixas.map((c) => [c.b, Math.round(c.w)]));
  checar(caixas.length === 6 && caixas.every((c) => c.vis), `${nome}: joystick + ⚔ ✨ ⬆ ↻ ★ na tela (${JSON.stringify(tam)} px)`);
  checar(tam.golpe >= 80 && ['tiro', 'pulo', 'esquiva', 'poder'].every((b) => tam[b] >= 56), `${nome}: botões confortáveis (⚔ ≥ 80 px, os outros ≥ 56 px)`);
  // nenhum botão em cima do outro
  const bt = caixas.filter((c) => c.b !== 'joystick');
  let sobrepoe = false;
  for (let a = 0; a < bt.length; a++) for (let b = a + 1; b < bt.length; b++) {
    const A = bt[a], B = bt[b];
    const d = Math.hypot(A.x + A.w / 2 - B.x - B.w / 2, A.y + A.h / 2 - B.y - B.h / 2);
    if (d < (A.w + B.w) / 2 - 1) sobrepoe = true;
  }
  checar(!sobrepoe, `${nome}: botões sem sobreposição`);
  const hud = await p.evaluate(() => ({
    rei: !!document.querySelector('#hud-rei')?.getBoundingClientRect().width,
    marcas: document.querySelectorAll('#hud-rei .marca').length,
    poder: [0, 1].map((i) => !!document.querySelector(`#pod-${i}`)?.getBoundingClientRect().width),
    cor: [0, 1].map((i) => document.querySelectorAll(`#cor-${i} i:not(.vazio)`).length),
    so2d: getComputedStyle(document.querySelector('#controles')).display,
  }));
  checar(hud.rei && hud.marcas === 2 && hud.poder.every(Boolean) && hud.cor.every((c) => c === 3), `${nome}: HUD com rostos e corações ${hud.cor}, barra do Rei com as 3 fases e as barras de poder`);
  checar(hud.so2d === 'none', `${nome}: os controles do 2.5D ficam escondidos na arena`);
}

/** Joga a luta gravada em A (que simula), com B (convidado) opcional, até a vitória. Devolve as medidas. */
async function jogarLuta(r, A, B, acel, nome) {
  checar(await A.evaluate(([l, k]) => { window.__edm.acelerar(k); return window.__edm.roteiro(l); }, [r.lista, acel]), `${nome}: roteiro da luta aceito`);
  const m = { ch: 0, tri: 0, chB: 0, triB: 0, fases: new Set(), desvio: 0, amostras: 0, pior: 0 };
  const fotos = [0.1, 0.4, 0.75, 0.98];
  const t0 = Date.now();
  for (;;) {
    const s = await estado(A);
    if (!s) break;
    m.fases.add(s.fase);
    const i = await A.evaluate(() => window.__edm.info()).catch(() => null);
    if (i) { m.ch = Math.max(m.ch, i.chamadas); m.tri = Math.max(m.tri, i.triangulos); }
    if (B) {
      const iB = await B.evaluate(() => window.__edm?.info?.()).catch(() => null);
      if (iB) { m.chB = Math.max(m.chB, iB.chamadas); m.triB = Math.max(m.triB, iB.triangulos); }
      // depois de 1,5 s: o convidado ainda mostra o fim da luta de antes do roteiro recomeçar
      const d = Date.now() - t0 > 1500 ? await desvioDoConvidado(A, B) : null;
      if (d !== null) { if (d > m.desvio) m.pior = (await estado(B))?.tick; m.desvio = Math.max(m.desvio, d); m.amostras++; }
    }
    while (fotos.length && s.tick >= fotos[0] * r.lista.length) {
      const f = Math.round(fotos.shift() * 100);
      await A.evaluate(() => window.__edm.acelerar(1)); await pausa(400);
      await A.screenshot({ path: `${saida}${nome}_${f}_A.png` });
      if (B) await B.screenshot({ path: `${saida}${nome}_${f}_B.png` });
      await A.evaluate((k) => window.__edm.acelerar(k), acel).catch(() => {});
    }
    if (s.vitoria) break;
    if (Date.now() - t0 > LIMITE_LUTA * 1000) break;
    await pausa(150);
  }
  const s = await estado(A);
  checar(s?.vitoria, `${nome}: vitória em ${((Date.now() - t0) / 1000).toFixed(0)} s reais (fases do Rei vistas: ${[...m.fases].join(', ')})`);
  if (B) {
    let vB = false;
    for (let k = 0; k < 30 && !vB; k++) { vB = !!(await estado(B))?.vitoria; if (!vB) await pausa(100); }
    checar(vB, `${nome}: o convidado também vê a vitória (vaga-lume)`);
    checar(m.amostras > 20 && m.desvio < 0.75, `${nome}: convidado em sincronia (${m.amostras} amostras, maior desvio ${m.desvio.toFixed(2)} m, tick ${m.pior})`);
  }
  await pausa(300);
  await A.screenshot({ path: `${saida}${nome}_vitoria_A.png` });
  if (B) await B.screenshot({ path: `${saida}${nome}_vitoria_B.png` });
  const ch = Math.max(m.ch, m.chB), tri = Math.max(m.tri, m.triB);
  checar(ch <= ORCAMENTO.ch && tri <= ORCAMENTO.tri, `${nome}: ${ch} chamadas e ${(tri / 1000).toFixed(0)} mil triângulos (média: ≤ 80 / 250 mil)`);
  return m;
}

/** Depois da vitória: concluído → lembrança → final → créditos → mapa, em A (e acompanhado em B). */
async function historiaFinal(A, B, nome) {
  const ps = B ? [A, B] : [A];
  const viu = await Promise.all(ps.map((p) => p.waitForSelector('#concluido:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false)));
  checar(viu.every(Boolean), `${nome}: "Capítulo concluído" depois da arena${B ? ' nos dois' : ''}`);
  const prog = await Promise.all(ps.map((p) => p.evaluate(() => window.__edmFluxo.progresso())));
  checar(prog.every((p) => p.capitulos[7] && !p.arena7), `${nome}: capítulo 7 conta como concluído (★ ${prog[0].capitulos[7]?.estrelinhas}/${prog[0].capitulos[7]?.total})`);
  await A.screenshot({ path: `${saida}${nome}_concluido_A.png` });
  await A.click('#bt-conc-continuar');
  for (const p of ps) await p.waitForFunction(() => window.__edmFluxo.tela().cena === 'lembranca', null, { timeout: 10000 });
  checar(true, `${nome}: lembrança do capítulo 7`);
  await A.click('#bt-pular');
  for (const p of ps) await p.waitForFunction(() => window.__edmFluxo.tela().cena === 'final', null, { timeout: 10000 });
  checar(true, `${nome}: final em quadrinhos${B ? ' nos dois' : ''}`);
  await A.screenshot({ path: `${saida}${nome}_final_A.png` });
  await A.click('#bt-pular');
  const cred = await Promise.all(ps.map((p) => p.waitForSelector('#creditos:not([hidden])', { timeout: 10000 }).then(() => true).catch(() => false)));
  checar(cred.every(Boolean), `${nome}: créditos${B ? ' nos dois' : ''}`);
  await pausa(2500);
  await A.screenshot({ path: `${saida}${nome}_creditos_A.png` });
  if (B) await B.screenshot({ path: `${saida}${nome}_creditos_B.png` });
  // um toque no convidado vira pedido; quem decide é o anfitrião
  await (B ?? A).click('#creditos');
  const mapa = await Promise.all(ps.map((p) => p.waitForSelector('#mapa:not([hidden])', { timeout: 10000 }).then(() => true).catch(() => false)));
  checar(mapa.every(Boolean), `${nome}: toque nos créditos volta ao mapa${B ? ' (pedido do convidado)' : ''}`);
  const fim = await A.evaluate(() => window.__edmFluxo.progresso().finalVisto);
  checar(fim, `${nome}: final marcado como visto`);
}

// ---------- 1. treino ----------
if (partes.includes('treino')) {
  const A = await novaPagina('Pixel 7 landscape', 'treino');
  await A.goto(`http://127.0.0.1:${porta}/?q=media`);
  await A.click('#bt-treino');
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  await A.evaluate(() => document.querySelectorAll('#mapa .ilha')[6].click());
  checar(await A.isVisible('#bt-arena'), 'treino: o mapa oferece a Arena do Coração no capítulo 7');
  await A.click('#bt-arena');
  await A.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 120000 });
  checar((await tela(A))?.t === 'arena', 'treino: entrou na arena');
  await pausa(800);
  await A.screenshot({ path: `${saida}treino_inicio.png` });
  await conferirControles(A, 'treino');
  // teclado do PC: D anda, Espaço pula, J golpe, K tiro
  const e0 = await estado(A);
  console.log(`  fps medido (treino, SwiftShader, sem GPU): ${(await medirFps(A)).toFixed(1)}`);
  await A.keyboard.down('KeyD'); await esperarTicks(A, 42); await A.keyboard.up('KeyD');
  const e1 = await estado(A);
  checar(Math.hypot(e1.j[0].x - e0.j[0].x, e1.j[0].z - e0.j[0].z) > 1.5, `treino: D anda (${e0.j[0].x.toFixed(1)},${e0.j[0].z.toFixed(1)} → ${e1.j[0].x.toFixed(1)},${e1.j[0].z.toFixed(1)})`);
  await A.keyboard.down('Space');
  let alto = 0; { const k0 = (await estado(A)).tick; for (let k = 0; k < 400; k++) { const e = await estado(A); alto = Math.max(alto, e.j[0].y); if (e.tick - k0 > 30) break; await pausa(15); } }
  await A.keyboard.up('Space');
  checar(alto > 0.5, `treino: Espaço pula (y ${alto.toFixed(2)} m)`);
  const c0 = await A.evaluate(() => window.__edm.contagem());
  await A.keyboard.down('KeyJ'); await esperarTicks(A, 3); await A.keyboard.up('KeyJ'); await esperarTicks(A, 24);
  await A.keyboard.down('KeyK'); await esperarTicks(A, 42); await A.keyboard.up('KeyK');
  const c1 = await A.evaluate(() => window.__edm.contagem());
  checar((c1.golpe ?? 0) > (c0.golpe ?? 0) && (c1.tiro ?? 0) - (c0.tiro ?? 0) >= 2, `treino: J golpeia (${c1.golpe ?? 0}) e K segurado atira (${(c1.tiro ?? 0) - (c0.tiro ?? 0)} tiros)`);
  // toque: segurar ✨ atira
  const box = await A.locator('#controles-arena [data-b="tiro"]').boundingBox();
  await A.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await esperarTicks(A, 6);
  const c2 = await A.evaluate(() => window.__edm.contagem());
  checar((c2.tiro ?? 0) > (c1.tiro ?? 0), 'treino: tocar ✨ atira');
  await A.click('#bt-trocar'); await pausa(300);
  checar((await estado(A)).solo === 1 && await A.evaluate(() => document.querySelector('#hud-p2').classList.contains('eu')), 'treino: ⇄ passa o controle para a Bruna');
  await A.screenshot({ path: `${saida}treino_bruna.png` });
  await jogarLuta(luta.treino, A, null, ACEL * 2, 'treino');
  await historiaFinal(A, null, 'treino');
  await A.context().close();
}

// ---------- 2. dupla ----------
if (partes.includes('dupla')) {
  const seis = { v: 1, prologoVisto: true, finalVisto: false, capitulos: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, { estrelinhas: 10, total: 40 }])) };
  const base = `http://127.0.0.1:${porta}/?q=media&sinal=127.0.0.1:${portaSinal}`;
  const A = await novaPagina('Pixel 7 landscape', 'A', seis);
  const B = await novaPagina('iPhone 14 landscape', 'B');
  await A.goto(base); await B.goto(base);
  await A.click('#bt-criar');
  await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  await B.fill('#codigo', await A.textContent('#sala-codigo')); await B.click('#bt-entrar');
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 30000 });
  await B.waitForSelector('#mapa:not([hidden])', { timeout: 30000 });
  checar((await tela(A)).sel === 7, 'dupla: com os capítulos 1–6 feitos, o mapa abre no 7');
  checar(await A.isHidden('#bt-arena'), 'dupla: a arena ainda não aparece no mapa (falta a parte 2.5D do capítulo 7)');
  await A.click('#bt-jogar');
  await A.waitForFunction(() => window.__edm?.cap === 7 && !window.__edm.arena, null, { timeout: 30000 });
  await B.waitForFunction(() => window.__edm?.cap === 7 && !window.__edm.arena, null, { timeout: 30000 });
  await pausa(600);
  checar(await A.evaluate(([l, k]) => { window.__edm.acelerar(k); return window.__edm.roteiro(l); }, [cap7.lista, ACEL]), 'dupla: capítulo 7 (2.5D) com as entradas gravadas dos bots');
  const fugaA = await A.waitForFunction(() => window.__edmFluxo.tela().cena === 'fuga', null, { timeout: 240000 }).then(() => true).catch(() => false);
  const fugaB = await B.waitForFunction(() => window.__edmFluxo.tela().cena === 'fuga', null, { timeout: 15000 }).then(() => true).catch(() => false);
  checar(fugaA && fugaB, 'dupla: ao tocar o pedaço, a cena da fuga do Rei aparece nos dois');
  await A.screenshot({ path: `${saida}dupla_fuga_A.png` }); await B.screenshot({ path: `${saida}dupla_fuga_B.png` });
  const pFuga = await Promise.all([A, B].map((p) => p.evaluate(() => window.__edmFluxo.progresso())));
  checar(pFuga.every((p) => !p.capitulos[7] && p.arena7), `dupla: o capítulo 7 ainda não conta (falta a arena; ★ ${pFuga[0].arena7?.estrelinhas} guardadas)`);
  // o convidado avança o quadrinho (pedido) e o anfitrião pula para a arena
  const q0 = await A.textContent('#qd-texto');
  await B.click('#qd-painel');
  await A.waitForFunction((t) => document.querySelector('#qd-texto').textContent !== t, q0, { timeout: 5000 }).catch(() => {});
  checar((await A.textContent('#qd-texto')) !== q0, 'dupla: toque do convidado avança a cena da fuga');
  await A.click('#bt-pular');
  await A.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 120000 });
  await B.waitForFunction(() => window.__edm?.arena && window.__edm.pronta(), null, { timeout: 120000 });
  checar(true, 'dupla: a arena carregou nos dois');
  await pausa(1000);
  await A.screenshot({ path: `${saida}dupla_inicio_A.png` }); await B.screenshot({ path: `${saida}dupla_inicio_B.png` });
  await conferirControles(B, 'dupla (iPhone 14)');
  // a Bruna (convidado) anda pelo joystick de toque: o anfitrião vê
  const b0 = (await estado(A)).j[1];
  const base2 = await B.locator('#controles-arena .base').boundingBox();
  const cx = base2.x + base2.width / 2, cy = base2.y + base2.height / 2;
  const cdp = await B.context().newCDPSession(B);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + k * 12, y: cy }] });
  await esperarTicks(A, 54);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pausa(300);
  const b1 = (await estado(A)).j[1];
  checar(Math.hypot(b1.x - b0.x, b1.z - b0.z) > 1.5, `dupla: joystick de toque do convidado move a Bruna no anfitrião (${Math.hypot(b1.x - b0.x, b1.z - b0.z).toFixed(1)} m)`);
  // tiro do convidado (K)
  const cA0 = await A.evaluate(() => window.__edm.contagem());
  await B.keyboard.down('KeyK'); await esperarTicks(A, 48); await B.keyboard.up('KeyK'); await esperarTicks(A, 12);
  const cA1 = await A.evaluate(() => window.__edm.contagem());
  checar((cA1.tiro ?? 0) > (cA0.tiro ?? 0), 'dupla: tiro do convidado aparece no anfitrião');
  // pausa sincronizada
  await B.click('#bt-pausa');
  await A.waitForSelector('#pausa:not([hidden])', { timeout: 5000 }).catch(() => {});
  const k1 = (await estado(A)).tick; await pausa(500); const k2 = (await estado(A)).tick;
  checar(await A.isVisible('#pausa') && await B.isVisible('#pausa') && k1 === k2, `dupla: pausa do convidado para a arena nos dois (tick ${k1} → ${k2})`);
  await A.click('#bt-continuar');
  await B.waitForSelector('#pausa', { state: 'hidden', timeout: 5000 }).catch(() => {});
  checar(await B.isHidden('#pausa'), 'dupla: continuar tira a pausa nos dois');
  // as duas barras cheias: aviso "Usem o poder juntos!" e ★ aceso nos dois aparelhos
  await A.evaluate(() => window.__edm.encherPoder()); await pausa(600);
  const juntos = await Promise.all([A, B].map((p) => p.evaluate(() => !document.querySelector('#hud-juntos').hidden && document.querySelector('#controles-arena [data-b="poder"]').classList.contains('cheio'))));
  checar(juntos.every(Boolean), `dupla: barras cheias mostram "Usem o poder juntos!" e acendem o ★ (${juntos})`);
  await A.screenshot({ path: `${saida}dupla_juntos_A.png` }); await B.screenshot({ path: `${saida}dupla_juntos_B.png` });
  await jogarLuta(luta.dupla, A, B, ACEL, 'dupla');
  const contB = await B.evaluate(() => window.__edm.contagem());
  checar(['acerto-rei', 'chefe-fase', 'dano', 'poder', 'derrota'].every((t) => (contB[t] ?? 0) > 0) || ['acerto-rei', 'chefe-fase', 'poder'].every((t) => (contB[t] ?? 0) > 0),
    `dupla: convidado recebe os eventos (acertos ${contB['acerto-rei'] ?? 0}, fases ${contB['chefe-fase'] ?? 0}, poderes ${contB.poder ?? 0})`);
  await historiaFinal(A, B, 'dupla');
  await B.close();
  await A.waitForSelector('#caiu:not([hidden])', { timeout: 15000 }).catch(() => {});
  checar(await A.isVisible('#caiu'), 'dupla: anfitrião mostra "Conexão perdida" quando o convidado sai');
  await A.context().close();
}

checar(log.length === 0, `sem erros no console${log.length ? ': ' + log.slice(0, 4).join(' | ') : ''}`);
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'RESULTADO: APROVADO' : 'RESULTADO: REPROVADO');
process.exit(ok ? 0 : 1);
