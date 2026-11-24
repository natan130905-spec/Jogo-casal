// Simulação da Arena do Coração (capítulo 7, fase 3D final): passo fixo de 60 Hz, pura e determinística (sem
// Three.js, sem DOM, sem sorteio). Roda no anfitrião e no treino; o convidado só desenha os instantâneos.
//
// Eventos (EstadoArena.eventos, só do último passo; i = jogador 0 Natan / 1 Bruna, id = id do perigo/bichinho):
//   pulo:i pouso:i esquiva:i esquiva-perfeita:i caiu:i                          movimento
//   golpe:i:c (c = 0,1,2 do combo) tiro:i tiro-pilar:i                          armas
//   acerto-rei:i:<origem>:<dano> defendeu:i:<origem>   (origem: golpe tiro cometa jardim fio)
//   poder-cheio:i poder:i cometa:0 jardim:1 cura:i fio-vermelho                  poderes
//   dano:i:<origem> bolha:i renasce:i recomeca-fase:n                           vida
//   aviso:<tipo>:id perigo:<tipo>:id      (tipo: onda esporo investida mergulho bote)   telegrafia e impacto
//   chefe-ataque:<ataque> chefe-golpe:<ataque> investida-fim atordoado chefe-fase:n chefe-pronto
//   escudo-quebra escudo-volta parede-sobe parede-ergueu parede-cai cristal:k cristal-apaga:k cristais-juntos
//   surge:<tipo>:id mergulha:id bote:id derrota:<tipo>:id:i                     bichinhos
//   pilar-trinca:k pilar-quebra:k                                               pilares (k em PILARES.pos)
//   chefe-derrotado vaga-lume vitoria                                           fim
import {
  atingirJogador, atordoar, derrubarParede, dist, emJogo, ev, ferirRei, novoId, novoJogador, novoRei, quebrarEscudo,
  reiVulneravel, virarBolha,
} from './comum';
import { direcaoNoChao } from './entrada';
import {
  ARMAS, CORPO, CRISTAIS, DT, ESQUIVA, ILHA, INICIO, MOVIMENTO, PAREDE, PILARES, PODER, REI, TIRO, VIDA,
} from './numeros';
import { acenderCristal, ferirLacaio, ladoParede, passoLacaios, passoPerigos, passoRei } from './rei';
import type { EntradaArena, EstadoArena, JogadorArena, OpcoesArena } from './tipos';

export function estadoInicialArena(o: OpcoesArena = {}): EstadoArena {
  return {
    tick: 0, treino: !!o.treino, solo: o.solo ?? 0,
    jogadores: [novoJogador(INICIO[0].x, INICIO[0].z), novoJogador(INICIO[1].x, INICIO[1].z)],
    rei: novoRei(), perigos: [], lacaios: [], disparos: [],
    pilares: PILARES.pos.map(() => PILARES.vida), cristais: CRISTAIS.pos.map(() => 0), parede: 0, tParede: 0,
    jardim: null, vitoria: false, tVitoria: 0, vagalume: null, recomecos: 0, proxId: 1, eventos: [],
  };
}

/** Treino: passa o controle para o outro personagem. */
export function trocarSolo(e: EstadoArena) {
  const antes = e.jogadores[e.solo];
  e.solo = (1 - e.solo) as 0 | 1;
  const j = e.jogadores[e.solo];
  // quem passa a jogar herda a vida de quem jogava (a luta é de uma pessoa só)
  j.coracoes = antes.coracoes; j.bolha = antes.bolha; j.invencivel = Math.max(antes.invencivel, 0.5);
  antes.bolha = false; antes.coracoes = VIDA.coracoes;
}

