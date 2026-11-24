// Telas em DOM: quadrinhos (prólogo, lembranças, final), mapa da jornada, capítulo concluído, HUD, pausa e conexão
// perdida. Só desenham; quem decide o que mostrar é o fluxo (src/main.ts), que no anfitrião também sincroniza o
// convidado pela rede.
import type { Estado } from '../core/types';
import { CAPITULOS_INFO, info, type Quadro } from './historia';
import { ESTRELA_SVG, ilustracao } from './ilustracoes';
import { concluido, estrelinhasTotais, liberado, pedacos, TOTAL_CAPITULOS, type Progresso } from './progresso';
import { HudArmas } from './hudArmas';

export const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;

export type IdTela = 'menu' | 'sala' | 'quadrinhos' | 'mapa' | 'jogo' | 'concluido' | 'creditos';
export function mostrarTela(id: IdTela) {
  for (const el of document.querySelectorAll<HTMLElement>('.tela')) el.hidden = el.id !== id;
  document.body.classList.toggle('jogando', id === 'jogo');
}

// ---------- quadrinhos ----------
export class Quadrinhos {
  private chave = '';
  constructor(aoTocar: () => void, aoPular: () => void) {
    $('#quadrinhos').addEventListener('click', (ev) => { if ((ev.target as HTMLElement).closest('#bt-pular')) return; aoTocar(); });
    $('#bt-pular').addEventListener('click', (ev) => { ev.stopPropagation(); aoPular(); });
  }
  /** Mostra o quadro i. `controla`: pode avançar (no convidado, o toque vira pedido ao anfitrião). */
  mostrar(quadros: readonly Quadro[], i: number, ultimoTexto = 'Toque para continuar') {
    const q = quadros[Math.max(0, Math.min(quadros.length - 1, i))];
    const chave = `${q.texto}|${i}`;
    mostrarTela('quadrinhos');
    if (chave === this.chave) return;
    this.chave = chave;
    const painel = $('#qd-painel');
    painel.classList.add('troca'); void painel.offsetWidth; painel.classList.remove('troca');
    const arte = $('#qd-arte');
    arte.innerHTML = ilustracao(q.ilustracao);
    if (q.arte) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onload = () => img.classList.add('pronta');
      img.onerror = () => img.remove(); // sem a arte, fica a ilustração em SVG
      img.src = q.arte;
      arte.appendChild(img);
    }
    // adianta a próxima arte
    const prox = quadros[i + 1]?.arte;
    if (prox) { const p = new Image(); p.src = prox; }
    const texto = $('#qd-texto');
    texto.textContent = q.texto;
    texto.classList.toggle('fala', !!q.fala);
    $('#qd-pontos').innerHTML = quadros.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
    $('#qd-dica').textContent = i >= quadros.length - 1 ? ultimoTexto : 'Toque para continuar';
  }
  esquecer() { this.chave = ''; }
}

// ---------- mapa da jornada ----------
const POS: readonly [number, number][] = [[8, 64], [21, 38], [34, 64], [47, 37], [60, 63], [73, 37], [86, 60]];
const POS_ESTRELA: [number, number] = [96, 26];

export interface OpcoesMapa { livre: boolean; controla: boolean }

export class Mapa {
  aoSelecionar: (n: number) => void = () => {};
  aoJogar: (n: number) => void = () => {};
  /** capítulo 7: ir direto à Arena do Coração (quando a parte 2.5D já foi feita, ou no treino) */
  aoArena: () => void = () => {};
  private ilhas: HTMLButtonElement[] = [];
  private trilhas: SVGPathElement[] = [];
  private estrela!: HTMLElement;
  private sel = 1;

