// Arsenal (L4; DESIGN_ARMAS §3, §4, §11): armas de brinquedo no lugar do Lança-Estrelas. Determinístico, sem DOM.
//
// - 4 espaços por jogador: corpo a corpo, tiro 1, tiro 2 e ferramenta. Começa com a Espada de Papelão e o
//   Estilingue de Xuxinha; o Estilingue tem 3 pedrinhas que voltam sozinhas (1 a cada 0,6 s): nunca acaba.
//   É a regra do recurso infinito (R21): todo obstáculo obrigatório se resolve com o Estilingue ou o corpo a corpo.
// - Miçangas (munição genérica) vão para a arma de munição com a menor porcentagem; sem arma de munição, ficam na
//   bolsa. Fontes: bichinho de índice par derrotado (meia carga), lanterna acesa e volta ao checkpoint (1 carga),
//   tiro que bate no Rei fechado (a pedrinha "defendida" cai como 1 miçanga).
// - Troca: espaço direto (1–4), próxima (6) e, na lanterna acesa, a mochila do casal (5). Leva 0,15 s.
// - Dar (🎁): com arma de munição, metade da reserva vai para o parceiro (até 8 m; mais longe cai no chão); com
//   corpo a corpo ou ferramenta, o item troca de mão com o do parceiro.
// - Sem fogo amigo: nada aqui fere jogador.
// - Elementos de fase: baú (item), alvo-sino (pedrinha), barbante (corpo a corpo corta), bloco rachado (Martelo).
//
// Eventos (Estado.eventos): tiro:i:arma golpe:i:arma carregado:i martelo-cai:i martelada:i troca:i:espaço
//   mochila:i:item dar:i:m|item pote:i:n bau:k:i:item sino:k barbante:k racha:k bate:k rebate:i defendeu:k
import { pontoDentro, sobrepoe } from './colisao';
import { caixaInimigo, ferir, INIMIGO } from './inimigos';
import type { Estado, EstadoArsenal, EstadoJogador, Faisca, Fase, Input, Ponto, Retangulo } from './types';

const DT = 1 / 60;

/** Ids do catálogo (DESIGN_ARMAS §4.1: o item nº n tem id n − 1). Só os do MVP aparecem nas fases. */
export const ITEM = Object.freeze({ estilingue: 0, espada: 1, martelo: 2, confeitos: 11 });

interface DefBase { id: number; nome: string; icone: string; raridade: 'comum' | 'rara' | 'casal'; mvp: boolean }
export interface DefTiro extends DefBase {
  espaco: 'tiro';
  dano: number;
  /** s entre tiros */
  cadencia: number;
  /** velocidade (m/s), gravidade (m/s²) e alcance (m) da pedrinha */
  vel: number; g: number; alcance: number;
  carga: number;
  /** recurso infinito: a carga volta sozinha (`volta` s por unidade) e não há reserva */
  infinita: boolean;
  volta?: number;
  reserva: number;
  /** s para recarregar a carga da reserva */
  recarga: number;
  carregado?: { tempo: number; dano: number; fura: number };
  leque?: { n: number; abertura: number };
}
export interface DefCorpo extends DefBase {
  espaco: 'corpo';
  /** dano de cada golpe do combo */
  danos: number[];
  /** s entre golpes e pausa extra depois do último do combo */
  intervalo: number; pausa: number;
  /** alcance à frente e altura do golpe (m) */
  alcance: number; altura: number;
  /** quebra bloco rachado */
  quebra: boolean;
  /** no ar, caindo: martelada em área ao pousar */
  martelada?: { dano: number; raio: number; vel: number };
}
export type DefItem = DefTiro | DefCorpo;

export const ITENS: Readonly<Record<number, DefItem>> = Object.freeze({
  [ITEM.estilingue]: {
    id: ITEM.estilingue, nome: 'Estilingue de Xuxinha', icone: '🎯', raridade: 'comum', mvp: true, espaco: 'tiro',
    dano: 1, cadencia: 0.4, vel: 15, g: 6, alcance: 9, carga: 3, infinita: true, volta: 0.6, reserva: 0, recarga: 0,
    carregado: { tempo: 0.6, dano: 2, fura: 1 },
  },
  [ITEM.espada]: {
    id: ITEM.espada, nome: 'Espada de Papelão', icone: '🗡️', raridade: 'comum', mvp: true, espaco: 'corpo',
    danos: [1, 1, 2], intervalo: 0.3, pausa: 0.25, alcance: 1.3, altura: 1.4, quebra: false,
  },
  [ITEM.martelo]: {
    id: ITEM.martelo, nome: 'Martelo de Brinquedo', icone: '🔨', raridade: 'comum', mvp: true, espaco: 'corpo',
    danos: [2], intervalo: 0.55, pausa: 0, alcance: 1.2, altura: 1.3, quebra: true,
    martelada: { dano: 3, raio: 1.5, vel: 14 },
  },
  // P1 (não aparece em nenhuma fase ainda): a primeira arma de munição, usada nos testes de miçanga e recarga
  [ITEM.confeitos]: {
    id: ITEM.confeitos, nome: 'Lançador de Confeitos', icone: '🍬', raridade: 'comum', mvp: false, espaco: 'tiro',
    dano: 1, cadencia: 1 / 1.2, vel: 13, g: 4, alcance: 6, carga: 8, infinita: false, reserva: 48, recarga: 1.5,
    leque: { n: 3, abertura: 30 },
  },
});

