// Fio Vermelho (corda entre os dois, em trechos da fase) e argolas de pêndulo.
// Modelo por posição: depois do movimento normal, se a distância passa do comprimento, os corpos são trazidos de
// volta para o círculo e perdem a velocidade "para fora". Com gravidade, isso vira um pêndulo de verdade.
import { moverEixo, type Corpo } from './colisao';
import type { Estado, EstadoJogador, Fase, Input, Retangulo } from './types';

export const DT = 1 / 60;
export const FIO = Object.freeze({
  comprimento: 4,
  /** altura do ponto de amarração (cintura) */
  amarra: 0.6,
  /** comprimento mínimo ao subir */
  minimo: 0.6,
  velSubir: 2.0,
  /** aceleração do balanço (joystick) pendurado */
  balanco: 9,
  /** atrito do ar pendurado (1/s): o balanço morre devagar se ninguém bombear */
  atrito: 0.35,
  /** impulso para cima ao soltar o fio */
  soltar: 3,
  /** subindo pelo fio, escala a beira quando o topo dela está a até isto acima dos pés */
  beira: 0.9,
  /** sem âncora: quem está no chão escorrega até a beira, no máximo a esta velocidade */
  escorrega: 1.2,
  /** entrou na zona mais longe que isto × comprimento: fio frouxo até se aproximarem */
  frouxo: 1.4,
});
export const ARGOLA = Object.freeze({ alcance: 1.1, maos: 1.0, raioMin: 0.6, raioMax: 4, empurrao: 5, alcanceEmpurrao: 1.8, espera: 0.35, soltar: 4 });

const ponto = (j: EstadoJogador, h: number) => ({ x: j.x, y: j.y + h });

/** Leva o corpo até (tx, ty) respeitando as paredes. */
function levar(j: EstadoJogador & Corpo, l: number, a: number, sol: readonly Retangulo[], dx: number, dy: number) {
  moverEixo(j, l, a, sol, dx, 0);
  moverEixo(j, l, a, sol, 0, dy);
}

export function fioInicial() {
  return { zona: -1, comprimento: FIO.comprimento, ancora: -1, pendurado: -1, frouxo: false };
}

