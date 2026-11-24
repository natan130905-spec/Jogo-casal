// Balões de fala durante a fase (NARRATIVA_CASAL §4; PLANO L8a). Quem decide o que sai é o diretor
// (src/ui/roteiro/diretor.ts, puro); aqui só se desenha, em DOM (nenhuma chamada de desenho a mais no WebGL):
//   - um balão por personagem, acima da plaquinha do nome, projetado na tela a cada quadro; a Dona Lume fala do alto,
//     no meio da tela, logo abaixo do HUD;
//   - nunca no terço de baixo da tela (polegares) nem sobre os controles, os rostos e os corações (T-U1): procura o
//     ponto livre mais perto; com o personagem fora do quadro, encosta na borda com a setinha apontando para ele;
//   - murmúrio sintetizado ao abrir (src/ui/murmurio.ts);
//   - opção "Balões: todos / só história / desligados" na pausa (salva no aparelho; ?baloes= para medir). Com
//     balões desligados, as dicas vão para o #aviso (reserva do C16);
//   - na repetição da dica (20 s), o botão da mecânica pisca.
import type { Estado, Fase } from '../core/types';
import { Diretor, type Balao, type Falante } from './roteiro/diretor';
import { ROTEIROS } from './roteiro';
import type { Pool } from './roteiro/tipos';
import { murmurio } from './murmurio';
import { som } from './som';
import { $, tocavel } from './telas';
import './baloes.css';

export type OpcaoBaloes = 'todos' | 'historia' | 'desligados';
const OPCOES: OpcaoBaloes[] = ['todos', 'historia', 'desligados'];
const ROTULO: Record<OpcaoBaloes, string> = { todos: 'todos', historia: 'só história', desligados: 'desligados' };
const CHAVE = 'edm-baloes';

export function lerOpcao(): OpcaoBaloes {
  const url = new URLSearchParams(location.search).get('baloes') as OpcaoBaloes | null;
  if (url && OPCOES.includes(url)) return url;
  try { const v = localStorage.getItem(CHAVE) as OpcaoBaloes | null; if (v && OPCOES.includes(v)) return v; } catch { /* sem armazenamento */ }
  return 'todos';
}
function salvarOpcao(o: OpcaoBaloes) { try { localStorage.setItem(CHAVE, o); } catch { /* sem armazenamento */ } }

/** O que aparece em cada opção: "só história" ainda mostra as dicas (ensinar não é enfeite). */
export const aparece = (o: OpcaoBaloes, pool: Pool) => o === 'todos' || (o === 'historia' && (pool === 'historia' || pool === 'dica'));

export type Ret = { l: number; t: number; r: number; b: number };
const cruza = (a: Ret, b: Ret, f = 0) => a.l < b.r + f && a.r > b.l - f && a.t < b.b + f && a.b > b.t - f;

/** Seletores do que o balão nunca pode cobrir (controles, rostos e corações, botões do HUD). */
export const OBSTACULOS = ['#joystick', '#botoes button', '#hud-p1 .rosto', '#hud-p1 .coracoes', '#hud-p2 .rosto', '#hud-p2 .coracoes', '.hud-meio > .hud-linha'];
/** folga até os obstáculos (px) e margem das bordas (px) */
export const FOLGA = 6, MARGEM = 8;
/** o balão nunca entra no terço de baixo da tela */
export const LIMITE_BAIXO = 2 / 3;

/**
 * Lugar do balão (canto de cima à esquerda, px CSS) de tamanho w×h cuja ponta deve ficar em (ax, ay), na tela W×H,
 * fora dos obstáculos e do terço de baixo. Devolve null se não couber em lugar nenhum (tela minúscula).
 * Puro: testado em test/baloes.test.ts e medido no navegador em test/e2e/baloes.mjs.
 */