export const ARSENAL = Object.freeze({
  /** s da troca de arma */
  troca: 0.15,
  /** s sem atirar com a carga incompleta: recarrega */
  ocioso: 1.5,
  /** o combo recomeça depois de tantos s sem golpe */
  comboReinicia: 0.6,
  /** miçangas na bolsa (sem arma de munição) */
  bolsaMax: 60,
  /** miçangas de "uma carga" quando não há arma de munição para medir */
  micangasPorCarga: 6,
  /** o parceiro pega o que se joga até esta distância */
  darAlcance: 8,
  /** mira assistida: cone de ±cone graus em volta da mira do joystick (0–maxAng graus para cima), até `alcance` m */
  mira: { cone: 25, alcance: 9, maxAng: 60 },
  /** altura da mão (de onde sai a pedrinha) */
  alturaTiro: 0.6,
  /** lanterna: distância para usar a mochila */
  lanterna: 1.5,
});

/** Pontos de combate forçado (DESIGN_ARMAS §6; não há como desviar): ali os dois precisam ter recurso infinito à
 *  mão (o teste A3 confere com os bots). `rei`: a luta do Rei-Pesadelo, onde ele estiver. */
export const COMBATE_FORCADO: readonly { capitulo: number; x0?: number; x1?: number; rei?: boolean }[] = Object.freeze([
  { capitulo: 3, x0: 84, x1: 92 },
  { capitulo: 7, rei: true },
]);

/** O jogador tem recurso infinito à mão: o Estilingue num espaço de tiro e uma arma corpo a corpo. */
export function temRecursoInfinito(a: EstadoArsenal): boolean {
  return (a.itens[1] === ITEM.estilingue || a.itens[2] === ITEM.estilingue) && defItem(a.itens[0])?.espaco === 'corpo';
}

const bit = (id: number) => 1 << id;
export const DESBLOQUEADAS_INICIAIS = bit(ITEM.estilingue) | bit(ITEM.espada);
export const defItem = (id: number): DefItem | undefined => (id >= 0 ? ITENS[id] : undefined);
const ehTiro = (d: DefItem | undefined): d is DefTiro => d?.espaco === 'tiro';
const ehCorpo = (d: DefItem | undefined): d is DefCorpo => d?.espaco === 'corpo';
const ESPACO_DE = { corpo: [0], tiro: [1, 2], ferramenta: [3] } as const;

export function arsenalInicial(): EstadoArsenal {
  return {
    itens: [ITEM.espada, ITEM.estilingue, -1, -1], atual: 1,
    carga: [0, 3, 0, 0], reserva: [0, 0, 0, 0], relogio: [0, 0, 0, 0],
    espera: 0, ocioso: ARSENAL.ocioso, combo: 0, comboT: ARSENAL.comboReinicia, carregando: -1, martelada: false, bolsa: 0,
    atkAntes: false, darAntes: false, trocaAntes: 0,
  };
}

/** Elementos das armas no começo da fase (vão em Estado). */
export function elementosIniciais(fase: Fase) {
  return {
    alvos: (fase.alvos ?? []).map(() => -1),
    barbantes: (fase.barbantes ?? []).map(() => -1),
    rachados: (fase.rachados ?? []).map((r) => r.vida ?? 1),
    baus: (fase.baus ?? []).map(() => 0),
  };
}

/** Blocos rachados ainda inteiros (sólidos). */
export function rachadosInteiros(fase: Fase, e: Estado): Retangulo[] {
  const rs = fase.rachados ?? [];
  const out: Retangulo[] = [];
  for (let k = 0; k < rs.length; k++) if ((e.rachados?.[k] ?? 1) > 0) out.push(rs[k]);
  return out;
}

// ---------------------------------------------------------------- miçangas
/** Porcentagem de munição de um espaço de tiro de munição (1 = cheio). */
function cheio(a: EstadoArsenal, s: number) {
  const d = defItem(a.itens[s]);
  if (!ehTiro(d) || d.infinita) return 1;
  return (a.carga[s] + a.reserva[s]) / (d.carga + d.reserva);
}