/** Ativa/desativa o fio conforme a zona; aplica o limite da corda. Chamado depois do movimento dos jogadores. */
export function passoFio(fase: Fase, e: Estado, entradas: readonly [Input, Input], sol: readonly Retangulo[], larg: number, alt: number) {
  const [a, b] = e.jogadores;
  const zonas = fase.fio ?? [];
  let zona = -1;
  if (!a.bolha && !b.bolha) {
    for (let k = 0; k < zonas.length; k++) {
      const z = zonas[k];
      if (a.x >= z.x0 && a.x <= z.x1 && b.x >= z.x0 && b.x <= z.x1) { zona = k; break; }
    }
  }
  const f = e.fio;
  if (zona !== f.zona) {
    if (zona >= 0) {
      f.comprimento = zonas[zona].comprimento ?? FIO.comprimento;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      f.frouxo = d > f.comprimento * FIO.frouxo;
      if (!f.frouxo) e.eventos.push('fio-preso');
    } else e.eventos.push('fio-solto');
    f.zona = zona;
  }
  a.pendurado = b.pendurado = false;
  a.segurando = b.segurando = false;
  f.ancora = -1; f.pendurado = -1;
  if (zona < 0) return;
  const Lmax = zonas[zona].comprimento ?? FIO.comprimento;
  const pa = ponto(a, FIO.amarra), pb = ponto(b, FIO.amarra);
  const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  // teletransporte (caiu no vão e voltou ao ponto seguro, renasceu): o fio afrouxa em vez de arrancar o outro
  if (!f.frouxo && d > f.comprimento * FIO.frouxo) f.frouxo = true;
  if (f.frouxo) {
    if (d <= f.comprimento) { f.frouxo = false; e.eventos.push('fio-preso'); } else return;
  }
  // quem soltou o fio e pisou no chão: se ficou longe, o fio fica frouxo até se aproximarem de novo
  for (const j of [a, b]) {
    if (!j.soltouFio || !j.noChao) continue;
    j.soltouFio = false;
    if (d > f.comprimento) { f.frouxo = true; return; }
  }
  if (a.soltouFio || b.soltouFio) return;

  // quem segura: no chão, com a mão apertada
  const segura = [a.noChao && entradas[0].act, b.noChao && entradas[1].act];
  a.segurando = segura[0]; b.segurando = segura[1];
  if (segura[0] !== segura[1]) f.ancora = segura[0] ? 0 : 1;

  // quem está pendurado (no ar, abaixo do outro, fio esticado): sobe/desce pelo fio e pode soltar
  for (let i = 0; i < 2; i++) {
    const eu = e.jogadores[i], outro = e.jogadores[1 - i];
    const esticado = d >= f.comprimento - 0.12;
    if (!eu.noChao && eu.argola < 0 && esticado && eu.y < outro.y - 0.05 && (outro.noChao || outro.argola >= 0)) {
      eu.pendurado = true; f.pendurado = i;
      const inp = entradas[i];
      const vy = inp.y ?? 0;
      const subindo = vy > 0.4 || inp.jump;
      if (subindo) f.comprimento = Math.max(FIO.minimo, f.comprimento - FIO.velSubir * DT);
      else if (vy < -0.4) f.comprimento = Math.min(Lmax, f.comprimento + FIO.velSubir * DT);
      // chegou na beira subindo: escala para cima dela
      if (subindo) {
        const meia = larg / 2;
        for (const r of sol) {
          const topo = r.y + r.h;
          const encostado = Math.abs(eu.x - meia - (r.x + r.w)) < 0.03 || Math.abs(eu.x + meia - r.x) < 0.03;
          if (encostado && topo - eu.y > 0 && topo - eu.y <= FIO.beira) {
            eu.y = topo + 0.01; eu.vy = 2; eu.vx = (eu.x < r.x ? 1 : -1) * 2.5;
            eu.pendurado = false; f.pendurado = -1;
            e.eventos.push(`escalou:${i}`);
            return;
          }
        }
      }
      if (inp.act && !eu.maoSegurada) {
        eu.soltouFio = true; eu.pendurado = false; f.pendurado = -1; eu.vy = Math.max(eu.vy, 0) + FIO.soltar;
        e.eventos.push(`soltou:${i}`); return;
      }
      break;
    }
  }
  // ninguém pendurado e os dois no chão: o fio volta ao tamanho normal (desenrola)
  if (f.pendurado < 0 && a.noChao && b.noChao) f.comprimento = Math.min(Lmax, f.comprimento + FIO.velSubir * 2 * DT);

  if (d <= f.comprimento) return;
  // pesos: quem ancora não se mexe; os dois soltos dividem a correção
  const w = [segura[0] ? 0 : 1, segura[1] ? 0 : 1];
  if (w[0] === 0 && w[1] === 0) { w[0] = w[1] = 1; }
  const soltoNoChao = [a.noChao && w[0] > 0, b.noChao && w[1] > 0];
  if (w[0] > 0 && w[1] > 0 && soltoNoChao[0] !== soltoNoChao[1]) {
    // um no chão, o outro no ar, ninguém segurando: o do chão escorrega devagar na direção do outro (até a
    // beira) e o do ar fica preso ao círculo em volta dele
    const ch = soltoNoChao[0] ? 0 : 1;
    const g = e.jogadores[ch], ar = e.jogadores[1 - ch];
    // escorrega para o lado do outro; se o outro está bem embaixo, para a beira mais perto (onde acaba o chão)
    let lado = Math.sign(ar.x - g.x) || 1;
    const chao = (x: number) => sol.some((r) => x >= r.x && x <= r.x + r.w && g.y - 0.1 >= r.y && g.y - 0.1 <= r.y + r.h);
    if (Math.abs(ar.x - g.x) < 0.5) {
      if (!chao(g.x + 0.5)) lado = 1; else if (!chao(g.x - 0.5)) lado = -1;
    }
    levar(g, larg, alt, sol, lado * FIO.escorrega * DT, 0);
    g.vx = 0;
    prender(ar, ponto(g, FIO.amarra), f.comprimento, larg, alt, sol);
    return;
  }
  const nx = (pb.x - pa.x) / d, ny = (pb.y - pa.y) / d;
  const excesso = d - f.comprimento;
  const corr = [(excesso * w[0]) / (w[0] + w[1]), (excesso * w[1]) / (w[0] + w[1])];
  // a vai na direção de b (+n); b na direção de a (-n); quem está no chão só é arrastado na horizontal
  if (corr[0] > 0) levar(a, larg, alt, sol, nx * corr[0], a.noChao ? 0 : ny * corr[0]);
  if (corr[1] > 0) levar(b, larg, alt, sol, -nx * corr[1], b.noChao ? 0 : -ny * corr[1]);
  // tira a velocidade que afasta (dividida entre quem foi corrigido)
  const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  const soma = (corr[0] > 0 ? 1 : 0) + (corr[1] > 0 ? 1 : 0);
  if (vrel > 0 && soma > 0) {
    const q = vrel / soma;
    if (corr[0] > 0) { a.vx += nx * q; a.vy += ny * q; }
    if (corr[1] > 0) { b.vx -= nx * q; b.vy -= ny * q; }
  }
}

