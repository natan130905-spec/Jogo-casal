// O Rei-Pesadelo na arena: rei.glb (toon + contorno) com animação procedural — respira, inclina para quem mira,
// cresce no rugido de troca de fase, ergue-se e bate na pancada, estufa nos esporos, abaixa e dispara na
// investida, cambaleia atordoado (estrelinhas), pisca rápido na cor de quem acertou ao levar dano. Névoa em volta (partículas), escudo de
// névoa na fase 2 (bolha com redemoinho que estilhaça), estrela do peito acesa quando vulnerável, e no fim encolhe e
// vira vaga-lume. Chamadas: corpo (1) + contorno (1) + estrela (1) + escudo (1, fase 2).
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REI, reiVulneravel, type EstadoArena } from '../../core/arena';
import { TEMPO } from '../materiais';
import { geoEstrela4 } from '../elementos';
import { contornoDe, materialContorno, materialToon, type UniformsToon } from './toon';
import { geometriaAssentada, primeiraMalha, texturaDe } from './modelos';
import type { Particulas3D } from './particulas';
import { C } from './atlas';

/** cor do clarão do Rei por quem acertou (as mesmas de COR_HEROI em herois.ts: Natan dourado, Bruna rosa) */
const COR_CLARAO = [0xffc24a, 0xff8ad0];

const ALT = 3.7;
const lim = (t: number) => Math.max(0, Math.min(1, t));

export class ReiVisual {
  readonly raiz = new THREE.Group();
  private corpo = new THREE.Group();
  private u: UniformsToon;
  private estrela: THREE.Mesh;
  private escudo: THREE.Mesh;
  private uEscudo = { uTempo: TEMPO, uAlfa: { value: 0 }, uQuebra: { value: 0 }, uOnda: { value: 0 } };
  private yaw = 0;
  private iniciou = false;
  private clarao = 0;
  private corClarao = new THREE.Color(0xffb0d0);
  private tremor = 0;
  private escala = 1;
  private inclina = 0;
  private sobe = 0;
  private tFim = 0;
  private estrelaLuz = 0;
  private provisorio: THREE.Mesh;
  /** centro do peito (mundo), para efeitos e números */
  readonly peito = new THREE.Vector3();