/** Entrega miçangas ao arsenal: vão para a arma de munição mais vazia (a reserva), senão para a bolsa.
 *  `carga`: `q` é a fração de uma carga da arma escolhida. Devolve quantas couberam. */
export function receberMicangas(a: EstadoArsenal, q: number, carga = false): number {
  let alvo = -1, menor = 1;
  for (const s of ESPACO_DE.tiro) {
    const d = defItem(a.itens[s]);
    if (!ehTiro(d) || d.infinita) continue;
    const c = cheio(a, s);
    if (c < menor - 1e-9) { menor = c; alvo = s; }
  }
  if (alvo >= 0) {
    const d = defItem(a.itens[alvo]) as DefTiro;
    const n = carga ? Math.ceil(q * d.carga) : q;
    const cabe = Math.min(n, d.reserva - a.reserva[alvo]);
    a.reserva[alvo] += cabe;
    return cabe;
  }
  const n = carga ? Math.ceil(q * ARSENAL.micangasPorCarga) : q;
  const cabe = Math.max(0, Math.min(n, ARSENAL.bolsaMax - a.bolsa));
  a.bolsa += cabe;
  return cabe;
}

function soltarPote(e: Estado, x: number, y: number, q: number, carga = false) {
  if (e.semPotes) return;
  e.potes.push({ x, y, vy: 0, q, carga, t: 0 });
}

/** Bichinho derrotado: a estrelinha (como sempre) e, se o índice for par, um pote de meia carga. */
export function recompensaDerrota(e: Estado, k: number) {
  const n = e.inimigos[k];
  const m = INIMIGO[n.tipo];
  e.soltas.push({ x: n.x, y: n.y + m.h / 2, t: 0 });
  if (k % 2 === 0 && n.tipo !== 'rei') soltarPote(e, n.x, n.y + 0.2, 0.5, true);
}

function premio(e: Estado, p: Ponto, n: number) {
  for (let k = 0; k < n; k++) e.soltas.push({ x: p.x + (k - (n - 1) / 2) * 0.55, y: p.y, t: 0 });
}

// ---------------------------------------------------------------- mira
/** Ponto que a mira assistida escolhe para o jogador i (bichinho mais perto, depois alvo-sino), ou null. */
export function mirar(fase: Fase, e: Estado, i: number, yJoy = 0, alcance: number = ARSENAL.mira.alcance): Ponto | null {
  const j = e.jogadores[i];
  const ox = j.x + j.olhando * 0.35, oy = j.y + ARSENAL.alturaTiro;
  const base = Math.max(0, Math.min(1, yJoy)) * ARSENAL.mira.maxAng;
  const ok = (x: number, y: number) => {
    const dx = (x - ox) * j.olhando, dy = y - oy;
    if (dx < 0.2) return Infinity;
    const d = Math.hypot(dx, dy);
    if (d > alcance) return Infinity;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.abs(ang - base) <= ARSENAL.mira.cone ? d : Infinity;
  };
  let melhor: Ponto | null = null, dm = Infinity;
  for (const n of e.inimigos) {
    if (!n.vivo) continue;
    const m = INIMIGO[n.tipo];
    const y = n.y + m.h / 2, d = ok(n.x, y);
    if (d < dm) { dm = d; melhor = { x: n.x, y }; }
  }
  if (melhor) return melhor;
  (fase.alvos ?? []).forEach((s, k) => {
    if ((e.alvos[k] ?? -1) > 0) return;
    const d = ok(s.x, s.y);
    if (d < dm) { dm = d; melhor = { x: s.x, y: s.y }; }
  });
  return melhor;
}

function disparar(fase: Fase, e: Estado, i: number, s: number, d: DefTiro, carregado: boolean, yJoy: number, ev: string[]) {
  const j = e.jogadores[i], a = j.arsenal;
  const ox = j.x + j.olhando * 0.35, oy = j.y + ARSENAL.alturaTiro;
  const alvo = mirar(fase, e, i, yJoy, d.alcance);
  let vx: number, vy: number, t: number;
  if (alvo) {
    // lançamento que passa pelo centro do alvo parado (a gravidade da pedrinha compensada)
    const dx = alvo.x - ox, dy = alvo.y - oy, T = Math.max(0.05, Math.hypot(dx, dy) / d.vel);
    vx = dx / T; vy = dy / T + (d.g * T) / 2; t = T + 0.25;
  } else {
    const ang = (Math.max(0, Math.min(1, yJoy)) * ARSENAL.mira.maxAng * Math.PI) / 180;
    vx = j.olhando * d.vel * Math.cos(ang); vy = d.vel * Math.sin(ang); t = d.alcance / d.vel;
  }
  const n = d.leque?.n ?? 1;
  for (let k = 0; k < n; k++) {
    const giro = n === 1 ? 0 : (((k - (n - 1) / 2) / ((n - 1) / 2)) * (d.leque!.abertura / 2) * Math.PI) / 180;
    const c = Math.cos(giro), sn = Math.sin(giro);
    const f: Faisca = {
      id: e.proxFaisca++, dono: i as 0 | 1, x: ox, y: oy, vx: vx * c - vy * sn, vy: vx * sn + vy * c, t, g: d.g, arma: d.id,
      dano: carregado && d.carregado ? d.carregado.dano : d.dano, fura: carregado && d.carregado ? d.carregado.fura : 0,
    };
    e.faiscas.push(f);
  }
  a.carga[s]--;
  a.espera = d.cadencia;
  a.ocioso = 0;
  ev.push(`tiro:${i}:${d.id}`);
}

