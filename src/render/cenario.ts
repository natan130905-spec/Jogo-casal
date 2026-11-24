// Cenário da floresta dos sonhos, gerado por código: penhascos com camadas de rocha e musgo, grama com bordas
// arredondadas, árvores gigantes com copas fofas e trepadeiras, cogumelos de pintas, casas na árvore, pontes,
// lanternas, cascatas e névoa. Tudo é pintado por vértice e juntado em poucos lotes (chamadas de desenho).
// As medidas de colisão vêm da Fase e NÃO são alteradas: o topo de cada plataforma fica exatamente onde a
// simulação diz; o que sobra é enfeite atrás, embaixo ou na frente da faixa de jogo (z = 0).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Fase, Retangulo } from '../core/types';
import type { Qualidade } from './cena';
import { colocar, deformar, fbm, Juntador, misturar, pintar, sorteio } from './util';
import { Quadros } from './efeitos';
import type { Cascata } from './agua';
import { TEMAS, type Tema } from './tema';
import { criarKit } from './aderecos';
import { configurarEstilo } from './materiais';

export const CORES = {
  grama: 0x58a03e, gramaClara: 0x9fcf4a, gramaEscura: 0x2a5f36, gramaSol: 0xd9d45a, terra: 0x4d3126,
  rocha1: 0xb495a8, rocha2: 0x84688a, rocha3: 0xc09a78, musgo: 0x5f9e3a,
  madeira: 0x9a6538, madeiraEscura: 0x5a3720, casca: 0x6f4a35, cascaEscura: 0x3d2a26,
  copaEscura: 0x245a3c, copa: 0x4f9a48, copaClara: 0x9fd85e, copaSol: 0xe2e27a,
  chapeu: 0xe0393c, chapeuBorda: 0x9e1f30, pe: 0xf6ead2, lamela: 0xeec3a8,
  janela: 0xffc25a, lanterna: 0xffb347, telhado: 0x7a4a3a, ferro: 0x463e52,
};

export interface Cenario {
  mundo: Juntador;          // opaco, iluminado (penhascos, árvores, casas…)
  brilho: Juntador;         // sem luz (janelas, lanternas, cogumelos mágicos)
  luz: Quadros;             // aditivo: halos, raios de sol, espuma
  nevoa: Quadros;           // névoa macia (mistura normal)
  tufos: THREE.Matrix4[];   // grama instanciada
  flores: { m: THREE.Matrix4; cor: THREE.Color }[];
  cascatas: Cascata[];
  /** alturas do chão para a sombra-bolha dos personagens */
  chao: Retangulo[];
}

const PROF = 2.0; // meia profundidade da faixa de chão (z de -2 a 2)

/** Semente derivada de um índice (1 … 2³¹−2), para `sorteio`. */
const semente = (k: number) => 1 + (Math.imul(k + 1, 2654435761) >>> 0) % 2147483646;

/** Espessura do traço escuro na aresta da frente do tapete das plataformas (média e alta), em metros. */
const TRACO = 0.05;

/**
 * Oclusão de ambiente ASSADA na cor dos vértices (zero custo por quadro), calculada pelas caixas de colisão da fase:
 * escurece o pé das paredes e a base dos adereços (até 0,6 m acima do chão), o fundo do tampo junto ao barranco de
 * trás e o que fica embaixo de plataformas elevadas (até 2,5 m). É uma aproximação analítica (sem traçar raios).
 */
export class JuntadorAO extends Juntador {
  private chaos: Retangulo[];
  private elevadas: Retangulo[];
  constructor(faixa: number, plataformas: readonly Retangulo[]) {
    super(faixa);
    this.chaos = [...plataformas];
    this.elevadas = plataformas.filter((r) => {
      const baixo = this.chaoSob(r.x + r.w / 2, r.y - 0.05);
      return !Number.isFinite(baixo) || baixo < r.y - 0.3;
    });
  }
  /** topo mais alto de chão em x que fica abaixo (ou na altura) de y */
  chaoSob(x: number, y: number) {
    let m = -Infinity;
    for (const r of this.chaos) { const t = r.y + r.h; if (x >= r.x - 0.15 && x <= r.x + r.w + 0.15 && t <= y + 0.06 && t > m) m = t; }
    return m;
  }
  ao(x: number, y: number, z: number, ny: number) {
    let k = 1;
    const chao = this.chaoSob(x, y);
    if (Number.isFinite(chao)) {
      const h = y - chao;
      // contato: pé de parede, base de pedras, blocos e adereços (não o próprio tampo, que olha para cima)
      if (h > -0.05 && h < 0.6 && ny < 0.75) k *= 1 - 0.42 * (1 - Math.max(0, h) / 0.6);
      // tampo: escurece no fundo, junto ao barranco de trás
      if (ny >= 0.6 && Math.abs(h) < 0.15 && z < -1.2 && z > -2.3) k *= 1 - 0.3 * Math.min(1, (-1.2 - z) / 0.7);
    }
    // embaixo de plataforma elevada
    if (z > -2.6 && z < 2.8) for (const r of this.elevadas) {
      const d = r.y - y;
      if (d > 0.02 && d < 2.5 && x > r.x - 0.1 && x < r.x + r.w + 0.1) { k *= 1 - 0.45 * (1 - d / 2.5); break; }
    }
    return k;
  }
  override add(geo: THREE.BufferGeometry) {
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), cor = geo.getAttribute('color');
    if (pos && nor && cor) {
      for (let i = 0; i < pos.count; i++) {
        const k = this.ao(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getY(i));
        if (k < 0.999) cor.setXYZ(i, cor.getX(i) * k, cor.getY(i) * k, cor.getZ(i) * k);
      }
    }
    super.add(geo);
  }
}

