// Maquetes da proposta "narrativa-casal" (docs/revisao/NARRATIVA_CASAL.md): balões de fala, leque de emotes,
// convite de abraço e a planta da Casa compartilhada. NÃO é o jogo: é HTML desenhado POR CIMA de capturas reais do
// capítulo 1 (qualidade média, 844×390, HUD ligado), feitas com tools/revisao/capturas.mjs:
//   node tools/revisao/capturas.mjs --raiz <worktree> --caps 1 --q media --tam 844x390@1 \
//        --pontos 0.04,0.2,0.32,0.62,0.97 --hud --porta 4937 --saida <pasta-capturas>
// Uso: node tools/revisao/narrativa-casal/maquetes.mjs <pasta-capturas> <pasta-saida>
// Saída: mock_baloes_emotes.png, mock_convite_abraco.png, mock_casa_planta.png (depois convertidas para webp).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [capDir, saida] = process.argv.slice(2);
mkdirSync(saida, { recursive: true });
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const img = (f) => `data:image/png;base64,${readFileSync(join(capDir, f)).toString('base64')}`;

const base = `
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:844px;height:390px;position:relative;font-family:"Trebuchet MS",system-ui,sans-serif;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;width:844px;height:390px}
.bal{position:absolute;background:#fffaf0;color:#3a2340;border:3px solid #3a2340;border-radius:16px;padding:5px 11px;
  font-size:15px;font-weight:700;line-height:1.15;max-width:230px;box-shadow:0 3px 0 rgba(58,35,64,.35)}
.bal:after{content:"";position:absolute;bottom:-12px;width:0;height:0;border:9px solid transparent;border-top:11px solid #3a2340}
.bal.l:after{left:22px}.bal.r:after{right:22px}
.bal.n{border-color:#a8321f}.bal.n:after{border-top-color:#a8321f}
.bal.b{border-color:#6a3ab0}.bal.b:after{border-top-color:#6a3ab0}
.quem{font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.75;display:block}
.anot{position:absolute;background:rgba(20,10,35,.86);color:#ffe9a8;font-size:11.5px;padding:4px 7px;border-radius:6px;line-height:1.25;max-width:250px}
.anot b{color:#fff}
.seta{position:absolute;border-top:2px dashed #ffe9a8;transform-origin:0 0}
.leque{position:absolute;display:flex;gap:6px;flex-wrap:wrap;width:232px}
.em{width:52px;height:52px;border-radius:50%;background:rgba(255,250,240,.95);border:3px solid #3a2340;display:flex;flex-direction:column;
  align-items:center;justify-content:center;font-size:21px;line-height:1}
.em small{font-size:8.5px;font-weight:700;color:#3a2340;margin-top:2px}
.em.par{border-color:#d0306a;background:#ffe6ef}
.anel{position:absolute;border-radius:50%;border:4px solid #ff4f8a;box-shadow:0 0 14px #ff4f8a}
.tag{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:3px 6px;border-radius:4px}
</style>`;

const mock1 = `${base}<img class="bg" src="${img('cap1_media_844x390@1_p02.png')}">
<!-- leque de emotes aberto (toque no PRÓPRIO rosto) -->
<div class="anel" style="left:8px;top:4px;width:56px;height:56px;border-color:#ffe9a8;box-shadow:0 0 10px #ffe9a8"></div>
<div class="leque" style="left:10px;top:74px">
  <div class="em">👋<small>Vem cá</small></div><div class="em">😂<small>Haha</small></div><div class="em">😮<small>Uau</small></div><div class="em">😤<small>Hmpf</small></div>
  <div class="em par">🙌<small>Toca aqui</small></div><div class="em par">🤗<small>Abraço</small></div><div class="em par">💃<small>Dança</small></div><div class="em par">😘<small>Beijo</small></div>
</div>
<div class="bal b l" style="left:300px;top:102px;max-width:180px"><span class="quem">Bruna</span>Fica nessa placa. Eu abro o seu lado.</div>
<div class="bal n l" style="left:492px;top:118px"><span class="quem">Natan</span>Sim, senhora.</div>
<div class="anot" style="left:250px;top:300px;width:300px"><b>Balões:</b> ≤ 48 caracteres, 2 linhas, acima da plaquinha do nome, nunca no terço de baixo (polegares) nem sobre os corações.</div>
<div class="anot" style="left:250px;top:50px;width:290px;background:rgba(20,10,35,.0)"></div>
<div class="anot" style="left:10px;top:196px;width:232px"><b>Toque no próprio rosto</b> = leque de emotes. Linha de cima: sozinho, na hora. Linha rosa: <b>convite</b> (o outro aceita com ✋).</div>
<div class="tag">MAQUETE sobre captura real · cap. 1, tick 897, média, 844×390</div>`;

