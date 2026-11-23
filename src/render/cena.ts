// Renderização 3D em vista lateral (2.5D) com Three.js. Lê o Estado da simulação; não altera nada nele.
import * as THREE from 'three';
import type { Estado, EstadoJogador, Fase } from '../core/types';
import { FISICA } from '../core/sim';

export type Qualidade = 'baixa' | 'media' | 'alta';

const COR = {
  ceuTopo: 0x2b1f5c, ceuBaixo: 0xf6b6a0, nevoa: 0x7d6aa8,
  grama: 0x6fbf4a, gramaEscura: 0x4f9a35, terra: 0x7a4b2e, rocha: 0x8a7f9c,
  madeira: 0x9a6a3e, cogumeloChapeu: 0xd6453d, cogumeloPe: 0xf3e6cf,
  p1Corpo: 0x8a5a36, p1Lenco: 0xd23b2f, p1Cabelo: 0x5a3420,
  p2Corpo: 0x8b6cc7, p2Lenco: 0xf0c75a, p2Cabelo: 0x3a2433, pele: 0xf4c9a4,
};

function material(cor: number, q: Qualidade, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return q === 'baixa'
    ? new THREE.MeshLambertMaterial({ color: cor, ...(extra.emissive ? { emissive: extra.emissive } : {}) })
    : new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0, ...extra });
}

interface Boneco { raiz: THREE.Group; corpo: THREE.Group; bracoE: THREE.Mesh; bracoD: THREE.Mesh; pernaE: THREE.Mesh; pernaD: THREE.Mesh; lenco: THREE.Mesh; fase: number; achatar: number }

function criarBoneco(cores: { corpo: number; lenco: number; cabelo: number }, q: Qualidade, rotulo: string, corRotulo: string): Boneco {
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  raiz.add(corpo);
  const sombra = q !== 'baixa';
  const add = (geo: THREE.BufferGeometry, cor: number, x: number, y: number, z = 0, pai: THREE.Object3D = corpo) => {
    const m = new THREE.Mesh(geo, material(cor, q)); m.position.set(x, y, z); m.castShadow = sombra; pai.add(m); return m;
  };
  // proporção chibi: cabeça grande (≈ 45 % da altura)
  add(new THREE.CapsuleGeometry(0.2, 0.22, 4, 10), cores.corpo, 0, 0.45);
  const cabeca = add(new THREE.SphereGeometry(0.27, 20, 16), COR.pele, 0, 0.88);
  // cabelo: calota no alto + volume na nuca; o rosto (z+) fica livre
  add(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), cores.cabelo, 0, 0.9, -0.02);
  add(new THREE.SphereGeometry(0.27, 16, 12), cores.cabelo, 0, 0.86, -0.09).scale.set(1.05, 1, 0.8);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.045, 10, 8), 0x2a1a14, 0.1 * s, 0.87, 0.245, corpo).scale.set(1, 1.35, 0.6);
    add(new THREE.SphereGeometry(0.035, 8, 6), 0xf59a8a, 0.17 * s, 0.8, 0.2, corpo).scale.set(1, 0.6, 0.4); // bochecha
  }
  void cabeca;
  const lenco = add(new THREE.TorusGeometry(0.16, 0.05, 6, 16), cores.lenco, 0, 0.64);
  lenco.rotation.x = Math.PI / 2;
  const bracoE = add(new THREE.CapsuleGeometry(0.06, 0.2, 3, 6), cores.corpo, -0.24, 0.5);
  const bracoD = add(new THREE.CapsuleGeometry(0.06, 0.2, 3, 6), cores.corpo, 0.24, 0.5);
  const pernaE = add(new THREE.CapsuleGeometry(0.07, 0.14, 3, 6), 0x4a3426, -0.09, 0.14);
  const pernaD = add(new THREE.CapsuleGeometry(0.07, 0.14, 3, 6), 0x4a3426, 0.09, 0.14);

  // rótulo P1/P2 sobre a cabeça
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = corRotulo; g.font = 'bold 64px system-ui'; g.textAlign = 'center'; g.fillText(rotulo, 64, 64);
  g.beginPath(); g.moveTo(44, 80); g.lineTo(84, 80); g.lineTo(64, 110); g.fill();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(0.45, 0.45, 1); sp.position.y = 1.55; sp.renderOrder = 10;
  corpo.scale.setScalar(1.15);
  raiz.add(sp);
  return { raiz, corpo, bracoE, bracoD, pernaE, pernaD, lenco, fase: 0, achatar: 0 };
}