/** Um passo de 1/60 s. `entradas[i]` é a entrada do jogador i (no treino, a do parceiro é ignorada). */
export function passoArena(e: EstadoArena, entradas: [EntradaArena, EntradaArena]): EstadoArena {
  e.eventos = [];
  e.tick++;
  const cheios = e.jogadores.map((j) => j.poder >= PODER.max);
  for (let i = 0; i < 2; i++) passoJogador(e, i, entradas[i]);
  if (e.treino) acompanhar(e);
  passoDisparos(e);
  passoJardim(e);
  if (!e.vitoria) {
    passoRei(e);
    passoLacaios(e);
    passoPerigos(e);
  } else passoVitoria(e);
  // o laço: perto do parceiro a barra enche
  const [a, b] = e.jogadores;
  if (!a.bolha && !b.bolha && dist(a.x, a.z, b.x, b.z) < PODER.perto) {
    for (const j of e.jogadores) j.poder = Math.min(PODER.max, j.poder + PODER.pertoPorSeg * DT);
  }
  e.jogadores.forEach((j, i) => { if (!cheios[i] && j.poder >= PODER.max) ev(e, `poder-cheio:${i}`); });
  return e;
}

// ---------------------------------------------------------------- jogadores

function passoJogador(e: EstadoArena, i: number, inp: EntradaArena) {
  const j = e.jogadores[i];
  const bits = (inp.pulo ? 1 : 0) | (inp.golpe ? 2 : 0) | (inp.esquiva ? 4 : 0) | (inp.poder ? 8 : 0);
  const novo = bits & ~j.botoes;
  j.botoes = bits;
  j.invencivel = Math.max(0, j.invencivel - DT);
  j.recargaTiro = Math.max(0, j.recargaTiro - DT);
  j.recargaEsquiva = Math.max(0, j.recargaEsquiva - DT);
  j.recargaGolpe = Math.max(0, j.recargaGolpe - DT);
  j.desdePoder = Math.min(99, j.desdePoder + DT);
  if (e.treino && i !== e.solo) return;
  if (j.bolha) { passoBolha(e, i); return; }

  const d = direcaoNoChao(inp);
  const podeAgir = j.acao === 'livre' || j.acao === 'golpe';
  if (novo & 8 && j.poder >= PODER.max && podeAgir) usarPoder(e, i, d);
  else if (novo & 4 && j.recargaEsquiva <= 0 && podeAgir) {
    if (d.m > 0.1) { j.dx = d.x; j.dz = d.z; } else { j.dx = Math.sin(j.ang); j.dz = Math.cos(j.ang); }
    j.ang = Math.atan2(j.dx, j.dz);
    j.acao = 'esquiva'; j.tAcao = 0; j.encadear = false;
    ev(e, `esquiva:${i}`);
  } else if (novo & 2) {
    if (j.acao === 'livre' && j.recargaGolpe <= 0) comecarGolpe(e, i, d, 0);
    else if (j.acao === 'golpe') j.encadear = true;
  }
  if (novo & 1 && j.noChao && (j.acao === 'livre' || j.acao === 'golpe')) {
    j.vy = MOVIMENTO.pulo; j.noChao = false; ev(e, `pulo:${i}`);
  }
  if (inp.tiro && j.recargaTiro <= 0 && j.acao === 'livre') atirar(e, i, d);

  let alvoVx = 0, alvoVz = 0, acel: number = j.noChao ? MOVIMENTO.acelChao : MOVIMENTO.acelAr;
  if (j.acao === 'esquiva') {
    j.vx = j.dx * ESQUIVA.vel; j.vz = j.dz * ESQUIVA.vel; acel = 0;
    j.tAcao += DT;
    if (j.tAcao >= ESQUIVA.dura) { j.acao = 'livre'; j.recargaEsquiva = ESQUIVA.recarga; j.vx *= 0.3; j.vz *= 0.3; }
  } else if (j.acao === 'poder') {
    acel = 0;
    j.tAcao += DT;
    if (i === 0) passoCometa(e, j);
    else {
      j.vx *= 0.8; j.vz *= 0.8;
      if (!j.aplicou && j.tAcao >= 0.3) { j.aplicou = true; aplicarJardim(e); }
      if (j.tAcao >= PODER.jardim.lancar) j.acao = 'livre';
    }
  } else if (j.acao === 'golpe') {
    const arma = ARMAS[i];
    alvoVx = d.x * d.m * MOVIMENTO.vel * MOVIMENTO.noGolpe;
    alvoVz = d.z * d.m * MOVIMENTO.vel * MOVIMENTO.noGolpe;
    if (j.tAcao < arma.tAcerto) { alvoVx += Math.sin(j.ang) * MOVIMENTO.avancoGolpe; alvoVz += Math.cos(j.ang) * MOVIMENTO.avancoGolpe; }
    j.tAcao += DT;
    if (!j.aplicou && j.tAcao >= arma.tAcerto) { j.aplicou = true; aplicarGolpe(e, i); }
    if (j.tAcao >= arma.dura) {
      if (j.encadear && j.combo < 2) comecarGolpe(e, i, d, j.combo + 1);
      else { if (j.combo === 2) j.recargaGolpe = arma.recargaCombo; j.acao = 'livre'; j.encadear = false; }
    }
  } else {
    alvoVx = d.x * d.m * MOVIMENTO.vel; alvoVz = d.z * d.m * MOVIMENTO.vel;
    if (d.m > 0.1) j.ang = Math.atan2(d.x, d.z);
  }
  if (acel > 0) {
    const ddx = alvoVx - j.vx, ddz = alvoVz - j.vz, n = Math.hypot(ddx, ddz), m = acel * DT;
    if (n <= m) { j.vx = alvoVx; j.vz = alvoVz; } else { j.vx += (ddx / n) * m; j.vz += (ddz / n) * m; }
  }
  j.vy -= MOVIMENTO.gravidade * DT;
  j.x += j.vx * DT; j.y += j.vy * DT; j.z += j.vz * DT;
  const r = Math.hypot(j.x, j.z);
  if (j.y <= 0 && j.y > -0.6 && r <= ILHA.raio) {
    if (!j.noChao) ev(e, `pouso:${i}`);
    j.y = 0; j.vy = 0; j.noChao = true;
  } else j.noChao = false;
  colidir(e, i);
  if (j.y < ILHA.queda) cair(e, i);
}

