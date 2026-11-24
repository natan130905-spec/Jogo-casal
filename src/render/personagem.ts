// Personagens P1 e P2 no estilo da arte conceitual (chibi: cabeça grande, olhos grandes, cabelo com volume).
// Tudo procedural: as peças (esferas, cápsulas, tornos) são pintadas por vértice e juntadas numa única malha com
// esqueleto simples (quadril, tronco, cabeça, braços, pernas e "cauda" do lenço/casaco). O rosto é uma calota
// sobre a cabeça com textura de canvas (4 expressões num atlas). Material toon de 3 tons + luz de borda, e
// contorno escuro (casco invertido) na média e na alta.
// Por personagem: corpo (1 chamada) + contorno (1) + rosto (1) + rótulo (1) (+1 de sombra na alta); a arma na mão
// (1, só atacando ou trocando; src/render/armas.ts, L4) e a bolha (1, só sem corações) aparecem quando precisa.
// Poses além do andar/pular: atirando (Estilingue na mão do lado da câmera), golpe (Espada ou Martelo de cima para
// baixo), pendurado no Fio Vermelho ou numa
// argola (braços para cima, corpo inclinado na direção da corda), segurando a corda (inclinado para trás, braços
// à frente) e dentro da bolha (encolhido, flutuando). Rótulos com os nomes: Natan (P1) e Bruna (P2).
// O visual cabe na caixa de colisão (0,6 × 1,1 m): pés em y = 0, topo do cabelo ≤ 1,1 m.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EstadoJogador } from '../core/types';
import { FISICA } from '../core/sim';
import type { Qualidade } from './cena';
import { colocar, pintar } from './util';
import { materialBolha } from './materiais';
import { inclinacaoCorda } from './elementos';
import { criarItemNaMao } from './armas';

export type QualPersonagem = 'P1' | 'P2';

export interface Personagem {
  raiz: THREE.Group;
  /**
   * Anima a partir do estado do jogador (e do parceiro, para virar para ele ao dar a mão). `corda`: ponto para onde
   * a corda puxa quem está pendurado (o parceiro que segura, ou a argola), para inclinar o corpo.
   */
  atualizar(j: EstadoJogador, outro: EstadoJogador, dt: number, eventos: readonly string[], i: number, relogio: number, corda?: { x: number; y: number } | null): void;
}

// ---------------------------------------------------------------- esqueleto
const O = { quadril: 0, tronco: 1, cabeca: 2, bracoE: 3, bracoD: 4, pernaE: 5, pernaD: 6, cauda: 7 } as const;
type Osso = (typeof O)[keyof typeof O];
/** posição de cada osso na pose de ligação (coordenadas do personagem, pés em y = 0) e o pai */
const OSSOS: { pos: [number, number, number]; pai: number }[] = [
  { pos: [0, 0.34, 0], pai: -1 },        // quadril
  { pos: [0, 0.40, 0], pai: O.quadril }, // tronco
  { pos: [0, 0.52, 0], pai: O.tronco },  // cabeça (pescoço)
  { pos: [-0.13, 0.49, 0], pai: O.tronco }, // braço esquerdo (ombro)
  { pos: [0.13, 0.49, 0], pai: O.tronco },  // braço direito
  { pos: [-0.068, 0.32, 0], pai: O.quadril }, // perna esquerda
  { pos: [0.068, 0.32, 0], pai: O.quadril },  // perna direita
  { pos: [0, 0.52, -0.07], pai: O.tronco },   // cauda (pontas do lenço / aba do casaco)
];
/** centro e raio da cabeça (a calota do rosto usa os mesmos) */
const CAB = { y: 0.755, r: 0.25, ex: 1.07, ey: 0.98 };

