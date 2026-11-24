// Controles da Arena do Coração (3D, celular na horizontal): joystick à esquerda (relativo à câmera) e, à direita,
// ⚔ golpe (o maior, sob o polegar), ✨ tiro, ⬆ pulo, ↻ esquiva e ★ poder (com a barra em volta, que acende cheia).
// PC: WASD/setas andar, J golpe, K tiro, Espaço pula, Shift esquiva, Q poder. Produz uma EntradaArena por quadro.
// Os controles do 2.5D (src/input/controles.ts) não mudam.
import type { EntradaArena } from '../core/arena';

/** zona morta e resposta suave do joystick (0…1 → -1…1), como no 2.5D */
const curva = (v: number) => (Math.abs(v) < 0.12 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.12) / 0.6));

type Botao = 'pulo' | 'golpe' | 'tiro' | 'esquiva' | 'poder';
const TECLAS: Record<Botao, string[]> = {
  pulo: ['Space'], golpe: ['KeyJ'], tiro: ['KeyK'], esquiva: ['ShiftLeft', 'ShiftRight'], poder: ['KeyQ'],
};

export class ControlesArena {
  private x = 0;
  private y = 0;
  private toque: Record<Botao, boolean> = { pulo: false, golpe: false, tiro: false, esquiva: false, poder: false };
  /** apertado desde o último tick simulado: um toque mais curto que um quadro não se perde (ver `consumir`) */
  private pego: Record<Botao, boolean> = { pulo: false, golpe: false, tiro: false, esquiva: false, poder: false };
  private teclas = new Set<string>();
  private toqueJoy: number | null = null;
  private centro = { x: 0, y: 0 };
  private raio = 60;
  private desligar: (() => void)[] = [];
  private anel: SVGCircleElement | null;
  private bPoder: HTMLElement;
  private ultimoPoder = -1;

  constructor(private raiz: HTMLElement) {
    const joy = raiz.querySelector<HTMLElement>('.joy')!;
    const bola = joy.querySelector<HTMLElement>('.bola')!;
    this.bPoder = raiz.querySelector<HTMLElement>('[data-b="poder"]')!;
    this.anel = this.bPoder.querySelector<SVGCircleElement>('.anel-cheio');

    const ouvir = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, tipo: K, f: (ev: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(tipo, f as EventListener);
      this.desligar.push(() => el.removeEventListener(tipo, f as EventListener));
    };

    // joystick: o centro é onde o polegar encostou dentro da área (mais confortável que um centro fixo)
    const base = joy.querySelector<HTMLElement>('.base')!;
    ouvir(joy, 'pointerdown', (ev) => {
      ev.preventDefault();
      if (this.toqueJoy !== null) return;
      joy.setPointerCapture(ev.pointerId);
      this.toqueJoy = ev.pointerId;
      const r = joy.getBoundingClientRect();
      this.raio = Math.min(r.width, r.height) * 0.32;
      // perto da base desenhada, usa o centro dela; longe, a base vai até o polegar
      const rb = base.getBoundingClientRect();
      const cb = { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2 };
      this.centro = Math.hypot(ev.clientX - cb.x, ev.clientY - cb.y) < this.raio ? cb : { x: ev.clientX, y: ev.clientY };
      base.style.transform = `translate(${this.centro.x - cb.x}px, ${this.centro.y - cb.y}px)`;
      joy.classList.add('ativo');
      mover(ev);
    });
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== this.toqueJoy) return;
      const dx = ev.clientX - this.centro.x, dy = ev.clientY - this.centro.y;
      const d = Math.min(1, Math.hypot(dx, dy) / this.raio);
      const ang = Math.atan2(dy, dx);
      const px = Math.cos(ang) * d, py = Math.sin(ang) * d;
      bola.style.transform = `translate(${px * this.raio * 0.7}px, ${py * this.raio * 0.7}px)`;
      this.x = curva(px);
      this.y = -curva(py); // tela: para baixo é positivo; no jogo, y = 1 é para a frente
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== this.toqueJoy) return;
      this.toqueJoy = null; this.x = 0; this.y = 0;
      bola.style.transform = ''; base.style.transform = ''; joy.classList.remove('ativo');
    };
    ouvir(joy, 'pointermove', mover);
    ouvir(joy, 'pointerup', soltar);
    ouvir(joy, 'pointercancel', soltar);

    for (const el of raiz.querySelectorAll<HTMLElement>('[data-b]')) {
      const b = el.dataset.b as Botao;
      ouvir(el, 'pointerdown', (ev) => {
        ev.preventDefault(); el.setPointerCapture(ev.pointerId);
        this.toque[b] = true; this.pego[b] = true; el.classList.add('ativo'); navigator.vibrate?.(8);
      });
      const fim = () => { this.toque[b] = false; el.classList.remove('ativo'); };
      ouvir(el, 'pointerup', fim);
      ouvir(el, 'pointercancel', fim);
      ouvir(el, 'contextmenu', (ev) => ev.preventDefault());
    }

    ouvir(window, 'keydown', (e) => {
      const k = (e as KeyboardEvent).code;
      if (k === 'Space') e.preventDefault();
      this.teclas.add(k);
      for (const b of Object.keys(TECLAS) as Botao[]) if (TECLAS[b].includes(k)) this.pego[b] = true;
    });
    ouvir(window, 'keyup', (e) => this.teclas.delete((e as KeyboardEvent).code));
    ouvir(window, 'blur', () => this.teclas.clear());
  }

  /** Solta tudo (ao pausar ou trocar de tela) para nenhum botão ficar "preso". */
  limpar() {
    this.x = this.y = 0; this.teclas.clear(); this.toqueJoy = null;
    for (const b of Object.keys(this.toque) as Botao[]) this.toque[b] = this.pego[b] = false;
    for (const b of this.raiz.querySelectorAll('.ativo')) b.classList.remove('ativo');
    for (const s of this.raiz.querySelectorAll<HTMLElement>('.joy .bola, .joy .base')) s.style.transform = '';
  }

  destruir() { for (const f of this.desligar) f(); this.desligar = []; this.limpar(); }

  /** Barra de poder em volta do ★ (0…1); acende quando cheia. */
  mostrarPoder(frac: number) {
    const f = Math.max(0, Math.min(1, frac));
    const q = Math.round(f * 50);
    if (q === this.ultimoPoder) return;
    this.ultimoPoder = q;
    if (this.anel) this.anel.style.strokeDashoffset = String(100 - q * 2);
    this.bPoder.classList.toggle('cheio', q >= 50);
  }

  /** A entrada lida já chegou à simulação (anfitrião/treino: rodou um tick; convidado: foi enviada). */
  consumir() { for (const b of Object.keys(this.pego) as Botao[]) this.pego[b] = false; }

  /** Entrada do quadro; `yaw` = rotation.y da câmera (o joystick é relativo a ela). */
  ler(yaw: number): EntradaArena {
    const t = this.teclas;
    const kx = (t.has('ArrowRight') || t.has('KeyD') ? 1 : 0) - (t.has('ArrowLeft') || t.has('KeyA') ? 1 : 0);
    const ky = (t.has('ArrowUp') || t.has('KeyW') ? 1 : 0) - (t.has('ArrowDown') || t.has('KeyS') ? 1 : 0);
    let x = kx || ky ? kx : this.x, y = kx || ky ? ky : this.y;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    const b = (n: Botao) => this.toque[n] || this.pego[n] || TECLAS[n].some((k) => t.has(k));
    return { x, y, yaw, pulo: b('pulo'), golpe: b('golpe'), tiro: b('tiro'), esquiva: b('esquiva'), poder: b('poder') };
  }
}
