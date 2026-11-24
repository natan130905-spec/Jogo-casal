// Medidas para o desenho dos modos (campanha solo, companheiro controlado pelo jogo, salvamento na lanterna).
// Só lê src/core e test/fases; não altera nada. Rode numa cópia (worktree):
//   tools/revisao/arquitetura-modos/rodar.sh            → imprime e grava medidas.json nesta pasta
//
// A) Pontos de cooperação obrigatórios: Dijkstra no espaço dos pares (nó de Natan, nó de Bruna) do grafo de
//    test/fases/alcance.ts, custo 1 por ligação que se faz sozinho e 100 por ligação que exige o parceiro
//    (mãos dadas, fio, porta com placa longe). O caminho de menor custo diz quantas ajudas são inevitáveis, de que
//    tipo e onde (x) — é a lista que o companheiro controlado pelo jogo precisa saber cumprir.
// B) Salvar na lanterna e retomar: roda os bots de test/fases/planos; a cada lanterna acesa grava um "resumo" pequeno
//    (o que a proposta de salvamento guarda), recria o estado só com ele, põe os dois na lanterna e continua o plano a
//    partir da etapa em andamento. Conta quantas retomadas chegam ao pedaço da estrela e mede tamanhos em bytes.
import { CAPITULOS } from '../../../src/core/fases';
import { estadoInicial, pontoCheckpoint } from '../../../src/core/sim';
import { instantaneo } from '../../../src/core/instantaneo';
import type { Estado, Fase } from '../../../src/core/types';
import { montarGrafo, noSob, nosQueTocam, podeUsar, PLACA_COLADA, type Grafo, type Ligacao } from '../../../test/fases/alcance';
import { jogar, type Etapa } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';
import { writeFileSync } from 'node:fs';

// ---------- A) pontos de cooperação ----------
function exigeParceiro(g: Grafo, de: number, l: Ligacao): boolean {
  if (l.tipo === 'solo') return false;
  if (l.tipo !== 'porta') return true;
  const p = g.fase.portas.find((d) => d.id === l.porta)!;
  if (p.modo === 'todas') return true;
  return !g.fase.placas.some((q) => q.abre === p.id && g.placas[de].has(q.id) && Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w)) <= PLACA_COLADA);
}

