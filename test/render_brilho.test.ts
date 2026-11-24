// Brilho seletivo da alta (src/render/pos.ts): só pixels com alfa > 1,5 no alvo HalfFloat florescem. Um material
// aditivo que escreve alfa 1 no quadrado inteiro da partícula soma 1 ao alfa do fundo (1) e marca um QUADRADO: o fundo
// claro floresce em quadrado (REGISTRO R65, cap. 3 alta, estrelinha no mostrador). Aqui: os materiais aditivos de
// partículas e vaga-lumes somam no alfa só a forma da textura.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Lote } from '../src/render/particulas';
import { vagalumes } from '../src/render/efeitos';

function conferir(m: THREE.ShaderMaterial) {
  expect(m.blending).toBe(THREE.CustomBlending);
  expect([m.blendSrc, m.blendDst, m.blendSrcAlpha, m.blendDstAlpha]).toEqual([THREE.OneFactor, THREE.OneFactor, THREE.OneFactor, THREE.OneFactor]);
  // o alfa escrito depende da textura (t.a / a), nunca a constante 1.0
  const saida = m.fragmentShader.match(/gl_FragColor\s*=\s*vec4\(([^;]*)\);/)![1];
  expect(saida.trim().endsWith(', 1.0)')).toBe(false);
  expect(/\b(t\.a|a)\b[^,]*$/.test(saida)).toBe(true);
}

describe('R65 · brilho seletivo: partículas aditivas marcam só a forma', () => {
  const mapa = new THREE.Texture();
  it('faíscas, halos e brilhos (lote aditivo de Particulas)', () => {
    const lote = new Lote(8, mapa, true);
    conferir(lote.malha.material as THREE.ShaderMaterial);
  });
  it('vaga-lumes', () => {
    const pts = vagalumes(4, 10, Math.random, mapa);
    conferir(pts.material as THREE.ShaderMaterial);
  });
});
