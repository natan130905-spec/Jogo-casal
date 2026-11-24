// Rei-Pesadelo, bichinhos (bolotinhas e morcegos), perigos com aviso, pilares e parede de névoa da fase 3.
// Todo ataque nasce como um Perigo com `aviso` ≥ 0,8 s (a telegrafia) e só machuca depois.
import { atingirJogador, atordoar, derrubarParede, dist, emJogo, ev, novoId, ruido } from './comum';
import { CORPO, CRISTAIS, DT, ILHA, LACAIO, PAREDE, PILARES, REI, type TipoAtaque } from './numeros';
import type { EstadoArena, Lacaio, Perigo, TipoPerigo } from './tipos';

const FORMA: Record<TipoPerigo, Perigo['forma']> = { onda: 'anel', esporo: 'circulo', investida: 'linha', mergulho: 'circulo', bote: 'circulo' };

export function novoPerigo(e: EstadoArena, tipo: TipoPerigo, o: Partial<Perigo> & { x: number; z: number; r: number; aviso: number; dura: number }): Perigo {
  const p: Perigo = { id: novoId(e), tipo, forma: FORMA[tipo], x2: o.x, z2: o.z, t: 0, atingiu: 0, fonte: -1, ...o };
  e.perigos.push(p);
  ev(e, `aviso:${tipo}:${p.id}`);
  return p;
}

/** Raio atual de uma onda de choque (perigo em anel). */
export const raioOnda = (p: Perigo) => p.r + REI.onda.vel * p.t;

/** O segmento (ax, az)–(bx, bz) passa por um pilar inteiro? Devolve o índice ou -1. */
export function pilarNoCaminho(e: EstadoArena, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
  for (let k = 0; k < PILARES.pos.length; k++) {
    if (e.pilares[k] <= 0) continue;
    const c = PILARES.pos[k];
    const u = Math.max(0, Math.min(1, ((c.x - ax) * vx + (c.z - az) * vz) / l2));
    if (dist(ax + vx * u, az + vz * u, c.x, c.z) < PILARES.raio) return k;
  }
  return -1;
}

export function trincarPilar(e: EstadoArena, k: number, dano: number) {
  if (e.pilares[k] <= 0) return;
  e.pilares[k] = Math.max(0, e.pilares[k] - dano);
  ev(e, e.pilares[k] === 0 ? `pilar-quebra:${k}` : `pilar-trinca:${k}`);
}

/** Jogadores que podem ser mirados (no treino, só quem joga). */
function alvos(e: EstadoArena): number[] {
  return [0, 1].filter((i) => emJogo(e, i));
}

function escolherAlvo(e: EstadoArena): number {
  const a = alvos(e);
  if (a.length === 0) return -1;
  const r = e.rei;
  const prox = a.includes(1 - r.alvo) ? 1 - r.alvo : a[0];
  r.alvo = prox;
  return prox;
}

// ---------------------------------------------------------------- Rei

export function passoRei(e: EstadoArena) {
  const r = e.rei;
  if (e.vitoria) return;
  if (r.transicao > 0) { r.transicao = Math.max(0, r.transicao - DT); if (r.transicao === 0) ev(e, 'chefe-pronto'); return; }
  if (r.vulneravel > 0) {
    r.vulneravel = Math.max(0, r.vulneravel - DT);
    if (r.vulneravel === 0 && r.fase === 2 && !r.escudo) { r.escudo = true; ev(e, 'escudo-volta'); }
  }
  passoParede(e);
  if (r.atordoado > 0) { r.atordoado = Math.max(0, r.atordoado - DT); return; }

  const alvo = alvos(e);
  // olha e anda (fora da investida e da fase 3, em que fica no meio da névoa)
  if (r.etapa !== 'execucao' || r.ataque !== 'investida') {
    if (alvo.length) {
      let mx = 0, mz = 0;
      for (const i of alvo) { mx += e.jogadores[i].x / alvo.length; mz += e.jogadores[i].z / alvo.length; }
      const a = alvo.includes(r.alvo) ? e.jogadores[r.alvo] : e.jogadores[alvo[0]];
      r.ang = Math.atan2(a.x - r.x, a.z - r.z);
      if (r.etapa === 'descanso' && r.fase !== 3) {
        const d = dist(mx, mz, r.x, r.z);
        if (d > REI.distancia) {
          const v = Math.min(REI.vel * DT, d - REI.distancia);
          r.x += ((mx - r.x) / d) * v; r.z += ((mz - r.z) / d) * v;
        }
      }
    }
    if (r.fase === 3) { r.x += (0 - r.x) * Math.min(1, 3 * DT); r.z += (0 - r.z) * Math.min(1, 3 * DT); }
    const rr = Math.hypot(r.x, r.z);
    if (rr > REI.raioMax) { r.x *= REI.raioMax / rr; r.z *= REI.raioMax / rr; }
  }

  r.t -= DT;
  if (r.etapa === 'execucao' && r.ataque === 'investida') { passoInvestida(e); return; }
  if (r.t > 0) return;
  if (r.etapa === 'descanso') comecarAtaque(e);
  else if (r.etapa === 'aviso') executar(e);
  else { r.etapa = 'descanso'; r.ataque = null; r.t = REI.descanso[r.fase - 1]; }
}

