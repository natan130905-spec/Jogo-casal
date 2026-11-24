// Montagem e conferência do mapa de apoio (src/core/companheiro/apoio.ts). Roda só fora do celular: no build
// (tools/gerar_apoio.ts → src/core/fases/apoio/capN.json) e no teste T14 (test/apoio.test.ts). [R59]
//
// Pontos de cooperação: Dijkstra no espaço dos pares (nó de Natan, nó da Bruna) do grafo de ./alcance.ts, custo 1 por
// ligação feita sozinho e 100 por ligação que exige o parceiro (mãos dadas, fio, porta com a placa longe ou dupla).
// O caminho mais barato do início até os dois no pedaço da estrela dá as ajudas inevitáveis; cada uma vira um
// PontoCoop (o companheiro ajuda) e o inverso (o jogador ajuda). Vem de tools/revisao/arquitetura-modos/medir_modos.ts.
import type { ApoioFase, LigApoio, MapaApoio, Manobra, NoApoio, PontoCoop, TipoCoop } from '../../src/core/companheiro/apoio';
import { hashFase } from '../../src/core/companheiro/apoio';
import type { Fase, Retangulo } from '../../src/core/types';
import { montarGrafo, noSob, nosQueTocam, podeUsar, PLACA_COLADA, type Grafo, type Ligacao } from './alcance';

/** A ligação só se faz com o parceiro? (porta com a própria placa colada não conta) */
export function exigeParceiro(g: Grafo, de: number, l: Ligacao): boolean {
  if (l.tipo === 'solo') return false;
  if (l.tipo !== 'porta') return true;
  const p = g.fase.portas.find((d) => d.id === l.porta)!;
  if (p.modo === 'todas') return true;
  return !g.fase.placas.some((q) => q.abre === p.id && g.placas[de].has(q.id) && Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w)) <= PLACA_COLADA);
}