export function posicionarBalao(ax: number, ay: number, w: number, h: number, W: number, H: number, obs: readonly Ret[]): { x: number; y: number } | null {
  const l = MARGEM, r = W - MARGEM - w, t = MARGEM, b = H * LIMITE_BAIXO - h;
  if (r < l || b < t) return null;
  const lim = (x: number, y: number): [number, number] => [Math.min(r, Math.max(l, x)), Math.min(b, Math.max(t, y))];
  const ok = (x: number, y: number) => { const q = { l: x, t: y, r: x + w, b: y + h }; return obs.every((o) => !cruza(q, o, FOLGA)); };
  const [x0, y0] = lim(ax - w / 2, ay - h - 10);
  if (ok(x0, y0)) return { x: x0, y: y0 };
  const cand: [number, number][] = [[x0, t], [x0, b]];
  for (const o of obs) {
    const f = FOLGA + 0.5;
    cand.push([x0, o.b + f], [x0, o.t - f - h], [o.l - f - w, y0], [o.r + f, y0], [o.l - f - w, o.b + f], [o.r + f, o.b + f]);
  }
  let melhor: [number, number] | null = null, dm = Infinity;
  const tentar = (cx: number, cy: number) => {
    const [x, y] = lim(cx, cy);
    if (!ok(x, y)) return;
    // descer o balão para baixo da ponta tapa a plaquinha do nome e a cabeça: custa 8× (prefere ir para o lado)
    const d = Math.abs(x - x0) + 1.5 * Math.abs(y - y0) + 8 * Math.max(0, y + h - Math.max(ay - 10, y0 + h));
    if (d < dm) { dm = d; melhor = [x, y]; }
  };
  for (const [cx, cy] of cand) tentar(cx, cy);
  if (!melhor) for (let y = t; y <= b; y += 8) for (let x = l; x <= r; x += 16) tentar(x, y);
  const m = melhor as [number, number] | null;
  return m ? { x: m[0], y: m[1] } : null;
}

interface Projetor { projetar(x: number, y: number): { x: number; y: number } }

/** altura da ponta do balão acima dos pés (m): logo acima da plaquinha do nome (personagem.ts, ≈ 1,7 m) */
const ALTURA_PONTA = 1.85;
const NOMES = ['Natan', 'Bruna', 'Dona Lume'];

export class Baloes {
  readonly diretor: Diretor;
  private raiz: HTMLElement;
  private els: HTMLElement[] = [];
  private mostrando: (Balao | null)[] = [null, null, null];
  private tamanho: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  private obstaculos: Ret[] | null = null;
  private medidoEm = 0;
  private opcao = lerOpcao();
  private pisca: { el: HTMLElement; ate: number } | null = null;
  private avisoAte = 0;
  /** último lugar de cada balão (px CSS) e se estava na borda: para testes */
  readonly ultimo: ({ l: number; t: number; r: number; b: number; texto: string; borda: boolean } | null)[] = [null, null, null];
  private medirAgora = () => { this.obstaculos = null; };

  constructor(fase: Fase, cap: number) {
    this.diretor = new Diretor(fase, ROTEIROS[cap] ?? null);
    document.querySelector('#baloes')?.remove();
    this.raiz = document.createElement('div');
    this.raiz.id = 'baloes';
    this.raiz.setAttribute('aria-live', 'polite');
    for (let q = 0; q < 3; q++) {
      const el = document.createElement('div');
      el.className = `balao ${['p1', 'p2', 'lume'][q]}`;
      el.hidden = true;
      el.innerHTML = '<span class="texto"></span><i class="ponta"></i>';
      el.setAttribute('aria-label', NOMES[q]);
      this.raiz.appendChild(el);
      this.els.push(el);
    }
    $('#jogo').appendChild(this.raiz);
    addEventListener('resize', this.medirAgora);
    this.botaoOpcao();
  }