/** Para onde o golpe/tiro vai: com o joystick solto, ou apontando a até 45° do alvo, trava no alvo. */
function mirar(e: EstadoArena, i: number, d: { x: number; z: number; m: number }) {
  const j = e.jogadores[i];
  const alvo = alvoDaTrava(e, i);
  if (alvo) {
    const ax = alvo.x - j.x, az = alvo.z - j.z, n = Math.hypot(ax, az) || 1;
    if (n <= MOVIMENTO.travaAlvo && (d.m < 0.2 || (d.x * ax + d.z * az) / n >= Math.SQRT1_2)) { j.ang = Math.atan2(ax, az); return; }
  }
  if (d.m >= 0.2) j.ang = Math.atan2(d.x, d.z);
}

/** Alvo da trava: bolotinha muito perto; na fase 3 com parede, o cristal do seu lado; senão o Rei. */
export function alvoDaTrava(e: EstadoArena, i: number): { x: number; z: number } | null {
  const j = e.jogadores[i];
  let perto: { x: number; z: number } | null = null, md = 2.5;
  for (const l of e.lacaios) {
    if (l.tipo !== 'bolotinha' || l.etapa === 'surgindo') continue;
    const d = dist(l.x, l.z, j.x, j.z);
    if (d < md) { md = d; perto = l; }
  }
  if (perto) return perto;
  if (e.vitoria) return null;
  if (e.rei.fase === 3 && e.parede !== 0) {
    let k = 0, kd = Infinity;
    CRISTAIS.pos.forEach((c, q) => { const dd = dist(c.x, c.z, j.x, j.z); if (dd < kd) { kd = dd; k = q; } });
    return CRISTAIS.pos[k];
  }
  return e.rei;
}

function comecarGolpe(e: EstadoArena, i: number, d: { x: number; z: number; m: number }, combo: number) {
  const j = e.jogadores[i];
  mirar(e, i, d);
  j.acao = 'golpe'; j.tAcao = 0; j.combo = combo; j.encadear = false; j.aplicou = false;
  ev(e, `golpe:${i}:${combo}`);
}

