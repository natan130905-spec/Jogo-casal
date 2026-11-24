// E2E da conexão entre os dois celulares quando quem criou a sala sai do jogo para mandar o código (rede, H1):
//  1. "socket": A cria a sala, vai para segundo plano (visibilitychange) e o servidor de sinalização perde o socket
//     dele (o sistema do celular mata a conexão do app em segundo plano; aqui o servidor fecha o socket) e a página
//     congela (CDP Debugger.pause). B tenta entrar durante AUSENTE_S segundos. A volta: B tem de
//     conectar sozinho, sem tocar em nada, e os dois chegam ao prólogo.
//  2. "congelado": o mesmo, mas o socket continua vivo (só a página congela): o pedido de B fica parado no socket de A.
//  3. "link": A cria a sala; B abre o LINK de convite (?sala=CODIGO) e entra direto, sem digitar nem tocar.
//  4. "teste": a tela "Testar conexão" mostra a sinalização ok e os tipos de candidato.
//  5. "relay": um TURN local (node-turn, 127.0.0.1) entra pelo rede.json → turnApi (como o da Metered): a tela de teste
//     mostra relay e "funciona"; com ?ice=relay a sala conecta só pela retransmissão (caminho relay/udp).
//     Precisa do pacote node-turn: TURN_MODULO=<pasta>/node_modules/node-turn (sem ele, o cenário é pulado).
// Uso: node test/e2e/rede.mjs [socket|congelado|link|teste|relay ...]   (padrão: todos)
// Ambiente: DIST (build, padrão dist), PORTA (preview, 4863), AUSENTE_S (padrão 30).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import { PeerServer } from 'peer';
import { preview } from 'vite';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const porta = Number(process.env.PORTA ?? 4863);
const AUSENTE_S = Number(process.env.AUSENTE_S ?? 30);
const pedidos = process.argv.slice(2);
const cenarios = pedidos.length ? pedidos : ['socket', 'congelado', 'link', 'teste', 'relay'];
const saida = new URL('../../test-out/rede/', import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true; const checar = (c, msg) => { console.log(`${c ? 'OK ' : 'FALHOU'} ${msg}`); ok &&= !!c; };

// servidor de sinalização local; guarda os clientes para poder derrubar o socket de um deles (como o celular faz)
const clientes = new Map();
let sinal = null;
const portaSinal = await new Promise((r) => {
  sinal = PeerServer({ port: 0, path: '/', host: '127.0.0.1' }, (s) => r(s.address().port));
});
sinal.on('connection', (c) => clientes.set(c.getId(), c));
sinal.on('disconnect', (c) => { if (clientes.get(c.getId()) === c) clientes.delete(c.getId()); });
const dist = process.env.DIST ?? new URL('../../dist/', import.meta.url).pathname;
let srv = await preview({ build: { outDir: dist }, preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
let base = `http://127.0.0.1:${porta}/?q=baixa&sinal=127.0.0.1:${portaSinal}`;
const navegador = await chromium.launch();
const log = [];

async function novaPagina(disp, nome) {
  const ctx = await navegador.newContext({ ...devices[disp] });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') log.push(`${nome}: ${m.text()}`); });
  p.on('pageerror', (e) => log.push(`${nome}: ${e.message}`));
  return { p, ctx };
}
/** segundo plano de mentira: document.hidden + visibilitychange (o que o celular faz ao abrir o WhatsApp) */
const visibilidade = (p, oculta) => p.evaluate((oculta) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculta });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (oculta ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, oculta);

async function criar(A) {
  await A.goto(base);
  await A.click('#bt-criar');
  await A.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#sala-codigo').textContent), null, { timeout: 30000 });
  return A.textContent('#sala-codigo');
}
const noPrologo = (p) => p.evaluate(() => !document.querySelector('#quadrinhos').hidden).catch(() => false);

async function ausente(cenario) {
  console.log(`\n== ${cenario}: quem criou a sala fica ${AUSENTE_S} s fora do jogo enquanto a outra pessoa tenta entrar ==`);
  const a = await novaPagina('Pixel 7 landscape', 'A'), b = await novaPagina('iPhone 14 landscape', 'B');
  const A = a.p, B = b.p;
  const codigo = await criar(A);
  const idA = [...clientes.keys()].find((k) => k.endsWith(codigo));
  checar(!!idA, `sala ${codigo} registrada no servidor (${idA})`);
  const cdp = await a.ctx.newCDPSession(A);
  await visibilidade(A, true);
  await pausa(300);
  if (cenario === 'socket') clientes.get(idA)?.getSocket()?.close();
  // congela o JavaScript da página (Page.setWebLifecycleState 'frozen' não congela uma página visível no Chromium
  // sem tela; o Debugger.pause para o laço de eventos, como o celular faz com o app em segundo plano)
  await cdp.send('Debugger.enable'); await cdp.send('Debugger.pause');
  const t0 = Date.now();
  await B.goto(base);
  await B.fill('#codigo', codigo); await B.click('#bt-entrar');
  const mensagens = new Set();
  while (Date.now() - t0 < AUSENTE_S * 1000) {
    mensagens.add((await B.textContent('#menu-erro').catch(() => '')).replace(/ ?\(\d+ s\)/, ''));
    await pausa(500);
  }
  await B.screenshot({ path: `${saida}${cenario}_B_esperando.png` });
  console.log(`   mensagens no convidado enquanto A estava fora: ${[...mensagens].filter(Boolean).map((m) => `"${m}"`).join(' | ')}`);
  await cdp.send('Debugger.resume');
  await visibilidade(A, false);
  const tVolta = Date.now();
  let conectou = false;
  while (Date.now() - tVolta < 30000) {
    if (await noPrologo(A) && await noPrologo(B)) { conectou = true; break; }
    await pausa(250);
  }
  const fim = await B.textContent('#menu-erro').catch(() => '');
  await B.screenshot({ path: `${saida}${cenario}_B_fim.png` });
  checar(conectou, `${cenario}: depois que A volta, os dois chegam ao prólogo sem ninguém tocar em nada `
    + `(${conectou ? `${((Date.now() - tVolta) / 1000).toFixed(1)} s depois da volta` : `B ficou em "${fim}"`})`);
  await a.ctx.close(); await b.ctx.close();
}

async function link() {
  console.log('\n== link: o convite abre o jogo e já entra na sala ==');
  const a = await novaPagina('Pixel 7 landscape', 'A'), b = await novaPagina('iPhone 14 landscape', 'B');
  const A = a.p, B = b.p;
  await a.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const codigo = await criar(A);
  // sem navigator.share no Chromium de teste: o botão copia o link
  await A.click('#bt-compartilhar');
  await pausa(300);
  const copiado = await A.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  checar(copiado.includes(`sala=${codigo}`), `Compartilhar copia o link de convite (${copiado})`);
  const url = new URL(copiado || `http://x/?sala=${codigo}`);
  const t0 = Date.now();
  await B.goto(`${base}&sala=${url.searchParams.get('sala')}`);
  let conectou = false;
  while (Date.now() - t0 < 30000) { if (await noPrologo(A) && await noPrologo(B)) { conectou = true; break; } await pausa(250); }
  checar(conectou, `abrir o link entra na sala sem digitar nem tocar (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await a.ctx.close(); await b.ctx.close();
}

async function teste() {
  console.log('\n== teste: a tela "Testar conexão" ==');
  const a = await novaPagina('Pixel 7 landscape', 'A');
  const A = a.p;
  await A.goto(base);
  await A.click('#bt-testar-rede');
  await A.waitForSelector('#teste-rede:not([hidden])', { timeout: 5000 });
  await A.waitForSelector('#tr-fim[data-pronto="1"]', { timeout: 40000 });
  const r = await A.evaluate(() => ({
    sinal: document.querySelector('#tr-sinal').textContent,
    cand: document.querySelector('#tr-cand').textContent,
    fim: document.querySelector('#tr-fim').textContent,
    texto: document.querySelector('#tr-texto').value,
  }));
  await A.screenshot({ path: `${saida}teste_conexao.png` });
  console.log(`   sinalização: ${r.sinal}\n   candidatos: ${r.cand}\n   resultado: ${r.fim}`);
  checar(/ok/i.test(r.sinal), 'a tela mostra a sinalização ok (servidor local)');
  checar(/host/.test(r.cand), 'a tela mostra os tipos de candidato obtidos (pelo menos host)');
  checar(r.texto.includes('sinalização') && r.texto.includes('versão'), 'o texto para copiar tem sinalização e versão');
  await a.ctx.close();
}

async function relay() {
  console.log('\n== relay: TURN configurado pelo rede.json (turnApi) e sala só pela retransmissão ==');
  const mod = process.env.TURN_MODULO;
  if (!mod) { console.log('PULADO (defina TURN_MODULO com o caminho do pacote node-turn)'); return; }
  const Turn = createRequire(import.meta.url)(mod);
  const portaTurn = 34000 + Math.floor(Math.random() * 900);
  const turn = new Turn({ authMech: 'long-term', credentials: { edm: 'teste' }, listeningIps: ['127.0.0.1'], relayIps: ['127.0.0.1'], listeningPort: portaTurn, debugLevel: 'OFF' });
  turn.start();
  // uma cópia do build com rede.json → turnApi (um arquivo que devolve a lista, como a API da Metered)
  const copia = new URL('../../test-out/rede/dist-turn/', import.meta.url).pathname;
  rmSync(copia, { recursive: true, force: true }); cpSync(dist, copia, { recursive: true });
  writeFileSync(`${copia}turn_api.json`, JSON.stringify([{ urls: `turn:127.0.0.1:${portaTurn}`, username: 'edm', credential: 'teste' }]));
  writeFileSync(`${copia}rede.json`, JSON.stringify({ turnApi: `http://127.0.0.1:${porta}/turn_api.json` }));
  await srv.close();
  srv = await preview({ build: { outDir: copia }, preview: { port: porta, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  try {
    const a = await novaPagina('Pixel 7 landscape', 'A'), b = await novaPagina('iPhone 14 landscape', 'B');
    const A = a.p, B = b.p;
    await A.goto(base);
    await A.click('#bt-testar-rede');
    await A.waitForSelector('#tr-fim[data-pronto="1"]', { timeout: 40000 });
    const r = await A.evaluate(() => ({ ice: document.querySelector('#tr-ice').textContent, cand: document.querySelector('#tr-cand').textContent,
      relay: document.querySelector('#tr-relay').textContent, fim: document.querySelector('#tr-fim').textContent }));
    await A.screenshot({ path: `${saida}teste_conexao_turn.png` });
    console.log(`   servidores: ${r.ice}\n   candidatos: ${r.cand}\n   retransmissão: ${r.relay}\n   resultado: ${r.fim}`);
    checar(/turnApi/.test(r.ice), 'o TURN próprio veio do rede.json → turnApi');
    checar(/relay [1-9]/.test(r.cand) && /funciona/.test(r.relay), 'a tela mostra candidato relay e a retransmissão funcionando de ponta a ponta');
    await A.click('#bt-tr-voltar');
    const codigo = await criar(A);
    await B.goto(`${base}&ice=relay`);
    await B.fill('#codigo', codigo); await B.click('#bt-entrar');
    let conectou = false;
    for (let k = 0; k < 120 && !conectou; k++) { conectou = await noPrologo(A) && await noPrologo(B); if (!conectou) await pausa(250); }
    const caminho = conectou ? await B.evaluate(() => window.__edmRede?.caminho()) : '—';
    checar(conectou && /^relay\//.test(caminho), `com ?ice=relay a sala conecta só pela retransmissão (caminho do convidado: ${caminho})`);
    await a.ctx.close(); await b.ctx.close();
  } finally { turn.stop(); }
}

try {
  for (const c of cenarios) {
    if (c === 'relay') await relay();
    if (c === 'socket' || c === 'congelado') await ausente(c);
    else if (c === 'link') await link();
    else if (c === 'teste') await teste();
  }
} finally {
  if (log.length) console.log(`\nerros no console:\n  ${log.slice(0, 12).join('\n  ')}`);
  await navegador.close(); await srv.close(); sinal?.close?.();
  console.log(ok ? '\nTUDO OK' : '\nHOUVE FALHAS');
  process.exit(ok ? 0 : 1);
}
