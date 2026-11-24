// Armas de brinquedo (L4): visual procedural, estilo desenho, nada militar.
// - Itens na mão (Estilingue de Xuxinha, Espada de Papelão, Martelo de Brinquedo): uma malha por personagem, a
//   geometria troca conforme a arma (≤ 1,5 mil triângulos cada; medido no teste). Só aparece atacando ou trocando.
// - Pedrinhas do Estilingue (e confeitos): um InstancedMesh só, com o mesmo programa das estrelinhas.
// - Elementos de fase: alvo-sino (balança e brilha ao ser tocado), barbante com pacote (cai ao ser cortado), bloco
//   rachado (some em cacos de brilho), baú (a tampa abre) e as miçangas soltas (contas coloridas).
// Material: o do mundo sem ruído (o mesmo programa das peças fixas de elementos.ts): nada compila no meio da fase.
// Chamadas: pedrinhas 1 (só com pedrinha no ar), item na mão 1 por personagem (só atacando), cada elemento na tela 1–2.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEM } from '../core/arsenal';
import type { Estado, Fase } from '../core/types';
import type { Qualidade } from './cena';
import { materialMundo } from './materiais';
import { colocar, pintar } from './util';
import { Cel, type Particulas } from './particulas';

const PAPELAO = 0xd2a46a, PAPELAO_ESCURO = 0x9a6e3e, FITA = 0x5ab0ff, MADEIRA = 0xa8743a, XUXINHA = 0xff6fae;
const VERMELHO = 0xff5a5a, AMARELO = 0xffd84a, AZUL = 0x4a8cff, OURO = 0xf2c24a, ROSA = 0xffa8d0;

const cil = (r0: number, r1: number, h: number, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg);

// ---------------------------------------------------------------- itens na mão
// Coordenadas do osso do braço: a mão fica em y ≈ −0,19 e o item cresce para −y (como o Lança-Estrelas antigo).
function geoEstilingue(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const cabo = cil(0.016, 0.02, 0.13); colocar(cabo, 0, -0.065, 0); p.push(pintar(cabo, MADEIRA));
  for (const s of [-1, 1]) {
    const braco = cil(0.012, 0.015, 0.1); colocar(braco, s * 0.03, -0.165, 0, 1, [0, 0, s * 0.55]); p.push(pintar(braco, MADEIRA));
    const ponta = new THREE.SphereGeometry(0.017, 6, 4); colocar(ponta, s * 0.058, -0.21, 0); p.push(pintar(ponta, XUXINHA));
  }
  // a xuxinha (elástico de cabelo) esticada entre as pontas, com o lacinho
  const elastico = new THREE.TorusGeometry(0.058, 0.009, 4, 12, Math.PI); colocar(elastico, 0, -0.21, 0, [1, 0.5, 1], [0, 0, Math.PI]); p.push(pintar(elastico, XUXINHA));
  for (const s of [-1, 1]) { const laco = new THREE.ConeGeometry(0.022, 0.04, 4); colocar(laco, s * 0.024, -0.06, 0.022, 1, [0, 0, s * Math.PI / 2]); p.push(pintar(laco, XUXINHA)); }
  const pedra = new THREE.IcosahedronGeometry(0.02, 0); colocar(pedra, 0, -0.24, 0); p.push(pintar(pedra, ROSA));
  return mergeGeometries(p)!;
}

function geoEspada(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const cabo = cil(0.018, 0.018, 0.1); colocar(cabo, 0, -0.05, 0); p.push(pintar(cabo, FITA));
  for (const y of [-0.025, -0.075]) { const fita = cil(0.021, 0.021, 0.012); colocar(fita, 0, y, 0); p.push(pintar(fita, 0xf0f0f0)); }
  const guarda = new THREE.BoxGeometry(0.15, 0.025, 0.035); colocar(guarda, 0, -0.105, 0); p.push(pintar(guarda, PAPELAO_ESCURO));
  // lâmina de papelão: chata, com a ponta e uma fita adesiva no meio
  const lamina = new THREE.BoxGeometry(0.06, 0.36, 0.014); colocar(lamina, 0, -0.3, 0);
  p.push(pintar(lamina, (pp, n, c) => c.setHex(Math.abs(n.z) > 0.5 ? (Math.floor((pp.y + 1) * 30) % 3 === 0 ? PAPELAO_ESCURO : PAPELAO) : PAPELAO_ESCURO)));
  const ponta = new THREE.ConeGeometry(0.043, 0.07, 4); colocar(ponta, 0, -0.515, 0, [1, 1, 0.33], [Math.PI, Math.PI / 4, 0]); p.push(pintar(ponta, PAPELAO));
  const fita = new THREE.BoxGeometry(0.064, 0.03, 0.017); colocar(fita, 0, -0.24, 0); p.push(pintar(fita, 0xc8d8e8));
  return mergeGeometries(p)!;
}

