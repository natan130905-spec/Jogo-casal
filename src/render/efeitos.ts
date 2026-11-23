// Efeitos de luz baratos: quadros de luz em lote (halos, raios de sol, névoa — uma chamada por lote) e vaga-lumes
// animados inteiramente no shader (nenhum trabalho de CPU por quadro).
import * as THREE from 'three';
import { materialQuadros, TEMPO } from './materiais';
import { uvCelula, type Celula } from './texturas';

const cTmp = new THREE.Color();

export class Quadros {
  private pos: number[] = []; private uv: number[] = []; private cor: number[] = []; private pisca: number[] = []; private idx: number[] = [];
  /** Quadro virado para +z (a câmera olha de frente), centrado em (x, y, z), girado `rot` no plano. */
  add(cel: Celula, x: number, y: number, z: number, w: number, h: number, cor: number, alfa: number, pisca = 0, rot = 0, ancora: 'centro' | 'topo' = 'centro') {
    const [u0, v0, u1, v1] = uvCelula(cel);
    const base = this.pos.length / 3;
    const c = Math.cos(rot), s = Math.sin(rot);
    const cantos: [number, number, number, number][] = ancora === 'topo'
      ? [[-w / 2, -h, u0, v0], [w / 2, -h, u1, v0], [w / 2, 0, u1, v1], [-w / 2, 0, u0, v1]]
      : [[-w / 2, -h / 2, u0, v0], [w / 2, -h / 2, u1, v0], [w / 2, h / 2, u1, v1], [-w / 2, h / 2, u0, v1]];
    cTmp.setHex(cor);
    for (const [dx, dy, u, v] of cantos) {
      this.pos.push(x + dx * c - dy * s, y + dx * s + dy * c, z);
      this.uv.push(u, v);
      this.cor.push(cTmp.r, cTmp.g, cTmp.b, alfa);
      this.pisca.push(pisca);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  malha(mapa: THREE.Texture, aditivo: boolean): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('cor', new THREE.Float32BufferAttribute(this.cor, 4));
    g.setAttribute('pisca', new THREE.Float32BufferAttribute(this.pisca, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, materialQuadros(mapa, aditivo));
    m.frustumCulled = false; // o lote cobre a fase inteira
    return m;
  }
}

/** Vaga-lumes: pontos que flutuam e piscam no shader. `uAltura` = altura do canvas em pixels. */
export function vagalumes(n: number, largura: number, rnd: () => number, mapa: THREE.Texture) {
  const pos = new Float32Array(n * 3), sem = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const perto = rnd() < 0.55;
    pos[i * 3] = -4 + rnd() * (largura + 8);
    pos[i * 3 + 1] = perto ? -0.5 + rnd() * 4.5 : rnd() * 9;
    pos[i * 3 + 2] = perto ? -2.5 + rnd() * 5.5 : -4 - rnd() * 10;
    sem[i * 3] = rnd(); sem[i * 3 + 1] = rnd(); sem[i * 3 + 2] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('semente', new THREE.BufferAttribute(sem, 3));
  const [u0, v0, u1, v1] = uvCelula('estrela');
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: TEMPO, uAltura: { value: 800 }, uMapa: { value: mapa }, uCel: { value: new THREE.Vector4(u0, v0, u1 - u0, v1 - v0) } },
    vertexShader: /* glsl */ `
      attribute vec3 semente; uniform float uTempo; uniform float uAltura; varying float vBrilho; varying vec3 vCor;
      void main(){
        float t = uTempo * (0.25 + semente.x * 0.35) + semente.y * 40.0;
        vec3 p = position + vec3(sin(t) * 0.9 + sin(t * 2.3) * 0.25, sin(t * 1.3 + 1.0) * 0.5, cos(t * 0.8) * 0.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vBrilho = pow(0.5 + 0.5 * sin(uTempo * (1.5 + semente.z * 2.0) + semente.x * 30.0), 2.0);
        vCor = mix(vec3(1.0, 0.86, 0.35), vec3(0.75, 1.0, 0.55), semente.z);
        gl_PointSize = (0.22 + 0.25 * vBrilho) * uAltura * projectionMatrix[1][1] * 0.5 / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMapa; uniform vec4 uCel; varying float vBrilho; varying vec3 vCor;
      void main(){
        vec2 uv = uCel.xy + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * uCel.zw;
        float a = texture2D(uMapa, uv).a * (0.35 + 0.65 * vBrilho);
        gl_FragColor = vec4(vCor * a * 1.6, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}