const mock2 = `${base}<img class="bg" src="${img('cap1_media_844x390@1_p097.png')}">
<div class="bal n l" style="left:418px;top:118px"><span class="quem">Natan</span>🤗 ?</div>
<div class="anel" style="left:730px;top:183px;width:80px;height:80px"></div>
<div style="position:absolute;left:756px;top:160px;font-size:22px">🤗</div>
<div class="anot" style="left:560px;top:110px;width:160px"><b>No celular da Bruna:</b> o ✋ ganha o ícone do convite e pulsa por 4 s. ✋ = aceita.</div>
<div class="anot" style="left:250px;top:276px;width:340px"><b>Convite de abraço</b> no pódio do pedaço da estrela (x 166–172). Condições: os dois no chão, a ≤ 1,4 m (alcance da mão), sem bichinho a menos de 6 m. Duração 1,6 s, ninguém leva dano durante.</div>
<div class="tag">MAQUETE sobre captura real · cap. 1, tick 3980, média, 844×390</div>`;

// planta lateral da Casa (36 m; 1 m = 22 px)
const M = 22, X0 = 26;
const comodos = [
  [0, 4, 'Varanda', 'porta do MAPA', '#7a5a3a'],
  [4, 13, 'Sala', 'mural de lembranças · foto do casal · estante dos 7 pedaços', '#c78a4a'],
  [13, 19, 'Cozinha', 'minigame BOLO A QUATRO MÃOS · bolo queimado (cap. 5)', '#d9a24f'],
  [19, 26, 'Quarto', 'ROUPEIRO · espelho (cap. 6) · caixinha de música (cap. 1)', '#9a6ab8'],
  [26, 36, 'Quintal', 'porta do TREINO · DANÇA · PESCARIA (lago) · rede', '#5a9a5a'],
];
const sotao = [8, 22, 'Sótão (abre após o cap. 7)', 'telescópio · vaga-lume · QUEBRA-CABEÇA DE FOTO', '#3a3a7a'];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="390" style="position:absolute;left:0;top:0;background:#1e1530">
<text x="${X0}" y="28" fill="#ffe9a8" font-size="17" font-weight="700">Casa compartilhada — planta lateral (hub entre capítulos, 36 m, mesmo motor 2.5D)</text>`;
const yChao = 300, hC = 120;
for (const [a, b, n, d, c] of comodos) {
  const x = X0 + a * M, w = (b - a) * M;
  svg += `<rect x="${x}" y="${yChao - hC}" width="${w}" height="${hC}" fill="${c}" stroke="#1e1530" stroke-width="3" rx="4"/>
  <text x="${x + 6}" y="${yChao - hC + 20}" fill="#fff" font-size="14" font-weight="700">${n}</text>
  <foreignObject x="${x + 4}" y="${yChao - hC + 26}" width="${w - 8}" height="90"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font:11px Trebuchet MS;line-height:1.25">${d}</div></foreignObject>
  <text x="${x}" y="${yChao + 18}" fill="#bba" font-size="10">${a} m</text>`;
}
{ const [a, b, n, d, c] = sotao; const x = X0 + a * M, w = (b - a) * M;
  svg += `<path d="M${x - 20} ${yChao - hC} L${x + w / 2} ${yChao - hC - 120} L${x + w + 20} ${yChao - hC} Z" fill="${c}" stroke="#1e1530" stroke-width="3"/>
  <text x="${x + w / 2}" y="${yChao - hC - 52}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${n}</text>
  <text x="${x + w / 2}" y="${yChao - hC - 34}" fill="#fff" font-size="10.5" text-anchor="middle">${d}</text>
  <text x="${x + w / 2}" y="${yChao - hC - 18}" fill="#ffe9a8" font-size="10" text-anchor="middle">escada na sala (x 11) · alçapão: mãos dadas</text>`; }
svg += `<rect x="${X0}" y="${yChao}" width="${36 * M}" height="8" fill="#4a3020"/>
<text x="${X0 + 36 * M}" y="${yChao + 18}" fill="#bba" font-size="10" text-anchor="end">36 m</text>
<text x="${X0}" y="${yChao + 44}" fill="#ffe9a8" font-size="11.5">Cada capítulo concluído põe um objeto na casa: urso, lanterna, relógio, concha, bolo queimado, espelho, vaga-lume.</text>
<text x="${X0}" y="${yChao + 62}" fill="#ffe9a8" font-size="11.5">Interação sempre com ✋ (como nas fases). Dona Lume aparece na varanda com 1 fala depois de cada capítulo.</text>
<text x="${X0}" y="${yChao + 80}" fill="#bba" font-size="10">MAQUETE de planta (sem arte). Posições propostas; a arquitetura (ARQUITETURA_MODOS §4.2) já prevê a Casa como fase com tipo 'casa'.</text>
</svg>`;
const mock3 = `${base}${svg}`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
for (const [nome, html] of [['mock_baloes_emotes', mock1], ['mock_convite_abraco', mock2], ['mock_casa_planta', mock3]]) {
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: join(saida, `${nome}.png`) });
  console.log(nome);
}
await b.close();
