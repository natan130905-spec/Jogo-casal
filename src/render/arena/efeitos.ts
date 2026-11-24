// Efeitos de jogo da arena: telegrafias no chão (círculos e faixas enchendo, onda de choque, sombra dos esporos
// caindo), sombras-bolha, marcador da trava, disparos do Lança-Estrelas, rastro dos golpes, os 3 poderes (Corte
// Cometa, Jardim de Luz, Golpe do Fio Vermelho), faíscas e números de acerto, cura, bolha, vaga-lume na vitória.
// Lê o estado e os eventos; não muda nada no estado.
import * as THREE from 'three';
import {
  CORPO, LACAIO, PODER, REI, TIRO, alvoDaTrava, raioOnda, type EstadoArena, type Perigo,
} from '../../core/arena';
import { Marcas, M } from './marcas';
import { Fita } from './fita';
import type { Particulas3D } from './particulas';
import { C } from './atlas';
import { COR_HEROI, type Heroi } from './herois';
import type { ReiVisual } from './rei';

const lim = (t: number) => Math.max(0, Math.min(1, t));
const COR_AVISO = { rei: 0xff4a7a, bicho: 0xff8a3a, onda: 0xff5ac8, investida: 0xff3a5a };

export class Efeitos {
  readonly grupo = new THREE.Group();
  readonly marcas = new Marcas(128);
  private rastros: [Fita, Fita];
  private fio: Fita;
  /** maior aviso visto de cada perigo (para saber quanto já encheu) */
  private avisoTotal = new Map<number, number>();
  private ultimosPerigos = new Map<number, Perigo>();
  /** histórico (base, ponta) da arma de cada um para o rastro */
  private hist: { b: THREE.Vector3; p: THREE.Vector3; a: number }[][] = [[], []];
  private tFio = 9;
  private tJardim = 9;
  private tRecomeco = 9;
  private onda3d: THREE.Mesh[] = [];
  /** tremida de câmera pedida pelos efeitos (0…1) */
  tremor = 0;
  private pts: THREE.Vector3[] = Array.from({ length: 28 }, () => new THREE.Vector3());

  constructor() {
    this.rastros = [new Fita(40), new Fita(40)];
    this.fio = new Fita(28, true, 'fio');
    this.grupo.add(this.marcas.malha, this.rastros[0].malha, this.rastros[1].malha, this.fio.malha);
    // parede da onda de choque (anel em pé, aditivo, some para cima)
    const g = new THREE.CylinderGeometry(1, 1, 0.9, 72, 1, true);
    g.translate(0, 0.45, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAlfa: { value: 1 } },
      vertexShader: /* glsl */ 'varying float vY; void main(){ vY = position.y / 0.9; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `uniform float uAlfa; varying float vY;
        void main(){ float a = (1.0 - vY) * (1.0 - vY) * uAlfa; gl_FragColor = vec4(vec3(1.0, 0.55, 0.85) * a, 1.0);
        #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(g, mat.clone());
      m.visible = false; m.renderOrder = 6; m.frustumCulled = false;
      this.onda3d.push(m); this.grupo.add(m);
    }
  }