class Heap { a: [number, number][] = [];
  push(v: [number, number]) { const a = this.a; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const t = a[0]; const u = a.pop()!; if (a.length) { a[0] = u; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; }
  get size() { return this.a.length; } }

interface Ajuda { tipo: string; porta?: string; quem: 0 | 1; x: number; y: number; paraX: number; paraY: number; parceiroX: number; parceiroY: number }

function pontosCoop(f: Fase) {
  const g = montarGrafo(f);
  const N = g.nos.length;
  const ini = noSob(g, f.inicio[0]) * N + noSob(g, f.inicio[1]);
  const fim = new Set(nosQueTocam(g, f.portal));
  const dist = new Map<number, number>([[ini, 0]]);
  const pred = new Map<number, [number, 0 | 1, Ligacao]>();
  const h = new Heap(); h.push([0, ini]);
  let alvo = -1;
  while (h.size) {
    const [d, s] = h.pop();
    if (d > (dist.get(s) ?? Infinity)) continue;
    const a = Math.floor(s / N), b = s % N;
    if (fim.has(a) && fim.has(b)) { alvo = s; break; }
    for (const quem of [0, 1] as const) {
      const eu = quem === 0 ? a : b, par = quem === 0 ? b : a;
      for (const l of g.lig[eu]) {
        if (!podeUsar(g, eu, l, par)) continue;
        const t = quem === 0 ? l.para * N + b : a * N + l.para;
        const nd = d + (exigeParceiro(g, eu, l) ? 100 : 1);
        if (nd < (dist.get(t) ?? Infinity)) { dist.set(t, nd); pred.set(t, [s, quem, l]); h.push([nd, t]); }
      }
    }
  }
  const ajudas: Ajuda[] = [];
  const cx = (id: number) => (g.nos[id].x0 + g.nos[id].x1) / 2;
  for (let s = alvo; pred.has(s);) {
    const [p, quem, l] = pred.get(s)!;
    const a = Math.floor(p / N), b = p % N;
    const eu = quem === 0 ? a : b, par = quem === 0 ? b : a;
    if (exigeParceiro(g, eu, l)) ajudas.push({ tipo: l.tipo, porta: l.porta, quem, x: +cx(eu).toFixed(1), y: +g.nos[eu].y.toFixed(2), paraX: +cx(l.para).toFixed(1), paraY: +g.nos[l.para].y.toFixed(2), parceiroX: +cx(par).toFixed(1), parceiroY: +g.nos[par].y.toFixed(2) });
    s = p;
  }
  ajudas.reverse();
  return { nos: N, ajudas, custo: dist.get(alvo) };
}

// ---------- B) salvar na lanterna e retomar ----------
/** O que a proposta de salvamento guarda ao acender uma lanterna (ResumoLanterna em ARQUITETURA_MODOS.md). */
interface ResumoLanterna {
  v: 1; cap: number; lanterna: number; tick: number;
  coletadas: number[]; est: [number, number]; casal: number;
  /** bichinhos já derrotados (bitmask em base 36 por bloco de 30 — aqui uma lista de índices, para medir) */
  derrotados: number[];
}
function resumir(f: Fase, e: Estado): ResumoLanterna {
  return { v: 1, cap: f.capitulo ?? 0, lanterna: e.checkpoint, tick: e.tick, coletadas: [...e.coletadas],
    est: [e.jogadores[0].estrelinhas, e.jogadores[1].estrelinhas], casal: e.estrelinhasCasal,
    derrotados: e.inimigos.flatMap((n, k) => (n.vivo ? [] : [k])) };
}
function retomar(f: Fase, r: ResumoLanterna): Estado {
  const e = estadoInicial(f);
  e.tick = r.tick; e.checkpoint = r.lanterna; e.coletadas = [...r.coletadas]; e.estrelinhasCasal = r.casal;
  for (const k of r.derrotados) e.inimigos[k].vivo = false;
  for (const i of [0, 1] as const) {
    const p = pontoCheckpoint(f, e, i), j = e.jogadores[i];
    j.x = j.seguroX = p.x; j.y = j.seguroY = p.y; j.estrelinhas = r.est[i];
  }
  return e;
}

function medirSalvamento(f: Fase, plano: Etapa[]) {
  let atual = 0;
  const marcado: Etapa[] = plano.map((et, k) => ({ ...et, p: [[{ nome: 'marca', fn: () => { atual = k; return null; } }, ...et.p[0]], et.p[1]] }));
  const saves: { r: ResumoLanterna; etapa: number }[] = [];
  let cpAntes = -1, maxEstado = 0, maxInst = 0, somaInst = 0, nInst = 0;
  const base = jogar(f, marcado, { cada: (e) => {
    if (e.checkpoint !== cpAntes) { cpAntes = e.checkpoint; saves.push({ r: resumir(f, e), etapa: atual }); }
    if (e.tick % 60 === 0) { maxEstado = Math.max(maxEstado, JSON.stringify(e).length); }
    if (e.tick % 3 === 0) { const n = JSON.stringify(instantaneo(f, e)).length; maxInst = Math.max(maxInst, n); somaInst += n; nInst++; }
  } });
  const retomadas = saves.map(({ r, etapa }) => {
    // continua da etapa em andamento; se não fechar, tenta a seguinte (a etapa pode ter começado antes da lanterna)
    for (const k of [etapa, etapa + 1]) {
      const e = retomar(f, r);
      const rel = jogar(f, plano.slice(k), { e });
      if (rel.concluida) return { lanterna: r.lanterna, etapa: k, ok: true, segundos: +rel.segundos.toFixed(1), bytes: JSON.stringify(r).length };
    }
    return { lanterna: r.lanterna, etapa, ok: false, bytes: JSON.stringify(r).length };
  });
  return { concluida: base.concluida, segundos: +base.segundos.toFixed(1), lanternas: (f.lanternas ?? []).length, retomadas,
    bytesEstadoMax: maxEstado, bytesInstantaneoMax: maxInst, bytesInstantaneoMedio: Math.round(somaInst / Math.max(1, nInst)) };
}

const saida: Record<string, unknown> = {};
for (const f of CAPITULOS) {
  const t0 = Date.now();
  const a = pontosCoop(f);
  const b = medirSalvamento(f, PLANOS[f.id]);
  const porTipo: Record<string, number> = {};
  for (const x of a.ajudas) { const k = x.tipo === 'porta' ? 'porta' : x.tipo; porTipo[k] = (porTipo[k] ?? 0) + 1; }
  saida[f.id] = { largura: f.largura, nos: a.nos, ajudasObrigatorias: a.ajudas.length, porTipo, ajudas: a.ajudas, salvamento: b, ms: Date.now() - t0 };
  const ok = b.retomadas.filter((r) => r.ok).length;
  console.log(`${f.id}: ${a.ajudas.length} ajudas obrigatórias ${JSON.stringify(porTipo)} · retomadas ${ok}/${b.retomadas.length} · estado ${b.bytesEstadoMax} B · inst. ${b.bytesInstantaneoMedio}/${b.bytesInstantaneoMax} B · resumo ${Math.max(...b.retomadas.map((r) => r.bytes))} B`);
  for (const x of a.ajudas) console.log(`   ${x.tipo}${x.porta ? `(${x.porta})` : ''} ${x.quem ? 'Bruna' : 'Natan'} ${x.x}→${x.paraX} (y ${x.y}→${x.paraY}), parceiro em x ${x.parceiroX} y ${x.parceiroY}`);
  for (const r of b.retomadas.filter((r) => !r.ok)) console.log(`   retomada falhou: lanterna ${r.lanterna}, etapa ${r.etapa}`);
}
const dir = process.env.SAIDA_DIR;
if (dir) writeFileSync(`${dir}/medidas.json`, JSON.stringify(saida, null, 1));
