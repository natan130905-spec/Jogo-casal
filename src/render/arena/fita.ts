// Fitas de luz (malha dinâmica, 1 chamada cada): rastro dos golpes (pares base/ponta da arma ao longo do tempo),
// rastro do Corte Cometa e o Fio Vermelho (linha virada para a câmera ao longo de uma curva).
import * as THREE from 'three';

export class Fita {
  readonly malha: THREE.Mesh;
  private pos: Float32Array; private cor: Float32Array;
  private n = 0;
  private c = new THREE.Color();

  /** `max` = quantos pares (seções) cabem. */
  constructor(private max: number, aditivo = true, textura: 'liso' | 'fio' = 'liso') {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3);
    this.cor = new Float32Array(max * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage));
    const lado = new Float32Array(max * 2);
    for (let i = 0; i < max; i++) { lado[i * 2] = 0; lado[i * 2 + 1] = 1; }
    g.setAttribute('lado', new THREE.BufferAttribute(lado, 1));
    const idx: number[] = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 cor; attribute float lado; varying vec4 vCor; varying float vLado;
        void main(){ vCor = cor; vLado = lado; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec4 vCor; varying float vLado;
        void main(){
          ${textura === 'fio'
            ? 'float m = 1.0 - abs(vLado * 2.0 - 1.0); float a = smoothstep(0.0, 0.5, m); vec3 c = mix(vCor.rgb, vec3(1.0, 0.92, 0.9), smoothstep(0.6, 1.0, m) * 0.7);'
            : 'float a = smoothstep(0.0, 0.25, vLado) * (0.55 + 0.45 * vLado); vec3 c = mix(vCor.rgb, vec3(1.0), smoothstep(0.8, 1.0, vLado) * 0.35);'}
          ${aditivo ? 'gl_FragColor = vec4(c * vCor.a * a, 1.0);' : 'gl_FragColor = vec4(c, vCor.a * a);'}
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malha = new THREE.Mesh(g, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 7;
  }

  comecar() { this.n = 0; }

  /** Uma seção: dois pontos (a: lado 0, b: lado 1), cor e alfa. */
  secao(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cor: number, alfa: number) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([ax, ay, az, bx, by, bz], i * 6);
    this.c.setHex(cor);
    this.cor.set([this.c.r, this.c.g, this.c.b, alfa, this.c.r, this.c.g, this.c.b, alfa], i * 8);
  }

  /** Quebra a fita (começa outra tira): seção degenerada de alfa 0. */
  quebrar() {
    if (this.n === 0) return;
    const i = this.n - 1;
    const p = this.pos.slice(i * 6, i * 6 + 6);
    this.secao(p[0], p[1], p[2], p[3], p[4], p[5], 0, 0);
    this.cor[(this.n - 1) * 8 + 3] = 0; this.cor[(this.n - 1) * 8 + 7] = 0;
  }

  /**
   * Curva virada para a câmera: pontos (x, y, z) com largura e alfa por ponto. `cam` é a posição da câmera.
   */
  curva(pts: readonly THREE.Vector3[], larg: (k: number) => number, alfa: (k: number) => number, cor: number, cam: THREE.Vector3) {
    const t = new THREE.Vector3(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      t.subVectors(b, a).normalize();
      v.subVectors(cam, pts[k]).normalize();
      s.crossVectors(t, v).normalize().multiplyScalar(larg(k / (pts.length - 1)) / 2);
      const p = pts[k];
      this.secao(p.x - s.x, p.y - s.y, p.z - s.z, p.x + s.x, p.y + s.y, p.z + s.z, cor, alfa(k / (pts.length - 1)));
    }
  }

  terminar() {
    const g = this.malha.geometry;
    // as seções da curva/rastro seguem uma depois da outra; as tiras separadas usam `quebrar`
    g.setDrawRange(0, Math.max(0, this.n - 1) * 6);
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('cor') as THREE.BufferAttribute).needsUpdate = true;
    this.malha.visible = this.n > 1;
  }
}