  /** "Balões: …" na pausa, logo depois do botão do som (criado uma vez). */
  private botaoOpcao() {
    let bt = document.querySelector<HTMLButtonElement>('#bt-baloes');
    if (!bt) {
      bt = document.createElement('button');
      bt.id = 'bt-baloes';
      bt.className = 'leve pequeno';
      $('#bt-som').insertAdjacentElement('afterend', bt);
      tocavel(bt);
    }
    bt.textContent = `Balões: ${ROTULO[this.opcao]}`;
    bt.onclick = () => {
      this.opcao = OPCOES[(OPCOES.indexOf(this.opcao) + 1) % OPCOES.length];
      salvarOpcao(this.opcao);
      bt!.textContent = `Balões: ${ROTULO[this.opcao]}`;
      for (let q = 0; q < 3; q++) if (this.mostrando[q] && !aparece(this.opcao, this.mostrando[q]!.pool)) this.fechar(q as Falante);
    };
  }

  private medirObstaculos(): Ret[] {
    const lista: Ret[] = [];
    for (const s of OBSTACULOS) {
      document.querySelectorAll<HTMLElement>(s).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden') lista.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      });
    }
    return lista;
  }

  private fechar(q: Falante) {
    this.mostrando[q] = null;
    this.els[q].hidden = true;
    this.ultimo[q] = null;
  }

  private abrir(b: Balao) {
    const q = b.quem, el = this.els[q];
    this.mostrando[q] = b;
    el.querySelector('.texto')!.textContent = b.texto;
    el.hidden = false;
    el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra');
    this.tamanho[q] = [el.offsetWidth, el.offsetHeight];
    const ctx = som.contexto();
    if (ctx) murmurio(ctx, q, b.texto);
  }

  /** Um quadro: o diretor anda com o estado mostrado e os eventos do quadro; o DOM segue. */
  atualizar(e: Estado, eventos: readonly string[], cena: Projetor, dt: number) {
    if (dt <= 0 && !eventos.length) return;
    const novos = this.diretor.passo(e, eventos);
    const agora = performance.now();
    for (const b of novos) {
      if (b.botao) this.piscar(b.botao, agora + 4000);
      if (aparece(this.opcao, b.pool)) this.abrir(b);
      else if (b.pool === 'dica' && this.opcao === 'desligados') this.aviso(b.texto, agora);
    }
    for (let q = 0; q < 3; q++) {
      const ativo = this.diretor.ativos[q];
      if (this.mostrando[q] && (!ativo || ativo.id !== this.mostrando[q]!.id || ativo.desde !== this.mostrando[q]!.desde)) this.fechar(q as Falante);
    }
    if (this.pisca && agora > this.pisca.ate) { this.pisca.el.classList.remove('dica-pisca'); this.pisca = null; }
    if (this.avisoAte && agora > this.avisoAte) { this.avisoAte = 0; $('#aviso').hidden = true; }
    if (!this.mostrando.some(Boolean)) return;
    // R82: o HUD muda de largura (★ 9 → ★ 30 empurra o ❚❚): remede a cada balão novo e a cada 0,5 s de relógio
    if (!this.obstaculos || novos.length || agora - this.medidoEm > 500) { this.obstaculos = this.medirObstaculos(); this.medidoEm = agora; }
    this.desenhar(e, cena);
  }