  atualizar(e: EstadoArena, dt: number, t: number, fx: Particulas3D, herois: readonly [Heroi, Heroi], rei: ReiVisual, cam: THREE.Vector3, local: number) {
    const mk = this.marcas;
    mk.comecar();
    this.tFio += dt; this.tJardim += dt; this.tRecomeco += dt;
    this.tremor = Math.max(0, this.tremor - dt * 2.2);

    // ---------------- sombras-bolha
    e.jogadores.forEach((j) => {
      const alt = Math.max(0, j.y);
      mk.circulo(M.sombra, j.x, j.z, (j.bolha ? 0.7 : 0.55) * Math.max(0.5, 1 - alt * 0.15), 0x1a0830, 0, j.bolha ? 0.5 : 1);
    });
    if (!e.vitoria) mk.circulo(M.sombra, e.rei.x, e.rei.z, REI.raio * 1.35, 0x1a0830, 0, 0.9);
    for (const l of e.lacaios) mk.circulo(M.sombra, l.x, l.z, l.tipo === 'morcego' ? 0.45 : 0.5, 0x1a0830, 0, l.tipo === 'morcego' ? 0.55 : 0.9);

    // ---------------- praça: runas douradas (mais fortes quando o Rei pode levar dano)
    const brilhoRuna = 0.35 + 0.15 * Math.sin(t * 1.5);
    mk.circulo(M.runa, 0, 0, 3.75, 0xffc860, 0, brilhoRuna);
    mk.circulo(M.runa, 0, 0, 2.0, 0xffd880, 0, brilhoRuna * 0.8);

    // ---------------- telegrafias
    const vistos = new Set<number>();
    let ondas = 0;
    for (const p of e.perigos) {
      vistos.add(p.id);
      // aviso total: o da regra (Rei por fase, bote, mergulho) ou o maior já visto
      const regra = p.fonte === -1 ? REI.aviso[e.rei.fase - 1] : p.tipo === 'bote' ? LACAIO.bolotinha.aviso : LACAIO.morcego.aviso;
      const tot = Math.max(this.avisoTotal.get(p.id) ?? 0, p.aviso, regra, 0.001);
      this.avisoTotal.set(p.id, tot);
      const k = p.aviso > 0 ? 1 - p.aviso / tot : 1;
      const doRei = p.fonte === -1;
      if (p.forma === 'circulo') {
        const cor = doRei ? COR_AVISO.rei : COR_AVISO.bicho;
        mk.circulo(M.circulo, p.x, p.z, p.r, cor, p.aviso > 0 ? k : 1, p.aviso > 0 ? 1 : lim(1 - p.t / Math.max(0.05, p.dura)) * 0.9 + 0.1);
        if (p.tipo === 'esporo' && p.aviso > 0) {
          // a bola de esporos cai do céu e a sombra escurece
          mk.circulo(M.sombra, p.x, p.z, p.r * (0.4 + 0.6 * k), 0x200830, 0, 0.6 + 0.4 * k);
          const y = 0.6 + (1 - k) * 11;
          for (let q = 0; q < 4; q++) {
            const a = t * 3 + q * 1.57;
            fx.ponto(p.x + Math.cos(a) * 0.25, y + Math.sin(a * 1.3) * 0.15, p.z + Math.sin(a) * 0.25, 0.75, q % 2 ? 0x9a4ad8 : 0xc070f0, 0.95, C.nuvem, a, false);
          }
          fx.ponto(p.x, y, p.z, 1.6, 0xc080ff, 0.35, C.halo);
        }
        if (p.tipo === 'mergulho' && p.aviso > 0) mk.circulo(M.trava, p.x, p.z, p.r * 0.7, 0xff8a3a, 0, 0.8);
      } else if (p.forma === 'linha') {
        mk.linha(p.x, p.z, p.x2, p.z2, p.r, COR_AVISO.investida, k, p.aviso > 0 ? 1 : 0.8);
      } else if (p.forma === 'anel') {
        if (p.aviso > 0) {
          // aviso da pancada: anel pulsando em volta do Rei e o chão rachando
          mk.circulo(M.circulo, p.x, p.z, REI.raio + 0.9, COR_AVISO.onda, k, 1);
          mk.circulo(M.anel, p.x, p.z, REI.raio + 0.9 + k * 1.5, COR_AVISO.onda, 0, 0.5 * k, 0.35);
        } else {
          const ro = raioOnda(p);
          mk.circulo(M.anel, p.x, p.z, ro, COR_AVISO.onda, 0, lim(1 - ro / (REI.onda.raioMax + 0.5)) * 0.6 + 0.4, REI.onda.largura * 0.75);
          if (ondas < this.onda3d.length) {
            const m = this.onda3d[ondas++];
            m.visible = true; m.position.set(p.x, 0, p.z); m.scale.set(ro, 1, ro);
            (m.material as THREE.ShaderMaterial).uniforms.uAlfa.value = 0.9 * lim(1 - ro / (REI.onda.raioMax + 0.5)) + 0.1;
            // poeirinha na frente da onda
            if (Math.random() < dt * 40) {
              const a = Math.random() * Math.PI * 2;
              fx.emitir({ x: p.x + Math.sin(a) * ro, y: 0.15, z: p.z + Math.cos(a) * ro, vy: 1, vida: 0.5, tam: 0.5, tamFim: 0.9, cor: 0xc8a0f0, alfa: 0.4, cel: C.halo, aditivo: false, rot: a });
            }
          }
        }
      }
      this.ultimosPerigos.set(p.id, p);
    }
    for (let k = ondas; k < this.onda3d.length; k++) this.onda3d[k].visible = false;

    // ---------------- eventos
    for (const ev of e.eventos) this.evento(ev, e, fx, herois, rei);
    for (const id of [...this.avisoTotal.keys()]) if (!vistos.has(id)) { this.avisoTotal.delete(id); this.ultimosPerigos.delete(id); }

    // ---------------- trava (marcador no alvo de quem joga neste aparelho)
    const alvo = alvoDaTrava(e, local);
    if (alvo && !e.vitoria && !e.jogadores[local].bolha) {
      const ehRei = Math.hypot(alvo.x - e.rei.x, alvo.z - e.rei.z) < 0.1;
      mk.circulo(M.trava, alvo.x, alvo.z, ehRei ? REI.raio + 0.5 : 0.8, COR_HEROI[local], 0, 0.85);
    }

    // ---------------- aura de poder cheio, disparos
    e.jogadores.forEach((j, i) => {
      if (j.bolha) return;
      if (j.poder >= PODER.max) {
        mk.circulo(M.aura, j.x, j.z, 0.9, COR_HEROI[i], 0, 0.9);
        if (Math.random() < dt * 10) fx.emitir({ x: j.x + (Math.random() - 0.5) * 0.6, y: j.y + 0.2, z: j.z + (Math.random() - 0.5) * 0.6, vy: 1.6, vida: 0.7, tam: 0.22, tamFim: 0, cor: COR_HEROI[i], cel: C.brilho, vrot: 3 });
      }
    });
    for (const d of e.disparos) {
      const v = Math.hypot(d.vx, d.vz) || 1;
      const cor = d.dono === 0 ? 0xffe08a : 0xffb0e8;
      for (let q = 0; q < 5; q++) {
        const b = q * 0.12;
        fx.ponto(d.x - (d.vx / v) * b, d.y, d.z - (d.vz / v) * b, 0.42 - q * 0.06, cor, 0.6 - q * 0.1, C.halo);
      }
      fx.ponto(d.x, d.y, d.z, 0.45, cor, 0.9, C.brilho, t * 10);
      if (Math.random() < dt * 30) fx.emitir({ x: d.x, y: d.y, z: d.z, vy: -0.3, vida: 0.35, tam: 0.18, tamFim: 0, cor, cel: C.brilho, vrot: 5 });
    }

    // ---------------- rastro dos golpes (fita entre base e ponta da arma ao longo do tempo)
    herois.forEach((h, i) => {
      const hs = this.hist[i];
      const r = this.rastros[i];
      r.comecar();
      // seções longe demais (o cometa anda 8 m) viram faixas enormes: recomeça o rastro
      if (hs.length && hs[0].p.distanceTo(h.ponta) > 1.2) hs.length = 0;
      if (h.rastro > 0.05) hs.unshift({ b: h.base.clone(), p: h.ponta.clone(), a: Math.min(1, h.rastro) });
      else if (hs.length) hs.pop();
      while (hs.length > 12) hs.pop();
      const cor = e.jogadores[i].acao === 'poder' ? (i === 0 ? 0xffd040 : 0xff9ad8) : COR_HEROI[i];
      hs.forEach((s, k) => {
        // mais forte e mais longo que antes (0,5 e 8 seções): com a câmera atrás, o golpe se lia mal
        const a = s.a * (1 - k / hs.length) * 0.95;
        r.secao(s.b.x, s.b.y, s.b.z, s.p.x, s.p.y, s.p.z, cor, a);
      });
      r.terminar();
    });

    // ---------------- Corte Cometa (Natan no poder): cauda de cometa e brilho
    const n = e.jogadores[0];
    if (n.acao === 'poder' && !n.bolha) {
      for (let q = 0; q < 2; q++) {
        fx.emitir({ x: n.x + (Math.random() - 0.5) * 0.5, y: n.y + 0.3 + Math.random() * 0.8, z: n.z + (Math.random() - 0.5) * 0.5, vx: -n.dx * 3, vz: -n.dz * 3, vy: 0.4, arrasto: 2, vida: 0.45, tam: 0.4, tamFim: 0, cor: q % 2 ? 0xffb020 : 0xffe080, alfa: 0.7, cel: C.brilho, vrot: 4 });
      }
      fx.ponto(n.x, n.y + 0.6, n.z, 2.2, 0xffa020, 0.3, C.halo);
      fx.ponto(herois[0].ponta.x, herois[0].ponta.y, herois[0].ponta.z, 1.2, 0xfff0c0, 0.7, C.brilho, t * 6);
    }

    // ---------------- Jardim de Luz: círculo de flores, pétalas subindo, cura
    if (e.jardim) {
      const g = e.jardim;
      const nasce = lim(this.tJardim / 0.4), some = lim(g.t / 0.6);
      mk.circulo(M.jardim, g.x, g.z, PODER.jardim.raio * (0.6 + 0.4 * nasce), 0x8aff9a, nasce * some, 1);
      mk.circulo(M.aura, g.x, g.z, PODER.jardim.raio, 0xffe0f0, 0, 0.5 * some);
      if (Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * PODER.jardim.raio;
        const cores = [0xff9ad8, 0xffffff, 0xffe066, 0xb8ffb0];
        fx.emitir({ x: g.x + Math.sin(a) * r, y: 0.1, z: g.z + Math.cos(a) * r, vx: (Math.random() - 0.5) * 0.5, vy: 1 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 0.5, arrasto: 0.5, vida: 1.4, tam: 0.28, tamFim: 0.12, cor: cores[Math.floor(Math.random() * 4)], cel: C.petala, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 4, aditivo: false });
      }
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * PODER.jardim.raio;
        fx.emitir({ x: g.x + Math.sin(a) * r, y: 0.15, z: g.z + Math.cos(a) * r, vy: 0.8, vida: 1, tam: 0.35, tamFim: 0, cor: 0xfff4b0, cel: C.brilho, vrot: 2 });
      }
    }