// ---------------------------------------------------------------- corpo a corpo
/** Caixa do golpe do jogador i com a arma d. */
export function caixaGolpe(j: EstadoJogador, d: DefCorpo): Retangulo {
  const x0 = j.olhando > 0 ? j.x - 0.2 : j.x - d.alcance;
  return { x: x0, y: j.y - 0.1, w: d.alcance + 0.2, h: d.altura + 0.1 };
}

function quebrar(fase: Fase, e: Estado, k: number, ev: string[]) {
  e.rachados[k] = Math.max(0, e.rachados[k] - 1);
  if (e.rachados[k] > 0) { ev.push(`bate:${k}`); return; }
  const r = (fase.rachados ?? [])[k];
  ev.push(`racha:${k}`);
  premio(e, { x: r.x + r.w / 2, y: r.y + Math.min(0.6, r.h / 2) }, r.premio ?? 0);
}

function acertarArea(fase: Fase, e: Estado, caixa: Retangulo, dano: number, quebra: boolean, i: number, ev: string[]) {
  for (let k = 0; k < e.inimigos.length; k++) {
    const n = e.inimigos[k];
    if (!n.vivo || !sobrepoe(caixa, caixaInimigo(n))) continue;
    if (ferir(n, k, dano, ev)) recompensaDerrota(e, k);
  }
  const antes = e.esporos.length;
  e.esporos = e.esporos.filter((s) => !pontoDentro(caixa, s.x, s.y));
  if (e.esporos.length < antes) ev.push(`rebate:${i}`);
  (fase.barbantes ?? []).forEach((b, k) => {
    if (e.barbantes[k] >= 0) return;
    if (b.x < caixa.x || b.x > caixa.x + caixa.w || b.y1 < caixa.y || b.y0 > caixa.y + caixa.h) return;
    e.barbantes[k] = 0;
    ev.push(`barbante:${k}`);
    premio(e, b.premioEm ?? { x: b.x, y: b.y0 - 0.4 }, b.premio ?? 0);
  });
  (fase.rachados ?? []).forEach((r, k) => {
    if (e.rachados[k] <= 0 || !sobrepoe(caixa, { x: r.x - 0.05, y: r.y, w: r.w + 0.1, h: r.h })) return;
    if (quebra) quebrar(fase, e, k, ev); else ev.push(`bate:${k}`);
  });
}

function golpear(fase: Fase, e: Estado, i: number, d: DefCorpo, ev: string[]) {
  const j = e.jogadores[i], a = j.arsenal;
  const idx = a.combo % d.danos.length;
  const fim = idx === d.danos.length - 1;
  a.combo = fim ? 0 : idx + 1;
  a.comboT = 0;
  a.espera = d.intervalo + (fim ? d.pausa : 0);
  ev.push(`golpe:${i}:${d.id}`);
  acertarArea(fase, e, caixaGolpe(j, d), d.danos[idx], d.quebra, i, ev);
}

// ---------------------------------------------------------------- troca, mochila e dar
function equipar(a: EstadoArsenal, id: number) {
  const d = defItem(id);
  if (!d) return;
  let s: number;
  if (d.espaco === 'corpo') s = 0;
  else if (d.espaco === 'tiro') {
    // não tira o Estilingue (recurso infinito): a arma nova vai para o outro espaço de tiro
    if (a.itens[1] === id || a.itens[2] === id) s = a.itens[1] === id ? 1 : 2;
    else s = a.itens[2] < 0 || a.itens[1] === ITEM.estilingue ? 2 : 1;
  }
  else s = 3;
  a.itens[s] = id;
  a.atual = s;
  a.relogio[s] = 0;
  if (ehTiro(d)) {
    a.carga[s] = d.carga; a.reserva[s] = 0;
    if (!d.infinita && a.bolsa > 0) { const n = Math.min(a.bolsa, d.reserva); a.reserva[s] = n; a.bolsa -= n; }
  }
  a.espera = Math.max(a.espera, ARSENAL.troca); a.carregando = -1;
}

