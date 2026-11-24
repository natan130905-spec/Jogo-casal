// Controles: joystick virtual + botões (toque) e teclado (PC). Produz um Input por quadro.
// Toque: joystick à esquerda (x e y); à direita ⬆ pular, ATACAR (a arma atual; o ícone muda), ✋ mão e ⇆ trocar
// (toque: próxima arma; segurar 0,35 s: a mochila na lanterna acesa, longe dela 🎁 dar ao parceiro). L4.
// Teclado: setas/WASD (⬆/W também pula; ⬇/S = y -1, e ⬆ mira para cima), Espaço pula, J ataca, E/Shift mão,
// Q próxima arma, 1–4 espaço direto, G dar ao parceiro, Tab a mochila (na lanterna).
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
  /** botões apertados desde a última leitura: um toque mais curto que um quadro (ou que um tick) ainda conta uma vez */
  private bordas = { jump: false, act: false, shoot: false };
  /** troca e dar pedidos desde a última leitura (a simulação usa a borda: sai numa leitura e zera na seguinte) */
  private trocaPedida = 0;
  private darPedido = false;
  private trocaSegura: ReturnType<typeof setTimeout> | null = null;
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
    const bTroca = raiz.querySelector<HTMLElement>('#bt-troca');

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
    botao(bPulo, (v) => { this.pulo = v; if (v) this.bordas.jump = true; });
    botao(bMao, (v) => { this.mao = v; if (v) this.bordas.act = true; });
    botao(bTiro, (v) => { this.tiro = v; if (v) this.bordas.shoot = true; });
    // ⇆: toque curto = próxima arma; segurar = mochila (na lanterna) ou dar (longe dela) — a simulação decide
    if (bTroca) botao(bTroca, (v) => {
      if (v) {
        if (this.trocaSegura) clearTimeout(this.trocaSegura);
        this.trocaSegura = setTimeout(() => { this.trocaSegura = null; this.trocaPedida = 7; navigator.vibrate?.(14); }, 350);
      } else if (this.trocaSegura) { clearTimeout(this.trocaSegura); this.trocaSegura = null; this.trocaPedida = 6; }
    });

    ouvir(window, 'keydown', (e) => {
      const c = (e as KeyboardEvent).code;
      this.teclas.add(c);
      if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.bordas.jump = true;
      if (c === 'KeyE' || c === 'ShiftLeft' || c === 'ShiftRight') this.bordas.act = true;
      if (c === 'KeyJ') this.bordas.shoot = true;
      if ((e as KeyboardEvent).repeat) return;
      if (c === 'KeyQ') this.trocaPedida = 6;
      if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3' || c === 'Digit4') this.trocaPedida = Number(c.slice(5));
      if (c === 'Tab') { this.trocaPedida = 5; e.preventDefault(); }
      if (c === 'KeyG') this.darPedido = true;
    });
    ouvir(window, 'keyup', (e) => this.teclas.delete((e as KeyboardEvent).code));
    ouvir(window, 'blur', () => this.teclas.clear());
  }

  /** Solta tudo (ao pausar ou trocar de tela) para nenhum botão ficar "preso". */
  limpar(o: { manterJoystick?: boolean } = {}) {
    this.pulo = this.mao = this.tiro = false; this.teclas.clear();
    this.bordas = { jump: false, act: false, shoot: false };
    this.trocaPedida = 0; this.darPedido = false;
    if (this.trocaSegura) { clearTimeout(this.trocaSegura); this.trocaSegura = null; }
    for (const b of this.raiz.querySelectorAll('.ativo')) b.classList.remove('ativo');
    // pausa: o polegar que continua no joystick segue valendo ao continuar (R27); se ele sair durante a pausa, o
    // pointerup (capturado pelo joystick) zera do mesmo jeito
    if (o.manterJoystick && this.toqueJoy !== null) return;
    this.x = this.y = 0;
    const bola = this.raiz.querySelector<HTMLElement>('#joystick .bola');
    if (bola) bola.style.transform = '';
  }

  /** Remove os ouvintes (cada fase cria os seus controles). */
  destruir() { for (const f of this.desligar) f(); this.desligar = []; this.limpar(); }

  /** A entrada agora. Um botão apertado e já solto desde a leitura anterior sai apertado nesta (uma vez). */
  ler(): Input {
    const t = this.teclas, b = this.bordas;
    this.bordas = { jump: false, act: false, shoot: false };
    const troca = this.trocaPedida, dar = this.darPedido;
    this.trocaPedida = 0; this.darPedido = false;
    const kx = (t.has('ArrowRight') || t.has('KeyD') ? 1 : 0) - (t.has('ArrowLeft') || t.has('KeyA') ? 1 : 0);
    const ky = (t.has('ArrowUp') || t.has('KeyW') ? 1 : 0) - (t.has('ArrowDown') || t.has('KeyS') ? 1 : 0);
    return {
      x: kx !== 0 ? kx : this.x,
      y: ky !== 0 ? ky : this.y,
      jump: b.jump || this.pulo || t.has('Space') || t.has('ArrowUp') || t.has('KeyW'),
      act: b.act || this.mao || t.has('KeyE') || t.has('ShiftLeft') || t.has('ShiftRight'),
      shoot: b.shoot || this.tiro || t.has('KeyJ'),
      ...(troca ? { troca } : {}), ...(dar ? { dar: true } : {}),
    };
  }
}
