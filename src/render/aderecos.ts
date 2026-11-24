// Adereços procedurais dos outros mundos (capítulos 1 e 3–7). Mesmo método da floresta: peças simples pintadas por
// vértice e juntadas em lotes. Cada mundo troca as árvores gigantes, os cogumelos, as moitas, os cogumelinhos
// mágicos e o deque alto por peças próprias; o chão (penhascos com tapete por cima) é o mesmo, com a paleta do tema.
import * as THREE from 'three';
import type { Fase, Retangulo } from '../core/types';
import type { ChaveTema, CoresChao } from './tema';
import { colocar, deformar, fbm, Juntador, misturar, pintar } from './util';
import { Quadros } from './efeitos';

export interface Contexto {
  mundo: Juntador; brilho: Juntador; luz: Quadros; nevoa: Quadros;
  r: (a: number, b: number) => number; rnd: () => number;
  rico: boolean; alta: boolean;
  C: CoresChao & Record<string, number>;
  lanterna: (x: number, y: number, z: number, corda?: number) => void;
  fase: Fase;
}

export interface Kit {
  /** peça grande do fundo (no lugar das árvores gigantes) */
  grande(x: number, z: number, base: number, alto: number, raio: number): void;
  /** peça pequena no fundo da faixa de jogo (no lugar dos cogumelos) */
  pequeno(x: number, y: number, z: number, s: number, inclina?: number): void;
  /** moita / montinho */
  moita(x: number, y: number, z: number, s: number): void;
  /** enfeite que brilha (no lugar dos cogumelinhos mágicos) */
  brilho(x: number, y: number, z: number, cor: number): void;
  /** plataforma alta (y > 2): topo exatamente em `topo` */
  alta(x0: number, x1: number, topo: number): void;
  /** marcos do mundo (no lugar da cascata grande, das casas e das pontes da floresta), num trecho [X, X + L] */
  marcos(X: number, L: number): void;
  /** bloco elevado (caixa, degrau, batente) com exatamente o retângulo da colisão */
  bloco(r: Retangulo): void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function criarKit(chave: Exclude<ChaveTema, 'floresta'>, k: Contexto): Kit {
  const { mundo, brilho: bri, luz, r, rnd, rico, C } = k;
  const seg = (n: number) => (rico ? n : Math.max(4, Math.round(n * 0.6)));
  const escolher = <T>(l: readonly T[]) => l[Math.floor(rnd() * l.length) % l.length];

  // ---------- peças comuns ----------
  const bolas = (x: number, y: number, z: number, s: number, a: number, b: number) => {
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const rr = s * r(0.4, 0.75), dx = r(-1, 1) * s * 0.8, dz = r(-0.5, 0.5) * s;
      const g = new THREE.SphereGeometry(1, seg(10), seg(7));
      colocar(g, x + dx, y + rr * 0.55, z + dz, [rr * 1.15, rr, rr]);
      mundo.add(pintar(g, (_p, n2, c) => misturar(c, a, b, 0.4 + n2.y * 0.6)));
    }
  };
  /** Cristal: prisma de 6 lados com ponta. `brilha`: vai para o lote sem luz. */
  const cristal = (x: number, y: number, z: number, h: number, raio: number, incl: [number, number], cor: number, claro: number, brilha = false) => {
    const g = new THREE.CylinderGeometry(raio * 0.85, raio, h * 0.78, 6, 1);
    g.translate(0, h * 0.39, 0);
    const p = new THREE.ConeGeometry(raio * 0.85, h * 0.22, 6, 1); p.translate(0, h * 0.89, 0);
    for (const q of [g, p]) {
      colocar(q, x, y, z, 1, [incl[0], rnd() * 3, incl[1]]);
      const pint = pintar(q, (_pp, n, c) => misturar(c, cor, claro, 0.35 + Math.abs(n.x) * 0.4 + Math.max(0, n.y) * 0.5));
      (brilha ? bri : mundo).add(pint);
    }
  };
  /** Engrenagem de pé (de frente para a câmera): disco com dentes e furo central. */
  const engrenagem = (x: number, y: number, z: number, raio: number, esp: number, cor: number) => {
    const dentes = Math.max(8, Math.round(raio * 7));
    const forma = new THREE.Shape();
    for (let i = 0; i < dentes * 4; i++) {
      const a = (i / (dentes * 4)) * Math.PI * 2, fora = i % 4 === 1 || i % 4 === 2;
      const rr = fora ? raio * 1.14 : raio;
      if (i === 0) forma.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else forma.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const furo = new THREE.Path(); furo.absarc(0, 0, raio * 0.3, 0, Math.PI * 2, true); forma.holes.push(furo);
    const g = new THREE.ExtrudeGeometry(forma, { depth: esp, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -esp / 2);
    colocar(g, x, y, z, 1, [0, 0, rnd()]);
    mundo.add(pintar(g, (_p, n, c) => misturar(c, cor, 0xfff0b0, Math.max(0, n.z) * 0.25 + Math.max(0, n.y) * 0.3)));
  };
  /** Mostrador de relógio de frente: disco claro com marcas e ponteiros. */
  const mostrador = (x: number, y: number, z: number, raio: number) => {
    const aro = new THREE.TorusGeometry(raio, raio * 0.08, 6, seg(32)); colocar(aro, x, y, z + 0.02);
    mundo.add(pintar(aro, 0xc89a40));
    const disco = new THREE.CircleGeometry(raio, seg(32)); colocar(disco, x, y, z);
    bri.add(pintar(disco, (p, _n, c) => misturar(c, 0xfff2d0, 0xffd890, Math.hypot(p.x - x, p.y - y) / raio)));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, m = new THREE.BoxGeometry(raio * (i % 3 ? 0.05 : 0.09), raio * 0.16, 0.03);
      colocar(m, x + Math.sin(a) * raio * 0.82, y + Math.cos(a) * raio * 0.82, z + 0.03, 1, [0, 0, -a]);
      mundo.add(pintar(m, 0x4a3020));
    }
    for (const [l, a, w] of [[0.55, r(0, 6.28), 0.07], [0.8, r(0, 6.28), 0.045]] as const) {
      const p = new THREE.BoxGeometry(raio * w, raio * l, 0.03); p.translate(0, raio * l / 2, 0);
      colocar(p, x, y, z + 0.05, 1, [0, 0, a]); mundo.add(pintar(p, 0x3a2414));
    }
    luz.add('halo', x, y, z + 0.2, raio * 3.2, raio * 3.2, 0xffd890, 0.35, rnd());
  };
  /** Deque genérico para plataformas altas (tábuas da cor do tema, vigas e lanterninhas). */
  const deque = (x0: number, x1: number, topo: number, tabua: number, viga: number) => {
    for (let x = x0; x < x1 - 0.01; x += 0.46) {
      const g = new THREE.BoxGeometry(0.43, 0.2, 2.8);
      colocar(g, x + 0.23, topo - 0.1 - rnd() * 0.02, 0, 1, [0, 0, r(-0.015, 0.015)]);
      mundo.add(pintar(g, (_p, n, c) => misturar(c, viga, tabua, 0.55 + n.y * 0.45)));
    }
    for (const sz of [-1.1, 1.1]) { const v = new THREE.BoxGeometry(x1 - x0 + 0.3, 0.26, 0.26); colocar(v, (x0 + x1) / 2, topo - 0.33, sz); mundo.add(pintar(v, viga)); }
    k.lanterna(x0 + 0.1, topo + 0.75, -1.15, 0.2);
  };
  /** Ilha flutuante: rocha em cone por baixo, tampa de grama (topo em `topo`). */
  const ilha = (x0: number, x1: number, topo: number, z: number, prof: number, fundoX = 1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const base = new THREE.ConeGeometry(1, 1, seg(10), 3);
    base.rotateX(Math.PI); base.translate(0, -0.5, 0);
    colocar(base, cx, topo - 0.15, z, [w * 0.55, Math.max(1.2, w * 0.45 * fundoX), prof]);
    deformar(base, 0.25, 0.9, (p) => (p.y > topo - 0.3 ? null : V(1, 0.4, 1)));
    mundo.add(pintar(base, (p, n, c) => {
      misturar(c, C.rocha2, C.rocha1, 0.5 + n.x * 0.2 + n.y * 0.3);
      if (fbm(p.x * 0.8, p.y, p.z) > 0.35) misturar(c, c.getHex(), C.musgo, 0.5);
    }));
    const cap = new THREE.CylinderGeometry(1, 0.96, 0.32, seg(16), 1);
    colocar(cap, cx, topo - 0.16, z, [w * 0.55 + 0.05, 1, prof + 0.05]);
    mundo.add(pintar(cap, (_p, n, c) => misturar(c, C.gramaEscura, C.gramaClara, n.y > 0.5 ? 0.75 : 0.2)));
  };

  // ---------- os mundos ----------
  const CORES_BRINQ = [0xe8483c, 0x3c8ae8, 0xf0c838, 0x48b85c, 0xf08a3c, 0x9a5ae0];
  const blocoBrinq = (x: number, y: number, z: number, s: number, cor: number, rot = 0) => {
    const g = new THREE.BoxGeometry(s, s, s, 1, 1, 1);
    colocar(g, x, y + s / 2, z, 1, [0, rot, 0]);
    mundo.add(pintar(g, (_p, n, c) => misturar(c, cor, 0xffffff, Math.max(0, n.y) * 0.25 + Math.max(0, n.z) * 0.08)));
    // letra em relevo: um quadrado claro em cada face lateral (lê como a "letra" do bloco a distância)
    const f = new THREE.BoxGeometry(s * 0.56, s * 0.56, s * 1.02); colocar(f, x, y + s / 2, z, 1, [0, rot, 0]);
    mundo.add(pintar(f, misturar(new THREE.Color(), cor, 0xfff6e0, 0.6).getHex()));
  };
  const giz = (x: number, z: number, base: number, alto: number, raio: number, cor: number) => {
    const corpo = new THREE.CylinderGeometry(raio, raio, alto, seg(8)); corpo.translate(0, alto / 2, 0);
    colocar(corpo, x, base, z);
    mundo.add(pintar(corpo, (p, n, c) => {
      const faixa = Math.abs(((p.y - base) / alto) * 6 % 1 - 0.5) < 0.08 || (p.y - base) / alto > 0.86;
      misturar(c, cor, faixa ? 0x2a1a10 : 0xffffff, faixa ? 0.45 : Math.max(0, n.x) * 0.18);
    }));
    const ponta = new THREE.ConeGeometry(raio, raio * 2.4, seg(8)); ponta.translate(0, alto + raio * 1.2, 0);
    colocar(ponta, x, base, z);
    mundo.add(pintar(ponta, (p, _n, c) => misturar(c, 0xf0d8a8, cor, (p.y - base - alto) / (raio * 2.4) > 0.6 ? 1 : 0)));
  };

  /** Bloco elevado genérico: caixa de cantos arredondados com o lado da cor da rocha do tema e tampa de "grama". */
  const blocoPadrao = (q: Retangulo) => {
    const prof = Math.min(2.6, Math.max(1.6, q.w));
    const lado = new THREE.BoxGeometry(q.w, Math.max(0.05, q.h - 0.18), prof, Math.max(1, Math.round(q.w)), Math.max(1, Math.round(q.h)), 2);
    colocar(lado, q.x + q.w / 2, q.y + (q.h - 0.18) / 2, 0);
    mundo.add(pintar(lado, (p, n, c) => {
      misturar(c, C.rocha2, C.rocha1, 0.45 + n.x * 0.15 + Math.sin(p.y * 3.1) * 0.12);
      if (n.y < -0.5) c.multiplyScalar(0.7);
    }));
    const tampa = new THREE.BoxGeometry(q.w + 0.1, 0.22, prof + 0.1); colocar(tampa, q.x + q.w / 2, q.y + q.h - 0.11, 0);
    mundo.add(pintar(tampa, (_p, n, c) => misturar(c, C.gramaEscura, C.grama, n.y > 0.5 ? 1 : 0.35)));
  };

  const kits: Record<Exclude<ChaveTema, 'floresta'>, Kit> = {
    brinquedos: {
      bloco(q) { // bloco de montar gigante: cor viva, quadro claro na frente (a "letra") e cantos arredondados
        const cor = CORES_BRINQ[Math.abs(Math.round(q.x * 7 + q.y * 3)) % CORES_BRINQ.length];
        const prof = Math.min(2.6, Math.max(1.4, q.w * 1.1));
        const g = new THREE.BoxGeometry(q.w, q.h, prof); colocar(g, q.x + q.w / 2, q.y + q.h / 2, 0);
        mundo.add(pintar(g, (_p, n, c) => misturar(c, cor, 0xffffff, Math.max(0, n.y) * 0.22 - Math.max(0, -n.x) * 0.05)));
        if (q.h > 0.6 && q.w > 0.6) {
          const s2 = Math.min(q.w, q.h) * 0.62;
          const f = new THREE.BoxGeometry(s2, s2, 0.04); colocar(f, q.x + q.w / 2, q.y + q.h / 2, prof / 2 + 0.01);
          mundo.add(pintar(f, misturar(new THREE.Color(), cor, 0xfff6e0, 0.65).getHex()));
          const l = new THREE.TorusGeometry(s2 * 0.25, s2 * 0.07, 4, 10); colocar(l, q.x + q.w / 2, q.y + q.h / 2, prof / 2 + 0.04);
          mundo.add(pintar(l, cor));
        }
        for (const sx of [-1, 1]) { // pinos de encaixe em cima (atrás da faixa de jogo)
          const pino = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 8); colocar(pino, q.x + q.w / 2 + sx * q.w * 0.25, q.y + q.h + 0.06, -prof / 2 + 0.25);
          mundo.add(pintar(pino, cor));
        }
      },
      grande(x, z, base, alto, raio) {
        const t = rnd();
        if (t < 0.45) giz(x, z, base, alto * 0.9, raio * 0.9, escolher(CORES_BRINQ));
        else if (t < 0.8) { // torre de blocos
          let y = base + alto * 0.35;
          const s0 = raio * 2.6;
          const pilar = new THREE.BoxGeometry(s0 * 0.9, alto * 0.35, s0 * 0.9); pilar.translate(0, alto * 0.175, 0); colocar(pilar, x, base, z);
          mundo.add(pintar(pilar, 0xb88a5c));
          for (let i = 0; i < 4; i++) { const s = s0 * (1 - i * 0.1); blocoBrinq(x + r(-0.4, 0.4), y, z, s, escolher(CORES_BRINQ), r(-0.3, 0.3)); y += s; }
        } else { // bola gigante listrada
          const R = raio * 2.8;
          const g = new THREE.SphereGeometry(R, seg(20), seg(14)); colocar(g, x, base + alto * 0.45 + R, z);
          const a = escolher(CORES_BRINQ), b = escolher(CORES_BRINQ);
          mundo.add(pintar(g, (p, _n, c) => c.setHex(Math.floor((Math.atan2(p.z - z, p.x - x) + Math.PI) / (Math.PI / 3)) % 2 ? a : b === a ? 0xffffff : b)));
          const col = new THREE.CylinderGeometry(R * 0.35, R * 0.5, alto * 0.45, 8); col.translate(0, alto * 0.225, 0); colocar(col, x, base, z);
          mundo.add(pintar(col, 0x9a6a44));
        }
      },
      pequeno(x, y, z, s) {
        const t = rnd();
        if (t < 0.6) blocoBrinq(x, y, z, 0.45 * s + 0.2, escolher(CORES_BRINQ), r(-0.5, 0.5));
        else { const g = new THREE.SphereGeometry(0.25 * s + 0.1, seg(12), seg(8)); colocar(g, x, y + 0.25 * s + 0.1, z); const a = escolher(CORES_BRINQ); mundo.add(pintar(g, (p, _n, c) => c.setHex(Math.abs(p.y - y - 0.25 * s - 0.1) < 0.06 ? 0xffffff : a))); }
      },
      moita(x, y, z, s) {
        for (let i = 0; i < 3; i++) blocoBrinq(x + r(-0.8, 0.8) * s, y, z + r(-0.4, 0.4), r(0.35, 0.6) * s, escolher(CORES_BRINQ), r(0, 1));
      },
      brilho(x, y, z, cor) { // abajurzinho de estrela
        const pe = new THREE.CylinderGeometry(0.03, 0.08, 0.4, 6); pe.translate(0, 0.2, 0); colocar(pe, x, y, z); mundo.add(pintar(pe, 0xf0f0f0));
        const e = new THREE.OctahedronGeometry(0.16, 0); colocar(e, x, y + 0.52, z, [1, 1.2, 0.45]); bri.add(pintar(e, 0xfff0a0));
        luz.add('halo', x, y + 0.5, z + 0.1, 1.4, 1.4, cor, 0.55, rnd());
      },
      alta(x0, x1, topo) { // pilha de livros
        const cores = [0x3c6ac8, 0xd84848, 0x48a060, 0xe8b840, 0x8a5ac8];
        let y = topo;
        for (let i = 0; i < 3; i++) {
          const h = 0.32 + i * 0.05, d = 2.6 - i * 0.1, cor = cores[(i + Math.floor(x0)) % cores.length];
          const capa = new THREE.BoxGeometry(x1 - x0 + 0.1 + i * 0.2, h, d); colocar(capa, (x0 + x1) / 2 + r(-0.15, 0.15), y - h / 2, 0);
          mundo.add(pintar(capa, (p, n, c) => (Math.abs(n.z) > 0.5 && Math.abs(p.y - (y - h / 2)) < h * 0.36 && n.z > 0 ? c.setHex(0xfff4dc) : misturar(c, cor, 0xffffff, Math.max(0, n.y) * 0.2))));
          y -= h;
        }
      },
      marcos(X, L) {
        // cubo mágico gigante ao fundo
        const cx = X + L * 0.68, cz = -9, s = 1.1, cy = -1.5;
        const faces = [0xe8483c, 0xf08a3c, 0xffffff, 0xf0c838, 0x3c8ae8, 0x48b85c];
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) {
          const g = new THREE.BoxGeometry(s * 0.94, s * 0.94, s * 0.94); colocar(g, cx + i * s, cy + (j + 1.5) * s, cz + l * s, 1, [0, 0.5, 0]);
          mundo.add(pintar(g, (_p, n, c) => c.setHex(n.y > 0.5 ? faces[3] : n.x > 0.5 ? faces[0] : n.x < -0.5 ? faces[1] : n.z > 0.5 ? faces[4] : n.z < -0.5 ? faces[5] : 0x202020)));
        }
        // ursinho de pelúcia sentado
        const ux = X + L * 0.28, uz = -10, uy = -2.2, ur = 1.6;
        const pelo = (g: THREE.BufferGeometry) => mundo.add(pintar(g, (_p, n, c) => misturar(c, 0x8a5a34, 0xd8a070, 0.45 + n.y * 0.4)));
        let g: THREE.BufferGeometry = new THREE.SphereGeometry(ur, seg(16), seg(12)); colocar(g, ux, uy + ur, uz, [1, 1.05, 0.9]); pelo(g);
        g = new THREE.SphereGeometry(ur * 0.72, seg(16), seg(12)); colocar(g, ux, uy + ur * 2.55, uz); pelo(g);
        for (const s2 of [-1, 1]) {
          g = new THREE.SphereGeometry(ur * 0.26, seg(10), seg(8)); colocar(g, ux + s2 * ur * 0.55, uy + ur * 3.15, uz); pelo(g);
          g = new THREE.SphereGeometry(ur * 0.38, seg(10), seg(8)); colocar(g, ux + s2 * ur * 0.95, uy + ur * 1.3, uz + 0.3, [0.8, 1.2, 0.8]); pelo(g);
          g = new THREE.SphereGeometry(ur * 0.42, seg(10), seg(8)); colocar(g, ux + s2 * ur * 0.6, uy + ur * 0.3, uz + ur * 0.7); pelo(g);
          g = new THREE.SphereGeometry(ur * 0.08, 6, 4); colocar(g, ux + s2 * ur * 0.22, uy + ur * 2.7, uz + ur * 0.66); mundo.add(pintar(g, 0x201010));
        }
        g = new THREE.SphereGeometry(ur * 0.26, seg(10), seg(8)); colocar(g, ux, uy + ur * 2.4, uz + ur * 0.62, [1, 0.8, 0.8]); mundo.add(pintar(g, 0xf0d0a8));
        g = new THREE.TorusGeometry(ur * 0.4, ur * 0.08, 6, 12); colocar(g, ux, uy + ur * 1.95, uz + 0.2, 1, [Math.PI / 2 - 0.2, 0, 0]); mundo.add(pintar(g, 0xe8483c));
      },
    },