function perto(j: EstadoJogador, o: EstadoJogador, d: number) { return !o.bolha && Math.hypot(o.x - j.x, o.y - j.y) <= d; }

function trocar(fase: Fase, e: Estado, i: number, t: number, ev: string[]) {
  const j = e.jogadores[i], a = j.arsenal;
  if (t >= 1 && t <= 4 || t === 6) {
    let s = t - 1;
    if (t === 6) {
      s = -1;
      for (let k = 1; k <= 4; k++) { const c = (a.atual + k) % 4; if (a.itens[c] >= 0) { s = c; break; } }
    }
    if (s < 0 || s === a.atual || a.itens[s] < 0) return;
    a.atual = s; a.espera = Math.max(a.espera, ARSENAL.troca); a.carregando = -1;
    ev.push(`troca:${i}:${s + 1}`);
    return;
  }
  if (t !== 5 && t !== 7) return;
  // mochila do casal: só perto de lanterna acesa. 7 (segurar ⇆ no celular): mochila na lanterna, dar longe dela
  const lanternas = fase.lanternas ?? [];
  let naLanterna = false;
  for (let k = 0; k <= e.checkpoint && k < lanternas.length; k++) if (Math.abs(lanternas[k].x - j.x) <= ARSENAL.lanterna && Math.abs(lanternas[k].y - j.y) < 2.5) naLanterna = true;
  if (!naLanterna) { if (t === 7) dar(e, i, ev); return; }
  const s = a.atual, atual = a.itens[s];
  // o Estilingue não sai da mão se for o único (recurso infinito, R21)
  if (atual === ITEM.estilingue && a.itens[3 - s] !== ITEM.estilingue) return;
  const espaco = s === 0 ? 'corpo' : s === 3 ? 'ferramenta' : 'tiro';
  const outros = a.itens.filter((_, k) => k !== s);
  const lista: number[] = [];
  for (let id = 0; id < 16; id++) if (e.desbloqueadas & bit(id) && defItem(id)?.espaco === espaco && !outros.includes(id)) lista.push(id);
  if (!lista.length) return;
  const prox = lista[(lista.indexOf(atual) + 1) % lista.length];
  if (prox === atual) return;
  equipar(a, prox);
  a.atual = s;
  ev.push(`mochila:${i}:${prox}`);
}

function dar(e: Estado, i: number, ev: string[]) {
  const j = e.jogadores[i], o = e.jogadores[1 - i], a = j.arsenal, s = a.atual;
  const d = defItem(a.itens[s]);
  if (ehTiro(d)) {
    // metade das miçangas (da reserva da arma, ou da bolsa com arma infinita na mão)
    const deReserva = !d.infinita;
    const tem = deReserva ? a.reserva[s] : a.bolsa;
    const n = Math.ceil(tem / 2);
    if (n <= 0) return;
    if (deReserva) a.reserva[s] -= n; else a.bolsa -= n;
    let sobra = n;
    if (perto(j, o, ARSENAL.darAlcance)) sobra -= receberMicangas(o.arsenal, n);
    if (sobra > 0) e.potes.push({ x: perto(j, o, ARSENAL.darAlcance) ? o.x : j.x + j.olhando * 2, y: j.y + 0.5, vy: 2, q: sobra, t: 0 });
    ev.push(`dar:${i}:m`);
    return;
  }
  if (!d || !perto(j, o, ARSENAL.darAlcance)) return;
  // corpo a corpo ou ferramenta: os dois trocam o item do espaço
  const meu = a.itens[s], dele = o.arsenal.itens[s];
  a.itens[s] = dele; o.arsenal.itens[s] = meu;
  if (dele < 0) a.atual = 1;
  ev.push(`dar:${i}:item`);
}

