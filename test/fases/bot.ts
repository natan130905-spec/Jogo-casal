// Bots cooperativos roteirizados para provar que as fases são vencíveis com a simulação de verdade.
// Um "plano" é uma lista de etapas; cada etapa tem uma lista de passos para Natan (0) e outra para Bruna (1).
// Os passos de cada um correm em paralelo; a etapa só termina quando os dois acabam (barreira). Os passos podem
// esperar pelo outro (predicados sobre o estado), como dois jogadores combinando no sofá.
import { estadoInicial, passo, solidos } from '../../src/core/sim';
import { INIMIGO } from '../../src/core/inimigos';
import type { Estado, EstadoJogador, Fase, Input } from '../../src/core/types';

export const NEUTRO: Input = { x: 0, y: 0, jump: false, act: false, shoot: false };

export interface Ctx {
  f: Fase; e: Estado; i: 0 | 1;
  eu: EstadoJogador; outro: EstadoJogador;
  /** ticks desde o começo do passo */
  t: number;
  /** memória do passo (zerada a cada passo) */
  m: Record<string, number>;
}
/** Devolve a entrada do tick, ou null quando terminou (o próximo passo roda no mesmo tick). */
export type Passo = { nome: string; fn: (c: Ctx) => Partial<Input> | null };
export interface Etapa { nome: string; p: [Passo[], Passo[]]; /** segundos (padrão 40) */ limite?: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Entrada do joystick para chegar em x (freia perto). */
export const guiar = (eu: EstadoJogador, x: number, ganho = 4) => clamp(clamp((x - eu.x) * ganho, -5.2, 5.2) / 5.2, -1, 1);

function solidoEm(c: Ctx, px: number, py: number) {
  return solidos(c.f, c.e).some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
}

// ---------- passos ----------

/** Anda até x (pula sozinho degraus baixos se `degraus`). Termina parado perto de x, no chão. */
export function ir(x: number, o: { tol?: number; degraus?: boolean; juntoDe?: boolean } = {}): Passo {
  const tol = o.tol ?? 0.2;
  return {
    nome: `ir(${x.toFixed(1)})`,
    fn: (c) => {
      const { eu } = c;
      const dx = x - eu.x;
      if (Math.abs(dx) < tol && eu.noChao && Math.abs(eu.vx) < 1.5) return null;
      const dir = Math.sign(dx) || 1;
      let jump = false;
      if ((o.degraus ?? true) && eu.noChao && !(c.m.pula > 0) && Math.abs(dx) > 0.7 && solidoEm(c, eu.x + dir * 0.45, eu.y + 0.3)) c.m.pula = 24;
      if ((c.m.pula ?? 0) > 0) { jump = c.m.pula < 23; c.m.pula--; }
      return { x: guiar(eu, x), jump };
    },
  };
}

/** Pula em direção a `alvo`. Com `de`, corre até passar de `de` e pula de lá (salto com corrida). `alto`: segura o
 *  pulo (padrão). Termina ao pousar em qualquer lugar. */
export function saltar(alvo: number, o: { de?: number; alto?: boolean; cedo?: number; atraso?: number } = {}): Passo {
  return {
    nome: `saltar(${o.de?.toFixed(1) ?? '·'}→${alvo.toFixed(1)})`,
    fn: (c) => {
      const { eu, m } = c;
      const dir = Math.sign(alvo - (o.de ?? eu.x)) || 1;
      if (!m.saiu) {
        if (o.de !== undefined && eu.noChao && (eu.x - o.de) * dir < 0) return { x: dir, jump: false };
        if (!eu.noChao && !m.tentou) return { x: dir }; // ainda caindo de antes
        if (m.solto === undefined) { m.solto = 1; return { x: o.de !== undefined ? dir : guiar(eu, alvo), jump: false }; }
        m.tentou = 1;
        if (!eu.noChao) { m.saiu = 1; } else return { x: o.de !== undefined ? dir : guiar(eu, alvo), jump: true };
      }
      if (eu.noChao && c.t > 2) return null;
      const segurar = o.alto ?? true;
      m.ar = (m.ar ?? 0) + 1;
      return { x: m.ar <= (o.atraso ?? 0) ? 0 : guiar(eu, alvo, 3), jump: segurar && (o.cedo === undefined || m.ar < o.cedo) };
    },
  };
}

/** Espera até `pred` (mantendo `inp`). */
export function esperar(pred: (c: Ctx) => boolean, inp: Partial<Input> = {}, nome = 'esperar'): Passo {
  return { nome, fn: (c) => (pred(c) ? null : { ...inp }) };
}
export const pausa = (seg: number, inp: Partial<Input> = {}) => esperar((c) => c.t >= Math.round(seg * 60), inp, `pausa(${seg})`);
/** Passo livre: `fn` dá a entrada até `fim` ser verdadeiro. */
export function fazer(nome: string, fn: (c: Ctx) => Partial<Input>, fim: (c: Ctx) => boolean): Passo {
  return { nome, fn: (c) => (fim(c) ? null : fn(c)) };
}

/** Mãos dadas: aperta a mão até o parceiro ganhar o impulso (ou sair do chão). */
export function darImpulso(): Passo {
  return {
    nome: 'darImpulso',
    fn: (c) => {
      const { eu, outro, m } = c;
      if (m.deu && !outro.noChao) return null;
      if (m.deu && outro.impulso <= 0 && outro.noChao) m.deu = 0; // não pulou a tempo: de novo
      if (!m.deu && outro.impulso > 0) m.deu = 1;
      if (m.deu) return {};
      const perto = Math.abs(outro.x - eu.x) <= 1.3 && outro.y - eu.y <= 0.25 && eu.y - outro.y <= 3.5;
      return { act: eu.noChao && outro.noChao && Math.abs(outro.vx) < 0.8 && perto && c.t % 2 === 0 };
    },
  };
}
/** Espera o impulso do parceiro e dá o superpulo em direção a `alvo`. */
export function superpulo(alvo: number, o: { cedo?: number; esperarX?: number; atraso?: number } = {}): Passo {
  const s = saltar(alvo, { cedo: o.cedo, atraso: o.atraso });
  return {
    nome: `superpulo(→${alvo.toFixed(1)})`,
    fn: (c) => {
      if (!c.m.pronto) {
        if (c.eu.impulso > 0 && c.eu.noChao) { c.m.pronto = 1; c.m.t0 = c.t; }
        else return { x: o.esperarX !== undefined ? guiar(c.eu, o.esperarX) : 0 };
      }
      return s.fn({ ...c, t: c.t - c.m.t0 });
    },
  };
}

// ---------- predicados ----------
export const noChaoEm = (x0: number, x1: number, yMin = -99) => (j: EstadoJogador) => j.noChao && j.x >= x0 && j.x <= x1 && j.y >= yMin;
export const outroEm = (x0: number, x1: number, yMin = -99) => (c: Ctx) => noChaoEm(x0, x1, yMin)(c.outro);
export const euEm = (x0: number, x1: number, yMin = -99) => (c: Ctx) => noChaoEm(x0, x1, yMin)(c.eu);

// ---------- etapas comuns ----------
/** Os dois andam até x (Natan na frente, Bruna `atras` m atrás). */
export const andar = (x: number, atras = 1.2, o: { degraus?: boolean } = {}): Etapa => ({
  nome: `andar até ${x}`, p: [[ir(x, o)], [ir(x - atras, o)]],
});
/** Os dois saltam um vão: Natan primeiro, Bruna depois que ele pousar. */
export const saltarJuntos = (de: number, alvo: number, o: { alto?: boolean; cedo?: number; apos?: number; recuo?: number } = {}): Etapa => {
  const dir = Math.sign(alvo - de);
  const recuo = o.recuo ?? 1.6;
  return {
    nome: `saltar de ${de} até ${alvo}`,
    p: [
      [ir(de - dir * recuo * 0.5), saltar(alvo, { de, ...o }), ir(alvo + dir * (o.apos ?? 1.4))],
      [ir(de - dir * recuo), esperar((c) => c.outro.noChao && (c.outro.x - de) * dir > 1), saltar(alvo, { de, ...o }), ir(alvo)],
    ],
  };
};
/** Mãos dadas para subir num lugar alto: `quem` sobe com o impulso a partir de `base`, depois puxa o outro de cima
 *  (estando em `beira`, até 1,4 m na horizontal de quem ficou embaixo). */
export const subirComMaos = (base: number, alvo: number, beira: number, quem: 0 | 1 = 0, embaixo = base): Etapa => {
  const p: [Passo[], Passo[]] = [[], []];
  const sobe = quem, fica = (1 - quem) as 0 | 1;
  const dir = Math.sign(alvo - base) || 1;
  p[sobe] = [ir(base), esperar((c) => Math.abs(c.outro.x - base) < 1.1 && c.outro.noChao), superpulo(alvo), ir(beira), esperar((c) => c.outro.noChao && Math.abs(c.outro.x - c.eu.x) < 1.3 && c.t > 10), darImpulso(), esperar((c) => c.outro.noChao && c.outro.y > c.eu.y - 0.3 && c.t > 5)];
  p[fica] = [ir(base - dir * 0.5), darImpulso(), esperar((c) => c.outro.noChao && c.outro.y > c.eu.y + 1.5), ir(embaixo), superpulo(alvo + dir * 1.2, { esperarX: embaixo }), ir(alvo + dir * 1.2)];
  return { nome: `subir com as mãos em ${base}`, p };
};

// ---------- diretor ----------
export interface Relatorio {
  concluida: boolean; segundos: number; etapa: string; erro?: string;
  quedas: [number, number]; danos: [number, number]; bolhas: number; voltas: number;
  estrelinhas: number; derrotados: number; eventos: Record<string, number>;
}

const autoTiro = (e: Estado, eu: EstadoJogador) =>
  e.inimigos.some((n) => {
    if (!n.vivo) return false;
    const d = (n.x - eu.x) * eu.olhando;
    const m = INIMIGO[n.tipo];
    const y = eu.y + 0.6;
    return d > 0 && d < 8.5 && y >= n.y - 0.2 && y <= n.y + m.h + 0.2;
  }) || e.esporos.some((s) => { const d = (s.x - eu.x) * eu.olhando; return d > 0 && d < 8 && Math.abs(s.y - eu.y - 0.6) < 0.4; });

/** Roda o plano na fase (ou a partir de `e`). `cada` é chamado a cada tick (para medir). */
export function jogar(f: Fase, plano: Etapa[], o: { e?: Estado; limite?: number; cada?: (e: Estado) => void; log?: boolean } = {}): Relatorio & { e: Estado } {
  const e = o.e ?? estadoInicial(f);
  const r: Relatorio = { concluida: false, segundos: 0, etapa: '', quedas: [0, 0], danos: [0, 0], bolhas: 0, voltas: 0, estrelinhas: 0, derrotados: 0, eventos: {} };
  const limiteTotal = (o.limite ?? 600) * 60;
  let k = 0, tEtapa = 0;
  const idx: [number, number] = [0, 0], tPasso: [number, number] = [0, 0];
  const mem: [Record<string, number>, Record<string, number>] = [{}, {}];
  for (let tick = 0; tick < limiteTotal; tick++) {
    if (e.concluida) break;
    const etapa = plano[k];
    const ents: [Input, Input] = [{ ...NEUTRO }, { ...NEUTRO }];
    if (etapa) {
      r.etapa = etapa.nome;
      for (const i of [0, 1] as const) {
        const lista = etapa.p[i];
        for (let guarda = 0; guarda < 8 && idx[i] < lista.length; guarda++) {
          const c: Ctx = { f, e, i, eu: e.jogadores[i], outro: e.jogadores[1 - i], t: tPasso[i], m: mem[i] };
          const inp = lista[idx[i]].fn(c);
          if (inp === null) { idx[i]++; tPasso[i] = 0; mem[i] = {}; continue; }
          ents[i] = { ...NEUTRO, ...inp };
          break;
        }
        tPasso[i]++;
        if (ents[i].shoot === undefined || ents[i].shoot === false) ents[i].shoot = autoTiro(e, e.jogadores[i]);
      }
      if (idx[0] >= etapa.p[0].length && idx[1] >= etapa.p[1].length) {
        k++; idx[0] = idx[1] = 0; tPasso[0] = tPasso[1] = 0; mem[0] = {}; mem[1] = {}; tEtapa = 0;
        if (o.log) console.log(`  [${(tick / 60).toFixed(1)} s] ok: ${etapa.nome}`);
      } else if (++tEtapa > (etapa.limite ?? 40) * 60) {
        const j = e.jogadores;
        r.erro = `etapa "${etapa.nome}" passou do limite; passos ${etapa.p[0][idx[0]]?.nome ?? 'fim'} / ${etapa.p[1][idx[1]]?.nome ?? 'fim'}; ` +
          `Natan (${j[0].x.toFixed(2)}, ${j[0].y.toFixed(2)}) Bruna (${j[1].x.toFixed(2)}, ${j[1].y.toFixed(2)})`;
        break;
      }
    }
    passo(f, e, ents);
    for (const ev of e.eventos) {
      const tipo = ev.split(':')[0];
      r.eventos[tipo] = (r.eventos[tipo] ?? 0) + 1;
      if (ev.startsWith('caiu:')) r.quedas[+ev[5]]++;
      if (ev.startsWith('dano:')) r.danos[+ev[5]]++;
      if (ev.startsWith('bolha:')) r.bolhas++;
      if (ev === 'volta-checkpoint') r.voltas++;
      if (ev.startsWith('derrota:')) r.derrotados++;
    }
    o.cada?.(e);
    r.segundos = e.tick / 60;
  }
  if (!e.concluida && !r.erro) r.erro = k >= plano.length ? 'o plano acabou e a fase não foi concluída' : `tempo esgotado na etapa "${r.etapa}"`;
  r.concluida = e.concluida;
  r.estrelinhas = e.estrelinhasCasal;
  return { ...r, e };
}

/** Coloca os dois numa posição (para testar um trecho). */
export function posicionar(e: Estado, a: [number, number], b: [number, number]) {
  for (const [i, [x, y]] of [[0, a], [1, b]] as const) Object.assign(e.jogadores[i], { x, y, vx: 0, vy: 0, seguroX: x, seguroY: y, noChao: false });
}

/** De cima, puxa o parceiro (mãos dadas) e espera ele chegar. */
export const puxar = (): Passo[] => [darImpulso(), esperar((c) => c.outro.noChao && c.outro.y > c.eu.y - 0.3 && c.t > 5, {}, 'esperar subir')];

/** Carona na plataforma especial k: espera em `espera`; quando o canto esquerdo dela está em `xEmbarque`, sobe
 *  (pulando, se `pular`), fica em pé (a `dx` do meio) até o canto chegar em `xDesce` (ou `desce(c)`), e anda até
 *  `saida`. Se cair, volta a esperar. */
export function carona(k: number, espera: number, xEmbarque: number, xDesce: number | ((c: Ctx) => boolean), saida: number, o: { dx?: number; pular?: boolean; tol?: number } = {}): Passo {
  const andarEspera = ir(espera), andarSaida = ir(saida);
  return {
    nome: `carona(${k})`,
    fn: (c) => {
      const s = c.e.especiais[k], d = c.f.especiais![k], m = c.m;
      const sub = (p: Passo, chave: string) => {
        const mm: Record<string, number> = ((m as unknown as Record<string, Record<string, number>>)[chave] ??= {});
        return p.fn({ ...c, m: mm, t: (m['t' + chave] = (m['t' + chave] ?? 0) + 1) });
      };
      if (c.e.eventos.includes(`caiu:${c.i}`)) { m.fase = 0; delete (m as Record<string, unknown>).esp; m.tesp = 0; }
      const alvo = s.x + d.w / 2 + (o.dx ?? 0);
      for (let volta = 0; volta < 3; volta++) {
        const fase = m.fase ?? 0;
        if (fase === 0) { // ir até o ponto de espera
          const r = sub(andarEspera, 'esp');
          if (r !== null) return r;
          m.fase = 1; continue;
        }
        if (fase === 1) { // esperar a plataforma
          if (Math.abs(s.x - xEmbarque) <= (o.tol ?? 0.25) && s.ativa) { m.fase = 2; m.t2 = 0; continue; }
          return { x: guiar(c.eu, espera) };
        }
        if (fase === 2) { // subir
          if (c.eu.noChao && c.eu.plataforma === k && Math.abs(c.eu.x - alvo) < 0.35) { m.fase = 3; continue; }
          if (++m.t2 > 240 || (c.eu.noChao && c.eu.plataforma < 0 && Math.abs(s.x - xEmbarque) > 1.5)) { m.fase = 1; continue; }
          const pula = !!o.pular && m.t2 > 1;
          return { x: guiar(c.eu, alvo, 5), jump: pula && (c.eu.noChao ? m.t2 < 4 : true) };
        }
        if (fase === 3) { // viajar
          if (c.eu.noChao && c.eu.plataforma !== k) { m.fase = 1; continue; }
          const chegou = typeof xDesce === 'number' ? Math.abs(s.x - xDesce) < 0.2 : xDesce(c);
          if (!chegou) return { x: c.eu.plataforma === k ? guiar(c.eu, alvo, 2) * 0.5 : 0 };
          m.fase = 4;
        }
        break;
      }
      const r = sub(andarSaida, 'sai');
      return r;
    },
  };
}

/** Segura o fio (✋) parado até `ate`. */
export const segurarFio = (ate: (c: Ctx) => boolean) => esperar(ate, { act: true }, 'segurar o fio');
/** Desce da beira andando para `dir` até sair do chão. */
export const descerDaBeira = (dir: 1 | -1) => fazer('descer da beira', () => ({ x: dir }), (c) => !c.eu.noChao);
/** Previsão do voo depois de soltar o fio (mesma física do sim: no ar o joystick leva vx a ±5,2 m/s). Devolve a
 *  altura dos pés quando o centro passa de `xAlvo` (ou -Infinity se cair antes). */
export function preverVoo(x: number, y: number, vx: number, vy: number, dir: 1 | -1, xAlvo: number): number {
  for (let t = 0; t < 180; t++) {
    vx += Math.max(-0.5, Math.min(0.5, dir * 5.2 - vx));
    vy = Math.max(-18, vy - 0.5);
    x += vx / 60; y += vy / 60;
    if ((x - xAlvo) * dir >= 0) return y;
  }
  return -Infinity;
}
/** Pendurado no fio: bombeia o balanço e solta (✋) quando a previsão do voo passa por cima da beira de lá
 *  (centro em `alvo`, pés acima de `yAlvo`); voa até pousar. */
export function balancar(dir: 1 | -1, alvo: number, yAlvo: number, o: { folga?: number } = {}): Passo {
  return {
    nome: `balançar e soltar para ${alvo}`,
    fn: (c) => {
      const { eu, m } = c;
      if (c.e.eventos.includes(`soltou:${c.i}`)) m.solto = 1;
      if (m.solto) {
        if (eu.noChao) return null;
        return { x: dir, jump: true };
      }
      const solta = eu.pendurado && c.t > 30 && eu.vx * dir > 0 && preverVoo(eu.x, eu.y, eu.vx, Math.max(eu.vy, 0) + 3, dir, alvo) >= yAlvo + (o.folga ?? 0.15);
      return { x: eu.vx >= 0 ? 1 : -1, act: solta };
    },
  };
}