/** Há perigo ainda não resolvido a menos de `raio` m de (x, z)? (ataques não se sobrepõem: dá para ler um de cada vez) */
function perigoPerto(e: EstadoArena, x: number, z: number, raio: number): boolean {
  return e.perigos.some((p) => (p.forma === 'circulo' ? dist(p.x, p.z, x, z) < raio + p.r : p.forma === 'linha'));
}

function comecarAtaque(e: EstadoArena) {
  const r = e.rei;
  // espera o bote/mergulho dos bichinhos terminar antes de começar um ataque novo
  if (e.perigos.some((p) => p.fonte !== -1)) { r.t = 0.2; return; }
  const ciclo = REI.ciclos[r.fase - 1];
  let ataque: TipoAtaque = ciclo[r.ciclo % ciclo.length];
  r.ciclo++;
  const bolotinhas = e.lacaios.filter((l) => l.tipo === 'bolotinha').length;
  const morcegos = e.lacaios.filter((l) => l.tipo === 'morcego').length;
  if (ataque === 'invocar' && bolotinhas >= LACAIO.bolotinha.max) ataque = 'esporos';
  if (ataque === 'morcegos' && morcegos >= LACAIO.morcego.max) ataque = 'esporos';
  if (ataque === 'investida' && r.fase === 3) ataque = 'esporos';
  const alvo = escolherAlvo(e);
  if (alvo < 0) { r.t = 0.5; return; }
  const aviso = REI.aviso[r.fase - 1];
  r.ataque = ataque; r.etapa = 'aviso'; r.t = aviso;
  ev(e, `chefe-ataque:${ataque}`);
  if (ataque === 'pancada') {
    novoPerigo(e, 'onda', { x: r.x, z: r.z, r: REI.raio, aviso, dura: (REI.onda.raioMax - REI.raio) / REI.onda.vel });
  } else if (ataque === 'esporos') {
    for (const i of alvos(e)) {
      const j = e.jogadores[i];
      novoPerigo(e, 'esporo', { x: j.x, z: j.z, r: REI.esporo.raio, aviso, dura: REI.esporo.dura });
    }
    for (let k = 0; k < REI.esporo.extras; k++) {
      const a = ruido(e.tick * 7 + k) * Math.PI * 2, d = 3 + ruido(e.tick * 13 + k) * 7;
      novoPerigo(e, 'esporo', { x: Math.sin(a) * d, z: Math.cos(a) * d, r: REI.esporo.raio, aviso, dura: REI.esporo.dura });
    }
  } else if (ataque === 'investida') {
    const j = e.jogadores[alvo];
    let dx = j.x - r.x, dz = j.z - r.z;
    const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    // até onde vai: REI.investida.dist, sem passar do raio máximo do Rei + 2
    let l = 0;
    const lim = REI.raioMax + 2;
    while (l < REI.investida.dist && Math.hypot(r.x + dx * (l + 0.25), r.z + dz * (l + 0.25)) <= lim) l += 0.25;
    r.ix = dx; r.iz = dz; r.resta = l;
    novoPerigo(e, 'investida', { x: r.x, z: r.z, x2: r.x + dx * l, z2: r.z + dz * l, r: REI.investida.meiaLargura, aviso, dura: l / REI.investida.vel });
  } else if (ataque === 'invocar' || ataque === 'morcegos') {
    const tipo = ataque === 'invocar' ? 'bolotinha' : 'morcego';
    const q = tipo === 'bolotinha' ? LACAIO.bolotinha.quantos : LACAIO.morcego.quantos;
    for (let k = 0; k < q; k++) {
      const a = (k / q) * Math.PI * 2 + r.ang;
      const l: Lacaio = tipo === 'bolotinha'
        ? { id: novoId(e), tipo, x: r.x + Math.sin(a) * 2.6, y: 0, z: r.z + Math.cos(a) * 2.6, vida: LACAIO.bolotinha.vida, etapa: 'surgindo', t: aviso, ang: a, aux: -1, alvo: -1 }
        : { id: novoId(e), tipo, x: Math.sin(a) * LACAIO.morcego.raio, y: LACAIO.morcego.altura, z: Math.cos(a) * LACAIO.morcego.raio, vida: LACAIO.morcego.vida, etapa: 'surgindo', t: aviso, ang: a, aux: LACAIO.morcego.duraVida, alvo: -1 };
      const rr = Math.hypot(l.x, l.z);
      if (rr > ILHA.raio - 1) { l.x *= (ILHA.raio - 1) / rr; l.z *= (ILHA.raio - 1) / rr; }
      e.lacaios.push(l);
      ev(e, `surge:${tipo}:${l.id}`);
    }
  }
}