const naFrente = (j: JogadorArena, x: number, z: number, cosMeio: number) => {
  const ax = x - j.x, az = z - j.z, n = Math.hypot(ax, az);
  if (n < 1e-6) return true;
  return (Math.sin(j.ang) * ax + Math.cos(j.ang) * az) / n >= cosMeio;
};

function aplicarGolpe(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  const arma = ARMAS[i];
  const dano = arma.golpes[j.combo];
  const cosMeio = Math.cos((arma.arco / 2) * (Math.PI / 180));
  const r = e.rei;
  if (!e.vitoria && j.y < REI.altura && dist(j.x, j.z, r.x, r.z) - REI.raio - CORPO.raio <= arma.alcance && naFrente(j, r.x, r.z, cosMeio)) {
    if (ferirRei(e, dano, i, 'golpe')) j.poder = Math.min(PODER.max, j.poder + PODER.porGolpe);
  }
  for (const l of e.lacaios) {
    if (l.tipo === 'morcego' && j.y < 0.6) continue;
    if (dist(j.x, j.z, l.x, l.z) - 0.5 - CORPO.raio <= arma.alcance && naFrente(j, l.x, l.z, cosMeio)) {
      if (ferirLacaio(e, l, dano, i)) j.poder = Math.min(PODER.max, j.poder + PODER.porLacaio);
    }
  }
  if (r.fase === 3 && e.parede === 2) {
    CRISTAIS.pos.forEach((c, k) => {
      if (dist(j.x, j.z, c.x, c.z) - CRISTAIS.raio - CORPO.raio <= arma.alcance && naFrente(j, c.x, c.z, cosMeio)) {
        acenderCristal(e, k); j.poder = Math.min(PODER.max, j.poder + PODER.porLacaio);
      }
    });
  }
}

function atirar(e: EstadoArena, i: number, d: { x: number; z: number; m: number }) {
  const j = e.jogadores[i];
  mirar(e, i, d);
  const sx = Math.sin(j.ang), sz = Math.cos(j.ang);
  e.disparos.push({
    id: novoId(e), dono: i as 0 | 1, x: j.x + sx * 0.5, y: j.y + TIRO.altura, z: j.z + sz * 0.5,
    vx: sx * TIRO.vel, vz: sz * TIRO.vel, resta: TIRO.alcance,
  });
  j.recargaTiro = TIRO.cadencia;
  ev(e, `tiro:${i}`);
}

function passoDisparos(e: EstadoArena) {
  const r = e.rei;
  e.disparos = e.disparos.filter((f) => {
    const px = f.x;
    f.x += f.vx * DT; f.z += f.vz * DT; f.resta -= TIRO.vel * DT;
    if (f.resta <= 0) return false;
    for (let k = 0; k < PILARES.pos.length; k++) {
      const c = PILARES.pos[k];
      if (e.pilares[k] > 0 && dist(f.x, f.z, c.x, c.z) < PILARES.raio + TIRO.raio) { ev(e, `tiro-pilar:${f.dono}`); return false; }
    }
    if (r.fase === 3 && e.parede === 2 && Math.sign(px) !== Math.sign(f.x)) return false; // a névoa engole
    if (!e.vitoria && f.y < REI.altura && dist(f.x, f.z, r.x, r.z) < REI.raio + TIRO.raio) {
      const j = e.jogadores[f.dono];
      if (ferirRei(e, TIRO.dano, f.dono, 'tiro')) j.poder = Math.min(PODER.max, j.poder + PODER.porTiro);
      return false;
    }
    for (const l of e.lacaios) {
      if (l.vida > 0 && dist(f.x, f.z, l.x, l.z) < 0.6 && ferirLacaio(e, l, TIRO.dano, f.dono)) return false;
    }
    if (r.fase === 3 && e.parede === 2) {
      for (let k = 0; k < CRISTAIS.pos.length; k++) {
        const c = CRISTAIS.pos[k];
        if (dist(f.x, f.z, c.x, c.z) < CRISTAIS.raio + TIRO.raio) { acenderCristal(e, k); return false; }
      }
    }
    return true;
  });
}