/** Prende o ponto de amarração de `j` ao círculo de raio `r` em volta de `c` (é corda: só limita para fora). */
function prender(j: EstadoJogador, c: { x: number; y: number }, r: number, larg: number, alt: number, sol: readonly Retangulo[], h: number = FIO.amarra) {
  const dx = j.x - c.x, dy = j.y + h - c.y, d = Math.hypot(dx, dy);
  if (d <= r || d === 0) return;
  const nx = dx / d, ny = dy / d;
  levar(j, larg, alt, sol, -nx * (d - r), -ny * (d - r));
  const vr = j.vx * nx + j.vy * ny;
  if (vr > 0) { j.vx -= nx * vr; j.vy -= ny * vr; }
}

/** Controle de quem está numa argola (no lugar do andar normal). Retorna true se o jogador está na argola. */
export function controleArgola(fase: Fase, e: Estado, i: number, inp: Input): boolean {
  const j = e.jogadores[i];
  const argolas = fase.argolas ?? [];
  j.esperaArgola = Math.max(0, j.esperaArgola - DT);
  if (j.argola < 0) {
    if (j.noChao || j.bolha || !inp.act || j.esperaArgola > 0) return false;
    for (let k = 0; k < argolas.length; k++) {
      const g = argolas[k];
      const dist = Math.hypot(g.x - j.x, g.y - (j.y + ARGOLA.maos));
      if (dist <= ARGOLA.alcance) {
        j.argola = k; j.raioArgola = Math.max(ARGOLA.raioMin, Math.min(ARGOLA.raioMax, dist));
        j.soltouFio = false;
        e.eventos.push(`argola:${i}:${k}`);
        break;
      }
    }
    if (j.argola < 0) return false;
  }
  // soltar com o pulo (apertar de novo)
  if (inp.jump && !j.pulouSegurado) {
    j.argola = -1; j.esperaArgola = ARGOLA.espera;
    j.vy = Math.max(j.vy, 0) + ARGOLA.soltar; j.vx *= 1.1;
    e.eventos.push(`solta-argola:${i}`);
    return false;
  }
  const x = Math.max(-1, Math.min(1, inp.x || 0));
  if (x !== 0) j.olhando = x > 0 ? 1 : -1;
  j.vx += x * FIO.balanco * DT;
  const vy = inp.y ?? 0;
  if (vy > 0.4) j.raioArgola = Math.max(ARGOLA.raioMin, j.raioArgola - FIO.velSubir * DT);
  else if (vy < -0.4) j.raioArgola = Math.min(ARGOLA.raioMax, j.raioArgola + FIO.velSubir * DT);
  return true;
}

/** Depois do movimento: prende quem está na argola ao círculo (é corda: só limita para fora). */
export function restringirArgola(fase: Fase, j: EstadoJogador, sol: readonly Retangulo[], larg: number, alt: number) {
  if (j.argola < 0) return;
  if (j.noChao) { j.argola = -1; return; }
  prender(j, (fase.argolas ?? [])[j.argola], j.raioArgola, larg, alt, sol, ARGOLA.maos);
}

/** O parceiro, no chão perto de quem está na argola, aperta a mão: empurra o balanço para onde olha. */
export function empurrarArgola(e: Estado, i: number, inp: Input) {
  const eu = e.jogadores[i], outro = e.jogadores[1 - i];
  if (outro.argola < 0 || !eu.noChao || eu.bolha || !inp.act || eu.maoSegurada) return;
  if (Math.abs(outro.x - eu.x) > ARGOLA.alcanceEmpurrao || outro.y > eu.y + 3.2 || outro.y < eu.y - 1) return;
  outro.vx += ARGOLA.empurrao * eu.olhando;
  e.eventos.push(`empurrao:${i}`);
}
