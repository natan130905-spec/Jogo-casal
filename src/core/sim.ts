// Simulação determinística da fase (passo fixo). Roda no aparelho que criou a sala (anfitrião) e no modo treino.
import type { Estado, EstadoJogador, Fase, Input, Retangulo } from './types';

export const DT = 1 / 60;
export const FISICA = Object.freeze({
  largura: 0.6, altura: 1.1,
  velAndar: 5.2, acelChao: 60, acelAr: 30,
  gravidade: 30, velQuedaMax: 18,
  pulo: 10.5, impulsoPulo: 16.5,
  /** distância para dar as mãos / impulsionar */
  alcanceMao: 1.4,
  /** de cima de uma plataforma alta, alcança o parceiro até esta altura abaixo (puxar pela mão) */
  alcanceVertical: 3.6,
  velPorta: 1.5,
  tempoPortal: 0.6,
});

export function novoJogador(x: number, y: number): EstadoJogador {
  return { x, y, vx: 0, vy: 0, noChao: false, olhando: 1, seguroX: x, seguroY: y, impulso: 0, pulouSegurado: false };
}

export function estadoInicial(fase: Fase): Estado {
  const portas: Record<string, number> = {};
  for (const p of fase.portas) portas[p.id] = 0;
  const placas: Record<string, boolean> = {};
  for (const p of fase.placas) placas[p.id] = false;
  return {
    tick: 0, fase: fase.id,
    jogadores: [novoJogador(fase.inicio[0].x, fase.inicio[0].y), novoJogador(fase.inicio[1].x, fase.inicio[1].y)],
    portas, placasPressionadas: placas, noPortal: 0, concluida: false, eventos: [],
  };
}

const sobrepoe = (a: Retangulo, b: Retangulo) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const caixa = (j: EstadoJogador): Retangulo => ({ x: j.x - FISICA.largura / 2, y: j.y, w: FISICA.largura, h: FISICA.altura });

/** Sólidos do momento: plataformas + portas ainda não abertas (a parte fechada da porta). */
export function solidos(fase: Fase, e: Estado): Retangulo[] {
  const s: Retangulo[] = [...fase.plataformas];
  for (const p of fase.portas) {
    const aberta = e.portas[p.id] ?? 0;
    const h = p.h * (1 - aberta);
    if (h > 0.05) s.push({ x: p.x, y: p.y + p.h - h, w: p.w, h });
  }
  return s;
}

function moverEixo(j: EstadoJogador, sol: Retangulo[], dx: number, dy: number): boolean {
  let bateu = false;
  if (dx !== 0) {
    j.x += dx;
    for (const r of sol) {
      const c = caixa(j);
      if (!sobrepoe(c, r)) continue;
      j.x = dx > 0 ? r.x - FISICA.largura / 2 - 1e-4 : r.x + r.w + FISICA.largura / 2 + 1e-4;
      j.vx = 0; bateu = true;
    }
  }
  if (dy !== 0) {
    j.y += dy;
    for (const r of sol) {
      const c = caixa(j);
      if (!sobrepoe(c, r)) continue;
      if (dy > 0) {
        // correção de quina: se a cabeça só raspa a borda, desliza para fora em vez de parar o pulo
        const meia = FISICA.largura / 2;
        const sobraEsq = j.x + meia - r.x, sobraDir = r.x + r.w - (j.x - meia);
        if (sobraEsq > 0 && sobraEsq <= 0.32) { j.x = r.x - meia - 1e-4; continue; }
        if (sobraDir > 0 && sobraDir <= 0.32) { j.x = r.x + r.w + meia + 1e-4; continue; }
      }
      if (dy < 0) { j.y = r.y + r.h; j.noChao = true; } else { j.y = r.y - FISICA.altura - 1e-4; }
      j.vy = 0; bateu = true;
    }
  }
  return bateu;
}

