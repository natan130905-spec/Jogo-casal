// Lugar dos balões na tela (T-U1, parte pura): com os retângulos dos controles e do HUD, nenhum balão cruza um
// obstáculo nem entra no terço de baixo, para âncoras no quadro inteiro e fora dele. O e2e (test/e2e/baloes.mjs)
// repete a conta com os retângulos medidos no navegador nos 4 tamanhos de tela.
import { describe, expect, it } from 'vitest';
import { FOLGA, LIMITE_BAIXO, MARGEM, aparece, posicionarBalao, type Ret } from '../src/ui/baloes';

const cruza = (a: Ret, b: Ret) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** controles e HUD aproximados do layout do estilo.css em 844×390 (o e2e usa os de verdade) */
function obstaculos(W: number, H: number): Ret[] {
  const joy = Math.min(0.36 * H, 170), bot = Math.min(0.52 * H, 250), rosto = Math.max(40, Math.min(0.13 * H, 62));
  const jl = 0.04 * W, jb = H - 0.06 * H, bl = W - 0.03 * W - bot, bb = H - 0.05 * H;
  return [
    { l: jl, t: jb - joy, r: jl + joy, b: jb },
    { l: bl + bot * 0.54, t: bb - bot / 1.1 * 0.46 * 1.1, r: bl + bot, b: bb },          // ⬆
    { l: bl, t: bb - bot * 0.38 - bot * 0.04, r: bl + bot * 0.38, b: bb - bot * 0.04 },   // ✨
    { l: bl + bot * 0.58, t: bb - bot / 1.1, r: bl + bot * 0.94, b: bb - bot / 1.1 + bot * 0.36 }, // ✋
    { l: 10, t: 6, r: 10 + rosto, b: 6 + rosto }, { l: 16 + rosto, t: 10, r: 16 + rosto + 70, b: 30 },
    { l: W - 10 - rosto, t: 6, r: W - 10, b: 6 + rosto }, { l: W - 16 - rosto - 70, t: 10, r: W - 16 - rosto, b: 30 },
    { l: W / 2 - 60, t: 6, r: W / 2 + 60, b: 34 },
  ];
}

describe('posicionarBalao', () => {
  for (const [W, H] of [[844, 390], [844, 340], [873, 393], [915, 412], [667, 375]]) {
    it(`${W}×${H}: nenhum balão cruza controles, rostos e corações nem entra no terço de baixo`, () => {
      const obs = obstaculos(W, H);
      let n = 0;
      for (const [w, h] of [[120, 30], [230, 50], [180, 50]]) {
        for (let ax = -200; ax <= W + 200; ax += 23) for (let ay = -150; ay <= H + 150; ay += 17) {
          const p = posicionarBalao(ax, ay, w, h, W, H, obs);
          expect(p, `${ax},${ay}`).not.toBeNull();
          const q = { l: p!.x, t: p!.y, r: p!.x + w, b: p!.y + h };
          for (const o of obs) expect(cruza(q, { l: o.l - FOLGA + 0.01, t: o.t - FOLGA + 0.01, r: o.r + FOLGA - 0.01, b: o.b + FOLGA - 0.01 }), `âncora ${ax},${ay} ${w}×${h}`).toBe(false);
          expect(q.b).toBeLessThanOrEqual(H * LIMITE_BAIXO + 1e-6);
          expect(q.l).toBeGreaterThanOrEqual(MARGEM - 1e-6);
          expect(q.r).toBeLessThanOrEqual(W - MARGEM + 1e-6);
          expect(q.t).toBeGreaterThanOrEqual(MARGEM - 1e-6);
          n++;
        }
      }
      expect(n).toBeGreaterThan(1000);
    });
  }

  it('sem obstáculo no caminho, a ponta fica logo acima da cabeça, centrada', () => {
    const p = posicionarBalao(400, 200, 120, 30, 844, 390, obstaculos(844, 390))!;
    expect(p.x).toBe(340);
    expect(p.y).toBe(200 - 30 - 10);
  });

  it('dois balões: o segundo desvia do primeiro', () => {
    const obs = obstaculos(844, 390);
    const a = posicionarBalao(400, 200, 160, 40, 844, 390, obs)!;
    const ra = { l: a.x, t: a.y, r: a.x + 160, b: a.y + 40 };
    const b = posicionarBalao(420, 205, 160, 40, 844, 390, [...obs, ra])!;
    expect(cruza(ra, { l: b.x, t: b.y, r: b.x + 160, b: b.y + 40 })).toBe(false);
  });

  it('R81: com outro balão logo acima, desvia para o lado em vez de descer sobre a plaquinha do nome', () => {
    const obs = obstaculos(844, 390);
    // balão da Dona Lume no alto, no meio; Natan com a cabeça logo abaixo dele (como na captura do e2e)
    const lume = { l: 310, t: 66, r: 535, b: 120 };
    const p = posicionarBalao(510, 150, 170, 34, 844, 390, [...obs, lume])!;
    expect(p.y + 34, 'a base do balão fica acima da ponta (não tapa o nome)').toBeLessThanOrEqual(150 - 10 + 1e-6);
    expect(cruza({ l: p.x, t: p.y, r: p.x + 170, b: p.y + 34 }, lume)).toBe(false);
  });

  it('opções: todos mostra tudo; só história mostra história e dicas; desligados não mostra nada', () => {
    expect(aparece('todos', 'ocioso')).toBe(true);
    expect(aparece('historia', 'historia')).toBe(true);
    expect(aparece('historia', 'dica')).toBe(true);
    expect(aparece('historia', 'reacao')).toBe(false);
    expect(aparece('historia', 'ocioso')).toBe(false);
    expect(aparece('desligados', 'historia')).toBe(false);
    expect(aparece('desligados', 'dica')).toBe(false);
  });
});

describe('T-P1 (parte estática): balões e dicas não tocam o WebGL', () => {
  it('nenhum módulo dos balões importa three nem src/render', () => {
    const fontes = import.meta.glob(['../src/ui/baloes.ts', '../src/ui/dicas.ts', '../src/ui/murmurio.ts', '../src/ui/roteiro/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(fontes).length).toBeGreaterThanOrEqual(7);
    for (const [arq, src] of Object.entries(fontes)) {
      const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const i of imports) expect(i, `${arq} importa ${i}`).not.toMatch(/^three|render\//);
    }
  });
});

describe('R82: o balão fica onde o jogo mediu, também durante a animação de entrada', () => {
  it('o lugar vai na propriedade `translate` (o `scale` da entrada vem antes do `transform` e encolheria o deslocamento)', () => {
    const fontes = import.meta.glob(['../src/ui/baloes.ts', '../src/ui/baloes.css'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const ts = fontes['../src/ui/baloes.ts'], css = fontes['../src/ui/baloes.css'];
    expect(ts).toMatch(/el\.style\.translate\s*=/);
    expect(ts).not.toMatch(/\bel\.style\.transform\s*=/);
    // se a entrada voltar a animar `transform`, o lugar (em `translate`) continua certo; animar `translate` quebraria
    expect(css).not.toMatch(/@keyframes balao-entra[^}]*\btranslate\b/);
  });
});
