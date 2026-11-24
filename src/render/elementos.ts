// Elementos de jogo do núcleo novo: estrelinhas de lembrança (girando), estrelinhas soltas pelos bichinhos,
// lanternas de checkpoint (apagada/acesa), argolas de pêndulo, plataformas especiais (móvel, giratória de relógio,
// gelatina, a que cai e a bolha), o Fio Vermelho (corda macia que pende em catenária e estica quando tensa),
// faíscas do Lança-Estrelas com rastro, esporos e os efeitos dos eventos (tiro, dano, bolha, coleta…).
// Chamadas de desenho: estrelinhas 1 (instanciadas), vidros das lanternas 1 (instanciados), peças fixas 1, cada
// plataforma especial 1 (+1 o ponteiro do relógio), cada corda visível 1. Brilhos e rastros vão no lote de partículas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { DefEspecial, Estado, Fase } from '../core/types';
import type { Qualidade } from './cena';
import type { Tema } from './tema';
import { materialBolha, materialMundo } from './materiais';
import { colocar, misturar, pintar } from './util';
import { Cel, type Particulas } from './particulas';

const AMARRA = 0.6;

/** Inclinação (rad, em z) do corpo de quem está pendurado, apontando para `alvo` (de onde a corda puxa). */
export function inclinacaoCorda(j: { x: number; y: number }, alvo: { x: number; y: number }) {
  return Math.max(-0.6, Math.min(0.6, -Math.atan2(alvo.x - j.x, alvo.y - (j.y + 1.0)) * 0.6));
}
/** Mãos de quem está pendurado com inclinação `inc` (o corpo gira em torno do meio, a 0,55 m dos pés). */
export function maosPendurado(j: { x: number; y: number }, inc: number, v: THREE.Vector3) {
  return v.set(j.x - Math.sin(inc) * 0.47, j.y + 0.55 + Math.cos(inc) * 0.47, 0.1);
}

// ---------------------------------------------------------------- corda (Fio Vermelho)
/** Tubo de topologia fixa (N segmentos × M lados) cujos vértices são recalculados a cada quadro. */
export class Corda {
  readonly malha: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array;
  private pts: THREE.Vector3[];
  private tensao = 0;
  constructor(private N = 28, private M = 6, private raio = 0.032, cor = 0xd8203a) {
    const nv = (N + 1) * M;
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    const idx: number[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = a + M, d = b + M;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const mat = new THREE.MeshLambertMaterial({ color: cor, emissive: 0x6a0818 });
    this.malha = new THREE.Mesh(g, mat);
    this.malha.frustumCulled = false;
    this.malha.visible = false;
    this.pts = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  }
  /**
   * Corda de comprimento L entre a e b. Frouxa: pende numa parábola (aproximação da catenária) com a flecha que
   * dá o comprimento certo. Esticada: reta, mais fina, vibrando um pouco e brilhando mais.
   */
  desenhar(a: THREE.Vector3, b: THREE.Vector3, L: number, relogio: number, piso?: number) {
    const d = a.distanceTo(b);
    const folga = Math.max(0, L - d);
    let flecha = Math.min(Math.sqrt((3 * d * folga) / 8), folga / 2);
    const tensa = folga < 0.06;
    this.tensao += ((tensa ? 1 : 0) - this.tensao) * 0.2;
    if (tensa) flecha = Math.sin(relogio * 38) * 0.012 * (1 + Math.min(1, d / 4));
    const { N, M, pts } = this;
    // frouxa entre dois que estão de pé: a corda deita no chão (pés ≈ cintura − 0,55) em vez de atravessá-lo
    const chao = piso ?? -Infinity;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts[i].lerpVectors(a, b, t);
      pts[i].y = Math.max(pts[i].y - 4 * flecha * t * (1 - t), chao);
    }
    const r = this.raio * (1 - this.tensao * 0.25);
    const tan = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(N, i + 1)];
      tan.subVectors(p1, p0).normalize();
      n1.crossVectors(tan, Math.abs(tan.z) > 0.9 ? up : z).normalize();
      n2.crossVectors(tan, n1).normalize();
      // pontas um pouco mais grossas (o nó na cintura / nas mãos)
      const rr = r * (i === 0 || i === N ? 1.6 : 1);
      for (let j = 0; j < M; j++) {
        const ang = (j / M) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const k = (i * M + j) * 3;
        const nx = n1.x * c + n2.x * s, ny = n1.y * c + n2.y * s, nz = n1.z * c + n2.z * s;
        this.pos[k] = pts[i].x + nx * rr; this.pos[k + 1] = pts[i].y + ny * rr; this.pos[k + 2] = pts[i].z + nz * rr;
        this.nor[k] = nx; this.nor[k + 1] = ny; this.nor[k + 2] = nz;
      }
    }
    const g = this.malha.geometry;
    g.getAttribute('position').needsUpdate = true; g.getAttribute('normal').needsUpdate = true;
    (this.malha.material as THREE.MeshLambertMaterial).emissive.setRGB(0.42 + this.tensao * 0.5, 0.03 + this.tensao * 0.12, 0.08 + this.tensao * 0.1);
    this.malha.visible = true;
  }
  /** Ponto do meio (para os brilhos da corda). */
  meio() { return this.pts[this.N >> 1]; }
  ponto(t: number) { return this.pts[Math.round(t * this.N)]; }
  get tenso() { return this.tensao > 0.5; }
  esconder() { this.malha.visible = false; }
}

