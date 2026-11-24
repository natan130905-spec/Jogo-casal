// Bichinhos invocados pelo Rei: bolotinhas (pulam, achatam, dão o bote) e morcegos (circulam batendo as asas e
// mergulham). Cada tipo é um lote instanciado do GLB (bolotinha.glb, morcego.glb) + contorno; as asas do morcego
// batem no vertex shader. Chamadas: bolotinhas (1 + 1 contorno) + morcegos (1 + 1 contorno).
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LACAIO, type EstadoArena, type Lacaio } from '../../core/arena';
import { TEMPO } from '../materiais';
import { contornoDe, materialContorno, materialToon } from './toon';
import { geometriaAssentada, primeiraMalha, texturaDe } from './modelos';
import type { Particulas3D } from './particulas';
import { C } from './atlas';

const MAX = 8;
const lim = (t: number) => Math.max(0, Math.min(1, t));

class Lote {
  malha: THREE.InstancedMesh;
  contorno: THREE.InstancedMesh | null = null;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, contorno: boolean, corContorno: number, asas: boolean) {
    this.malha = new THREE.InstancedMesh(geo, mat, MAX);
    this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.malha.count = 0;
    this.malha.frustumCulled = false;
    if (contorno) {
      const mc = materialContorno(corContorno, 2.2);
      if (asas) baterAsas(mc, true);
      this.contorno = contornoDe(this.malha, mc) as THREE.InstancedMesh;
      this.contorno.count = 0;
    }
  }
}

/** Asas: vértices longe do centro em |x| sobem e descem (no espaço do modelo). */
function baterAsas(mat: THREE.Material, contorno = false) {
  const antes = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    antes.call(mat, sh, r);
    sh.uniforms.uTempo = TEMPO;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTempo;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float fase = 0.0;
  #ifdef USE_INSTANCING
    fase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z;
  #endif
  float ax = abs(transformed.x);
  float asa = smoothstep(0.12, 0.5, ax);
  float bate = sin(uTempo * 16.0 + fase) * 0.5;
  transformed.y += asa * bate * (ax - 0.1) * 1.2;
}`);
  };
  const chave = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${chave()}-asas${contorno ? '-c' : ''}`;
}

export class Lacaios {
  readonly grupo = new THREE.Group();
  private bolas: Lote;
  private morcegos: Lote;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  private vistos = new Map<number, number>();

  constructor(private contorno: boolean) {
    // provisórios (esferas) até os GLB carregarem
    this.bolas = new Lote(new THREE.SphereGeometry(0.4, 14, 10).translate(0, 0.4, 0), materialToon({ cor: 0x9a3ad0, proprio: 0.2 }), contorno, 0x2a0838, false);
    this.morcegos = new Lote(new THREE.SphereGeometry(0.35, 12, 8), materialToon({ cor: 0x7a3ab0, proprio: 0.2 }), contorno, 0x2a0838, true);
    this.juntar();
  }

  private juntar() {
    this.grupo.clear();
    for (const l of [this.bolas, this.morcegos]) { this.grupo.add(l.malha); if (l.contorno) this.grupo.add(l.contorno); }
  }

  montar(bola: GLTF | null, morcego: GLTF | null) {
    const fazer = (g: GLTF | null, alt: number, asas: boolean, cor: number): Lote | null => {
      const m = g && primeiraMalha(g);
      if (!m) return null;
      g!.scene.updateMatrixWorld(true);
      const geo = geometriaAssentada(m, alt);
      if (asas) geo.translate(0, -alt / 2, 0); // morcego: centro no meio do corpo
      const mat = materialToon({ mapa: texturaDe(m), proprio: 0.28, borda: 0xffb0ff, forcaBorda: 0.5 });
      if (asas) baterAsas(mat);
      return new Lote(geo, mat, this.contorno, cor, asas);
    };
    this.bolas = fazer(bola, 0.85, false, 0x2a0838) ?? this.bolas;
    this.morcegos = fazer(morcego, 0.75, true, 0x2a0838) ?? this.morcegos;
    this.juntar();
  }

