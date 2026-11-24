// Ilustrações dos quadrinhos desenhadas em SVG (sem arquivos): céu, morro, o casal em silhueta fofa, a estrela e
// seus pedaços, a névoa com bichinhos emburrados, a vovó-coruja. Servem sozinhas (quadros sem arte pintada) e por
// baixo da arte pintada enquanto ela carrega. Animações leves em CSS (classes .pisca, .flutua, .risca).

export type Ilustracao =
  | 'morro' | 'cadente' | 'pedacos' | 'nevoa' | 'coruja' | 'sete'
  | 'lembranca' | 'pedaco' | 'estrela-inteira' | 'vagalume' | 'amanhecer' | 'fim';

/** estrela de 5 pontas */
export function estrela5(cx: number, cy: number, r: number, cor = '#ffe9a0', extra = ''): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${cor}" stroke-linejoin="round" ${extra}/>`;
}

/** brilho de 4 pontas (a estrela do pedido) */
function brilho(cx: number, cy: number, r: number, cor = '#fff6c8', cls = 'pisca') {
  const f = r * 0.18;
  return `<g class="${cls}" style="transform-origin:${cx}px ${cy}px"><circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="url(#halo)"/>` +
    `<path d="M${cx} ${cy - r}Q${cx + f} ${cy - f} ${cx + r} ${cy}Q${cx + f} ${cy + f} ${cx} ${cy + r}Q${cx - f} ${cy + f} ${cx - r} ${cy}Q${cx - f} ${cy - f} ${cx} ${cy - r}Z" fill="${cor}"/></g>`;
}

function pontinhos(n: number, semente: number, y1 = 60) {
  let s = semente, o = '';
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const x = rnd() * 160, y = rnd() * y1, r = 0.25 + rnd() * 0.6;
    o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" class="${i % 3 ? '' : 'pisca'}" style="animation-delay:${(rnd() * 3).toFixed(2)}s;transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px"/>`;
  }
  return o;
}

const DEFS = `<defs>
<linearGradient id="noite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1145"/><stop offset=".6" stop-color="#4a2c86"/><stop offset="1" stop-color="#c06aa8"/></linearGradient>
<linearGradient id="manha" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c8fe0"/><stop offset=".55" stop-color="#f7b3c9"/><stop offset="1" stop-color="#ffe0a3"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset=".4" stop-color="#ffd36b" stop-opacity=".35"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient>
<radialGradient id="roxo"><stop offset="0" stop-color="#b48cff" stop-opacity=".75"/><stop offset="1" stop-color="#6a3fb8" stop-opacity="0"/></radialGradient>
</defs>`;

/** O casal sentado/de pé, de costas ou de frente, em estilo chibi simples. */
function casal(x: number, y: number, e = 1, sentados = true) {
  const corpo = sentados ? 9 : 13;
  const p = (dx: number, cabelo: string, roupa: string, extra: string) =>
    `<g transform="translate(${x + dx * e} ${y}) scale(${e})">` +
    `<rect x="-4.5" y="${-corpo}" width="9" height="${corpo}" rx="4" fill="${roupa}"/>` +
    `<circle cx="0" cy="${-corpo - 5}" r="6" fill="#f3c7a2"/>` +
    `<path d="M-6.2 ${-corpo - 5}a6.2 6.2 0 0 1 12.4 0q-3 -2 -6.2 -1.4q-3.2 -.6 -6.2 1.4z" fill="${cabelo}"/>${extra}</g>`;
  const natan = p(-5.5, '#5b3420', '#7a5236',
    `<path d="M-4.6 ${-corpo + 1}h9.2l-1 2.6h-7.2z" fill="#d8323c"/><path d="M-5 ${-corpo - 8.5}h10" stroke="#8fd3ff" stroke-width="2" stroke-linecap="round"/>`);
  const bruna = p(5.5, '#3a2030', '#7d4fc2',
    `<circle cx="-5" cy="${-corpo - 10}" r="2.6" fill="#3a2030"/><circle cx="5" cy="${-corpo - 10}" r="2.6" fill="#3a2030"/><circle cx="5.5" cy="${-corpo - 12}" r="1.1" fill="#ff8fb8"/>`);
  return natan + bruna + `<circle cx="${x}" cy="${y - corpo * 0.45}" r="1.6" fill="#f3c7a2"/>`; // mãos dadas
}

function bichinho(x: number, y: number, r: number, cor = '#7b4bb8') {
  return `<g class="flutua" style="animation-delay:${(x % 7) / 5}s"><ellipse cx="${x}" cy="${y}" rx="${r * 1.1}" ry="${r}" fill="${cor}"/>` +
    `<path d="M${x - r * 0.55} ${y - r * 0.3}l${r * 0.35} ${r * 0.15}M${x + r * 0.55} ${y - r * 0.3}l${-r * 0.35} ${r * 0.15}" stroke="#2a1640" stroke-width="${r * 0.12}" stroke-linecap="round"/>` +
    `<circle cx="${x - r * 0.35}" cy="${y}" r="${r * 0.14}" fill="#ff4d6d"/><circle cx="${x + r * 0.35}" cy="${y}" r="${r * 0.14}" fill="#ff4d6d"/>` +
    `<path d="M${x - r * 0.25} ${y + r * 0.45}q${r * 0.25} ${-r * 0.2} ${r * 0.5} 0" stroke="#2a1640" stroke-width="${r * 0.1}" fill="none" stroke-linecap="round"/></g>`;
}

