// Cena 3D da Arena do Coração (capítulo 7, fase final em terceira pessoa). Desenha um EstadoArena; não altera nada
// nele. Segue a CenaArenaApi de src/ui/partidaArena.ts:
//   const cena = new CenaArena(canvas, qualidade);  await cena.pronta;   // modelos GLB (antes, formas simples)
//   cena.eu = 0 | 1;  cena.redimensionar(w, h);  cena.desenhar(estado, dt);  entrada.yaw = cena.yaw;  cena.destruir();
// `eu` = quem joga neste aparelho (0 Natan, 1 Bruna; no treino, estado.solo): a câmera fica atrás dele.
// Orçamento (qualidade média): ≤ 80 chamadas de desenho e ≤ 250 mil triângulos; sombras reais só na alta.
import * as THREE from 'three';
import type { EstadoArena } from '../../core/arena';
import type { Qualidade } from '../cena';
import { TEMPO } from '../materiais';
import { Pos } from '../pos';
import { aneisDourados, ceuArena } from './ceu';
import { construirIlha, type Ilha } from './ilha';
import { Pilares } from './pilares';
import { Heroi } from './herois';
import { ReiVisual } from './rei';
import { Lacaios } from './lacaios';
import { Efeitos } from './efeitos';
import { Particulas3D } from './particulas';
import { CameraArena } from './camera';
import { carregarModelo } from './modelos';
import { RECORTE, RESOLUCAO } from './toon';
import { C } from './atlas';

/** `?resfixa` desliga a resolução dinâmica (capturas comparáveis em máquina sem GPU). */
const RES_FIXA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('resfixa');

export class CenaArena {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private cam = new CameraArena();
  private ceu: THREE.Mesh;
  private aneis: THREE.Mesh;
  private ilha: Ilha;
  private pilares: Pilares;
  private herois: [Heroi, Heroi];
  private rei: ReiVisual;
  private lacaios: Lacaios;
  private fx = new Particulas3D();
  private efeitos = new Efeitos();
  private sol: THREE.DirectionalLight;
  private pos: Pos | null = null;
  private relogio = 0;
  private escala = 1;
  private medida = { t: 0, n: 0 };
  private tamanho = { w: 1, h: 1 };
  private poeira: THREE.Points;
  private carregou: Promise<void> | null = null;
  /** quem joga neste aparelho (a câmera segue): 0 Natan, 1 Bruna */
  eu = 0;
  /** resolve quando os modelos GLB carregaram (a partida espera antes de começar a luta) */
  readonly pronta: Promise<void>;
  /** câmera fixa (cenas, capturas): posição e ponto para onde olha; null = terceira pessoa normal */
  private camFixa: { pos: THREE.Vector3; alvo: THREE.Vector3 } | null = null;

  constructor(canvas: HTMLCanvasElement, readonly qualidade: Qualidade) {
    const q = qualidade;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.razaoPixel());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = q === 'alta';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    TEMPO.value = 0;

    // luz de pintura: céu lilás por cima, rebatida roxa por baixo, sol dourado pela frente-esquerda e contraluz rosa
    this.scene.fog = new THREE.Fog(0x6a3a9a, 50, 160);
    this.scene.add(new THREE.HemisphereLight(0xcab4ff, 0x4a2a6a, 0.95));
    this.sol = new THREE.DirectionalLight(0xffe0b0, 1.55);
    this.sol.position.set(9, 16, 12);
    this.sol.castShadow = q === 'alta';
    const s = this.sol.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -15; s.camera.right = 15; s.camera.top = 15; s.camera.bottom = -15;
    s.camera.near = 1; s.camera.far = 60; s.bias = -0.0004; s.normalBias = 0.04;
    this.scene.add(this.sol, this.sol.target);
    const contra = new THREE.DirectionalLight(0xff8ad0, 0.8);
    contra.position.set(-6, 9, -14);
    this.scene.add(contra);