export class Cena {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 220);
  private bonecos: [Boneco, Boneco];
  private portas = new Map<string, THREE.Mesh>();
  private placas = new Map<string, THREE.Mesh>();
  private portal!: THREE.Group;
  private vagalumes!: THREE.Points;
  private sol!: THREE.DirectionalLight;
  private alvoCam = new THREE.Vector3();
  private relogio = 0;

  constructor(canvas: HTMLCanvasElement, private fase: Fase, readonly qualidade: Qualidade) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, qualidade === 'alta' ? 2 : qualidade === 'media' ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = qualidade !== 'baixa';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.montarCeu();
    this.montarLuz();
    this.montarFase();
    this.montarCenario();
    this.bonecos = [
      criarBoneco({ corpo: COR.p1Corpo, lenco: COR.p1Lenco, cabelo: COR.p1Cabelo }, qualidade, 'P1', '#ff5a4e'),
      criarBoneco({ corpo: COR.p2Corpo, lenco: COR.p2Lenco, cabelo: COR.p2Cabelo }, qualidade, 'P2', '#5aa8ff'),
    ];
    for (const b of this.bonecos) this.scene.add(b.raiz);
  }

  private montarCeu() {
    // gradiente do céu num domo (um só draw), com névoa da mesma cor no horizonte
    const geo = new THREE.SphereGeometry(180, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topo: { value: new THREE.Color(COR.ceuTopo) }, baixo: { value: new THREE.Color(COR.ceuBaixo) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topo; uniform vec3 baixo; varying vec3 vP; void main(){ float t = smoothstep(-0.1, 0.6, vP.y); gl_FragColor = vec4(mix(baixo, topo, t), 1.0); }',
    });
    const ceu = new THREE.Mesh(geo, mat);
    ceu.renderOrder = -1;
    this.scene.add(ceu);
    this.scene.fog = new THREE.Fog(COR.nevoa, 28, 110);
  }

  private montarLuz() {
    this.scene.add(new THREE.HemisphereLight(0xffe3c2, 0x3b2c5a, 1.1));
    this.sol = new THREE.DirectionalLight(0xffd29a, 2.4);
    this.sol.position.set(-12, 20, 14);
    this.sol.castShadow = this.qualidade !== 'baixa';
    const s = this.sol.shadow;
    s.mapSize.set(this.qualidade === 'alta' ? 2048 : 1024, this.qualidade === 'alta' ? 2048 : 1024);
    s.camera.left = -16; s.camera.right = 16; s.camera.top = 12; s.camera.bottom = -8;
    s.camera.near = 1; s.camera.far = 60; s.bias = -0.0006; s.normalBias = 0.02; s.radius = 3;
    this.scene.add(this.sol, this.sol.target);
  }

  private montarFase() {
    const q = this.qualidade;
    const grama = material(COR.grama, q), terra = material(COR.terra, q), madeira = material(COR.madeira, q);
    const prof = 4; // profundidade das plataformas (eixo z)
    for (const p of this.fase.plataformas) {
      const tampa = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.22, prof), grama);
      tampa.position.set(p.x + p.w / 2, p.y + p.h - 0.11 + 0.02, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.98, Math.max(0.1, p.h + 4), prof * 0.96), terra);
      base.position.set(p.x + p.w / 2, p.y + p.h - 0.2 - (p.h + 4) / 2, -0.05);
      // plataforma alta: casa na árvore, com tronco
      if (p.y > 1) {
        base.visible = false;
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, p.y + 1, 10), madeira);
        tronco.position.set(p.x + p.w / 2, (p.y - 1) / 2, -1.6);
        tronco.castShadow = q !== 'baixa';
        this.scene.add(tronco);
        tampa.material = madeira;
      }
      for (const m of [tampa, base]) { m.receiveShadow = q !== 'baixa'; m.castShadow = q !== 'baixa'; this.scene.add(m); }
    }
    for (const p of this.fase.placas) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2, p.w / 2, 0.18, 20), material(0xffd56a, q, { emissive: new THREE.Color(0x6a4a00) }));
      m.position.set(p.x + p.w / 2, p.y + 0.09, 0.6);
      m.receiveShadow = q !== 'baixa';
      this.placas.set(p.id, m); this.scene.add(m);
    }
    for (const p of this.fase.portas) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, prof * 0.9), madeira);
      m.position.set(p.x + p.w / 2, p.y + p.h / 2, 0);
      m.castShadow = q !== 'baixa';
      this.portas.set(p.id, m); this.scene.add(m);
    }
    // portal: estrela dourada (o símbolo da capa)
    const g = new THREE.Group();
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
    const estrela = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xfff4c8 }));
    const luz = new THREE.PointLight(0xffd98a, 6, 6);
    g.add(anel, estrela, luz);
    const pr = this.fase.portal;
    g.position.set(pr.x + pr.w / 2, pr.y + 1, 0.2);
    this.portal = g; this.scene.add(g);
  }

  private montarCenario() {
    const q = this.qualidade;
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    // fundo: árvores gigantes e rochas em camadas (paralaxe natural da perspectiva)
    const copa = material(COR.gramaEscura, q), tronco = material(COR.madeira, q), rocha = material(COR.rocha, q);
    const geoCopa = new THREE.IcosahedronGeometry(1, 1), geoTronco = new THREE.CylinderGeometry(0.4, 0.7, 1, 8);
    const n = q === 'baixa' ? 18 : 34;
    const copas = new THREE.InstancedMesh(geoCopa, copa, n), troncos = new THREE.InstancedMesh(geoTronco, tronco, n);
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const x = -6 + (this.fase.largura + 12) * (i / n) + rnd() * 3, z = -8 - rnd() * 18, h = 6 + rnd() * 10;
      m4.compose(v.set(x, h / 2 - 2, z), qt.identity(), s.set(1 + rnd(), h, 1 + rnd())); troncos.setMatrixAt(i, m4);
      const r = 2.5 + rnd() * 2.5;
      m4.compose(v.set(x, h - 1, z), qt.setFromAxisAngle(v.clone().set(0, 1, 0), rnd() * 6), s.set(r, r * 0.8, r)); copas.setMatrixAt(i, m4);
    }
    this.scene.add(copas, troncos);
    const rochas = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rocha, 12);
    for (let i = 0; i < 12; i++) {
      m4.compose(v.set(rnd() * this.fase.largura, -2 + rnd(), -4 - rnd() * 4), qt.identity(), s.setScalar(0.6 + rnd() * 1.5));
      rochas.setMatrixAt(i, m4);
    }
    this.scene.add(rochas);
    // cogumelos (o elemento da arte de referência)
    const chapeu = material(COR.cogumeloChapeu, q), pe = material(COR.cogumeloPe, q);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const esc = 0.6 + rnd() * 2.2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 8), pe); p.position.y = 0.5;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), chapeu); c.position.y = 0.95;
      g.add(p, c); g.scale.setScalar(esc);
      g.position.set(2 + rnd() * (this.fase.largura - 4), -0.02, -1.4 - rnd() * 3);
      if (q !== 'baixa') { p.castShadow = c.castShadow = true; }
      this.scene.add(g);
    }
    // vaga-lumes: pontos aditivos (uma chamada)
    const nv = q === 'baixa' ? 60 : 160;
    const pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { pos[i * 3] = rnd() * this.fase.largura; pos[i * 3 + 1] = rnd() * 7; pos[i * 3 + 2] = -3 + rnd() * 6; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.vagalumes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1a8, size: 0.09, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.vagalumes);
  }

  redimensionar(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animarBoneco(b: Boneco, j: EstadoJogador, dt: number, eventos: string[], i: number) {
    b.raiz.position.set(j.x, j.y, 0);
    const alvoRot = j.olhando > 0 ? Math.PI / 2 * 0.55 : -Math.PI / 2 * 0.55;
    b.raiz.rotation.y += (alvoRot - b.raiz.rotation.y) * Math.min(1, dt * 12);
    const vel = Math.abs(j.vx) / FISICA.velAndar;
    if (j.noChao) b.fase += dt * 12 * vel;
    const balanco = j.noChao ? Math.sin(b.fase) * 0.7 * vel : 0.6;
    b.bracoE.rotation.x = balanco; b.bracoD.rotation.x = -balanco;
    b.pernaE.rotation.x = -balanco; b.pernaD.rotation.x = balanco;
    if (eventos.includes(`pouso:${i}`)) b.achatar = 1;
    b.achatar = Math.max(0, b.achatar - dt * 5);
    const estica = j.noChao ? 1 - b.achatar * 0.18 : 1 + Math.min(0.12, Math.abs(j.vy) * 0.01);
    b.corpo.scale.set(1 / Math.sqrt(estica), estica, 1 / Math.sqrt(estica));
    b.corpo.position.y = j.noChao ? Math.abs(Math.sin(b.fase)) * 0.05 * vel : 0;
    b.lenco.rotation.z = Math.sin(this.relogio * 6) * 0.15 * (0.3 + vel);
  }

  desenhar(e: Estado, dt: number) {
    this.relogio += dt;
    const [a, b] = e.jogadores;
    this.animarBoneco(this.bonecos[0], a, dt, e.eventos, 0);
    this.animarBoneco(this.bonecos[1], b, dt, e.eventos, 1);
    for (const [id, m] of this.portas) {
      const ab = e.portas[id] ?? 0;
      const p = this.fase.portas.find((x) => x.id === id)!;
      m.scale.y = Math.max(0.02, 1 - ab);
      m.position.y = p.y + p.h - (p.h * m.scale.y) / 2;
    }
    for (const [id, m] of this.placas) m.position.y = e.placasPressionadas[id] ? 0.03 : 0.09;
    this.portal.rotation.y += dt * 1.2;
    this.portal.children[1].rotation.x += dt * 2;
    const pos = this.vagalumes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + Math.sin(this.relogio * 0.8 + i) * dt * 0.15);
    pos.needsUpdate = true;

    // câmera: segue o meio dos dois e afasta quando eles se separam
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
    const dist = Math.min(22, Math.max(7.5, 6 + sep * 0.9));
    this.alvoCam.set(mx, my + 1.2, dist);
    this.camera.position.lerp(this.alvoCam, Math.min(1, dt * 4));
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 0.6, 0);
    this.sol.position.set(this.camera.position.x - 12, 20, 14);
    this.sol.target.position.set(this.camera.position.x, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  info() { const r = this.renderer.info.render; return { chamadas: r.calls, triangulos: r.triangles }; }
}
