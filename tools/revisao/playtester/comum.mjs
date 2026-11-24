// Utilidades do playtest de toque (playtester). Sobe o Vite de desenvolvimento numa cópia do jogo, abre "celulares"
// (Playwright, toque de verdade via CDP Input.dispatchTouchEvent, área segura do iPhone via
// Emulation.setSafeAreaInsetsOverride) e mede o DOM.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const APARELHOS = {
  // iPhone 14 em paisagem, como app na tela inicial (sem barra do Safari): 844×390, entalhe = 47 px de cada lado,
  // barra de "home" = 21 px embaixo (valores que o iOS informa em env(safe-area-inset-*) com viewport-fit=cover)
  iphone: { w: 844, h: 390, dsf: 3, seguro: { left: 47, right: 47, bottom: 21, top: 0 }, nome: 'iPhone 14 (PWA)' },
  // iPhone 14 no Safari (sem tela cheia: o iPhone não tem Fullscreen API). Altura útil ≈ 340 px [hipótese de medida:
  // a barra compacta do Safari em paisagem ocupa ~50 px; conferir num aparelho]
  iphoneSafari: { w: 844, h: 340, dsf: 3, seguro: { left: 47, right: 47, bottom: 21, top: 0 }, nome: 'iPhone 14 (Safari, barra visível)' },
  // Pixel 7 / Redmi Note 11 em paisagem com tela cheia (Android permite requestFullscreen)
  android: { w: 915, h: 412, dsf: 2.625, seguro: null, nome: 'Pixel/Redmi 915×412' },
};

export async function subirVite(raiz, porta) {
  const req = createRequire(join(raiz, 'package.json'));
  const { createServer } = await import(req.resolve('vite'));
  const vs = await createServer({ root: raiz, configFile: existsSync(join(raiz, 'vite.config.ts')) ? join(raiz, 'vite.config.ts') : false,
    server: { port: porta, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
  await vs.listen();
  return vs;
}

export function playwright() {
  return createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
}

/** Abre um "celular". dsf menor que o real para caber no tempo da máquina sem GPU (o layout CSS é o mesmo). */
export async function celular(navegador, ap, { dsf = 1 } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: ap.w, height: ap.h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (ap.seguro) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ap.seguro });
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  const toque = new Toque(cdp);
  return { ctx, page, cdp, toque, erros };
}

/** Toque multi-dedo de verdade (gera pointerdown/move/up de toque no Chromium). */
export class Toque {
  constructor(cdp) { this.cdp = cdp; this.dedos = new Map(); }
  async enviar(tipo) {
    const touchPoints = [...this.dedos.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 11, radiusY: 11, force: 1 }));
    await this.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints });
  }
  async baixar(id, x, y) { this.dedos.set(id, { x, y }); await this.enviar('touchStart'); }
  async mover(id, x, y) { this.dedos.set(id, { x, y }); await this.enviar('touchMove'); }
  // touchEnd leva SÓ o dedo que sai: mandando os que ficam, o CDP solta os que ficam e o que saiu nunca recebe
  // pointerup (REGISTRO R71; antes daqui, "Continuar com o dedo no joystick" media o dedo errado)
  async soltar(id) { const p = this.dedos.get(id); this.dedos.delete(id); if (p) await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id, radiusX: 11, radiusY: 11, force: 1 }] }); }
  async soltarTudo() { this.dedos.clear(); await this.enviar('touchEnd'); }
  async tocar(x, y, ms = 60, page = null) { await this.baixar(99, x, y); if (page) await page.waitForTimeout(ms); await this.soltar(99); }
}

export const centro = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Auditoria do DOM visível: textos (tamanho da letra) e alvos de toque (tamanho, distância às bordas e ao entalhe). */
export async function auditarDom(page, seguro) {
  return page.evaluate((seguro) => {
    const W = innerWidth, H = innerHeight;
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H; };
    const nome = (el) => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
    const textos = [];
    const vistos = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el)) continue;
      const proprio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!proprio) continue;
      const cs = getComputedStyle(el);
      const t = el.textContent.trim().slice(0, 40);
      const k = nome(el) + t;
      if (vistos.has(k)) continue; vistos.add(k);
      textos.push({ el: nome(el), texto: t, px: parseFloat(cs.fontSize), cor: cs.color, fundo: cs.backgroundColor });
    }
    const alvos = [];
    for (const el of document.querySelectorAll('button, input, select, #joystick, .joy, .ilha, a')) {
      if (!vis(el) || el.disabled && el.tagName === 'BUTTON' && false) continue;
      const r = el.getBoundingClientRect();
      const s = seguro || { left: 0, right: 0, bottom: 0, top: 0 };
      alvos.push({ el: nome(el), rotulo: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        noEntalhe: r.left < s.left - 0.5 || r.right > W - s.right + 0.5, naBarraHome: r.bottom > H - s.bottom + 0.5, foraDaTela: r.left < 0 || r.top < 0 || r.right > W || r.bottom > H });
    }
    return { W, H, textos, alvos };
  }, seguro);
}

export function pasta(p) { mkdirSync(p, { recursive: true }); return p; }
