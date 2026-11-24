// Câmera em terceira pessoa da arena: atrás de quem joga neste aparelho, um pouco ao lado e mais alta (o golpe se lê
// de lado, não pelas costas), olhando para o alvo da trava (o Rei, um cristal ou uma bolotinha perto), afastando o
// quanto precisa para caber o Rei inteiro e, se couber sem encolher demais o próprio personagem, o parceiro.
// O próprio personagem nunca fica pequeno: a distância tem teto (DIST_MAX) e o parceiro sai do quadro antes (o HUD
// mostra onde ele está); na fase 3 com a parede de névoa, os dois ficam em lados opostos e o parceiro não entra.
// Tudo suave (ângulo, distância e foco amortecidos). `yaw` é o rotation.y da câmera (ordem 'YXZ'), que os
// controles usam para transformar o joystick em direção no chão.
import * as THREE from 'three';
import { REI, alvoDaTrava, type EstadoArena } from '../../core/arena';

const amortecerAng = (a: number, b: number, k: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
};

/** câmera um pouco à direita de quem joga (rad); o yaw da câmera inclui isto, então o joystick continua certo */
const LADO = 0.26;
/** distâncias: mínima, a partir da qual o parceiro deixa de ser obrigatório, e teto */
const DIST_MIN = 6.2, DIST_PARCEIRO = 8.6, DIST_MAX = 9.4;

export class CameraArena {
  readonly camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.3, 800);
  /** rotation.y da câmera (para os controles) */
  yaw = 0;
  private dist = 8;
  private foco = new THREE.Vector3();
  private iniciou = false;
  private pitch = 0.37;
  private tmp = new THREE.Vector3();
  private orbita = 0;

  constructor() { this.camera.rotation.order = 'YXZ'; }

  atualizar(e: EstadoArena, local: number, dt: number, tremor: number, t: number) {
    const j = e.jogadores[local], o = e.jogadores[1 - local];
    const base = j.bolha && !o.bolha ? o : j;
    const k = (r: number) => (this.iniciou ? 1 - Math.exp(-r * dt) : 1);

    // olha para o alvo da trava, menos quando é uma bolotinha (perto e rápida: a câmera ficaria balançando)
    let alvo: { x: number; z: number } = { x: e.rei.x, z: e.rei.z };
    const trava = alvoDaTrava(e, local);
    if (trava && !e.lacaios.some((l) => Math.hypot(l.x - trava.x, l.z - trava.z) < 0.05)) alvo = trava;
    if (e.vitoria) alvo = e.vagalume ? { x: e.vagalume.x, z: e.vagalume.z } : { x: e.rei.x, z: e.rei.z };

    // para onde olhar: de quem joga para o alvo
    const dx = alvo.x - base.x, dz = alvo.z - base.z;
    let yawAlvo = this.yaw;
    if (Math.hypot(dx, dz) > 1.2) yawAlvo = Math.atan2(-dx, -dz) + LADO;
    if (e.vitoria) { this.orbita += dt * 0.25; yawAlvo = Math.atan2(-dx, -dz) + Math.sin(this.orbita) * 0.6; }
    this.yaw = this.iniciou ? amortecerAng(this.yaw, yawAlvo, k(3.2)) : yawAlvo;

    // foco: entre quem joga e o alvo, um pouco acima do chão
    const fx = base.x + dx * 0.38, fz = base.z + dz * 0.38;
    const fy = 1.1 + Math.max(0, base.y) * 0.4;
    if (!this.iniciou) this.foco.set(fx, fy, fz); else this.foco.lerp(this.tmp.set(fx, fy, fz), k(5));

    // distância: a menor que mostra quem joga, o parceiro e o Rei (topo e base)
    const pontos: [number, number, number][] = [[base.x, base.y + 1.1, base.z], [base.x, base.y, base.z], [e.rei.x, REI.altura * 0.93, e.rei.z], [e.rei.x, 0, e.rei.z]];
    const separados = e.rei.fase === 3 && e.parede !== 0;
    const comParceiro = !o.bolha && !separados;
    const cabe = (lista: [number, number, number][]) => lista.every(([x, y, z]) => { const p = this.tmp.set(x, y, z).project(this.camera); return Math.abs(p.x) < 0.88 && p.y < 0.94 && p.y > -0.92 && p.z < 1; });
    const parceiro: [number, number, number][] = [[o.x, o.y + 1.1, o.z], [o.x, o.y, o.z]];
    // a menor distância em que cabe tudo; o parceiro só conta até DIST_PARCEIRO (mais longe, quem joga ficaria
    // pequeno demais): sem caber, a menor em que cabem quem joga e o Rei, com teto DIST_MAX
    const menor = (lista: [number, number, number][], ate: number) => {
      for (let d = DIST_MIN; d <= ate + 1e-6; d += 0.4) { this.posicionar(d, this.foco); if (cabe(lista)) return d; }
      return null;
    };
    const dAlvo = (comParceiro ? menor([...pontos, ...parceiro], DIST_PARCEIRO) : null) ?? menor(pontos, DIST_MAX) ?? DIST_MAX;
    this.dist = this.iniciou ? this.dist + (dAlvo - this.dist) * k(2.5) : dAlvo;
    this.posicionar(this.dist, this.foco);
    if (tremor > 0) {
      const a = tremor * tremor * 0.18;
      this.camera.position.x += Math.sin(t * 61) * a;
      this.camera.position.y += Math.sin(t * 47 + 1) * a;
      this.camera.position.z += Math.sin(t * 53 + 2) * a * 0.5;
    }
    this.iniciou = true;
  }

  private posicionar(d: number, foco: THREE.Vector3) {
    const fxz = Math.cos(this.pitch) * d;
    this.camera.position.set(foco.x + Math.sin(this.yaw) * fxz, foco.y + Math.sin(this.pitch) * d, foco.z + Math.cos(this.yaw) * fxz);
    this.camera.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld(true);
  }

  aspecto(a: number) {
    this.camera.aspect = a;
    // em tela estreita (retrato) abre o ângulo para caber a arena
    this.camera.fov = a < 1 ? 68 : 52;
    this.camera.updateProjectionMatrix();
  }
}
