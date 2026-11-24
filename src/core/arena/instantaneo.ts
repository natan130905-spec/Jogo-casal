// Instantâneo compacto da arena para a rede (anfitrião → convidado, ~20 por segundo): só o que o convidado precisa
// para desenhar, números arredondados (posição em cm). Mesmo uso de src/core/instantaneo.ts:
//   anfitrião: conexao.enviar({ t: 'sta', s: instantaneoArena(e, eventosAcumulados) })
//   convidado: const e = restaurarArena(s); desenhar interpolarArena(anterior, e, k)
import { estadoInicialArena } from './sim';
import type { AcaoJogador, EstadoArena, EtapaLacaio, EtapaRei, TipoLacaio, TipoPerigo } from './tipos';
import type { TipoAtaque } from './numeros';

const ACOES: AcaoJogador[] = ['livre', 'golpe', 'esquiva', 'poder'];
const ETAPAS: EtapaRei[] = ['descanso', 'aviso', 'execucao'];
const ATAQUES: (TipoAtaque | null)[] = [null, 'pancada', 'esporos', 'invocar', 'investida', 'morcegos'];
const PERIGOS: TipoPerigo[] = ['onda', 'esporo', 'investida', 'mergulho', 'bote'];
const LACAIOS: TipoLacaio[] = ['bolotinha', 'morcego'];
const ETAPAS_LACAIO: EtapaLacaio[] = ['surgindo', 'andando', 'bote', 'descanso'];

