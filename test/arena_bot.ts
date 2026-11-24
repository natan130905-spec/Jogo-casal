// Bots da Arena do Coração para os testes de balanceamento. Um bot lê o estado (como uma pessoa lê a tela: avisos
// no chão, onde está o Rei, a parede de névoa) e devolve uma EntradaArena. O perfil diz o quanto ele acerta (fração
// do tempo em que mira certo) e o quanto ele desvia (fração dos avisos a que reage). Sorteio com semente: os
// resultados são sempre os mesmos.
import {
  ARMAS, CORPO, CRISTAIS, ENTRADA_NEUTRA, ILHA, PILARES, PODER, REI, entradaParaDirecao, estadoInicialArena, passoArena, raioOnda,
  type EntradaArena, type EstadoArena, type OpcoesArena,
} from '../src/core/arena';

export interface PerfilBot {
  /** 0…1: fração das janelas de 0,5 s em que mira certo (no resto, golpeia/atira para o lado) */
  acerto: number;
  /** 0…1: fração dos avisos a que reage */
  desvio: number;
  semente: number;
}

export function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
  return { d: Math.hypot(px - (ax + vx * u), pz - (az + vz * u)), qx: ax + vx * u, qz: az + vz * u };
};

export class BotArena {
  private sorte: () => number;
  private reage = new Map<number, boolean>();
  private mira = true;
  private pulou = false;
  private esquivou = false;
  private podeu = false;
  constructor(readonly i: 0 | 1, readonly perfil: PerfilBot) { this.sorte = rng(perfil.semente); }