  atualizar(e: EstadoArena, dt: number, t: number, fx: Particulas3D) {
    let nb = 0, nm = 0;
    const m = this.m, q = this.q, v = this.v, s = this.s;
    const vivos = new Set<number>();
    for (const l of e.lacaios) {
      vivos.add(l.id);
      const idade = (this.vistos.get(l.id) ?? 0) + dt;
      this.vistos.set(l.id, idade);
      if (l.tipo === 'bolotinha') {
        if (nb >= MAX) continue;
        this.poseBola(l, t, idade);
        this.bolas.malha.setMatrixAt(nb++, m);
      } else {
        if (nm >= MAX) continue;
        this.poseMorcego(l, t);
        this.morcegos.malha.setMatrixAt(nm++, m);
        // sombrinha de brilho embaixo para ler a altura
      }
      if (l.etapa === 'surgindo' && Math.random() < dt * 25) {
        fx.emitir({ x: l.x + (Math.random() - 0.5) * 0.8, y: l.y + 0.2, z: l.z + (Math.random() - 0.5) * 0.8, vy: 1.2, vida: 0.7, tam: 0.8, tamFim: 1.4, cor: 0x9a5ae0, alfa: 0.5, cel: C.nuvem, aditivo: false, rot: Math.random() * 6 });
      }
      if (l.etapa === 'bote') fx.ponto(l.x, l.y + 0.5, l.z, 0.9, 0xff6a9a, 0.35 + 0.2 * Math.sin(t * 20), C.halo);
    }
    for (const id of [...this.vistos.keys()]) if (!vivos.has(id)) this.vistos.delete(id);
    void v; void s; void q;
    for (const [lote, n] of [[this.bolas, nb], [this.morcegos, nm]] as const) {
      lote.malha.count = n; lote.malha.instanceMatrix.needsUpdate = true;
      if (lote.contorno) lote.contorno.count = n;
      lote.malha.visible = n > 0;
      if (lote.contorno) lote.contorno.visible = n > 0;
    }
    // estouro em brilhos ao derrotar
    for (const ev of e.eventos) {
      if (!ev.startsWith('derrota:') && !ev.startsWith('surge:')) continue;
      const [nome, , id] = ev.split(':');
      const l = e.lacaios.find((x) => x.id === Number(id));
      const p = l ?? this.ultimo.get(Number(id));
      if (!p) continue;
      if (nome === 'derrota') {
        fx.explosao(p.x, p.y + 0.4, p.z, 22, 0xffe08a, 5, 0.32, 0.6, C.brilho, 5);
        fx.explosao(p.x, p.y + 0.4, p.z, 8, 0xd8a8ff, 3, 0.28, 0.6, C.estrela, 3);
        fx.emitir({ x: p.x, y: p.y + 0.4, z: p.z, vida: 0.4, tam: 0.4, tamFim: 2.6, cor: 0xffffff, alfa: 0.9, cel: C.anel });
      } else {
        fx.emitir({ x: p.x, y: p.y + 0.3, z: p.z, vida: 0.6, tam: 0.6, tamFim: 3, cor: 0xb070ff, alfa: 0.8, cel: C.anel });
      }
    }
    this.ultimo.clear();
    for (const l of e.lacaios) this.ultimo.set(l.id, { x: l.x, y: l.y, z: l.z });
  }
  private ultimo = new Map<number, { x: number; y: number; z: number }>();

  private poseBola(l: Lacaio, t: number, idade: number) {
    const B = LACAIO.bolotinha;
    let sx = 1, sy = 1, y = l.y, inc = 0;
    if (l.etapa === 'surgindo') { const p = lim(l.t / LACAIO.surgir); const k = 1 - Math.pow(1 - p, 3); sx = sy = 0.2 + 0.8 * k; y -= (1 - k) * 0.4; }
    else if (l.etapa === 'andando') { const pulo = Math.abs(Math.sin(t * 9 + l.id)); y += pulo * 0.22; sy = 0.9 + pulo * 0.2; sx = 1.06 - pulo * 0.1; }
    else if (l.etapa === 'bote') {
      // agacha durante o aviso; depois salta
      const p = lim(l.t / B.aviso);
      if (p < 1) { sy = 1 - 0.3 * p; sx = 1 + 0.18 * p; inc = -0.2 * p; } else { sy = 1.2; sx = 0.88; inc = 0.35; }
    } else if (l.etapa === 'descanso') { sy = 0.95 + Math.sin(t * 6 + l.id) * 0.05; inc = 0.1; }
    void idade;
    this.e.set(inc, l.ang, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(l.x, y, l.z), this.q, this.s.set(sx, sy, sx));
  }

  private poseMorcego(l: Lacaio, t: number) {
    let esc = 1;
    if (l.etapa === 'surgindo') esc = 0.2 + 0.8 * lim(l.t / LACAIO.surgir);
    // olha na direção do voo (tangente do círculo) ou para baixo no mergulho
    const mergulho = l.etapa === 'bote';
    this.e.set(mergulho ? 0.7 : Math.sin(t * 3 + l.id) * 0.1, l.ang + Math.PI / 2, Math.sin(t * 2 + l.id) * 0.2, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(l.x, l.y + Math.sin(t * 4 + l.id) * 0.12, l.z), this.q, this.s.setScalar(esc));
  }
}
