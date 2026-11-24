// Instantâneo compacto do Estado para a rede (anfitrião → convidado, ~20 por segundo). Só o que o convidado
// precisa para desenhar; números arredondados (posição em cm). O que depende só do tempo (plataformas móveis,
// giratórias e bolhas) não vai: o convidado recalcula pelo tick.
import { estadoInicial } from './sim';
import { posicionarNoTempo } from './plataformas';
import { DESBLOQUEADAS_INICIAIS, desempacotarArsenal, empacotarArsenal } from './arsenal';
import type { Estado, Fase } from './types';

export interface Instantaneo {
  v: 1;
  /** tick */
  k: number;
  /** jogadores: [x, y, vx, vy, bits, corações, invencível, estrelinhas, impulso, argola,
   *               arTicks, puloGuardado, semCorte, recarga, plataforma, raioArgola, esperaArgola, seguroX, seguroY,
   *               ...arsenal] (arsenal: src/core/arsenal.ts empacotarArsenal, a partir do índice 19; L4)
   *  bits: 1 noChao, 2 olhando para a direita, 4 bolha, 8 pendurado, 16 segurando o fio, 32 soltou o fio,
   *        64 lançado, 128 pulo segurado no último tick, 256 mão segurada.
   *  Os campos depois de `argola` são o estado interno do pulo (coyote, buffer, pulo mínimo) e da argola: sem eles,
   *  a predição do convidado (src/net/predicao.ts) rebobinaria de um estado diferente do anfitrião. */
  j: number[][];
  /** última entrada do convidado já aplicada pelo anfitrião (o `seq` dela); -1 = nenhuma. Opcional. */
  sq?: number;
  /** portas (0…1), na ordem de fase.portas */
  p: number[];
  /** placas pressionadas (0/1), na ordem de fase.placas */
  pl: number[];
  np: number;
  c: 0 | 1;
  ev: string[];
  /** bichinhos: 0 se derrotado, senão [x, y, vida, bits, fase] (bits: 1 dir direita, 2 ponto fraco aberto, 4 noChao) */
  i: (0 | number[])[];
  /** projéteis: [id, x, y, vx, arma, dano] (vx em m/s inteiros, só para o lado do rastro; sem arma 0 e dano 1 no
   *  fim, o padrão). O convidado só desenha os projéteis: a predição dele não depende deles (sem fogo amigo). */
  f: number[][];
  /** elementos das armas: [...alvos, ...barbantes, ...rachados, ...baús] (só se a fase tiver e algum mudou) */
  el?: number[];
  /** miçangas soltas: [x, y, q, carga] (só se houver) */
  po?: number[][];
  /** itens do casal (só se diferente do começo) */
  db?: number;
  /** esporos: [x, y, vx, vy] */
  s: number[][];
  /** estrelinhas da fase já pegas (índices) */
  co: number[];
  /** estrelinhas soltas: [x, y, t] */
  so: number[][];
  cp: number;
  /** plataformas que caem: [índice, x, y, s, t] (as outras especiais são recalculadas pelo tick) */
  pc: number[][];
  /** fio: [zona, comprimento, âncora, pendurado, frouxo] */
  fi: number[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function instantaneo(fase: Fase, e: Estado, eventos: string[] = e.eventos, sq?: number): Instantaneo {
  const defs = fase.especiais ?? [];
  return {
    v: 1, k: e.tick, ...(sq === undefined ? {} : { sq }),
    // posição e velocidade com 1 mm e 1 mm/s: a predição do convidado rebobina daqui (com 1 cm o erro somaria a cada
    // instantâneo e o próprio personagem tremeria)
    j: e.jogadores.map((j) => [
      r3(j.x), r3(j.y), r3(j.vx), r3(j.vy),
      (j.noChao ? 1 : 0) | (j.olhando > 0 ? 2 : 0) | (j.bolha ? 4 : 0) | (j.pendurado ? 8 : 0) | (j.segurando ? 16 : 0) | (j.soltouFio ? 32 : 0)
        | (j.lancado ? 64 : 0) | (j.pulouSegurado ? 128 : 0) | (j.maoSegurada ? 256 : 0),
      j.coracoes, r1(j.invencivel), j.estrelinhas, r3(j.impulso), j.argola,
      j.arTicks, j.puloGuardado, j.semCorte, r3(j.recarga), j.plataforma, r3(j.raioArgola), r3(j.esperaArgola), r2(j.seguroX), r2(j.seguroY),
      ...empacotarArsenal(j.arsenal),
    ]),
    p: fase.portas.map((p) => r2(e.portas[p.id] ?? 0)),
    pl: fase.placas.map((p) => (e.placasPressionadas[p.id] ? 1 : 0)),
    np: r2(e.noPortal), c: e.concluida ? 1 : 0, ev: eventos,
    i: e.inimigos.map((n) => (n.vivo ? [r2(n.x), r2(n.y), n.vida, (n.dir > 0 ? 1 : 0) | (n.aberto ? 2 : 0) | (n.noChao ? 4 : 0), n.fase] : 0)),
    f: e.faiscas.map((f) => {
      const v = [f.id, r2(f.x), r2(f.y), Math.round(f.vx), f.arma ?? 0, f.dano ?? 1];
      if (v[5] === 1) { v.pop(); if (v[4] === 0) v.pop(); }
      return v;
    }),
    ...elementos(fase, e),
    ...(e.potes.length ? { po: e.potes.map((p) => [r2(p.x), r2(p.y), p.q, p.carga ? 1 : 0]) } : {}),
    ...(e.desbloqueadas !== DESBLOQUEADAS_INICIAIS ? { db: e.desbloqueadas } : {}),
    s: e.esporos.map((s) => [r2(s.x), r2(s.y), r1(s.vx), r1(s.vy)]),
    co: [...e.coletadas],
    so: e.soltas.map((s) => [r2(s.x), r2(s.y), r1(s.t)]),
    cp: e.checkpoint,
    pc: e.especiais.flatMap((s, k) => (defs[k]?.tipo === 'cai' ? [[k, r2(s.x), r2(s.y), s.s, r1(s.t)]] : [])),
    fi: [e.fio.zona, r2(e.fio.comprimento), e.fio.ancora, e.fio.pendurado, e.fio.frouxo ? 1 : 0],
  };
}

function elementos(fase: Fase, e: Estado): { el?: number[] } {
  const v = [...e.alvos.map(r1), ...e.barbantes.map((t) => (t < 0 ? -1 : r1(t))), ...e.rachados, ...e.baus];
  if (!v.length) return {};
  const ini = [...(fase.alvos ?? []).map(() => -1), ...(fase.barbantes ?? []).map(() => -1), ...(fase.rachados ?? []).map((r) => r.vida ?? 1), ...(fase.baus ?? []).map(() => 0)];
  return v.every((x, k) => x === ini[k]) ? {} : { el: v };
}

/** Reconstrói um Estado completo (para desenhar) a partir do instantâneo. Campos internos ficam com o padrão. */
export function restaurar(fase: Fase, s: Instantaneo): Estado {
  const e = estadoInicial(fase);
  e.tick = s.k;
  s.j.forEach((v, i) => {
    const j = e.jogadores[i];
    const bits = v[4];
    Object.assign(j, {
      x: v[0], y: v[1], vx: v[2], vy: v[3],
      noChao: !!(bits & 1), olhando: bits & 2 ? 1 : -1, bolha: !!(bits & 4), pendurado: !!(bits & 8),
      segurando: !!(bits & 16), soltouFio: !!(bits & 32),
      coracoes: v[5], invencivel: v[6], estrelinhas: v[7], impulso: v[8], argola: v[9],
      seguroX: v[17] ?? v[0], seguroY: v[18] ?? v[1],
      lancado: !!(bits & 64), pulouSegurado: !!(bits & 128), maoSegurada: !!(bits & 256),
    });
    // estado interno do pulo e da argola (instantâneos antigos não têm: fica o padrão de novoJogador)
    if (v.length > 10) Object.assign(j, { arTicks: v[10], puloGuardado: v[11], semCorte: v[12], recarga: v[13], plataforma: v[14], raioArgola: v[15], esperaArgola: v[16] });
  });
  fase.portas.forEach((p, k) => { e.portas[p.id] = s.p[k] ?? 0; });
  fase.placas.forEach((p, k) => { e.placasPressionadas[p.id] = s.pl[k] === 1; });
  e.noPortal = s.np; e.concluida = s.c === 1; e.eventos = [...s.ev];
  s.i.forEach((v, k) => {
    const n = e.inimigos[k];
    if (!n) return;
    if (v === 0) { n.vivo = false; n.vida = 0; return; }
    Object.assign(n, { x: v[0], y: v[1], vida: v[2], dir: v[3] & 1 ? 1 : -1, aberto: !!(v[3] & 2), noChao: !!(v[3] & 4), fase: v[4] });
  });
  e.faiscas = s.f.map((f) => ({ id: f[0], dono: 0, x: f[1], y: f[2], vx: f[3], vy: 0, arma: f[4] ?? 0, dano: f[5] ?? 1, t: 0 }));
  s.j.forEach((v, i) => { if (e.jogadores[i] && v.length > 19) e.jogadores[i].arsenal = desempacotarArsenal(v.slice(19)); });
  if (s.el) {
    let k = 0;
    for (const lista of [e.alvos, e.barbantes, e.rachados, e.baus]) for (let n = 0; n < lista.length; n++) lista[n] = s.el[k++] ?? lista[n];
  }
  e.potes = (s.po ?? []).map((p) => ({ x: p[0], y: p[1], q: p[2], carga: p[3] === 1, vy: 0, t: 1 }));
  if (s.db !== undefined) e.desbloqueadas = s.db;
  e.esporos = s.s.map((v) => ({ x: v[0], y: v[1], vx: v[2], vy: v[3], t: 1 }));
  e.coletadas = [...s.co];
  e.soltas = s.so.map((v) => ({ x: v[0], y: v[1], t: v[2] }));
  e.estrelinhasCasal = e.jogadores[0].estrelinhas + e.jogadores[1].estrelinhas;
  e.checkpoint = s.cp;
  posicionarNoTempo(fase, e.especiais, s.k);
  for (const [k, x, y, st, t] of s.pc) {
    const p = e.especiais[k];
    if (p) Object.assign(p, { x, y, s: st, t, ativa: st !== 3 });
  }
  const [zona, comprimento, ancora, pendurado, frouxo] = s.fi;
  e.fio = { zona, comprimento, ancora, pendurado, frouxo: frouxo === 1 };
  return e;
}

/**
 * Estado entre dois instantâneos já restaurados (k de 0 a 1), para o convidado desenhar suave: jogadores,
 * bichinhos, faíscas (pelo id), esporos e plataformas. O resto vem do mais novo (`b`).
 */
export function interpolar(fase: Fase, a: Estado, b: Estado, k: number): Estado {
  const e = structuredClone(b);
  const mix = (x0: number, x1: number) => x0 + (x1 - x0) * k;
  e.jogadores.forEach((j, i) => {
    const ja = a.jogadores[i];
    // teletransporte (caiu, renasceu): não interpola
    if (Math.abs(ja.x - j.x) > 3 || Math.abs(ja.y - j.y) > 3) return;
    j.x = mix(ja.x, j.x); j.y = mix(ja.y, j.y);
  });
  e.inimigos.forEach((n, i) => {
    const na = a.inimigos[i];
    if (!na?.vivo || !n.vivo) return;
    n.x = mix(na.x, n.x); n.y = mix(na.y, n.y);
  });
  for (const f of e.faiscas) {
    const fa = a.faiscas.find((x) => x.id === f.id);
    if (fa) { f.x = mix(fa.x, f.x); f.y = mix(fa.y, f.y); }
  }
  if (a.esporos.length === e.esporos.length) e.esporos.forEach((s, i) => { s.x = mix(a.esporos[i].x, s.x); s.y = mix(a.esporos[i].y, s.y); });
  posicionarNoTempo(fase, e.especiais, mix(a.tick, b.tick));
  e.especiais.forEach((s, i) => {
    const sa = a.especiais[i];
    if ((fase.especiais ?? [])[i]?.tipo === 'cai' && sa && sa.s === s.s) { s.x = mix(sa.x, s.x); s.y = mix(sa.y, s.y); }
  });
  return e;
}