  entrada(e: EstadoArena): EntradaArena {
    const i = this.i;
    const j = e.jogadores[i];
    if (e.treino && i !== e.solo) return ENTRADA_NEUTRA;
    if (j.bolha) return ENTRADA_NEUTRA;
    if (e.tick % 30 === 0) this.mira = this.sorte() < this.perfil.acerto;

    // ameaças a que este bot reage (circulos e linhas) e o tempo até o impacto
    let pular = false, rolar = false;
    const ameacas: { dentro: (x: number, z: number) => boolean; t: number }[] = [];
    for (const p of e.perigos) {
      if (!this.reage.has(p.id)) this.reage.set(p.id, this.sorte() < this.perfil.desvio);
      if (!this.reage.get(p.id)) continue;
      if (p.forma === 'circulo') {
        const m = p.r + CORPO.raio + 0.5;
        ameacas.push({ dentro: (x, z) => Math.hypot(x - p.x, z - p.z) < m, t: p.aviso });
      } else if (p.forma === 'linha') {
        const m = p.r + CORPO.raio + 0.6;
        ameacas.push({ dentro: (x, z) => distSeg(x, z, p.x, p.z, p.x2, p.z2).d < m, t: p.aviso });
      } else {
        const d = Math.hypot(j.x - p.x, j.z - p.z);
        const ro = p.aviso > 0 ? p.r : raioOnda(p);
        const meia = 0.75; // meia largura da onda + corpo
        const tIni = p.aviso + Math.max(0, d - meia - ro) / 9, tFim = p.aviso + Math.max(0, d + meia - ro) / 9;
        if (tFim > 0 && tIni <= 0.12 && tFim - Math.max(0, tIni) < 0.5) {
          if (j.noChao) pular = true;
          else if (j.y < 0.6 && tIni <= 0.04) rolar = true;
        }
      }
    }
    const fora = (x: number, z: number) => Math.hypot(x, z) > ILHA.raio - 1.2 ||
      (e.rei.fase === 3 && e.parede !== 0 && !e.treino && (i === 0 ? x > -0.9 : x < 0.9));
    const emPerigo = (x: number, z: number) => ameacas.some((a) => a.dentro(x, z));
    /** o caminho na direção (sx, sz) por `l` m bate num pilar ou no Rei? */
    const bloqueado = (sx: number, sz: number, l: number) => {
      for (let u = 0.5; u <= l; u += 0.5) {
        const px = j.x + sx * u, pz = j.z + sz * u;
        if (Math.hypot(px - e.rei.x, pz - e.rei.z) < REI.raio + CORPO.raio) return true;
        if (PILARES.pos.some((c, k) => e.pilares[k] > 0 && Math.hypot(px - c.x, pz - c.z) < PILARES.raio + CORPO.raio)) return true;
      }
      return false;
    };
    let perigo = false, mx = 0, mz = 0;
    if (emPerigo(j.x, j.z)) {
      perigo = true;
      const tImpacto = Math.min(...ameacas.filter((a) => a.dentro(j.x, j.z)).map((a) => a.t));
      let achou = false;
      for (let dd = 0.75; dd <= 6 && !achou; dd += 0.75) {
        for (let k = 0; k < 24 && !achou; k++) {
          const a = (k / 24) * Math.PI * 2;
          const cx = j.x + Math.sin(a) * dd, cz = j.z + Math.cos(a) * dd;
          if (fora(cx, cz) || emPerigo(cx, cz)) continue;
          // o caminho não pode cruzar o Rei nem pilares
          if (bloqueado(Math.sin(a), Math.cos(a), dd)) continue;
          achou = true; mx = cx - j.x; mz = cz - j.z;
          if (dd / 6 > tImpacto - 0.05) rolar = true;
        }
      }
      if (!achou) { mx = -j.x; mz = -j.z; }
    }

    const r = e.rei;
    const out: EntradaArena = { ...ENTRADA_NEUTRA };
    if (perigo) {
      Object.assign(out, entradaParaDirecao(mx, mz));
    } else if (!e.vitoria) {
      // alvo: bolotinha perto, cristal (fase 3 com parede) ou o Rei
      let tx = r.x, tz = r.z, tr: number = REI.raio;
      const bol = e.lacaios.find((l) => l.tipo === 'bolotinha' && l.etapa !== 'surgindo' && Math.hypot(l.x - j.x, l.z - j.z) < 2.5);
      if (bol) { tx = bol.x; tz = bol.z; tr = 0.5; }
      else if (r.fase === 3 && e.parede !== 0) {
        const k = e.treino ? 0 : i;
        const c = e.treino ? (Math.hypot(CRISTAIS.pos[0].x - j.x, CRISTAIS.pos[0].z - j.z) < Math.hypot(CRISTAIS.pos[1].x - j.x, CRISTAIS.pos[1].z - j.z) ? CRISTAIS.pos[0] : CRISTAIS.pos[1]) : CRISTAIS.pos[k];
        tx = c.x; tz = c.z; tr = CRISTAIS.raio;
      }
      const dx = tx - j.x, dz = tz - j.z, d = Math.hypot(dx, dz);
      const alcance = ARMAS[i].alcance + tr + CORPO.raio - 0.35;
      const longe = d > alcance;
      if (longe) Object.assign(out, entradaParaDirecao(dx, dz));
      const atacar = !longe;
      const golpe = atacar && e.tick % 6 < 3;
      const tiro = longe && d < 12;
      if (golpe || tiro) {
        if (!this.mira) {
          // mira errada: joystick para longe do alvo (o golpe/tiro vai para o lado)
          Object.assign(out, entradaParaDirecao(-dz, dx));
          out.x *= 0.5; out.y *= 0.5;
        } else if (!longe) { out.x = 0; out.y = 0; }
        out.golpe = golpe; out.tiro = tiro;
      }
      // poder
      if (j.poder >= PODER.max) {
        const outro = e.jogadores[1 - i];
        const juntos = !e.treino && outro.poder >= PODER.max && !outro.bolha;
        let usar = false;
        if (r.transicao > 0) usar = false;
        else if (r.fase === 1) usar = d < 7;
        else if (r.fase === 2) usar = r.escudo ? d < 7 : false;
        else usar = (e.parede === 0 && r.vulneravel > 1) || (juntos && e.parede === 2);
        if (r.fase !== 3 && juntos) usar = usar && Math.hypot(r.x - j.x, r.z - j.z) < 7;
        if (usar && !this.podeu) { out.poder = true; out.x = 0; out.y = 0; }
      }
    }
    // longe da borda
    const rr = Math.hypot(j.x, j.z);
    if (rr > ILHA.raio - 2) {
      const nx = -j.x / rr, nz = -j.z / rr;
      const cur = entradaParaDirecao(out.x * 1 + nx * 2, -out.y + nz * 2);
      out.x = cur.x; out.y = cur.y;
    }
    out.pulo = pular && j.noChao && !this.pulou;
    out.esquiva = rolar && !this.esquivou && j.recargaEsquiva <= 0;
    if (out.esquiva) {
      // a rolagem anda ~4 m: escolhe a direção segura mais parecida com a do joystick (ou desiste)
      const qx = Math.hypot(out.x, out.y) > 0.1 ? out.x : Math.sin(j.ang), qz = Math.hypot(out.x, out.y) > 0.1 ? -out.y : Math.cos(j.ang);
      let melhor = -2, bx = 0, bz = 0;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
        const cx = j.x + sx * 4.2, cz = j.z + sz * 4.2;
        if (fora(cx, cz) || emPerigo(cx, cz) || fora(j.x + sx * 2, j.z + sz * 2) || bloqueado(sx, sz, 4.2)) continue;
        if (!j.noChao && fora(j.x + sx * 5.5, j.z + sz * 5.5)) continue;
        const n = Math.hypot(qx, qz) || 1, c = (sx * qx + sz * qz) / n;
        if (c > melhor) { melhor = c; bx = sx; bz = sz; }
      }
      if (melhor < -1) out.esquiva = false;
      else { const c = entradaParaDirecao(bx, bz); out.x = c.x; out.y = c.y; }
    }
    this.pulou = out.pulo; this.esquivou = out.esquiva; this.podeu = out.poder;
    return out;
  }
}

export interface Resultado {
  vitoria: boolean;
  /** segundos até a vitória (ou até o limite) */
  tempo: number;
  danos: [number, number];
  recomecos: number;
  /** tick em que começou cada fase do Rei */
  fases: number[];
  eventos: Record<string, number>;
}

/** Joga a luta inteira com dois bots (ou um, no treino). */
export function lutar(perfis: [PerfilBot, PerfilBot], opcoes: OpcoesArena = {}, maxSeg = 900): Resultado {
  const e = estadoInicialArena(opcoes);
  const bots = [new BotArena(0, perfis[0]), new BotArena(1, perfis[1])];
  const danos: [number, number] = [0, 0];
  const fases = [0];
  const eventos: Record<string, number> = {};
  while (!e.vitoria && e.tick < maxSeg * 60) {
    passoArena(e, [bots[0].entrada(e), bots[1].entrada(e)]);
    for (const s of e.eventos) {
      const [nome, a] = s.split(':');
      eventos[nome] = (eventos[nome] ?? 0) + 1;
      if (nome === 'dano') danos[Number(a)]++;
      if (nome === 'chefe-fase') fases[Number(a) - 1] = e.tick;
    }
  }
  return { vitoria: e.vitoria, tempo: e.tick / 60, danos, recomecos: e.recomecos, fases, eventos };
}
