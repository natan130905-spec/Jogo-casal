// Natan e Bruna na arena: modelos GLB com esqueleto (natan.glb, bruna.glb), toon + contorno, a arma na mão
// (Espada da Aurora / Lança de Pétala) e a bolha de quem ficou sem corações.
// Animação: a corrida vem do clipe "Run_02" do próprio GLB (amostrado à mão, misturado pela velocidade); parado,
// golpes (combo de 3), esquiva (rolamento), pulo, poder, tiro, dano, bolha e comemoração são poses procedurais:
// cada braço/perna "mira" uma direção no espaço do personagem (independe dos eixos locais dos ossos do Meshy).
// Chamadas por personagem: corpo (1) + contorno (1) + arma (1) + contorno da arma (1) (+ bolha quando precisa).
import * as THREE from 'three';
import { clone as clonarEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARMAS, ESQUIVA, PODER, type EstadoArena, type JogadorArena } from '../../core/arena';
import { materialBolha } from '../materiais';
import { contornoDe, materialContorno, materialToon, type UniformsToon } from './toon';
import { geometriaAssentada, primeiraMalha, texturaDe } from './modelos';
import type { Particulas3D } from './particulas';
import { C } from './atlas';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const suave = (t: number) => t * t * (3 - 2 * t);
const lim = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => 1 - Math.pow(1 - lim(t), 3);

/** Cores de cada um (rastro, números, brilho). */
export const COR_HEROI = [0xffc24a, 0xff8ad0] as const;

type NomeOsso = 'Hips' | 'Spine02' | 'Spine01' | 'Spine' | 'neck' | 'Head' | 'LeftArm' | 'LeftForeArm' | 'LeftHand' | 'RightArm' | 'RightForeArm' | 'RightHand' | 'LeftUpLeg' | 'LeftLeg' | 'LeftFoot' | 'RightUpLeg' | 'RightLeg' | 'RightFoot';

interface Amostra { osso: THREE.Bone; tipo: 'q' | 'p'; interp: THREE.Interpolant }

/** Direção no espaço do personagem: (direita, cima, frente). */
type Dir = [number, number, number];

interface Pose {
  bracoD?: [Dir, Dir]; bracoE?: [Dir, Dir];
  pernaD?: [Dir, Dir]; pernaE?: [Dir, Dir];
  /** giro do tronco (rad, + = para a esquerda), inclinação para a frente, inclinação lateral */
  giro?: number; frente?: number; lado?: number;
  /** abaixa o quadril (m) */
  agacha?: number;
}

export class Heroi {
  readonly raiz = new THREE.Group();
  /** pivô no meio do corpo (rolamento da esquiva, cambalhota) */
  private giro = new THREE.Group();
  private modelo: THREE.Object3D | null = null;
  private ossos = new Map<NomeOsso, THREE.Bone>();
  private repouso = new Map<THREE.Bone, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  private amostras: Amostra[] = [];
  private duracao = 0.733;
  private uCorpo: UniformsToon | null = null;
  private arma = new THREE.Group();
  private armaMat: (THREE.Material & { userData: { u?: UniformsToon } }) | null = null;
  private bolha: THREE.Mesh;
  private sombraY = 0;
  // estado da animação
  private fase = 0;
  private corrida = 0;
  private tTiro = 9;
  private tDano = 9;
  private tPouso = 9;
  private yaw = 0;
  private bolhaVis = 0;
  private iniciou = false;
  /** pontas da arma (mundo) para o rastro: base e ponta */
  readonly base = new THREE.Vector3();
  readonly ponta = new THREE.Vector3();
  readonly mao = new THREE.Vector3();
  readonly maoE = new THREE.Vector3();
  /** a arma está num golpe/poder (o rastro deve aparecer) */
  rastro = 0;
  private comprimentoArma: number;
  private tmpQ = new THREE.Quaternion(); private tmpQ2 = new THREE.Quaternion(); private tmpV = new THREE.Vector3(); private tmpV2 = new THREE.Vector3();
  private qModelo = new THREE.Quaternion();

