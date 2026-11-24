// Esboço mínimo do desenho da Arena do Coração, com formas simples. Só é usado enquanto src/render/arena/index.ts
// (o render de verdade, feito em paralelo) não existe ou falha ao carregar: deixa a arena jogável e testável.
// Mesma API que a partida espera (ver CenaArenaApi em src/ui/partidaArena.ts).
import * as THREE from 'three';
import {
  CRISTAIS, ILHA, PILARES, PODER, REI, alvoDaTrava, raioOnda, type EstadoArena, type Perigo,
} from '../core/arena';
import type { Qualidade } from '../render/cena';

const COR_JOGADOR = [0xffa25a, 0xb98cff];

export class CenaArenaEsboco {
  readonly renderer: THREE.WebGLRenderer;
  /** rotation.y da câmera (ordem 'YXZ') */
  yaw = 0;
  /** quem a câmera segue (0 Natan, 1 Bruna) */
  eu = 0;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 200);
  private bonecos: THREE.Group[] = [];
  private rei = new THREE.Group();
  private pilares: THREE.Mesh[] = [];
  private cristais: THREE.Mesh[] = [];
  private parede: THREE.Mesh;
  private jardim: THREE.Mesh;
  private vagalume: THREE.Mesh;
  private grupoPerigos = new THREE.Group();
  private grupoLacaios = new THREE.Group();
  private grupoDisparos = new THREE.Group();
  private relogio = 0;
  private alvoCam = new THREE.Vector3();
  private iniciou = false;

  constructor(canvas: HTMLCanvasElement, qualidade: Qualidade) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, qualidade === 'alta' ? 2 : qualidade === 'media' ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.camera.rotation.order = 'YXZ';
    const s = this.scene;
    s.background = new THREE.Color(0x2b1f5c);
    s.fog = new THREE.Fog(0x2b1f5c, 30, 90);
    s.add(new THREE.HemisphereLight(0xffe9c8, 0x3a2770, 1.6));
    const sol = new THREE.DirectionalLight(0xfff0d0, 1.6); sol.position.set(8, 20, 6); s.add(sol);
    // ilha
    const ilha = new THREE.Mesh(new THREE.CylinderGeometry(ILHA.raio, ILHA.raio * 0.55, 3, 48), [
      new THREE.MeshLambertMaterial({ color: 0x8a6f9e }), new THREE.MeshLambertMaterial({ color: 0x7fcf7a }), new THREE.MeshLambertMaterial({ color: 0x5a4a70 }),
    ]);
    ilha.position.y = -1.5; s.add(ilha);
    const pedra = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x4060a0, emissiveIntensity: 0.4 });
    for (const { x, z } of PILARES.pos) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(PILARES.raio, PILARES.raio * 1.1, 2.6, 8), pedra.clone());
      m.position.set(x, 1.3, z); s.add(m); this.pilares.push(m);
    }
    for (const { x, z } of CRISTAIS.pos) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(CRISTAIS.raio * 1.2), new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xffc040, emissiveIntensity: 0.2 }));
      m.position.set(x, 1.4, z); s.add(m); this.cristais.push(m);
    }
    this.parede = new THREE.Mesh(new THREE.PlaneGeometry(ILHA.raio * 2, 4), new THREE.MeshBasicMaterial({ color: 0xc8b0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    this.parede.rotation.y = Math.PI / 2; this.parede.position.y = 2; s.add(this.parede);
    this.jardim = new THREE.Mesh(new THREE.CircleGeometry(PODER.jardim.raio, 32), new THREE.MeshBasicMaterial({ color: 0x9dffb0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.jardim.rotation.x = -Math.PI / 2; this.jardim.position.y = 0.03; s.add(this.jardim);
    this.vagalume = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6a0 }));
    s.add(this.vagalume);
    // jogadores: corpo, cabeça e a arma (espada curta / lança comprida)
    for (const i of [0, 1]) {
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: COR_JOGADOR[i] });
      const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), mat); corpo.position.y = 0.6; g.add(corpo);
      const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffe0c8 })); cabeca.position.y = 1.2; g.add(cabeca);
      const arma = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, i === 0 ? 0.9 : 1.4), new THREE.MeshLambertMaterial({ color: i === 0 ? 0xfff0a0 : 0xffb0d8, emissive: 0x806020, emissiveIntensity: 0.5 }));
      arma.position.set(0.35, 0.7, 0.4); arma.name = 'arma'; g.add(arma);
      this.bonecos.push(g); s.add(g);
    }
    // Rei-Pesadelo: corpo de névoa, coroa e a estrela do peito
    const corpoRei = new THREE.Mesh(new THREE.ConeGeometry(REI.raio, REI.altura, 16), new THREE.MeshLambertMaterial({ color: 0x5b3f8f, emissive: 0x201040 }));
    corpoRei.position.y = REI.altura / 2; corpoRei.name = 'corpo'; this.rei.add(corpoRei);
    const coroa = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.5, 7, 1, true), new THREE.MeshLambertMaterial({ color: 0xffcf6b, side: THREE.DoubleSide }));
    coroa.position.y = REI.altura + 0.1; this.rei.add(coroa);
    const estrela = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    estrela.position.set(0, REI.altura * 0.55, REI.raio * 0.55); estrela.name = 'estrela'; this.rei.add(estrela);
    const escudo = new THREE.Mesh(new THREE.SphereGeometry(REI.raio * 1.5, 20, 14), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.25, depthWrite: false }));
    escudo.position.y = REI.altura / 2; escudo.name = 'escudo'; this.rei.add(escudo);
    s.add(this.rei, this.grupoPerigos, this.grupoLacaios, this.grupoDisparos);
  }

  redimensionar(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
  }

  info() { return { chamadas: this.renderer.info.render.calls, triangulos: this.renderer.info.render.triangles }; }

  private perigo(p: Perigo): THREE.Mesh {
    const aviso = p.aviso > 0;
    const mat = new THREE.MeshBasicMaterial({ color: aviso ? 0xff5070 : 0xffe0a0, transparent: true, opacity: aviso ? 0.35 : 0.7, depthWrite: false, side: THREE.DoubleSide });
    let m: THREE.Mesh;
    if (p.forma === 'anel') {
      const r = Math.max(0.1, raioOnda(p));
      m = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, r - 0.35), r + 0.35, 48), mat);
      m.position.set(p.x, 0.05, p.z);
    } else if (p.forma === 'linha') {
      const l = Math.hypot(p.x2 - p.x, p.z2 - p.z);
      m = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2, Math.max(0.1, l)), mat);
      m.position.set((p.x + p.x2) / 2, 0.05, (p.z + p.z2) / 2);
      m.rotation.z = -Math.atan2(p.x2 - p.x, p.z2 - p.z);
    } else {
      m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), mat);
      m.position.set(p.x, 0.05, p.z);
    }
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  private limpar(g: THREE.Group) {
    for (const c of g.children) { const m = c as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.(); }
    g.clear();
  }

  desenhar(e: EstadoArena, dt: number) {
    this.relogio += dt;
    const piscar = (inv: number) => inv <= 0 || Math.floor(this.relogio * 12) % 2 === 0;
    e.jogadores.forEach((j, i) => {
      const b = this.bonecos[i];
      b.position.set(j.x, j.y, j.z); b.rotation.y = j.ang;
      b.visible = piscar(j.invencivel);
      b.scale.setScalar(j.bolha ? 0.7 : 1);
      const arma = b.getObjectByName('arma')!;
      arma.rotation.y = j.acao === 'golpe' ? Math.sin(j.tAcao * 18) * 1.2 : 0;
      b.rotation.z = j.acao === 'esquiva' ? j.tAcao * 15 : 0;
    });
    const r = e.rei;
    this.rei.position.set(r.x, 0, r.z); this.rei.rotation.y = r.ang;
    this.rei.visible = !e.vitoria;
    this.rei.scale.setScalar(1 + Math.sin(this.relogio * 2) * 0.03 + (r.transicao > 0 ? 0.15 : 0));
    this.rei.getObjectByName('escudo')!.visible = r.escudo;
    this.rei.getObjectByName('estrela')!.scale.setScalar(r.vulneravel > 0 ? 1.8 : 1);
    this.pilares.forEach((m, k) => { m.visible = e.pilares[k] > 0; m.scale.y = 0.5 + (e.pilares[k] / PILARES.vida) * 0.5; });
    this.cristais.forEach((m, k) => { (m.material as THREE.MeshLambertMaterial).emissiveIntensity = e.cristais[k] > 0 ? 1.2 : 0.2; m.rotation.y = this.relogio; m.visible = r.fase === 3; });
    this.parede.visible = e.parede !== 0;
    this.parede.scale.y = e.parede === 1 ? 0.4 : 1;
    this.jardim.visible = !!e.jardim;
    if (e.jardim) this.jardim.position.set(e.jardim.x, 0.03, e.jardim.z);
    this.vagalume.visible = !!e.vagalume;
    if (e.vagalume) this.vagalume.position.set(e.vagalume.x, e.vagalume.y, e.vagalume.z);

    this.limpar(this.grupoPerigos);
    for (const p of e.perigos) this.grupoPerigos.add(this.perigo(p));
    this.limpar(this.grupoLacaios);
    for (const l of e.lacaios) {
      const m = new THREE.Mesh(l.tipo === 'morcego' ? new THREE.ConeGeometry(0.35, 0.5, 6) : new THREE.SphereGeometry(0.45, 12, 8),
        new THREE.MeshLambertMaterial({ color: l.tipo === 'morcego' ? 0x6a5a8a : 0xff8fb8 }));
      m.position.set(l.x, l.y + 0.45, l.z); m.rotation.y = l.ang; this.grupoLacaios.add(m);
    }
    this.limpar(this.grupoDisparos);
    for (const f of e.disparos) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
      m.position.set(f.x, f.y, f.z); this.grupoDisparos.add(m);
    }

    // câmera em terceira pessoa atrás de quem joga neste aparelho, olhando para o alvo da trava (o Rei, em geral)
    const eu = e.jogadores[this.eu] ?? e.jogadores[0];
    const alvo = alvoDaTrava(e, this.eu) ?? { x: r.x, z: r.z };
    let dx = alvo.x - eu.x, dz = alvo.z - eu.z;
    const n = Math.hypot(dx, dz);
    if (n < 0.5) { dx = 0; dz = -1; } else { dx /= n; dz /= n; }
    const pos = new THREE.Vector3(eu.x - dx * 7, Math.max(eu.y, 0) + 4.2, eu.z - dz * 7);
    const olhar = new THREE.Vector3(eu.x + dx * 4, 1.2, eu.z + dz * 4);
    const k = this.iniciou ? 1 - Math.exp(-dt * 5) : 1;
    this.iniciou = true;
    this.camera.position.lerp(pos, k);
    this.alvoCam.lerp(olhar, k);
    this.camera.lookAt(this.alvoCam);
    this.yaw = this.camera.rotation.y;

    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }

  destruir() {
    this.limpar(this.grupoPerigos); this.limpar(this.grupoLacaios); this.limpar(this.grupoDisparos);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
