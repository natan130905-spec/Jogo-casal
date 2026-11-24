// Manobras: as primitivas de movimento que os bots de teste (test/fases/bot.ts) e o companheiro controlado pelo jogo
// usam para atravessar as fases (andar, saltar, mãos dadas, fio, argola, gelatina, plataformas especiais, ponteiros,
// luta com o Rei). Cada manobra é um `Passo`: a cada tick devolve a entrada do jogador `i`, ou null quando terminou.
// Puras e determinísticas: só leem a fase e o estado e guardam memória em `Ctx.m` (sem sorteio, sem relógio, sem DOM).
// Vieram de test/fases/bot.ts sem mudança de comportamento (L2a; os 7 planos fecham no mesmo tick).
import { solidos } from '../sim';
import { INIMIGO } from '../inimigos';
import type { Estado, EstadoJogador, Fase, Input } from '../types';

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

/** De cima, puxa o parceiro (mãos dadas) e espera ele chegar. */
export const puxar = (): Passo[] => [darImpulso(), esperar((c) => c.outro.noChao && c.outro.y > c.eu.y - 0.3 && c.t > 5, {}, 'esperar subir')];

/** Carona na plataforma especial k: espera em `espera`; quando o canto esquerdo dela está em `xEmbarque`, sobe
 *  (pulando, se `pular`), fica em pé (a `dx` do meio) até o canto chegar em `xDesce` (ou `desce(c)`), e anda até
 *  `saida`. Se cair, volta a esperar. */
