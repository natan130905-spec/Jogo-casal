// Regras compartilhadas da arena: dano no Rei e nos jogadores, bolha, recomeço da fase, escudo e parede.
import { CRISTAIS, ESQUIVA, INICIO, PAREDE, PILARES, PODER, REI, VIDA } from './numeros';
import type { EstadoArena, JogadorArena, ReiArena } from './tipos';

export const ev = (e: EstadoArena, s: string) => { e.eventos.push(s); };
export const novoId = (e: EstadoArena) => e.proxId++;
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** Ruído determinístico 0…1 a partir de um inteiro (sem sorteio de verdade). */
export function ruido(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** O jogador participa da luta (pode ser mirado e levar dano)? No treino, só quem joga. */
export const emJogo = (e: EstadoArena, i: number) => !e.jogadores[i].bolha && (!e.treino || i === e.solo);

export function novoJogador(x: number, z: number): JogadorArena {
  return {
    x, y: 0, z, vx: 0, vy: 0, vz: 0, ang: Math.atan2(REI.inicio.x - x, REI.inicio.z - z), noChao: true,
    coracoes: VIDA.coracoes, invencivel: 0, bolha: false, poder: 0, desdePoder: 99,
    acao: 'livre', tAcao: 0, combo: 0, encadear: false, aplicou: false,
    recargaTiro: 0, recargaEsquiva: 0, recargaGolpe: 0, dx: 0, dz: 1, botoes: 0,
  };
}

export function novoRei(): ReiArena {
  return {
    x: REI.inicio.x, z: REI.inicio.z, ang: 0, vida: REI.vidaMax, fase: 1, etapa: 'descanso', t: 2, ataque: null,
    ciclo: 0, alvo: 0, escudo: false, vulneravel: 0, atordoado: 0, transicao: 0, ix: 0, iz: 0, resta: 0,
  };
}

/** Vida do Rei no começo de cada fase. */
export const vidaInicioFase = (f: number) => (f === 1 ? REI.vidaMax : Math.round(REI.vidaMax * REI.limiares[f - 2]));
/** Vida em que a fase atual termina. */
export const vidaFimFase = (f: number) => (f === 3 ? 0 : Math.round(REI.vidaMax * REI.limiares[f - 1]));

/** O Rei pode levar dano agora? */
export function reiVulneravel(e: EstadoArena): boolean {
  const r = e.rei;
  if (e.vitoria || r.transicao > 0) return false;
  if (r.fase === 2 && r.escudo) return false;
  if (r.fase === 3 && e.parede !== 0) return false;
  return true;
}

export function quebrarEscudo(e: EstadoArena) {
  const r = e.rei;
  if (r.fase === 2 && r.escudo) {
    r.escudo = false; r.vulneravel = REI.vulneravelEscudo;
    ev(e, 'escudo-quebra');
  }
}

export function derrubarParede(e: EstadoArena) {
  const r = e.rei;
  if (r.fase !== 3 || e.parede === 0) return;
  e.parede = 0; e.tParede = REI.vulneravelParede;
  e.cristais = e.cristais.map(() => 0);
  r.vulneravel = REI.vulneravelParede;
  atordoar(e, REI.vulneravelParede);
  ev(e, 'parede-cai');
}

/** Atordoa o Rei: interrompe o ataque em andamento (avisos do Rei somem). */
export function atordoar(e: EstadoArena, s: number) {
  const r = e.rei;
  if (e.vitoria || r.transicao > 0) return;
  r.atordoado = Math.max(r.atordoado, s);
  r.etapa = 'descanso'; r.t = Math.max(r.t, 0.4); r.ataque = null; r.resta = 0;
  e.perigos = e.perigos.filter((p) => p.fonte !== -1 || p.aviso <= 0);
  ev(e, 'atordoado');
}

/**
 * Dano no Rei. `quem` = jogador (0/1). Devolve true se o golpe "contou" para a barra de poder (acertou o Rei, mesmo
 * no escudo). Corta o dano no limite da fase (cada fase precisa ser jogada) e dispara a troca de fase / a vitória.
 */
export function ferirRei(e: EstadoArena, dano: number, quem: number, origem: string): boolean {
  const r = e.rei;
  if (e.vitoria) return false;
  if (!reiVulneravel(e)) {
    ev(e, `defendeu:${quem}:${origem}`);
    return r.transicao <= 0;
  }
  let d = dano;
  if (r.fase === 3) d *= REI.multEstrela;
  const fim = vidaFimFase(r.fase);
  const antes = r.vida;
  r.vida = Math.max(fim, r.vida - d);
  ev(e, `acerto-rei:${quem}:${origem}:${Math.round((antes - r.vida) * 10) / 10}`);
  if (r.vida <= fim) {
    if (r.fase === 3) vencer(e);
    else mudarFase(e, (r.fase + 1) as 2 | 3);
  }
  return true;
}

function vencer(e: EstadoArena) {
  const r = e.rei;
  e.vitoria = true; e.tVitoria = 0;
  r.etapa = 'descanso'; r.ataque = null; r.atordoado = 0; r.vulneravel = 0;
  e.perigos = []; e.lacaios = []; e.parede = 0; e.jardim = null;
  e.vagalume = { x: r.x, y: REI.altura * 0.6, z: r.z };
  ev(e, 'chefe-derrotado'); ev(e, 'vaga-lume'); ev(e, 'vitoria');
}

/** Começa a fase n do Rei (rugido de transição; limpa os ataques, restaura os pilares). */
export function mudarFase(e: EstadoArena, n: 2 | 3) {
  const r = e.rei;
  r.fase = n; r.vida = vidaInicioFase(n);
  prepararFase(e);
  r.transicao = REI.transicao;
  ev(e, `chefe-fase:${n}`);
}

/** Estado limpo da fase atual do Rei (usado na troca de fase e ao recomeçar). */
function prepararFase(e: EstadoArena) {
  const r = e.rei;
  r.etapa = 'descanso'; r.t = REI.descanso[r.fase - 1]; r.ataque = null; r.ciclo = 0; r.resta = 0;
  r.atordoado = 0; r.vulneravel = 0; r.escudo = r.fase === 2;
  e.perigos = []; e.lacaios = []; e.disparos = []; e.jardim = null;
  e.pilares = PILARES.pos.map(() => PILARES.vida);
  e.cristais = CRISTAIS.pos.map(() => 0);
  e.parede = r.fase === 3 ? 1 : 0;
  e.tParede = r.fase === 3 ? PAREDE.aviso : 0;
}

/** Os dois caíram: recomeça a fase atual do chefe (não a luta toda). A barra de poder fica. */
export function recomecarFase(e: EstadoArena) {
  const r = e.rei;
  r.vida = vidaInicioFase(r.fase);
  r.x = r.fase === 3 ? 0 : REI.inicio.x; r.z = r.fase === 3 ? 0 : REI.inicio.z;
  prepararFase(e);
  r.transicao = REI.transicao;
  e.jogadores.forEach((j, i) => {
    const p = novoJogador(INICIO[i].x, INICIO[i].z);
    p.poder = j.poder; p.invencivel = REI.transicao + VIDA.invencivelRenasce;
    e.jogadores[i] = p;
  });
  e.recomecos++;
  ev(e, `recomeca-fase:${r.fase}`);
}

/** Vira bolha (ou, se o outro também está, recomeça a fase). */
export function virarBolha(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  const outro = e.jogadores[1 - i];
  if (!e.treino && outro.bolha) { recomecarFase(e); return; }
  j.bolha = true; j.acao = 'livre'; j.vx = j.vy = j.vz = 0; j.invencivel = 0;
  ev(e, `bolha:${i}`);
}

/**
 * Um ataque alcança o jogador i, vindo de (fx, fz). Respeita invencibilidade; esquiva no último instante enche o
 * poder (uma vez por perigo: passe `perigo` para marcar). Devolve true se tomou dano.
 */
export function atingirJogador(e: EstadoArena, i: number, fx: number, fz: number, origem: string, marcar?: { atingiu: number }): boolean {
  if (!emJogo(e, i)) return false;
  const j = e.jogadores[i];
  const bit = 1 << i;
  if (marcar && marcar.atingiu & bit) return false;
  if (marcar) marcar.atingiu |= bit;
  // rolando (início da esquiva) ou usando o poder: protegido
  const esquivando = (j.acao === 'esquiva' && j.tAcao < ESQUIVA.invencivel) || j.acao === 'poder';
  if (esquivando) {
    if (marcar) {
      j.poder = Math.min(PODER.max, j.poder + PODER.porEsquivaPerfeita);
      ev(e, `esquiva-perfeita:${i}`);
    }
    return false;
  }
  if (j.invencivel > 0) return false;
  j.coracoes--; j.invencivel = VIDA.invencivel;
  const dx = j.x - fx, dz = j.z - fz, n = Math.hypot(dx, dz) || 1;
  j.vx = (dx / n) * VIDA.recuo; j.vz = (dz / n) * VIDA.recuo;
  if (j.acao === 'golpe') { j.acao = 'livre'; j.encadear = false; }
  ev(e, `dano:${i}:${origem}`);
  if (j.coracoes <= 0) { j.coracoes = 0; virarBolha(e, i); }
  return true;
}