// ---------------------------------------------------------------- formas
/** Estrela de 5 pontas gordinha (a estrelinha de lembrança). */
function geoEstrelinha(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.46 : 1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.14, bevelSegments: 2, curveSegments: 1 });
  g.center();
  g.computeVertexNormals();
  return g;
}

/** Estrela de 4 pontas (o símbolo da capa), extrudada. */
export function geoEstrela4(r: number, fina: number, prof: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? fina : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: prof * 0.5, bevelSize: prof * 0.4, bevelSegments: 1 });
  g.center();
  return g;
}

interface VisEspecial {
  def: DefEspecial; malha: THREE.Object3D; ponteiro: THREE.Mesh | null;
  mola: number; vmola: number; sAntes: number;
}

// ---------------------------------------------------------------- elementos
export class Elementos {
  readonly raiz = new THREE.Group();
  private estrelas: THREE.InstancedMesh;
  private nEstrelas: number;
  private vidros: THREE.InstancedMesh | null = null;
  private especiais: VisEspecial[] = [];
  private fio = new Corda();
  private cordasArgola: [Corda, Corda] = [new Corda(10, 6, 0.028), new Corda(10, 6, 0.028)];
  private coletadasAntes = new Set<number>();
  private checkAntes = -1;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private rastro = 0;
  private eu = new THREE.Euler();
  private corLit: THREE.Color; private corApagada = new THREE.Color(0x4a3a5e);