    relogio: {
      bloco: blocoPadrao,
      grande(x, z, base, alto, raio) {
        if (rnd() < 0.55) { // torre do relógio
          const w = raio * 2.2, h = alto * 0.8;
          const corpo = new THREE.BoxGeometry(w, h, w, 1, Math.ceil(h / 3), 1); corpo.translate(0, h / 2, 0); colocar(corpo, x, base, z);
          mundo.add(pintar(corpo, (p, n, c) => { misturar(c, 0x8a6a4c, 0xd8b488, 0.4 + Math.max(0, n.x) * 0.2 + ((p.y * 1.3) % 1 < 0.1 ? -0.3 : 0)); }));
          const tel = new THREE.ConeGeometry(w * 0.85, w * 1.4, 4); colocar(tel, x, base + h + w * 0.7, z, 1, [0, Math.PI / 4, 0]);
          mundo.add(pintar(tel, (_p, n, c) => misturar(c, 0x4a5a6a, 0x7a9aa8, 0.5 + n.y * 0.4)));
          mostrador(x, base + h - w * 0.75, z + w / 2 + 0.05, w * 0.42);
          for (let i = 0; i < 3; i++) { const j = new THREE.PlaneGeometry(w * 0.2, w * 0.3); colocar(j, x + (i - 1) * w * 0.3, base + h * (0.35 + i * 0.1), z + w / 2 + 0.03); bri.add(pintar(j, 0xffc860)); }
        } else { // engrenagem gigante num poste
          const R = raio * 2.4, y = base + alto * 0.6;
          const poste = new THREE.CylinderGeometry(0.25, 0.4, alto * 0.6, 6); poste.translate(0, alto * 0.3, 0); colocar(poste, x, base, z - 0.5);
          mundo.add(pintar(poste, 0x5a3a24));
          engrenagem(x, y, z, R, 0.45, rnd() < 0.5 ? 0xc89a40 : 0xa87850);
          engrenagem(x + R * 1.6, y + R * 0.5, z - 0.6, R * 0.6, 0.35, 0xb08848);
        }
      },
      pequeno(x, y, z, s) {
        if (rnd() < 0.6) engrenagem(x, y + 0.3 * s + 0.1, z, 0.3 * s + 0.1, 0.12, escolher([0xc89a40, 0xa87850, 0x8a8a9a]));
        else { const c = new THREE.CylinderGeometry(0.12 * s + 0.05, 0.12 * s + 0.05, 0.9 * s, 8); c.translate(0, 0.45 * s, 0); colocar(c, x, y, z); mundo.add(pintar(c, (_p, n, cc) => misturar(cc, 0x9a6a30, 0xf0c870, Math.max(0, n.x) * 0.6))); }
      },
      moita(x, y, z, s) { bolas(x, y, z, s, C.gramaEscura, C.gramaClara); },
      brilho(x, y, z, cor) { // poste de luz
        const pe = new THREE.CylinderGeometry(0.04, 0.06, 1.3, 5); pe.translate(0, 0.65, 0); colocar(pe, x, y, z); mundo.add(pintar(pe, 0x3a3040));
        const l = new THREE.CylinderGeometry(0.1, 0.12, 0.22, 6); colocar(l, x, y + 1.42, z); bri.add(pintar(l, 0xffd070));
        const t = new THREE.ConeGeometry(0.16, 0.12, 6); colocar(t, x, y + 1.59, z); mundo.add(pintar(t, 0x3a3040));
        luz.add('halo', x, y + 1.42, z + 0.1, 1.6, 1.6, cor, 0.6, rnd());
      },
      alta(x0, x1, topo) {
        deque(x0, x1, topo, 0xc8a070, 0x6a4a2a);
        for (let x = x0 + 0.1; x <= x1; x += 0.6) { const b = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4); colocar(b, x, topo + 0.4, -1.3); mundo.add(pintar(b, 0xc89a40)); }
        const corr = new THREE.BoxGeometry(x1 - x0, 0.06, 0.06); colocar(corr, (x0 + x1) / 2, topo + 0.8, -1.3); mundo.add(pintar(corr, 0xe0b850));
      },
      marcos(X, L) {
        mostrador(X + L * 0.5, 9, -16, 6);
        engrenagem(X + L * 0.5 - 9, 4, -15, 3, 0.8, 0xa87850);
        engrenagem(X + L * 0.5 + 8.5, 13, -16.5, 2.4, 0.8, 0xc89a40);
        engrenagem(X + L * 0.18, 6, -12, 2, 0.6, 0x9a8a7a);
        engrenagem(X + L * 0.85, 5, -12, 2.6, 0.6, 0xb08848);
      },
    },

    oceano: {
      bloco: blocoPadrao,
      grande(x, z, base, alto, raio) {
        const t = rnd();
        if (t < 0.45) { // coral em árvore
          const cor = escolher([0xf07a8a, 0xf0a050, 0xc86ae0, 0xf05a7a]);
          const galho = (p: THREE.Vector3, d: THREE.Vector3, l: number, rr: number, nivel: number) => {
            const g = new THREE.CylinderGeometry(rr * 0.7, rr, l, 6); g.translate(0, l / 2, 0);
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d)); g.translate(p.x, p.y, p.z);
            mundo.add(pintar(g, (_q, n, c) => misturar(c, cor, 0xffe0d0, Math.max(0, n.y) * 0.35)));
            const fim = p.clone().addScaledVector(d, l);
            if (nivel <= 0) { const b = new THREE.SphereGeometry(rr * 1.1, 6, 4); colocar(b, fim.x, fim.y, fim.z); mundo.add(pintar(b, misturar(new THREE.Color(), cor, 0xffffff, 0.35).getHex())); return; }
            for (const s of [-1, 1]) galho(fim, d.clone().add(V(s * r(0.4, 0.8), 0.6, r(-0.3, 0.3))).normalize(), l * 0.72, rr * 0.68, nivel - 1);
          };
          galho(V(x, base + alto * 0.3, z), V(0, 1, 0), alto * 0.3, raio * 0.8, rico ? 3 : 2);
          const pe = new THREE.CylinderGeometry(raio * 0.8, raio * 1.2, alto * 0.3, 6); pe.translate(0, alto * 0.15, 0); colocar(pe, x, base, z);
          mundo.add(pintar(pe, C.rocha2));
        } else if (t < 0.75) { // coluna de ruína
          const h = alto * r(0.6, 0.9), R = raio * 0.9;
          const col = new THREE.CylinderGeometry(R, R * 1.05, h, seg(12), 4); col.translate(0, h / 2, 0); colocar(col, x, base, z, 1, [r(-0.05, 0.05), 0, r(-0.06, 0.06)]);
          deformar(col, 0.08, 1.2, () => V(1, 0, 1));
          mundo.add(pintar(col, (p, n, c) => { misturar(c, 0x6a8ab0, 0xb8d0e0, 0.5 + n.x * 0.3); if (fbm(p.x, p.y * 0.6, p.z) > 0.25) misturar(c, c.getHex(), 0x3ab8a0, 0.6); }));
          const cap = new THREE.BoxGeometry(R * 2.8, R * 0.6, R * 2.8); colocar(cap, x, base + h, z, 1, [0, 0, r(-0.1, 0.1)]);
          mundo.add(pintar(cap, (_p, n, c) => misturar(c, 0x6a8ab0, 0xc8e0f0, 0.5 + n.y * 0.4)));
        } else { // alga alta
          for (let i = 0; i < 3; i++) {
            const h = alto * r(0.4, 0.75);
            const g = new THREE.CylinderGeometry(raio * 0.15, raio * 0.28, h, 5, 8);
            const pp = g.getAttribute('position') as THREE.BufferAttribute;
            for (let v = 0; v < pp.count; v++) pp.setX(v, pp.getX(v) + Math.sin(pp.getY(v) * 0.5 + i) * raio * 0.7);
            g.translate(0, h / 2, 0); colocar(g, x + (i - 1) * raio, base, z + r(-1, 1));
            mundo.add(pintar(g, (p, _n, c) => misturar(c, 0x1a6a58, 0x5ad0a0, (p.y - base) / h)));
          }
        }
      },
      pequeno(x, y, z, s) {
        if (rnd() < 0.5) { // concha
          const g = new THREE.SphereGeometry(0.28 * s + 0.1, seg(12), 4, 0, Math.PI, 0, Math.PI / 2);
          colocar(g, x, y, z, [1, 0.8, 1.1], [-Math.PI / 2 + 0.3, r(-0.5, 0.5), 0]);
          mundo.add(pintar(g, (p, _n, c) => misturar(c, 0xf0b0a0, 0xfff0e0, (Math.sin(Math.atan2(p.y - y, p.x - x) * 16) + 1) / 2)));
        } else { // estrela-do-mar
          const f = new THREE.Shape();
          for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = (i % 2 ? 0.12 : 0.32) * (0.6 + s * 0.4); i ? f.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : f.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          const g = new THREE.ExtrudeGeometry(f, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
          colocar(g, x, y + 0.03, z, 1, [-Math.PI / 2, 0, r(0, 6)]);
          mundo.add(pintar(g, escolher([0xf08a3c, 0xf05a7a, 0xf0c050])));
        }
      },
      moita(x, y, z, s) { bolas(x, y, z, s, 0xd8507a, 0xffa0b8); },
      brilho(x, y, z, cor) { // anêmona que brilha
        for (let i = 0; i < 5; i++) {
          const t = new THREE.CylinderGeometry(0.02, 0.035, 0.4, 4); t.translate(0, 0.2, 0);
          colocar(t, x + r(-0.15, 0.15), y, z + r(-0.1, 0.1), 1, [r(-0.4, 0.4), 0, r(-0.4, 0.4)]); bri.add(pintar(t, cor));
        }
        luz.add('halo', x, y + 0.3, z + 0.1, 1.5, 1.2, cor, 0.6, rnd());
      },
      // no plano do jogo o cone fica raso (1,2 m) para não esconder quem está pendurado no fio embaixo da ilha
      alta(x0, x1, topo) { ilha(x0, x1, topo, 0, 1.4, 0); },
      marcos(X, L) {
        // arco de ruína grande ao fundo
        const ax = X + L * 0.4, az = -13, h = 9, w = 6;
        for (const s of [-1, 1]) {
          const col = new THREE.CylinderGeometry(0.9, 1.0, h, seg(12)); col.translate(0, h / 2, 0); colocar(col, ax + s * w / 2, -6, az);
          mundo.add(pintar(col, (_p, n, c) => misturar(c, 0x5a7aa8, 0xa8c8e0, 0.5 + n.x * 0.3)));
        }
        const arco = new THREE.TorusGeometry(w / 2, 0.8, 8, seg(20), Math.PI); colocar(arco, ax, h - 6, az);
        mundo.add(pintar(arco, (_p, n, c) => misturar(c, 0x5a7aa8, 0xc8e0f0, 0.5 + n.y * 0.4)));
        // raios de luz vindos da superfície
        for (let i = 0; i < 5; i++) luz.add('raio', X + L * (0.1 + i * 0.2), 16, -6, 4, 20, 0xa0f0ff, 0.5, rnd(), r(-0.2, 0.2), 'topo');
      },
    },

    doces: {
      bloco: blocoPadrao,
      grande(x, z, base, alto, raio) {
        const t = rnd();
        if (t < 0.5) { // pirulito gigante
          const h = alto * 0.7, R = raio * 2.2;
          const pau = new THREE.CylinderGeometry(raio * 0.25, raio * 0.25, h, 6); pau.translate(0, h / 2, 0); colocar(pau, x, base, z); mundo.add(pintar(pau, 0xfff8f0));
          const d = new THREE.CylinderGeometry(R, R, raio * 0.6, seg(24)); d.rotateX(Math.PI / 2); colocar(d, x, base + h + R * 0.8, z);
          const a = escolher([0xf05a8a, 0x5ab0f0, 0xf0a030, 0x9a5ae0]);
          mundo.add(pintar(d, (p, n, c) => {
            const ang = Math.atan2(p.y - (base + h + R * 0.8), p.x - x), rr = Math.hypot(p.y - (base + h + R * 0.8), p.x - x) / R;
            c.setHex(Math.sin(ang * 1 + rr * 12) > 0 ? a : 0xfff4f8);
            if (Math.abs(n.z) < 0.5) c.setHex(a);
          }));
        } else if (t < 0.8) { // bengala doce
          const h = alto * 0.6, R = raio * 0.45;
          const corpo = new THREE.CylinderGeometry(R, R, h, 8, 12); corpo.translate(0, h / 2, 0); colocar(corpo, x, base, z);
          const listra = (p: THREE.Vector3, c: THREE.Color) => c.setHex(Math.sin(p.y * 2.5 + Math.atan2(p.z - z, p.x - x) * 1) > 0 ? 0xe83c50 : 0xfff6f6);
          mundo.add(pintar(corpo, (p, _n, c) => listra(p, c)));
          const curva = new THREE.TorusGeometry(R * 3, R, 8, 12, Math.PI); colocar(curva, x + R * 3, base + h, z);
          mundo.add(pintar(curva, (p, _n, c) => c.setHex(Math.sin(Math.atan2(p.y - base - h, p.x - x - R * 3) * 6) > 0 ? 0xe83c50 : 0xfff6f6)));
        } else { // cupcake gigante
          const R = raio * 2;
          const forma = new THREE.CylinderGeometry(R, R * 0.8, R * 1.1, seg(16), 1); forma.translate(0, alto * 0.45 + R * 0.55, 0); colocar(forma, x, base, z);
          mundo.add(pintar(forma, (p, _n, c) => c.setHex(Math.floor((Math.atan2(p.z - z, p.x - x) + 3.2) * 4) % 2 ? 0xf0a8c8 : 0xffd0e0)));
          const pe = new THREE.CylinderGeometry(R * 0.5, R * 0.7, alto * 0.45, 8); pe.translate(0, alto * 0.225, 0); colocar(pe, x, base, z); mundo.add(pintar(pe, 0x8a5030));
          for (let i = 0; i < 3; i++) { const g = new THREE.SphereGeometry(R * (1.05 - i * 0.3), seg(16), seg(10)); colocar(g, x, base + alto * 0.45 + R * (1.15 + i * 0.5), z, [1, 0.6, 1]); mundo.add(pintar(g, (_p, n, c) => misturar(c, 0xf0b0d0, 0xfff4f8, 0.4 + n.y * 0.5))); }
          const cereja = new THREE.SphereGeometry(R * 0.25, 8, 6); colocar(cereja, x, base + alto * 0.45 + R * 2.4, z); mundo.add(pintar(cereja, 0xe02840));
        }
      },
      pequeno(x, y, z, s) {
        if (rnd() < 0.55) { // jujuba
          const g = new THREE.SphereGeometry(0.25 * s + 0.1, seg(10), seg(8), 0, Math.PI * 2, 0, Math.PI * 0.6); colocar(g, x, y, z, [1, 1.3, 1]);
          mundo.add(pintar(g, (_p, n, c) => misturar(c, escolher([0xf05a8a, 0x5ac0f0, 0xa0e050, 0xf0c040]), 0xffffff, Math.max(0, n.y) * 0.3)));
        } else { // rosquinha
          const g = new THREE.TorusGeometry(0.22 * s + 0.08, 0.1 * s + 0.04, 6, seg(12)); colocar(g, x, y + 0.08, z, 1, [Math.PI / 2, 0, 0]);
          mundo.add(pintar(g, (p, _n, c) => c.setHex(p.y > y + 0.1 ? 0xf080b0 : 0xd8a060)));
        }
      },
      moita(x, y, z, s) { bolas(x, y, z, s, 0xf0b8d0, 0xfff8fc); },
      brilho(x, y, z, cor) {
        const g = new THREE.SphereGeometry(0.16, 8, 6); colocar(g, x, y + 0.6, z, [1, 1.2, 1]); bri.add(pintar(g, 0xffe0f0));
        const pe = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 4); pe.translate(0, 0.3, 0); colocar(pe, x, y, z); mundo.add(pintar(pe, 0xfff8f0));
        luz.add('halo', x, y + 0.6, z + 0.1, 1.4, 1.4, cor, 0.6, rnd());
      },
      alta(x0, x1, topo) { // fatia de bolo: camadas de biscoito e recheio, cobertura com gotas
        const w = x1 - x0, cx = (x0 + x1) / 2;
        const camadas: [number, number][] = [[0.3, 0xd8a060], [0.15, 0xf8f0f0], [0.3, 0xd8a060], [0.15, 0xf06a9a], [0.3, 0xd8a060]];
        let y = topo - 0.2;
        const cob = new THREE.BoxGeometry(w + 0.1, 0.2, 2.8); colocar(cob, cx, topo - 0.1, 0); mundo.add(pintar(cob, 0xffe4f0));
        for (const [h, cor] of camadas) { const g = new THREE.BoxGeometry(w, h, 2.7); colocar(g, cx, y - h / 2, 0); mundo.add(pintar(g, cor)); y -= h; }
        for (let x = x0 + 0.3; x < x1 - 0.2; x += r(0.4, 0.8)) { const g = new THREE.CapsuleGeometry(0.07, r(0.1, 0.4), 2, 6); colocar(g, x, topo - 0.3, 1.38); mundo.add(pintar(g, 0xffe4f0)); }
      },
      marcos(X, L) {
        const cx = X + L * 0.55, cz = -18, base = -6;
        const torre = (x: number, h: number, R: number, cor: number) => {
          const t = new THREE.CylinderGeometry(R, R * 1.05, h, seg(12)); t.translate(0, h / 2, 0); colocar(t, x, base, cz);
          mundo.add(pintar(t, (p, _n, c) => c.setHex(Math.floor(p.y * 0.8) % 2 ? cor : 0xfff0f6)));
          const c2 = new THREE.ConeGeometry(R * 1.3, R * 2.4, seg(12)); colocar(c2, x, base + h + R * 1.2, cz); mundo.add(pintar(c2, 0xf05a8a));
          const j = new THREE.PlaneGeometry(R * 0.6, R * 0.9); colocar(j, x, base + h * 0.7, cz + R + 0.02); bri.add(pintar(j, 0xffe0a0));
        };
        torre(cx, 14, 2.2, 0xf8b0d0); torre(cx - 5, 10, 1.5, 0xb0d8f8); torre(cx + 5, 11, 1.6, 0xf8e0a0);
        const muro = new THREE.BoxGeometry(12, 6, 2); colocar(muro, cx, base + 3, cz); mundo.add(pintar(muro, (_p, n, c) => misturar(c, 0xf0b0d0, 0xfff0f6, 0.5 + n.y * 0.5)));
      },
    },

    espelhos: {
      bloco: blocoPadrao,
      grande(x, z, base, alto, raio) {
        if (rnd() < 0.7) { // aglomerado de cristais
          const n = 3 + Math.floor(rnd() * 3);
          for (let i = 0; i < n; i++) cristal(x + r(-1.5, 1.5) * raio, base, z + r(-1, 1), alto * r(0.4, 0.85), raio * r(0.6, 1.1), [r(-0.25, 0.25), r(-0.25, 0.25)], C.rocha2, 0xc8b8ff, i === 0);
        } else { // espelho alto com moldura
          const h = alto * 0.5, w = raio * 3;
          const p = new THREE.BoxGeometry(w, h, 0.2); p.translate(0, h / 2, 0); colocar(p, x, base + alto * 0.35, z, 1, [0, r(-0.4, 0.4), 0]);
          bri.add(pintar(p, (q, _n, c) => misturar(c, 0x9ab8f0, 0xe8f0ff, (q.y - base - alto * 0.35) / h * 0.8 + 0.1)));
          const m = new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.15); m.translate(0, h / 2, -0.12); colocar(m, x, base + alto * 0.35 - 0.25, z, 1, [0, 0, 0]);
          mundo.add(pintar(m, 0x5a46a8));
        }
      },
      pequeno(x, y, z, s) { for (let i = 0; i < 3; i++) cristal(x + r(-0.25, 0.25), y, z + r(-0.15, 0.15), r(0.4, 1.0) * s, 0.09 * s + 0.04, [r(-0.4, 0.4), r(-0.4, 0.4)], C.rocha1, 0xe0d8ff); },
      moita(x, y, z, s) { for (let i = 0; i < 4; i++) cristal(x + r(-0.6, 0.6) * s, y, z + r(-0.4, 0.4), r(0.5, 1.2) * s, 0.14 * s, [r(-0.5, 0.5), r(-0.5, 0.5)], C.rocha2, 0xb0a0f0); },
      brilho(x, y, z, cor) {
        cristal(x, y, z, 0.55, 0.08, [0, 0.2], 0x9ae8ff, 0xffffff, true);
        luz.add('halo', x, y + 0.3, z + 0.1, 1.4, 1.4, cor, 0.6, rnd());
      },
      alta(x0, x1, topo) {
        const w = x1 - x0, cx = (x0 + x1) / 2;
        const g = new THREE.BoxGeometry(w, 0.3, 2.6); colocar(g, cx, topo - 0.15, 0); mundo.add(pintar(g, (_p, n, c) => misturar(c, 0x6a58b8, 0xd8e8ff, 0.4 + n.y * 0.6)));
        for (let x = x0 + 0.3; x < x1; x += 0.9) cristal(x, topo - 0.3, r(-1, 1), -r(0.6, 1.6), 0.14, [Math.PI, 0], 0x6a58b8, 0xb0c8ff);
      },
      marcos(X, L) {
        for (let i = 0; i < 6; i++) cristal(X + L * (0.1 + i * 0.17), -7, -18 - r(0, 4), r(12, 22), r(1.2, 2.2), [r(-0.15, 0.15), r(-0.15, 0.15)], 0x4a3a98, 0xa898f0, i % 2 === 0);
      },
    },

    cosmos: {
      bloco: blocoPadrao,
      grande(x, z, base, alto, raio) {
        const t = rnd();
        if (t < 0.65) { // ilha flutuante ao fundo
          const w = raio * r(3, 5), y = base + alto * r(0.45, 0.9);
          ilha(x - w / 2, x + w / 2, y, z, raio * 1.6, 1.4);
          if (rnd() < 0.5) cristal(x + r(-1, 1), y - 0.1, z, raio * 1.5, raio * 0.3, [0, 0], 0x6a5aa8, 0xd0c8ff, true);
        } else { // planetinha com anel
          const R = raio * r(1.2, 2.2), y = base + alto * r(0.7, 1.1);
          const a = escolher([0xf0a060, 0x80b0f0, 0xd080e0, 0x90e0c0]);
          const g = new THREE.SphereGeometry(R, seg(18), seg(12)); colocar(g, x, y, z);
          mundo.add(pintar(g, (p, n, c) => misturar(c, a, 0xffffff, Math.sin(p.y * 3) * 0.12 + 0.12 + Math.max(0, n.y) * 0.2)));
          const anel = new THREE.TorusGeometry(R * 1.6, R * 0.08, 4, seg(32)); colocar(anel, x, y, z, [1, 1, 1], [Math.PI / 2 - 0.35, 0, 0.3]);
          bri.add(pintar(anel, 0xfff0c0));
        }
      },
      pequeno(x, y, z, s) {
        if (rnd() < 0.5) cristal(x, y, z, 0.6 * s, 0.08 * s + 0.04, [r(-0.3, 0.3), r(-0.3, 0.3)], 0x8a78d8, 0xfff0c0, rnd() < 0.4);
        else {
          const g = new THREE.DodecahedronGeometry(0.22 * s + 0.08, 0); colocar(g, x, y + 0.1, z, [1.2, 0.8, 1]);
          mundo.add(pintar(g, (_p, n, c) => misturar(c, C.rocha2, C.rocha1, 0.5 + n.y * 0.4)));
        }
      },
      moita(x, y, z, s) { bolas(x, y, z, s, C.gramaEscura, C.gramaClara); },
      brilho(x, y, z, cor) {
        const e = new THREE.OctahedronGeometry(0.14, 0); colocar(e, x, y + 0.5, z, [1, 1.4, 0.6]); bri.add(pintar(e, 0xfff0c0));
        luz.add('halo', x, y + 0.5, z + 0.1, 1.5, 1.5, cor, 0.65, rnd());
        luz.add('estrela', x, y + 0.5, z + 0.12, 0.7, 0.7, 0xffffff, 0.8, rnd());
      },
      alta(x0, x1, topo) { ilha(x0, x1, topo, 0, 1.4, 0); }, // cone raso: veja o oceano
      marcos(X, L) {
        // planeta grande com anel e a "estrela do coração" ao longe
        const g = new THREE.SphereGeometry(9, seg(28), seg(18)); colocar(g, X + L * 0.3, 14, -40);
        mundo.add(pintar(g, (p, n, c) => misturar(c, 0x6a50c0, 0xf0a0d0, 0.35 + Math.sin(p.y * 0.8) * 0.15 + Math.max(0, n.y) * 0.2)));
        const anel = new THREE.TorusGeometry(15, 0.6, 4, seg(48)); colocar(anel, X + L * 0.3, 14, -40, 1, [Math.PI / 2 - 0.3, 0, 0.25]);
        bri.add(pintar(anel, 0xffe0b0));
        luz.add('estrela', X + L * 0.75, 16, -30, 8, 8, 0xfff0c0, 0.9, 0.3);
        luz.add('halo', X + L * 0.75, 16, -30.2, 16, 16, 0xffd080, 0.5, 0.6);
        for (let i = 0; i < 4; i++) ilha(X + L * (0.1 + i * 0.27) - 2, X + L * (0.1 + i * 0.27) + 2, 4 + i % 2 * 3, -12 - i * 2, 2, 1.6);
      },
    },
  };
  return kits[chave];
}