export interface InstantaneoArena {
  v: 1;
  /** tick */
  k: number;
  /** [treino 0/1, solo] */
  tr: [number, number];
  /** jogadores: [x, y, z, vx, vy, vz, ang, bits, corações, invencível, poder, ação, tAção, combo]
   *  bits: 1 noChao, 2 bolha; ação: 0 livre, 1 golpe, 2 esquiva, 3 poder */
  j: number[][];
  /** Rei: [x, z, ang, vida, fase, etapa, t, ataque, bits, vulnerável, atordoado, transição]
   *  etapa: 0 descanso 1 aviso 2 execução; ataque: 0 nenhum 1 pancada 2 esporos 3 invocar 4 investida 5 morcegos;
   *  bits: 1 escudo */
  r: number[];
  /** perigos: [id, tipo, x, z, r, x2, z2, aviso, t, dura] (tipo: 0 onda 1 esporo 2 investida 3 mergulho 4 bote) */
  p: number[][];
  /** bichinhos: [id, tipo, x, y, z, vida, etapa, ang] (tipo: 0 bolotinha 1 morcego) */
  l: number[][];
  /** Lança-Estrelas: [id, dono, x, y, z, vx, vz] */
  d: number[][];
  /** vida dos pilares */
  pi: number[];
  /** cristais acesos (s) */
  cr: number[];
  /** [parede, tParede] */
  pa: [number, number];
  /** Jardim de Luz: [x, z, t] ou 0 */
  ja: number[] | 0;
  /** [vitória 0/1, tVitória, vaga-lume x, y, z] */
  vi: number[];
  rc: number;
  ev: string[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function instantaneoArena(e: EstadoArena, eventos: string[] = e.eventos): InstantaneoArena {
  const r = e.rei;
  return {
    v: 1, k: e.tick, tr: [e.treino ? 1 : 0, e.solo],
    j: e.jogadores.map((j) => [
      r2(j.x), r2(j.y), r2(j.z), r1(j.vx), r1(j.vy), r1(j.vz), r2(j.ang),
      (j.noChao ? 1 : 0) | (j.bolha ? 2 : 0), j.coracoes, r1(j.invencivel), Math.floor(j.poder),
      ACOES.indexOf(j.acao), r2(j.tAcao), j.combo,
    ]),
    r: [r2(r.x), r2(r.z), r2(r.ang), r1(r.vida), r.fase, ETAPAS.indexOf(r.etapa), r2(r.t), ATAQUES.indexOf(r.ataque),
      r.escudo ? 1 : 0, r1(r.vulneravel), r1(r.atordoado), r1(r.transicao)],
    p: e.perigos.map((p) => [p.id, PERIGOS.indexOf(p.tipo), r2(p.x), r2(p.z), r2(p.r), r2(p.x2), r2(p.z2), r3(p.aviso), r3(p.t), r2(p.dura)]),
    l: e.lacaios.map((l) => [l.id, LACAIOS.indexOf(l.tipo), r2(l.x), r2(l.y), r2(l.z), l.vida, ETAPAS_LACAIO.indexOf(l.etapa), r2(l.ang)]),
    d: e.disparos.map((f) => [f.id, f.dono, r2(f.x), r2(f.y), r2(f.z), r1(f.vx), r1(f.vz)]),
    pi: [...e.pilares],
    cr: e.cristais.map(r1),
    pa: [e.parede, r1(e.tParede)],
    ja: e.jardim ? [r2(e.jardim.x), r2(e.jardim.z), r1(e.jardim.t)] : 0,
    vi: e.vagalume ? [e.vitoria ? 1 : 0, r1(e.tVitoria), r2(e.vagalume.x), r2(e.vagalume.y), r2(e.vagalume.z)] : [e.vitoria ? 1 : 0, r1(e.tVitoria)],
    rc: e.recomecos,
    ev: eventos,
  };
}

/** Reconstrói um EstadoArena (para desenhar) a partir do instantâneo. Campos internos ficam com o padrão. */
export function restaurarArena(s: InstantaneoArena): EstadoArena {
  const e = estadoInicialArena({ treino: s.tr[0] === 1, solo: s.tr[1] === 1 ? 1 : 0 });
  e.tick = s.k;
  s.j.forEach((v, i) => {
    const j = e.jogadores[i];
    if (!j) return;
    Object.assign(j, {
      x: v[0], y: v[1], z: v[2], vx: v[3], vy: v[4], vz: v[5], ang: v[6],
      noChao: !!(v[7] & 1), bolha: !!(v[7] & 2), coracoes: v[8], invencivel: v[9], poder: v[10],
      acao: ACOES[v[11]] ?? 'livre', tAcao: v[12], combo: v[13],
    });
  });
  const r = s.r, rei = e.rei;
  Object.assign(rei, {
    x: r[0], z: r[1], ang: r[2], vida: r[3], fase: r[4], etapa: ETAPAS[r[5]] ?? 'descanso', t: r[6],
    ataque: ATAQUES[r[7]] ?? null, escudo: !!(r[8] & 1), vulneravel: r[9], atordoado: r[10], transicao: r[11],
  });
  e.perigos = s.p.map((p) => ({
    id: p[0], tipo: PERIGOS[p[1]] ?? 'esporo', forma: p[1] === 0 ? 'anel' : p[1] === 2 ? 'linha' : 'circulo',
    x: p[2], z: p[3], r: p[4], x2: p[5], z2: p[6], aviso: p[7], t: p[8], dura: p[9], atingiu: 0, fonte: -1,
  }));
  e.lacaios = s.l.map((l) => ({
    id: l[0], tipo: LACAIOS[l[1]] ?? 'bolotinha', x: l[2], y: l[3], z: l[4], vida: l[5], etapa: ETAPAS_LACAIO[l[6]] ?? 'andando',
    t: 0, ang: l[7], aux: 0, alvo: -1,
  }));
  e.disparos = s.d.map((f) => ({ id: f[0], dono: f[1] === 1 ? 1 : 0, x: f[2], y: f[3], z: f[4], vx: f[5], vz: f[6], resta: 1 }));
  e.pilares = [...s.pi];
  e.cristais = [...s.cr];
  e.parede = (s.pa[0] === 1 || s.pa[0] === 2 ? s.pa[0] : 0);
  e.tParede = s.pa[1];
  e.jardim = s.ja === 0 ? null : { x: s.ja[0], z: s.ja[1], t: s.ja[2] };
  e.vitoria = s.vi[0] === 1; e.tVitoria = s.vi[1];
  e.vagalume = s.vi.length >= 5 ? { x: s.vi[2], y: s.vi[3], z: s.vi[4] } : null;
  e.recomecos = s.rc;
  e.eventos = [...s.ev];
  return e;
}

const mixAng = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * k;
};

/**
 * Estado entre dois instantâneos já restaurados (k de 0 a 1), para o convidado desenhar suave: jogadores, Rei,
 * bichinhos e disparos (pelo id), vaga-lume e o tempo dos perigos. O resto vem do mais novo (`b`).
 */
export function interpolarArena(a: EstadoArena, b: EstadoArena, k: number): EstadoArena {
  const e = structuredClone(b);
  const mix = (x0: number, x1: number) => x0 + (x1 - x0) * k;
  e.jogadores.forEach((j, i) => {
    const ja = a.jogadores[i];
    if (Math.abs(ja.x - j.x) > 3 || Math.abs(ja.z - j.z) > 3 || Math.abs(ja.y - j.y) > 3) return; // teletransporte
    j.x = mix(ja.x, j.x); j.y = mix(ja.y, j.y); j.z = mix(ja.z, j.z); j.ang = mixAng(ja.ang, j.ang, k);
  });
  if (Math.abs(a.rei.x - e.rei.x) < 4 && Math.abs(a.rei.z - e.rei.z) < 4) {
    e.rei.x = mix(a.rei.x, e.rei.x); e.rei.z = mix(a.rei.z, e.rei.z);
  }
  e.rei.ang = mixAng(a.rei.ang, e.rei.ang, k);
  for (const l of e.lacaios) {
    const la = a.lacaios.find((x) => x.id === l.id);
    if (la) { l.x = mix(la.x, l.x); l.y = mix(la.y, l.y); l.z = mix(la.z, l.z); l.ang = mixAng(la.ang, l.ang, k); }
  }
  for (const f of e.disparos) {
    const fa = a.disparos.find((x) => x.id === f.id);
    if (fa) { f.x = mix(fa.x, f.x); f.y = mix(fa.y, f.y); f.z = mix(fa.z, f.z); }
  }
  for (const p of e.perigos) {
    const pa = a.perigos.find((x) => x.id === p.id);
    if (pa) { p.aviso = mix(pa.aviso, p.aviso); p.t = mix(pa.t, p.t); }
  }
  if (a.vagalume && e.vagalume) {
    e.vagalume.x = mix(a.vagalume.x, e.vagalume.x); e.vagalume.y = mix(a.vagalume.y, e.vagalume.y); e.vagalume.z = mix(a.vagalume.z, e.vagalume.z);
  }
  e.tick = Math.round(mix(a.tick, b.tick));
  return e;
}
