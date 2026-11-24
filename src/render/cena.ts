// Renderização 3D em vista lateral (2.5D) com Three.js. Lê o Estado da simulação; não altera nada nele.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Estado, Fase, Retangulo } from '../core/types';
import { TEMPO, materialBrilho, materialMundo } from './materiais';
import { texturaLuz, texturaRuna, texturaSilhuetas, uvCelula } from './texturas';
import { ceu, camadasFundo } from './ceu';
import { construirCenario, geoFlor, geoTufo, CORES } from './cenario';
import { cascatas, lago } from './agua';
import { vagalumes } from './efeitos';
import { Pos } from './pos';
import { colocar, pintar, sorteio } from './util';
import { criarPersonagem, type Personagem } from './personagem';
import { temaDaFase, type Tema } from './tema';
import { Particulas, Cel } from './particulas';
import { Bichinhos } from './bichinhos';
import { Elementos } from './elementos';
import { especiaisAtivas } from '../core/sim';

export type Qualidade = 'baixa' | 'media' | 'alta';

/** `?resfixa` desliga a resolução dinâmica (capturas de tela comparáveis em máquina sem GPU). */
const RES_FIXA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('resfixa');

export class Cena {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 400);
  private bonecos: [Personagem, Personagem];
  private sombras: THREE.Mesh[] = [];
  private portas = new Map<string, THREE.Group>();
  private placas = new Map<string, THREE.Mesh>();
  private portal!: THREE.Group;
  private pedaco!: THREE.Mesh;
  private tema: Tema;
  private fx = new Particulas();
  private bichos: Bichinhos;
  private elementos: Elementos;
  private vagalumes!: THREE.Points;
  private ceu!: THREE.Mesh;
  private sol!: THREE.DirectionalLight;
  private pos: Pos | null = null;
  private chao: Retangulo[] = [];
  private alvoCam = new THREE.Vector3();
  private relogio = 0;
  private iniciou = false;
  // resolução dinâmica: se o aparelho não segura ~40 fps, baixa a resolução interna (até metade) e sobe de volta
  private escala = 1;
  private medida = { t: 0, n: 0 };
  private tamanho = { w: 1, h: 1 };

  constructor(canvas: HTMLCanvasElement, private fase: Fase, readonly qualidade: Qualidade) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.razaoPixel());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    // sombras de verdade só na alta; na média e na baixa, sombra-bolha sob os personagens (bem mais barato)
    this.renderer.shadowMap.enabled = qualidade === 'alta';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true; // a porteira some dentro do lintel ao subir
    this.renderer.info.autoReset = false;
    TEMPO.value = 0;
    this.tema = temaDaFase(fase);
    this.montarLuz();
    this.montarMundo();
    this.montarJogo();
    this.bonecos = [criarPersonagem('P1', qualidade), criarPersonagem('P2', qualidade)];
    for (const b of this.bonecos) this.scene.add(b.raiz);
    this.bichos = new Bichinhos(fase, qualidade);
    this.elementos = new Elementos(fase, qualidade, this.tema);
    this.scene.add(this.bichos.raiz, this.elementos.raiz, this.fx.raiz);
    if (qualidade === 'alta') this.pos = new Pos(this.renderer, this.scene, this.camera);
  }

  private razaoPixel() { return Math.min(devicePixelRatio, this.qualidade === 'alta' ? 2 : this.qualidade === 'media' ? 1.5 : 1); }

  private montarLuz() {
    const t = this.tema;
    const corNevoa = new THREE.Color(t.nevoa.cor);
    this.scene.fog = new THREE.Fog(corNevoa, t.nevoa.perto, t.nevoa.longe);
    // luz de pintura: céu dourado por cima, rebatida roxa por baixo, sol quente pela esquerda e contraluz rosada
    // (cores do tema do capítulo; a floresta é a referência)
    this.scene.add(new THREE.HemisphereLight(t.luz.ceu, t.luz.chao, t.luz.forca));
    this.sol = new THREE.DirectionalLight(t.luz.sol, t.luz.forcaSol);
    this.sol.castShadow = this.qualidade === 'alta';
    const s = this.sol.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -18; s.camera.right = 18; s.camera.top = 12; s.camera.bottom = -8;
    s.camera.near = 1; s.camera.far = 70; s.bias = -0.0005; s.normalBias = 0.03;
    this.scene.add(this.sol, this.sol.target);
    const contra = new THREE.DirectionalLight(t.luz.contra, t.luz.forcaContra);
    contra.position.set(10, 8, -14);
    this.scene.add(contra);
  }

  private montarMundo() {
    const q = this.qualidade;
    const luzTex = texturaLuz();
    const t = this.tema;
    this.ceu = ceu(t.ceu);
    this.scene.add(this.ceu);
    this.scene.add(camadasFundo(texturaSilhuetas(t.chave), -120, this.fase.largura + 120, t.silhuetas));
    const c = construirCenario(this.fase, q, t);
    this.chao = c.chao;
    const matMundo = materialMundo(q, { ruido: q !== 'baixa' });
    for (const m of c.mundo.malhas(matMundo)) {
      m.receiveShadow = m.castShadow = q === 'alta';
      this.scene.add(m);
    }
    for (const m of c.brilho.malhas(materialBrilho())) this.scene.add(m);
    // grama e flores instanciadas (vento no shader)
    const tufos = new THREE.InstancedMesh(geoTufo(t.chao), materialMundo(q, { vento: true, ruido: false }), c.tufos.length);
    c.tufos.forEach((m, i) => tufos.setMatrixAt(i, m));
    tufos.receiveShadow = q === 'alta';
    tufos.computeBoundingSphere();
    this.scene.add(tufos);
    if (c.flores.length) {
      const flores = new THREE.InstancedMesh(geoFlor(), materialMundo(q, { vento: true, ruido: false }), c.flores.length);
      c.flores.forEach((f, i) => { flores.setMatrixAt(i, f.m); flores.setColorAt(i, f.cor); });
      flores.computeBoundingSphere();
      this.scene.add(flores);
    }
    if (t.agua) this.scene.add(lago(-4.4, -120, this.fase.largura + 120, (this.scene.fog as THREE.Fog).color, t.agua));
    if (c.cascatas.length) this.scene.add(cascatas(c.cascatas));
    const nevoa = c.nevoa.malha(luzTex, false); nevoa.renderOrder = 3;
    const luz = c.luz.malha(luzTex, true); luz.renderOrder = 4;
    // na baixa, sem névoa em camadas (sobreposição transparente pesa no celular fraco)
    this.scene.add(luz);
    if (q !== 'baixa') this.scene.add(nevoa);
    this.vagalumes = vagalumes(q === 'baixa' ? 70 : q === 'media' ? 150 : 240, this.fase.largura, sorteio(19), luzTex, t.vagalumes);
    this.vagalumes.renderOrder = 5;
    this.scene.add(this.vagalumes);
    // sombra-bolha (macia) sob cada personagem
    const [u0, v0, u1, v1] = uvCelula('halo');
    for (let i = 0; i < 2; i++) {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: luzTex, color: 0x1c0b38, transparent: true, opacity: q === 'alta' ? 0.45 : 0.7, depthWrite: false, fog: false }));
      m.renderOrder = 1;
      this.sombras.push(m); this.scene.add(m);
    }
  }

  /** Peças que se mexem com o jogo: placas, porteira e portal. */
  private montarJogo() {
    const q = this.qualidade;
    const runa = texturaRuna();
    for (const p of this.fase.placas) {
      const mat = q === 'baixa'
        ? new THREE.MeshLambertMaterial({ color: 0xb4a6c8, emissive: 0xffc040, emissiveMap: runa, emissiveIntensity: 0.6 })
        : new THREE.MeshStandardMaterial({ color: 0xb4a6c8, roughness: 0.6, emissive: 0xffc040, emissiveMap: runa, emissiveIntensity: 0.6 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.w / 2, p.w / 2 + 0.03, 0.12, 28), mat);
      m.position.set(p.x + p.w / 2, p.y + 0.09, 0.6);
      m.receiveShadow = q === 'alta';
      this.placas.set(p.id, m); this.scene.add(m);
    }
    for (const p of this.fase.portas) {
      const corte = [new THREE.Plane(new THREE.Vector3(0, -1, 0), p.y + p.h)];
      const geos: THREE.BufferGeometry[] = [];
      const fundo = 3.7, n = 8;
      for (let k = 0; k < n; k++) {
        const g = new THREE.BoxGeometry(p.w * (k % 2 ? 0.92 : 1), p.h + 0.25, fundo / n - 0.03);
        colocar(g, 0, (p.h + 0.25) / 2, -fundo / 2 + (k + 0.5) * (fundo / n) - 0.1);
        geos.push(pintar(g, k % 2 ? 0x8a5732 : CORES.madeira));
      }
      for (const y of [0.45, p.h - 0.5]) {
        const g = new THREE.BoxGeometry(p.w + 0.08, 0.16, fundo + 0.06); colocar(g, 0, y, -0.1); geos.push(pintar(g, CORES.ferro));
        for (let k = 0; k < 5; k++) { const r = new THREE.SphereGeometry(0.05, 5, 3); colocar(r, p.w / 2 + 0.04, y, -fundo / 2 + 0.3 + k * 0.8); geos.push(pintar(r, 0x8a8098)); }
      }
      const matPorta = materialMundo(q);
      matPorta.clippingPlanes = corte;
      const grupo = new THREE.Group();
      const corpo = new THREE.Mesh(mergeGeometries(geos)!, matPorta);
      corpo.castShadow = q === 'alta';
      // runa dourada nas duas faces que a câmera vê (lado e frente)
      const matRuna = new THREE.MeshBasicMaterial({ map: runa, color: 0xffd060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: corte, toneMapped: false, fog: false });
      const runas: THREE.BufferGeometry[] = [];
      for (const sx of [-1, 1]) { const g = new THREE.PlaneGeometry(1.5, 1.5); g.rotateY(sx * Math.PI / 2); g.translate(sx * (p.w / 2 + 0.01), p.h * 0.55, 0); runas.push(g); }
      const fr = new THREE.PlaneGeometry(p.w * 0.9, p.w * 0.9); fr.translate(0, p.h * 0.55, fundo / 2 - 0.1 + 0.01); runas.push(fr);
      grupo.add(corpo, new THREE.Mesh(mergeGeometries(runas)!, matRuna));
      grupo.position.set(p.x + p.w / 2, p.y, 0);
      this.portas.set(p.id, grupo); this.scene.add(grupo);
    }
    // pedaço da estrela: um caco da estrela de 4 pontas (rachado), dourado, flutuando num anel de luz.
    // Enquanto o Rei-Pesadelo está vivo, fica apagado (lilás) — só vale depois de derrotá-lo.
    const g = new THREE.Group();
    const caco = new THREE.Shape();
    const pts: [number, number][] = [[0, 0.66], [0.13, 0.15], [0.42, 0.06], [0.33, -0.03], [0.4, -0.12], [0.12, -0.2], [0.02, -0.4], [-0.05, -0.29], [-0.13, -0.33], [-0.14, -0.14], [-0.64, 0], [-0.13, 0.13]];
    pts.forEach(([x, y], i) => (i ? caco.lineTo(x, y) : caco.moveTo(x, y)));
    const geoCaco = new THREE.ExtrudeGeometry(caco, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
    geoCaco.center();
    const pc = geoCaco.getAttribute('position') as THREE.BufferAttribute, cores = new Float32Array(pc.count * 3), cc = new THREE.Color();
    for (let i = 0; i < pc.count; i++) { cc.setHex(0xffc850).lerp(new THREE.Color(0xfffbe8), Math.min(1, 0.45 + pc.getY(i) * 0.6 + pc.getZ(i) * 2)); cores.set([cc.r, cc.g, cc.b], i * 3); }
    geoCaco.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    this.pedaco = new THREE.Mesh(geoCaco, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false, transparent: true, opacity: 0.7 }));
    const veu = new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), new THREE.MeshBasicMaterial({ map: this.texturaVeu(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    veu.position.z = -0.1;
    g.add(veu, anel, this.pedaco);
    if (q !== 'baixa') g.add(new THREE.PointLight(0xffd98a, 5, 7, 1.5));
    const pr = this.fase.portal;
    g.position.set(pr.x + pr.w / 2, pr.y + 1, 0.2);
    this.portal = g; this.scene.add(g);
  }

  /** Espiral roxa e dourada do véu do portal (canvas). */
  private texturaVeu() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(200,120,255,0.75)'); gr.addColorStop(0.8, 'rgba(90,50,200,0.5)'); gr.addColorStop(1, 'rgba(255,210,140,0.9)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(255,230,170,0.55)'; x.lineWidth = 3;
    for (let b = 0; b < 4; b++) { x.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = b * Math.PI / 2 + t * 5, r = t * 60; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  redimensionar(w: number, h: number) {
    this.tamanho = { w, h };
    this.renderer.setPixelRatio(this.razaoPixel() * this.escala);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.vagalumes.material as THREE.ShaderMaterial).uniforms.uAltura.value = h * this.renderer.getPixelRatio();
    this.pos?.setSize(w, h, this.renderer.getPixelRatio());
  }

  private ajustarResolucao(dt: number) {
    if (RES_FIXA) return;
    const m = this.medida;
    m.t += dt; m.n++;
    if (m.t < 0.6 || m.n < 4) return;
    const fps = m.n / m.t;
    m.t = 0; m.n = 0;
    const antes = this.escala;
    if (fps < 20) this.escala = 0.5; // muito abaixo: vai direto ao mínimo
    else if (fps < 40) this.escala = Math.max(0.5, this.escala - 0.15);
    else if (fps > 57) this.escala = Math.min(1, this.escala + 0.1);
    if (this.escala !== antes) this.redimensionar(this.tamanho.w, this.tamanho.h);
  }

  /** Altura do chão logo abaixo de (x, y), para a sombra-bolha (inclui as plataformas especiais ativas). */
  private alturaChao(x: number, y: number, extra: readonly Retangulo[] = []) {
    let melhor = -Infinity;
    for (const r of [...this.chao, ...extra]) {
      const topo = r.y + r.h;
      if (x >= r.x - 0.2 && x <= r.x + r.w + 0.2 && topo <= y + 0.05 && topo > melhor) melhor = topo;
    }
    return melhor;
  }

  desenhar(e: Estado, dt: number) {
    this.relogio += dt;
    TEMPO.value = this.relogio;
    this.ajustarResolucao(dt);
    this.renderer.info.reset();
    this.fx.comecar();
    const [a, b] = e.jogadores;
    // para onde a corda puxa quem está pendurado: a argola, ou as mãos de quem segura
    const corda = (j: typeof a, o: typeof a) => {
      const g = j.argola >= 0 ? (this.fase.argolas ?? [])[j.argola] : null;
      if (g) return g;
      return j.pendurado ? { x: o.x, y: o.y + 0.6 } : null;
    };
    this.bonecos[0].atualizar(a, b, dt, e.eventos, 0, this.relogio, corda(a, b));
    this.bonecos[1].atualizar(b, a, dt, e.eventos, 1, this.relogio, corda(b, a));
    const esp = especiaisAtivas(this.fase, e);
    e.jogadores.forEach((j, i) => {
      const s = this.sombras[i], y = this.alturaChao(j.x, j.y, esp);
      const alto = j.y - y;
      s.visible = Number.isFinite(y) && alto < 6 && !j.bolha;
      s.position.set(j.x, y + 0.025, 0);
      s.scale.setScalar(Math.max(0.35, 1.3 - alto * 0.18));
    });
    for (const [id, g] of this.portas) {
      const ab = e.portas[id] ?? 0;
      const p = this.fase.portas.find((x) => x.id === id)!;
      g.position.y = p.y + ab * p.h; // sobe para dentro do lintel; a parte de cima é cortada (igual à colisão)
      g.visible = ab < 0.99;
    }
    for (const [id, m] of this.placas) {
      const on = !!e.placasPressionadas[id];
      m.position.y += ((on ? 0.03 : 0.09) - m.position.y) * Math.min(1, dt * 18);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += ((on ? 2.6 : 0.55 + Math.sin(this.relogio * 2.5) * 0.15) - mat.emissiveIntensity) * Math.min(1, dt * 8);
    }
    this.bichos.atualizar(e.inimigos, e.eventos, dt, this.relogio, this.fx);
    this.elementos.atualizar(e, dt, this.relogio, this.fx);
    this.animarPedaco(e, dt);

    // câmera: segue o meio dos dois, afasta quando eles se separam e fica um pouco acima, olhando levemente para
    // baixo, para mostrar a floresta (copas, casas, cascata) acima dos personagens, como na arte conceitual
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
    const dist = Math.min(22, Math.max(7.6, 6 + sep * 0.9));
    this.alvoCam.set(mx, my + 2.0 + dist * 0.06, dist);
    if (!this.iniciou) { this.camera.position.copy(this.alvoCam); this.iniciou = true; }
    this.camera.position.lerp(this.alvoCam, Math.min(1, dt * 4));
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 0.9 - dist * 0.04, 0);
    this.ceu.position.copy(this.camera.position);
    this.sol.position.set(this.camera.position.x - 8, 20, 7);
    this.sol.target.position.set(this.camera.position.x, 0, 0);
    this.fx.terminar(dt);
    if (this.pos) this.pos.render(); else this.renderer.render(this.scene, this.camera);
  }

  /** Pedaço da estrela: gira e pulsa; apagado enquanto o Rei vive; brilha mais com os dois tocando. */
  private animarPedaco(e: Estado, dt: number) {
    const t = this.relogio, p = this.portal, fx = this.fx;
    const bloqueado = e.inimigos.some((n) => n.tipo === 'rei' && n.vivo);
    const toque = Math.min(1, e.noPortal / 0.6);
    p.position.y = this.fase.portal.y + 1 + Math.sin(t * 1.6) * 0.08;
    this.pedaco.rotation.y = Math.sin(t * 0.9) * 0.6;
    this.pedaco.rotation.z = Math.sin(t * 0.7) * 0.12;
    this.pedaco.scale.setScalar((1 + Math.sin(t * 3) * 0.05 + toque * 0.25) * (bloqueado ? 0.85 : 1));
    (this.pedaco.material as THREE.MeshBasicMaterial).color.setHex(bloqueado ? 0x8a78b8 : 0xffffff);
    p.children[0].rotation.z -= dt * 0.9;
    p.children[0].visible = !bloqueado;
    (p.children[1] as THREE.Mesh).scale.setScalar(1 + Math.sin(t * 2) * 0.03 + toque * 0.15);
    const x = p.position.x, y = p.position.y;
    fx.ponto(x, y, 0.1, (bloqueado ? 1.8 : 3.0) + Math.sin(t * 3) * 0.2 + toque * 1.5, bloqueado ? 0x8a60d0 : 0xffd070, bloqueado ? 0.4 : 0.7, Cel.Halo);
    if (!bloqueado) {
      for (let k = 0; k < 5; k++) {
        const a = t * (0.9 + k * 0.13) + (k / 5) * Math.PI * 2;
        fx.ponto(x + Math.cos(a) * 1.05, y + Math.sin(a) * 0.55, 0.3 + Math.sin(a) * 0.3, 0.28 + 0.1 * Math.sin(t * 5 + k), 0xfff0c0, 0.85, Cel.Brilho, t * 2 + k);
      }
    }
    for (const ev of e.eventos) {
      if (ev === 'pedaco') fx.explosao(x, y, 16, 0xffe08a, 4, 0.4, 0.8, 0.4);
      else if (ev === 'concluida') {
        fx.emitir({ x, y, z: 0.5, vida: 0.8, tam: 1, tamFim: 7, cor: 0xfff0c0, alfa: 0.9, cel: Cel.Anel });
        fx.explosao(x, y, 40, 0xffe08a, 7, 0.5, 1.2, 0.5);
        fx.explosao(x, y, 24, 0xff9ad8, 5, 0.4, 1.0, 0.5);
      } else if (ev === 'chefe-derrotado') fx.emitir({ x, y, z: 0.5, vida: 0.8, tam: 1, tamFim: 5, cor: 0xffe8a0, alfa: 0.9, cel: Cel.Anel });
    }
  }

  info() { const r = this.renderer.info.render; return { chamadas: r.calls, triangulos: r.triangles }; }
}
