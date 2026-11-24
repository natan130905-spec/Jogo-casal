// Controles: joystick virtual + botões (toque) e teclado (PC). Produz um Input por quadro.
// Toque: joystick à esquerda (x e y); à direita ⬆ pular, ✨ atirar (Lança-Estrelas) e ✋ mão.
// Teclado: setas/WASD (⬆/W também pula; ⬇/S = y -1), Espaço pula, J atira, E/Shift mão.
import type { Input } from '../core/types';

/** zona morta e resposta suave do joystick (0…1 → -1…1) */
const curva = (v: number) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.15) / 0.6));

export class Controles {
  private x = 0;
  private y = 0;
  private pulo = false;
  private mao = false;
  private tiro = false;
  private teclas = new Set<string>();
  private toqueJoy: number | null = null;
  private centro = { x: 0, y: 0 };
  private raio = 50;
  private desligar: (() => void)[] = [];

  constructor(private raiz: HTMLElement) {
    const joy = raiz.querySelector<HTMLElement>('#joystick')!;
    const bola = raiz.querySelector<HTMLElement>('#joystick .bola')!;
    const bPulo = raiz.querySelector<HTMLElement>('#bt-pulo')!;
    const bMao = raiz.querySelector<HTMLElement>('#bt-mao')!;
    const bTiro = raiz.querySelector<HTMLElement>('#bt-tiro')!;

    const ouvir = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, tipo: K, f: (ev: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(tipo, f as EventListener);
      this.desligar.push(() => el.removeEventListener(tipo, f as EventListener));
    };

    ouvir(joy, 'pointerdown', (ev) => {
      ev.preventDefault();
      joy.setPointerCapture(ev.pointerId);
      this.toqueJoy = ev.pointerId;
      const r = joy.getBoundingClientRect();
      this.centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.raio = r.width / 2;
      mover(ev);
    });
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== this.toqueJoy) return;
      const dx = ev.clientX - this.centro.x, dy = ev.clientY - this.centro.y;
      const d = Math.min(1, Math.hypot(dx, dy) / this.raio);
      const ang = Math.atan2(dy, dx);
      const px = Math.cos(ang) * d, py = Math.sin(ang) * d;
      bola.style.transform = `translate(${px * this.raio * 0.6}px, ${py * this.raio * 0.6}px)`;
      this.x = curva(px);
      this.y = -curva(py); // tela: para baixo é positivo; no jogo, para cima
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== this.toqueJoy) return;
      this.toqueJoy = null; this.x = 0; this.y = 0; bola.style.transform = '';
    };
    ouvir(joy, 'pointermove', mover);
    ouvir(joy, 'pointerup', soltar);
    ouvir(joy, 'pointercancel', soltar);

    const botao = (el: HTMLElement, set: (v: boolean) => void) => {
      ouvir(el, 'pointerdown', (ev) => { ev.preventDefault(); el.setPointerCapture(ev.pointerId); set(true); el.classList.add('ativo'); navigator.vibrate?.(8); });
      const fim = () => { set(false); el.classList.remove('ativo'); };
      ouvir(el, 'pointerup', fim);
      ouvir(el, 'pointercancel', fim);
    };
    botao(bPulo, (v) => (this.pulo = v));
    botao(bMao, (v) => (this.mao = v));
    botao(bTiro, (v) => (this.tiro = v));

    ouvir(window, 'keydown', (e) => this.teclas.add((e as KeyboardEvent).code));
    ouvir(window, 'keyup', (e) => this.teclas.delete((e as KeyboardEvent).code));
    ouvir(window, 'blur', () => this.teclas.clear());
  }

  /** Solta tudo (ao pausar ou trocar de tela) para nenhum botão ficar "preso". */
  limpar() {
    this.x = this.y = 0; this.pulo = this.mao = this.tiro = false; this.teclas.clear();
    for (const b of this.raiz.querySelectorAll('.ativo')) b.classList.remove('ativo');
    const bola = this.raiz.querySelector<HTMLElement>('#joystick .bola');
    if (bola) bola.style.transform = '';
  }

  /** Remove os ouvintes (cada fase cria os seus controles). */
  destruir() { for (const f of this.desligar) f(); this.desligar = []; this.limpar(); }

  ler(): Input {
    const t = this.teclas;
    const kx = (t.has('ArrowRight') || t.has('KeyD') ? 1 : 0) - (t.has('ArrowLeft') || t.has('KeyA') ? 1 : 0);
    const ky = (t.has('ArrowUp') || t.has('KeyW') ? 1 : 0) - (t.has('ArrowDown') || t.has('KeyS') ? 1 : 0);
    return {
      x: kx !== 0 ? kx : this.x,
      y: ky !== 0 ? ky : this.y,
      jump: this.pulo || t.has('Space') || t.has('ArrowUp') || t.has('KeyW'),
      act: this.mao || t.has('KeyE') || t.has('ShiftLeft') || t.has('ShiftRight'),
      shoot: this.tiro || t.has('KeyJ'),
    };
  }
}