    // ---------------- Fio Vermelho: sempre um fiozinho entre os dois; no golpe combinado, aceso e grosso
    const [a, b] = e.jogadores;
    if (!a.bolha && !b.bolha) {
      const forte = lim(1 - this.tFio / 1.6);
      const perto = Math.hypot(a.x - b.x, a.z - b.z) < PODER.perto ? 1 : 0;
      const pa = herois[0].maoE, pb = herois[1].maoE;
      const dist = pa.distanceTo(pb);
      const caida = Math.max(0.1, 1.2 - dist * 0.08) * (1 - forte);
      const N = this.pts.length;
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1);
        this.pts[k].lerpVectors(pa, pb, u);
        this.pts[k].y -= Math.sin(u * Math.PI) * caida;
        if (forte > 0) this.pts[k].y += Math.sin(u * Math.PI * 3 - t * 20) * 0.08 * forte;
      }
      this.fio.comecar();
      this.fio.curva(this.pts, () => 0.035 + forte * 0.16, (u) => (0.35 + perto * 0.25 + forte * 0.6) * (0.6 + 0.4 * Math.sin(u * 20 - t * 6) * forte + 0.4), forte > 0 ? 0xff3a4a : 0xff4a5a, cam);
      this.fio.terminar();
      if (forte > 0) {
        // corações e brilho correndo pelo fio, e o raio até o Rei
        const u = (t * 1.8) % 1;
        const p = this.pts[Math.floor(u * (N - 1))];
        fx.ponto(p.x, p.y, p.z, 0.9 * forte, 0xffd0d8, forte, C.brilho, t * 5);
        if (Math.random() < dt * 30 * forte) {
          const q = this.pts[Math.floor(Math.random() * N)];
          // (corações pequenos subindo do fio)
          fx.emitir({ x: q.x, y: q.y, z: q.z, vy: 1.2, vida: 0.8, tam: 0.28, tamFim: 0.1, cor: 0xff5a7a, cel: C.coracao, aditivo: false });
        }
      }
    } else { this.fio.comecar(); this.fio.terminar(); }

    // ---------------- vaga-lume (vitória)
    if (e.vagalume) {
      const v = e.vagalume;
      const pul = 1 + Math.sin(t * 5) * 0.15;
      fx.ponto(v.x, v.y, v.z, 2.4 * pul, 0xfff08a, 0.7, C.halo);
      fx.ponto(v.x, v.y, v.z, 0.9 * pul, 0xffffff, 1, C.brilho, t);
      if (Math.random() < dt * 20) fx.emitir({ x: v.x, y: v.y, z: v.z, vx: (Math.random() - 0.5) * 0.6, vy: -0.4, vz: (Math.random() - 0.5) * 0.6, vida: 1.2, tam: 0.2, tamFim: 0, cor: 0xfff4b0, cel: C.brilho, vrot: 3 });
    }
    // recomeço da fase: clarão
    if (this.tRecomeco < 0.6) mk.circulo(M.clarao, 0, 0, 14 * lim(this.tRecomeco / 0.3), 0xffffff, 0, 0.4 * (1 - this.tRecomeco / 0.6));
    mk.terminar();
    void CORPO; void TIRO;
  }

  private evento(ev: string, e: EstadoArena, fx: Particulas3D, herois: readonly [Heroi, Heroi], rei: ReiVisual) {
    const p = ev.split(':');
    const n = p[0];
    const jog = (k: string) => e.jogadores[Number(k)];
    switch (n) {
      case 'pulo': { const j = jog(p[1]); fx.anel(j.x, 0.1, j.z, 7, 0xf0e4f8, 1.6, 0.22, 0.35, 3, false, 0.45); break; }
      case 'pouso': { const j = jog(p[1]); fx.anel(j.x, 0.1, j.z, 9, 0xf0e4f8, 2.2, 0.25, 0.4, 3, false, 0.45); break; }
      case 'esquiva': { const j = jog(p[1]); fx.anel(j.x, 0.15, j.z, 6, 0xf0e4f8, 1.2, 0.28, 0.35, 3, false, 0.45); break; }
      case 'esquiva-perfeita': {
        const j = jog(p[1]);
        fx.emitir({ x: j.x, y: 0.6, z: j.z, vida: 0.45, tam: 0.5, tamFim: 3.2, cor: 0xfff0a0, alfa: 0.95, cel: C.anel });
        fx.explosao(j.x, 0.8, j.z, 14, 0xfff0a0, 4, 0.3, 0.5, C.brilho, 2);
        fx.emitir({ x: j.x, y: 1.7, z: j.z, vy: 1.4, vida: 0.7, tam: 0.6, tamFim: 0.5, cor: 0xffe060, cel: C.exclamacao, aditivo: false, saltar: true });
        break;
      }
      case 'golpe': {
        const h = herois[Number(p[1])];
        fx.explosao(h.ponta.x, h.ponta.y, h.ponta.z, 5, COR_HEROI[Number(p[1])], 2.5, 0.25, 0.3, C.brilho, 0);
        break;
      }
      case 'tiro': {
        const h = herois[Number(p[1])];
        fx.emitir({ x: h.maoE.x, y: h.maoE.y, z: h.maoE.z, vida: 0.15, tam: 0.9, tamFim: 0.2, cor: 0xfff0c0, cel: C.brilho });
        break;
      }
      case 'tiro-pilar': break;
      case 'acerto-rei': {
        const i = Number(p[1]), origem = p[2], dano = Number(p[3]);
        const c = rei.peito;
        const forte = origem === 'cometa' || origem === 'jardim' || origem === 'fio';
        fx.numero(dano, c.x + (Math.random() - 0.5) * 0.8, c.y + 0.6 + Math.random() * 0.5, c.z + (Math.random() - 0.5) * 0.8, origem === 'fio' ? 0xff5a6a : COR_HEROI[i], forte ? 0.95 : origem === 'tiro' ? 0.4 : 0.6);
        const h = herois[i];
        const ponto = origem === 'golpe' ? h.ponta : origem === 'tiro' ? c : c;
        fx.explosao(ponto.x, Math.max(0.6, ponto.y), ponto.z, origem === 'tiro' ? 4 : forte ? 12 : 10, origem === 'tiro' ? 0xfff0c0 : COR_HEROI[i], forte ? 6 : 4, forte ? 0.28 : 0.26, 0.45, C.brilho, 3);
        // anel do impacto na cor de quem acertou, menor e mais transparente (antes: branco, 0,9 e até 4 m, que perto do
        // Rei tapava a tela num clarão de ~0,3 s)
        if (origem !== 'tiro') fx.emitir({ x: ponto.x, y: Math.max(0.6, ponto.y), z: ponto.z, vida: 0.18, tam: 0.5, tamFim: forte ? 2.4 : 1.5, cor: origem === 'fio' ? 0xff5a6a : COR_HEROI[i], alfa: forte ? 0.45 : 0.55, cel: C.anel });
        if (forte) this.tremor = Math.max(this.tremor, 0.35);
        break;
      }
      case 'defendeu': {
        const c = rei.peito;
        fx.explosao(c.x, c.y, c.z, 6, 0xc0a0e0, 2.5, 0.3, 0.4, C.nuvem, 0);
        break;
      }
      case 'poder-cheio': {
        const j = jog(p[1]);
        fx.emitir({ x: j.x, y: 0.7, z: j.z, vida: 0.5, tam: 0.6, tamFim: 3.5, cor: COR_HEROI[Number(p[1])], alfa: 0.9, cel: C.anel });
        fx.explosao(j.x, 0.8, j.z, 18, COR_HEROI[Number(p[1])], 4, 0.3, 0.6, C.brilho, 1);
        break;
      }
      case 'cometa': {
        const j = jog('0');
        fx.emitir({ x: j.x, y: 0.7, z: j.z, vida: 0.4, tam: 1, tamFim: 4.5, cor: 0xffc040, alfa: 0.5, cel: C.anel });
        fx.explosao(j.x, 0.8, j.z, 18, 0xffc040, 7, 0.3, 0.5, C.brilho, 1);
        this.tremor = Math.max(this.tremor, 0.4);
        break;
      }
      case 'jardim': {
        this.tJardim = 0;
        const j = jog('1');
        for (let k = 0; k < 2; k++) fx.emitir({ x: j.x, y: 0.3 + k * 0.5, z: j.z, vida: 0.6 + k * 0.1, tam: 1, tamFim: PODER.jardim.raio * 1.6, cor: k === 1 ? 0xffe0f0 : 0xff7ac8, alfa: 0.45, cel: C.anel });
        fx.explosao(j.x, 0.5, j.z, 28, 0xff9ad8, 6, 0.3, 0.9, C.petala, 3);
        // coluna de luz
        for (let k = 0; k < 12; k++) fx.emitir({ x: j.x, y: k * 0.5, z: j.z, vy: 2, vida: 0.6, tam: 0.9 - k * 0.04, tamFim: 0, cor: 0xff9ad8, alfa: 0.35, cel: C.halo });
        break;
      }
      case 'cura': {
        const h = herois[Number(p[1])];
        const c = h.peito(new THREE.Vector3());
        for (let k = 0; k < 6; k++) fx.emitir({ x: c.x + (Math.random() - 0.5) * 0.8, y: c.y, z: c.z + (Math.random() - 0.5) * 0.8, vy: 1.6 + Math.random(), vida: 1, tam: 0.35, tamFim: 0.2, cor: 0x7aff8a, cel: C.coracao, aditivo: false });
        fx.emitir({ x: c.x, y: c.y, z: c.z, vida: 0.5, tam: 0.6, tamFim: 2.5, cor: 0x9aff9a, alfa: 0.8, cel: C.anel });
        break;
      }
      case 'fio-vermelho': {
        // suave: vermelho e corações, sem véu claro na tela. Antes: 2 anéis aditivos de 5–7 m (um quase branco) e
        // 24 brilhos grandes no peito do Rei; com a câmera perto, a tela clareava ~0,3 s.
        this.tFio = 0;
        this.tremor = Math.max(this.tremor, 0.6);
        const c = rei.peito;
        fx.explosao(c.x, c.y, c.z, 14, 0xff3a4a, 6, 0.3, 0.7, C.brilho, 3);
        fx.explosao(c.x, c.y, c.z, 14, 0xff6a8a, 5, 0.4, 1.1, C.coracao, 2);
        fx.emitir({ x: c.x, y: c.y, z: c.z, vida: 0.45, tam: 1, tamFim: 3.2, cor: 0xff3a4a, alfa: 0.35, cel: C.anel });
        break;
      }
      case 'dano': {
        const h = herois[Number(p[1])];
        const c = h.peito(new THREE.Vector3());
        fx.explosao(c.x, c.y, c.z, 10, 0xff5a5a, 4, 0.35, 0.45, C.estrela, 4);
        fx.emitir({ x: c.x, y: c.y + 0.3, z: c.z, vy: 1.2, vida: 0.7, tam: 0.45, tamFim: 0.3, cor: 0xff4a6a, cel: C.coracao, aditivo: false, saltar: true });
        this.tremor = Math.max(this.tremor, 0.35);
        break;
      }
      case 'bolha': case 'renasce': {
        const h = herois[Number(p[1])];
        const c = h.peito(new THREE.Vector3());
        fx.explosao(c.x, c.y, c.z, 16, n === 'bolha' ? 0xbfe8ff : 0xfff0a0, 4, 0.3, 0.6, C.brilho, 1);
        fx.emitir({ x: c.x, y: c.y, z: c.z, vida: 0.4, tam: 0.5, tamFim: 2.5, cor: 0xffffff, alfa: 0.8, cel: C.anel });
        break;
      }
      case 'recomeca-fase': this.tRecomeco = 0; break;
      case 'perigo': {
        const id = Number(p[2]);
        const pp = e.perigos.find((x) => x.id === id) ?? this.ultimosPerigos.get(id);
        if (!pp) break;
        if (p[1] === 'esporo') {
          fx.explosao(pp.x, 0.3, pp.z, 14, 0xb070f0, 4, 0.6, 0.6, C.nuvem, 6);
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            fx.emitir({ x: pp.x, y: 0.2, z: pp.z, vx: Math.cos(a) * 3.5, vy: 0.6, vz: Math.sin(a) * 3.5, arrasto: 3, vida: 0.7, tam: 0.7, tamFim: 1.4, cor: 0x9a5ad8, alfa: 0.7, cel: C.nuvem, aditivo: false, rot: a });
          }
        } else if (p[1] === 'onda') {
          this.tremor = Math.max(this.tremor, 0.7);
          fx.anel(pp.x, 0.2, pp.z, 20, 0xc8a0f0, 6, 0.5, 0.5, 0, false, 0.5);
          fx.explosao(pp.x, 0.4, pp.z, 20, 0xffa0e0, 6, 0.35, 0.5, C.brilho, 6);
        } else if (p[1] === 'bote' || p[1] === 'mergulho') {
          fx.anel(pp.x, 0.15, pp.z, 10, 0xc8a0f0, 2.5, 0.35, 0.4, 0, false, 0.5);
        }
        break;
      }
      case 'chefe-fase': this.tremor = 1; break;
      case 'parede-sobe': case 'parede-cai': this.tremor = Math.max(this.tremor, 0.4); break;
      case 'cristais-juntos': {
        this.tremor = Math.max(this.tremor, 0.6);
        fx.explosao(0, 3, 0, 40, 0xbff0ff, 8, 0.45, 1, C.brilho, 3);
        break;
      }
      case 'chefe-derrotado': {
        this.tremor = 1;
        const c = rei.peito;
        fx.explosao(c.x, c.y, c.z, 40, 0xffd060, 10, 0.45, 1.4, C.brilho, 2);
        fx.explosao(c.x, c.y, c.z, 40, 0xd8a0ff, 7, 0.6, 1.4, C.estrela, 1);
        for (let k = 0; k < 3; k++) fx.emitir({ x: c.x, y: c.y, z: c.z, vida: 0.6 + k * 0.25, tam: 1, tamFim: 6 + k * 3, cor: k % 2 ? 0xfff0d0 : 0xffd870, alfa: 0.55, cel: C.anel });
        break;
      }
      case 'vitoria': {
        for (let k = 0; k < 40; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 9;
          fx.emitir({ x: Math.sin(a) * r, y: 6 + Math.random() * 4, z: Math.cos(a) * r, vy: -1.2, vx: (Math.random() - 0.5), vida: 3.5, tam: 0.3, tamFim: 0.2, cor: [0xff9ad8, 0xffe066, 0xffffff, 0xb8ffb0][k % 4], cel: C.petala, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 3, aditivo: false });
        }
        break;
      }
    }
  }
}