    this.ceu = ceuArena();
    this.aneis = aneisDourados();
    this.ilha = construirIlha(q);
    this.pilares = new Pilares(q !== 'baixa');
    this.herois = [new Heroi(0, q !== 'baixa', q === 'alta'), new Heroi(1, q !== 'baixa', q === 'alta')];
    this.rei = new ReiVisual(q !== 'baixa', q === 'alta');
    this.lacaios = new Lacaios(q !== 'baixa');
    this.poeira = this.poeiraEstelar(q === 'baixa' ? 120 : 260);
    this.scene.add(this.ceu, this.aneis, this.ilha.grupo, this.pilares.grupo, this.herois[0].raiz, this.herois[1].raiz, this.rei.raiz, this.lacaios.grupo, this.efeitos.grupo, this.fx.raiz, this.poeira);
    if (q === 'alta') this.pos = new Pos(this.renderer, this.scene, this.cam.camera);
    this.pronta = this.carregar();
  }

  /** Carrega os modelos GLB (natan, bruna, armas, rei, bichinhos). Pode desenhar antes: usa formas simples. */
  carregar(): Promise<void> {
    if (!this.carregou) {
      this.carregou = Promise.all([
        carregarModelo('natan'), carregarModelo('bruna'), carregarModelo('espada_aurora'), carregarModelo('lanca_petala'),
        carregarModelo('rei'), carregarModelo('bolotinha'), carregarModelo('morcego'),
      ]).then(([natan, bruna, espada, lanca, rei, bola, morcego]) => {
        this.herois[0].montar(natan, espada);
        this.herois[1].montar(bruna, lanca);
        this.rei.montar(rei);
        this.lacaios.montar(bola, morcego);
        // compila os materiais novos antes do primeiro quadro (evita engasgo)
        this.renderer.compile(this.scene, this.cam.camera);
      });
    }
    return this.carregou;
  }

  /** Fixa a câmera (cenas e capturas) ou, com null, volta à terceira pessoa. */
  fixarCamera(pos: { x: number; y: number; z: number } | null, alvo?: { x: number; y: number; z: number }) {
    this.camFixa = pos ? { pos: new THREE.Vector3(pos.x, pos.y, pos.z), alvo: new THREE.Vector3(alvo?.x ?? 0, alvo?.y ?? 1, alvo?.z ?? 0) } : null;
  }

  /** rotation.y da câmera, para os controles (entrada.yaw). */
  get yaw() { return this.cam.yaw; }
  get camera() { return this.cam.camera; }

  private razaoPixel() { return Math.min(devicePixelRatio, this.qualidade === 'alta' ? 2 : this.qualidade === 'media' ? 1.5 : 1); }

  redimensionar(w: number, h: number) {
    this.tamanho = { w, h };
    this.renderer.setPixelRatio(this.razaoPixel() * this.escala);
    this.renderer.setSize(w, h, false);
    this.cam.aspecto(w / h);
    const pr = this.renderer.getPixelRatio();
    RESOLUCAO.value.set(w * pr, h * pr);
    (this.poeira.material as THREE.ShaderMaterial).uniforms.uAltura.value = h * pr;
    this.pos?.setSize(w, h, pr);
  }

  private ajustarResolucao(dt: number) {
    if (RES_FIXA) return;
    const m = this.medida;
    m.t += dt; m.n++;
    if (m.t < 0.6 || m.n < 4) return;
    const fps = m.n / m.t;
    m.t = 0; m.n = 0;
    const antes = this.escala;
    if (fps < 20) this.escala = 0.5;
    else if (fps < 40) this.escala = Math.max(0.5, this.escala - 0.15);
    else if (fps > 57) this.escala = Math.min(1, this.escala + 0.1);
    if (this.escala !== antes) this.redimensionar(this.tamanho.w, this.tamanho.h);
  }

  /** Desenha o estado. `dt` em s desde o quadro anterior (0 na pausa); `local` = quem joga aqui (padrão: `eu`). */
  desenhar(e: EstadoArena, dt: number, local: number = this.eu) {
    this.relogio += dt;
    const t = this.relogio;
    TEMPO.value = t;
    this.ajustarResolucao(dt);
    this.renderer.info.reset();
    this.fx.comecar();

    const alvo = { x: e.rei.x, z: e.rei.z };
    this.herois[0].atualizar(e.jogadores[0], e, dt, t, this.fx, alvo);
    this.herois[1].atualizar(e.jogadores[1], e, dt, t, this.fx, alvo);
    this.rei.atualizar(e, dt, t, this.fx);
    this.lacaios.atualizar(e, dt, t, this.fx);
    this.pilares.atualizar(e, dt, t, this.fx);
    this.cam.atualizar(e, local, dt, this.efeitos.tremor, t);
    if (this.camFixa) { this.cam.camera.position.copy(this.camFixa.pos); this.cam.camera.lookAt(this.camFixa.alvo); this.cam.camera.updateMatrixWorld(true); }
    this.efeitos.atualizar(e, dt, t, this.fx, this.herois, this.rei, this.cam.camera.position, local);
    // pilar entre a câmera e quem joga fica pontilhado (não tapa o personagem); câmera fixa (corte) desliga
    { const j = e.jogadores[local], c = this.cam.camera.position;
      RECORTE.uCamP.value.copy(c);
      if (this.camFixa) RECORTE.uAlvoP.value.copy(c); else RECORTE.uAlvoP.value.set(j.x, j.y + 0.8, j.z); }

    // céu: fase 3 escurece, vitória clareia
    const u = (this.ceu.material as THREE.ShaderMaterial).uniforms;
    u.uFase.value = e.rei.fase;
    u.uFim.value += ((e.vitoria ? 1 : 0) - u.uFim.value) * Math.min(1, dt * 0.6);
    this.ceu.position.copy(this.cam.camera.position);
    this.aneis.rotation.y = t * 0.02;
    // brilho da praça e dos cristais da borda
    this.ilha.brilho.color.setScalar(0.85 + 0.15 * Math.sin(t * 1.5));
    // vaga-lumes/poeira de estrelas em volta da ilha
    this.poeira.rotation.y = t * 0.01;
    // brilho no centro da praça
    this.fx.ponto(0, 0.25, 0, 2.2, 0xffd36a, 0.35 + 0.1 * Math.sin(t * 2), C.halo);

    this.fx.terminar(dt);
    if (this.pos) this.pos.render(); else this.renderer.render(this.scene, this.cam.camera);
  }

  /** Pontinhos de luz flutuando em volta da ilha (1 chamada). */
  private poeiraEstelar(n: number): THREE.Points {
    const pos = new Float32Array(n * 3), fase = new Float32Array(n);
    let s = 9;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 6 + rnd() * 34;
      pos.set([Math.sin(a) * r, -6 + rnd() * 18, Math.cos(a) * r], i * 3);
      fase[i] = rnd() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTempo: TEMPO, uAltura: { value: 720 } },
      vertexShader: /* glsl */ `attribute float fase; uniform float uTempo, uAltura; varying float vA;
        void main(){ vec3 p = position; p.y += sin(uTempo * 0.5 + fase) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vA = 0.5 + 0.5 * sin(uTempo * 2.0 + fase * 3.0);
          gl_PointSize = uAltura * 0.06 / -mv.z * (0.6 + vA * 0.6); }`,
      fragmentShader: /* glsl */ `varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 18.0) * vA;
          gl_FragColor = vec4(vec3(1.0, 0.88, 0.6) * a, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    p.renderOrder = 5;
    return p;
  }

  /** Câmera do último quadro: altura projetada de cada personagem (fração da altura da tela, pés à cabeça), se está
   *  dentro do quadro, distância da câmera a quem joga aqui e os ângulos. Para testes e capturas. */
  medirCamera(e: EstadoArena, local: number = this.eu) {
    const cam = this.cam.camera, v = new THREE.Vector3();
    const herois = e.jogadores.map((j) => {
      const pe = v.set(j.x, j.y, j.z).project(cam).clone();
      const cab = v.set(j.x, j.y + 1.15, j.z).project(cam).clone();
      return { altura: +((cab.y - pe.y) / 2).toFixed(3), dentro: Math.abs(pe.x) < 1 && Math.abs(cab.y) < 1 && pe.y > -1 && pe.z < 1, x: +pe.x.toFixed(2), y: +pe.y.toFixed(2) };
    });
    const j = e.jogadores[local];
    return { eu: local, herois, distancia: +cam.position.distanceTo(v.set(j.x, j.y + 0.8, j.z)).toFixed(2), yaw: +this.cam.yaw.toFixed(3), pitch: +(-cam.rotation.x).toFixed(3), fov: cam.fov };
  }

  /** Medidas do último quadro (renderer.info). */
  info() {
    const r = this.renderer.info.render;
    return { chamadas: r.calls, triangulos: r.triangles, geometrias: this.renderer.info.memory.geometries, texturas: this.renderer.info.memory.textures, particulas: this.fx.quantas };
  }

  /** Libera a GPU (ao sair da arena). */
  destruir() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const x of mats) x.dispose();
    });
    this.renderer.dispose();
  }
}
