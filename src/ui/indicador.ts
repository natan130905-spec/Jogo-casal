// Indicador do parceiro na borda da tela (docs/revisao/PESQUISA_ARTE_CAMERA.md §6.3): com a câmera seguindo o próprio
// personagem, quando o outro sai do quadro aparece o rosto dele preso à borda do lado em que ele está, com uma seta e a
// distância em metros. Estados: "ajuda" (pulsa vermelho: virou bolha, está pendurado no fio ou acabou de levar dano) e
// "espera" (ícone de placa: segurando o fio ou parado numa placa — "preciso de você"). Fica longe dos botões, do
// joystick e do HUD (≥ 12 px), recalculando os retângulos deles quando a tela muda de tamanho.
import type { Estado, EstadoJogador, Fase } from '../core/types';

const ROSTO = ['./arte/14_rosto_natan.webp', './arte/15_rosto_bruna.webp'];
const NOME = ['Natan', 'Bruna'];
/** raio do círculo (px) e folga mínima até controles/HUD (px) */
const RAIO = 22, FOLGA = 12, BORDA = 8;
/** segundos pulsando depois de o parceiro levar dano */
const DANO_S = 2;

interface Projetor { projetar(x: number, y: number): { x: number; y: number } }
type Ret = { l: number; t: number; r: number; b: number };

export class IndicadorParceiro {
  private eu = -1;
  private obstaculos: Ret[] | null = null;
  private dano = 0;
  private img: HTMLImageElement;
  private dist: HTMLElement;
  private seta: HTMLElement;
  /** última posição (px CSS, centro) e estado, para testes */
  ultimo: { visivel: boolean; x: number; y: number; estado: string } = { visivel: false, x: 0, y: 0, estado: '' };

  constructor(private el: HTMLElement, private fase: Fase, private seletores = ['#joystick', '#botoes button', '#hud-p1 .rosto', '#hud-p2 .rosto', '.hud-meio > *']) {
    this.img = el.querySelector('img')!;
    this.dist = el.querySelector('.dist')!;
    this.seta = el.querySelector('.seta')!;
    el.hidden = true;
  }

  /** O "eu" deste aparelho (o parceiro é o outro). */
  configurar(eu: number) {
    if (eu === this.eu) return;
    this.eu = eu;
    this.img.src = ROSTO[1 - eu];
    this.img.alt = NOME[1 - eu];
    this.el.classList.toggle('p1', eu === 1);
    this.el.classList.toggle('p2', eu === 0);
  }

  /** Controles e HUD mudaram de lugar (redimensionar, girar o celular). */
  recalcular() { this.obstaculos = null; }

  private medirObstaculos(): Ret[] {
    const lista: Ret[] = [];
    for (const s of this.seletores) {
      document.querySelectorAll<HTMLElement>(s).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden') lista.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      });
    }
    return lista;
  }

  private estado(o: EstadoJogador, e: Estado): string {
    if (o.bolha || o.pendurado || this.dano > 0) return 'ajuda';
    const naPlaca = o.noChao && this.fase.placas.some((p) => e.placasPressionadas[p.id] && o.x >= p.x - 0.3 && o.x <= p.x + p.w + 0.3 && Math.abs(o.y - p.y) < 0.6);
    if (o.segurando || naPlaca) return 'espera';
    return '';
  }

