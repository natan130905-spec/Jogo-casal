// Telas em DOM: quadrinhos (prólogo, lembranças, final), mapa da jornada, capítulo concluído, HUD, pausa e conexão
// perdida. Só desenham; quem decide o que mostrar é o fluxo (src/main.ts), que no anfitrião também sincroniza o
// convidado pela rede.
import type { Estado } from '../core/types';
import { CAPITULOS_INFO, info, type Quadro } from './historia';
import { ESTRELA_SVG, ilustracao } from './ilustracoes';
import { concluido, estrelinhasTotais, liberado, pedacos, TOTAL_CAPITULOS, type Progresso } from './progresso';

export const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;

export type IdTela = 'menu' | 'sala' | 'quadrinhos' | 'mapa' | 'jogo' | 'concluido';
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
      b.querySelector('.selo')!.textContent = r ? `★ ${r.estrelinhas}${r.total ? `/${r.total}` : ''}` : livre ? 'novo!' : '🔒';
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
    $('#mapa-desc').textContent = livre ? (concluido(p, sel) ? c.lembranca : `Novidade: ${c.novidade}`) : 'Termine o capítulo anterior para liberar.';
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

// ---------- HUD ----------
export class Hud {
  private chave = '';
  private estrelinhas = -1;
  constructor() {
    for (const i of [0, 1]) $(`#cor-${i}`).innerHTML = '<i>❤</i><i>❤</i><i>❤</i>';
  }
  configurar(cap: number, eu: number) {
    $('#hud-cap').textContent = `Capítulo ${cap} · ${info(cap).nome}`;
    this.eu(eu);
    this.chave = ''; this.estrelinhas = -1;
  }
  eu(eu: number) {
    $('#hud-p1').classList.toggle('eu', eu === 0);
    $('#hud-p2').classList.toggle('eu', eu === 1);
  }
  atualizar(e: Estado, eventos: readonly string[]) {
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

