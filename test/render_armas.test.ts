// Armas no render (L4): itens na mão procedurais com ≤ 1,5 mil triângulos cada; um só programa (o material do
// mundo) para itens e elementos; pedrinhas e miçangas instanciadas que não desenham nada vazias.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Armas, criarItemNaMao, geometriasItens } from '../src/render/armas';
import { ITEM, ITENS } from '../src/core/arsenal';
import { faseDoCapitulo } from '../src/core/fases';
import { estadoInicial } from '../src/core/sim';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('armas no render', () => {
  it('todo item do MVP tem geometria na mão com ≤ 1,5 mil triângulos', () => {
    const geos = geometriasItens();
    for (const d of Object.values(ITENS).filter((x) => x.mvp)) {
      const g = geos.get(d.id);
      expect(g, d.nome).toBeDefined();
      console.log(`${d.nome}: ${tris(g!)} triângulos`);
      expect(tris(g!)).toBeLessThanOrEqual(1500);
    }
  });
  it('o item na mão troca a geometria sem trocar de material (uma chamada, um programa)', () => {
    const it = criarItemNaMao('media');
    const mat = it.malha.material;
    it.mostrar(ITEM.martelo);
    expect(it.malha.visible).toBe(true);
    expect(it.malha.geometry).toBe(geometriasItens().get(ITEM.martelo));
    it.mostrar(ITEM.espada);
    expect(it.malha.material).toBe(mat);
    it.mostrar(-1);
    expect(it.malha.visible).toBe(false);
  });
  it('cap. 1: sino, barbante, bloco rachado e baú montados; pedrinhas e miçangas vazias no começo', () => {
    const f = faseDoCapitulo(1)!;
    const a = new Armas(f, 'media');
    const malhas: THREE.Mesh[] = [];
    a.raiz.traverse((o) => { if ((o as THREE.Mesh).isMesh) malhas.push(o as THREE.Mesh); });
    const inst = malhas.filter((m) => (m as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(inst.length).toBe(2);
    expect(inst.every((m) => m.count === 0 && m.visible)).toBe(true);
    // 1 sino + (corda + pacote) + 1 bloco + (base + tampa) do baú
    expect(malhas.length - inst.length).toBe(1 + 2 + 1 + 2);
    const progs = new Set(malhas.filter((m) => !(m as THREE.InstancedMesh).isInstancedMesh).map((m) => (m.material as THREE.Material).customProgramCacheKey()));
    expect(progs.size).toBe(1);
    const e = estadoInicial(f);
    e.faiscas.push({ id: 1, dono: 0, x: 3, y: 1, vx: 10, t: 1 });
    e.rachados[0] = 0; e.baus[0] = 1; e.barbantes[0] = 0;
    const fx = { emitir() {}, explosao() {}, ponto() {} };
    a.atualizar(e, 1 / 60, 0, fx as never);
    expect(inst[0].count).toBe(1);
  });
});