  constructor() {
    const caixa = $('#mapa-caixa');
    const pts = [...POS, POS_ESTRELA].map(([x, y]) => [x * 2.3, y] as const);
    let svg = '<svg viewBox="0 0 230 100" aria-hidden="true">';
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const cx = (x0 + x1) / 2, cy = Math.max(y0, y1) + 10;
      svg += `<path class="trilha" d="M${x0} ${y0 + 8}Q${cx} ${cy} ${x1} ${y1 + 8}"/>`;
    }
    caixa.innerHTML = svg + '</svg>';
    this.trilhas = [...caixa.querySelectorAll<SVGPathElement>('.trilha')];
    for (const c of CAPITULOS_INFO) {
      const b = document.createElement('button');
      b.className = 'ilha';
      b.dataset.cap = String(c.n);
      b.style.left = `${POS[c.n - 1][0]}%`; b.style.top = `${POS[c.n - 1][1]}%`;
      b.style.setProperty('--cor', c.cor);
      b.style.animationDelay = `${-c.n * 0.6}s`;
      b.setAttribute('aria-label', `Capítulo ${c.n}: ${c.nome}`);
      b.innerHTML = `<span class="rocha"></span><span class="topo" style="background-image:url('${c.arte}')"></span><span class="num">${c.n}</span><span class="selo"></span>`;
      b.addEventListener('click', () => this.aoSelecionar(c.n));
      caixa.appendChild(b);
      this.ilhas.push(b);
    }
    this.estrela = document.createElement('div');
    this.estrela.className = 'mapa-estrela';
    this.estrela.style.left = `${POS_ESTRELA[0]}%`; this.estrela.style.top = `${POS_ESTRELA[1]}%`;
    caixa.appendChild(this.estrela);
    $('#bt-jogar').addEventListener('click', () => this.aoJogar(this.sel));
    $('#bt-arena').addEventListener('click', () => this.aoArena());
  }

  mostrar(p: Progresso, sel: number, o: OpcoesMapa) {
    mostrarTela('mapa');
    this.sel = sel;
    for (const b of this.ilhas) {
      const n = Number(b.dataset.cap);
      const r = p.capitulos[n];
      const livre = o.livre || liberado(p, n);
      b.classList.toggle('feita', concluido(p, n));
      b.classList.toggle('bloqueada', !livre);
      b.classList.toggle('sel', n === sel);
      b.disabled = !o.controla;
      b.querySelector('.selo')!.textContent = r ? `★ ${r.estrelinhas}${r.total ? `/${r.total}` : ''}`
        : n === 7 && p.arena7 ? '⚔ arena' : livre ? 'novo!' : '🔒';
    }
    this.trilhas.forEach((t, k) => t.classList.toggle('feita', concluido(p, k + 1)));
    // a estrela do fim: uma ponta acesa por pedaço recuperado
    const n = pedacos(p);
    let pontas = '';
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7;
      const pt = (d: number, da: number) => `${(20 + Math.cos(a + da) * d).toFixed(1)},${(20 + Math.sin(a + da) * d).toFixed(1)}`;
      pontas += `<polygon points="${pt(19, 0)} ${pt(7, 0.45)} ${pt(7, -0.45)}" fill="${k < n ? '#ffe08a' : '#ffffff22'}"/>`;
    }
    this.estrela.innerHTML = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="7" fill="${n >= 7 ? '#fff6c8' : '#ffffff30'}"/>${pontas}</svg>`;
    $('#mapa-pedacos').textContent = `Pedaços ${n}/${TOTAL_CAPITULOS}`;
    $('#mapa-estrelinhas').textContent = `★ ${estrelinhasTotais(p)}`;
    const c = info(sel);
    const livre = o.livre || liberado(p, sel);
    $('#mapa-nome').textContent = `${sel}. ${c.nome}`;
    $('#mapa-desc').textContent = !livre ? 'Termine o capítulo anterior para liberar.'
      : concluido(p, sel) ? c.lembranca
      : sel === 7 && p.arena7 ? 'Falta a Arena do Coração: vençam o Rei-Pesadelo para recuperar o último pedaço!'
      : `Novidade: ${c.novidade}`;
    const ba = $<HTMLButtonElement>('#bt-arena');
    ba.hidden = !o.controla || sel !== 7 || !(o.livre || p.arena7 || concluido(p, 7));
    const bj = $<HTMLButtonElement>('#bt-jogar');
    bj.hidden = !o.controla;
    bj.disabled = !livre;
    bj.textContent = concluido(p, sel) ? 'Jogar de novo ▶' : 'Jogar ▶';
    $('#mapa-espera').hidden = o.controla;
  }
}

// ---------- capítulo concluído ----------
export function mostrarConcluido(cap: number, est: number, total: number, frase: string, controla: boolean) {
  mostrarTela('concluido');
  $('#conc-estrela').innerHTML = ESTRELA_SVG;
  $('#conc-cap').textContent = `Capítulo ${cap} · ${info(cap).nome}`;
  const cheias = total > 0 ? Math.round((Math.min(est, total) / total) * 3) : 3;
  $('#conc-estrelinhas').innerHTML = `${'★'.repeat(cheias)}<span style="opacity:.3">${'★'.repeat(3 - cheias)}</span>` +
    `<small>${est} estrelinha${est === 1 ? '' : 's'} de lembrança${total ? ` de ${total}` : ''} · pedaço ${cap} da estrela recuperado</small>`;
  $('#conc-frase').textContent = frase;
  $('#bt-conc-continuar').hidden = !controla;
  $('#conc-espera').hidden = controla;
}

// ---------- créditos ----------
export function mostrarCreditos(controla: boolean) {
  mostrarTela('creditos');
  $('#creditos-estrela').innerHTML = ESTRELA_SVG;
  $('#creditos-caps').innerHTML = CAPITULOS_INFO.map((c) => `${c.n}. ${c.nome}`).join('<br>');
  // recomeça a rolagem a cada vez
  const rolo = $('#creditos-rolo');
  rolo.style.animation = 'none'; void rolo.offsetWidth; rolo.style.animation = '';
  $('#creditos-dica').textContent = controla ? 'Toque para voltar ao mapa' : 'Esperando quem criou a sala…';
}

// ---------- HUD ----------
export class Hud {
  private chave = '';
  private estrelinhas = -1;
  /** armas (L4): chips, ícone do ATACAR e anel do ⇆ (src/ui/hudArmas.ts) */
  private armas = new HudArmas();
  private euI = 0;
  constructor() {
    for (const i of [0, 1]) $(`#cor-${i}`).innerHTML = '<i>❤</i><i>❤</i><i>❤</i>';
  }
  private some: ReturnType<typeof setTimeout> | null = null;
  configurar(cap: number, eu: number) {
    $('#hud-cap').textContent = `Capítulo ${cap} · ${info(cap).nome}`;
    // o nome do capítulo aparece ao entrar e some depois de 3 s (ficava em cima das estrelinhas altas; R34)
    const el = $('#hud-cap');
    el.classList.remove('some');
    if (this.some) clearTimeout(this.some);
    this.some = setTimeout(() => el.classList.add('some'), 3000);
    $('#hud-info').textContent = '';
    this.eu(eu);
    this.chave = ''; this.estrelinhas = -1;
  }
  eu(eu: number) {
    this.euI = eu;
    $('#hud-p1').classList.toggle('eu', eu === 0);
    $('#hud-p2').classList.toggle('eu', eu === 1);
  }
  atualizar(e: Estado, eventos: readonly string[]) {
    this.armas.atualizar(e, this.euI);
    const chave = e.jogadores.map((j) => `${j.coracoes}${j.bolha ? 'b' : ''}`).join('|');
    if (chave !== this.chave) {
      this.chave = chave;
      e.jogadores.forEach((j, i) => {
        const cs = $(`#cor-${i}`).children;
        for (let k = 0; k < cs.length; k++) cs[k].classList.toggle('vazio', k >= j.coracoes);
        $(`#hud-p${i + 1}`).classList.toggle('bolha', j.bolha);
      });
    }
    if (e.estrelinhasCasal !== this.estrelinhas) {
      const el = $('#hud-estrelinhas');
      if (this.estrelinhas >= 0) { el.classList.remove('ganhou'); void el.offsetWidth; el.classList.add('ganhou'); }
      this.estrelinhas = e.estrelinhasCasal;
      el.textContent = `★ ${e.estrelinhasCasal}`;
    }
    for (const ev of eventos) {
      if (!ev.startsWith('dano:')) continue;
      const el = $(`#hud-p${Number(ev.slice(5)) + 1}`);
      el.classList.remove('dano'); void el.offsetWidth; el.classList.add('dano');
    }
  }
}

