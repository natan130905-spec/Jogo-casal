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
    this.montarLuz();
    this.montarMundo();
    this.montarJogo();
    this.bonecos = [criarPersonagem('P1', qualidade), criarPersonagem('P2', qualidade)];
    for (const b of this.bonecos) this.scene.add(b.raiz);
    (window as unknown as { __cena: THREE.Scene }).__cena = this.scene; // TEMPX
    if (qualidade === 'alta') this.pos = new Pos(this.renderer, this.scene, this.camera);
  }

  private razaoPixel() { return Math.min(devicePixelRatio, this.qualidade === 'alta' ? 2 : this.qualidade === 'media' ? 1.5 : 1); }

  private montarLuz() {
    const corNevoa = new THREE.Color(0xa88bd2);
    this.scene.fog = new THREE.Fog(corNevoa, 20, 95);
    // luz de pintura: céu dourado por cima, rebatida roxa por baixo, sol quente pela esquerda e contraluz rosada
    this.scene.add(new THREE.HemisphereLight(0xffe4c4, 0x5a3f96, 1.55));
    this.sol = new THREE.DirectionalLight(0xffcf8f, 2.3);
    this.sol.castShadow = this.qualidade === 'alta';
    const s = this.sol.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -18; s.camera.right = 18; s.camera.top = 12; s.camera.bottom = -8;
    s.camera.near = 1; s.camera.far = 70; s.bias = -0.0005; s.normalBias = 0.03;
    this.scene.add(this.sol, this.sol.target);
    const contra = new THREE.DirectionalLight(0xff9fd8, 0.9);
    contra.position.set(10, 8, -14);
    this.scene.add(contra);
  }

  private montarMundo() {
    const q = this.qualidade;
    const luzTex = texturaLuz();
    this.ceu = ceu();
    this.scene.add(this.ceu);
    this.scene.add(camadasFundo(texturaSilhuetas(), -120, this.fase.largura + 120));
    const c = construirCenario(this.fase, q);
    this.chao = c.chao;
    const matMundo = materialMundo(q, { ruido: q !== 'baixa' });
    for (const m of c.mundo.malhas(matMundo)) {
      m.receiveShadow = m.castShadow = q === 'alta';
      this.scene.add(m);
    }
    for (const m of c.brilho.malhas(materialBrilho())) this.scene.add(m);
    // grama e flores instanciadas (vento no shader)
    const tufos = new THREE.InstancedMesh(geoTufo(), materialMundo(q, { vento: true, ruido: false }), c.tufos.length);
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
    const agua = lago(-4.4, -120, this.fase.largura + 120, (this.scene.fog as THREE.Fog).color);
    this.scene.add(agua, cascatas(c.cascatas));
    const nevoa = c.nevoa.malha(luzTex, false); nevoa.renderOrder = 3;
    const luz = c.luz.malha(luzTex, true); luz.renderOrder = 4;
    // na baixa, sem névoa em camadas (sobreposição transparente pesa no celular fraco)
    this.scene.add(luz);
    if (q !== 'baixa') this.scene.add(nevoa);
    this.vagalumes = vagalumes(q === 'baixa' ? 70 : q === 'media' ? 150 : 240, this.fase.largura, sorteio(19), luzTex);
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
    // portal: anel dourado, estrela de quatro pontas (o símbolo da capa) e um véu roxo girando
    const g = new THREE.Group();
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false }));
    const forma = new THREE.Shape();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 2, r = i % 2 === 0 ? 0.48 : 0.12; i === 0 ? forma.moveTo(Math.cos(a) * r, Math.sin(a) * r) : forma.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    const estrelaGeo = new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 });
    estrelaGeo.center();
    const estrela = new THREE.Mesh(estrelaGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }));
    const veu = new THREE.Mesh(new THREE.CircleGeometry(0.76, 40), new THREE.MeshBasicMaterial({ map: this.texturaVeu(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    veu.position.z = -0.02;
    g.add(veu, anel, estrela);
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

  /** Altura do chão logo abaixo de (x, y), para a sombra-bolha. */
  private alturaChao(x: number, y: number) {
    let melhor = -Infinity;
    for (const r of this.chao) {
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
    const [a, b] = e.jogadores;
    this.bonecos[0].atualizar(a, b, dt, e.eventos, 0, this.relogio);
    this.bonecos[1].atualizar(b, a, dt, e.eventos, 1, this.relogio);
    e.jogadores.forEach((j, i) => {
      const s = this.sombras[i], y = this.alturaChao(j.x, j.y);
      const alto = j.y - y;
      s.visible = Number.isFinite(y) && alto < 6;
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
    this.portal.rotation.y = Math.sin(this.relogio * 0.8) * 0.35;
    this.portal.children[0].rotation.z -= dt * 0.9;
    this.portal.children[2].rotation.z += dt * 1.2;
    const pulso = 1 + Math.sin(this.relogio * 3) * 0.06 + Math.min(1, e.noPortal) * 0.25;
    this.portal.children[2].scale.setScalar(pulso);

    // câmera: segue o meio dos dois, afasta quando eles se separam e fica um pouco acima, olhando levemente para
    // baixo, para mostrar a floresta (copas, casas, cascata) acima dos personagens, como na arte conceitual
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
    const dist = Math.min(22, Math.max(9, 7 + sep * 0.9));
    this.alvoCam.set(mx, my + 2.0 + dist * 0.06, dist);
    if (!this.iniciou) { this.camera.position.copy(this.alvoCam); this.iniciou = true; }
    this.camera.position.lerp(this.alvoCam, Math.min(1, dt * 4));
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 0.9 - dist * 0.04, 0);
    this.ceu.position.copy(this.camera.position);
    this.sol.position.set(this.camera.position.x - 10, 18, 16);
    this.sol.target.position.set(this.camera.position.x, 0, 0);
    if (this.pos) this.pos.render(); else this.renderer.render(this.scene, this.camera);
  }

  info() { const r = this.renderer.info.render; return { chamadas: r.calls, triangulos: r.triangles }; }
}