// ---------------------------------------------------------------- passo
/** Armas do jogador i neste tick (depois do movimento dele): relógios, troca, dar, ataque e martelada. */
export function passoArmas(fase: Fase, e: Estado, i: number, inp: Input, ev: string[]) {
  const j = e.jogadores[i], a = j.arsenal;
  const atk = !!inp.shoot, t = inp.troca ?? 0, darAgora = !!inp.dar;
  const borda = atk && !a.atkAntes;
  a.espera = Math.max(0, a.espera - DT);
  a.comboT = Math.min(ARSENAL.comboReinicia, a.comboT + DT);
  if (a.comboT >= ARSENAL.comboReinicia) a.combo = 0;
  a.ocioso = Math.min(ARSENAL.ocioso, a.ocioso + DT);
  // pedrinhas que voltam e recarga das armas de munição
  for (const s of ESPACO_DE.tiro) {
    const d = defItem(a.itens[s]);
    if (!ehTiro(d)) continue;
    if (d.infinita) {
      if (a.carga[s] < d.carga) { a.relogio[s] += DT; if (a.relogio[s] >= (d.volta ?? 1) - 1e-9) { a.carga[s]++; a.relogio[s] = 0; } } else a.relogio[s] = 0;
    } else if (a.relogio[s] > 0) {
      a.relogio[s] -= DT;
      if (a.relogio[s] <= 1e-9) { const n = Math.min(d.carga - a.carga[s], a.reserva[s]); a.carga[s] += n; a.reserva[s] -= n; a.relogio[s] = 0; }
    } else if (a.carga[s] < d.carga && a.reserva[s] > 0 && (a.carga[s] === 0 || a.ocioso >= ARSENAL.ocioso)) a.relogio[s] = d.recarga;
  }
  if (j.bolha) { a.carregando = -1; a.martelada = false; a.atkAntes = atk; a.darAntes = darAgora; a.trocaAntes = t; return; }

  if (t && t !== a.trocaAntes) trocar(fase, e, i, t, ev);
  if (darAgora && !a.darAntes) dar(e, i, ev);

  const s = a.atual, d = defItem(a.itens[s]);
  if (ehTiro(d)) {
    if (borda && a.espera <= 0 && a.carga[s] >= 1) { disparar(fase, e, i, s, d, false, inp.y ?? 0, ev); a.carregando = 0; }
    else if (borda) a.carregando = 0;
    if (atk && a.carregando >= 0 && d.carregado) {
      const antes = a.carregando;
      a.carregando += DT;
      if (antes < d.carregado.tempo && a.carregando >= d.carregado.tempo) ev.push(`carregado:${i}`);
    }
    if (!atk) {
      if (d.carregado && a.carregando >= d.carregado.tempo && a.carga[s] >= 1) { a.espera = 0; disparar(fase, e, i, s, d, true, inp.y ?? 0, ev); }
      a.carregando = -1;
    }
  } else if (ehCorpo(d)) {
    a.carregando = -1;
    const noAr = !j.noChao && j.vy < 0 && j.argola < 0 && !j.pendurado;
    if (d.martelada && borda && noAr && !a.martelada) {
      a.martelada = true; j.vy = -d.martelada.vel; j.lancado = false;
      ev.push(`martelo-cai:${i}`);
    } else if (atk && a.espera <= 0 && !a.martelada) golpear(fase, e, i, d, ev);
  }
  // martelada: ao pousar, golpe em área
  if (a.martelada) {
    const dm = ehCorpo(d) ? d.martelada : undefined;
    if (!dm || j.argola >= 0 || j.pendurado) a.martelada = false;
    else if (j.noChao) {
      a.martelada = false; a.espera = (d as DefCorpo).intervalo;
      ev.push(`martelada:${i}`);
      acertarArea(fase, e, { x: j.x - dm.raio, y: j.y - 0.3, w: dm.raio * 2, h: 1.3 }, dm.dano, true, i, ev);
    }
  }
  a.atkAntes = atk; a.darAntes = darAgora; a.trocaAntes = t;
}

/** Projéteis: andam (com gravidade), somem na parede, estouram esporos, tocam sinos e acertam bichinhos. */
export function passoProjeteis(fase: Fase, e: Estado, sol: readonly Retangulo[], ev: string[]) {
  const vivos: Faisca[] = [];
  const alvos = fase.alvos ?? [];
  for (const f of e.faiscas) {
    f.vy = (f.vy ?? 0) - (f.g ?? 0) * DT;
    f.x += f.vx * DT; f.y += f.vy * DT; f.t -= DT;
    if (f.t <= 0 || sol.some((r) => pontoDentro(r, f.x, f.y))) continue;
    const ie = e.esporos.findIndex((s) => Math.abs(s.x - f.x) < 0.35 && Math.abs(s.y - f.y) < 0.35);
    if (ie >= 0) { e.esporos.splice(ie, 1); continue; }
    let gasta = false;
    for (let k = 0; k < alvos.length && !gasta; k++) {
      if (e.alvos[k] > 0 || Math.hypot(alvos[k].x - f.x, alvos[k].y - f.y) > 0.45) continue;
      const primeira = e.alvos[k] < 0;
      e.alvos[k] = alvos[k].tempo ?? 4;
      ev.push(`sino:${k}`);
      if (primeira) premio(e, alvos[k].premioEm ?? { x: alvos[k].x, y: alvos[k].y - 1 }, alvos[k].premio ?? 0);
      gasta = true;
    }
    for (let k = 0; k < e.inimigos.length && !gasta; k++) {
      const n = e.inimigos[k];
      if (!n.vivo || k === f.ult || !pontoDentro(caixaInimigo(n), f.x, f.y, 0.15)) continue;
      if (n.tipo === 'rei' && !n.aberto) {
        // tiro defendido: a pedrinha ricocheteia e cai como miçanga
        ev.push(`defendeu:${k}`);
        soltarPote(e, f.x - Math.sign(f.vx) * 0.4, f.y, 1);
        gasta = true; break;
      }
      if (ferir(n, k, f.dano ?? 1, ev)) recompensaDerrota(e, k);
      if ((f.fura ?? 0) > 0) { f.fura!--; f.ult = k; continue; }
      gasta = true;
    }
    if (!gasta) vivos.push(f);
  }
  e.faiscas = vivos;
}