// ---------------------------------------------------------------- montagem das peças
interface Peca { g: THREE.BufferGeometry; contorno: boolean }
class Montador {
  pecas: Peca[] = [];
  constructor(private det: number) {}
  /** número de segmentos conforme o detalhe pedido */
  s(n: number, min = 4) { return Math.max(min, Math.round(n * this.det)); }
  add(geo: THREE.BufferGeometry, cor: number | ((p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => void), osso: Osso, contorno = true) {
    const g = pintar(geo, cor);
    const n = g.getAttribute('position').count;
    const idx = new Uint16Array(n * 4), peso = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) { idx[k * 4] = osso; peso[k * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(peso, 4));
    this.pecas.push({ g, contorno });
    return g;
  }
  juntar(soContorno: boolean) {
    const gs = this.pecas.filter((p) => !soContorno || p.contorno).map((p) => p.g);
    const junto = mergeGeometries(gs, false)!;
    const g = mergeVertices(junto, 1e-5);
    junto.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

const tmpQ = new THREE.Quaternion(), CIMA = new THREE.Vector3(0, 1, 0);
/** Gira a geometria (eixo y local) para apontar em `eixo` e a põe em `p`. */
function apontar(g: THREE.BufferGeometry, p: THREE.Vector3, eixo: THREE.Vector3, esc: [number, number, number] = [1, 1, 1]) {
  g.scale(esc[0], esc[1], esc[2]);
  g.applyQuaternion(tmpQ.setFromUnitVectors(CIMA, eixo.clone().normalize()));
  g.translate(p.x, p.y, p.z);
  return g;
}
/** Direção a partir do centro da cabeça: `a` = giro horizontal (0 = frente), `e` = elevação acima do "equador". */
const dirCab = (a: number, e: number) => new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
const naCabeca = (d: THREE.Vector3, k: number) => new THREE.Vector3(d.x * CAB.r * k * CAB.ex, CAB.y + d.y * CAB.r * k * CAB.ey, d.z * CAB.r * k);

const PELE = 0xf8cfae;

interface Paleta { cabelo: number; cabeloLuz: number; olho: number; olhoLuz: number; sobrancelha: number; cilios: boolean }
const PALETA: Record<QualPersonagem, Paleta> = {
  P1: { cabelo: 0x6b3c1f, cabeloLuz: 0x9a5a2c, olho: 0x5a2e12, olhoLuz: 0xb7743a, sobrancelha: 0x4a2814, cilios: false },
  P2: { cabelo: 0x2f1c2e, cabeloLuz: 0x5a3758, olho: 0x3a1f3c, olhoLuz: 0x9a64b8, sobrancelha: 0x2a1628, cilios: true },
};

/** Cabelo com brilho por cima (as faces voltadas para cima clareiam). */
const corCabelo = (pal: Paleta) => {
  const a = new THREE.Color(pal.cabelo), b = new THREE.Color(pal.cabeloLuz);
  return (_p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => { c.copy(a).lerp(b, THREE.MathUtils.smoothstep(n.y, 0.35, 0.95) * 0.75); };
};

function cabecaComum(m: Montador, pal: Paleta) {
  const cab = new THREE.SphereGeometry(CAB.r, m.s(22), m.s(16));
  colocar(cab, 0, CAB.y, 0, [CAB.ex, CAB.ey, 1]);
  m.add(cab, PELE, O.cabeca);
  for (const s of [-1, 1]) { // orelhas
    const o = new THREE.SphereGeometry(0.05, m.s(8), m.s(6));
    colocar(o, s * 0.262, CAB.y - 0.02, -0.01, [0.6, 1, 0.8]);
    m.add(o, PELE, O.cabeca, false);
  }
  // pescoço
  const p = new THREE.CylinderGeometry(0.05, 0.06, 0.08, m.s(10), 1, true);
  colocar(p, 0, 0.53, 0);
  m.add(p, PELE, O.cabeca, false);
  void pal;
}

function bracos(m: Montador, manga: number, punho: number | null, antebracoPele: boolean) {
  for (const [s, osso] of [[-1, O.bracoE], [1, O.bracoD]] as const) {
    const x = s * 0.145;
    const ombro = new THREE.SphereGeometry(0.058, m.s(10), m.s(8)); colocar(ombro, x, 0.475, 0); m.add(ombro, manga, osso);
    const sup = new THREE.CapsuleGeometry(0.047, 0.07, m.s(3, 2), m.s(9)); colocar(sup, x + s * 0.006, 0.42, 0); m.add(sup, manga, osso);
    const ant = new THREE.CapsuleGeometry(0.04, 0.06, m.s(3, 2), m.s(8)); colocar(ant, x + s * 0.01, 0.355, 0.005); m.add(ant, antebracoPele ? PELE : manga, osso);
    if (punho !== null) { const t = new THREE.TorusGeometry(0.045, 0.014, m.s(5, 3), m.s(10)); colocar(t, x + s * 0.008, 0.375, 0, 1, [Math.PI / 2, 0, 0]); m.add(t, punho, osso, false); }
    const mao = new THREE.SphereGeometry(0.048, m.s(10), m.s(8)); colocar(mao, x + s * 0.012, 0.3, 0.012, [1, 1.05, 0.95]); m.add(mao, PELE, osso);
  }
}

function pernas(m: Montador, calca: number, pele: boolean, meia: number | null, bota: number, solado: number) {
  for (const [s, osso] of [[-1, O.pernaE], [1, O.pernaD]] as const) {
    const x = s * 0.07;
    const perna = new THREE.CapsuleGeometry(pele ? 0.042 : 0.058, 0.13, m.s(3, 2), m.s(9));
    colocar(perna, x, 0.2, 0); m.add(perna, pele ? PELE : calca, osso);
    if (meia !== null) { const mm = new THREE.CylinderGeometry(0.05, 0.05, 0.07, m.s(10)); colocar(mm, x, 0.135, 0); m.add(mm, meia, osso, false); }
    const cano = new THREE.CylinderGeometry(0.062, 0.058, 0.08, m.s(10)); colocar(cano, x, 0.085, 0); m.add(cano, bota, osso);
    const pe = new THREE.SphereGeometry(0.07, m.s(10), m.s(8)); colocar(pe, x, 0.045, 0.03, [0.95, 0.68, 1.35]); m.add(pe, bota, osso);
    const sola = new THREE.CylinderGeometry(0.066, 0.066, 0.018, m.s(10)); colocar(sola, x, 0.009, 0.03, [1, 1, 1.4]); m.add(sola, solado, osso, false);
  }
}

// ---------------------------------------------------------------- P1: menino aventureiro
function montarP1(m: Montador) {
  const pal = PALETA.P1;
  const camisa = 0xefdcb4, colete = 0x8a5230, coleteEsc = 0x6a3c22, calca = 0x9a8460, cinto = 0x4a2a18, dourado = 0xe0b050;
  const lenco = 0xd8342c, lencoEsc = 0xa82020, couro = 0x7a4626, couroClaro = 0xa8673a;
  cabecaComum(m, pal);
  // tronco: camisa creme + colete marrom aberto na frente
  const pts = [[0.128, 0.29], [0.136, 0.34], [0.137, 0.42], [0.128, 0.49], [0.1, 0.53], [0.06, 0.548], [0.02, 0.552]]; // de baixo para cima: normais para fora
  const tr = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r - 0.008, y - 0.004)), m.s(14));
  tr.scale(1, 1, 0.88); m.add(tr, camisa, O.tronco);
  const ves = new THREE.LatheGeometry(pts.slice(0, -1).map(([r, y]) => new THREE.Vector2(r, y)), m.s(16), 0.5, Math.PI * 2 - 1.0);
  ves.scale(1, 1, 0.88); m.add(ves, colete, O.tronco);
  // bolsos do colete
  for (const s of [-1, 1]) { const b = new THREE.BoxGeometry(0.045, 0.035, 0.012); colocar(b, s * 0.085, 0.37, 0.108, 1, [0, s * 0.5, 0]); m.add(b, coleteEsc, O.tronco, false); }
  // quadril / calça e cinto
  const q = new THREE.CylinderGeometry(0.124, 0.13, 0.1, m.s(14)); colocar(q, 0, 0.29, 0, [1, 1, 0.86]); m.add(q, calca, O.quadril);
  const ci = new THREE.TorusGeometry(0.127, 0.017, m.s(5, 3), m.s(16)); colocar(ci, 0, 0.33, 0, [1, 0.86, 1], [Math.PI / 2, 0, 0]); ci.scale(1, 1, 0.86); m.add(ci, cinto, O.quadril, false);
  const fivela = new THREE.BoxGeometry(0.04, 0.032, 0.014); colocar(fivela, 0, 0.33, 0.112); m.add(fivela, dourado, O.quadril, false);
  // lenço vermelho: gola, nó na frente e duas pontas que esvoaçam (osso "cauda")
  const gola = new THREE.TorusGeometry(0.088, 0.04, m.s(7, 4), m.s(14)); colocar(gola, 0, 0.52, 0.005, 1, [Math.PI / 2 - 0.2, 0, 0]); m.add(gola, lenco, O.tronco);
  const no = new THREE.SphereGeometry(0.038, m.s(8), m.s(6)); colocar(no, 0.02, 0.49, 0.1); m.add(no, lencoEsc, O.tronco);
  const aba = new THREE.ConeGeometry(0.05, 0.09, m.s(6, 3)); colocar(aba, 0.03, 0.44, 0.105, [1, 1, 0.4], [0, 0, 0.25]); m.add(aba, lenco, O.tronco, false);
  for (const [dx, ang, comp] of [[-0.03, 0.18, 0.2], [0.035, -0.12, 0.16]] as const) {
    const p = new THREE.CapsuleGeometry(0.038, comp, m.s(3, 2), m.s(6));
    colocar(p, dx, 0.52 - comp / 2 - 0.03, -0.085, [1, 1, 0.38], [0.15, 0, ang]);
    m.add(p, lenco, O.cauda);
  }
  // mochila com rolo de coberta e alças
  const mo = new THREE.CapsuleGeometry(0.09, 0.07, m.s(4, 2), m.s(10)); colocar(mo, 0, 0.41, -0.165, [1.2, 1, 0.62]); m.add(mo, couro, O.tronco);
  const tampa = new THREE.SphereGeometry(0.1, m.s(10), m.s(6), 0, Math.PI * 2, 0, Math.PI / 2); colocar(tampa, 0, 0.46, -0.17, [1.1, 0.7, 0.66]); m.add(tampa, couroClaro, O.tronco, false);
  const rolo = new THREE.CapsuleGeometry(0.038, 0.17, m.s(3, 2), m.s(8)); colocar(rolo, 0, 0.525, -0.18, 1, [0, 0, Math.PI / 2]); m.add(rolo, 0x9a3a2a, O.tronco);
  for (const s of [-1, 1]) { const al = new THREE.TorusGeometry(0.11, 0.012, m.s(4, 3), m.s(10), Math.PI * 0.9); colocar(al, s * 0.075, 0.43, -0.03, [1, 1.05, 1], [0, Math.PI / 2, Math.PI / 2 + 0.2]); m.add(al, cinto, O.tronco, false); }
  bracos(m, camisa, colete, true);
  pernas(m, calca, false, null, 0x5a3420, 0x2e1a10);
  // cabelo castanho bagunçado: calota, volume na nuca, mechas espetadas e franja
  const cc = corCabelo(pal);
  const cal = new THREE.SphereGeometry(CAB.r * 1.08, m.s(18), m.s(9), 0, Math.PI * 2, 0, 1.28);
  colocar(cal, 0, CAB.y + 0.012, -0.012, [CAB.ex, CAB.ey, 1]); m.add(cal, cc, O.cabeca);
  const nuca = new THREE.SphereGeometry(0.25, m.s(14), m.s(10)); colocar(nuca, 0, CAB.y - 0.03, -0.065, [1.1, 0.98, 0.9]); m.add(nuca, cc, O.cabeca);
  for (const sx of [-1, 1]) { const lado = new THREE.SphereGeometry(0.13, m.s(10), m.s(8)); colocar(lado, sx * 0.2, CAB.y + 0.03, -0.035, [0.62, 1.05, 1.05]); m.add(lado, cc, O.cabeca); }
  const mechas: [number, number, number, number][] = [ // a, e, comprimento, raio
    [0, 1.25, 0.14, 0.07], [0.9, 1.0, 0.13, 0.065], [-0.9, 1.0, 0.13, 0.065], [2.2, 0.9, 0.14, 0.07], [-2.2, 0.9, 0.14, 0.07],
    [3.14, 0.75, 0.13, 0.07], [1.6, 0.55, 0.12, 0.06], [-1.6, 0.55, 0.12, 0.06], [2.6, 0.3, 0.12, 0.06], [-2.6, 0.3, 0.12, 0.06],
    [0.45, 1.15, 0.12, 0.06], [-0.5, 1.12, 0.12, 0.06], [3.14, 0.25, 0.12, 0.065],
  ];
  for (const [a, e, c, r] of mechas) {
    const d = dirCab(a, e);
    const eixo = d.clone().add(new THREE.Vector3(Math.sin(a * 3) * 0.3, 0.25, -0.35)).normalize();
    const g = new THREE.ConeGeometry(r * 1.2, c * 0.85, m.s(6, 4)); g.translate(0, c * 0.4, 0);
    m.add(apontar(g, naCabeca(d, 0.97), eixo, [1, 1, 0.7]), cc, O.cabeca);
  }
  // franja: mechas caindo para a frente e para baixo sobre a testa
  for (const [a, e, c] of [[-0.42, 0.62, 0.13], [-0.16, 0.7, 0.15], [0.12, 0.7, 0.14], [0.38, 0.64, 0.13], [0.62, 0.5, 0.11], [-0.66, 0.5, 0.11]] as const) {
    const d = dirCab(a, e);
    const eixo = new THREE.Vector3(d.x * 0.5 + a * 0.3, -0.85, 0.55);
    const g = new THREE.ConeGeometry(0.06, c, m.s(6, 4)); g.translate(0, c / 2, 0);
    m.add(apontar(g, naCabeca(d, 1.0), eixo, [1, 1, 0.55]), cc, O.cabeca);
  }
  // óculos de aviador na testa: tira + duas lentes turquesa com aro de latão
  const tira = new THREE.TorusGeometry(CAB.r * 1.1, 0.018, m.s(5, 3), m.s(20));
  tira.rotateX(Math.PI / 2); tira.scale(CAB.ex, 1, 1); tira.rotateX(-0.62); tira.translate(0, CAB.y + 0.03, -0.01);
  m.add(tira, 0x5a3a22, O.cabeca, false);
  for (const s of [-1, 1]) {
    const d = dirCab(s * 0.3, 0.72), p = naCabeca(d, 1.13);
    const aro = new THREE.TorusGeometry(0.052, 0.017, m.s(6, 3), m.s(14)); aro.rotateX(Math.PI / 2);
    m.add(apontar(aro, p, d), 0xc8963c, O.cabeca);
    const lente = new THREE.CylinderGeometry(0.046, 0.046, 0.02, m.s(14));
    m.add(apontar(lente, p.clone().addScaledVector(d, 0.006), d), (_p, n, c) => c.setHex(n.dot(d) > 0.5 ? 0x7fe0e8 : 0x3a8a9a), O.cabeca, false);
  }
}

// ---------------------------------------------------------------- P2: menina de coquinhos e casaco roxo
function montarP2(m: Montador) {
  const pal = PALETA.P2;
  const roxo = 0x9c74e4, roxoEsc = 0x8460d0, lilas = 0xbfa2ea, dourado = 0xf0c050, amarelo = 0xf6dc8a, rosa = 0xf07aa8;
  cabecaComum(m, pal);
  // vestido/casaco roxo em sino, com barra e faixa douradas
  const perfil = [[0.05, 0.56], [0.095, 0.535], [0.118, 0.48], [0.112, 0.43], [0.13, 0.37], [0.16, 0.3], [0.182, 0.25], [0.186, 0.232], [0.15, 0.226]].reverse().map( // de baixo para cima: normais para fora
    ([r, y]) => new THREE.Vector2(r, y));
  const vest = new THREE.LatheGeometry(perfil, m.s(18)); vest.scale(1, 1, 0.9);
  m.add(vest, (p, _n, c) => c.setHex(p.y > 0.43 ? roxo : roxoEsc), O.tronco);
  const barra = new THREE.TorusGeometry(0.184, 0.013, m.s(5, 3), m.s(20)); barra.rotateX(Math.PI / 2); barra.scale(1, 1, 0.9); barra.translate(0, 0.236, 0); m.add(barra, dourado, O.tronco, false);
  const faixa = new THREE.TorusGeometry(0.114, 0.016, m.s(5, 3), m.s(16)); faixa.rotateX(Math.PI / 2); faixa.scale(1, 1, 0.9); faixa.translate(0, 0.43, 0); m.add(faixa, dourado, O.tronco, false);
  // abertura da frente: blusa amarela, botões e a estrela dourada (símbolo da capa)
  const blusa = new THREE.SphereGeometry(0.05, m.s(8), m.s(6)); colocar(blusa, 0, 0.495, 0.088, [1, 1.1, 0.5]); m.add(blusa, amarelo, O.tronco, false);
  for (const y of [0.4, 0.35]) { const b = new THREE.SphereGeometry(0.014, 6, 4); colocar(b, 0, y, 0.112 + (0.4 - y) * 0.5); m.add(b, dourado, O.tronco, false); }
  const est = new THREE.OctahedronGeometry(0.03, 0); colocar(est, 0, 0.465, 0.11, [1, 1.3, 0.5]); m.add(est, dourado, O.tronco, false);
  // capuz caído atrás do pescoço e aba do casaco (osso "cauda") que balança
  const capuz = new THREE.TorusGeometry(0.09, 0.042, m.s(6, 4), m.s(14)); colocar(capuz, 0, 0.53, -0.025, [1.1, 1, 1], [Math.PI / 2 + 0.35, 0, 0]); m.add(capuz, lilas, O.tronco);
  const aba = new THREE.SphereGeometry(0.11, m.s(10), m.s(8)); colocar(aba, 0, 0.36, -0.12, [1.05, 1.4, 0.35]); m.add(aba, roxoEsc, O.cauda);
  // bolsinha a tiracolo
  const bol = new THREE.SphereGeometry(0.05, m.s(8), m.s(6)); colocar(bol, 0.15, 0.32, 0.03, [0.7, 0.9, 0.5]); m.add(bol, 0xa0603a, O.quadril, false);
  bracos(m, roxo, dourado, false);
  pernas(m, roxoEsc, true, lilas, 0x7a4a2a, 0x3a2016);
  // cabelo escuro: calota, volume até a nuca, mechas laterais, franja e dois coquinhos com laço rosa
  const cc = corCabelo(pal);
  const cal = new THREE.SphereGeometry(CAB.r * 1.07, m.s(18), m.s(9), 0, Math.PI * 2, 0, 1.3);
  colocar(cal, 0, CAB.y + 0.01, -0.01, [CAB.ex, CAB.ey, 1]); m.add(cal, cc, O.cabeca);
  const nuca = new THREE.SphereGeometry(0.25, m.s(14), m.s(10)); colocar(nuca, 0, CAB.y - 0.06, -0.07, [1.1, 1.04, 0.9]); m.add(nuca, cc, O.cabeca);
  for (const s of [-1, 1]) {
    const lado = new THREE.CapsuleGeometry(0.06, 0.15, m.s(3, 2), m.s(8)); colocar(lado, s * 0.225, CAB.y - 0.08, 0.0, [0.75, 1, 0.9], [0.05, 0, s * 0.05]); m.add(lado, cc, O.cabeca);
    const pt = new THREE.ConeGeometry(0.045, 0.09, m.s(6, 4)); colocar(pt, s * 0.23, CAB.y - 0.21, 0.01, [0.9, 1, 0.8], [Math.PI, 0, -s * 0.1]); m.add(pt, cc, O.cabeca, false);
    const coque = new THREE.SphereGeometry(0.085, m.s(12), m.s(9)); colocar(coque, s * 0.15, CAB.y + 0.225, -0.01); m.add(coque, cc, O.cabeca);
    const laco = new THREE.TorusGeometry(0.068, 0.024, m.s(5, 3), m.s(12)); colocar(laco, s * 0.135, CAB.y + 0.18, 0.0, 1, [Math.PI / 2 - 0.3, 0, -s * 0.55]); m.add(laco, rosa, O.cabeca, false);
    const brinco = new THREE.SphereGeometry(0.018, 6, 4); colocar(brinco, s * 0.262, CAB.y - 0.085, 0.01); m.add(brinco, dourado, O.cabeca, false);
  }
  // franja: mechas largas e achatadas sobre a testa
  for (const [a, e, w] of [[-0.5, 0.5, 0.085], [-0.18, 0.58, 0.095], [0.16, 0.58, 0.095], [0.48, 0.5, 0.085], [0.0, 0.72, 0.11]] as const) {
    const d = dirCab(a, e);
    const g = new THREE.SphereGeometry(1, m.s(10), m.s(8));
    m.add(apontar(g, naCabeca(d, 0.97), d, [w, 0.05, 0.1]), cc, O.cabeca);
  }
  // flor rosa no cabelo (como na capa)
  const flor = new THREE.SphereGeometry(0.035, m.s(8), m.s(6)); m.add(apontar(flor, naCabeca(dirCab(-1.0, 0.55), 1.12), dirCab(-1.0, 0.55), [1.4, 0.5, 1.4]), rosa, O.cabeca, false);
}

// ---------------------------------------------------------------- rosto (canvas)
const QUADROS = 4; // 0 normal · 1 piscando · 2 alegre/esforço · 3 surpresa
const ROSTO = { a: 0.66, t0: 1.02, t1: 2.3 }; // calota: ±a em torno da frente; theta (a partir do topo) de t0 a t1

function texturaRosto(pal: Paleta): THREE.CanvasTexture {
  const T = 256;
  const c = document.createElement('canvas'); c.width = T * QUADROS; c.height = T;
  const g = c.getContext('2d')!;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  // posição na calota → pixel (u ao longo do giro, v de cima para baixo)
  const px = (a: number) => ((a + ROSTO.a) / (2 * ROSTO.a)) * T;
  const py = (theta: number) => ((theta - ROSTO.t0) / (ROSTO.t1 - ROSTO.t0)) * T;
  const olhoY = py(Math.PI / 2 + 0.12), olhoX = [px(-0.3), px(0.3)];
  const OW = 36, OH = 50;
  for (let f = 0; f < QUADROS; f++) {
    g.save(); g.translate(f * T, 0);
    g.fillStyle = hex(PELE); g.fillRect(0, 0, T, T);
    // bochechas rosadas
    for (const x of olhoX) {
      const gr = g.createRadialGradient(x + (x < T / 2 ? -10 : 10), olhoY + 52, 2, x + (x < T / 2 ? -10 : 10), olhoY + 52, 30);
      gr.addColorStop(0, 'rgba(250,120,130,0.75)'); gr.addColorStop(1, 'rgba(250,120,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, T, T);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    // sobrancelhas
    g.strokeStyle = hex(pal.sobrancelha); g.lineWidth = 7;
    for (const [k, x] of olhoX.entries()) {
      const s = k === 0 ? -1 : 1, lev = f === 3 ? -14 : f === 2 ? 4 : 0;
      g.beginPath(); g.moveTo(x - s * 18, olhoY - OH - 6 + lev); g.quadraticCurveTo(x, olhoY - OH - 16 + lev, x + s * 20, olhoY - OH - 4 + lev + (f === 2 ? 6 : 0)); g.stroke();
    }
    for (const [k, x] of olhoX.entries()) {
      const s = k === 0 ? -1 : 1;
      if (f === 1 || f === 2) {
        // fechado (piscar) ou "^ ^" (alegre/esforço)
        g.strokeStyle = '#2a1414'; g.lineWidth = 8; g.beginPath();
        if (f === 1) { g.moveTo(x - OW + 4, olhoY + 4); g.quadraticCurveTo(x, olhoY + 16, x + OW - 4, olhoY + 4); }
        else { g.moveTo(x - OW + 6, olhoY + 8); g.quadraticCurveTo(x, olhoY - 22, x + OW - 6, olhoY + 8); }
        g.stroke();
        if (pal.cilios) { g.beginPath(); g.moveTo(x + s * (OW - 4), olhoY + (f === 1 ? 4 : 8)); g.lineTo(x + s * (OW + 6), olhoY + (f === 1 ? -2 : 2)); g.stroke(); }
        continue;
      }
      const esc = f === 3 ? 1.08 : 1;
      const w = OW * esc, h = OH * esc;
      // branco do olho, íris com degradê, pupila e brilhos grandes (olhar de anime)
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, olhoY, w, h, 0, 0, Math.PI * 2); g.fill();
      const ir = g.createLinearGradient(0, olhoY - h, 0, olhoY + h);
      ir.addColorStop(0, '#1a0c10'); ir.addColorStop(0.45, hex(pal.olho)); ir.addColorStop(1, hex(pal.olhoLuz));
      g.fillStyle = ir; g.beginPath(); g.ellipse(x + s * 2, olhoY + 3, w * 0.82, h * 0.9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#140a0c'; g.beginPath(); g.ellipse(x + s * 2, olhoY + 2, w * 0.4, h * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(x - 9 + s * 2, olhoY - 13, 10, 13, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 10 + s * 2, olhoY + 16, 5, 6, 0, 0, Math.PI * 2); g.fill();
      // pálpebra superior grossa (e cílios na P2)
      g.strokeStyle = '#2a1414'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(x, olhoY, w, h, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      if (pal.cilios) { g.lineWidth = 7; g.beginPath(); g.moveTo(x + s * w * 0.85, olhoY - h * 0.55); g.lineTo(x + s * (w + 12), olhoY - h * 0.8); g.stroke(); }
    }
    // nariz e boca
    g.fillStyle = 'rgba(200,110,90,0.7)'; g.beginPath(); g.ellipse(T / 2, olhoY + 34, 4, 3, 0, 0, Math.PI * 2); g.fill();
    const by = olhoY + 56;
    g.strokeStyle = '#7a2a28'; g.fillStyle = '#9a3036'; g.lineWidth = 6;
    if (f === 0 || f === 1) { g.beginPath(); g.moveTo(T / 2 - 14, by - 3); g.quadraticCurveTo(T / 2, by + 10, T / 2 + 14, by - 3); g.stroke(); }
    else if (f === 2) {
      g.beginPath(); g.moveTo(T / 2 - 20, by - 6); g.quadraticCurveTo(T / 2, by + 26, T / 2 + 20, by - 6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f08a90'; g.beginPath(); g.ellipse(T / 2, by + 8, 9, 5, 0, 0, Math.PI * 2); g.fill();
    } else { g.beginPath(); g.ellipse(T / 2, by + 4, 9, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / QUADROS, 1);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------- materiais
let gradiente: THREE.DataTexture | null = null;
function gradienteToon() {
  if (gradiente) return gradiente;
  gradiente = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  gradiente.minFilter = gradiente.magFilter = THREE.LinearFilter;
  gradiente.needsUpdate = true;
  return gradiente;
}

/** Toon de 3 tons + luz de borda quente (separa o personagem do fundo) + brilho dourado quando recebe impulso. */
function materialPele(map: THREE.Texture | null, uBorda: { value: THREE.Color }, uForca: { value: number }) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: !map, map, gradientMap: gradienteToon() });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBorda = uBorda; sh.uniforms.uForcaBorda = uForca;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBorda; uniform float uForcaBorda;')
      .replace('#include <opaque_fragment>', `{
  float fr = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
  outgoingLight += uBorda * uForcaBorda * smoothstep(0.55 - uForcaBorda * 0.08, 0.95, fr) * (0.6 + 0.4 * normal.y);
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'edm-pers';
  return mat;
}

function materialContorno(cor: number) {
  const mat = new THREE.MeshBasicMaterial({ color: cor, side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * 0.0135;');
  };
  mat.customProgramCacheKey = () => 'edm-contorno';
  return mat;
}

/** Nomes nos rótulos sobre a cabeça. */
export const NOMES: Record<QualPersonagem, string> = { P1: 'Natan', P2: 'Bruna' };

function rotulo(texto: string, cor: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.font = 'bold 54px system-ui, sans-serif'; g.textAlign = 'center';
  g.lineWidth = 10; g.strokeStyle = 'rgba(30,14,50,0.85)'; g.lineJoin = 'round';
  g.strokeText(texto, 128, 64);
  g.fillStyle = cor; g.fillText(texto, 128, 64);
  g.beginPath(); g.moveTo(110, 80); g.lineTo(146, 80); g.lineTo(128, 110); g.closePath(); g.stroke(); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(0.9, 0.45, 1); sp.position.y = 1.45; sp.renderOrder = 10;
  return sp;
}

// ---------------------------------------------------------------- animação
const amortecer = (atual: number, alvo: number, k: number) => atual + (alvo - atual) * k;
const elastico = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 12));

export function criarPersonagem(qual: QualPersonagem, q: Qualidade): Personagem {
  const pal = PALETA[qual];
  const raiz = new THREE.Group();
  raiz.name = `personagem-${qual}`;
  const giro = new THREE.Group(); giro.position.y = 0.55; raiz.add(giro); // pivô no meio do corpo (mortal do superpulo)
  const corpo = new THREE.Group(); corpo.position.y = -0.55; giro.add(corpo);

  const ossos = OSSOS.map(() => new THREE.Bone());
  OSSOS.forEach((o, k) => {
    const b = ossos[k];
    const pp = o.pai >= 0 ? OSSOS[o.pai].pos : [0, 0, 0];
    b.position.set(o.pos[0] - pp[0], o.pos[1] - pp[1], o.pos[2] - pp[2]);
    if (o.pai >= 0) ossos[o.pai].add(b);
  });
  const esqueleto = new THREE.Skeleton(ossos);

  const mont = new Montador(0.8);
  (qual === 'P1' ? montarP1 : montarP2)(mont);
  const geo = mont.juntar(false);
  const bordaBase = new THREE.Color(qual === 'P1' ? 0xffc890 : 0xffb8f0), bordaOuro = new THREE.Color(0xffd040);
  const uBorda = { value: bordaBase.clone() }, uForca = { value: 0.55 };
  const matCorpo = materialPele(null, uBorda, uForca);
  const malha = new THREE.SkinnedMesh(geo, matCorpo);
  malha.add(ossos[0]);
  malha.castShadow = q === 'baixa' ? false : false; // a sombra sai do contorno (menos triângulos)
  malha.frustumCulled = false;
  corpo.add(malha);
  corpo.updateMatrixWorld(true);
  malha.bind(esqueleto);
  if (q !== 'baixa') {
    // contorno: mesma silhueta sem as miudezas, com menos segmentos
    const mc = new Montador(0.5);
    (qual === 'P1' ? montarP1 : montarP2)(mc);
    const cont = new THREE.SkinnedMesh(mc.juntar(true), materialContorno(qual === 'P1' ? 0x2a140c : 0x22103a));
    for (const p of mc.pecas) p.g.dispose();
    cont.frustumCulled = false;
    cont.castShadow = q === 'alta';
    corpo.add(cont);
    cont.bind(esqueleto, malha.bindMatrix);
  }
  for (const p of mont.pecas) p.g.dispose();

  // rosto: calota ligeiramente maior que a cabeça, presa ao osso da cabeça
  const texRosto = texturaRosto(pal);
  const geoRosto = new THREE.SphereGeometry(CAB.r + 0.0025, 16, 12, Math.PI / 2 - ROSTO.a, 2 * ROSTO.a, ROSTO.t0, ROSTO.t1 - ROSTO.t0);
  // na esfera do three, phi = π/2 é +z e o u cresce de x negativo para x positivo (esquerda → direita de quem olha)
  geoRosto.scale(CAB.ex, CAB.ey, 1);
  geoRosto.translate(0, CAB.y - OSSOS[O.cabeca].pos[1], 0);
  geoRosto.computeVertexNormals();
  const rosto = new THREE.Mesh(geoRosto, materialPele(texRosto, uBorda, uForca));
  rosto.frustumCulled = false;
  ossos[O.cabeca].add(rosto);

  const placa = rotulo(NOMES[qual], qual === 'P1' ? '#ff5a4e' : '#5aa8ff');
  raiz.add(placa);

  // arma na mão (L4, armas.ts: material do mundo, o mesmo programa das peças fixas: não compila no 1º tiro, R38)
  // e a bolha de quem ficou sem corações
  const item = criarItemNaMao(q);
  ossos[O.bracoD].add(item.malha);
  const bolha = new THREE.Mesh(new THREE.SphereGeometry(0.64, 24, 16), materialBolha(qual === 'P1' ? 0xffc8b0 : 0xd8c0ff));
  bolha.position.y = 0.55; bolha.renderOrder = 8; bolha.visible = false;
  raiz.add(bolha);

  // estado da animação
  const st = { fase: 0, achatar: 0, salta: 0, pisca: 2 + Math.random() * 2, piscando: 0, maos: 0, recebe: 0, superpulo: 0, caiu: 0, yaw: 0, iniciou: false, tiro: 0, golpe: 0, troca: 0, dano: 0, inclina: 0, bolha: 0 };
  const [quadril, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, cauda] = ossos;

  return {
    raiz,
    atualizar(j, outro, dt, eventos, i, relogio, corda) {
      raiz.position.set(j.x, j.y, 0);
      for (const ev of eventos) {
        if (ev === `pouso:${i}`) st.achatar = 1;
        else if (ev === `pulo:${i}`) st.salta = 1;
        else if (ev === `maos:${i}`) st.maos = 0.6;
        else if (ev === `superpulo:${i}`) st.superpulo = 0.75;
        else if (ev === `caiu:${i}` || ev === `renasce:${i}`) st.caiu = 0.9;
        else if (ev.startsWith(`tiro:${i}:`)) st.tiro = 0.4;
        else if (ev.startsWith(`golpe:${i}:`) || ev === `martelada:${i}`) st.golpe = 0.3;
        else if (ev.startsWith(`troca:${i}:`) || ev.startsWith(`mochila:${i}:`) || ev.startsWith(`bau:`) && ev.split(':')[2] === `${i}`) st.troca = 0.6;
        else if (ev === `dano:${i}`) st.dano = 0.5;
      }
      st.tiro = Math.max(0, st.tiro - dt);
      st.golpe = Math.max(0, st.golpe - dt);
      st.troca = Math.max(0, st.troca - dt);
      st.dano = Math.max(0, st.dano - dt);
      st.bolha = j.bolha ? Math.min(1, st.bolha + dt * 4) : Math.max(0, st.bolha - dt * 6);
      const naCorda = !j.bolha && (j.pendurado || j.argola >= 0);
      const segurando = !j.bolha && j.segurando && !naCorda;
      // squash & stretch (PESQUISA_ARTE_CAMERA.md plano #9): 0,85 no pouso e 1,15 na saída do pulo, por ~110 ms
      st.achatar = Math.max(0, st.achatar - dt * 9);
      st.salta = Math.max(0, st.salta - dt * 9);
      st.maos = Math.max(0, st.maos - dt);
      st.superpulo = Math.max(0, st.superpulo - dt);
      st.caiu = Math.max(0, st.caiu - dt);
      st.recebe = j.impulso > 0 ? Math.min(1, st.recebe + dt * 8) : Math.max(0, st.recebe - dt * 4);
      const k = 1 - Math.exp(-dt * 16);
      const vel = Math.min(1.3, Math.abs(j.vx) / FISICA.velAndar);
      const andando = j.noChao && vel > 0.05;

      // para onde olha: de frente-três-quartos parado, mais de perfil correndo; vira para o parceiro ao dar a mão
      let lado: number = j.olhando;
      if ((st.maos > 0 || segurando) && Math.abs(outro.x - j.x) > 0.05) lado = Math.sign(outro.x - j.x);
      let alvoYaw = lado * (Math.PI / 2) * (st.maos > 0 ? 0.55 : 0.38 + 0.34 * Math.min(1, vel));
      if (st.tiro > 0 || st.golpe > 0) alvoYaw = lado * (Math.PI / 2) * 0.8; // de perfil, mirando ou golpeando
      if (segurando) alvoYaw = lado * (Math.PI / 2) * 0.7;
      if (naCorda) alvoYaw = lado * 0.35;
      if (j.bolha) alvoYaw = Math.sin(relogio * 0.9 + i) * 0.6;
      if (!st.iniciou) { st.yaw = alvoYaw; st.iniciou = true; }
      st.yaw += (alvoYaw - st.yaw) * Math.min(1, dt * 10);
      raiz.rotation.y = st.yaw + (st.caiu > 0 ? (st.caiu / 0.9) ** 2 * Math.PI * 4 : 0);

      // ciclo de passada
      if (j.noChao) st.fase += dt * 11 * vel;
      const s = Math.sin(st.fase), respira = Math.sin(relogio * 2.4 + i * 1.7);
      let pE = 0, pD = 0, bEx = 0, bDx = 0, bEz = -0.12 - respira * 0.03, bDz = 0.12 + respira * 0.03;
      let incl = 0, cabX = 0, cabZ = Math.sin(relogio * 0.9 + i) * 0.05, caudaX = 0.15 + Math.sin(relogio * 2 + i) * 0.05;
      let quadY = 0;
      if (j.noChao) {
        pE = -s * 0.85 * vel; pD = s * 0.85 * vel;
        bEx = s * 0.9 * vel; bDx = -s * 0.9 * vel;
        bEz -= 0.1 * vel; bDz += 0.1 * vel;
        incl = 0.14 * vel; cabX = -0.06 * vel;
        quadY = andando ? Math.abs(Math.cos(st.fase)) * 0.035 * vel : 0;
        caudaX += 0.5 * vel + Math.sin(relogio * 11) * 0.12 * vel;
      } else if (j.vy > 0) { // subindo: uma perna dobrada à frente, um braço para o alto
        pE = -0.95; pD = 0.35; bDx = -2.5; bEx = 0.55; bEz = -0.35; bDz = 0.25; incl = 0.08; cabX = -0.15; caudaX = 0.9;
      } else { // caindo: braços abertos para cima, pernas soltas
        pE = -0.35; pD = 0.3; bEz = -1.9 - Math.sin(relogio * 14) * 0.15; bDz = 1.9 + Math.sin(relogio * 14 + 1) * 0.15; bEx = -0.2; bDx = -0.2; incl = -0.05; cabX = 0.1; caudaX = 1.4;
      }
      if (st.recebe > 0 && j.noChao) { // pronto para o superpulo: agacha e leva os braços para trás
        const r = st.recebe;
        bEx = amortecer(bEx, 0.7, r); bDx = amortecer(bDx, 0.7, r); incl = amortecer(incl, 0.28, r); cabX = amortecer(cabX, -0.25, r);
      }
      if (st.maos > 0) { // dá a mão: estica os braços para o parceiro (puxa para cima se ele estiver embaixo)
        const embaixo = outro.y < j.y - 0.5;
        const t = Math.min(1, (0.6 - st.maos) * 8);
        bEx = amortecer(bEx, embaixo ? -0.9 : -1.45, t); bDx = amortecer(bDx, embaixo ? -0.9 : -1.6, t);
        bEz = amortecer(bEz, 0.15, t); bDz = amortecer(bDz, -0.15, t);
        incl = amortecer(incl, embaixo ? 0.55 : 0.12, t); cabX = amortecer(cabX, embaixo ? 0.25 : 0, t);
        pE = amortecer(pE, embaixo ? 0.3 : 0.25, t); pD = amortecer(pD, embaixo ? -0.15 : -0.3, t);
      }
      if (st.superpulo > 0) { // superpulo: estrela com os braços para o alto e mortal para a frente
        bEz = -2.6; bDz = 2.6; bEx = 0; bDx = 0; pE = -1.0; pD = -0.7; caudaX = 1.6;
      }
      if (naCorda) { // pendurado: as duas mãos na corda acima da cabeça, pernas soltas balançando
        const bal = Math.max(-0.5, Math.min(0.5, -j.vx * 0.08));
        bEz = -2.75; bDz = 2.75; bEx = -0.2; bDx = -0.2;
        pE = 0.25 + bal + Math.sin(relogio * 2.2 + i) * 0.12; pD = -0.15 + bal - Math.sin(relogio * 2.2 + i) * 0.12;
        incl = -0.05; cabX = -0.22; caudaX = 0.5 + Math.abs(j.vx) * 0.1; quadY = 0;
      } else if (segurando) { // segurando a corda: inclinado para trás, braços à frente, pés firmes
        bEx = -1.3; bDx = -1.3; bEz = 0.22; bDz = -0.22; incl = -0.32; cabX = 0.12; pE = 0.55; pD = -0.35; quadY = -0.02;
      }
      if (j.bolha) { // encolhido dentro da bolha
        pE = -1.3; pD = -1.15; bEx = -0.95; bDx = -0.95; bEz = 0.35; bDz = -0.35; incl = 0.35; cabX = 0.2; caudaX = 0.3; quadY = 0;
      }
      if (st.golpe > 0 && !j.bolha) { // golpe: o braço do lado da câmera vem de cima (atrás da cabeça) para a frente
        const t = 1 - st.golpe / 0.3, b = -2.9 + 2.3 * Math.min(1, t * 1.6);
        if (lado > 0) { bEx = b; bEz = -0.1; } else { bDx = b; bDz = 0.1; }
        incl += 0.08 * Math.sin(t * Math.PI);
      } else if (st.tiro > 0 && !j.bolha) { // atirando: braço do lado da câmera esticado para a frente com o Estilingue
        const t = Math.min(1, (0.4 - st.tiro) * 14);
        if (lado > 0) { bEx = amortecer(bEx, -1.5, t); bEz = amortecer(bEz, -0.05, t); }
        else { bDx = amortecer(bDx, -1.5, t); bDz = amortecer(bDz, 0.05, t); }
        incl += 0.04;
      }
      pernaE.rotation.x = amortecer(pernaE.rotation.x, pE, k);
      pernaD.rotation.x = amortecer(pernaD.rotation.x, pD, k);
      bracoE.rotation.x = amortecer(bracoE.rotation.x, bEx, k);
      bracoD.rotation.x = amortecer(bracoD.rotation.x, bDx, k);
      bracoE.rotation.z = amortecer(bracoE.rotation.z, bEz, k);
      bracoD.rotation.z = amortecer(bracoD.rotation.z, bDz, k);
      tronco.rotation.x = amortecer(tronco.rotation.x, incl, k);
      cabeca.rotation.x = amortecer(cabeca.rotation.x, cabX, k);
      cabeca.rotation.z = amortecer(cabeca.rotation.z, cabZ, k);
      cauda.rotation.x = amortecer(cauda.rotation.x, caudaX, k * 0.6);
      quadril.position.y = OSSOS[0].pos[1] + quadY;
      tronco.scale.set(1, 1 + respira * 0.018, 1);

      // mortal do superpulo
      giro.rotation.x = st.superpulo > 0 ? (1 - st.superpulo / 0.75) * Math.PI * 2 : 0;
      // pendurado: o corpo acompanha a direção da corda (pêndulo)
      let alvoInc = 0;
      if (naCorda && corda) alvoInc = inclinacaoCorda(j, corda);
      st.inclina += (alvoInc - st.inclina) * Math.min(1, dt * 10);
      giro.rotation.z = st.inclina;

      // arma na mão do lado da câmera: aparece atacando ou logo depois de trocar
      const mao = lado > 0 ? bracoE : bracoD;
      const ar = j.arsenal;
      const mostra = Math.max(st.tiro, st.golpe, st.troca);
      if (mostra > 0 && !j.bolha && !naCorda && ar) {
        if (item.malha.parent !== mao) { mao.add(item.malha); item.malha.position.set(lado > 0 ? -0.027 : 0.027, -0.17, 0.012); }
        item.mostrar(ar.itens[ar.atual] ?? -1);
        item.malha.scale.setScalar(Math.min(1, mostra * 6 + 0.2));
      } else item.malha.visible = false;

      // bolha: flutua, balança devagar; piscar de invencível
      bolha.visible = st.bolha > 0;
      if (bolha.visible) {
        const b = 0.4 + 0.6 * elastico(st.bolha);
        bolha.scale.set(b * (1 + Math.sin(relogio * 4) * 0.03), b * (1 + Math.sin(relogio * 4 + 1.6) * 0.04), b);
        raiz.position.y += Math.sin(relogio * 2.4 + i) * 0.06;
      }
      corpo.visible = !(j.invencivel > 0 && !j.bolha && Math.floor(relogio * 14) % 2 === 1);
      if (st.dano > 0) raiz.position.x += Math.sin(relogio * 60) * 0.03 * st.dano;
      // achatar no pouso, esticar no ar, agachar quando pronto para o impulso; "pop" ao reaparecer depois de cair
      let estica = j.noChao ? 1 - st.achatar * 0.15 - st.recebe * 0.08 : 1 + Math.max(Math.min(0.1, Math.abs(j.vy) * 0.008), st.salta * 0.15);
      if (st.maos > 0 && j.noChao) estica *= 1 - Math.sin((st.maos / 0.6) * Math.PI) * 0.06;
      const pop = (st.caiu > 0 ? 0.25 + 0.75 * elastico(1 - st.caiu / 0.9) : 1) * (1 - st.bolha * 0.18);
      const lat = 1 / Math.sqrt(estica);
      corpo.scale.set(lat * pop, estica * pop, lat * pop);

      // brilho dourado enquanto tem o impulso do parceiro
      const ouro = st.recebe * (0.75 + 0.25 * Math.sin(relogio * 18));
      uBorda.value.copy(bordaBase).lerp(bordaOuro, Math.min(1, ouro));
      uForca.value = 0.55 + ouro * 1.6;

      // expressão
      st.pisca -= dt;
      if (st.pisca <= 0) { st.piscando = 0.13; st.pisca = 1.8 + Math.random() * 3.2; }
      st.piscando = Math.max(0, st.piscando - dt);
      let quadro = 0;
      if (st.caiu > 0 || st.dano > 0 || (!j.noChao && j.vy < -13 && !naCorda)) quadro = 3;
      else if (j.bolha) quadro = 1;
      else if (st.maos > 0 || st.superpulo > 0 || st.recebe > 0.5) quadro = 2;
      else if (st.piscando > 0) quadro = 1;
      texRosto.offset.x = quadro / QUADROS;
    },
  };
}