function executar(e: EstadoArena) {
  const r = e.rei;
  r.etapa = 'execucao';
  r.t = r.ataque === 'investida' ? 99 : REI.execucao[r.ataque ?? 'esporos'];
  ev(e, `chefe-golpe:${r.ataque}`);
}

function passoInvestida(e: EstadoArena) {
  const r = e.rei;
  const v = Math.min(REI.investida.vel * DT, r.resta);
  r.x += r.ix * v; r.z += r.iz * v; r.resta -= v;
  for (let k = 0; k < PILARES.pos.length; k++) {
    const c = PILARES.pos[k];
    if (e.pilares[k] > 0 && dist(r.x, r.z, c.x, c.z) < REI.raio + PILARES.raio) { e.pilares[k] = 1; trincarPilar(e, k, 1); }
  }
  const p = e.perigos.find((q) => q.tipo === 'investida' && q.fonte === -1);
  for (let i = 0; i < 2; i++) {
    const j = e.jogadores[i];
    if (j.y < REI.altura && dist(j.x, j.z, r.x, r.z) < REI.raio + CORPO.raio) atingirJogador(e, i, r.x - r.ix, r.z - r.iz, 'investida', p);
  }
  if (r.resta <= 1e-6) { r.etapa = 'descanso'; r.ataque = null; r.t = REI.descanso[r.fase - 1]; ev(e, 'investida-fim'); }
}

// ---------------------------------------------------------------- fase 3: parede de névoa e cristais

function passoParede(e: EstadoArena) {
  const r = e.rei;
  if (r.fase !== 3) return;
  for (let k = 0; k < e.cristais.length; k++) if (e.cristais[k] > 0) { e.cristais[k] = Math.max(0, e.cristais[k] - DT); if (e.cristais[k] === 0) ev(e, `cristal-apaga:${k}`); }
  if (e.parede === 1) {
    e.tParede -= DT;
    if (e.tParede <= 0) { e.parede = 2; ev(e, 'parede-ergueu'); }
  } else if (e.parede === 2) {
    if (e.cristais.every((c) => c > 0)) { ev(e, 'cristais-juntos'); derrubarParede(e); }
  } else {
    e.tParede -= DT;
    if (e.tParede <= 0) { e.parede = 1; e.tParede = PAREDE.aviso; ev(e, 'parede-sobe'); }
  }
}

/** Acerto num cristal (fase 3, parede de pé). No treino, um cristal acende os dois. */
export function acenderCristal(e: EstadoArena, k: number) {
  if (e.rei.fase !== 3 || e.parede !== 2) return;
  const t = e.jardim ? CRISTAIS.acesoJardim : CRISTAIS.aceso;
  const ks = e.treino ? e.cristais.map((_, q) => q) : [k];
  for (const q of ks) { if (e.cristais[q] <= 0) ev(e, `cristal:${q}`); e.cristais[q] = t; }
}

/** Lado de cada um enquanto há parede: Natan (0) em x < 0, Bruna (1) em x > 0. */
export const ladoParede = (i: number) => (i === 0 ? -1 : 1);

// ---------------------------------------------------------------- bichinhos

export function passoLacaios(e: EstadoArena) {
  for (const l of e.lacaios) {
    l.t -= DT;
    if (l.etapa === 'surgindo') { if (l.t <= 0) { l.etapa = 'andando'; l.t = l.tipo === 'morcego' ? LACAIO.morcego.intervalo * (0.4 + 0.3 * (l.id % 3)) : 0; } continue; }
    if (l.tipo === 'bolotinha') passoBolotinha(e, l);
    else passoMorcego(e, l);
  }
  e.lacaios = e.lacaios.filter((l) => l.vida > 0 && !(l.tipo === 'morcego' && l.aux <= 0));
}

function maisPerto(e: EstadoArena, x: number, z: number): number {
  let m = -1, md = Infinity;
  for (const i of alvos(e)) { const d = dist(x, z, e.jogadores[i].x, e.jogadores[i].z); if (d < md) { md = d; m = i; } }
  return m;
}