/** Elementos e miçangas soltas (depois do movimento de todos): baús, sinos, barbantes, potes, lanternas. */
export function passoElementos(fase: Fase, e: Estado, sol: readonly Retangulo[], ev: string[]) {
  for (let k = 0; k < e.alvos.length; k++) if (e.alvos[k] > 0) e.alvos[k] = Math.max(0, e.alvos[k] - DT);
  for (let k = 0; k < e.barbantes.length; k++) if (e.barbantes[k] >= 0) e.barbantes[k] = Math.min(9, e.barbantes[k] + DT);
  (fase.baus ?? []).forEach((b, k) => {
    if (e.baus[k]) return;
    const caixa = { x: b.x - 0.5, y: b.y, w: 1, h: 0.9 };
    const i = e.jogadores.findIndex((j) => !j.bolha && sobrepoe(caixa, { x: j.x - 0.3, y: j.y, w: 0.6, h: 1.1 }));
    if (i < 0) return;
    e.baus[k] = 1;
    e.desbloqueadas |= bit(b.item);
    equipar(e.jogadores[i].arsenal, b.item);
    ev.push(`bau:${k}:${i}:${b.item}`);
  });
  // potes: caem até o chão e vão para quem encostar
  for (let k = e.potes.length - 1; k >= 0; k--) {
    const p = e.potes[k];
    p.t += DT;
    if (!sol.some((r) => pontoDentro(r, p.x, p.y - 0.02))) {
      p.vy = Math.max(-12, p.vy - 30 * DT);
      const y = p.y + p.vy * DT;
      const chao = sol.find((r) => pontoDentro(r, p.x, y));
      if (chao) { p.y = chao.y + chao.h; p.vy = 0; } else p.y = y;
    }
    if (p.y < fase.fundo) { e.potes.splice(k, 1); continue; }
    if (p.t < 0.3) continue;
    for (let i = 0; i < 2; i++) {
      const j = e.jogadores[i];
      if (j.bolha || Math.abs(j.x - p.x) > 0.65 || p.y < j.y - 0.4 || p.y > j.y + 1.4) continue;
      const n = receberMicangas(j.arsenal, p.q, p.carga);
      if (n <= 0) continue;
      ev.push(`pote:${i}:${n}`);
      e.potes.splice(k, 1);
      break;
    }
  }
  // baú de munição de cada lanterna: ao acender e a cada volta ao checkpoint
  if (!e.semPotes && ev.some((x) => x.startsWith('lanterna:') || x === 'volta-checkpoint')) for (const j of e.jogadores) receberMicangas(j.arsenal, 1, true);
}

/** Alvos-sino que estão segurando a porta `id` aberta agora (para o laço das portas de sim.ts). */
export function sinosDaPorta(fase: Fase, e: Estado, id: string): boolean[] {
  const r: boolean[] = [];
  (fase.alvos ?? []).forEach((s, k) => { if (s.abre === id) r.push(e.alvos[k] > 0); });
  return r;
}

// ---------------------------------------------------------------- bots e companheiro
/**
 * Ataque automático dos bots (e base do companheiro, L6): escolhe a arma e aperta ATACAR em pulsos (o aperto é que
 * conta). Corpo a corpo quando há bichinho, esporo, barbante ou bloco rachado (com o Martelo) ao alcance; senão o
 * Estilingue, quando a mira assistida acha bichinho ou alvo-sino. `quer`: atacar mesmo sem alvo (luta do Rei).
 */
export function autoAtaque(fase: Fase, e: Estado, i: number, quer = false): Partial<Input> {
  const j = e.jogadores[i], a = j.arsenal;
  if (j.bolha) return {};
  const pulso = (e.tick & 1) === 0;
  const corpo = defItem(a.itens[0]);
  let quer0 = false;
  if (ehCorpo(corpo)) {
    const cx = caixaGolpe(j, corpo);
    quer0 = e.inimigos.some((n) => n.vivo && !(n.tipo === 'rei' && !n.aberto) && sobrepoe(cx, caixaInimigo(n)))
      || (fase.barbantes ?? []).some((b, k) => e.barbantes[k] < 0 && b.x >= cx.x && b.x <= cx.x + cx.w && b.y0 <= cx.y + cx.h && b.y1 >= cx.y)
      || (corpo.quebra && (fase.rachados ?? []).some((r, k) => e.rachados[k] > 0 && sobrepoe(cx, { x: r.x - 0.05, y: r.y, w: r.w + 0.1, h: r.h })));
  }
  const esporo = e.esporos.some((s) => { const d = (s.x - j.x) * j.olhando; return d > 0 && d < 8 && Math.abs(s.y - j.y - 0.6) < 0.4; });
  const tiro = a.itens.findIndex((id, k) => k >= 1 && k <= 2 && ehTiro(defItem(id)) && (defItem(id) as DefTiro).infinita);
  const alvo = tiro >= 0 && (quer || esporo || mirar(fase, e, i) !== null);
  const querEspaco = quer0 ? 0 : alvo ? tiro : -1;
  if (querEspaco < 0) return {};
  if (a.atual !== querEspaco) return { troca: querEspaco + 1 };
  return { shoot: pulso };
}

