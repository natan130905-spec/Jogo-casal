// E2E da campanha sozinho, do salvar/retomar e do Quintal de Treino (L2b; R22, R23, R24; T8, T12 da ARQUITETURA_MODOS):
//  1. menu com os 3 modos; "Jogar sozinho" abre a campanha SEM sala (nenhum pedido ao PeerJS), o outro personagem
//     com o jogo (assentos ['pessoa', 'ia']) e seguindo;
//  2. joga o cap. 1 com as entradas gravadas dos bots até a 2ª lanterna e mais um pouco; pausa; RECARREGA a página
//     (o pagehide grava) → "Continuar" → mesma lanterna, mesmas estrelinhas, mesmos bichinhos derrotados, mesmo tick;
//  3. Quintal de Treino 2 min (andar, pular, atacar, ⇄, pagehide de mentira, bonecos que voltam): edm-salvo-v2 igual
//     byte a byte, e a chave edm-treino-v1 gravada;
//  4. R23: a Bruna (aparelho novo) cria a sala e o Natan entra: os dois ficam com a jornada do Natan, gravada nos dois
//     com o mesmo id.
// Uso: node test/e2e/solo.mjs   (PORTA do vite preview, padrão 4851; QUINTAL_S, padrão 120)
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { gravarRoteiros } from './roteiros.mjs';