export function carona(k: number, espera: number, xEmbarque: number | ((c: Ctx) => boolean), xDesce: number | ((c: Ctx) => boolean), saida: number, o: { dx?: number; pular?: boolean; tol?: number; parceiro?: number } = {}): Passo {
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
        if (fase === 1) { // esperar a plataforma (indo embora não: quem está mais atrás não a alcança e cai no vão)
          const vem = m.sxAnt !== undefined && (s.x - m.sxAnt) * (s.x + d.w / 2 - c.eu.x) <= 1e-6;
          m.sxAnt = s.x;
          // `parceiro`: só embarca com o parceiro já no ponto de espera dele (o fio não deixa um ficar para trás)
          const pronto = o.parceiro === undefined || typeof xEmbarque !== 'number' || (c.outro.noChao && Math.abs(c.outro.x - o.parceiro) < 0.2);
          const pode = (typeof xEmbarque === 'number' ? Math.abs(s.x - xEmbarque) <= (o.tol ?? 0.25) && vem : xEmbarque(c)) && pronto;
          if (pode && s.ativa) { m.fase = 2; m.t2 = 0; continue; }
          return { x: guiar(c.eu, espera) };
        }
        if (fase === 2) { // subir
          if (c.eu.noChao && c.eu.plataforma === k && Math.abs(c.eu.x - alvo) < 0.35) { m.fase = 3; continue; }
          const longe = typeof xEmbarque === 'number' ? Math.abs(s.x - xEmbarque) > 1.5 : !xEmbarque(c);
          if (++m.t2 > 240 || (m.t2 > 40 && c.eu.noChao && c.eu.plataforma < 0 && longe)) { m.fase = 1; continue; }
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

/** Ângulo (graus, 0–360) do ponteiro k agora. */
export function anguloGir(c: Ctx, k: number): number {
  const d = c.f.especiais![k];
  if (d.tipo !== 'giratoria') return 0;
  const a = (d.inicio ?? 0) + (d.sentido ?? -1) * (360 * (c.e.tick / 60)) / d.periodo;
  return ((a % 360) + 360) % 360;
}
const naJanela = (a: number, a0: number, a1: number) => (a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1);
/** Espera o ponteiro k entrar na janela de ângulos [a0, a1] e pula nele (mirando o meio + dx). */
export function subirNaGiratoria(k: number, a0: number, a1: number, o: { dx?: number } = {}): Passo {
  return {
    nome: `subir no ponteiro ${k}`,
    fn: (c) => {
      const { eu, m } = c;
      if (c.e.eventos.includes(`caiu:${c.i}`)) { m.vai = 0; m.t2 = 0; }
      if (eu.noChao && eu.plataforma === k) return null;
      if (!m.vai) {
        if (eu.noChao && naJanela(anguloGir(c, k), a0, a1)) { m.vai = 1; m.t2 = 0; }
        else return { x: 0 };
      }
      m.t2++;
      if (eu.noChao && m.t2 > 8) { m.vai = 0; return { x: 0 }; } // errou: espera a próxima volta
      const s = c.e.especiais[k], d = c.f.especiais![k] as { w: number };
      return { x: guiar(eu, s.x + d.w / 2 + (o.dx ?? 0), 5), jump: m.t2 > 1 };
    },
  };
}
/** Fica no ponteiro k (no meio + dx) até o ângulo entrar em [a0, a1] e pula em direção a `alvo`. */
export function saltarDaGiratoria(k: number, a0: number, a1: number, alvo: number, o: { dx?: number } = {}): Passo {
  const s = saltar(alvo);
  return {
    nome: `saltar do ponteiro ${k} para ${alvo}`,
    fn: (c) => {
      const { eu, m } = c;
      if (!m.pula) {
        if (naJanela(anguloGir(c, k), a0, a1) && eu.noChao) { m.pula = 1; m.t0 = c.t; }
        else {
          const p = c.e.especiais[k], d = c.f.especiais![k] as { w: number };
          return { x: eu.plataforma === k ? guiar(eu, p.x + d.w / 2 + (o.dx ?? 0), 2) * 0.6 : 0 };
        }
      }
      return s.fn({ ...c, t: c.t - m.t0 });
    },
  };
}

/** Topo atual da plataforma especial k (e se está ativa). */
export const topoEsp = (c: Ctx, k: number) => c.e.especiais[k].y + (c.f.especiais![k] as { h: number }).h;
/** Espera `quando` e pula na plataforma especial k (mirando o meio + dx); termina em pé nela. Se errar, tenta de novo. */
export function subirEm(k: number, quando: (c: Ctx) => boolean, o: { dx?: number; nome?: string } = {}): Passo {
  return {
    nome: o.nome ?? `subir na plataforma ${k}`,
    fn: (c) => {
      const { eu, m } = c;
      if (c.e.eventos.includes(`caiu:${c.i}`)) { m.vai = 0; m.t2 = 0; }
      if (eu.noChao && eu.plataforma === k) return null;
      if (!m.vai) {
        if (eu.noChao && c.e.especiais[k].ativa && quando(c)) { m.vai = 1; m.t2 = 0; }
        else return { x: 0 };
      }
      m.t2++;
      if (eu.noChao && m.t2 > 8) { m.vai = 0; return { x: 0 }; }
      const s = c.e.especiais[k], d = c.f.especiais![k] as { w: number };
      return { x: guiar(eu, s.x + d.w / 2 + (o.dx ?? 0), 5), jump: m.t2 > 1 };
    },
  };
}
/** Fica na plataforma especial k (no meio + dx) até `quando` e pula em direção a `alvo`. */
export function saltarDe(k: number, quando: (c: Ctx) => boolean, alvo: number, o: { dx?: number } = {}): Passo {
  const s = saltar(alvo);
  return {
    nome: `saltar da plataforma ${k} para ${alvo}`,
    fn: (c) => {
      const { eu, m } = c;
      if (!m.pula) {
        if (quando(c) && eu.noChao) { m.pula = 1; m.t0 = c.t; }
        else {
          const p = c.e.especiais[k], d = c.f.especiais![k] as { w: number };
          return { x: eu.plataforma === k ? guiar(eu, p.x + d.w / 2 + (o.dx ?? 0), 2) * 0.6 : 0 };
        }
      }
      return s.fn({ ...c, t: c.t - m.t0 });
    },
  };
}

/** Argola k: da beira, pula e agarra (✋), desce até o raio `raio`, bombeia e solta (pulo) quando a previsão do voo
 *  passa da beira de lá (`alvo`, pés acima de `yAlvo`); voa até pousar. */
export function atravessarArgola(k: number, alvo: number, yAlvo: number, o: { raio?: number; folga?: number; de?: number } = {}): Passo {
  return {
    nome: `atravessar pela argola ${k}`,
    fn: (c) => {
      const { eu, m } = c;
      const g = c.f.argolas![k];
      const dir = Math.sign(alvo - g.x) as 1 | -1;
      if (c.e.eventos.includes(`solta-argola:${c.i}`)) m.solto = 1;
      if (m.solto) {
        if (eu.noChao) return null;
        return { x: dir, jump: true };
      }
      if (eu.argola < 0) {
        // pula em direção à argola e agarra perto dela
        if (eu.noChao && !m.pulou && o.de !== undefined && (eu.x - o.de) * dir < 0) return { x: dir };
        if (eu.noChao && !m.pulou) { m.pulou = 1; return { x: o.de !== undefined ? dir : guiar(eu, g.x), jump: false }; }
        const perto = Math.hypot(g.x - eu.x, g.y - (eu.y + 1)) <= 1.05;
        if (eu.noChao && m.pulou && c.t > 10) m.pulou = 0;
        return { x: guiar(eu, g.x, 3), jump: true, act: perto && c.t % 2 === 0 };
      }
      if (eu.raioArgola < (o.raio ?? 2.6)) return { y: -1, x: eu.vx >= 0 ? 1 : -1 };
      const solta = c.t > 60 && eu.vx * dir > 0 && preverVoo(eu.x, eu.y, eu.vx * 1.1, Math.max(eu.vy, 0) + 4, dir, alvo) >= yAlvo + (o.folga ?? 0.15);
      return { x: eu.vx >= 0 ? 1 : -1, jump: solta };
    },
  };
}

/** Pula (ou desce) na gelatina em `xGel` e, ao quicar, segura o pulo e vai até `alvo`; termina ao pousar.
 *  Com `de`, corre até passar de `de` antes de pular; `soDescer`: só anda para fora da beira. */
export function quicarPara(xGel: number, alvo: number, o: { de?: number; soDescer?: boolean; quiques?: number } = {}): Passo {
  return {
    nome: `quicar em ${xGel} até ${alvo}`,
    fn: (c) => {
      const { eu, m } = c;
      if (c.e.eventos.includes(`quique:${c.i}`)) m.q = (m.q ?? 0) + 1;
      if (c.e.eventos.includes(`caiu:${c.i}`)) { m.saiu = 0; m.q = 0; m.solto = 0; }
      const quicou = (m.q ?? 0) >= (o.quiques ?? 1);
      if (!m.saiu) {
        const dir = Math.sign(xGel - eu.x) || 1;
        if (o.de !== undefined && eu.noChao && (eu.x - o.de) * dir < 0) return { x: dir };
        if (eu.noChao) {
          if (o.soDescer) return { x: dir };
          if (!m.solto) { m.solto = 1; return { x: guiar(eu, xGel), jump: false }; }
          return { x: o.de !== undefined ? dir : guiar(eu, xGel), jump: true };
        }
        m.saiu = 1;
      }
      if (eu.noChao && quicou) return null;
      if (eu.noChao && !quicou) { m.saiu = 0; m.solto = 0; return { x: 0 }; }
      return { x: quicou ? guiar(eu, alvo, 3) : guiar(eu, xGel, 4), jump: true };
    },
  };
}

/** Luta com o Rei-Pesadelo: fica a `dist` m dele (do lado `lado`), dentro de [xMin, xMax], olhando para ele e
 *  atirando; foge dos esporos que vêm na altura do corpo pulando. Termina quando ele vira vaga-lume. */
export function lutarComORei(lado: 1 | -1, xMin: number, xMax: number, dist = 6.5): Passo {
  return {
    nome: 'lutar com o Rei-Pesadelo',
    fn: (c) => {
      const rei = c.e.inimigos.find((n) => n.tipo === 'rei');
      if (!rei || !rei.vivo) return null;
      const { eu } = c;
      const alvo = Math.max(xMin, Math.min(xMax, rei.x + lado * dist));
      const dx = alvo - eu.x;
      const praRei = Math.sign(rei.x - eu.x) || 1;
      const x = Math.abs(dx) > 0.35 ? guiar(eu, alvo) : praRei * 0.04;
      // esporo vindo na altura do corpo e perto: pula
      const perigo = c.e.esporos.some((s) => Math.abs(s.x - eu.x) < 2.2 && s.y > eu.y - 0.1 && s.y < eu.y + 1.3 && Math.sign(eu.x - s.x) === Math.sign(s.vx));
      return { x, jump: perigo && eu.noChao, shoot: (eu.olhando === praRei) };
    },
  };
}

/** Há bichinho ou esporo na frente, na altura do corpo, ao alcance do Lança-Estrelas? (os bots atiram sozinhos) */
export const autoTiro = (e: Estado, eu: EstadoJogador) =>
  e.inimigos.some((n) => {
    if (!n.vivo) return false;
    const d = (n.x - eu.x) * eu.olhando;
    const m = INIMIGO[n.tipo];
    const y = eu.y + 0.6;
    return d > 0 && d < 8.5 && y >= n.y - 0.2 && y <= n.y + m.h + 0.2;
  }) || e.esporos.some((s) => { const d = (s.x - eu.x) * eu.olhando; return d > 0 && d < 8 && Math.abs(s.y - eu.y - 0.6) < 0.4; });