  constructor(private fase: Fase, q: Qualidade, private tema: Tema) {
    // estrelinhas: as da fase + até 24 soltas por bichinhos
    this.nEstrelas = (fase.estrelinhas ?? []).length;
    const matEstrela = new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xa86a00 });
    this.estrelas = new THREE.InstancedMesh(geoEstrelinha(), matEstrela, this.nEstrelas + 24);
    this.estrelas.count = 0;
    this.estrelas.frustumCulled = false;
    this.raiz.add(this.estrelas);

    // peças fixas: postes das lanternas, argolas e mostradores dos relógios — num lote só
    const fixas: THREE.BufferGeometry[] = [];
    const lanternas = fase.lanternas ?? [];
    for (const l of lanternas) {
      const z = -0.95, x = l.x;
      const poste = new THREE.CylinderGeometry(0.05, 0.07, 1.75, 6); colocar(poste, x, l.y + 0.875, z); fixas.push(pintar(poste, 0x4a3a52));
      const base = new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8); colocar(base, x, l.y + 0.06, z); fixas.push(pintar(base, 0x6a5a70));
      const braco = new THREE.TorusGeometry(0.2, 0.025, 4, 8, Math.PI / 2); colocar(braco, x + 0.2, l.y + 1.75, z, 1, [0, 0, Math.PI / 2]); fixas.push(pintar(braco, 0x4a3a52));
      const bola = new THREE.SphereGeometry(0.06, 6, 4); colocar(bola, x, l.y + 1.8, z); fixas.push(pintar(bola, 0xc89a40));
      const tampa = new THREE.ConeGeometry(0.19, 0.14, 6); colocar(tampa, x + 0.4, l.y + 1.52, z); fixas.push(pintar(tampa, 0x3a2e44));
      const fundo = new THREE.CylinderGeometry(0.13, 0.1, 0.06, 6); colocar(fundo, x + 0.4, l.y + 1.13, z); fixas.push(pintar(fundo, 0x3a2e44));
      const gancho = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 3); colocar(gancho, x + 0.4, l.y + 1.64, z); fixas.push(pintar(gancho, 0x2a2030));
      for (const s of [-1, 1]) for (const t of [-1, 1]) { const h = new THREE.BoxGeometry(0.025, 0.32, 0.025); colocar(h, x + 0.4 + s * 0.11, l.y + 1.3, z + t * 0.11); fixas.push(pintar(h, 0x3a2e44)); }
    }
    if (lanternas.length) {
      const vidro = new THREE.CylinderGeometry(0.115, 0.115, 0.32, 6);
      this.vidros = new THREE.InstancedMesh(vidro, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), lanternas.length);
      lanternas.forEach((l, k) => {
        this.vidros!.setMatrixAt(k, this.m.makeTranslation(l.x + 0.4, l.y + 1.3, -0.95));
        this.vidros!.setColorAt(k, this.corApagada);
      });
      this.vidros.computeBoundingSphere();
      this.raiz.add(this.vidros);
    }
    this.corLit = new THREE.Color(tema.brilho).lerp(new THREE.Color(0xfff2c0), 0.45);
    for (const g of fase.argolas ?? []) {
      const anel = new THREE.TorusGeometry(0.17, 0.035, 6, 16); colocar(anel, g.x, g.y - 0.12, 0); fixas.push(pintar(anel, (_p, n, c) => misturar(c, 0xc08a20, 0xffe070, 0.5 + n.y * 0.5)));
      const corr = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4); colocar(corr, g.x, g.y + 0.2, 0); fixas.push(pintar(corr, 0x5a4a60));
      const placa = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8); colocar(placa, g.x, g.y + 0.4, 0); fixas.push(pintar(placa, 0x6a5a70));
    }
    // mostradores de relógio atrás das giratórias (um por centro)
    const centros = new Map<string, { cx: number; cy: number; r: number }>();
    for (const d of fase.especiais ?? []) if (d.tipo === 'giratoria') {
      const key = `${d.cx},${d.cy}`;
      const r = Math.max(centros.get(key)?.r ?? 0, d.raio + d.w / 2 + 0.25);
      centros.set(key, { cx: d.cx, cy: d.cy, r });
    }
    for (const { cx, cy, r } of centros.values()) {
      const z = -1.3;
      const disco = new THREE.CylinderGeometry(r, r, 0.12, 40); disco.rotateX(Math.PI / 2); colocar(disco, cx, cy, z);
      fixas.push(pintar(disco, (p, n, c) => (n.z > 0.5 ? misturar(c, 0xfff0d0, 0xf0d8a8, Math.hypot(p.x - cx, p.y - cy) / r) : c.setHex(0xa87838))));
      const aro = new THREE.TorusGeometry(r, 0.12, 6, 40); colocar(aro, cx, cy, z + 0.06); fixas.push(pintar(aro, (_p, n, c) => misturar(c, 0xa07020, 0xf0c860, 0.5 + n.y * 0.5)));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, mk = new THREE.BoxGeometry(i % 3 ? 0.06 : 0.12, 0.28, 0.04);
        colocar(mk, cx + Math.sin(a) * (r - 0.3), cy + Math.cos(a) * (r - 0.3), z + 0.08, 1, [0, 0, -a]); fixas.push(pintar(mk, 0x4a3020));
      }
      const eixo = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10); eixo.rotateX(Math.PI / 2); colocar(eixo, cx, cy, z + 0.2); fixas.push(pintar(eixo, 0xc89a40));
    }
    if (fixas.length) {
      const g = mergeGeometries(fixas)!; for (const x of fixas) x.dispose();
      g.computeBoundingSphere();
      this.raiz.add(new THREE.Mesh(g, materialMundo(q, { ruido: false })));
    }

    // plataformas especiais
    const matEsp = materialMundo(q, { ruido: q !== 'baixa', forcaRuido: 0.12 });
    const P = tema.plataforma;
    for (const d of fase.especiais ?? []) {
      let malha: THREE.Object3D, ponteiro: THREE.Mesh | null = null;
      const prof = 1.5;
      switch (d.tipo) {
        case 'movel': {
          const g = new RoundedBoxGeometry(d.w, d.h, prof, 2, Math.min(d.h, 0.3) * 0.45);
          g.translate(d.w / 2, d.h / 2, 0);
          const parts = [pintar(g, (p, n, c) => (n.y > 0.5 && p.y > d.h * 0.7 ? misturar(c, P.topo, 0xffffff, 0.12) : misturar(c, P.lado, P.topo, Math.max(0, p.y / d.h - 0.75) * 2)))];
          // fundo fofinho (nuvem mágica que a sustenta) e duas gemas
          const nuvem = new THREE.SphereGeometry(0.5, 10, 6); colocar(nuvem, d.w / 2, -0.05, 0, [d.w * 0.95, 0.35, prof * 0.85]);
          parts.push(pintar(nuvem, (_p, n, c) => misturar(c, P.lado, 0xffffff, 0.35 + Math.max(0, -n.y) * 0.3)));
          for (const s of [0.2, 0.8]) { const gm = new THREE.OctahedronGeometry(0.08, 0); colocar(gm, d.w * s, d.h * 0.45, prof / 2 + 0.02); parts.push(pintar(gm, P.detalhe)); }
          malha = new THREE.Mesh(mergeGeometries(parts)!, matEsp);
          break;
        }
        case 'giratoria': {
          // a plataforma é a ponta do ponteiro: placa de latão com a ponta de seta
          const g = new RoundedBoxGeometry(d.w, d.h, prof * 0.8, 2, d.h * 0.4); g.translate(d.w / 2, d.h / 2, 0);
          const parts = [pintar(g, (_p, n, c) => misturar(c, 0x8a5a24, 0xf0c860, 0.5 + n.y * 0.45))];
          const rebite = new THREE.SphereGeometry(0.07, 6, 4); colocar(rebite, d.w / 2, d.h / 2, prof * 0.4); parts.push(pintar(rebite, 0xfff0b0));
          malha = new THREE.Mesh(mergeGeometries(parts)!, matEsp);
          const haste = new THREE.BoxGeometry(1, 0.12, 0.08); haste.translate(0.5, 0, 0);
          ponteiro = new THREE.Mesh(pintar(haste, 0x3a2414), matEsp);
          ponteiro.position.set(d.cx, d.cy, -1.05);
          break;
        }
        case 'quicante': {
          const g = new RoundedBoxGeometry(d.w, d.h + 0.1, prof, 3, 0.16); g.translate(0, (d.h + 0.1) / 2, 0);
          const cor = this.tema.chave === 'doces' ? 0x7ad85a : 0xff6aa8;
          const mat = new THREE.MeshToonMaterial({ color: cor, emissive: new THREE.Color(cor).multiplyScalar(0.35) });
          const m = new THREE.Mesh(g, mat);
          // brilho de gelatina (reflexo) e a base
          const reflexo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
          reflexo.scale.set(d.w * 2, 0.5, 1); reflexo.position.set(-d.w * 0.15, d.h * 0.85, prof / 2 - 0.05);
          m.add(reflexo);
          const grupo = new THREE.Group(); grupo.add(m);
          m.position.x = d.w / 2;
          malha = grupo;
          break;
        }
        case 'cai': {
          // tábuas rachadas (madeira ou biscoito), com uma rachadura no meio
          const parts: THREE.BufferGeometry[] = [];
          const n = Math.max(2, Math.round(d.w / 0.38));
          for (let i = 0; i < n; i++) {
            const tw = d.w / n;
            const b = new THREE.BoxGeometry(tw - 0.03, d.h, prof, 1, 1, 1);
            colocar(b, tw * (i + 0.5), d.h / 2 - (i % 2) * 0.02, 0, 1, [0, 0, (i - n / 2) * 0.01]);
            parts.push(pintar(b, (_p, nn, c) => misturar(c, misturar(new THREE.Color(), P.lado, 0x2a1810, 0.25).getHex(), P.detalhe, 0.5 + nn.y * 0.5)));
          }
          const racha = new THREE.BoxGeometry(0.04, d.h * 1.02, prof * 1.01); colocar(racha, d.w * 0.52, d.h / 2, 0, 1, [0, 0, 0.3]); parts.push(pintar(racha, 0x1a0e08));
          malha = new THREE.Mesh(mergeGeometries(parts)!, matEsp);
          break;
        }
        case 'bolha': {
          const rx = d.w / 2 + 0.05, ry = Math.max(0.35, d.h + 0.1);
          const g = new THREE.SphereGeometry(1, 20, 14); g.scale(rx, ry, 0.6); g.translate(d.w / 2, d.h - ry, 0);
          const m = new THREE.Mesh(g, materialBolha(this.tema.chave === 'oceano' ? 0x9af0ff : 0xd8c8ff));
          m.renderOrder = 5;
          malha = m;
          break;
        }
      }
      this.raiz.add(malha);
      if (ponteiro) this.raiz.add(ponteiro);
      this.especiais.push({ def: d, malha, ponteiro, mola: 0, vmola: 0, sAntes: 0 });
    }
    this.raiz.add(this.fio.malha, this.cordasArgola[0].malha, this.cordasArgola[1].malha);
  }

  atualizar(e: Estado, dt: number, relogio: number, fx: Particulas) {
    const fase = this.fase;
    // ---------- eventos ----------
    for (const ev of e.eventos) {
      const p = ev.split(':');
      const i = Number(p[1]);
      const j = e.jogadores[i];
      switch (p[0]) {
        case 'tiro':
          if (j) {
            const x = j.x + j.olhando * 0.5, y = j.y + 0.62;
            fx.emitir({ x, y, z: 0.5, vida: 0.18, tam: 0.9, tamFim: 0.2, cor: 0xfff0b0, cel: Cel.Halo });
            for (let k = 0; k < 4; k++) fx.emitir({ x, y, z: 0.5, vx: j.olhando * (2 + Math.random() * 3), vy: (Math.random() - 0.5) * 3, arrasto: 4, vida: 0.25, tam: 0.18, tamFim: 0, cor: 0xffd8f0, cel: Cel.Brilho });
          }
          break;
        case 'dano':
          if (j) {
            fx.emitir({ x: j.x, y: j.y + 0.6, z: 0.6, vida: 0.3, tam: 0.6, tamFim: 1.5, cor: 0xff8aa8, alfa: 0.8, cel: Cel.Anel });
            fx.explosao(j.x, j.y + 0.7, 6, 0xff9ab8, 3, 0.25, 0.4, 0.6);
          }
          break;
        case 'bolha': case 'renasce':
          if (j) {
            fx.emitir({ x: j.x, y: j.y + 0.55, z: 0.7, vida: 0.4, tam: 0.6, tamFim: 2.0, cor: p[0] === 'bolha' ? 0xbfe8ff : 0xfff0b0, alfa: 0.9, cel: Cel.Anel });
            fx.explosao(j.x, j.y + 0.6, 10, p[0] === 'bolha' ? 0xc8f0ff : 0xffe090, 3.5, 0.3, 0.6, 0.7);
          }
          break;
        case 'estrelinha':
          if (j) {
            fx.emitir({ x: j.x, y: j.y + 0.8, z: 0.6, vida: 0.35, tam: 0.4, tamFim: 1.4, cor: 0xffe080, alfa: 0.9, cel: Cel.Anel });
            fx.explosao(j.x, j.y + 0.8, 8, 0xffe28a, 3, 0.25, 0.5, 0.6);
            fx.emitir({ x: j.x, y: j.y + 1.1, z: 0.7, vy: 1.6, arrasto: 1.5, vida: 0.7, tam: 0.55, tamFim: 0.2, cor: 0xffffff, cel: Cel.Brilho, vrot: 4 });
          }
          break;
        case 'quique': {
          if (j) fx.explosao(j.x, j.y, 6, this.tema.chave === 'doces' ? 0xb0ff90 : 0xffa0d0, 2.5, 0.22, 0.4, 0.6);
          const vis = this.especiais.find((s, k) => s.def.tipo === 'quicante' && Math.abs(e.especiais[k].x + s.def.w / 2 - (j?.x ?? 1e9)) < s.def.w);
          if (vis) vis.vmola = -9;
          break;
        }
        case 'estoura': {
          const k = i, d = fase.especiais?.[k], s = e.especiais[k];
          if (d && s) {
            const cx = s.x + d.w / 2, cy = s.y + d.h * 0.5;
            fx.emitir({ x: cx, y: cy, z: 0.4, vida: 0.3, tam: d.w, tamFim: d.w * 2, cor: 0xd8f0ff, alfa: 0.8, cel: Cel.Anel });
            fx.explosao(cx, cy, 8, 0xd8f0ff, 3, 0.2, 0.4, 0.4);
          }
          break;
        }
        case 'lanterna': {
          const l = (fase.lanternas ?? [])[i];
          if (l) {
            fx.emitir({ x: l.x + 0.4, y: l.y + 1.3, z: -0.4, vida: 0.6, tam: 0.6, tamFim: 3, cor: this.tema.brilho, alfa: 0.9, cel: Cel.Anel });
            fx.explosao(l.x + 0.4, l.y + 1.3, 12, 0xffe0a0, 3.5, 0.35, 0.8, -0.4);
          }
          break;
        }
        case 'pisao': {
          if (j) fx.explosao(j.x, j.y, 5, 0xffffff, 2.2, 0.22, 0.35, 0.6);
          break;
        }
        case 'esporo': {
          const n = e.inimigos[i];
          if (n) { const s = e.esporos[e.esporos.length - 1]; if (s) for (let k = 0; k < 3; k++) fx.emitir({ x: s.x, y: s.y, z: 0.3, vx: s.vx * 0.3 + (Math.random() - 0.5), vy: Math.random(), arrasto: 3, vida: 0.5, tam: 0.25, tamFim: 0.45, cor: 0xb890e0, alfa: 0.7, cel: Cel.Esporo, aditivo: false }); }
          break;
        }
        case 'fio-preso': {
          const [a, b] = e.jogadores;
          fx.emitir({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + AMARRA, z: 0.3, vida: 0.5, tam: 0.5, tamFim: 1.8, cor: 0xff6a8a, alfa: 0.8, cel: Cel.Anel });
          break;
        }
      }
    }

    // ---------- estrelinhas (da fase e soltas) ----------
    const lista = fase.estrelinhas ?? [];
    let n = 0;
    const col = new Set(e.coletadas);
    for (let k = 0; k < lista.length; k++) {
      if (col.has(k)) continue;
      const p = lista[k];
      const y = p.y + Math.sin(relogio * 2.2 + k * 1.7) * 0.08;
      this.q.setFromEuler(this.eu.set(0, Math.sin(relogio * 2.2 + k) * 0.9, Math.sin(relogio * 1.3 + k) * 0.15)); // balança mostrando a face
      this.estrelas.setMatrixAt(n++, this.m.compose(this.v.set(p.x, y, 0.2), this.q, this.s.setScalar(0.23)));
      fx.ponto(p.x, y, 0.1, 0.85 + Math.sin(relogio * 3 + k) * 0.1, 0xffc850, 0.55, Cel.Halo);
    }
    for (const k of this.coletadasAntes) if (!col.has(k)) this.coletadasAntes.delete(k);
    for (const k of col) this.coletadasAntes.add(k);
    for (let k = 0; k < e.soltas.length && n < this.nEstrelas + 24; k++) {
      const s = e.soltas[k];
      const pop = Math.min(1, s.t / 0.3);
      const esc = 0.23 * (pop < 1 ? 1.4 - 0.4 * pop : 1) * Math.max(0.2, pop);
      this.q.setFromEuler(this.eu.set(0, Math.sin(relogio * 4 + k) * 1.1, 0));
      const y = s.y + (s.t > 0.5 ? Math.sin(relogio * 3 + k) * 0.06 : 0);
      this.estrelas.setMatrixAt(n++, this.m.compose(this.v.set(s.x, y, 0.25), this.q, this.s.setScalar(esc)));
      fx.ponto(s.x, y, 0.15, 1.0, 0xffd870, 0.65, Cel.Halo);
      fx.ponto(s.x, y, 0.3, 0.6, 0xffffff, 0.5, Cel.Brilho, relogio * 2 + k);
    }
    this.estrelas.count = n;
    this.estrelas.instanceMatrix.needsUpdate = true;

    // ---------- lanternas ----------
    const lanternas = fase.lanternas ?? [];
    if (this.vidros) {
      if (e.checkpoint !== this.checkAntes) {
        lanternas.forEach((_l, k) => this.vidros!.setColorAt(k, k <= e.checkpoint ? this.corLit : this.corApagada));
        this.vidros.instanceColor!.needsUpdate = true;
        this.checkAntes = e.checkpoint;
      }
      lanternas.forEach((l, k) => {
        const x = l.x + 0.4, y = l.y + 1.3;
        if (k <= e.checkpoint) {
          const tremula = 1 + Math.sin(relogio * 13 + k * 3) * 0.06 + Math.sin(relogio * 7.3 + k) * 0.05;
          fx.ponto(x, y, -0.8, 2.2 * tremula, this.tema.brilho, k === e.checkpoint ? 0.75 : 0.5, Cel.Halo);
          fx.ponto(x, y - 0.03, -0.75, 0.32 * tremula, 0xfff4d0, 0.95, Cel.Brilho, Math.sin(relogio * 3 + k) * 0.2);
        } else {
          fx.ponto(x, y, -0.8, 0.5, 0x8a7aa8, 0.25, Cel.Halo);
        }
      });
    }

    // ---------- plataformas especiais ----------
    for (let k = 0; k < this.especiais.length; k++) {
      const vis = this.especiais[k], s = e.especiais[k], d = vis.def;
      if (!s) continue;
      vis.malha.visible = s.s !== 3;
      vis.malha.position.set(s.x, s.y, 0);
      switch (d.tipo) {
        case 'giratoria': {
          const cxp = s.x + d.w / 2, cyp = s.y + d.h / 2;
          const ang = Math.atan2(cyp - d.cy, cxp - d.cx), len = Math.hypot(cxp - d.cx, cyp - d.cy);
          vis.ponteiro!.rotation.z = ang;
          vis.ponteiro!.scale.set(len, 1, 1);
          break;
        }
        case 'quicante': {
          // mola amortecida: afunda ao quicar e balança
          vis.vmola += (-vis.mola * 180 - vis.vmola * 9) * dt;
          vis.mola += vis.vmola * dt;
          const m = vis.malha.children[0];
          const sy = 1 + vis.mola * 0.5 + Math.sin(relogio * 3 + k) * 0.02;
          m.scale.set(1 - vis.mola * 0.25, sy, 1 - vis.mola * 0.15);
          vis.malha.position.x = s.x;
          break;
        }
        case 'cai': {
          if (s.s === 1) vis.malha.position.x += Math.sin(relogio * 70) * 0.04;
          vis.malha.rotation.z = s.s === 2 ? Math.min(0.5, s.t * 0.8) * (k % 2 ? 1 : -1) : 0;
          if (s.s === 1 && Math.random() < dt * 20) fx.emitir({ x: s.x + Math.random() * d.w, y: s.y, z: 0.6, vy: -1, g: 6, vida: 0.4, tam: 0.12, tamFim: 0.05, cor: 0xd8b088, alfa: 0.8, cel: Cel.Esporo, aditivo: false });
          if (vis.sAntes === 3 && s.s === 0) fx.explosao(s.x + d.w / 2, s.y + d.h, 8, 0xfff0c0, 2, 0.25, 0.5);
          break;
        }
        case 'bolha': {
          vis.malha.scale.set(1 + Math.sin(relogio * 5 + k) * 0.03, 1 + Math.sin(relogio * 5 + k + 1.5) * 0.04, 1);
          break;
        }
        case 'movel':
          if (Math.random() < dt * 6) fx.emitir({ x: s.x + Math.random() * d.w, y: s.y - 0.15, z: 0.5, vy: -0.4, vida: 0.7, tam: 0.12, tamFim: 0, cor: this.tema.brilho, cel: Cel.Brilho });
          break;
      }
      vis.sAntes = s.s;
    }

    // ---------- Fio Vermelho ----------
    const [a, b] = e.jogadores;
    const f = e.fio;
    if (f.zona >= 0) {
      const ponta = (j: typeof a, outro: typeof a, v: THREE.Vector3) => {
        // pendurado: a corda chega nas mãos (acima da cabeça); segurando: nas mãos à frente; senão, na cintura
        if (j.pendurado) return maosPendurado(j, inclinacaoCorda(j, { x: outro.x, y: outro.y + 0.6 }), v);
        if (j.segurando) return v.set(j.x + Math.sign(outro.x - j.x || 1) * 0.3, j.y + 0.5, 0.15);
        return v.set(j.x, j.y + AMARRA, 0.12);
      };
      ponta(a, b, this.a); ponta(b, a, this.b);
      const comp = f.frouxo ? Math.max(this.a.distanceTo(this.b) * 1.2, f.comprimento) : f.comprimento + (a.pendurado || b.pendurado ? 0.42 : 0) + (a.segurando || b.segurando ? 0.2 : 0);
      this.fio.desenhar(this.a, this.b, comp, relogio, a.noChao && b.noChao ? Math.min(a.y, b.y) + 0.04 : undefined);
      // brilhinho que corre pela corda (o fio do destino)
      const t = (relogio * 0.45) % 1, pm = this.fio.ponto(t);
      fx.ponto(pm.x, pm.y, pm.z + 0.05, this.fio.tenso ? 0.5 : 0.35, 0xff7090, 0.7, Cel.Halo);
      if (this.fio.tenso) { const mm = this.fio.meio(); fx.ponto(mm.x, mm.y, mm.z + 0.05, 0.9, 0xff4060, 0.35, Cel.Halo); }
    } else this.fio.esconder();

    // cordas das argolas: do anel até as mãos de quem está pendurado nele
    e.jogadores.forEach((j, i) => {
      const g = j.argola >= 0 ? (fase.argolas ?? [])[j.argola] : null;
      if (!g) { this.cordasArgola[i].esconder(); return; }
      this.a.set(g.x, g.y - 0.26, 0); maosPendurado(j, inclinacaoCorda(j, g), this.b);
      this.cordasArgola[i].desenhar(this.a, this.b, this.a.distanceTo(this.b), relogio);
    });

    // ---------- faíscas (com rastro) e esporos ----------
    this.rastro += dt;
    const emitirRastro = this.rastro > 1 / 60;
    if (emitirRastro) this.rastro = 0;
    for (const fa of e.faiscas) {
      const rot = relogio * 14 + fa.id;
      fx.ponto(fa.x, fa.y, 0.5, 1.1, 0xffc850, 0.6, Cel.Halo);
      fx.ponto(fa.x, fa.y, 0.55, 0.55, 0xfff6d0, 1, Cel.Brilho, rot);
      if (emitirRastro) {
        const cor = fa.id % 2 ? 0xff9ad8 : 0xffd870;
        fx.emitir({ x: fa.x - Math.sign(fa.vx) * 0.1, y: fa.y + (Math.random() - 0.5) * 0.08, z: 0.45, vx: -Math.sign(fa.vx) * 0.6, vy: (Math.random() - 0.5) * 0.6, vida: 0.28, tam: 0.32, tamFim: 0.02, cor, cel: Cel.Brilho, vrot: 6 });
      }
    }
    for (let k = 0; k < e.esporos.length; k++) {
      const s = e.esporos[k];
      const w = Math.sin(relogio * 6 + k * 2);
      fx.ponto(s.x, s.y + w * 0.04, 0.3, 0.75, 0xc070ff, 0.35, Cel.Halo);
      fx.ponto(s.x, s.y + w * 0.04, 0.35, 0.44 + w * 0.03, 0xa070e0, 1, Cel.Esporo, relogio * 1.5 + k, false);
    }
  }
}