/** Avança um passo fixo. `entradas[i]` é do jogador i. Retorna o mesmo objeto, mutado. */
export function passo(fase: Fase, e: Estado, entradas: [Input, Input]): Estado {
  e.tick++;
  e.eventos = [];
  if (e.concluida) return e;
  const sol = solidos(fase, e);
  const [a, b] = e.jogadores;

  // Mãos dadas: quem aperta a mão perto do parceiro (lado a lado ou de cima, puxando) dá impulso para o pulo dele.
  for (let i = 0; i < 2; i++) {
    const eu = e.jogadores[i], outro = e.jogadores[1 - i];
    const dx = Math.abs(eu.x - outro.x), dy = eu.y - outro.y;
    const alcanca = dx <= FISICA.alcanceMao && dy >= -0.3 && dy <= FISICA.alcanceVertical;
    if (entradas[i].act && eu.noChao && alcanca && outro.impulso <= 0) {
      outro.impulso = 0.6;
      e.eventos.push(`maos:${i}`);
    }
  }

  for (let i = 0; i < 2; i++) {
    const j = e.jogadores[i], inp = entradas[i];
    const x = Math.max(-1, Math.min(1, inp.x || 0));
    const alvo = x * FISICA.velAndar;
    const acel = (j.noChao ? FISICA.acelChao : FISICA.acelAr) * DT;
    j.vx += Math.max(-acel, Math.min(acel, alvo - j.vx));
    if (x !== 0) j.olhando = x > 0 ? 1 : -1;

    if (inp.jump && !j.pulouSegurado && j.noChao) {
      const forte = j.impulso > 0;
      j.vy = forte ? FISICA.impulsoPulo : FISICA.pulo;
      j.noChao = false; j.impulso = 0;
      e.eventos.push(forte ? `superpulo:${i}` : `pulo:${i}`);
    }
    // pulo variável: soltar cedo corta a subida
    if (!inp.jump && j.vy > 0) j.vy *= 0.88;
    j.pulouSegurado = inp.jump;
    j.impulso = Math.max(0, j.impulso - DT);

    j.vy = Math.max(-FISICA.velQuedaMax, j.vy - FISICA.gravidade * DT);
    const estavaNoChao = j.noChao;
    j.noChao = false;
    moverEixo(j, sol, j.vx * DT, 0);
    moverEixo(j, sol, 0, j.vy * DT);
    if (j.noChao && !estavaNoChao) e.eventos.push(`pouso:${i}`);
    if (j.noChao) { j.seguroX = j.x; j.seguroY = j.y; }
    j.x = Math.max(0.3, Math.min(fase.largura - 0.3, j.x));
    if (j.y < fase.fundo) {
      j.x = j.seguroX; j.y = j.seguroY + 0.5; j.vx = 0; j.vy = 0;
      e.eventos.push(`caiu:${i}`);
    }
  }

  // Placas e portas: a porta abre enquanto QUALQUER placa ligada a ela estiver pressionada.
  const abrindo: Record<string, boolean> = {};
  for (const p of fase.placas) {
    const pressionada = [a, b].some((j) => j.noChao && sobrepoe(caixa(j), { ...p, y: p.y - 0.05, h: p.h + 0.1 }));
    if (pressionada !== e.placasPressionadas[p.id]) e.eventos.push(`${pressionada ? 'placa' : 'solta'}:${p.id}`);
    e.placasPressionadas[p.id] = pressionada;
    abrindo[p.abre] = (abrindo[p.abre] ?? false) || pressionada;
  }
  for (const id of Object.keys(abrindo)) {
    const v = e.portas[id] ?? 0;
    e.portas[id] = Math.max(0, Math.min(1, v + (abrindo[id] ? 1 : -1) * FISICA.velPorta * DT));
  }

  // Portal: os dois dentro
  const dentro = [a, b].every((j) => sobrepoe(caixa(j), fase.portal));
  e.noPortal = dentro ? e.noPortal + DT : 0;
  if (e.noPortal >= FISICA.tempoPortal) { e.concluida = true; e.eventos.push('concluida'); }
  return e;
}
