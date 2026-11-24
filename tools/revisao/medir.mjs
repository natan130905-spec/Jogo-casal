// Medidas de imagem para a revisão de arte (sem dependências: decodifica no Chromium via canvas 2D).
// Por imagem: média e desvio de L* (CIELAB, 0–100), percentis 5/50/95, histograma de L* em 10 faixas,
// % quase branco (L* ≥ 90), % quase preto (L* ≤ 15), % de sombra (L* ≤ 30), saturação média (HSV) e croma médio (C*ab),
// contraste RMS (= desvio de L*) e amplitude p95−p5.
// CLI: node tools/revisao/medir.mjs a.png b.png … [--recorte x,y,w,h]   (recorte em pixels da imagem; útil na arte
//      conceitual, cujo quadro de jogo é 420,0,890,585 em docs/arte/conceito.png)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataUrl = (f) => `data:image/${f.endsWith('.webp') ? 'webp' : f.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${readFileSync(f).toString('base64')}`;

/** Função que roda no navegador: devolve as medidas de uma imagem. */
const MEDIR = async ([url, recorte]) => {
  const img = await createImageBitmap(await (await fetch(url)).blob());
  const [x0, y0, w, h] = recorte ?? [0, 0, img.width, img.height];
  const c = new OffscreenCanvas(w, h); const g = c.getContext('2d');
  g.drawImage(img, -x0, -y0);
  const d = g.getImageData(0, 0, w, h).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const T = new Float32Array(256); for (let i = 0; i < 256; i++) T[i] = lin(i);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const n = w * h, Ls = new Float32Array(n), hist = new Array(10).fill(0);
  let sL = 0, sL2 = 0, sS = 0, sC = 0, branco = 0, preto = 0, sombra = 0;
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    const r = T[d[i]], gg = T[d[i + 1]], b = T[d[i + 2]];
    const X = (0.4124 * r + 0.3576 * gg + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b, Z = (0.0193 * r + 0.1192 * gg + 0.9505 * b) / 1.08883;
    const fy = f(Y), L = 116 * fy - 16, A = 500 * (f(X) - fy), B = 200 * (fy - f(Z));
    Ls[k] = L; sL += L; sL2 += L * L; sC += Math.hypot(A, B);
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    sS += mx ? (mx - mn) / mx : 0;
    hist[Math.min(9, Math.floor(L / 10))]++;
    if (L >= 90) branco++; if (L <= 15) preto++; if (L <= 30) sombra++;
  }
  const ord = Ls.slice().sort(); const pc = (p) => ord[Math.min(n - 1, Math.floor(p * n))];
  const media = sL / n, dp = Math.sqrt(Math.max(0, sL2 / n - media * media));
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    w, h, L_media: r1(media), L_dp_contraste: r1(dp), L_p5: r1(pc(0.05)), L_p50: r1(pc(0.5)), L_p95: r1(pc(0.95)),
    amplitude_p95_p5: r1(pc(0.95) - pc(0.05)), pct_quase_branco: r1((100 * branco) / n), pct_quase_preto: r1((100 * preto) / n),
    pct_sombra: r1((100 * sombra) / n), saturacao_media: Math.round((1000 * sS) / n) / 1000, croma_medio: r1(sC / n),
    hist_L: hist.map((v) => r1((100 * v) / n)),
  };
};

export async function medirArquivos(navegador, arquivos, recorte = null) {
  const p = await navegador.newPage();
  const out = [];
  for (const a of arquivos) out.push(await p.evaluate(MEDIR, [dataUrl(a), recorte]));
  await p.close();
  return out;
}

/** Folha de contato em WebP: `linhas` = matriz de caminhos (null = vazio); `rotulos` igual. */
export async function folhaWebp(navegador, linhas, destino, { largura = 360, rotulos = null, qualidade = 0.82 } = {}) {
  const p = await navegador.newPage();
  const urls = linhas.map((l) => l.map((a) => { try { return a ? dataUrl(a) : null; } catch { return null; } }));
  const b64 = await p.evaluate(async ([urls, rotulos, largura, qualidade]) => {
    const imgs = await Promise.all(urls.map((l) => Promise.all(l.map(async (u) => (u ? createImageBitmap(await (await fetch(u)).blob()) : null)))));
    const ex = imgs.flat().find(Boolean); const alt = Math.round((largura * ex.height) / ex.width);
    const cols = Math.max(...imgs.map((l) => l.length));
    const c = document.createElement('canvas'); c.width = cols * largura; c.height = imgs.length * alt;
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = 'bold 13px sans-serif';
    imgs.forEach((l, i) => l.forEach((im, j) => {
      if (im) g.drawImage(im, j * largura, i * alt, largura, alt);
      const r = rotulos?.[i]?.[j]; if (r) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(j * largura, i * alt, g.measureText(r).width + 10, 18); g.fillStyle = '#fff'; g.fillText(r, j * largura + 5, i * alt + 13); }
    }));
    return c.toDataURL('image/webp', qualidade).split(',')[1];
  }, [urls, rotulos, largura, qualidade]);
  writeFileSync(destino, Buffer.from(b64, 'base64'));
  await p.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const i = a.indexOf('--recorte');
  const recorte = i >= 0 ? a[i + 1].split(',').map(Number) : null;
  const arqs = a.filter((x, k) => !x.startsWith('--') && (i < 0 || k !== i + 1));
  const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
  const nav = await chromium.launch();
  const m = await medirArquivos(nav, arqs, recorte);
  arqs.forEach((f, k) => console.log(f, JSON.stringify(m[k])));
  await nav.close();
}
