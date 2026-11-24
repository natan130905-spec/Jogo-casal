// Vitrine (só no servidor de desenvolvimento): roda a cena com qualquer fase e tema, sem rede, para conferir os
// elementos de jogo (bichinhos, faíscas, Fio Vermelho, plataformas especiais, temas). Controlada por teclado
// (setas/WASD, Espaço, J, E; Tab troca o personagem) ou pelo gancho `window.__vit` (capturas automáticas).
// ?fase=<id> (padrão exemplo-mecanicas) · ?tema=<chave> · ?q=baixa|media|alta · ?x=<posição inicial dos dois>
import { FASES } from '../../src/core/fases';
import { estadoInicial, passo } from '../../src/core/sim';
import { INPUT_NEUTRO, type Input } from '../../src/core/types';
import { Cena, type Qualidade } from '../../src/render/cena';

const ps = new URLSearchParams(location.search);
const fase = FASES[ps.get('fase') ?? 'exemplo-mecanicas'] ?? FASES['exemplo-mecanicas'];
const cena = new Cena(document.querySelector<HTMLCanvasElement>('#c')!, fase, (ps.get('q') ?? 'media') as Qualidade);
const ajustar = () => cena.redimensionar(innerWidth, innerHeight);
ajustar(); addEventListener('resize', ajustar);
const estado = estadoInicial(fase);
const x0 = ps.get('x');
if (x0) estado.jogadores.forEach((j, i) => { j.x = j.seguroX = Number(x0) + i * 1.2; j.y = j.seguroY = 3; });

const teclas = new Set<string>();
addEventListener('keydown', (e) => { teclas.add(e.code); if (e.code === 'Tab') { e.preventDefault(); quem = 1 - quem; } });
addEventListener('keyup', (e) => teclas.delete(e.code));
let quem = 0;
const doTeclado = (): Input => ({
  x: (teclas.has('ArrowRight') || teclas.has('KeyD') ? 1 : 0) - (teclas.has('ArrowLeft') || teclas.has('KeyA') ? 1 : 0),
  y: (teclas.has('ArrowUp') || teclas.has('KeyW') ? 1 : 0) - (teclas.has('ArrowDown') || teclas.has('KeyS') ? 1 : 0),
  jump: teclas.has('Space'), act: teclas.has('KeyE'), shoot: teclas.has('KeyJ'),
});
// entradas forçadas pelo gancho de teste: [P1, P2]
let roteiro: [Partial<Input>, Partial<Input>] | null = null;
let pausado = false;
(window as unknown as { __vit: unknown }).__vit = {
  estado, fase,
  /** põe os dois em (x, y) — o parceiro 1,2 m à direita */
  irPara(x: number, y = 0.2, dx = 1.2) { estado.jogadores.forEach((j, i) => Object.assign(j, { x: x + i * dx, y, vx: 0, vy: 0, seguroX: x + i * dx, seguroY: y })); },
  entradas(a: Partial<Input> | null, b: Partial<Input> = {}) { roteiro = a ? [a, b] : null; },
  pausar(p: boolean) { pausado = p; },
  info: () => cena.info(),
};
let anterior = performance.now(), acum = 0, fpsN = 0, fpsT = anterior;
const quadro = (agora: number) => {
  const dt = Math.min(0.1, (agora - anterior) / 1000); anterior = agora;
  const eventos: string[] = [];
  if (!pausado) {
    acum += dt;
    const local = doTeclado();
    while (acum >= 1 / 60) {
      const ent: [Input, Input] = roteiro
        ? [{ ...INPUT_NEUTRO, ...roteiro[0] }, { ...INPUT_NEUTRO, ...roteiro[1] }]
        : (quem === 0 ? [local, INPUT_NEUTRO] : [INPUT_NEUTRO, local]);
      passo(fase, estado, ent);
      eventos.push(...estado.eventos);
      acum -= 1 / 60;
    }
  }
  estado.eventos = eventos; // todos os eventos dos passos deste quadro (como o convidado recebe)
  cena.desenhar(estado, dt);
  fpsN++;
  if (agora - fpsT > 1000) { const i = cena.info(); document.querySelector('#info')!.textContent = `${fase.id} · ${fpsN} fps · ${i.chamadas} ch · ${i.triangulos} tri`; fpsN = 0; fpsT = agora; }
  requestAnimationFrame(quadro);
};
requestAnimationFrame(quadro);