// ---------- sobrepostas ----------
export function mostrarPausa(on: boolean, quem = '') {
  $('#pausa').hidden = !on;
  $('#pausa-quem').textContent = quem;
}
export function mostrarCaiu(on: boolean, motivo = '', tentando = false) {
  $('#caiu').hidden = !on;
  $('#caiu-motivo').textContent = motivo;
  const b = $<HTMLButtonElement>('#bt-tentar');
  b.disabled = tentando;
  b.textContent = tentando ? 'Tentando…' : 'Tentar de novo';
}


// ---------- toque nos botões (R27) ----------
/**
 * Faz o botão responder ao toque mesmo com outro dedo na tela (o polegar no joystick). O navegador não gera `click`
 * quando há mais de um dedo encostado; por isso o botão dispara no `pointerup` dentro dele (ou no `pointerdown`, com
 * `aoBaixar`) e chama `el.click()`, que aciona os ouvintes normais (onclick/addEventListener). O `click` natural que
 * vem logo depois de um toque com um dedo só é descartado (senão o botão agiria duas vezes). Teclado (Enter/Espaço)
 * e `el.click()` de teste continuam valendo.
 */
export function tocavel(el: HTMLElement, o: { aoBaixar?: boolean } = {}) {
  let dedo = -1, deixar = false, ultimo = -1e9;
  const disparar = () => {
    if ((el as HTMLButtonElement).disabled || el.hidden) return;
    ultimo = performance.now();
    deixar = true;
    try { el.click(); } finally { deixar = false; }
  };
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    dedo = ev.pointerId;
    try { el.setPointerCapture(ev.pointerId); } catch { /* sem captura */ }
    if (o.aoBaixar) { ev.preventDefault(); disparar(); }
  });
  el.addEventListener('pointerup', (ev) => {
    if (ev.pointerId !== dedo) return;
    dedo = -1;
    if (o.aoBaixar) return;
    const r = el.getBoundingClientRect(), folga = 10;
    if (ev.clientX >= r.left - folga && ev.clientX <= r.right + folga && ev.clientY >= r.top - folga && ev.clientY <= r.bottom + folga) disparar();
  });
  el.addEventListener('pointercancel', (ev) => { if (ev.pointerId === dedo) dedo = -1; });
  // toque: sem o 'click' de compatibilidade depois do nosso (ele cairia no que estiver embaixo do dedo na tela NOVA,
  // por exemplo uma ilha do mapa depois de "Mapa da jornada")
  el.addEventListener('touchend', (ev) => { if (performance.now() - ultimo < 700 && ev.cancelable) ev.preventDefault(); }, { passive: false });
  // fase de captura no próprio alvo: roda antes do onclick e dos outros ouvintes de 'click'
  el.addEventListener('click', (ev) => {
    if (deixar) return;
    if (performance.now() - ultimo < 700) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
}

// ---------- confirmação das saídas (R28) ----------
/**
 * Saída destrutiva com segundo toque: o 1º toque troca o texto do botão pelo aviso (`pergunta`) e o deixa em destaque
 * por 3 s; só um 2º toque nesse tempo executa `fazer`. Devolve uma função que cancela o pedido (ao fechar a tela).
 */
export function comConfirmacao(el: HTMLElement, pergunta: string | (() => string), fazer: () => void) {
  // o estado é a hora do 1º toque (não um timer): com quadros longos o timer atrasa, e o pedido valeria mais ou menos
  let armadoEm = -1e9, original = '', timer: ReturnType<typeof setTimeout> | null = null;
  const restaurar = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (el.classList.contains('confirmar')) { el.textContent = original; el.classList.remove('confirmar'); }
  };
  el.addEventListener('click', () => {
    const agora = performance.now();
    if (agora - armadoEm < 3000) { armadoEm = -1e9; restaurar(); fazer(); return; }
    restaurar();
    armadoEm = agora;
    original = el.textContent ?? '';
    el.textContent = typeof pergunta === 'function' ? pergunta() : pergunta; el.classList.add('confirmar');
    timer = setTimeout(() => { armadoEm = -1e9; restaurar(); }, 3000);
  });
  return () => { armadoEm = -1e9; restaurar(); };
}

