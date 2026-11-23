// Controles: joystick virtual + botões (toque) e teclado (PC). Produz um Input por quadro.
import type { Input } from '../core/types';

export class Controles {
  private x = 0;
  private pulo = false;
  private mao = false;
  private teclas = new Set<string>();
  private toqueJoy: number | null = null;
  private centro = { x: 0, y: 0 };
  private raio = 50;

  constructor(private raiz: HTMLElement) {
    const joy = raiz.querySelector<HTMLElement>('#joystick')!;
    const bola = raiz.querySelector<HTMLElement>('#joystick .bola')!;
    const bPulo = raiz.querySelector<HTMLElement>('#bt-pulo')!;
    const bMao = raiz.querySelector<HTMLElement>('#bt-mao')!;

    joy.addEventListener('pointerdown', (ev) => {
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
      // zona morta e resposta suave
      this.x = Math.abs(px) < 0.15 ? 0 : Math.sign(px) * Math.min(1, (Math.abs(px) - 0.15) / 0.6);
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== this.toqueJoy) return;
      this.toqueJoy = null; this.x = 0; bola.style.transform = '';
    };
    joy.addEventListener('pointermove', mover);
    joy.addEventListener('pointerup', soltar);
    joy.addEventListener('pointercancel', soltar);

    const botao = (el: HTMLElement, set: (v: boolean) => void) => {
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); el.setPointerCapture(ev.pointerId); set(true); el.classList.add('ativo'); navigator.vibrate?.(8); });
      const fim = () => { set(false); el.classList.remove('ativo'); };
      el.addEventListener('pointerup', fim);
      el.addEventListener('pointercancel', fim);
    };
    botao(bPulo, (v) => (this.pulo = v));
    botao(bMao, (v) => (this.mao = v));

    addEventListener('keydown', (e) => this.teclas.add(e.code));
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    addEventListener('blur', () => this.teclas.clear());
  }

  ler(): Input {
    const t = this.teclas;
    const kx = (t.has('ArrowRight') || t.has('KeyD') ? 1 : 0) - (t.has('ArrowLeft') || t.has('KeyA') ? 1 : 0);
    return {
      x: kx !== 0 ? kx : this.x,
      jump: this.pulo || t.has('Space') || t.has('ArrowUp') || t.has('KeyW'),
      act: this.mao || t.has('KeyE') || t.has('ShiftLeft'),
    };
  }
}
