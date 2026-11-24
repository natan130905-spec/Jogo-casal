// Regras de arte do cenário que dá para conferir sem navegador (docs/revisao/ARTE_DIAGNOSTICO.md §6.5–6.6):
// mesma composição nas três qualidades (a alta só acrescenta), borda da frente da faixa de jogo baixa, cascatas só nos
// mundos com água, e oclusão assada escurecendo o pé das paredes.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { construirCenario, JuntadorAO } from '../src/render/cenario';
import { TEMAS, TEMA_DO_CAPITULO } from '../src/render/tema';
import { faseDoCapitulo } from '../src/core/fases';

const chave = (m: THREE.Matrix4) => m.elements.map((v) => v.toFixed(4)).join(',');

describe('cenário 2.5D: regras de arte', () => {
  for (const cap of [1, 2, 5]) {
    const fase = faseDoCapitulo(cap)!;
    const tema = TEMAS[TEMA_DO_CAPITULO[cap - 1]];
    const c = { baixa: construirCenario(fase, 'baixa', tema), media: construirCenario(fase, 'media', tema), alta: construirCenario(fase, 'alta', tema) };

    it(`cap. ${cap}: a grama da baixa está no mesmo lugar na média e na alta (a qualidade só acrescenta)`, () => {
      const alta = new Set(c.alta.tufos.map(chave)), media = new Set(c.media.tufos.map(chave));
      const baixa = c.baixa.tufos.map(chave);
      expect(baixa.length).toBeGreaterThan(10);
      expect(baixa.filter((k) => !alta.has(k))).toEqual([]);
      expect(baixa.filter((k) => !media.has(k))).toEqual([]);
      expect(c.alta.tufos.length).toBeGreaterThan(c.media.tufos.length);
    });

    it(`cap. ${cap}: grama na frente da faixa de jogo (z > 0,6) com no máximo 0,25 m`, () => {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      for (const m of c.alta.tufos) {
        m.decompose(p, q, s);
        if (p.z > 0.6) expect(s.y * 0.4).toBeLessThanOrEqual(0.25); // geoTufo: lâminas de até 0,4 m
      }
    });
  }

  it('cascatas só nos mundos com água corrente (floresta e oceano)', () => {
    for (let cap = 1; cap <= 7; cap++) {
      const tema = TEMAS[TEMA_DO_CAPITULO[cap - 1]];
      const n = construirCenario(faseDoCapitulo(cap)!, 'baixa', tema).cascatas.length;
      if (tema.cascatas) expect(n, `cap. ${cap}`).toBeGreaterThan(0); else expect(n, `cap. ${cap}`).toBe(0);
    }
  });

  it('oclusão assada: pé de parede e embaixo de plataforma elevada escurecem; parede alta e céu aberto não', () => {
    // chão de 0 a 10 (topo 0) e uma plataforma elevada de 4 a 6 com a base em y = 2
    const ao = new JuntadorAO(16, [{ x: 0, y: -1, w: 10, h: 1 }, { x: 4, y: 2, w: 2, h: 0.4 }]);
    expect(ao.ao(2, 0.05, -2.2, 0)).toBeLessThan(0.65);      // pé do barranco de trás (normal para a frente)
    expect(ao.ao(2, 1.5, -2.2, 0)).toBe(1);                  // meio da parede
    expect(ao.ao(2, 0.0, 0, 1)).toBe(1);                     // tampo no meio da faixa
    expect(ao.ao(2, 0.0, -2.0, 1)).toBeLessThan(0.8);        // tampo junto ao barranco de trás
    expect(ao.ao(5, 1.0, 0, 1)).toBeLessThan(0.8);           // embaixo da plataforma elevada
    expect(ao.ao(8, 1.0, 0, 1)).toBe(1);                     // fora dela
  });
});