function geoMartelo(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const cabo = cil(0.02, 0.024, 0.3); colocar(cabo, 0, -0.15, 0); p.push(pintar(cabo, AZUL));
  const cabeca = cil(0.06, 0.06, 0.17, 12); colocar(cabeca, 0, -0.32, 0, 1, [0, 0, Math.PI / 2]); p.push(pintar(cabeca, VERMELHO));
  for (const s of [-1, 1]) { const tampa = cil(0.066, 0.066, 0.03, 12); colocar(tampa, s * 0.095, -0.32, 0, 1, [0, 0, Math.PI / 2]); p.push(pintar(tampa, AMARELO)); }
  const anel = new THREE.TorusGeometry(0.026, 0.008, 4, 10); colocar(anel, 0, -0.03, 0, 1, [Math.PI / 2, 0, 0]); p.push(pintar(anel, AMARELO));
  return mergeGeometries(p)!;
}

function geoConfeitos(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const tubo = cil(0.045, 0.035, 0.22, 10); colocar(tubo, 0, -0.2, 0.03, 1, [Math.PI / 2, 0, 0]); p.push(pintar(tubo, ROSA));
  const cabo = cil(0.018, 0.018, 0.1); colocar(cabo, 0, -0.07, 0); p.push(pintar(cabo, AZUL));
  return mergeGeometries(p)!;
}

let geosItens: Map<number, THREE.BufferGeometry> | null = null;
/** Geometrias dos itens na mão, por id (criadas uma vez). */
export function geometriasItens(): Map<number, THREE.BufferGeometry> {
  if (!geosItens) geosItens = new Map([[ITEM.estilingue, geoEstilingue()], [ITEM.espada, geoEspada()], [ITEM.martelo, geoMartelo()], [ITEM.confeitos, geoConfeitos()]]);
  return geosItens;
}

/** Item na mão de um personagem (o personagem prende no osso do braço e escolhe o id e a visibilidade). */
export function criarItemNaMao(q: Qualidade) {
  const geos = geometriasItens();
  const malha = new THREE.Mesh(geos.get(ITEM.estilingue), materialMundo(q, { ruido: false }));
  malha.visible = false;
  let atual: number = ITEM.estilingue;
  return {
    malha,
    mostrar(id: number) {
      const g = geos.get(id);
      if (!g) { malha.visible = false; return; }
      if (id !== atual) { malha.geometry = g; atual = id; }
      malha.visible = true;
    },
  };
}