// ---------------------------------------------------------------- rede e salvamento
// ordem: primeiro o que muda pouco e fica fora do padrão (itens, espaço, carga, bolsa), depois o que só sai do padrão
// por instantes (relógios, combo, bordas): com o jogador parado, a cauda some e sobram 3–4 números
const PADRAO = [0, 3, 0, 0, 0, 0, 0, 0, 0, ARSENAL.ocioso, 0, ARSENAL.comboReinicia, -1, 0, 0];
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Arsenal compacto para o instantâneo (vai no fim do vetor de cada jogador): números na ordem de PADRAO, sem a
 *  cauda igual ao padrão. O primeiro (itens e espaço) vai sempre. */
export function empacotarArsenal(a: EstadoArsenal): number[] {
  // itens (0–16 cada, base 17) e o espaço na mão num número só
  const pack = a.itens.reduce((acc, id, k) => acc + (id + 1) * 17 ** k, 0) * 4 + a.atual;
  const v = [pack, a.carga[1], a.bolsa, a.carga[2], a.reserva[1], a.reserva[2], r2(a.relogio[1]), r2(a.relogio[2]), r2(a.espera), r2(a.ocioso),
    a.combo, r2(a.comboT), r2(a.carregando), (a.martelada ? 1 : 0) | (a.atkAntes ? 2 : 0) | (a.darAntes ? 4 : 0), a.trocaAntes];
  let n = v.length;
  while (n > 1 && v[n - 1] === PADRAO[n - 1]) n--;
  v[0] = pack;
  return v.slice(0, n);
}
export function desempacotarArsenal(v: readonly number[]): EstadoArsenal {
  const g = (k: number) => v[k] ?? PADRAO[k];
  const pack = Math.floor(g(0) / 4);
  const itens = [0, 1, 2, 3].map((k) => (Math.floor(pack / 17 ** k) % 17) - 1) as [number, number, number, number];
  const bits = g(13);
  return {
    itens, atual: g(0) % 4, carga: [0, g(1), g(3), 0], reserva: [0, g(4), g(5), 0], relogio: [0, g(6), g(7), 0],
    espera: g(8), ocioso: g(9), combo: g(10), comboT: g(11), carregando: g(12),
    martelada: !!(bits & 1), atkAntes: !!(bits & 2), darAntes: !!(bits & 4), trocaAntes: g(14), bolsa: g(2),
  };
}

/** O que o salvamento guarda do arsenal (L2b grava em progresso; DESIGN_ARMAS §11): itens do casal e os espaços de
 *  cada um no último checkpoint. */
export interface ArsenalSalvo { armas: number; espacos: [number[], number[]] }
export function arsenalParaSalvar(e: Estado): ArsenalSalvo {
  return { armas: e.desbloqueadas, espacos: [e.jogadores[0].arsenal.itens.slice(), e.jogadores[1].arsenal.itens.slice()] };
}
/** Aplica um arsenal salvo num estado novo (só itens que existem e cabem no espaço; Estilingue e corpo garantidos). */
export function aplicarArsenalSalvo(e: Estado, s: ArsenalSalvo) {
  e.desbloqueadas = (s.armas | DESBLOQUEADAS_INICIAIS) & 0xffff;
  s.espacos.forEach((lista, i) => {
    const a = e.jogadores[i]?.arsenal;
    if (!a) return;
    lista.slice(0, 4).forEach((id, k) => {
      const d = defItem(id);
      const espaco = k === 0 ? 'corpo' : k === 3 ? 'ferramenta' : 'tiro';
      if (!d || d.espaco !== espaco || !(e.desbloqueadas & bit(id))) return;
      a.itens[k] = id;
      if (ehTiro(d)) a.carga[k] = d.carga;
    });
    if (!a.itens.slice(1, 3).includes(ITEM.estilingue)) { a.itens[1] = ITEM.estilingue; a.carga[1] = 3; }
    if (!ehCorpo(defItem(a.itens[0]))) a.itens[0] = ITEM.espada;
  });
}