  constructor(private contorno: boolean, private sombras: boolean) {
    this.raiz.name = 'rei';
    this.raiz.add(this.corpo);
    const mat = materialToon({ cor: 0x8a4ad0, proprio: 0.2, borda: 0xffb8ff, forcaBorda: 0.5 });
    this.u = mat.userData.u;
    this.provisorio = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), mat);
    this.provisorio.position.y = 2;
    this.corpo.add(this.provisorio);
    // estrela do peito (acesa quando vulnerável)
    this.estrela = new THREE.Mesh(geoEstrela4(0.42, 0.11, 0.08), new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false, transparent: true }));
    this.estrela.position.set(0, ALT * 0.42, 0.78);
    this.corpo.add(this.estrela);
    // escudo de névoa (fase 2)
    this.escudo = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 4), new THREE.ShaderMaterial({
      uniforms: this.uEscudo,
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform float uTempo, uAlfa, uQuebra, uOnda; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float fr = pow(1.0 - abs(dot(vN, vV)), 1.6);
          float a = atan(vP.z, vP.x);
          vec3 q = vP * 1.1 + vec3(sin(a * 2.0 + uTempo * 0.8), uTempo * 0.35, cos(a * 2.0 - uTempo * 0.6));
          float redemoinho = n(q) * 0.6 + n(q * 2.3 + 4.0) * 0.4;
          float veios = smoothstep(0.55, 0.75, redemoinho);
          vec3 c = mix(vec3(0.36, 0.14, 0.62), vec3(0.86, 0.6, 1.0), veios * 0.8 + fr * 0.3);
          float alfa = (0.14 + fr * 0.6 + veios * 0.3) * uAlfa;
          // estilhaço: rachaduras claras e buracos que crescem
          float cac = n(vP * 3.0);
          alfa *= 1.0 - smoothstep(1.0 - uQuebra * 1.1, 1.05 - uQuebra * 1.1, cac);
          c += vec3(1.0, 0.9, 1.0) * uOnda * fr;
          gl_FragColor = vec4(c, alfa);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide,
    }));
    this.escudo.position.y = ALT * 0.5;
    this.escudo.renderOrder = 6;
    this.escudo.visible = false;
    this.raiz.add(this.escudo);
  }

  montar(g: GLTF | null) {
    const m = g && primeiraMalha(g);
    if (!m) return;
    g!.scene.updateMatrixWorld(true);
    const geo = geometriaAssentada(m, ALT);
    geo.scale(1, 1, 1.6); // o modelo é achatado (0,6 m de fundo): de lado ficaria fininho
    const mat = materialToon({ mapa: texturaDe(m), proprio: 0.12, borda: 0xffb8ff, forcaBorda: 0.55 });
    this.u = mat.userData.u;
    const malha = new THREE.Mesh(geo, mat);
    malha.castShadow = this.sombras;
    this.corpo.remove(this.provisorio);
    this.corpo.add(malha);
    if (this.contorno) this.corpo.add(contornoDe(malha, materialContorno(0x1e0830, 3.0, 18)));
    // estrela na frente do peito: na superfície do modelo
    geo.computeBoundingBox();
    this.estrela.position.z = geo.boundingBox!.max.z * 0.82;
  }

  atualizar(e: EstadoArena, dt: number, t: number, fx: Particulas3D) {
    const r = e.rei;
    for (const ev of e.eventos) {
      if (ev.startsWith('acerto-rei')) {
        // clarão curto (≈ 60–90 ms) e colorido: a cor de quem acertou, sem lavar o Rei de branco. Antes: branco até
        // 0,48 e 7/s de queda; com tiros a cada 1/3 s o Rei ficava pálido, piscando o tempo todo.
        const [, quem, o] = ev.split(':');
        const forca = o === 'tiro' ? 0.14 : o === 'golpe' ? 0.26 : 0.34;
        if (forca >= this.clarao) this.corClarao.setHex(o === 'fio' ? 0xff5a6a : COR_CLARAO[Number(quem)] ?? 0xffb0d0);
        this.clarao = Math.max(this.clarao, forca);
      }
      else if (ev.startsWith('defendeu')) { this.uEscudo.uOnda.value = 1; }
      else if (ev === 'escudo-quebra') {
        this.uEscudo.uQuebra.value = 0.01;
        fx.explosao(r.x, ALT * 0.5, r.z, 28, 0xc890ff, 9, 0.4, 1.0, C.brilho, 6);
        fx.explosao(r.x, ALT * 0.5, r.z, 18, 0xf0e0ff, 6, 0.3, 0.7, C.faisca, 4);
      } else if (ev.startsWith('chefe-fase')) {
        this.tremor = 1;
        for (let k = 0; k < 2; k++) fx.emitir({ x: r.x, y: 0.5 + k * 1.5, z: r.z, vida: 0.9 + k * 0.15, tam: 2, tamFim: 7.5, cor: 0xb070ff, alfa: 0.35, cel: C.anel });
      } else if (ev === 'chefe-golpe:pancada') this.tremor = 0.6;
      else if (ev === 'atordoado') fx.explosao(r.x, ALT, r.z, 12, 0xfff0a0, 3, 0.25, 0.6, C.estrela, 4);
    }
    this.clarao = Math.max(0, this.clarao * Math.exp(-dt * 28) - dt * 0.5);
    this.tremor = Math.max(0, this.tremor - dt * 1.5);
    this.uEscudo.uOnda.value = Math.max(0, this.uEscudo.uOnda.value - dt * 4);

    // posição e direção
    this.raiz.position.set(r.x, 0, r.z);
    let d = r.ang - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (!this.iniciou) { this.yaw = r.ang; this.iniciou = true; }
    this.yaw += d * Math.min(1, dt * (r.ataque === 'investida' ? 12 : 4));
    this.raiz.rotation.y = this.yaw;

    // pose procedural
    let alvoEsc = 1, alvoInc = 0, alvoSobe = 0.25, trem = 0;
    const aviso = REI.aviso[r.fase - 1];
    if (r.transicao > 0) { alvoEsc = 1.18; alvoInc = -0.22; alvoSobe = 0.6; trem = 0.08; }
    else if (r.atordoado > 0) { alvoInc = 0.18; alvoSobe = 0.05; }
    else if (r.etapa === 'aviso') {
      const p = 1 - lim(r.t / aviso);
      switch (r.ataque) {
        case 'pancada': alvoSobe = 0.25 + p * 1.4; alvoInc = -0.25 * p; alvoEsc = 1 + 0.06 * p; break;
        case 'esporos': alvoEsc = 1 + 0.14 * p + Math.sin(t * 20) * 0.02 * p; alvoInc = -0.1 * p; break;
        case 'investida': alvoInc = -0.2 * p; alvoSobe = 0.1; trem = 0.05 * p; alvoEsc = 0.96; break;
        case 'invocar': case 'morcegos': alvoInc = -0.18 * p; alvoEsc = 1 + 0.08 * p; alvoSobe = 0.25 + p * 0.5; break;
      }
    } else if (r.etapa === 'execucao') {
      switch (r.ataque) {
        case 'pancada': alvoSobe = -0.15; alvoInc = 0.35; alvoEsc = 1.04; break;
        case 'investida': alvoInc = 0.5; alvoSobe = 0.15; break;
        case 'esporos': alvoEsc = 0.94; break;
        default: alvoInc = 0.1;
      }
    }
    const k = Math.min(1, dt * (r.etapa === 'execucao' ? 22 : 6));
    this.escala += (alvoEsc - this.escala) * k;
    this.inclina += (alvoInc - this.inclina) * k;
    this.sobe += (alvoSobe - this.sobe) * k;
    // fim: encolhe e some (vira vaga-lume)
    if (e.vitoria) this.tFim += dt; else this.tFim = 0;
    const some = e.vitoria ? lim(1 - (this.tFim - 0.3) / 1.3) : 1;
    const resp = Math.sin(t * 2.1);
    const tr = (this.tremor * 0.12 + trem) * Math.sin(t * 70);
    this.corpo.position.set(tr, this.sobe + Math.sin(t * 1.3) * 0.12, 0);
    this.corpo.rotation.set(this.inclina, e.vitoria ? this.tFim * 6 : 0, (r.atordoado > 0 ? Math.sin(t * 5) * 0.14 : 0) + tr * 0.3);
    this.corpo.scale.set(this.escala * (1 - resp * 0.012) * some, this.escala * (1 + resp * 0.03) * some, this.escala * (1 - resp * 0.012) * some);
    this.raiz.visible = some > 0.01;

    // cor: fase 2 mais enevoada, fase 3 mais escura; clarão curto e colorido ao levar dano
    // a estrela do peito acende quando o Rei fica exposto: escudo quebrado (fase 2) ou parede caída (fase 3)
    const vul = reiVulneravel(e) && r.fase !== 1 && r.vulneravel > 0;
    this.u.uClarao.value = this.clarao;
    this.u.uCorClarao.value.copy(this.corClarao);
    if (r.fase === 3 && e.parede !== 0) this.u.uTinta.value.setRGB(0.78, 0.7, 0.92);
    else if (r.fase === 2 && r.escudo) this.u.uTinta.value.setRGB(0.92, 0.88, 1.05);
    else this.u.uTinta.value.setRGB(1, 1, 1);

    // estrela do peito
    this.estrelaLuz += ((vul ? 1 : 0) - this.estrelaLuz) * Math.min(1, dt * 6);
    this.estrela.visible = this.estrelaLuz > 0.03;
    const em = this.estrela.material as THREE.MeshBasicMaterial;
    em.color.setRGB(1, 0.85 + 0.1 * this.estrelaLuz, 0.45 + 0.4 * this.estrelaLuz).multiplyScalar(0.45 + this.estrelaLuz * 1.2);
    this.estrela.rotation.z = Math.sin(t * 2) * 0.15;
    this.estrela.scale.setScalar(this.estrelaLuz * (1.15 + 0.12 * Math.sin(t * 8)));
    this.raiz.updateMatrixWorld(true);
    this.estrela.getWorldPosition(this.peito);
    if (some > 0.05) {
      if (this.estrelaLuz > 0.3) {
        fx.ponto(this.peito.x, this.peito.y, this.peito.z, 2.6 * this.estrelaLuz + Math.sin(t * 8) * 0.3, 0xffd870, 0.7 * this.estrelaLuz, C.halo);
        fx.ponto(this.peito.x, this.peito.y, this.peito.z, 1.6 * this.estrelaLuz, 0xffffff, 0.9 * this.estrelaLuz, C.brilho, t);
      }
      // névoa em volta (mais na fase 2)
      const n = (r.fase === 2 ? 26 : 16) * dt;
      for (let q = 0; q < Math.floor(n + Math.random()); q++) {
        const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 1.2;
        fx.emitir({ x: r.x + Math.cos(a) * rr, y: 0.2 + Math.random() * 1.2, z: r.z + Math.sin(a) * rr, vx: Math.cos(a) * 0.5, vy: 0.5 + Math.random() * 0.5, vz: Math.sin(a) * 0.5, arrasto: 0.8, vida: 1.6, tam: 1.8, tamFim: 3.2, cor: r.fase === 3 ? 0x8a50c8 : 0xb88af0, alfa: 0.3, cel: C.halo, aditivo: false, rot: Math.random() * 6, vrot: (Math.random() - 0.5) });
      }
      // rugido: ondas de névoa. Anéis são quadros virados para a câmera e cortados pelo chão: maiores que ~8 m e
      // muitos ao mesmo tempo (mistura aditiva) viravam um retângulo branco de borda reta em volta do Rei.
      if (r.transicao > 0 && Math.random() < dt * 3) fx.emitir({ x: r.x, y: 0.4, z: r.z, vida: 0.8, tam: 2, tamFim: 8, cor: 0xb070ff, alfa: 0.35, cel: C.anel });
      // investida: rastro de névoa
      if (r.ataque === 'investida' && r.etapa === 'execucao') {
        for (let q = 0; q < 3; q++) fx.emitir({ x: r.x + (Math.random() - 0.5) * 2, y: 0.4 + Math.random() * 2.5, z: r.z + (Math.random() - 0.5) * 2, vy: 0.3, vida: 0.8, tam: 2, tamFim: 3.2, cor: 0xb08ae8, alfa: 0.35, cel: C.halo, aditivo: false, rot: Math.random() * 6 });
      }
      // atordoado: estrelinhas girando em volta da coroa
      if (r.atordoado > 0) {
        for (let q = 0; q < 5; q++) {
          const a = t * 3 + (q / 5) * Math.PI * 2;
          fx.ponto(r.x + Math.cos(a) * 1.3, this.corpo.position.y + ALT * this.escala + 0.3 + Math.sin(a * 2) * 0.12, r.z + Math.sin(a) * 1.3, 0.45, 0xfff0a0, 0.95, C.estrela, a);
        }
      }
    }

    // escudo da fase 2
    const temEscudo = r.fase === 2 && r.escudo && !e.vitoria;
    if (temEscudo && this.uEscudo.uQuebra.value > 0.9) this.uEscudo.uQuebra.value = 0; // voltou
    if (this.uEscudo.uQuebra.value > 0) this.uEscudo.uQuebra.value = Math.min(1, this.uEscudo.uQuebra.value + dt * 2.2);
    const alvoA = temEscudo ? 1 : 0;
    const ua = this.uEscudo.uAlfa;
    ua.value += (alvoA - ua.value) * Math.min(1, dt * (temEscudo ? 3 : 1.6));
    if (!temEscudo && this.uEscudo.uQuebra.value >= 1) ua.value = 0;
    this.escudo.visible = ua.value > 0.01;
    this.escudo.scale.setScalar((0.9 + 0.1 * ua.value) * (1 + Math.sin(t * 2) * 0.02) * this.escala);
    this.escudo.position.y = this.corpo.position.y + ALT * 0.48;
  }
}