export function construirCenario(fase: Fase, q: Qualidade, tema: Tema = TEMAS.floresta): Cenario {
  configurarEstilo(tema.estilo);
  // Sorteio que NÃO depende da qualidade: cada grupo de peças recomeça de uma semente própria (`semear`), então o que
  // a baixa tem sai no mesmo lugar na média e na alta; a qualidade só acrescenta (mais grama, mais detalhe).
  let gerador = sorteio(7);
  const rnd = () => gerador();
  const semear = (k: number) => { gerador = sorteio(semente(k)); };
  const C: typeof CORES = { ...CORES, ...tema.chao };
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const mundo = new JuntadorAO(16, fase.plataformas), brilho = new Juntador(32);
  const luz = new Quadros(), nevoa = new Quadros();
  const tufos: THREE.Matrix4[] = [], flores: Cenario['flores'] = [], cascatasL: Cascata[] = [];
  const rico = q !== 'baixa', alta = q === 'alta';
  const segEsf = rico ? 1 : 0;

  // ---------- peças reutilizáveis ----------
  const rochaCor = (topo: number) => (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => {
    const d = topo - p.y;
    const banda = Math.sin(p.y * 2.4 + fbm(p.x * 0.35, p.y * 0.5, p.z * 0.35) * 3);
    if (banda > 0.35) c.setHex(C.rocha1); else if (banda > -0.4) misturar(c, C.rocha2, C.rocha3, (banda + 0.4) / 0.75 * 0.5); else c.setHex(C.rocha2);
    if (d < 0.4) misturar(c, C.terra, c.getHex(), d / 0.4);
    const musgo = fbm(p.x * 0.8, p.y * 0.9, p.z * 0.8) + Math.max(0, n.y) * 0.8 - d * 0.12;
    if (musgo > 0.35) misturar(c, c.getHex(), C.musgo, Math.min(1, (musgo - 0.35) * 3));
    const escuro = 1 - Math.min(0.45, Math.max(0, (d - 1.2) / 8));
    c.multiplyScalar(escuro);
  };

  /** Penhasco: bloco de rocha com faces irregulares, topo coberto por um tapete de grama arredondado. */
  const penhasco = (x0: number, x1: number, topo: number, base: number, z0: number, z1: number, comGrama = true, frenteMusgo = true) => {
    const w = x1 - x0, h = topo - base, d = z1 - z0;
    const dens = alta ? 1.3 : 0.8;
    const corpo = new THREE.BoxGeometry(w - 0.06, h - 0.2, d - 0.1, Math.max(2, Math.ceil(w * dens)), Math.max(2, Math.ceil(h * dens * 0.8)), Math.max(2, Math.ceil(d * dens)));
    colocar(corpo, (x0 + x1) / 2, base + (h - 0.2) / 2, (z0 + z1) / 2);
    deformar(corpo, 0.45, 0.8, (p) => { const k = Math.min(1, (topo - 0.2 - p.y) / 0.6); return k <= 0.02 ? null : new THREE.Vector3(k, k * 0.5, k); });
    mundo.add(pintar(corpo, rochaCor(topo)));
    if (!comGrama) return;
    const cap = new THREE.BoxGeometry(w + 0.14, 0.4, d + 0.08, Math.max(2, Math.ceil(w * (alta ? 2 : 1.4))), 2, Math.max(2, Math.ceil(d * (alta ? 2 : 1.2))));
    colocar(cap, (x0 + x1) / 2, topo - 0.2, (z0 + z1) / 2);
    // borda arredondada: os vértices de cima nas bordas descem um pouco; os de baixo ficam irregulares (grama caindo)
    const pos = cap.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
      const borda = Math.max(Math.abs(z - (z0 + z1) / 2) / (d / 2 + 0.04), Math.abs(x - (x0 + x1) / 2) / (w / 2 + 0.07));
      if (y > topo - 0.01) { if (borda > 0.97) pos.setY(i, topo - 0.09); }
      else { pos.setY(i, y - 0.08 - Math.max(0, fbm(x * 2.3, 0, z * 2.3)) * 0.35); }
    }
    deformar(cap, 0.05, 2.0, (p) => (p.y > topo - 0.01 ? null : new THREE.Vector3(1, 0.3, 1)));
    mundo.add(pintar(cap, (p, n, c) => {
      const v = fbm(p.x * 0.6, 0, p.z * 0.6), v2 = fbm(p.x * 1.1 + 7, 0, p.z * 1.1);
      if (n.y > 0.6) {
        // manchas de sol douradas e sombra azulada, como a grama pintada da arte conceitual
        misturar(c, C.gramaEscura, C.grama, Math.min(1, 0.55 + v * 0.9 + v2 * 0.3));
        if (v > 0.05) misturar(c, c.getHex(), C.gramaClara, Math.min(1, (v - 0.05) * 2.2));
        if (v + v2 * 0.5 > 0.32) misturar(c, c.getHex(), C.gramaSol, Math.min(0.75, (v + v2 * 0.5 - 0.32) * 2.5));
      }
      else misturar(c, C.gramaEscura, C.grama, (p.y - (topo - 0.6)) / 0.6);
    }));
    // traço escuro de desenho na aresta da frente do tapete (lê a borda da plataforma); custo: 12 triângulos, 0 chamadas
    if (rico && z1 >= PROF - 0.01 && frenteMusgo) {
      const t = new THREE.BoxGeometry(w + 0.1, TRACO, TRACO, Math.max(1, Math.ceil(w)), 1, 1);
      colocar(t, (x0 + x1) / 2, topo - 0.11, z1 + 0.05);
      deformar(t, 0.015, 2.0, () => new THREE.Vector3(0, 1, 0));
      mundo.add(pintar(t, misturar(new THREE.Color(), C.gramaEscura, 0x120818, 0.65).getHex()));
    }
    // trepadeiras/musgo escorrendo na frente
    if (frenteMusgo) {
      for (let x = x0 + r(0.2, 1.2); x < x1 - 0.3; x += r(0.9, 2.2)) {
        const longa = rnd() < 0.3;
        const comp = longa ? r(0.8, 1.8) : r(0.25, 0.5);
        const g = new THREE.SphereGeometry(0.1, 8, 6);
        colocar(g, x, topo - 0.25 - comp / 2, z1 + 0.0, [longa ? r(0.5, 0.8) : r(1.8, 3.2), comp / 0.2, 0.6]);
        mundo.add(pintar(g, (p, _n, c) => misturar(c, C.gramaEscura, C.grama, (p.y - (topo - comp)) / comp)));
      }
    }
  };

  const pedra = (x: number, y: number, z: number, s: number, achatar = 0.7) => {
    const g = new THREE.DodecahedronGeometry(1, segEsf);
    colocar(g, x, y, z, [s * r(0.9, 1.4), s * achatar, s * r(0.8, 1.1)], [0, r(0, 3), 0]);
    deformar(g, 0.18 * s, 1.3 / s, () => new THREE.Vector3(1, 1, 1));
    mundo.add(pintar(g, (p, n, c) => {
      misturar(c, C.rocha2, C.rocha1, 0.5 + n.y * 0.5);
      if (n.y > 0.55) misturar(c, c.getHex(), C.musgo, (n.y - 0.55) * 2.5);
    }));
  };

  /** Moita fofa: 3–5 bolas verdes juntas, claras em cima. */
  const moita = (x: number, y: number, z: number, s: number) => {
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const rr = s * r(0.45, 0.8), dx = r(-1, 1) * s * 0.8, dz = r(-0.5, 0.5) * s;
      const g = new THREE.SphereGeometry(1, alta ? 12 : 9, alta ? 8 : 6);
      colocar(g, x + dx, y + rr * 0.55, z + dz, [rr * 1.2, rr, rr]);
      deformar(g, rr * 0.15, 1.5 / rr, () => new THREE.Vector3(1, 1, 1));
      mundo.add(pintar(g, (p, n2, c) => {
        misturar(c, C.copaEscura, C.copa, 0.4 + n2.y * 0.6);
        if (n2.y > 0.3) misturar(c, c.getHex(), C.copaClara, (n2.y - 0.3) * 1.2);
      }));
    }
  };

  const cogumelo = (x: number, y: number, z: number, s: number, inclina = 0) => {
    const altura = 1.0;
    const pe = new THREE.CylinderGeometry(0.13, 0.2, altura, 10, 3);
    const pp = pe.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) pp.setX(i, pp.getX(i) + Math.sin((pp.getY(i) + 0.5) * 2.2) * 0.06);
    pe.translate(0, altura / 2, 0);
    colocar(pe, x, y, z, s, [0, 0, inclina]);
    mundo.add(pintar(pe, (p, _n, c) => misturar(c, 0xc9b49a, C.pe, (p.y - y) / (s * 0.6))));
    const R = 0.62;
    const topoX = x - Math.sin(inclina) * altura * s, topoY = y + Math.cos(inclina) * altura * s;
    const cap = new THREE.SphereGeometry(R, rico ? 24 : 12, rico ? 10 : 5, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.62, 1);
    colocar(cap, topoX, topoY - 0.05 * s, z, s, [0, 0, inclina]);
    mundo.add(pintar(cap, (p, n, c) => misturar(c, C.chapeuBorda, C.chapeu, 0.25 + n.y * 0.9)));
    const lam = new THREE.ConeGeometry(R * 0.98, 0.16, 18, 1, true);
    lam.rotateX(Math.PI);
    colocar(lam, topoX, topoY - 0.12 * s, z, s, [0, 0, inclina]);
    mundo.add(pintar(lam, C.lamela));
    // pintas brancas sobre o chapéu
    const n = 9 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const th = r(0.1, 1.3), ph = r(0, Math.PI * 2), rr = r(0.09, 0.17);
      const px = Math.sin(th) * Math.cos(ph) * R, py = Math.cos(th) * R * 0.62, pz = Math.sin(th) * Math.sin(ph) * R;
      const g = new THREE.SphereGeometry(rr, rico ? 10 : 7, rico ? 4 : 3);
      g.scale(1, 0.35, 1);
      const nrm = new THREE.Vector3(px, py / 0.38, pz).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm));
      g.translate(px, py - 0.05, pz);
      colocar(g, topoX, topoY - 0.05 * s, z, s, [0, 0, inclina]);
      mundo.add(pintar(g, 0xfff6ea));
    }
  };

  /** Cogumelinhos mágicos que brilham (ciano/rosa/dourado). */
  const cogumeloMagico = (x: number, y: number, z: number, cor: number) => {
    for (let k = 0; k < 3; k++) {
      const s = r(0.12, 0.22), dx = r(-0.25, 0.25), dz = r(-0.15, 0.15);
      const pe = new THREE.CylinderGeometry(0.025, 0.035, s * 1.4, 5);
      colocar(pe, x + dx, y + s * 0.7, z + dz);
      mundo.add(pintar(pe, C.pe));
      const cap = new THREE.SphereGeometry(s * 0.6, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      colocar(cap, x + dx, y + s * 1.35, z + dz, [1, 0.7, 1]);
      brilho.add(pintar(cap, cor));
    }
    luz.add('halo', x, y + 0.3, z + 0.1, 1.4, 1.1, cor, 0.55, rnd());
  };

  const lanterna = (x: number, y: number, z: number, corda = 0.5) => {
    const fio = new THREE.CylinderGeometry(0.012, 0.012, corda, 3);
    colocar(fio, x, y + corda / 2 + 0.16, z);
    mundo.add(pintar(fio, C.ferro));
    const tampa = new THREE.ConeGeometry(0.14, 0.1, 6);
    colocar(tampa, x, y + 0.16, z);
    mundo.add(pintar(tampa, C.ferro));
    const corpo = new THREE.CylinderGeometry(0.09, 0.1, 0.22, 6);
    colocar(corpo, x, y, z);
    brilho.add(pintar(corpo, C.lanterna));
    luz.add('halo', x, y, z + 0.15, 1.5, 1.5, 0xffa040, 0.75, rnd());
    luz.add('halo', x, y, z + 0.16, 0.45, 0.45, 0xfff0c0, 0.9);
  };

  /** Árvore gigante: tronco com raízes, copa feita de cachos fofos e trepadeiras. */
  const arvore = (x: number, z: number, base: number, alto: number, raio: number, cheia = 1) => {
    const tronco = new THREE.CylinderGeometry(raio * 0.7, raio * 1.05, alto, rico ? 12 : 8, Math.ceil(alto / 2), true);
    tronco.translate(0, alto / 2, 0);
    deformar(tronco, raio * 0.18, 0.5, () => new THREE.Vector3(1, 0, 1));
    colocar(tronco, x, base, z);
    mundo.add(pintar(tronco, (p, n, c) => {
      const listra = fbm(Math.atan2(n.z, n.x) * 3, p.y * 0.15, 0);
      misturar(c, C.cascaEscura, C.casca, 0.45 + listra * 0.6 + Math.max(0, n.x) * 0.2);
      if (fbm(p.x * 0.7, p.y * 0.5, p.z * 0.7) > 0.3) misturar(c, c.getHex(), C.musgo, 0.55);
    }));
    // raízes
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r(0, 0.8);
      const g = new THREE.ConeGeometry(raio * 0.45, alto * 0.18, 6, 1);
      g.translate(0, alto * 0.09, 0);
      g.rotateZ(1.0);
      g.rotateY(a);
      colocar(g, x + Math.cos(a) * raio * 0.5, base + alto * 0.18 * 0 + 0, z - Math.sin(a) * raio * 0.5);
      mundo.add(pintar(g, C.casca));
    }
    // galhos e copa
    const topo = base + alto;
    const nCachos = Math.round((rico ? 7 : 4) * cheia);
    const rc = raio * 2.6 + 1.2;
    for (let k = 0; k < nCachos; k++) {
      const a = r(0, Math.PI * 2), d = r(0.2, 1) * rc;
      const cx = x + Math.cos(a) * d * 1.1, cy = topo + r(-0.4, 0.9) * rc * 0.45, cz = z + Math.sin(a) * d * 0.6;
      const rr = rc * r(0.45, 0.7);
      const g = alta ? new THREE.SphereGeometry(1, 16, 11) : rico ? new THREE.SphereGeometry(1, 12, 8) : new THREE.SphereGeometry(1, 9, 6);
      colocar(g, cx, cy, cz, [rr * 1.15, rr * 0.8, rr]);
      deformar(g, rr * 0.22, 0.9 / rr, () => new THREE.Vector3(1, 1, 1));
      mundo.add(pintar(g, (p, n, c) => {
        const t = 0.5 + n.y * 0.55 + (p.y - topo) / (rc * 2);
        if (t < 0.5) misturar(c, C.copaEscura, C.copa, t * 2);
        else misturar(c, C.copa, C.copaClara, (t - 0.5) * 2);
        if (n.y > 0.5 && n.x < 0.2) misturar(c, c.getHex(), C.copaSol, (n.y - 0.5) * 0.7);
      }));
      // galho até o cacho
      const gal = new THREE.CylinderGeometry(raio * 0.12, raio * 0.3, 1, 5);
      gal.translate(0, 0.5, 0);
      const de = new THREE.Vector3(x, topo - rc * 0.2, z), ate = new THREE.Vector3(cx, cy - rr * 0.3, cz);
      const dir = ate.clone().sub(de);
      gal.scale(1, dir.length(), 1);
      gal.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
      gal.translate(de.x, de.y, de.z);
      mundo.add(pintar(gal, C.casca));
      // trepadeiras penduradas
      if (rico) for (let v = 0; v < 2; v++) {
        const comp = r(1.5, 6);
        const tv = new THREE.CylinderGeometry(0.035, 0.05, comp, 4, 3);
        const tp = tv.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + Math.sin(tp.getY(i) * 1.4) * 0.12);
        colocar(tv, cx + r(-rr, rr) * 0.8, cy - rr * 0.55 - comp / 2, cz + rr * 0.4);
        mundo.add(pintar(tv, (p, _n, c) => misturar(c, C.gramaEscura, C.musgo, fbm(p.y * 2, 0, 0) + 0.5)));
      }
    }
  };

  /** Casa na árvore: cabana de tábuas, telhado cônico com musgo, janelas acesas e lanterna. */
  const casa = (x: number, y: number, z: number, s: number, deck = true) => {
    const L = 2.2 * s, A = 1.7 * s, P = 1.8 * s;
    const nT = 6;
    for (let k = 0; k < nT; k++) {
      const g = new THREE.BoxGeometry(L, A / nT * 0.96, P);
      colocar(g, x, y + (k + 0.5) * (A / nT), z);
      mundo.add(pintar(g, k % 2 ? C.madeira : 0x8a5732));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.16 * s, A + 0.1, 0.16 * s);
      colocar(g, x + sx * L / 2, y + A / 2, z + sz * P / 2);
      mundo.add(pintar(g, C.madeiraEscura));
    }
    const tel = new THREE.ConeGeometry(Math.max(L, P) * 0.85, 1.5 * s, 8, 2);
    colocar(tel, x, y + A + 0.7 * s, z, 1, [0, Math.PI / 8, 0]);
    deformar(tel, 0.1 * s, 2.0, () => new THREE.Vector3(1, 0.5, 1));
    mundo.add(pintar(tel, (p, n, c) => {
      misturar(c, C.telhado, 0xa0623e, 0.5 + n.y * 0.5);
      if (fbm(p.x * 2, p.y * 2, p.z * 2) > 0.15) misturar(c, c.getHex(), C.musgo, 0.7);
    }));
    const pontaz = new THREE.SphereGeometry(0.1 * s, 6, 4); colocar(pontaz, x, y + A + 1.45 * s, z); brilho.add(pintar(pontaz, 0xffe9a8));
    // janelas acesas (frente) com moldura em cruz
    for (const jx of [-0.5, 0.45]) {
      const jw = 0.55 * s, jh = 0.62 * s, zz = z + P / 2 + 0.01;
      const vid = new THREE.PlaneGeometry(jw, jh); colocar(vid, x + jx * L * 0.7, y + A * 0.55, zz);
      brilho.add(pintar(vid, C.janela));
      for (const [bw, bh, bx, by] of [[jw + 0.1, 0.07, 0, jh / 2], [jw + 0.1, 0.07, 0, -jh / 2], [0.06, jh, 0, 0], [jw, 0.05, 0, 0], [0.07, jh, -jw / 2, 0], [0.07, jh, jw / 2, 0]]) {
        const b = new THREE.BoxGeometry(bw, bh, 0.06); colocar(b, x + jx * L * 0.7 + bx, y + A * 0.55 + by, zz + 0.02);
        mundo.add(pintar(b, C.madeiraEscura));
      }
      luz.add('halo', x + jx * L * 0.7, y + A * 0.55, zz + 0.1, 2.2 * s, 2.0 * s, 0xffb050, 0.7, rnd());
    }
    if (deck) {
      const d = new THREE.BoxGeometry(L + 1.2, 0.18, P + 1.0); colocar(d, x, y - 0.09, z); mundo.add(pintar(d, C.madeiraEscura));
    }
    lanterna(x + L / 2 + 0.25, y + A * 0.75, z + P / 2 + 0.3, 0.25);
  };

  /** Ponte de tábuas pendurada (catenária) com cordas. */
  const ponte = (x0: number, x1: number, y: number, z: number, cai = 0.8) => {
    const n = Math.ceil((x1 - x0) / 0.4);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = x0 + (x1 - x0) * t, yy = y - Math.sin(t * Math.PI) * cai;
      const g = new THREE.BoxGeometry(0.34, 0.07, 1.0); colocar(g, x, yy, z, 1, [0, 0, Math.cos(t * Math.PI) * cai * 0.5 / (x1 - x0) * 3]);
      mundo.add(pintar(g, k % 3 === 0 ? 0x7d5030 : C.madeira));
      if (k % 4 === 0) {
        for (const sz of [-0.45, 0.45]) {
          const pst = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4); colocar(pst, x, yy + 0.3, z + sz); mundo.add(pintar(pst, C.madeiraEscura));
        }
      }
    }
    for (const sz of [-0.45, 0.45]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y + 0.6 - Math.sin(t * Math.PI) * cai * 0.85, z + sz)); }
      const tubo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 4);
      mundo.add(pintar(tubo, 0xb89a70));
    }
  };

  const tufo = (x: number, y: number, z: number, s: number) => {
    const rot = rnd() * 6.28;
    // borda da frente da faixa de jogo baixa (≤ 0,25 m): com a câmera baixa a grama alta tapava os personagens
    const sy = z > 0.6 ? Math.min(0.6, s * r(0.8, 1.3)) : s * r(0.8, 1.3);
    tufos.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, sy, s)));
  };
  const flor = (x: number, y: number, z: number) => {
    const cores = [0xff8fb8, 0xffe070, 0xffffff, 0xc89bff, 0xff7a5a];
    flores.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(1, 1, 1).multiplyScalar(r(0.7, 1.2))), cor: new THREE.Color(cores[Math.floor(rnd() * cores.length)]) });
  };
  const densidade = q === 'baixa' ? 1.6 : q === 'media' ? 4.5 : 7;

  // outros mundos: troca árvores, cogumelos, moitas e casas pelos adereços do tema (a floresta fica como era)
  const kit = tema.chave === 'floresta' ? null
    : criarKit(tema.chave, { mundo, brilho, luz, nevoa, r, rnd, rico, alta, C, lanterna, fase });
  const dens = densidade * tema.tufos;

  // ---------- plataformas da fase ----------
  const chao: Retangulo[] = [];
  const BASE = -8;
  fase.plataformas.forEach((p, ip) => {
    const topo = p.y + p.h, x0 = p.x, x1 = p.x + p.w;
    chao.push(p);
    semear(100 + ip);
    if (kit && p.y >= -0.5) { if (p.h >= 0.9) kit.bloco(p); else kit.alta(x0, x1, topo); return; }
    if (p.y > 2) {
      // deque de madeira da casa na árvore (topo exato em `topo`)
      for (let x = x0; x < x1 - 0.01; x += 0.46) {
        const g = new THREE.BoxGeometry(0.43, 0.2, 2.8);
        colocar(g, x + 0.23, topo - 0.1 - rnd() * 0.02, 0, 1, [0, 0, r(-0.015, 0.015)]);
        mundo.add(pintar(g, rnd() < 0.3 ? 0x8a5732 : C.madeira));
      }
      for (const sz of [-1.1, 1.1]) { const v = new THREE.BoxGeometry(p.w + 0.3, 0.26, 0.26); colocar(v, (x0 + x1) / 2, topo - 0.33, sz); mundo.add(pintar(v, C.madeiraEscura)); }
      // guarda-corpo no fundo e postes nas pontas da frente
      for (let x = x0 + 0.1; x <= x1; x += 1.18) {
        const pst = new THREE.BoxGeometry(0.12, 0.95, 0.12); colocar(pst, x, topo + 0.47, -1.3); mundo.add(pintar(pst, C.madeiraEscura));
      }
      for (const yy of [0.45, 0.88]) { const c = new THREE.BoxGeometry(p.w, 0.08, 0.08); colocar(c, (x0 + x1) / 2, topo + yy, -1.3); mundo.add(pintar(c, C.madeira)); }
      for (const x of [x0 + 0.1, x1 - 0.1]) { const pst = new THREE.BoxGeometry(0.14, 0.6, 0.14); colocar(pst, x, topo + 0.3, 1.32); mundo.add(pintar(pst, C.madeiraEscura)); }
      // escoras até o tronco
      for (const x of [x0 + 0.8, x1 - 0.6]) {
        const g = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
        colocar(g, x, topo - 1.3, -1.6, 1, [0.5, 0, (x - (x0 + x1) / 2) * 0.12]);
        mundo.add(pintar(g, C.madeiraEscura));
      }
      lanterna(x0 + 0.1, topo + 0.75, -1.15, 0.2);
      lanterna(x1 - 0.1, topo + 0.45, 1.32, 0.0);
      return;
    }
    // chão de terra e rocha
    penhasco(x0, x1, topo, BASE, -PROF, PROF);
    // tufos e flores no topo (mais na frente e no fundo, menos no caminho)
    const n = Math.round(p.w * dens * 2);
    for (let k = 0; k < n; k++) {
      const x = r(x0 + 0.1, x1 - 0.1);
      const zz = rnd() < 0.6 ? (rnd() < 0.5 ? r(1.2, 2.0) : r(-2.0, -1.0)) : r(-1.0, 1.2);
      tufo(x, topo - 0.02, zz, r(0.7, 1.3));
      if (rnd() < 0.18 && tema.flores) flor(x + r(-0.1, 0.1), topo, zz + r(-0.1, 0.1));
    }
    semear(1000 + ip);
    // pedrinhas e cogumelos no fundo da faixa
    if (rico && p.w > 4) {
      for (let k = 0; k < p.w / 5; k++) pedra(r(x0 + 0.5, x1 - 0.5), topo, r(-1.9, -1.5), r(0.2, 0.45));
      for (let k = 0; k < p.w / 6; k++) (kit ? kit.pequeno : cogumelo)(r(x0 + 0.5, x1 - 0.5), topo - 0.02, r(-1.9, -1.6), r(0.25, 0.45), r(-0.2, 0.2));
    }
    // margem do fundo: barranco mais alto atrás da faixa de jogo (camadas como na arte)
    if (p.y < -0.5) {
      semear(2000 + ip);
      const alto = topo + r(1.7, 2.4);
      penhasco(x0 + 0.3, x1 - 0.3, alto, BASE, -6.5, -PROF - 0.15);
      semear(3000 + ip);
      const nb = Math.round(p.w * dens);
      for (let k = 0; k < nb; k++) tufo(r(x0 + 0.4, x1 - 0.4), alto - 0.02, r(-6.2, -2.3), r(0.8, 1.5));
      semear(4000 + ip);
      for (let k = 0; k < p.w / 7; k++) { semear(4100 + ip * 64 + k); (kit ? kit.pequeno : cogumelo)(r(x0 + 0.8, x1 - 0.8), alto - 0.05, r(-4.5, -3.0), r(1.0, 2.6), r(-0.25, 0.25)); }
      for (let k = 0; k < p.w / (rico ? 2.2 : 4) * (kit ? 0.5 : 1); k++) { semear(5000 + ip * 64 + k); (kit ? kit.moita : moita)(r(x0 + 0.6, x1 - 0.6), alto - 0.1, r(-5.8, -3.2), r(0.6, 1.3)); }
      for (let k = 0; k < p.w / 8; k++) { semear(6000 + ip * 64 + k); (kit ? kit.brilho : cogumeloMagico)(r(x0 + 0.5, x1 - 0.5), alto - 0.02, r(-2.6, -2.3), [0x6fe8ff, 0xff8fd8, 0xffd36a][k % 3]); }
      semear(7000 + ip);
      if (rico) for (let k = 0; k < p.w / 6; k++) pedra(r(x0 + 0.5, x1 - 0.5), alto, r(-3, -2.4), r(0.3, 0.6));
    }
  });

  // bordas da fase: barrancos à esquerda e à direita
  semear(8000);
  penhasco(-14, fase.plataformas[0].x + 0.05, 2.2, BASE, -6.5, 2.5);
  penhasco(fase.largura - 0.05, fase.largura + 12, 2.8, BASE, -6.5, 2.5);

  // ---------- vãos: lábio de rocha atrás + cascata ----------
  const ordenadas = [...fase.plataformas].filter((p) => (kit ? p.y < -0.5 : p.y < 2)).sort((a, b) => a.x - b.x);
  for (let i = 0; i < ordenadas.length - 1; i++) {
    semear(9000 + i);
    const a = ordenadas[i], b = ordenadas[i + 1];
    const g0 = a.x + a.w, g1 = b.x;
    if (g1 - g0 < 0.5) continue;
    const topo = Math.max(a.y + a.h, b.y + b.h) + 0.6;
    penhasco(g0 - 0.2, g1 + 0.2, topo, BASE, -6.5, -2.6);
    if (!tema.agua || !tema.cascatas) continue;
    cascatasL.push({ x0: g0 + 0.1, x1: g1 - 0.1, topo: topo - 0.12, base: -4.3, z: -2.55 });
    luz.add('halo', (g0 + g1) / 2, -4.1, -2.2, (g1 - g0) * 2.2, 1.4, 0xd8f0ff, 0.6, rnd());
    nevoa.add('nevoa', (g0 + g1) / 2, -3.6, -1.5, (g1 - g0) * 4, 2.5, 0xffffff, 0.55);
  }

  if (!kit) {
    // ---------- cascata grande ao fundo, com seu penhasco ----------
    semear(9500);
    penhasco(15.5, 23.5, 8.5, BASE, -12, -8.6);
    cascatasL.push({ x0: 18.2, x1: 20.8, topo: 8.4, base: -4.3, z: -8.5 });
    luz.add('halo', 19.5, -3.8, -8.0, 7, 2.4, 0xe8f6ff, 0.55, 0.3);
    semear(9501); arvore(22.5, -10.5, 8.3, 7, 0.7, 0.8);
    semear(9502); arvore(16.5, -11, 8.3, 5, 0.5, 0.7);
    semear(9503);
    penhasco(44, 49, 6.5, BASE, -15, -12.5);
    cascatasL.push({ x0: 45.8, x1: 47.0, topo: 6.4, base: -4.3, z: -12.4 });

  }
  // ---------- árvores gigantes ----------
  // 22 lugares fixos; a baixa usa 11 e a média 17 deles (os mesmos, no mesmo lugar), a alta todos
  const nArv = 22;
  for (let k = 0; k < nArv; k++) {
    if (q === 'baixa' ? k % 2 === 1 : q === 'media' ? k % 4 === 3 : false) continue;
    semear(10000 + k);
    const x = -10 + (fase.largura + 20) * (k + rnd() * 0.6) / nArv;
    const z = r(-17, -7.5);
    (kit ? kit.grande : arvore)(x, z, BASE, r(15, 22) + (-z - 7) * 0.3, r(0.8, 1.7));
  }
  if (kit) {
    const n = Math.max(1, Math.round(fase.largura / 70)), L = fase.largura / n;
    for (let i = 0; i < n; i++) { semear(11000 + i); kit.marcos(i * L, L); }
  }
  else {
    // árvore da casa (segura o deque) e árvore da esquerda
    const deque = fase.plataformas.find((p) => p.y > 2);
    if (deque) {
      const tx = deque.x + deque.w + 1.2;
      semear(12000); arvore(tx, -3.4, BASE, 20, 1.6, 1.2);
      semear(12001); casa(deque.x + deque.w - 0.9, deque.y + deque.h, -2.25, 0.95, false);
      ponte(deque.x - 6, deque.x - 0.2, deque.y + deque.h + 3.0, -4.5, 0.6);
    }
    semear(12002); arvore(-5, -3.6, BASE, 19, 1.4, 1.1);

    // casas e pontes ao fundo
    semear(12003); casa(27.5, 8.0, -11.2, 1.0);
    semear(12004); arvore(27.5, -12.4, BASE, 16, 1.2, 0.6);
    semear(12005); ponte(29.5, 38, 8.4, -11.2, 0.8);
    casa(6.5, 7.2, -13.2, 1.1);
    semear(12006); arvore(6.5, -14.4, BASE, 15, 1.2, 0.6);
    semear(12007); ponte(-2, 5, 7.4, -13.2, 0.6);
    for (const [x, y, z] of [[31, 7.4, -11.2], [34, 7.2, -11.2], [1.5, 6.6, -13.2], [36.6, 7.5, -11.2]]) lanterna(x, y, z, 0.3);

    // ---------- cogumelos grandes de primeiro plano e beira ----------
    semear(12008); cogumelo(-2.6, 2.15, -0.8, 2.8, 0.12);
    semear(12009); cogumelo(-1.2, 2.15, -2.8, 1.6, -0.1);
    semear(12010); if (rico) { cogumelo(61.2, 2.75, -0.6, 2.2, -0.15); cogumelo(25.6, -3.6, 2.6, 1.6, 0.08); }
    semear(12011);
    for (const [x, z] of [[12.5, -1.85], [32.4, -1.85], [46.5, -1.85], [57.0, 1.7]]) cogumeloMagico(x, deque && x > deque.x && x < deque.x + deque.w ? deque.y + deque.h : 0, z, 0xffd36a);

  }

  // ---------- portal: base de pedra ----------
  const pr = fase.portal;

  // ---------- placas: base de pedra (a parte que afunda é desenhada em cena.ts) ----------
  for (const p of fase.placas) {
    const g = new THREE.CylinderGeometry(p.w / 2 + 0.14, p.w / 2 + 0.22, 0.1, 20);
    colocar(g, p.x + p.w / 2, p.y + 0.04, 0.6);
    mundo.add(pintar(g, 0x6c5c7c));
  }
  // ---------- porteira: pilares e lintel de pedra (a parte que sobe é desenhada em cena.ts) ----------
  for (const pt of fase.portas) {
    const topo = pt.y + pt.h, cx = pt.x + pt.w / 2;
    const lintel = new THREE.BoxGeometry(pt.w + 0.5, 0.6, PROF * 2 + 0.4, 3, 1, 6);
    colocar(lintel, cx, topo + 0.3, -0.1);
    deformar(lintel, 0.05, 2, () => new THREE.Vector3(1, 1, 1));
    mundo.add(pintar(lintel, (pp, n, c) => { misturar(c, C.rocha2, C.rocha1, 0.5 + n.y * 0.4); if (n.y > 0.5) misturar(c, c.getHex(), C.musgo, 0.8); }));
    for (const sx of [-1, 1]) {
      const pil = new THREE.BoxGeometry(0.5, topo + 0.6, 0.5, 1, 4, 1);
      colocar(pil, cx + sx * (pt.w / 2 + 0.3), (topo + 0.6) / 2 - 0.05, -2.35);
      deformar(pil, 0.04, 2, () => new THREE.Vector3(1, 0.2, 1));
      mundo.add(pintar(pil, (pp, n, c) => misturar(c, C.rocha2, C.rocha1, 0.4 + n.y * 0.4 + pp.y * 0.05)));
    }
    lanterna(cx - 0.65, topo + 0.05, 1.9, 0.0);
    lanterna(cx + 0.65, topo + 0.05, 1.9, 0.0);
  }

  // ---------- luz: raios de sol, halos e névoa ----------
  // raios: 9 lugares fixos, a baixa usa 3 deles. Mais fracos que antes: são luz de fundo, não um véu sobre a tela
  for (let k = 0; k < 9; k++) {
    if (!rico && k % 3 !== 1) continue;
    semear(13000 + k);
    const x = -4 + (fase.largura + 8) * (k + rnd() * 0.5) / 9;
    const z = r(-7, -3);
    luz.add('raio', x, r(12, 15), z, r(3, 6), r(15, 20), 0xffd28a, r(0.35, 0.5), rnd(), r(-0.42, -0.3), 'topo');
  }
  luz.add('raio', pr.x - 1.5, 14, -3.2, 3.5, 13, 0xffe0a0, 0.45, 0.4, -0.35, 'topo');
  const corBruma = [tema.estilo.nevoaLonge, misturar(new THREE.Color(), tema.estilo.nevoaLonge, tema.estilo.nevoaPerto, 0.35).getHex(), misturar(new THREE.Color(), tema.estilo.nevoaLonge, 0xffffff, 0.2).getHex()];
  for (let k = 0; k < 14; k++) {
    if (!rico && k % 2 === 1) continue;
    semear(14000 + k);
    const x = -6 + (fase.largura + 12) * (k + rnd()) / 14;
    // bruma com as cores de atmosfera do capítulo (antes: rosa/lilás claros fixos em todos os mundos)
    nevoa.add('nevoa', x, r(-3.6, -2.6), r(-8, -3), r(10, 18), r(3, 5), corBruma[k % 3], r(0.4, 0.6));
    nevoa.add('nevoa', x + 4, r(1.5, 5), r(-20, -12), r(14, 24), r(4, 7), corBruma[(k + 1) % 3], r(0.25, 0.4));
  }
  // bruma baixa na frente dos abismos: escura (tom de perto), nunca um véu claro entre a câmera e o jogo
  nevoa.add('nevoa', fase.largura / 2, -4.6, 2.5, fase.largura + 30, 3.0, tema.estilo.nevoaPerto, 0.45);

  return { mundo, brilho, luz, nevoa, tufos, flores, cascatas: cascatasL, chao };
}

