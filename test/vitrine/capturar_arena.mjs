// Capturas da Arena do Coração. Uso: node test/vitrine/capturar_arena.mjs [cenas…]   (Q=media|alta|baixa, PORTA=4822)
// Sobe o servidor de desenvolvimento, abre test/vitrine/arena.html num "celular" em paisagem (1280 × 720 css px
// com razão 1, para medir igual em qualquer máquina) e salva PNGs em test-out/arena/ com as medidas do renderer.info.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');

const porta = Number(process.env.PORTA ?? 4822);
const Q = process.env.Q ?? 'media';
const saida = new URL(`../../test-out/arena/${Q}/`, import.meta.url).pathname; mkdirSync(saida, { recursive: true });
const srv = await createServer({ server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await srv.listen();
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) }, deviceScaleFactor: 1 })).newPage();
const erros = [];
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.text()); });
pagina.on('pageerror', (e) => erros.push(String(e)));
const abrir = async (extra = '') => {
  await pagina.goto(`http://127.0.0.1:${porta}/test/vitrine/arena.html?resfixa&q=${Q}${extra}`);
  await pagina.waitForFunction(() => window.__arena?.carregado, null, { timeout: 120000 });
  await pagina.evaluate(() => window.__arena.pausar(true));
};
const A = (f, ...a) => pagina.evaluate(([f, a]) => { const v = window.__arena[f]; return typeof v === 'function' ? v.apply(window.__arena, a) : v; }, [f, a]);
const medidas = [];
const foto = async (nome) => {
  // o SwiftShader às vezes demora a entregar o quadro: espera mais e tenta de novo
  try { await pagina.screenshot({ path: `${saida}${nome}.png`, timeout: 90000 }); }
  catch { await A('desenhar'); await pagina.screenshot({ path: `${saida}${nome}.png`, timeout: 90000 }); }
  const i = await A('info');
  medidas.push({ nome, ...i });
  console.log(`${nome}: ${i.chamadas} chamadas, ${i.triangulos} triângulos`);
};

const cenas = {
  async inicio() { await abrir(); await A('quadros', 40); await foto('00_inicio'); },
  /** pilar entre a câmera e quem joga: deve ficar pontilhado (recorte de visão), sem tapar o Natan */
  async recorte() {
    await abrir(); await A('bots', false);
    const a = Math.PI / 6;
    await A('por', 0, 5.5 * Math.sin(a), 5.5 * Math.cos(a), a + Math.PI); await A('por', 1, 0, 6.5, Math.PI);
    await A('quadros', 60); await foto('02_recorte_pilar');
  },
  async fase1() {
    await abrir();
    await A('ate', "e.perigos.some(p => p.tipo === 'onda' && p.aviso > 0 && p.aviso < 0.45)");
    await A('quadros', 6); await foto('01_fase1_pancada_aviso');
    await A('ate', "e.perigos.some(p => p.tipo === 'onda' && p.aviso <= 0 && p.t > 0.35)");
    await A('quadros', 4); await foto('02_fase1_onda');
    await A('ate', "e.perigos.some(p => p.tipo === 'esporo' && p.aviso > 0 && p.aviso < 0.5)");
    await A('quadros', 6); await foto('03_fase1_esporos');
    await A('ate', "e.lacaios.some(l => l.tipo === 'bolotinha' && l.etapa !== 'surgindo')", 60 * 60);
    await A('quadros', 20); await foto('04_fase1_bolotinhas');
  },
  async fase2() {
    await abrir();
    await A('fimDaFase'); await A('ate', 'e.rei.fase === 2');
    await A('quadros', 30); await foto('05_fase2_rugido');
    await A('ate', "e.perigos.some(p => p.tipo === 'investida' && p.aviso > 0 && p.aviso < 0.5)");
    await A('quadros', 6); await foto('06_fase2_escudo_investida');
    await A('ate', "e.lacaios.some(l => l.tipo === 'morcego' && l.etapa !== 'surgindo')", 60 * 60);
    await A('quadros', 30); await foto('07_fase2_morcegos');
  },
  async fase3() {
    await abrir();
    await A('fimDaFase'); await A('ate', 'e.rei.fase === 2');
    await A('fimDaFase'); await A('ate', "e.rei.fase === 3 && e.rei.transicao <= 0", 60 * 200);
    await A('ate', 'e.parede === 2'); await A('quadros', 40); await foto('08_fase3_parede');
    await A('ate', 'e.cristais.some(c => c > 0)', 60 * 60); await A('quadros', 8); await foto('09_fase3_cristal');
    await A('ate', 'e.parede === 0 && e.rei.vulneravel > 0', 60 * 90); await A('quadros', 20); await foto('10_fase3_estrela');
  },
  async poderes() {
    await abrir();
    await A('quadros', 10);
    await A('bots', false);
    // Corte Cometa (Natan)
    await A('encherPoder', 0); await A('quadros', 20);
    await A('forcar', 0, { poder: true }); await A('quadros', 5); await A('forcar', 0, null);
    await A('quadros', 3); await foto('11_poder_cometa');
    await A('quadros', 60);
    // Jardim de Luz (Bruna)
    await A('local', 1);
    await A('encherPoder', 1); await A('quadros', 20);
    await A('forcar', 1, { poder: true }); await A('quadros', 2); await A('forcar', 1, null);
    await A('quadros', 40); await foto('12_poder_jardim');
    await A('quadros', 300);
    // Golpe do Fio Vermelho: os dois juntos
    await A('local', 0);
    await A('encherPoder', 0); await A('encherPoder', 1); await A('quadros', 10);
    await A('forcar', 1, { poder: true }); await A('quadros', 20); await A('forcar', 1, null);
    await A('forcar', 0, { poder: true }); await A('quadros', 3); await A('forcar', 0, null);
    await A('quadros', 12); await foto('13_poder_fio_vermelho');
  },
  async vitoria() {
    await abrir();
    await A('fimDaFase'); await A('ate', 'e.rei.fase === 2');
    await A('fimDaFase'); await A('ate', 'e.rei.fase === 3 && e.rei.transicao <= 0', 60 * 200);
    await A('ate', 'e.parede === 0 && e.rei.vulneravel > 0', 60 * 120);
    await A('fimDaFase'); await A('ate', 'e.vitoria', 60 * 60);
    await A('quadros', 20); await foto('14_vitoria_derrota');
    await A('quadros', 100); await foto('15_vitoria_vagalume');
  },
};