  atualizar(e: Estado, eventos: readonly string[], cena: Projetor, dt: number) {
    const eu = this.eu, o = e.jogadores[1 - eu], me = e.jogadores[eu];
    for (const ev of eventos) if (ev === `dano:${1 - eu}`) this.dano = DANO_S;
    this.dano = Math.max(0, this.dano - dt);
    const W = innerWidth, H = innerHeight;
    // centro do corpo do parceiro e do meu, em px CSS
    const po = cena.projetar(o.x, o.y + 0.55), pm = cena.projetar(me.x, me.y + 0.55);
    const ox = (po.x + 1) / 2 * W, oy = (1 - po.y) / 2 * H;
    const dentro = ox > 0 && ox < W && oy > 0 && oy < H;
    if (dentro) {
      if (!this.el.hidden) this.el.hidden = true;
      this.ultimo = { visivel: false, x: ox, y: oy, estado: '' };
      return;
    }
    // da minha posição na tela em direção ao parceiro, até a borda (retângulo interno)
    const mx = Math.min(W - 1, Math.max(1, (pm.x + 1) / 2 * W)), my = Math.min(H - 1, Math.max(1, (1 - pm.y) / 2 * H));
    const m = RAIO + BORDA;
    const l = m, r = W - m, t = m, b = H - m;
    let vx = ox - mx, vy = oy - my;
    if (Math.abs(vx) < 1e-3 && Math.abs(vy) < 1e-3) vx = 1;
    let k = Infinity;
    if (vx > 0) k = Math.min(k, (r - mx) / vx); else if (vx < 0) k = Math.min(k, (l - mx) / vx);
    if (vy > 0) k = Math.min(k, (b - my) / vy); else if (vy < 0) k = Math.min(k, (t - my) / vy);
    let x = Math.min(r, Math.max(l, mx + vx * Math.max(0, k)));
    let y = Math.min(b, Math.max(t, my + vy * Math.max(0, k)));
    // fora dos controles e do HUD (≥ FOLGA px): procura o ponto livre mais perto ao longo da borda (e, se a borda
    // toda estiver ocupada ali, no outro eixo). Os retângulos são remedidos a cada ~0,5 s (o texto do HUD muda).
    if (!this.obstaculos || ++this.idade > 30) { this.obstaculos = this.medirObstaculos(); this.idade = 0; }
    [x, y] = this.livre(x, y, l, r, t, b, x <= l + 0.5 || x >= r - 0.5);
    const est = this.estado(o, e);
    this.el.hidden = false;
    this.el.style.transform = `translate(${(x - RAIO).toFixed(1)}px, ${(y - RAIO).toFixed(1)}px)`;
    this.el.classList.toggle('ajuda', est === 'ajuda');
    this.el.classList.toggle('espera', est === 'espera');
    this.seta.style.transform = `rotate(${Math.atan2(oy - y, ox - x).toFixed(3)}rad)`;
    const d = Math.round(Math.hypot(o.x - me.x, o.y - me.y));
    const txt = `${d} m`;
    if (this.dist.textContent !== txt) this.dist.textContent = txt;
    this.ultimo = { visivel: true, x, y, estado: est };
  }

  private idade = 0;

  private livre(x: number, y: number, l: number, r: number, t: number, b: number, lateral: boolean): [number, number] {
    const f = RAIO + FOLGA, obs = this.obstaculos ?? [];
    const ok = (px: number, py: number) => px >= l - 0.01 && px <= r + 0.01 && py >= t - 0.01 && py <= b + 0.01 &&
      obs.every((q) => px <= q.l - f || px >= q.r + f || py <= q.t - f || py >= q.b + f);
    if (ok(x, y)) return [x, y];
    // candidatos: as bordas (infladas) dos obstáculos, deslizando no eixo da borda da tela (lateral → y; topo/base → x)
    const cand: [number, number][] = [[x, t], [x, b], [l, y], [r, y]];
    for (const q of obs) {
      cand.push([x, q.t - f - 0.5], [x, q.b + f + 0.5], [q.l - f - 0.5, y], [q.r + f + 0.5, y]);
    }
    let melhor: [number, number] = [x, y], dMelhor = Infinity;
    for (const [cx, cy] of cand) {
      if (!ok(cx, cy)) continue;
      // preferir deslizar ao longo da borda em que está (o outro eixo custa o dobro)
      const d = lateral ? Math.abs(cy - y) + 2 * Math.abs(cx - x) : Math.abs(cx - x) + 2 * Math.abs(cy - y);
      if (d < dMelhor) { dMelhor = d; melhor = [cx, cy]; }
    }
    return melhor;
  }

  esconder() { this.el.hidden = true; this.ultimo = { ...this.ultimo, visivel: false }; }
}
