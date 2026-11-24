// Compara duas rodadas de tools/revisao/capturas.mjs (rodadas com --medir) e confere o guia de estilo.
// Uso: node tools/revisao/comparar.mjs <pasta-antes> <pasta-depois> [--folha]
//   Imprime, por captura em comum, L* médio, contraste (dp de L*), % quase branco e saturação antes → depois, e marca
//   ✗ o que estiver fora das faixas-alvo do guia (por capítulo para L* e % sombra) (docs/revisao/ARTE_DIAGNOSTICO.md, seção "Guia de estilo").
//   --folha grava <pasta-depois>/antes_depois_<tamanho>.webp (antes à esquerda, depois à direita, por capítulo × qualidade).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { folhaWebp } from './medir.mjs';

/** Faixas-alvo do guia (iguais às tabelas 6.1 e 6.2 do documento). L* e % sombra dependem do capítulo. */
export const ALVO = {
  L_media: [38, 58], L_dp_contraste: [20, 32], pct_quase_branco: [0, 4], pct_sombra: [12, 35], saturacao_media: [0.42, 0.75],
};
/** Por capítulo: L* alvo (±6) e faixa de % sombra (L* ≤ 30), medidos nos style frames (docs/revisao/img/arte-diagnostico). */
export const ALVO_CAP = {
  1: { L: 46, sombra: [18, 28] }, 2: { L: 41, sombra: [30, 45] }, 3: { L: 42, sombra: [28, 40] }, 4: { L: 48, sombra: [18, 28] },
  5: { L: 53, sombra: [14, 24] }, 6: { L: 31, sombra: [50, 65] }, 7: { L: 31, sombra: [55, 68] },
};
const faixa = (k, cap) => {
  const c = ALVO_CAP[cap];
  if (c && k === 'L_media') return [c.L - 6, c.L + 6];
  if (c && k === 'pct_sombra') return c.sombra;
  return ALVO[k];
};
const [A, B] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const ler = (d) => JSON.parse(readFileSync(join(d, 'medidas.json'), 'utf8'));
const ma = Object.fromEntries(ler(A).map((x) => [x.arquivo, x])), mb = ler(B);
const fora = (k, v, cap) => { const f = faixa(k, cap); return f && (v < f[0] || v > f[1]) ? '✗' : ' '; };
const cols = Object.keys(ALVO);
console.log(['captura', ...cols].join('\t'));
for (const b of mb) {
  const a = ma[b.arquivo]; if (!a?.medidas || !b.medidas) continue;
  console.log([b.arquivo, ...cols.map((k) => `${a.medidas[k]}→${b.medidas[k]}${fora(k, b.medidas[k], b.cap)}`)].join('\t'));
}
if (process.argv.includes('--folha')) {
  const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
  const nav = await chromium.launch();
  const tams = [...new Set(mb.map((x) => x.tam))];
  for (const t of tams) {
    const sel = mb.filter((x) => x.tam === t && ma[x.arquivo]);
    const ponto = sel[0]?.ponto;
    const linhas = sel.filter((x) => x.ponto === ponto).map((x) => [join(A, x.arquivo), join(B, x.arquivo)]);
    const rot = sel.filter((x) => x.ponto === ponto).map((x) => [`antes · cap ${x.cap} · ${x.q}`, `depois · cap ${x.cap} · ${x.q}`]);
    await folhaWebp(nav, linhas, join(B, `antes_depois_${t}.webp`), { largura: 420, rotulos: rot });
  }
  await nav.close();
}