// poses de perto (simulação com os bots desligados e entradas forçadas)
cenas.poses = async () => {
  await abrir();
  await A('bots', false);
  const perto = async (nome, prep, n = 0) => {
    await A('por', 0, -0.9, 6.2, Math.PI); await A('por', 1, 0.9, 6.2, Math.PI);
    await A('camera', { x: 1.6, y: 1.5, z: 9.3 }, { x: 0, y: 0.75, z: 6.2 });
    await prep(); if (n) await A('quadros', n); await foto(nome);
    await A('forcar', 0, null); await A('forcar', 1, null);
  };
  await perto('20_pose_parado', async () => { await A('quadros', 30); });
  for (const c of [0, 1, 2]) {
    await perto(`2${1 + c}_pose_golpe${c + 1}`, async () => {
      await A('quadros', 10);
      for (let k = 0; k <= c; k++) {
        await A('forcar', 0, { golpe: true }); await A('forcar', 1, { golpe: true }); await A('quadros', 2);
        await A('forcar', 0, { golpe: false }); await A('forcar', 1, { golpe: false }); await A('quadros', k < c ? 14 : 0);
      }
      await A('quadros', 6);
    });
  }
  await perto('24_pose_pulo', async () => { await A('quadros', 10); await A('forcar', 0, { pulo: true }); await A('forcar', 1, { pulo: true }); await A('quadros', 10); });
  await perto('25_pose_esquiva', async () => { await A('quadros', 10); await A('forcar', 0, { esquiva: true, x: 1 }); await A('forcar', 1, { esquiva: true, x: -1 }); await A('quadros', 11); });
  await perto('26_pose_corrida', async () => { await A('quadros', 5); await A('forcar', 0, { x: 1, y: 0.2 }); await A('forcar', 1, { x: 1, y: 0.2 }); await A('quadros', 24); });
  await A('camera', null);
};

const pedidas = process.argv.slice(2);
for (const [nome, f] of Object.entries(cenas)) {
  if (pedidas.length && !pedidas.includes(nome)) continue;
  try { await f(); } catch (e) { console.log(`cena ${nome} falhou: ${e}`); }
}
writeFileSync(`${saida}medidas.json`, JSON.stringify(medidas, null, 2));
if (erros.length) console.log('erros/avisos do navegador:\n' + [...new Set(erros)].slice(0, 20).join('\n'));
await navegador.close();
await srv.close();