const morro = (cor = '#2c1c55', cor2 = '#3f2a72') =>
  `<path d="M0 74Q40 58 80 66T160 62V90H0Z" fill="${cor2}"/><path d="M0 80Q50 66 95 74T160 72V90H0Z" fill="${cor}"/>`;

/** pedaço de estrela (triângulo-ponta) */
const ponta = (cx: number, cy: number, r: number, ang: number, cor = '#ffe9a0') => {
  const a = (ang * Math.PI) / 180;
  const p = (d: number, da: number) => `${(cx + Math.cos(a + da) * d).toFixed(1)},${(cy + Math.sin(a + da) * d).toFixed(1)}`;
  return `<polygon points="${p(r, 0)} ${p(r * 0.4, 0.75)} ${p(r * 0.4, -0.75)}" fill="${cor}"/>`;
};

const CENAS: Record<Ilustracao, () => string> = {
  morro: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(60, 3)}<circle cx="128" cy="18" r="7" fill="#fff4d6" opacity=".9"/>${morro()}${casal(70, 72, 1.1, false)}`,
  cadente: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(70, 11)}` +
    `<g class="risca"><path d="M30 8L96 34" stroke="url(#halo)" stroke-width="5" stroke-linecap="round"/>${brilho(98, 35, 7)}</g>${morro()}${casal(80, 76, 1)}`,
  pedacos: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(50, 17)}${brilho(80, 34, 10)}` +
    [0, 1, 2, 3, 4, 5, 6].map((k) => `<g class="flutua" style="animation-delay:${k * 0.3}s">${ponta(80 + Math.cos(k * 0.9) * 40, 34 + Math.sin(k * 0.9) * 22, 6, k * 51)}</g>`).join('') +
    `${morro()}${casal(80, 80, 0.8)}`,
  nevoa: () => `<rect width="160" height="90" fill="#2a1a52"/>${pontinhos(30, 23)}<ellipse cx="40" cy="60" rx="70" ry="30" fill="url(#roxo)"/><ellipse cx="130" cy="50" rx="60" ry="28" fill="url(#roxo)"/>` +
    `${morro('#24164a', '#33205f')}${bichinho(30, 64, 7)}${bichinho(132, 60, 8, '#8a54c8')}${bichinho(108, 30, 5, '#6a3fb8')}${casal(80, 76, 1, false)}`,
  coruja: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(40, 29)}${morro()}` +
    `<g transform="translate(80 44)"><ellipse rx="17" ry="20" fill="#b58a63"/><ellipse cy="4" rx="11" ry="13" fill="#f0d9b5"/>` +
    `<circle cx="-7" cy="-8" r="6.5" fill="#fff"/><circle cx="7" cy="-8" r="6.5" fill="#fff"/><circle cx="-7" cy="-8" r="2.6" fill="#3a2410"/><circle cx="7" cy="-8" r="2.6" fill="#3a2410"/>` +
    `<circle cx="-7" cy="-8" r="8" fill="none" stroke="#e8b04a" stroke-width="1.2"/><circle cx="7" cy="-8" r="8" fill="none" stroke="#e8b04a" stroke-width="1.2"/>` +
    `<path d="M-2 -3l2 4l2 -4z" fill="#e8a33a"/><path d="M-16 -20l5 6M16 -20l-5 6" stroke="#b58a63" stroke-width="3" stroke-linecap="round"/></g>` +
    `${brilho(48, 50, 6)}<path d="M108 40q8 10 2 22" stroke="#e0323c" stroke-width="1.6" fill="none" stroke-linecap="round" class="flutua"/>`,
  sete: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(80, 31, 90)}` +
    [0, 1, 2, 3, 4, 5, 6].map((k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7, x = 80 + Math.cos(a) * 30, y = 45 + Math.sin(a) * 30;
      return `<g class="pisca" style="animation-delay:${k * 0.25}s;transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="url(#halo)"/>${ponta(x, y, 10, (a * 180) / Math.PI)}</g>`;
    }).join('') + `<path d="M58 45q22 -14 44 0" stroke="#e0323c" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/>`,
  lembranca: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(40, 37)}<circle cx="80" cy="42" r="30" fill="url(#halo)"/>${casal(80, 64, 1.3, false)}`,
  pedaco: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(60, 41, 90)}${brilho(80, 40, 18)}`,
  'estrela-inteira': () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(90, 43, 90)}<circle cx="80" cy="40" r="40" fill="url(#halo)"/>` +
    `<g class="gira" style="transform-origin:80px 40px">${estrela5(80, 40, 20, '#fff1a8')}</g>${morro()}`,
  vagalume: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(50, 47)}${morro()}${casal(80, 78, 1.3, false)}` +
    `<g class="flutua"><circle cx="92" cy="50" r="7" fill="url(#halo)"/><circle cx="92" cy="50" r="1.8" fill="#fffbd0"/></g>`,
  amanhecer: () => `<rect width="160" height="90" fill="url(#manha)"/><circle cx="80" cy="76" r="22" fill="#ffe9a8" opacity=".8"/>` +
    `${brilho(122, 16, 4)}${morro('#5d7a4a', '#7c9a5c')}${casal(80, 80, 1.1)}`,
  fim: () => `<rect width="160" height="90" fill="url(#noite)"/>${pontinhos(90, 53, 90)}${brilho(80, 38, 12)}`,
};

export function ilustracao(qual: Ilustracao): string {
  return `<svg class="ilustra" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${DEFS}${CENAS[qual]()}</svg>`;
}

/** Ícone da estrela do jogo (menu, mapa e HUD). */
export const ESTRELA_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">${estrela5(20, 21, 17, '#ffe08a', 'stroke="#fff6c8" stroke-width="1.5"')}</svg>`;