/** Geometria de um tufo de grama: lâminas curvas, escuras na base e claras na ponta (cor por vértice). */
export function geoTufo(cores: { gramaEscura: number; gramaClara: number } = CORES): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const rnd = sorteio(5);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rnd();
    const h = 0.22 + rnd() * 0.18, inc = 0.12 + rnd() * 0.12;
    const pos = [-0.025, 0, 0, 0.025, 0, 0, -0.018, h * 0.55, inc * 0.4, 0.018, h * 0.55, inc * 0.4, 0, h, inc];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    g.rotateY(a);
    g.computeVertexNormals();
    // normais para cima: a grama fica iluminada como o chão (aspecto cartum, sem lâminas pretas)
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
    geos.push(pintar(g, (p, _n, c) => misturar(c, cores.gramaEscura, cores.gramaClara, p.y / 0.36)));
  }
  return mergeGeometries(geos)!;
}

/** Florzinha: 5 pétalas + miolo amarelo, num cabinho. A cor da pétala vem da instância. */
export function geoFlor(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const caule = new THREE.CylinderGeometry(0.008, 0.01, 0.16, 3); caule.translate(0, 0.08, 0);
  geos.push(pintar(caule, 0x4c8a34));
  for (let k = 0; k < 5; k++) {
    const p = new THREE.SphereGeometry(0.035, 5, 3); p.scale(1, 0.3, 0.6);
    p.translate(0.04, 0.165, 0); p.rotateY((k / 5) * Math.PI * 2);
    geos.push(pintar(p, 0xffffff));
  }
  const m = new THREE.SphereGeometry(0.022, 5, 3); m.translate(0, 0.17, 0);
  geos.push(pintar(m, 0xffd040));
  return mergeGeometries(geos)!;
}