  constructor(readonly i: 0 | 1, private contorno: boolean, sombras: boolean) {
    this.raiz.name = i === 0 ? 'natan' : 'bruna';
    this.giro.position.y = 0.55;
    this.raiz.add(this.giro);
    this.bolha = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), materialBolha(i === 0 ? 0xffd8a0 : 0xf0c8ff));
    this.bolha.position.y = 0.6; this.bolha.renderOrder = 8; this.bolha.visible = false;
    this.raiz.add(this.bolha);
    this.comprimentoArma = i === 0 ? 0.95 : 1.05;
    this.arma.name = 'arma';
    this.sombraY = sombras ? 1 : 0;
    // forma provisória até o GLB chegar (cápsula com a cor do personagem)
    const prov = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.55, 4, 10), materialToon({ cor: i === 0 ? 0xc0803a : 0xb060c0 }));
    prov.position.y = 0.55 - 0.55;
    prov.name = 'provisorio';
    this.giro.add(prov);
    this.raiz.add(this.arma);
  }

  /** Monta o personagem e a arma a partir dos GLB (chamado quando carregam). */
  montar(corpo: GLTF | null, arma: GLTF | null) {
    if (corpo) {
      const cena = clonarEsqueleto(corpo.scene);
      const prov = this.giro.getObjectByName('provisorio');
      if (prov) this.giro.remove(prov);
      cena.position.y = -0.55;
      this.giro.add(cena);
      this.modelo = cena;
      let malha: THREE.SkinnedMesh | null = null;
      cena.traverse((o) => {
        if ((o as THREE.Bone).isBone) {
          const b = o as THREE.Bone;
          this.ossos.set(b.name as NomeOsso, b);
          this.repouso.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
        }
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) malha = o as THREE.SkinnedMesh;
      });
      if (malha) {
        const m = malha as THREE.SkinnedMesh;
        const mat = materialToon({ mapa: texturaDe(m), proprio: 0.22, borda: this.i === 0 ? 0xffd9a0 : 0xffc8f0, forcaBorda: 0.45 });
        this.uCorpo = mat.userData.u;
        m.material = mat;
        m.frustumCulled = false;
        m.castShadow = this.sombraY > 0;
        if (this.contorno) {
          const c = contornoDe(m, materialContorno(this.i === 0 ? 0x2a1408 : 0x2a0c34, 2.3));
          m.parent!.add(c);
        }
      }
      // amostras do clipe de corrida (só rotações e a posição do quadril)
      const clipe = corpo.animations[0];
      if (clipe) {
        this.duracao = clipe.duration;
        for (const tr of clipe.tracks) {
          const [nome, prop] = tr.name.split('.');
          const osso = this.ossos.get(nome as NomeOsso);
          if (!osso) continue;
          if (prop === 'quaternion') this.amostras.push({ osso, tipo: 'q', interp: (tr as unknown as { createInterpolant(): THREE.Interpolant }).createInterpolant() });
          else if (prop === 'position' && nome === 'Hips') this.amostras.push({ osso, tipo: 'p', interp: (tr as unknown as { createInterpolant(): THREE.Interpolant }).createInterpolant() });
        }
      }
      // lados e frente do modelo: onde está o braço esquerdo e para onde aponta o pé
      cena.updateMatrixWorld(true);
      const be = this.ossos.get('LeftArm'), bd = this.ossos.get('RightArm');
      if (be && bd) {
        const pe = be.getWorldPosition(V(0, 0, 0)), pd = bd.getWorldPosition(V(0, 0, 0));
        this.raiz.worldToLocal(pe); this.raiz.worldToLocal(pd);
        // virado para +z, a esquerda do personagem fica em +x; se estiver ao contrário, gira o modelo
        if (pe.x < pd.x) cena.rotation.y = Math.PI;
      }
    }
    if (arma) {
      const m = primeiraMalha(arma);
      if (m) {
        // Espada: comprida em x, cabo em -x (empunhadura em x ≈ -0,5). Lança: comprida em y, cabo em -y (y ≈ -0,3).
        const g = m.geometry.clone();
        g.computeBoundingBox();
        const bb = g.boundingBox!;
        const espada = this.i === 0;
        const comp = espada ? bb.max.x - bb.min.x : bb.max.y - bb.min.y;
        const k = this.comprimentoArma / comp;
        if (espada) { g.translate(-(bb.min.x + (bb.max.x - bb.min.x) * 0.24), -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2); g.rotateZ(Math.PI / 2); }
        else g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + (bb.max.y - bb.min.y) * 0.3), -(bb.min.z + bb.max.z) / 2);
        // agora as duas: comprimento em +y a partir da empunhadura (0, 0, 0), lado chato no plano x-y
        g.scale(k, k, k);
        g.computeVertexNormals();
        const mat = materialToon({ mapa: texturaDe(m), proprio: espada ? 0.55 : 0.4, borda: espada ? 0xfff0a0 : 0xffd0f0, forcaBorda: 0.6, lados: THREE.DoubleSide });
        this.armaMat = mat;
        const malha = new THREE.Mesh(g, mat);
        malha.castShadow = this.sombraY > 0;
        this.arma.add(malha);
        if (this.contorno) this.arma.add(contornoDe(malha, materialContorno(espada ? 0x4a2a08 : 0x4a1040, 1.8)));
      }
    }
  }

  // ------------------------------------------------------------ ossos
  /** Volta os ossos ao repouso e mistura a corrida (peso w, tempo tc). */
  private posturaBase(w: number, tc: number) {
    for (const [b, r] of this.repouso) { b.quaternion.copy(r.q); b.position.copy(r.p); }
    if (w <= 0.001) return;
    for (const a of this.amostras) {
      const v = a.interp.evaluate(tc);
      if (a.tipo === 'q') { this.tmpQ.set(v[0], v[1], v[2], v[3]); a.osso.quaternion.slerp(this.tmpQ, w); }
      else {
        // só o sobe-e-desce do quadril (o deslocamento para os lados atrapalha no jogo)
        const r = this.repouso.get(a.osso)!;
        a.osso.position.y = r.p.y + (v[1] - r.p.y) * w;
      }
    }
  }

  /** Direção (direita, cima, frente) do personagem → mundo. */
  private dirMundo(d: Dir, out: THREE.Vector3) {
    // no espaço da raiz o personagem olha para +z: direita = -x
    out.set(-d[0], d[1], d[2]).normalize();
    return out.applyQuaternion(this.qModelo);
  }

  /** Gira o osso para que o filho fique na direção `d` (com peso). */
  private mirar(osso: NomeOsso, filho: NomeOsso, d: Dir, w: number) {
    const b = this.ossos.get(osso), f = this.ossos.get(filho);
    if (!b || !f || w <= 0.001) return;
    const pb = b.getWorldPosition(this.tmpV), pf = f.getWorldPosition(this.tmpV2);
    const atual = pf.sub(pb).normalize();
    const alvo = this.dirMundo(d, new THREE.Vector3());
    const R = this.tmpQ.setFromUnitVectors(atual, alvo);
    if (w < 1) R.slerp(this.tmpQ2.identity(), 1 - w);
    this.girarMundo(b, R);
  }

  /** Aplica uma rotação (no mundo) ao osso: L' = P⁻¹ · R · P · L. */
  private girarMundo(b: THREE.Bone, R: THREE.Quaternion) {
    const P = b.parent!.getWorldQuaternion(new THREE.Quaternion());
    const Pi = P.clone().invert();
    b.quaternion.premultiply(P).premultiply(R).premultiply(Pi);
    b.updateMatrixWorld(true);
  }

  /** Gira o osso em torno de um eixo do personagem (direita, cima, frente). */
  private girarEixo(osso: NomeOsso, eixo: Dir, ang: number) {
    const b = this.ossos.get(osso);
    if (!b || Math.abs(ang) < 1e-4) return;
    const e = this.dirMundo(eixo, new THREE.Vector3());
    this.girarMundo(b, new THREE.Quaternion().setFromAxisAngle(e, ang));
  }

  private aplicarPose(p: Pose, w: number) {
    if (w <= 0.001) return;
    const DIR: Dir = [1, 0, 0], CIMA: Dir = [0, 1, 0], FRENTE: Dir = [0, 0, 1];
    if (p.agacha) { const h = this.ossos.get('Hips'); if (h) { h.position.y -= (p.agacha * w) / 0.01; h.updateMatrixWorld(true); } }
    if (p.giro) { this.girarEixo('Spine01', CIMA, p.giro * w * 0.5); this.girarEixo('Spine', CIMA, p.giro * w * 0.5); }
    if (p.frente) { this.girarEixo('Spine01', DIR, p.frente * w * 0.6); this.girarEixo('Spine', DIR, p.frente * w * 0.4); }
    if (p.lado) this.girarEixo('Spine01', FRENTE, p.lado * w);
    if (p.bracoD) { this.mirar('RightArm', 'RightForeArm', p.bracoD[0], w); this.mirar('RightForeArm', 'RightHand', p.bracoD[1], w); }
    if (p.bracoE) { this.mirar('LeftArm', 'LeftForeArm', p.bracoE[0], w); this.mirar('LeftForeArm', 'LeftHand', p.bracoE[1], w); }
    if (p.pernaD) { this.mirar('RightUpLeg', 'RightLeg', p.pernaD[0], w); this.mirar('RightLeg', 'RightFoot', p.pernaD[1], w); }
    if (p.pernaE) { this.mirar('LeftUpLeg', 'LeftLeg', p.pernaE[0], w); this.mirar('LeftLeg', 'LeftFoot', p.pernaE[1], w); }
  }

  // ------------------------------------------------------------ poses
  /** Direção da arma e pose do golpe `c` no instante p (0…1) do golpe. */
  private golpe(c: number, p: number): { pose: Pose; arma: Dir; forca: number } {
    const espada = this.i === 0;
    // antecipação (0–0,3), golpe rápido (0,3–0,55), acompanhamento (0,55–1)
    const k = p < 0.3 ? -0.25 * suave(p / 0.3) : p < 0.55 ? -0.25 + 1.25 * ease((p - 0.3) / 0.25) : 1;
    const forca = p > 0.25 && p < 0.7 ? 1 : p < 0.25 ? 0 : 1 - (p - 0.7) / 0.3;
    if (espada) {
      if (c === 0 || c === 1) {
        // corte horizontal: da direita para a esquerda (c = 0) e de volta (c = 1)
        const s = c === 0 ? 1 : -1;
        const th = s * (-1.9 + 3.4 * k);
        const d: Dir = [-Math.sin(th) * s * s, (c === 0 ? 0.25 - 0.45 * k : -0.25 + 0.5 * k), Math.cos(th)];
        const arma: Dir = [d[0], d[1], d[2]];
        return {
          pose: { bracoD: [[d[0] * 0.6 + 0.35, -0.45 + d[1] * 0.5, d[2] * 0.7 + 0.2], arma], bracoE: [[-0.35, -0.6, 0.4], [-0.2, -0.2, 1]], giro: -th * 0.35, frente: 0.12, agacha: 0.06, pernaD: [[0.15, -1, -0.25], [0.1, -1, -0.35]], pernaE: [[-0.1, -1, 0.3], [-0.1, -1, 0]] },
          arma, forca,
        };
      }
      // golpe 3: de cima para baixo, com um pulinho
      const ph = -0.7 + 2.6 * k;
      const arma: Dir = [-0.15, Math.cos(ph), Math.sin(ph)];
      return {
        pose: { bracoD: [[0.25, Math.cos(ph) * 0.8 + 0.1, Math.sin(ph) * 0.8 + 0.2], arma], bracoE: [[-0.2, Math.cos(ph) * 0.6, Math.sin(ph) * 0.6 + 0.3], arma], frente: 0.35 * k - 0.15, agacha: 0.12 * k, pernaD: [[0.1, -1, -0.4], [0.1, -1, -0.3]], pernaE: [[-0.1, -0.85, 0.55], [-0.1, -1, 0]] },
        arma, forca,
      };
    }
    // Lança de Pétala
    if (c === 0 || c === 2) {
      // estocada: puxa para trás e empurra para a frente (o 3º é mais fundo)
      const fundo = c === 2 ? 1.4 : 1;
      const ext = p < 0.3 ? -0.5 * suave(p / 0.3) : p < 0.55 ? -0.5 + 1.5 * ease((p - 0.3) / 0.25) : 1 - 0.4 * suave((p - 0.55) / 0.45);
      const arma: Dir = [-0.12, -0.05 - (c === 2 ? 0.12 : 0), 1];
      return {
        pose: { bracoD: [[0.3, -0.55 + ext * 0.35, -0.3 + ext * 0.9], [0.05, -0.15, 1]], bracoE: [[-0.15, -0.35 + ext * 0.2, 0.2 + ext * 0.8], [0.15, -0.05, 1]], giro: 0.35 - ext * 0.45, frente: 0.1 + ext * 0.2 * fundo, agacha: 0.06 + 0.08 * Math.max(0, ext) * fundo, pernaD: [[0.12, -1, -0.45 * fundo], [0.1, -1, -0.3]], pernaE: [[-0.1, -0.85, 0.5 * fundo], [-0.1, -1, 0.05]] },
        arma, forca,
      };
    }
    // golpe 2: varrida larga
    const th = -1.3 + 2.6 * k;
    const arma: Dir = [-Math.sin(th), -0.05, Math.cos(th)];
    return {
      pose: { bracoD: [[arma[0] * 0.5 + 0.3, -0.35, arma[2] * 0.6 + 0.2], arma], bracoE: [[-0.25, -0.4, 0.6], arma], giro: -th * 0.45, frente: 0.1, agacha: 0.08 },
      arma, forca,
    };
  }

  // ------------------------------------------------------------ quadro
  atualizar(j: JogadorArena, e: EstadoArena, dt: number, t: number, fx: Particulas3D, alvo: { x: number; z: number } | null) {
    const i = this.i;
    for (const ev of e.eventos) {
      const [n, q] = ev.split(':');
      if (Number(q) !== i) continue;
      if (n === 'tiro') this.tTiro = 0;
      else if (n === 'dano') this.tDano = 0;
      else if (n === 'pouso') this.tPouso = 0;
    }
    this.tTiro += dt; this.tDano += dt; this.tPouso += dt;

    // posição e direção (o corpo vira suave; o núcleo já dá `ang`)
    this.raiz.position.set(j.x, j.y, j.z);
    let dAng = j.ang - this.yaw;
    dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
    if (!this.iniciou) { this.yaw = j.ang; this.iniciou = true; } else this.yaw += dAng * Math.min(1, dt * (j.acao === 'livre' ? 14 : 30));
    this.raiz.rotation.y = this.yaw;

    // bolha
    this.bolhaVis += ((j.bolha ? 1 : 0) - this.bolhaVis) * Math.min(1, dt * 8);
    this.bolha.visible = this.bolhaVis > 0.02;
    this.bolha.scale.setScalar(0.4 + 0.6 * this.bolhaVis + Math.sin(t * 3) * 0.03);
    // pisca na invencibilidade (sem sumir de vez)
    const piscando = j.invencivel > 0 && !j.bolha && Math.floor(t * 14) % 2 === 0;
    if (this.uCorpo) {
      const clarao = Math.max(0, 1 - this.tDano / 0.15) * 0.6;
      this.uCorpo.uClarao.value = Math.max(clarao, piscando ? 0.2 : 0);
      this.uCorpo.uTinta.value.setRGB(1, piscando ? 0.85 : 1, piscando ? 0.9 : 1);
    }

    // giro (rolamento da esquiva, cambalhota do cometa)
    this.giro.rotation.set(0, 0, 0);
    this.giro.position.y = 0.55;
    const vel = Math.hypot(j.vx, j.vz);

    if (!this.modelo) { this.qModelo.copy(this.raiz.quaternion); this.posArma(null, j, t); return; }
    // corrida
    const correndo = j.acao === 'livre' && j.noChao && !j.bolha && !e.vitoria;
    this.corrida += ((correndo ? lim(vel / 3) : 0) - this.corrida) * Math.min(1, dt * 10);
    this.fase = (this.fase + dt * lim(0.55 + vel / 7.5) / this.duracao) % 1;
    this.posturaBase(this.corrida, this.fase * this.duracao);
    this.raiz.updateMatrixWorld(true);

    const espada = i === 0;
    let pose: Pose | null = null;
    let armaDir: Dir | null = null;
    let wPose = 1;
    this.rastro = 0;
    const respira = Math.sin(t * 2.4 + i);

    if (j.bolha) {
      pose = { bracoD: [[0.25, -0.4, 0.9], [-0.4, 0.3, 0.6]], bracoE: [[-0.25, -0.4, 0.9], [0.4, 0.3, 0.6]], pernaD: [[0.15, -0.2, 1], [0.1, -1, -0.1]], pernaE: [[-0.15, -0.2, 1], [-0.1, -1, -0.1]], frente: 0.4 };
      armaDir = [0.2, 0.3, 1];
      this.giro.rotation.z = Math.sin(t * 1.3) * 0.25;
      this.giro.position.y = 0.55 + Math.sin(t * 2) * 0.05;
    } else if (e.vitoria) {
      const pula = Math.abs(Math.sin(t * 4 + i * 1.3));
      pose = { bracoD: [[0.45, 0.9, 0.1], [0.3, 1, 0.2]], bracoE: [[-0.45, 0.9, 0.1], [-0.3 + Math.sin(t * 8) * 0.4, 1, 0.1]], frente: -0.15 };
      armaDir = [0.1, 1, 0.15];
      this.giro.position.y = 0.55 + pula * 0.18;
    } else if (j.acao === 'golpe') {
      const arma = ARMAS[i];
      const g = this.golpe(j.combo, lim(j.tAcao / arma.dura));
      pose = g.pose; armaDir = g.arma; this.rastro = g.forca;
    } else if (j.acao === 'esquiva') {
      const p = lim(j.tAcao / ESQUIVA.dura);
      // rolamento para a direção da esquiva (o corpo já olha para lá? usa o eixo lateral da direção)
      const eixo = V(j.dz, 0, -j.dx).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(eixo, suave(p) * Math.PI * 2);
      const inv = this.raiz.quaternion.clone().invert();
      this.giro.quaternion.copy(inv.multiply(q).multiply(this.raiz.quaternion));
      this.giro.position.y = 0.42;
      pose = { bracoD: [[0.3, -0.3, 0.8], [-0.2, 0.4, 0.8]], bracoE: [[-0.3, -0.3, 0.8], [0.2, 0.4, 0.8]], pernaD: [[0.12, -0.15, 1], [0.1, -1, -0.2]], pernaE: [[-0.12, -0.15, 1], [-0.1, -1, -0.2]], frente: 0.6, agacha: 0.15 };
      armaDir = [0, -0.4, -1];
    } else if (j.acao === 'poder') {
      if (espada) {
        // Corte Cometa: avanço com a espada à frente, corpo deitado, braço de trás esticado
        pose = { bracoD: [[0.2, -0.05, 1], [0.05, 0, 1]], bracoE: [[-0.5, 0.1, -0.85], [-0.3, 0.2, -1]], frente: 0.55, pernaD: [[0.1, -0.7, -0.7], [0.1, -0.6, -0.8]], pernaE: [[-0.1, -0.85, 0.5], [-0.1, -1, 0]], agacha: 0.08 };
        armaDir = [0, 0.05, 1];
        this.rastro = 0.7;
      } else {
        // Jardim de Luz: ergue a lança e finca no chão
        const p = lim(j.tAcao / PODER.jardim.lancar);
        const desce = ease((p - 0.55) / 0.25);
        const d: Dir = [-0.1, 1 - desce * 1.8, 0.2 + desce * 0.5];
        pose = { bracoD: [[0.3, 0.8 - desce * 1.2, 0.3 + desce * 0.5], d], bracoE: [[-0.3, 0.8 - desce * 1.1, 0.3 + desce * 0.5], d], frente: -0.15 + desce * 0.45, agacha: desce * 0.18, pernaD: [[0.15, -1, -0.3 * desce], [0.1, -1, -0.2]], pernaE: [[-0.15, -0.9, 0.35 * desce], [-0.1, -1, 0]] };
        armaDir = d;
        this.rastro = 0; // a lança sobe e desce perto da câmera: o rastro viraria um triângulo enorme
      }
    } else if (!j.noChao) {
      // pulo: subindo encolhe uma perna; caindo abre os braços
      const sobe = j.vy > 0;
      pose = sobe
        ? { bracoD: [[0.5, 0.1, 0.5], [0.1, 0.6, 0.8]], bracoE: [[-0.7, 0.35, 0.1], [-0.6, 0.6, 0.2]], pernaD: [[0.1, -0.35, 1], [0.1, -1, -0.15]], pernaE: [[-0.1, -1, -0.2], [-0.1, -1, -0.45]], frente: 0.1 }
        : { bracoD: [[0.6, 0.0, 0.45], [0.2, 0.5, 0.8]], bracoE: [[-0.8, 0.2, 0.1], [-0.7, 0.5, 0]], pernaD: [[0.12, -0.8, 0.5], [0.1, -1, -0.2]], pernaE: [[-0.12, -1, 0.1], [-0.1, -1, -0.1]], frente: 0.05 };
      armaDir = espada ? [0.15, 0.55, 0.85] : [-0.15, 0.8, 0.5];
    } else {
      // parado (em guarda) — misturado com a corrida pelo peso
      wPose = 1 - this.corrida;
      const pouso = Math.max(0, 1 - this.tPouso / 0.22);
      pose = espada
        ? { bracoD: [[0.35, -0.85, 0.3], [0.05, -0.15, 1]], bracoE: [[-0.32, -0.92, 0.12 + respira * 0.03], [-0.12, -0.75, 0.55]], frente: 0.06 + respira * 0.02 + pouso * 0.2, agacha: pouso * 0.12, pernaD: [[0.14, -1, -0.12], [0.12, -1, -0.05]], pernaE: [[-0.14, -1, 0.1], [-0.12, -1, 0]] }
        : { bracoD: [[0.38, -0.85, 0.2], [0.15, -0.35, 0.95]], bracoE: [[-0.3, -0.9, 0.2 + respira * 0.03], [-0.05, -0.6, 0.7]], frente: 0.04 + respira * 0.02 + pouso * 0.2, agacha: pouso * 0.12, pernaD: [[0.14, -1, -0.1], [0.12, -1, -0.05]], pernaE: [[-0.14, -1, 0.08], [-0.12, -1, 0]] };
      armaDir = espada ? [0.05, 0.85, 0.5] : [-0.05, 1, 0.12];
      if (this.corrida > 0.3) armaDir = espada ? [0.25, 0.35, -0.9] : [-0.1, 0.45, -0.9];
    }
    this.raiz.updateMatrixWorld(true);
    this.giro.getWorldQuaternion(this.qModelo);
    if (pose) this.aplicarPose(pose, wPose);
    // dano: tranco para trás
    if (this.tDano < 0.35) this.aplicarPose({ frente: -0.45 * (1 - this.tDano / 0.35) }, 1);
    // tiro: braço esquerdo aponta para a frente (a Lança-Estrelas sai da mão)
    if (this.tTiro < 0.28 && !j.bolha) this.aplicarPose({ bracoE: [[-0.25, 0.05, 1], [-0.12, 0.1, 1]], giro: 0.25 }, 1 - this.tTiro / 0.28);
    // a cabeça olha para o alvo (o Rei), dentro de um limite
    if (alvo && !j.bolha && j.acao !== 'esquiva') {
      const ang = Math.atan2(alvo.x - j.x, alvo.z - j.z) - this.yaw;
      const rel = Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(ang), Math.cos(ang))));
      this.girarEixo('neck', [0, 1, 0], rel * 0.6);
    }
    this.posArma(armaDir, j, t);
    // brilho da arma: poder cheio pulsa; no poder, acende
    if (this.armaMat?.userData.u) {
      const u = this.armaMat.userData.u;
      const cheio = j.poder >= PODER.max;
      u.uClarao.value = j.acao === 'poder' ? 0.55 : cheio ? 0.15 + 0.15 * Math.sin(t * 8) : this.rastro > 0.5 ? 0.15 : 0;
    }
    void fx;
  }

  /** Põe a arma na mão (posição do osso da mão) apontando para `d` (espaço do personagem). */
  private posArma(d: Dir | null, j: JogadorArena, t: number) {
    this.raiz.updateMatrixWorld(true);
    const mao = this.ossos.get('RightHand');
    if (mao) {
      mao.getWorldPosition(this.mao);
      // um pouco à frente do osso (o punho fecha na palma)
      const ante = this.ossos.get('RightForeArm');
      if (ante) { const pa = ante.getWorldPosition(this.tmpV); this.mao.add(this.tmpV2.subVectors(this.mao, pa).multiplyScalar(0.35)); }
    } else this.mao.set(j.x + Math.cos(this.yaw) * -0.25, j.y + 0.55, j.z);
    const me = this.ossos.get('LeftHand');
    if (me) me.getWorldPosition(this.maoE); else this.maoE.copy(this.mao);
    const dir = this.dirMundo(d ?? [0, 0.6, 0.8], new THREE.Vector3());
    // lado chato da lâmina: perpendicular à direção e ao "cima" do personagem
    const cima = V(0, 1, 0);
    let lado = new THREE.Vector3().crossVectors(dir, cima);
    if (lado.lengthSq() < 1e-4) lado = this.dirMundo([1, 0, 0], new THREE.Vector3());
    lado.normalize();
    const z = new THREE.Vector3().crossVectors(lado, dir).normalize();
    const m = new THREE.Matrix4().makeBasis(lado, dir, z);
    const alvoQ = new THREE.Quaternion().setFromRotationMatrix(m);
    // a arma fica no espaço do personagem (filha da raiz)
    const inv = this.raiz.quaternion.clone().invert();
    this.arma.quaternion.copy(inv.multiply(alvoQ));
    const local = this.raiz.worldToLocal(this.mao.clone());
    this.arma.position.copy(local);
    // pontas para o rastro
    this.base.copy(this.mao).addScaledVector(dir, this.comprimentoArma * 0.25);
    this.ponta.copy(this.mao).addScaledVector(dir, this.comprimentoArma * 0.78);
    void t;
  }

  /** Ponto do peito (mundo), para efeitos de cura/dano. */
  peito(out: THREE.Vector3) { return out.set(this.raiz.position.x, this.raiz.position.y + 0.7, this.raiz.position.z); }
}

/** Sombra/altura: usada pela cena para desenhar a sombra-bolha. */
export function alturaHeroi(j: JogadorArena) { return j.bolha ? 1.2 : 0; }
void geometriaAssentada;