class Heap {
  a: [number, number][] = [];
  push(v: [number, number]) { const a = this.a; a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const t = a[0]; const u = a.pop()!; if (a.length) { a[0] = u; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; }
  get size() { return this.a.length; }
}

/** Uma ajuda do caminho mínimo: `quem` (0/1) vai de `de` a `para` pela ligação `l`, com o parceiro no nó `parceiro`. */
export interface Ajuda { quem: 0 | 1; de: number; para: number; parceiro: number; l: Ligacao }

/** Ajudas inevitáveis: as ligações de ajuda de um caminho mínimo (Dijkstra determinístico) do início ao fim. */
export function ajudasDoCaminho(g: Grafo): { ajudas: Ajuda[]; custo: number } {
  const f = g.fase, N = g.nos.length;
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
  if (alvo < 0) throw new Error(`${f.id}: o pedaço da estrela não é alcançável pelos dois no grafo`);
  const ajudas: Ajuda[] = [];
  for (let s = alvo; pred.has(s);) {
    const [p, quem, l] = pred.get(s)!;
    const a = Math.floor(p / N), b = p % N;
    const eu = quem === 0 ? a : b, par = quem === 0 ? b : a;
    if (exigeParceiro(g, eu, l)) ajudas.push({ quem, de: eu, para: l.para, parceiro: par, l });
    s = p;
  }
  ajudas.reverse();
  return { ajudas, custo: dist.get(alvo)! };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function manobraDe(g: Grafo, de: number, l: Ligacao): Manobra {
  if (l.tipo === 'super') return 'superpulo';
  if (l.tipo === 'fio') return 'fio';
  if (l.tipo === 'porta') return 'porta';
  const a = g.nos[de], b = g.nos[l.para];
  if (a.tipo === 'quica') return 'quicarPara';
  if (b.tipo === 'argola') return 'atravessarArgola';
  if (a.tipo === 'esp' && b.tipo === 'esp' && a.k === b.k) return 'carona';
  if (b.tipo === 'esp') return 'subirEm';
  return 'saltar';
}

/** Trecho do nó `de` de onde se faz a ligação para `para` (até 3 m do vão, no máximo 8 m de comprimento). */
function trechoDaTravessia(g: Grafo, de: number, para: number, porta?: string): [number, number] {
  const a = g.nos[de], b = g.nos[para];
  if (porta) {
    const p = g.fase.portas.find((d) => d.id === porta)!;
    const direita = (b.x0 + b.x1) / 2 > p.x;
    return direita ? [Math.max(a.x0, a.x1 - 5), a.x1] : [a.x0, Math.min(a.x1, a.x0 + 5)];
  }
  let x0 = Math.max(a.x0, b.x0 - 3), x1 = Math.min(a.x1, b.x1 + 3);
  if (x0 > x1) { const x = b.x0 > a.x1 ? a.x1 : a.x0; x0 = Math.max(a.x0, x - 3); x1 = Math.min(a.x1, x + 3); }
  if (x1 - x0 > 8) { const c = limitar((b.x0 + b.x1) / 2, x0 + 4, x1 - 4); x0 = c - 4; x1 = c + 4; }
  return [x0, x1];
}

const ret = (x0: number, x1: number, y: number): Retangulo => ({ x: r2(x0), y: r2(y - 0.1), w: r2(x1 - x0), h: 2.6 });
const fimEm = (g: Grafo, no: number) => ({ no, x0: r2(g.nos[no].x0), x1: r2(g.nos[no].x1), y: r2(g.nos[no].y) });

/** O ponto de quem ajuda (o companheiro, num ponto do caminho) e de quem é ajudado. */
function pontosDaAjuda(g: Grafo, a: Ajuda): { tipo: TipoCoop; tipoInv: TipoCoop; ajudado: Retangulo; ajudante: { no: number; x: number; y: number; placa?: string; segurar?: 'act' }; ajudanteRet: Retangulo } {
  const f = g.fase, nd = g.nos[a.de], np = g.nos[a.para], nh = g.nos[a.parceiro];
  const [t0, t1] = trechoDaTravessia(g, a.de, a.para, a.l.porta);
  const ajudado = ret(t0, t1, nd.y);
  const meioT = (t0 + t1) / 2;
  const dentroDe = (n: { x0: number; x1: number }, x: number) => limitar(x, n.x0 + 0.05, n.x1 - 0.05);
  switch (a.l.tipo) {
    case 'porta': {
      const p = f.portas.find((d) => d.id === a.l.porta)!;
      const q = f.placas.find((q) => q.abre === p.id && g.placas[a.parceiro].has(q.id))!;
      const x = dentroDe(nh, q.x + q.w / 2);
      return { tipo: p.modo === 'todas' ? 'placaDupla' : 'placa', tipoInv: 'passar', ajudado, ajudante: { no: a.parceiro, x: r2(x), y: r2(nh.y), placa: q.id }, ajudanteRet: ret(q.x, q.x + q.w, nh.y) };
    }
    case 'super': {
      if (a.parceiro === a.de) {
        const x = dentroDe(nh, meioT);
        return { tipo: 'impulso', tipoInv: 'superpulo', ajudado, ajudante: { no: a.parceiro, x: r2(x), y: r2(nh.y), segurar: 'act' }, ajudanteRet: ret(x - 1.3, x + 1.3, nh.y) };
      }
      // puxar de cima: o companheiro na beira do nó de chegada mais perto de quem espera embaixo
      const x = dentroDe(np, limitar(meioT, np.x0 + 0.35, np.x1 - 0.35));
      return { tipo: 'puxar', tipoInv: 'serPuxado', ajudado, ajudante: { no: a.parceiro, x: r2(x), y: r2(np.y), segurar: 'act' }, ajudanteRet: ret(x - 1.3, x + 1.3, np.y) };
    }
    case 'fio': {
      // âncora na beira do nó em que está, do lado do outro
      const outro = a.parceiro === a.de ? np : nd;
      const x = (outro.x0 + outro.x1) / 2 > (nh.x0 + nh.x1) / 2 ? nh.x1 - 0.3 : nh.x0 + 0.3;
      return { tipo: 'fioAncora', tipoInv: 'fioPendurado', ajudado, ajudante: { no: a.parceiro, x: r2(dentroDe(nh, x)), y: r2(nh.y), segurar: 'act' }, ajudanteRet: ret(x - 1.5, x + 1.5, nh.y) };
    }
    default: throw new Error(`ligação ${a.l.tipo} não é de ajuda`);
  }
}

const DICA_PADRAO: Record<string, string> = {
  placa: 'Fico na placa e seguro a porta para você.', placaDupla: 'Cada um numa placa, ao mesmo tempo.',
  impulso: 'Vem de mãos dadas comigo e pula: eu te dou impulso.', puxar: 'Subo primeiro e te puxo pela mão.',
  fioAncora: 'Eu seguro o fio na beira; você atravessa.', passar: 'Fica na placa que eu passo.',
  superpulo: 'Me dá a mão que eu pulo alto.', serPuxado: 'Sobe e me puxa pela mão.', fioPendurado: 'Segura o fio que eu atravesso.',
};

/** Monta o mapa de apoio da fase. `avisos` lista pontos sem anotação à mão e anotações que não casaram. */
export function montarMapaApoio(f: Fase & { capitulo?: number; apoio?: ApoioFase }, g: Grafo = montarGrafo(f)): { mapa: MapaApoio; avisos: string[] } {
  const avisos: string[] = [];
  const nos: NoApoio[] = g.nos.map((n) => ({ tipo: n.tipo, x0: r2(n.x0), x1: r2(n.x1), y: r2(n.y), ...(n.k !== undefined ? { k: n.k } : {}) }));
  const lig: LigApoio[][] = g.lig.map((ls, de) => ls.map((l) => ({ para: l.para, tipo: l.tipo, ...(l.porta ? { porta: l.porta } : {}), manobra: manobraDe(g, de, l) })));
  const estrelas = g.estrelas.map((s) => [...s].sort((a, b) => a - b));
  const pref = `cap${f.capitulo ?? 0}`;
  const manuais = f.apoio?.pontos ?? [];
  const usado = new Set<number>();
  const coop: PontoCoop[] = [];
  const { ajudas } = ajudasDoCaminho(g);
  ajudas.forEach((a, k) => {
    const p = pontosDaAjuda(g, a);
    const cx = p.ajudado.x + p.ajudado.w / 2;
    let im = -1, dm = 8;
    manuais.forEach((m, i) => { const d = Math.abs(m.x - cx); if (!usado.has(i) && m.tipo === p.tipo && (!m.placa || m.placa === p.ajudante.placa) && d <= dm) { dm = d; im = i; } });
    const man = im >= 0 ? manuais[im] : undefined;
    if (im >= 0) usado.add(im); else avisos.push(`${f.id}: ponto ${p.tipo} em x ${cx.toFixed(1)} sem anotação no campo apoio`);
    const id = man?.id ?? `${pref}:${p.tipo}-${k + 1}`;
    const papelX = man?.papelX ?? p.ajudante.x;
    const comum = { de: a.de, para: a.para, lig: a.l.tipo, ...(a.l.porta ? { porta: a.l.porta } : {}) };
    const ate = fimEm(g, a.para);
    coop.push({
      id, tipo: p.tipo, origem: 'caminho', ...comum, gatilho: p.ajudado,
      papel: { ...p.ajudante, x: papelX, ate }, inverso: `${id}~inv`,
      dica: man?.dica ?? DICA_PADRAO[p.tipo], autoSolucao: man?.autoSolucao ?? 'tolerancia',
    });
    // inverso: o jogador ajuda (fica onde o companheiro ficaria) e o companheiro é quem passa
    const xInv = limitar(cx, g.nos[a.de].x0 + 0.05, g.nos[a.de].x1 - 0.05);
    coop.push({
      id: `${id}~inv`, tipo: p.tipoInv, origem: 'inverso', ...comum, gatilho: p.ajudanteRet,
      papel: { no: a.de, x: r2(xInv), y: r2(g.nos[a.de].y), ate }, inverso: id,
      dica: man?.dicaInverso ?? DICA_PADRAO[p.tipoInv], autoSolucao: man?.autoSolucao ?? 'tolerancia',
    });
  });
  manuais.forEach((m, i) => { if (!usado.has(i)) avisos.push(`${f.id}: anotação ${m.id} (${m.tipo} em x ${m.x}) não casou com nenhum ponto gerado`); });
  return { mapa: { v: 1, fase: f.id, hashFase: hashFase(f), nos, lig, coop, estrelas }, avisos };
}

/**
 * T14: o mapa gravado confere com a fase e com o grafo de hoje. Devolve a lista de problemas (vazia = em dia):
 * hash; todo PontoCoop cobre uma ligação de ajuda que existe e se pode usar com o companheiro onde o papel diz; toda
 * ligação de ajuda do caminho mínimo tem PontoCoop (nos dois sentidos de papel); toda anotação à mão casou.
 */
export function conferirApoio(f: Fase & { capitulo?: number; apoio?: ApoioFase }, mapa: MapaApoio, g: Grafo = montarGrafo(f)): string[] {
  const erros: string[] = [];
  if (mapa.hashFase !== hashFase(f)) erros.push(`${f.id}: hashFase ${mapa.hashFase} ≠ ${hashFase(f)} (a fase mudou: rode npm run apoio)`);
  if (mapa.nos.length !== g.nos.length) erros.push(`${f.id}: ${mapa.nos.length} nós no mapa, ${g.nos.length} no grafo de hoje (rode npm run apoio)`);
  const TIPO_LIG: Record<string, string> = { placa: 'porta', placaDupla: 'porta', passar: 'porta', impulso: 'super', superpulo: 'super', puxar: 'super', serPuxado: 'super', fioAncora: 'fio', fioPendurado: 'fio' };
  for (const p of mapa.coop) {
    const nome = `${f.id} ${p.id}`;
    if (TIPO_LIG[p.tipo] !== p.lig) { erros.push(`${nome}: tipo ${p.tipo} não combina com a ligação ${p.lig}`); continue; }
    const l = g.lig[p.de]?.find((x) => x.para === p.para && x.tipo === p.lig && (x.porta ?? '') === (p.porta ?? ''));
    if (!l) { erros.push(`${nome}: a ligação ${p.de}→${p.para} (${p.lig}) não existe no grafo`); continue; }
    if (!exigeParceiro(g, p.de, l)) erros.push(`${nome}: a ligação não exige o parceiro`);
    // onde fica quem ajuda: no caminho, o companheiro (papel); no inverso, o jogador (gatilho)
    const ajudante = p.origem === 'caminho' ? p.papel.no : -1;
    const nAj = ajudante >= 0 ? ajudante : noAjudanteInverso(mapa, p);
    if (nAj < 0 || !podeUsar(g, p.de, l, nAj)) erros.push(`${nome}: com quem ajuda no nó ${nAj} a ligação não se usa`);
    const nPapel = g.nos[p.papel.no];
    if (!nPapel || p.papel.x < nPapel.x0 - 0.01 || p.papel.x > nPapel.x1 + 0.01 || Math.abs(p.papel.y - nPapel.y) > 0.01) erros.push(`${nome}: papel (${p.papel.x}, ${p.papel.y}) fora do nó ${p.papel.no}`);
    if (p.papel.placa && !g.placas[p.papel.no].has(p.papel.placa)) erros.push(`${nome}: a placa ${p.papel.placa} não está no nó do papel`);
    const ndg = g.nos[p.origem === 'caminho' ? p.de : nAj];
    const gx = p.gatilho.x + p.gatilho.w / 2;
    if (!ndg || gx < ndg.x0 - 1.6 || gx > ndg.x1 + 1.6) erros.push(`${nome}: o gatilho (x ${gx.toFixed(2)}) não fica no nó de quem o acende`);
    if (p.papel.ate.no !== p.para) erros.push(`${nome}: a condição de fim não é o nó de chegada`);
    if (!mapa.coop.some((q) => q.id === p.inverso && q.inverso === p.id)) erros.push(`${nome}: sem inverso`);
    if (!p.dica) erros.push(`${nome}: sem dica`);
  }
  for (const a of ajudasDoCaminho(g).ajudas) {
    const desc = `${a.l.tipo}${a.l.porta ? `(${a.l.porta})` : ''} ${a.de}→${a.para} (x ${g.nos[a.de].x0.toFixed(1)}…${g.nos[a.de].x1.toFixed(1)})`;
    for (const origem of ['caminho', 'inverso'] as const) {
      if (!mapa.coop.some((p) => p.origem === origem && p.de === a.de && p.para === a.para && p.lig === a.l.tipo && (p.porta ?? '') === (a.l.porta ?? '') &&
        (origem === 'caminho' ? p.papel.no : noAjudanteInverso(mapa, p)) === a.parceiro))
        erros.push(`${f.id}: ajuda ${desc} do caminho mínimo sem PontoCoop (${origem})`);
    }
  }
  const { avisos } = montarMapaApoio(f, g);
  for (const a of avisos) erros.push(a);
  return erros;
}

/** No ponto inverso, o jogador ajuda de onde o companheiro ficaria no ponto do caminho. */
function noAjudanteInverso(mapa: MapaApoio, p: PontoCoop): number {
  const q = mapa.coop.find((x) => x.id === p.inverso);
  return q ? q.papel.no : -1;
}