// ---------------------------------------------------------------- elementos de fase
function geoSino(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  // corda até o teto (fora da tela), o sino e o badalo; argola de alvo em volta (vermelha e branca, de brinquedo)
  const corda = cil(0.012, 0.012, 3); colocar(corda, 0, 1.9, 0); p.push(pintar(corda, 0x7a5a3a));
  const sino = new THREE.LatheGeometry([0.02, 0.12, 0.17, 0.2, 0.26, 0.29].map((r, k) => new THREE.Vector2(r, 0.36 - k * 0.07)), 14);
  colocar(sino, 0, -0.18, 0); p.push(pintar(sino, (_p, n, c) => c.setHex(n.y > 0.3 ? 0xfff0a0 : OURO)));
  const badalo = new THREE.SphereGeometry(0.06, 8, 6); colocar(badalo, 0, -0.22, 0); p.push(pintar(badalo, VERMELHO));
  const alvo1 = new THREE.TorusGeometry(0.36, 0.035, 4, 20); colocar(alvo1, 0, 0, -0.05); p.push(pintar(alvo1, VERMELHO));
  const alvo2 = new THREE.TorusGeometry(0.43, 0.03, 4, 20); colocar(alvo2, 0, 0, -0.05); p.push(pintar(alvo2, 0xffffff));
  return mergeGeometries(p)!;
}
function geoPacote(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const caixa = new THREE.BoxGeometry(0.5, 0.42, 0.42); colocar(caixa, 0, -0.21, 0); p.push(pintar(caixa, (_p, n, c) => c.setHex(n.y > 0.5 ? 0xf7c8e0 : 0xff8ac0)));
  for (const r of [0, Math.PI / 2]) { const fita = new THREE.BoxGeometry(0.06, 0.43, 0.43); colocar(fita, 0, -0.21, 0, 1, [0, r, 0]); p.push(pintar(fita, AMARELO)); }
  const laco = new THREE.TorusGeometry(0.07, 0.025, 4, 8); colocar(laco, 0, 0.02, 0); p.push(pintar(laco, AMARELO));
  return mergeGeometries(p)!;
}
function geoRachado(w: number, h: number): THREE.BufferGeometry {
  // bloco de montar rachado (amarelo, com pinos em cima) e as rachaduras escuras na frente
  const p: THREE.BufferGeometry[] = [];
  const b = new THREE.BoxGeometry(w, h, 1.2, 2, 2, 1); colocar(b, w / 2, h / 2, 0);
  p.push(pintar(b, (_p, n, c) => c.setHex(n.y > 0.5 ? 0xffe27a : n.z > 0.5 ? 0xffc93a : 0xd89a20)));
  for (const x of [w * 0.28, w * 0.72]) for (const z of [-0.3, 0.3]) { const pino = cil(0.12, 0.12, 0.1, 10); colocar(pino, x, h + 0.05, z); p.push(pintar(pino, 0xffe27a)); }
  const rachas: [number, number, number, number][] = [[0.5, 0.7, 0.5, 0.35], [0.38, 0.5, 0.25, -0.6], [0.62, 0.48, 0.25, 0.7], [0.5, 0.25, 0.3, 0.2]];
  for (const [x, y, len, ang] of rachas) { const r = new THREE.BoxGeometry(0.035, len * h, 0.02); colocar(r, x * w, y * h, 0.61, 1, [0, 0, ang]); p.push(pintar(r, 0x3a2010)); }
  return mergeGeometries(p)!;
}
function geoBauBase(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  const caixa = new THREE.BoxGeometry(0.8, 0.45, 0.55); colocar(caixa, 0, 0.225, 0); p.push(pintar(caixa, (_p, n, c) => c.setHex(n.y > 0.5 ? 0x6a3a24 : 0xb86a3a)));
  for (const x of [-0.3, 0.3]) { const faixa = new THREE.BoxGeometry(0.07, 0.46, 0.56); colocar(faixa, x, 0.225, 0); p.push(pintar(faixa, OURO)); }
  return mergeGeometries(p)!;
}
function geoBauTampa(): THREE.BufferGeometry {
  // tampa arredondada, com a dobradiça em (0, 0, −0,275): gira em x
  const p: THREE.BufferGeometry[] = [];
  const t = new THREE.CylinderGeometry(0.275, 0.275, 0.8, 12, 1, false, 0, Math.PI); colocar(t, 0, 0, 0.275, 1, [0, 0, Math.PI / 2]); p.push(pintar(t, 0xc8783f));
  for (const x of [-0.3, 0.3]) { const f = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 12, 1, false, 0, Math.PI); colocar(f, x, 0, 0.275, 1, [0, 0, Math.PI / 2]); p.push(pintar(f, OURO)); }
  const fecho = new THREE.BoxGeometry(0.1, 0.12, 0.05); colocar(fecho, 0, -0.02, 0.56); p.push(pintar(fecho, OURO));
  return mergeGeometries(p)!;
}

interface VisSino { g: THREE.Mesh; ang: number; vang: number }
interface VisBarbante { corda: THREE.Mesh; pacote: THREE.Mesh; y: number; vy: number; caiu: boolean }

