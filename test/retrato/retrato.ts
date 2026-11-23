// Página de conferência (só no servidor de desenvolvimento): P1 e P2 de perto, em várias poses, com a mesma luz da cena.
// ?vista=perto (os dois parados) | grade (todas as poses) · ?q=baixa|media|alta
import * as THREE from 'three';
import { criarPersonagem } from '../../src/render/personagem';
import { novoJogador } from '../../src/core/sim';
import type { EstadoJogador } from '../../src/core/types';
import type { Qualidade } from '../../src/render/cena';

const ps = new URLSearchParams(location.search);
const vista = ps.get('vista') ?? 'perto';
const q = (ps.get('q') ?? 'media') as Qualidade;
const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(devicePixelRatio); r.setSize(innerWidth, innerHeight, false);
r.toneMapping = THREE.NeutralToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
r.shadowMap.enabled = q === 'alta';
const cena = new THREE.Scene();
const fundo = document.createElement('canvas'); fundo.width = 4; fundo.height = 256;
const gf = fundo.getContext('2d')!; const gr = gf.createLinearGradient(0, 0, 0, 256);
gr.addColorStop(0, '#3a2a78'); gr.addColorStop(0.6, '#b07ab8'); gr.addColorStop(1, '#f2b890'); gf.fillStyle = gr; gf.fillRect(0, 0, 4, 256);
const tf = new THREE.CanvasTexture(fundo); tf.colorSpace = THREE.SRGBColorSpace; cena.background = tf;
cena.add(new THREE.HemisphereLight(0xffe4c4, 0x5a3f96, 1.55));
const sol = new THREE.DirectionalLight(0xffcf8f, 2.3); sol.position.set(-10, 18, 16); cena.add(sol);
const contra = new THREE.DirectionalLight(0xff9fd8, 0.9); contra.position.set(10, 8, -14); cena.add(contra);
const chao = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshLambertMaterial({ color: 0x6fbf4a }));
chao.rotation.x = -Math.PI / 2; cena.add(chao);

type Pose = { nome: string; j: Partial<EstadoJogador>; ev?: string; quadros: number; outroDx?: number; outroDy?: number };
const POSES: Pose[] = vista === 'perto'
  ? [{ nome: 'parado', j: { noChao: true }, quadros: 40 }]
  : [
    { nome: 'parado', j: { noChao: true }, quadros: 40 },
    { nome: 'correndo', j: { noChao: true, vx: 5.2 }, quadros: 23 },
    { nome: 'pulo', j: { noChao: false, vy: 6 }, quadros: 30 },
    { nome: 'queda', j: { noChao: false, vy: -8 }, quadros: 30 },
    { nome: 'pouso', j: { noChao: true }, ev: 'pouso', quadros: 3 },
    { nome: 'maos', j: { noChao: true }, ev: 'maos', quadros: 10, outroDx: 0.9 },
    { nome: 'pronto', j: { noChao: true, impulso: 0.5 }, quadros: 20 },
    { nome: 'superpulo', j: { noChao: false, vy: 12 }, ev: 'superpulo', quadros: 18 },
  ];
const atualizadores: (() => void)[] = [];
const esp = vista === 'perto' ? 0.9 : 0.95;
POSES.forEach((p, k) => {
  (['P1', 'P2'] as const).forEach((qual, i) => {
    const pers = criarPersonagem(qual, q);
    const x = vista === 'perto' ? (i - 0.5) * esp : (k - (POSES.length - 1) / 2) * esp;
    const y = vista === 'perto' ? 0 : (1 - i) * 1.55 - 0.1;
    const j = { ...novoJogador(x, y), olhando: (vista === 'perto' ? (i === 0 ? 1 : -1) : 1) as 1 | -1, ...p.j };
    const outro = novoJogador(x + (p.outroDx ?? 0.8), y + (p.outroDy ?? 0));
    pers.raiz.traverse((o) => { o.castShadow = o.castShadow && q === 'alta'; });
    cena.add(pers.raiz);
    let t = 0;
    for (let f = 0; f < p.quadros; f++) {
      t += 1 / 60;
      pers.atualizar(j, outro, 1 / 60, f === 0 && p.ev ? [`${p.ev}:${i}`] : [], i, t);
    }
    atualizadores.push(() => { /* congelado */ });
    if (vista === 'perto') {
      // de perto o "piscar" aleatório não pode sair na captura: avança até abrir os olhos
      pers.atualizar(j, outro, 0, [], i, t);
    }
  });
});
const cam = new THREE.PerspectiveCamera(vista === 'perto' ? 30 : 30, innerWidth / innerHeight, 0.1, 100);
if (vista === 'perto') { cam.position.set(0, 0.75, 3.0); cam.lookAt(0, 0.58, 0); }
else { cam.position.set(0, 0.85, 7.0); cam.lookAt(0, 0.75, 0); }
r.render(cena, cam);
(window as unknown as { __pronto: boolean; __info: unknown }).__pronto = true;
(window as unknown as { __info: unknown }).__info = { chamadas: r.info.render.calls, triangulos: r.info.render.triangles, n: POSES.length * 2 };
