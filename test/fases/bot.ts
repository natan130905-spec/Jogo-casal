// Bots cooperativos roteirizados para provar que as fases são vencíveis com a simulação de verdade.
// Um "plano" é uma lista de etapas; cada etapa tem uma lista de passos para Natan (0) e outra para Bruna (1).
// Os passos de cada um correm em paralelo; a etapa só termina quando os dois acabam (barreira). Os passos podem
// esperar pelo outro (predicados sobre o estado), como dois jogadores combinando no sofá.
// As manobras (passos de um jogador) moram em src/core/companheiro/manobras.ts, que o companheiro do jogo também
// usa; aqui ficam o roteiro dos bots (etapas para os dois, com barreira) e o diretor que roda o plano.
import { estadoInicial, passo } from '../../src/core/sim';
import type { Estado, Input, Fase } from '../../src/core/types';
import { darImpulso, esperar, ir, NEUTRO, saltar, superpulo, type Ctx, type Passo } from '../../src/core/companheiro/manobras';
import { autoAtaque } from '../../src/core/arsenal';

export * from '../../src/core/companheiro/manobras';

export interface Etapa { nome: string; p: [Passo[], Passo[]]; /** segundos (padrão 40) */ limite?: number }

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

/** Roda o plano na fase (ou a partir de `e`). `cada` é chamado a cada tick (para medir). */
export function jogar(f: Fase, plano: Etapa[], o: { e?: Estado; limite?: number; cada?: (e: Estado) => void; log?: boolean; /** recebe as entradas de cada tick (para reproduzir no navegador) */ entradas?: (ents: [Input, Input]) => void } = {}): Relatorio & { e: Estado } {
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
        // autoAtaque (L4): escolhe a arma (troca) e aperta ATACAR em pulsos; o plano que pede `shoot` (luta do Rei)
        // ataca mesmo sem alvo na mira
        const auto = autoAtaque(f, e, i, ents[i].shoot === true);
        ents[i].shoot = !!auto.shoot;
        if (auto.troca && !ents[i].troca) ents[i].troca = auto.troca;
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
    o.entradas?.(ents);
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