function passoBolotinha(e: EstadoArena, l: Lacaio) {
  const B = LACAIO.bolotinha;
  if (l.etapa === 'bote') {
    const p = e.perigos.find((q) => q.id === l.aux);
    if (!p || p.aviso <= 0) { if (p) { l.x = p.x; l.z = p.z; } l.etapa = 'descanso'; l.t = B.descanso; l.aux = -1; ev(e, `bote:${l.id}`); }
    return;
  }
  if (l.etapa === 'descanso') { if (l.t <= 0) l.etapa = 'andando'; return; }
  const i = maisPerto(e, l.x, l.z);
  if (i < 0) return;
  const j = e.jogadores[i];
  const d = dist(l.x, l.z, j.x, j.z);
  l.ang = Math.atan2(j.x - l.x, j.z - l.z);
  if (d < B.perto) {
    if (perigoPerto(e, j.x, j.z, 2.5)) return;
    const p = novoPerigo(e, 'bote', { x: j.x, z: j.z, r: B.raio, aviso: B.aviso, dura: 0.15, fonte: l.id });
    l.etapa = 'bote'; l.aux = p.id; l.alvo = i;
    return;
  }
  l.x += Math.sin(l.ang) * B.vel * DT; l.z += Math.cos(l.ang) * B.vel * DT;
  if (e.rei.fase === 3 && e.parede !== 0) {
    // não atravessa a névoa
    const lado = Math.sign(l.x) || 1;
    if (Math.abs(l.x) < PAREDE.meiaLargura + 0.4) l.x = lado * (PAREDE.meiaLargura + 0.4);
  }
}

function passoMorcego(e: EstadoArena, l: Lacaio) {
  const M = LACAIO.morcego;
  l.aux -= DT;
  l.ang += M.velAng * DT;
  l.x = Math.sin(l.ang) * M.raio; l.z = Math.cos(l.ang) * M.raio; l.y = M.altura;
  if (l.t <= 0) {
    const a = alvos(e);
    if (a.length) {
      const i = a[(l.id + Math.floor(e.tick / 60)) % a.length];
      const j = e.jogadores[i];
      const reiAtacando = e.rei.etapa !== 'descanso';
      if (reiAtacando || perigoPerto(e, j.x, j.z, 2.5)) { l.t = 0.25; return; }
      novoPerigo(e, 'mergulho', { x: j.x, z: j.z, r: M.raioMergulho, aviso: M.aviso, dura: 0.15, fonte: l.id });
      l.alvo = i;
      ev(e, `mergulha:${l.id}`);
    }
    l.t = M.intervalo;
  }
}

/** Golpe ou tiro num bichinho. Devolve true se acertou. */
export function ferirLacaio(e: EstadoArena, l: Lacaio, dano: number, quem: number): boolean {
  if (l.vida <= 0 || l.etapa === 'surgindo') return false;
  l.vida -= dano;
  if (l.vida <= 0) {
    l.vida = 0;
    ev(e, `derrota:${l.tipo}:${l.id}:${quem}`);
    if (l.tipo === 'bolotinha') e.perigos = e.perigos.filter((p) => p.fonte !== l.id || p.aviso <= 0);
  }
  return true;
}

// ---------------------------------------------------------------- perigos

export function passoPerigos(e: EstadoArena) {
  for (const p of e.perigos) {
    if (p.aviso > 0) {
      p.aviso -= DT;
      if (p.aviso > 0) continue;
      p.aviso = 0;
      ev(e, `perigo:${p.tipo}:${p.id}`);
    } else p.t += DT;
    if (p.forma === 'circulo') {
      for (let i = 0; i < 2; i++) {
        const j = e.jogadores[i];
        if (j.y < 2 && dist(j.x, j.z, p.x, p.z) < p.r + CORPO.raio * 0.75) atingirJogador(e, i, p.x, p.z, p.tipo, p);
      }
    } else if (p.forma === 'anel') {
      const ro = raioOnda(p);
      for (let i = 0; i < 2; i++) {
        const j = e.jogadores[i];
        const d = dist(j.x, j.z, p.x, p.z);
        if (Math.abs(d - ro) >= REI.onda.largura / 2 + CORPO.raio || j.y >= REI.onda.alturaPulo) continue;
        const k = pilarNoCaminho(e, p.x, p.z, j.x, j.z);
        if (k >= 0) {
          // atrás do pilar: protegido; o pilar trinca uma vez por onda
          if (!(p.atingiu & (4 << k))) { p.atingiu |= 4 << k; trincarPilar(e, k, 1); }
          continue;
        }
        atingirJogador(e, i, p.x, p.z, 'onda', p);
      }
    }
  }
  e.perigos = e.perigos.filter((p) => p.aviso > 0 || p.t < p.dura);
}

export { atordoar, derrubarParede };