const porta = Number(process.env.PORTA ?? 4851);
const QUINTAL_S = Number(process.env.QUINTAL_S ?? 120);
const saida = new URL('../../test-out/solo/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };

const roteiro1 = (await gravarRoteiros([1]))[1];
let sinal = null;
const portaSinal = await new Promise((r) => { sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port)); });
const srv = await preview({ preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
const base = `http://127.0.0.1:${porta}/?q=baixa`;
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const log = [];
async function novaPagina(disp, nome) {
  const ctx = await navegador.newContext({ ...devices[disp] });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') log.push(`${nome}: ${m.text()}`); });
  p.on('pageerror', (e) => log.push(`${nome}: ${e.message}`));
  return p;
}
const ler = (p, k) => p.evaluate((k) => localStorage.getItem(k), k);
const estado = (p) => p.evaluate(() => {
  const e = window.__edm?.estado();
  return e && { tick: e.tick, cp: e.checkpoint, col: [...e.coletadas].sort((a, b) => a - b), mortos: e.inimigos.flatMap((n, k) => (n.vivo ? [] : [k])),
    casal: e.estrelinhasCasal, j: e.jogadores.map((j) => ({ x: j.x, y: j.y, bolha: j.bolha })) };
});

// ---------- 1. menu e campanha sem sala ----------
const A = await novaPagina('Pixel 7 landscape', 'A');
const pedidosRede = [];
A.on('request', (r) => { if (/peerjs|:\d+\/peerjs|\/id\?|socket/i.test(r.url())) pedidosRede.push(r.url()); });
await A.goto(base);
await A.waitForSelector('#menu:not([hidden])');
const vis = async (s) => A.isVisible(s);
checar(!(await vis('#bt-continuar-jornada')) && await vis('#bt-solo') && await vis('#bt-criar') && await vis('#bt-entrar') && await vis('#bt-treino'),
  'menu novo: Jogar sozinho, Jogar juntos online (Criar sala / código) e Treino; sem "Continuar" num aparelho sem jornada');
{
  // os botões cabem na tela e não se sobrepõem (844×390 do iPhone e o Pixel 7)
  const caixas = await A.evaluate(() => ['#bt-solo', '#bt-criar', '#codigo', '#bt-entrar', '#bt-treino', '#qualidade'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const vp = A.viewportSize();
  const dentro = caixas.every((c) => c.x >= 0 && c.y >= 0 && c.x + c.w <= vp.width && c.y + c.h <= vp.height);
  const cruza = caixas.some((a, i) => caixas.some((b, k) => k > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  checar(dentro && !cruza, `botões do menu dentro da tela ${vp.width}×${vp.height} e sem sobreposição`);
}
await A.screenshot({ path: saida + '1_menu_novo.png' });
await A.click('#bt-solo');
await A.waitForSelector('#quadrinhos:not([hidden])', { timeout: 15000 });
await A.click('#bt-pular');
await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
checar(await A.evaluate(() => window.__edmFluxo.modo()) === 'solo', 'Jogar sozinho → campanha solo (prólogo → mapa), sem sala');
const salvo0 = JSON.parse(await ler(A, 'edm-salvo-v2'));
checar(salvo0?.v === 2 && salvo0.slots[0].prologoVisto === true, 'prólogo visto já gravado em edm-salvo-v2 no solo');
await A.click('#bt-jogar');
await A.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 60000 });
const ass = await A.evaluate(() => window.__edm.assentos());
checar(JSON.stringify(ass) === '["pessoa","ia"]', `assentos no solo: ${JSON.stringify(ass)}`);
checar(await A.isVisible('#bt-trocar'), '⇄ disponível no solo');
{
  // o outro personagem segue: o Natan anda para a direita uns segundos
  const e0 = await estado(A);
  await A.evaluate(() => window.__edm.acelerar(4));
  await A.keyboard.down('ArrowRight');
  for (let k = 0; k < 40; k++) { const e = await estado(A); if (e.j[0].x - e0.j[0].x > 5) break; await pausa(150); }
  await A.keyboard.up('ArrowRight');
  await pausa(1500);
  const e1 = await estado(A);
  const dx = Math.abs(e1.j[0].x - e1.j[1].x);
  checar(e1.j[0].x - e0.j[0].x > 3 && e1.j[1].x - e0.j[1].x > 2 && dx < 3.5,
    `a Bruna (jogo) segue o Natan: Natan ${e0.j[0].x.toFixed(1)}→${e1.j[0].x.toFixed(1)}, Bruna ${e0.j[1].x.toFixed(1)}→${e1.j[1].x.toFixed(1)} (distância ${dx.toFixed(1)} m)`);
  await A.screenshot({ path: saida + '1_solo_seguindo.png' });
}
checar(pedidosRede.length === 0, `nenhum pedido ao servidor de sala no solo (${pedidosRede.length})`);

// ---------- 2. salvar na lanterna, recarregar, Continuar ----------
await A.evaluate(([l]) => { window.__edm.acelerar(8); return window.__edm.roteiro(l); }, [roteiro1.lista]);
let naLanterna = null;
for (let t0 = Date.now(); Date.now() - t0 < 300000;) {
  const s = JSON.parse(await ler(A, 'edm-salvo-v2'));
  const r = s?.slots.find((c) => c.id === s.ativo)?.retomada;
  if (r && r.lanterna >= 1) { naLanterna = r; break; }
  await pausa(300);
}
checar(!!naLanterna, `lanterna acesa grava a retomada (${naLanterna ? `lanterna ${naLanterna.lanterna}, ${JSON.stringify(naLanterna).length} B, ★ ${naLanterna.casal}` : 'nada'})`);
{
  // o resumo da lanterna confere com o estado do jogo naquele tick
  const e = await estado(A);
  checar(naLanterna && e.cp >= naLanterna.lanterna && naLanterna.coletadas.every((k) => e.col.includes(k)), 'o resumo da lanterna é um retrato do jogo (estrelinhas contidas nas de agora)');
}
// mais um pouco de jogo depois da lanterna (estrelinhas pegas depois dela também têm de voltar)
await pausa(2500);
await A.keyboard.press('Escape');
await A.waitForSelector('#pausa:not([hidden])', { timeout: 10000 });
await pausa(300);
const antes = await estado(A);
await A.screenshot({ path: saida + '2_antes_de_recarregar.png' });
await A.reload(); // o pagehide grava a retomada com o estado de agora
await A.waitForSelector('#menu:not([hidden])');
const rSalva = JSON.parse(await ler(A, 'edm-salvo-v2')).slots[0].retomada;
const rotulo = await A.textContent('#bt-continuar-jornada');
checar(await A.isVisible('#bt-continuar-jornada') && /Cap\. 1/.test(rotulo), `menu mostra "Continuar" (${rotulo.trim()})`);
await A.screenshot({ path: saida + '2_menu_continuar.png' });
await A.click('#bt-continuar-jornada');
await A.waitForFunction(() => window.__edm?.cap === 1, null, { timeout: 60000 });
await pausa(300);
await A.keyboard.press('Escape');
const depois = await A.evaluate(() => { const e = window.__edm.estado(); return { tick: e.tick, cp: e.checkpoint }; });
const dep = await estado(A);
checar(rSalva.tick === antes.tick && rSalva.lanterna === antes.cp, `pagehide gravou o estado da pausa (tick ${rSalva.tick} = ${antes.tick}, lanterna ${rSalva.lanterna})`);
checar(dep.cp === antes.cp, `Continuar: mesma lanterna (${dep.cp} = ${antes.cp})`);
checar(JSON.stringify(dep.col) === JSON.stringify(antes.col), `Continuar: mesmas estrelinhas (${dep.col.length} = ${antes.col.length}; ★ casal ${dep.casal} = ${antes.casal})`);
checar(JSON.stringify(dep.mortos) === JSON.stringify(antes.mortos), `Continuar: mesmos bichinhos derrotados ([${dep.mortos}] = [${antes.mortos}])`);
checar(Math.abs(depois.tick - antes.tick) <= 120 && dep.casal === antes.casal, `Continuar: relógio da fase e placar onde estavam (tick ${depois.tick} ≈ ${antes.tick})`);
checar(dep.j.every((j) => !j.bolha) && Math.abs(dep.j[0].x - dep.j[1].x) < 3, `os dois renascem juntos na lanterna (x ${dep.j[0].x.toFixed(1)} e ${dep.j[1].x.toFixed(1)})`);
await A.screenshot({ path: saida + '2_depois_de_continuar.png' });
// sem a fase no meio, o mapa também oferece "Continuar · lanterna N"
await A.click('#bt-pausa-mapa'); await A.click('#bt-pausa-mapa');
await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
checar(await A.isVisible('#bt-retomar') && /lanterna/.test(await A.textContent('#bt-retomar')), `mapa: "${(await A.textContent('#bt-retomar')).trim()}" ao lado de "${(await A.textContent('#bt-jogar')).trim()}"`);

// ---------- 3. Quintal de Treino: não toca na campanha (T12) ----------
await A.goto(base);
await A.waitForSelector('#menu:not([hidden])');
const chaves = () => A.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const antesQ = await chaves();
await A.click('#bt-treino');
await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
checar(await A.isVisible('#bt-quintal') && await A.evaluate(() => document.querySelector('#mapa').classList.contains('treino')), 'mapa do treino com o selo TREINO e o botão do Quintal');
await A.click('#bt-quintal');
await A.waitForFunction(() => window.__edm?.fase === 'treino-quintal', null, { timeout: 60000 });
checar(await A.evaluate(() => window.__edm.cap === 0 && document.querySelector('#hud-cap').textContent === 'Quintal de Treino'), 'Quintal de Treino aberto (fase treino-quintal)');
await A.screenshot({ path: saida + '3_quintal.png' });
{
  // bonecos: o Natan anda atacando até a bolotinha (x 6) cair; ela volta alguns segundos depois
  const lista = Array.from({ length: 1500 }, (_, t) => [{ x: t < 400 ? 1 : 0, y: 0, jump: false, act: false, shoot: t % 24 < 12 }, { x: 0, y: 0, jump: false, act: false, shoot: false }]);
  await A.evaluate(([l]) => { window.__edm.acelerar(6); window.__edm.roteiro(l); }, [lista]);
  let caiu = false, voltou = false;
  for (let t0 = Date.now(); Date.now() - t0 < 60000 && !voltou;) {
    const v = await A.evaluate(() => window.__edm.estado().inimigos[0].vivo);
    if (!v) caiu = true; else if (caiu) voltou = true;
    await pausa(150);
  }
  checar(caiu && voltou, `boneco derrotado volta ao lugar (caiu ${caiu}, voltou ${voltou})`);
}
{
  // 2 min de treino: andar, pular, atacar, mão, ⇄ e um pagehide/visibilitychange de mentira no meio
  await A.evaluate(() => { window.__edm.acelerar(3); window.__edm.roteiro([]); });
  const fim = Date.now() + QUINTAL_S * 1000;
  const teclas = ['ArrowRight', 'ArrowLeft', 'Space', 'KeyJ', 'KeyE'];
  let k = 0, trocas = 0;
  while (Date.now() < fim) {
    const t = teclas[k++ % teclas.length];
    await A.keyboard.down(t); await pausa(400); await A.keyboard.up(t);
    if (k % 7 === 0) { await A.evaluate(() => document.querySelector('#bt-trocar').click()); trocas++; }
    if (k % 11 === 0) await A.evaluate(() => { dispatchEvent(new Event('pagehide')); document.dispatchEvent(new Event('visibilitychange')); });
    if (await A.isVisible('#pausa')) await A.click('#bt-continuar');
  }
  // sai pela pausa para o mapa (do treino) e joga um capítulo do treino uns segundos
  await A.keyboard.press('Escape');
  await A.click('#bt-pausa-mapa'); await A.click('#bt-pausa-mapa');
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  await A.evaluate(() => document.querySelectorAll('#mapa .ilha')[2].click());
  await A.click('#bt-jogar');
  await A.waitForFunction(() => window.__edm?.cap === 3, null, { timeout: 60000 });
  await A.keyboard.down('ArrowRight'); await pausa(1500); await A.keyboard.up('ArrowRight');
  await A.evaluate(() => dispatchEvent(new Event('pagehide')));
  await pausa(300);
  const depoisQ = await chaves();
  const iguais = Object.keys(antesQ).filter((c) => c !== 'edm-treino-v1').every((c) => antesQ[c] === depoisQ[c]);
  const novas = Object.keys(depoisQ).filter((c) => !(c in antesQ));
  checar(antesQ['edm-salvo-v2'] && antesQ['edm-salvo-v2'] === depoisQ['edm-salvo-v2'], `T12: edm-salvo-v2 idêntico byte a byte depois de ${QUINTAL_S} s no Quintal (${trocas} trocas ⇄) e um capítulo no treino`);
  checar(iguais && novas.every((c) => c === 'edm-treino-v1'), `nenhuma outra chave mudou (novas: ${novas.join(', ') || 'nenhuma'})`);
  const pt = JSON.parse(depoisQ['edm-treino-v1'] ?? 'null');
  checar(pt?.v === 1 && pt.visitas >= 1, `o treino grava só a chave dele (edm-treino-v1 = ${depoisQ['edm-treino-v1']})`);
}

// ---------- 4. R23: a Bruna cria a sala num aparelho novo; o Natan (com a jornada) entra ----------
{
  const baseSala = `${base}&sinal=127.0.0.1:${portaSinal}`;
  await A.goto(baseSala);
  const idNatan = JSON.parse(await ler(A, 'edm-salvo-v2')).ativo;
  const B = await novaPagina('iPhone 14 landscape', 'B');
  await B.goto(baseSala);
  await B.click('#bt-criar');
  await B.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  await A.fill('#codigo', await B.textContent('#sala-codigo'));
  await A.click('#bt-entrar');
  // a Bruna (anfitriã) não tinha jornada: o prólogo aparece, ela pula e os dois vão ao mapa
  await B.waitForSelector('#quadrinhos:not([hidden]), #mapa:not([hidden])', { timeout: 30000 });
  if (await B.isVisible('#quadrinhos')) await B.click('#bt-pular');
  await B.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  await A.waitForSelector('#mapa:not([hidden])', { timeout: 15000 });
  let iguais = false, sb = null, sa = null;
  for (let t0 = Date.now(); Date.now() - t0 < 15000 && !iguais;) {
    sb = JSON.parse(await ler(B, 'edm-salvo-v2') ?? 'null'); sa = JSON.parse(await ler(A, 'edm-salvo-v2') ?? 'null');
    iguais = sb?.ativo === idNatan && sa?.ativo === idNatan;
    await pausa(300);
  }
  checar(iguais, `os dois aparelhos gravam a jornada do Natan com o mesmo id (${idNatan}; Bruna ${sb?.ativo}, Natan ${sa?.ativo})`);
  const cb = sb?.slots.find((c) => c.id === idNatan), ca = sa?.slots.find((c) => c.id === idNatan);
  checar(cb && ca && cb.retomada?.cap === 1 && cb.prologoVisto, `a Bruna ficou com o progresso do Natan (retomada no cap. ${cb?.retomada?.cap}, lanterna ${cb?.retomada?.lanterna})`);
  checar(await B.isVisible('#bt-retomar'), 'no mapa da anfitriã aparece "Continuar · lanterna" do cap. 1');
  await B.screenshot({ path: saida + '4_bruna_anfitria_mapa.png' });
  await B.context().close();
}

checar(log.length === 0, `sem erros no console${log.length ? ': ' + log.slice(0, 5).join(' | ') : ''}`);
await A.context().close();
await navegador.close(); await srv.close(); sinal?.close?.();
console.log(ok ? 'RESULTADO: APROVADO' : 'RESULTADO: REPROVADO');
process.exit(ok ? 0 : 1);