function usarPoder(e: EstadoArena, i: number, d: { x: number; z: number; m: number }) {
  const j = e.jogadores[i];
  j.poder = 0;
  mirar(e, i, d);
  j.dx = Math.sin(j.ang); j.dz = Math.cos(j.ang);
  j.acao = 'poder'; j.tAcao = 0; j.aplicou = false; j.encadear = false;
  ev(e, `poder:${i}`);
  ev(e, i === 0 ? 'cometa:0' : 'jardim:1');
  quebrarEscudo(e);
  const outro = e.jogadores[1 - i];
  if (!e.treino && !outro.bolha && outro.desdePoder <= PODER.fio.janela) {
    ev(e, 'fio-vermelho');
    derrubarParede(e);
    ferirRei(e, PODER.fio.dano, i, 'fio');
    if (!e.vitoria) atordoar(e, PODER.fio.atordoa);
    outro.desdePoder = 99; j.desdePoder = 99;
  } else j.desdePoder = 0;
}

function passoCometa(e: EstadoArena, j: JogadorArena) {
  const C = PODER.cometa;
  const nx = j.x + j.dx * C.vel * DT, nz = j.z + j.dz * C.vel * DT;
  if (Math.hypot(nx, nz) > ILHA.raio - 0.8 || j.tAcao >= C.dist / C.vel) { j.acao = 'livre'; j.vx = j.dx * 2; j.vz = j.dz * 2; return; }
  j.vx = j.dx * C.vel; j.vz = j.dz * C.vel;
  const r = e.rei;
  if (!j.aplicou && !e.vitoria && dist(j.x, j.z, r.x, r.z) < REI.raio + CORPO.raio + 0.4) {
    j.aplicou = true;
    const vulneravel = reiVulneravel(e);
    ferirRei(e, C.dano, 0, 'cometa');
    if (vulneravel && !e.vitoria) atordoar(e, C.atordoa);
  }
}

function aplicarJardim(e: EstadoArena) {
  const b = e.jogadores[1];
  const J = PODER.jardim;
  e.jardim = { x: b.x, z: b.z, t: J.dura };
  const curado = e.treino ? e.jogadores[e.solo] : e.jogadores[0];
  if (!curado.bolha && curado.coracoes < VIDA.coracoes) {
    curado.coracoes = Math.min(VIDA.coracoes, curado.coracoes + J.cura);
    ev(e, `cura:${e.jogadores.indexOf(curado)}`);
  }
  ferirRei(e, J.dano, 1, 'jardim');
}

function passoJardim(e: EstadoArena) {
  const g = e.jardim;
  if (!g) return;
  g.t -= DT;
  e.jogadores.forEach((j, i) => { if (j.bolha && dist(j.x, j.z, g.x, g.z) < PODER.jardim.raio) renascer(e, i); });
  if (g.t <= 0) e.jardim = null;
}

function colidir(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  const empurrar = (cx: number, cz: number, min: number) => {
    const dx = j.x - cx, dz = j.z - cz, d = Math.hypot(dx, dz);
    if (d >= min) return;
    const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : 1;
    j.x = cx + nx * min; j.z = cz + nz * min;
    const vn = j.vx * nx + j.vz * nz;
    if (vn < 0) { j.vx -= vn * nx; j.vz -= vn * nz; }
  };
  const r = e.rei;
  if (!e.vitoria && !(j.acao === 'poder' && i === 0) && j.y < REI.altura) empurrar(r.x, r.z, REI.raio + CORPO.raio);
  PILARES.pos.forEach((c, k) => { if (e.pilares[k] > 0) empurrar(c.x, c.z, PILARES.raio + CORPO.raio); });
  if (r.fase === 3) {
    CRISTAIS.pos.forEach((c) => empurrar(c.x, c.z, CRISTAIS.raio + CORPO.raio));
    const lado = ladoParede(i);
    if (e.parede === 2 && lado * j.x < PAREDE.meiaLargura + CORPO.raio) { j.x = lado * (PAREDE.meiaLargura + CORPO.raio); if (lado * j.vx < 0) j.vx = 0; }
    else if (e.parede === 1 && lado * j.x < 1.0) j.x += lado * PAREDE.empurrao * DT;
  }
}