/** Pedrinhas, miçangas e elementos das armas (alvo-sino, barbante, bloco rachado, baú). */
export class Armas {
  readonly raiz = new THREE.Group();
  private pedras: THREE.InstancedMesh;
  private micangas: THREE.InstancedMesh;
  private sinos: VisSino[] = [];
  private barbantes: VisBarbante[] = [];
  private rachados: THREE.Mesh[] = [];
  private baus: { tampa: THREE.Object3D; ang: number }[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  private eu = new THREE.Euler();
  private brilho = 0;

  constructor(private fase: Fase, q: Qualidade) {
    // pedrinhas: Lambert instanciado como as estrelinhas (mesmo programa, só a cor muda); visível mesmo vazio, para
    // compilar na carga (com 0 instâncias o three não desenha nem conta chamada)
    const matPedra = new THREE.MeshLambertMaterial({ color: 0xff8ac0, emissive: 0x8a2050 });
    const matMicanga = new THREE.MeshLambertMaterial({ color: 0x7ac8ff, emissive: 0x1a4a8a });
    this.pedras = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), matPedra, 48);
    this.pedras.count = 0; this.pedras.frustumCulled = false;
    this.micangas = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.11, 0), matMicanga, 24);
    this.micangas.count = 0; this.micangas.frustumCulled = false;
    this.raiz.add(this.pedras, this.micangas);
    const mat = materialMundo(q, { ruido: false });
    for (const s of fase.alvos ?? []) {
      const g = new THREE.Mesh(geoSino(), mat); g.position.set(s.x, s.y, 0.1);
      this.raiz.add(g); this.sinos.push({ g, ang: 0, vang: 0 });
    }
    for (const b of fase.barbantes ?? []) {
      const len = b.y1 - b.y0;
      const corda = new THREE.Mesh(pintar(colocar(cil(0.014, 0.014, len, 5), 0, len / 2, 0), 0xfff4e0), mat);
      corda.position.set(b.x, b.y0, 0.1);
      const pacote = new THREE.Mesh(geoPacote(), mat); pacote.position.set(b.x, b.y0, 0.1);
      this.raiz.add(corda, pacote); this.barbantes.push({ corda, pacote, y: b.y0, vy: 0, caiu: false });
    }
    for (const r of fase.rachados ?? []) {
      const m = new THREE.Mesh(geoRachado(r.w, r.h), mat); m.position.set(r.x, r.y, 0);
      this.raiz.add(m); this.rachados.push(m);
    }
    const base = geoBauBase(), tampaG = geoBauTampa();
    for (const b of fase.baus ?? []) {
      const g = new THREE.Group(); g.position.set(b.x, b.y, -0.2);
      g.add(new THREE.Mesh(base, mat));
      const piv = new THREE.Group(); piv.position.set(0, 0.45, -0.275); g.add(piv);
      piv.add(new THREE.Mesh(tampaG, mat));
      this.raiz.add(g); this.baus.push({ tampa: piv, ang: 0 });
    }
  }

  atualizar(e: Estado, dt: number, relogio: number, fx: Particulas) {
    const f = this.fase;
    for (const ev of e.eventos) {
      const p = ev.split(':');
      const k = Number(p[1]);
      switch (p[0]) {
        case 'sino': {
          const s = (f.alvos ?? [])[k], v = this.sinos[k];
          if (!s || !v) break;
          v.vang += 7;
          fx.emitir({ x: s.x, y: s.y, z: 0.5, vida: 0.5, tam: 0.6, tamFim: 2.4, cor: 0xffe8a0, alfa: 0.9, cel: Cel.Anel });
          fx.explosao(s.x, s.y, 10, 0xfff0b0, 3, 0.3, 0.6, 0.5);
          break;
        }
        case 'barbante': {
          const b = (f.barbantes ?? [])[k];
          if (b) fx.explosao(b.x, b.y0 + 0.3, 6, 0xfff4e0, 2, 0.2, 0.4, 0.4);
          break;
        }
        case 'racha': {
          const r = (f.rachados ?? [])[k];
          if (!r) break;
          fx.explosao(r.x + r.w / 2, r.y + r.h / 2, 18, 0xffd24a, 5, 0.4, 0.7, 0.4);
          fx.explosao(r.x + r.w / 2, r.y + r.h / 2, 8, 0xffffff, 3, 0.3, 0.5, 0.6);
          break;
        }
        case 'bate': {
          const r = (f.rachados ?? [])[k];
          if (r) fx.emitir({ x: r.x + r.w / 2, y: r.y + r.h * 0.6, z: 0.7, vida: 0.25, tam: 0.4, tamFim: 1.2, cor: 0xffe8a0, alfa: 0.7, cel: Cel.Anel });
          break;
        }
        case 'bau': {
          const b = (f.baus ?? [])[k];
          if (b) { fx.explosao(b.x, b.y + 0.7, 16, 0xffe08a, 4, 0.35, 0.8, 0.3); fx.emitir({ x: b.x, y: b.y + 0.8, z: 0.4, vida: 0.7, tam: 0.8, tamFim: 3, cor: 0xfff0c0, alfa: 0.8, cel: Cel.Anel }); }
          break;
        }
        case 'golpe': case 'martelada': {
          const j = e.jogadores[k];
          if (!j) break;
          const forte = p[0] === 'martelada';
          const x = j.x + (forte ? 0 : j.olhando * 0.8), y = j.y + (forte ? 0.1 : 0.7);
          // arco de desenho animado ("vush") e, na martelada, a onda no chão
          fx.emitir({ x, y, z: 0.6, vida: forte ? 0.35 : 0.18, tam: forte ? 0.8 : 0.5, tamFim: forte ? 3.2 : 1.4, cor: forte ? 0xfff0b0 : 0xffffff, alfa: 0.75, cel: Cel.Anel });
          if (forte) fx.explosao(j.x, j.y + 0.1, 14, 0xffe8a0, 4, 0.3, 0.5, 0.4);
          break;
        }
        case 'pote': {
          const j = e.jogadores[k];
          if (j) fx.explosao(j.x, j.y + 0.8, 6, 0x9ad8ff, 2, 0.2, 0.4, 0.6);
          break;
        }
        case 'defendeu': {
          const n = e.inimigos[k];
          if (n) fx.emitir({ x: n.x, y: n.y + 1.4, z: 0.7, vida: 0.2, tam: 0.5, tamFim: 1.3, cor: 0xc0d8ff, alfa: 0.7, cel: Cel.Anel });
          break;
        }
      }
    }
    // sinos: balançam (mola) e brilham enquanto seguram a porta aberta
    const k = Math.min(1, dt * 60);
    this.sinos.forEach((v, i) => {
      v.vang += (-v.ang * 60 - v.vang * 4) * dt * k; v.ang += v.vang * dt;
      v.g.rotation.z = v.ang * 0.12;
      if ((e.alvos[i] ?? -1) > 0 && Math.floor(relogio * 6) % 2 === 0) fx.ponto(v.g.position.x, v.g.position.y, 0.5, 1.2, 0xffe8a0, 0.35, Cel.Halo);
    });
    this.barbantes.forEach((v, i) => {
      const cortado = (e.barbantes[i] ?? -1) >= 0;
      v.corda.visible = !cortado;
      if (!cortado) { v.caiu = false; v.y = (f.barbantes ?? [])[i].y0; v.vy = 0; v.pacote.visible = true; v.pacote.position.y = v.y; return; }
      if (v.caiu) return;
      // o pacote cai, quica no chão e se abre em brilho
      v.vy -= 30 * dt; v.y += v.vy * dt;
      const chao = ((f.barbantes ?? [])[i].premioEm?.y ?? 0.6) - 0.6;
      if (v.y - 0.42 <= chao) { v.caiu = true; v.pacote.visible = false; fx.explosao(v.pacote.position.x, chao + 0.3, 14, 0xff9ad0, 4, 0.35, 0.7, 0.4); }
      v.pacote.position.y = v.y;
      v.pacote.rotation.z += dt * 3;
    });
    this.rachados.forEach((m, i) => { m.visible = (e.rachados[i] ?? 1) > 0; });
    this.baus.forEach((b, i) => {
      const alvo = e.baus[i] ? -1.9 : 0;
      b.ang += (alvo - b.ang) * Math.min(1, dt * 8);
      b.tampa.rotation.x = b.ang;
      if (!e.baus[i]) {
        const bb = (f.baus ?? [])[i];
        fx.ponto(bb.x, bb.y + 0.5, -0.1, 1.3 + Math.sin(relogio * 3 + i) * 0.15, 0xffe08a, 0.3, Cel.Halo);
      }
    });

    // pedrinhas (girando) e miçangas soltas (contas que pulam devagar)
    this.brilho += dt;
    let n = 0;
    for (const p of e.faiscas) {
      if (n >= 48) break;
      const giro = relogio * 12 + p.id;
      this.q.setFromEuler(this.eu.set(giro, giro * 0.7, 0));
      this.pedras.setMatrixAt(n++, this.m.compose(this.v.set(p.x, p.y, 0.5), this.q, this.s.setScalar((p.dano ?? 1) > 1 ? 1.5 : 1)));
      fx.ponto(p.x, p.y, 0.45, (p.dano ?? 1) > 1 ? 0.9 : 0.55, p.arma === ITEM.confeitos ? 0xff9ad8 : 0xffd0e8, 0.45, Cel.Halo);
    }
    this.pedras.count = n;
    if (n) this.pedras.instanceMatrix.needsUpdate = true;
    let c = 0;
    for (const p of e.potes) {
      if (c >= 24) break;
      const pula = Math.abs(Math.sin(relogio * 3 + p.x)) * 0.12;
      this.q.setFromEuler(this.eu.set(0, relogio * 2 + p.x, 0));
      this.micangas.setMatrixAt(c++, this.m.compose(this.v.set(p.x, p.y + 0.15 + pula, 0.3), this.q, this.s.setScalar(p.carga ? 1.3 : 0.8)));
      fx.ponto(p.x, p.y + 0.15 + pula, 0.25, 0.7, 0x9ad8ff, 0.4, Cel.Halo);
    }
    this.micangas.count = c;
    if (c) this.micangas.instanceMatrix.needsUpdate = true;
  }
}