// ---------- tela de carregamento da fase (R33) ----------
/** Resolve depois que o navegador pintou um quadro (dois rAF: o 1º roda antes da pintura, o 2º depois dela). */
export function quadroPintado(): Promise<void> {
  return new Promise((r) => {
    if (document.hidden) { setTimeout(r, 0); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
}

export interface Carga {
  /** performance.now() do toque em Jogar (criação da partida), da tela pintada e da fase pronta */
  inicio: number; pintada: number; pronta: number;
  progresso(f: number, etapa: string): void;
  terminar(): void;
  esconder(): void;
  resumo(): { pintadaMs: number; prontaMs: number; etapas: Record<string, number> };
}

const ETAPAS: Record<string, string> = {
  luz: 'Acendendo o céu…', 'cenário': 'Montando o mundo…', 'peças': 'Arrumando as peças…', personagens: 'Chamando o Natan e a Bruna…',
  bichinhos: 'Acordando os bichinhos…', shaders: 'Preparando as cores…', pronto: 'Pronto!',
};

/** Mostra a tela de carregamento do capítulo `cap` (título, barra e etapa) e devolve o controle dela. */
export function mostrarCarregando(cap: number): Carga {
  const el = $('#carregando');
  const c = info(cap);
  $('#carr-cap').textContent = `Capítulo ${cap}`;
  $('#carr-nome').textContent = c.nome;
  $('#carr-arte').style.backgroundImage = `url('${c.arte}')`;
  const barra = $('#carr-barra');
  barra.style.width = '4%';
  $('#carr-etapa').textContent = 'Abrindo o caminho…';
  el.hidden = false;
  const etapas: Record<string, number> = {};
  let ultima = '', tEtapa = performance.now();
  const carga: Carga = {
    inicio: performance.now(), pintada: 0, pronta: 0,
    progresso(f, etapa) {
      const t = performance.now();
      if (ultima) etapas[ultima] = Math.round(t - tEtapa);
      ultima = etapa; tEtapa = t;
      barra.style.width = `${Math.round(4 + f * 96)}%`;
      $('#carr-etapa').textContent = ETAPAS[etapa] ?? '';
    },
    terminar() {
      carga.pronta = performance.now();
      if (ultima) etapas[ultima] = Math.round(carga.pronta - tEtapa);
      ultima = '';
      el.hidden = true;
    },
    esconder() { el.hidden = true; },
    resumo: () => ({ pintadaMs: Math.round(carga.pintada - carga.inicio), prontaMs: carga.pronta ? Math.round(carga.pronta - carga.inicio) : -1, etapas: { ...etapas } }),
  };
  return carga;
}