function cair(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  const p = e.jogadores[1 - i];
  ev(e, `caiu:${i}`);
  j.coracoes = Math.max(0, j.coracoes - 1);
  j.acao = 'livre';
  // volta como bolha perto do parceiro (do lado de dentro da ilha)
  const n = Math.hypot(p.x, p.z) || 1;
  j.x = p.x - (p.x / n) * 1.5; j.z = p.z - (p.z / n) * 1.5; j.y = VIDA.alturaBolha;
  j.vx = j.vy = j.vz = 0;
  virarBolha(e, i);
}

function passoBolha(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  const p = e.jogadores[1 - i];
  const dx = p.x - j.x, dz = p.z - j.z, d = Math.hypot(dx, dz);
  if (d > 1e-6) {
    const v = Math.min(d, VIDA.velBolha * DT);
    j.x += (dx / d) * v; j.z += (dz / d) * v;
    j.ang = Math.atan2(dx, dz);
  }
  j.y += (VIDA.alturaBolha - j.y) * Math.min(1, 4 * DT);
  if (!p.bolha && d < VIDA.encostar) renascer(e, i);
}

function renascer(e: EstadoArena, i: number) {
  const j = e.jogadores[i];
  j.bolha = false;
  if (j.coracoes <= 0) j.coracoes = VIDA.coracoes;
  j.invencivel = VIDA.invencivelRenasce;
  j.vy = 0; j.noChao = false; j.acao = 'livre';
  if (e.rei.fase === 3 && e.parede !== 0) {
    const lado = ladoParede(i);
    if (lado * j.x < 1.5) j.x = lado * Math.max(1.5, Math.abs(j.x));
  }
  const rr = Math.hypot(j.x, j.z);
  if (rr > ILHA.raio - 1) { j.x *= (ILHA.raio - 1) / rr; j.z *= (ILHA.raio - 1) / rr; }
  ev(e, `renasce:${i}`);
}

/** Treino: o parceiro acompanha quem joga (sem levar dano), um pouco atrás. */
function acompanhar(e: EstadoArena) {
  const s = e.jogadores[e.solo];
  const f = e.jogadores[1 - e.solo];
  f.bolha = false; f.coracoes = VIDA.coracoes; f.acao = 'livre'; f.vy = 0; f.y = 0; f.noChao = true;
  if (s.bolha || !s.noChao || Math.hypot(s.x, s.z) > ILHA.raio - 1) return;
  const lado = e.solo === 0 ? 1 : -1;
  const tx = s.x - Math.sin(s.ang) * 1.4 + Math.cos(s.ang) * 0.8 * lado;
  const tz = s.z - Math.cos(s.ang) * 1.4 - Math.sin(s.ang) * 0.8 * lado;
  const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
  const v = Math.min(d, MOVIMENTO.vel * 1.3 * DT);
  if (d > 1e-6) { f.x += (dx / d) * v; f.z += (dz / d) * v; f.vx = (dx / d) * v / DT; f.vz = (dz / d) * v / DT; } else { f.vx = f.vz = 0; }
  f.ang = d > 0.3 ? Math.atan2(dx, dz) : s.ang;
}

function passoVitoria(e: EstadoArena) {
  e.tVitoria += DT;
  e.perigos = []; e.lacaios = [];
  const v = e.vagalume;
  if (!v) return;
  const [a, b] = e.jogadores;
  const tx = (a.x + b.x) / 2, tz = (a.z + b.z) / 2, ty = 1.8;
  const k = Math.min(1, 1.2 * DT);
  v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; v.z += (tz - v.z) * k;
}

export { emJogo, atingirJogador };
