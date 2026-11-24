// Carrega os modelos GLB da arena (uma vez por página) e os prepara para o desenho em toon: material de 3 tons com
// a textura do Meshy, contorno, e medidas (altura, centro). Se um arquivo falhar, quem usa cai numa forma simples.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type NomeModelo = 'natan' | 'bruna' | 'rei' | 'bolotinha' | 'morcego' | 'espada_aurora' | 'lanca_petala';
export const MODELOS: readonly NomeModelo[] = ['natan', 'bruna', 'rei', 'bolotinha', 'morcego', 'espada_aurora', 'lanca_petala'];

const cache = new Map<NomeModelo, Promise<GLTF | null>>();

/** Pasta dos modelos (relativa à página; o Vite publica `public/` na raiz). */
export let BASE_MODELOS = `${import.meta.env?.BASE_URL ?? './'}modelos/`;
export function definirBaseModelos(b: string) { BASE_MODELOS = b; }

export function carregarModelo(nome: NomeModelo): Promise<GLTF | null> {
  let p = cache.get(nome);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${BASE_MODELOS}${nome}.glb`).catch((err) => {
      console.warn(`arena: modelo ${nome} não carregou`, err);
      return null;
    });
    cache.set(nome, p);
  }
  return p;
}

/** A primeira malha (com geometria) da cena do GLB. */
export function primeiraMalha(g: GLTF): THREE.Mesh | null {
  let m: THREE.Mesh | null = null;
  g.scene.traverse((o) => { if (!m && (o as THREE.Mesh).isMesh) m = o as THREE.Mesh; });
  return m;
}

/** Textura base do material do GLB (cor), com espaço de cor sRGB. */
export function texturaDe(m: THREE.Mesh): THREE.Texture | null {
  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  const t = mat?.map ?? null;
  if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  return t;
}

/**
 * Geometria de um modelo estático "assentado": escala para a altura pedida, pés (base) em y = 0 e centrado em x/z.
 * Devolve uma cópia (o GLB em cache fica intacto).
 */
export function geometriaAssentada(m: THREE.Mesh, altura: number, eixoAlto: 'y' | 'x' = 'y'): THREE.BufferGeometry {
  const g = m.geometry.clone();
  g.applyMatrix4(m.matrixWorld);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const alt = eixoAlto === 'y' ? bb.max.y - bb.min.y : bb.max.x - bb.min.x;
  const k = altura / alt;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.scale(k, k, k);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