  private desenhar(e: Estado, cena: Projetor) {
    const W = innerWidth, H = innerHeight;
    const obs = [...(this.obstaculos ?? [])];
    // a Dona Lume primeiro (lugar fixo no alto), depois quem está mais alto na tela
    const ordem: Falante[] = [2, 0, 1];
    for (const q of ordem) {
      const b = this.mostrando[q];
      if (!b) continue;
      const [w, h] = this.tamanho[q];
      let ax: number, ay: number, fora = false;
      if (q === 2) {
        const hud = obs.reduce((m, o) => (o.t < H * 0.3 ? Math.max(m, o.b) : m), 0);
        ax = W / 2; ay = hud + FOLGA + h + 10 + 4;
      } else {
        const j = e.jogadores[q];
        const p = cena.projetar(j.x, j.y + ALTURA_PONTA);
        ax = (p.x + 1) / 2 * W; ay = (1 - p.y) / 2 * H;
        fora = ax < 0 || ax > W || ay < 0 || ay > H;
      }
      const lugar = posicionarBalao(ax, ay, w, h, W, H, obs);
      const el = this.els[q];
      if (!lugar) { el.style.visibility = 'hidden'; this.ultimo[q] = null; continue; }
      el.style.visibility = '';
      // propriedade `translate`, não `transform`: o `scale` da entrada (baloes.css) vem antes do `transform` e encolheria
      // o deslocamento junto, e o balão entraria 15 % mais perto do canto de cima à esquerda, por cima do ❚❚ (R82)
      el.style.translate = `${lugar.x.toFixed(1)}px ${lugar.y.toFixed(1)}px`;
      const rect = { l: lugar.x, t: lugar.y, r: lugar.x + w, b: lugar.y + h };
      obs.push(rect);
      // a ponta aponta para o personagem: embaixo quando ele está logo abaixo; senão gira na direção dele
      const cx = lugar.x + w / 2, cy = lugar.y + h / 2;
      const longe = q !== 2 && (fora || Math.abs(ax - cx) > w / 2 + 4 || ay < lugar.y + h - 2 || ay - (lugar.y + h) > 40);
      el.classList.toggle('borda', longe);
      const ponta = el.querySelector<HTMLElement>('.ponta')!;
      if (longe) {
        const ang = Math.atan2(ay - cy, ax - cx);
        const k = Math.min(Math.abs((w / 2) / (Math.cos(ang) || 1e-6)), Math.abs((h / 2) / (Math.sin(ang) || 1e-6)));
        ponta.style.transform = `translate(${(w / 2 + Math.cos(ang) * k).toFixed(1)}px, ${(h / 2 + Math.sin(ang) * k).toFixed(1)}px) rotate(${(ang - Math.PI / 2).toFixed(3)}rad)`;
      } else {
        const px = Math.min(w - 14, Math.max(14, ax - lugar.x));
        ponta.style.transform = `translate(${px.toFixed(1)}px, ${h}px)`;
      }
      this.ultimo[q] = { ...rect, texto: b.texto, borda: longe };
    }
  }

  private piscar(sel: string, ate: number) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return;
    this.pisca?.el.classList.remove('dica-pisca');
    el.classList.add('dica-pisca');
    this.pisca = { el, ate };
  }

  private aviso(texto: string, agora: number) {
    const el = $('#aviso');
    el.textContent = texto;
    el.hidden = false;
    this.avisoAte = agora + 4000;
  }

  /** gancho de teste: o que está na tela, o que já saiu e os obstáculos medidos */
  medidas() {
    return {
      opcao: this.opcao,
      ativos: this.ultimo.map((u, q) => (u ? { quem: q, ...u } : null)).filter(Boolean),
      log: this.diretor.log.map((b) => ({ id: b.id, quem: b.quem, desde: b.desde, ate: b.ate, pool: b.pool, texto: b.texto })),
      obstaculos: this.medirObstaculos(),
    };
  }

  /** gancho de teste (T-U1): mede o tamanho real de cada texto e posiciona com a âncora dada; devolve os retângulos */
  testarLugares(ancoras: { quem: Falante; texto: string; ax: number; ay: number }[]) {
    const obs = this.medirObstaculos();
    return ancoras.map((a) => {
      const el = this.els[a.quem];
      const antes = el.hidden, txt = el.querySelector('.texto')!.textContent;
      el.querySelector('.texto')!.textContent = a.texto; el.hidden = false;
      const w = el.offsetWidth, h = el.offsetHeight;
      el.querySelector('.texto')!.textContent = txt; el.hidden = antes;
      const p = posicionarBalao(a.ax, a.ay, w, h, innerWidth, innerHeight, obs);
      return p ? { l: p.x, t: p.y, r: p.x + w, b: p.y + h } : null;
    });
  }

  destruir() {
    removeEventListener('resize', this.medirAgora);
    this.pisca?.el.classList.remove('dica-pisca');
    if (this.avisoAte) $('#aviso').hidden = true;
    this.raiz.remove();
  }
}
