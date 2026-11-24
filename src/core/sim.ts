// Simulação determinística da fase (passo fixo de 60 Hz). Roda no aparelho que criou a sala (anfitrião) e no
// modo treino. Sem Three.js, sem DOM, sem sorteio: as mesmas entradas dão sempre o mesmo resultado.
//
// Eventos (Estado.eventos, só do último passo; i = jogador 0/1, k = índice na lista da fase):
//   pulo:i superpulo:i pouso:i caiu:i maos:i quique:i          movimento
//   tiro:i:arma golpe:i:arma acerto:k defendeu:k derrota:k:<tipo> pisao:i:k esporo:k   armas e bichinhos
//   (os outros eventos das armas, dos baús, sinos, barbantes e blocos rachados: src/core/arsenal.ts)
//   dano:i bolha:i renasce:i volta-checkpoint lanterna:k        vida
//   estrelinha:i (pegou) pedaco (os dois tocaram o pedaço) concluida
//   placa:<id> solta:<id> porta-abriu:<id>                       placas e portas
//   fio-preso fio-solto soltou:i escalou:i argola:i:k solta-argola:i empurrao:i   Fio Vermelho e argolas
//   treme:k cai:k volta:k estoura:k                              plataformas especiais (k em fase.especiais)
//   ponto-fraco:k fecha:k chefe-fase:n chefe-derrotado          Rei-Pesadelo
import { caixaDe, moverEixo, pontoDentro, sobrepoe } from './colisao';
import { ARGOLA, controleArgola, empurrarArgola, FIO, fioInicial, passoFio, restringirArgola } from './fio';
import { caixaInimigo, ferir, inimigosIniciais, passoInimigos } from './inimigos';
import { especiaisIniciais, passoEspeciais, retEspecial } from './plataformas';
import { arsenalInicial, DESBLOQUEADAS_INICIAIS, elementosIniciais, passoArmas, passoElementos, passoProjeteis, rachadosInteiros, recompensaDerrota, sinosDaPorta } from './arsenal';
import type { Estado, EstadoJogador, Fase, Input, Ponto, Retangulo } from './types';

export { FIO, ARGOLA };
export const DT = 1 / 60;
export const FISICA = Object.freeze({
  largura: 0.6, altura: 1.1,
  velAndar: 5.2, acelChao: 60, acelAr: 30,
  gravidade: 30, velQuedaMax: 18,
  pulo: 10.5, impulsoPulo: 16.5,
  /** coyote time: o pulo ainda sai até estes ticks depois de sair da quina (0,10 s) */
  coyote: 6,
  /** jump buffer: apertar o pulo até estes ticks antes de pousar pula no pouso (0,12 s) */
  buffer: 7,
  /** pulo mínimo: soltar o botão só corta a subida depois destes ticks (0,13 s); toque rápido ≈ 1,4 m */
  puloMinimo: 8,
  /** corte da subida por tick com o pulo solto (altura variável) */
  corte: 0.88,
  /** quina dos pés: no ar, contra a parede, subindo devagar (vy ≤ quinaVy), sobe se o topo está até isto acima */
  quinaPes: 0.2, quinaVy: 4,
  /** coyote da rede (convidado sem predição): teto do coyote + tolerância extra, em ticks (0,25 s) */
  coyoteRedeMax: 15,
  /** distância para dar as mãos / impulsionar */
  alcanceMao: 1.4,
  /** de cima de uma plataforma alta, alcança o parceiro até esta altura abaixo (puxar pela mão) */
  alcanceVertical: 3.6,
  velPorta: 1.5,
  tempoPortal: 0.6,
});
export const VIDA = Object.freeze({
  coracoes: 3, invencivel: 1, invencivelRenasce: 1.5,
  /** empurrão ao levar dano */
  recuoX: 4, recuoY: 6,
  velBolha: 3.5, encostar: 1.0,
});
/** @deprecated Lança-Estrelas (trocado pelo arsenal, L4: src/core/arsenal.ts). Fica só para a arena antiga ler. */
export const TIRO = Object.freeze({ vel: 14, alcance: 8, cadencia: 1 / 3, altura: 0.6 });
export const PISAO = Object.freeze({ quique: 9, quiqueSegurando: 13 });
export const COLETA = Object.freeze({ raio: 0.55 });

// ---------- afastamento (C2 do PLANO; desligado por padrão, o L3a liga com `Estado.afastamento`) ----------
/** Distância horizontal entre os dois: até `livre` m, nada; de `livre` a `freio`, só aviso (a interface mostra);
 *  acima de `freio`, quem anda para LONGE do parceiro anda a `fator` da velocidade. Dentro de uma zona do Fio
 *  Vermelho ou de um trecho `separados` da fase (corredores do cap. 6), nada muda. Não há puxão nem teleporte. */
export const AFASTAMENTO = Object.freeze({ livre: 12, freio: 24, fator: 0.6 });
export type SituacaoAfastamento = 'livre' | 'aviso' | 'freio' | 'fio' | 'separados';

/** Como está o afastamento agora (a mesma regra que o passo usa; serve à câmera e ao indicador do parceiro). */
export function situacaoAfastamento(fase: Fase, e: Estado): SituacaoAfastamento {
  const [a, b] = e.jogadores;
  const dentro = (zs: readonly { x0: number; x1: number }[] | undefined) => (zs ?? []).some((z) => [a, b].some((j) => j.x >= z.x0 && j.x <= z.x1));
  if (dentro(fase.fio)) return 'fio';
  if (dentro(fase.separados)) return 'separados';
  const d = Math.abs(a.x - b.x);
  return d > AFASTAMENTO.freio ? 'freio' : d > AFASTAMENTO.livre ? 'aviso' : 'livre';
}

/** Fator da velocidade de andar do jogador i com o joystick em `x` (1 = sem freio). */
function fatorAfastamento(fase: Fase, e: Estado, i: number, x: number): number {
  if (!e.afastamento || x === 0) return 1;
  const eu = e.jogadores[i], outro = e.jogadores[1 - i];
  if (eu.bolha || outro.bolha || Math.sign(x) !== Math.sign(eu.x - outro.x)) return 1;
  return situacaoAfastamento(fase, e) === 'freio' ? AFASTAMENTO.fator : 1;
}

export function novoJogador(x: number, y: number): EstadoJogador {
  return {
    x, y, vx: 0, vy: 0, noChao: false, olhando: 1, seguroX: x, seguroY: y, impulso: 0, pulouSegurado: false,
    coracoes: VIDA.coracoes, invencivel: 0, bolha: false, recarga: 0, estrelinhas: 0,
    pendurado: false, segurando: false, soltouFio: false, argola: -1, raioArgola: 0, esperaArgola: 0,
    plataforma: -1, maoSegurada: false, lancado: false, arTicks: 99, puloGuardado: -1, semCorte: 0,
    arsenal: arsenalInicial(),
  };
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
    inimigos: inimigosIniciais(fase), faiscas: [], proxFaisca: 0, esporos: [],
    coletadas: [], soltas: [], estrelinhasCasal: 0, checkpoint: -1,
    especiais: especiaisIniciais(fase), fio: fioInicial(),
    potes: [], desbloqueadas: DESBLOQUEADAS_INICIAIS, ...elementosIniciais(fase),
  };
}

const caixa = (j: EstadoJogador): Retangulo => caixaDe(j, FISICA.largura, FISICA.altura);

/** Sólidos fixos do momento: plataformas + blocos rachados inteiros + portas ainda não abertas (a parte fechada). */
export function solidos(fase: Fase, e: Estado): Retangulo[] {
  const s: Retangulo[] = [...fase.plataformas, ...rachadosInteiros(fase, e)];
  for (const p of fase.portas) {
    const aberta = e.portas[p.id] ?? 0;
    const h = p.h * (1 - aberta);
    if (h > 0.05) s.push({ x: p.x, y: p.y + p.h - h, w: p.w, h });
  }
  return s;
}

/** Retângulos das plataformas especiais ativas agora (com o índice em fase.especiais). */
export function especiaisAtivas(fase: Fase, e: Estado): (Retangulo & { k: number })[] {
  const defs = fase.especiais ?? [];
  const r: (Retangulo & { k: number })[] = [];
  for (let k = 0; k < defs.length; k++) if (e.especiais[k]?.ativa) r.push({ ...retEspecial(defs[k], e.especiais[k]), k });
  return r;
}

/** Ponto de renascer (lanterna acesa ou início) para o jogador i. */
export function pontoCheckpoint(fase: Fase, e: Estado, i: number): Ponto {
  const l = e.checkpoint >= 0 ? (fase.lanternas ?? [])[e.checkpoint] : null;
  if (!l) return { ...fase.inicio[i] };
  return { x: l.x + (i === 0 ? -0.5 : 0.5), y: l.y + 0.05 };
}

function machucar(e: Estado, i: number, deX: number) {
  const j = e.jogadores[i];
  if (j.bolha || j.invencivel > 0) return;
  j.coracoes = Math.max(0, j.coracoes - 1);
  e.eventos.push(`dano:${i}`);
  j.argola = -1;
  if (j.coracoes === 0) {
    j.bolha = true; j.vx = 0; j.vy = 0; j.noChao = false; j.pendurado = false; j.plataforma = -1; j.impulso = 0;
    e.eventos.push(`bolha:${i}`);
    return;
  }
  j.invencivel = VIDA.invencivel;
  j.vx = (j.x >= deX ? 1 : -1) * VIDA.recuoX;
  j.vy = VIDA.recuoY; j.noChao = false; j.arTicks = 99;
}

function renascer(j: EstadoJogador, x: number, y: number) {
  Object.assign(j, {
    x, y, vx: 0, vy: 0, bolha: false, coracoes: VIDA.coracoes, invencivel: VIDA.invencivelRenasce,
    noChao: false, impulso: 0, argola: -1, pendurado: false, soltouFio: false, plataforma: -1, seguroX: x, seguroY: y,
  });
}

/** Avança um passo fixo. `entradas[i]` é do jogador i. Retorna o mesmo objeto, mutado. */
export function passo(fase: Fase, e: Estado, entradas: readonly [Input, Input]): Estado {
  e.tick++;
  e.eventos = [];
  if (e.concluida) return e;
  const ev = e.eventos;
  const [a, b] = e.jogadores;

  // plataformas especiais (antes de mover os jogadores, para carregá-los)
  const pisadas = (fase.especiais ?? []).map((_, k) => e.jogadores.some((j) => j.noChao && j.plataforma === k));
  const delta = passoEspeciais(fase, e.especiais, e.tick, pisadas, fase.fundo, ev);
  const sol = solidos(fase, e);
  const esp = especiaisAtivas(fase, e);
  const defsEsp = fase.especiais ?? [];

  // Mãos dadas: quem aperta a mão perto do parceiro (lado a lado ou de cima, puxando) dá impulso para o pulo dele.
  for (let i = 0; i < 2; i++) {
    const eu = e.jogadores[i], outro = e.jogadores[1 - i];
    if (eu.bolha || outro.bolha) continue;
    const dx = Math.abs(eu.x - outro.x), dy = eu.y - outro.y;
    const alcanca = dx <= FISICA.alcanceMao && dy >= -0.3 && dy <= FISICA.alcanceVertical;
    if (entradas[i].act && eu.noChao && alcanca && outro.impulso <= 0 && outro.argola < 0) {
      outro.impulso = 0.6;
      ev.push(`maos:${i}`);
    }
    empurrarArgola(e, i, entradas[i]);
  }

  const peAntes = [a.y, b.y];
  for (let i = 0; i < 2; i++) {
    const j = e.jogadores[i], inp = entradas[i];
    const x = Math.max(-1, Math.min(1, inp.x || 0));
    j.invencivel = Math.max(0, j.invencivel - DT);

    if (j.bolha) {
      // bolha: flutua até o parceiro (atravessa tudo); o joystick ajuda um pouco
      const o = e.jogadores[1 - i];
      const dx = o.x - j.x, dy = o.y + 0.6 - j.y, d = Math.hypot(dx, dy) || 1;
      j.vx = (dx / d) * VIDA.velBolha + x * 1.5;
      j.vy = (dy / d) * VIDA.velBolha + (inp.y ?? 0) * 1.5;
      j.x += j.vx * DT; j.y += j.vy * DT;
      j.x = Math.max(0.3, Math.min(fase.largura - 0.3, j.x));
      j.pulouSegurado = inp.jump; j.puloGuardado = -1;
      continue;
    }

    // carregado pela plataforma especial onde estava em pé
    if (j.noChao && j.plataforma >= 0 && delta[j.plataforma]) {
      const dd = delta[j.plataforma];
      moverEixo(j, FISICA.largura, FISICA.altura, sol, dd.dx, 0);
      j.y += dd.dy;
    }

    // borda de descida do botão de pulo: guarda a idade (jump buffer). Soltar a argola com o pulo consome a borda.
    if (inp.jump && !j.pulouSegurado) j.puloGuardado = 0;
    const tinhaArgola = j.argola >= 0;
    const naArgola = controleArgola(fase, e, i, inp);
    if (naArgola || tinhaArgola || j.pendurado) j.puloGuardado = -1;
    if (naArgola) {
      // balanço: só gravidade e o joystick (em controleArgola)
    } else if (j.pendurado) {
      j.vx += x * FIO.balanco * DT;
      j.vx *= 1 - FIO.atrito * DT; j.vy *= 1 - FIO.atrito * DT;
      if (x !== 0) j.olhando = x > 0 ? 1 : -1;
    } else {
      const alvo = x * FISICA.velAndar * fatorAfastamento(fase, e, i, x);
      const acel = (j.noChao ? FISICA.acelChao : FISICA.acelAr) * DT;
      j.vx += Math.max(-acel, Math.min(acel, alvo - j.vx));
      if (x !== 0) j.olhando = x > 0 ? 1 : -1;

      // pode pular: no chão, ou caindo há no máximo `coyote` ticks depois de sair da quina andando
      const extraRede = Math.max(0, Math.min(FISICA.coyoteRedeMax - FISICA.coyote, e.toleranciaRede?.[i] ?? 0));
      const coyote = !j.noChao && j.arTicks <= FISICA.coyote + extraRede && j.vy <= 0;
      const guardado = j.puloGuardado >= 0 && j.puloGuardado <= FISICA.buffer + 1;
      if (guardado && (j.noChao || coyote)) {
        const forte = j.impulso > 0;
        j.vy = forte ? FISICA.impulsoPulo : FISICA.pulo;
        j.noChao = false; j.impulso = 0; j.puloGuardado = -1; j.arTicks = 99; j.semCorte = FISICA.puloMinimo;
        ev.push(forte ? `superpulo:${i}` : `pulo:${i}`);
      }
      // pulo variável: soltar corta a subida, mas só depois do pulo mínimo
      if (!inp.jump && j.vy > 0 && !j.lancado && j.semCorte <= 0) j.vy *= FISICA.corte;
    }
    j.semCorte = Math.max(0, j.semCorte - 1);
    if (j.puloGuardado >= 0) j.puloGuardado = j.puloGuardado > FISICA.buffer + 1 ? -1 : j.puloGuardado + 1;
    if (j.vy <= 0) j.lancado = false;
    j.pulouSegurado = inp.jump;
    j.impulso = Math.max(0, j.impulso - DT);

    j.vy = Math.max(-FISICA.velQuedaMax, j.vy - FISICA.gravidade * DT);
    const estavaNoChao = j.noChao;
    j.noChao = false;
    const naPlataforma = j.plataforma;
    j.plataforma = -1;
    const xAntes = j.x, dx = j.vx * DT, vxAntes = j.vx;
    if (moverEixo(j, FISICA.largura, FISICA.altura, sol, dx, 0) && !estavaNoChao && j.argola < 0 && !j.pendurado) quinaDosPes(j, sol, xAntes + dx, vxAntes);
    const yAntes = j.y;
    moverEixo(j, FISICA.largura, FISICA.altura, sol, 0, j.vy * DT, true);

    // plataformas especiais: só se pousa por cima (vindo de cima, caindo)
    if (!j.noChao && j.vy <= 0) {
      let melhor = -1, topoMelhor = -Infinity;
      for (const r of esp) {
        const topo = r.y + r.h, topoAntes = topo - (delta[r.k]?.dy ?? 0);
        const meia = FISICA.largura / 2;
        if (j.x + meia <= r.x || j.x - meia >= r.x + r.w) continue;
        const tolerancia = naPlataforma === r.k ? 0.12 : 0.06;
        if (yAntes >= topoAntes - tolerancia && j.y <= topo + 1e-3 && topo > topoMelhor) { melhor = r.k; topoMelhor = topo; }
      }
      if (melhor >= 0) {
        j.y = topoMelhor; j.vy = 0; j.noChao = true; j.plataforma = melhor;
        const d = defsEsp[melhor];
        if (d.tipo === 'quicante') {
          j.vy = (d.forca ?? 15) * (inp.jump ? 1.2 : 1); j.noChao = false; j.plataforma = -1; j.lancado = true; j.arTicks = 99;
          ev.push(`quique:${i}`);
        }
      }
    }
    j.arTicks = j.noChao ? 0 : Math.min(99, j.arTicks + 1);
    if (j.noChao && !estavaNoChao) ev.push(`pouso:${i}`);
    if (j.noChao && j.plataforma < 0) { j.seguroX = j.x; j.seguroY = j.y; }
    j.x = Math.max(0.3, Math.min(fase.largura - 0.3, j.x));
    restringirArgola(fase, j, sol, FISICA.largura, FISICA.altura);
    if (j.y < fase.fundo) {
      j.x = j.seguroX; j.y = j.seguroY + 0.5; j.vx = 0; j.vy = 0; j.argola = -1; j.soltouFio = false;
      ev.push(`caiu:${i}`);
    }

  }
  // armas (L4: src/core/arsenal.ts), depois do movimento dos dois
  for (let i = 0; i < 2; i++) passoArmas(fase, e, i, entradas[i], ev);

  // Fio Vermelho (depois do movimento)
  passoFio(fase, e, entradas, sol, FISICA.largura, FISICA.altura);

  // bichinhos e esporos
  passoInimigos(fase, e.inimigos, sol, e.jogadores, e.esporos, ev);
  for (const s of e.esporos) { s.x += s.vx * DT; s.y += s.vy * DT; s.t -= DT; }
  e.esporos = e.esporos.filter((s) => s.t > 0 && !sol.some((r) => pontoDentro(r, s.x, s.y)));

  // projéteis: andam, somem na parede, estouram esporos, tocam sinos, acertam bichinhos (sem fogo amigo)
  passoProjeteis(fase, e, sol, ev);

  // contato com bichinhos: pisão (de cima, caindo) ou dano
  for (let i = 0; i < 2; i++) {
    const j = e.jogadores[i];
    if (j.bolha) continue;
    const cj = caixa(j);
    for (let k = 0; k < e.inimigos.length; k++) {
      const n = e.inimigos[k];
      if (!n.vivo) continue;
      const cn = caixaInimigo(n);
      if (!sobrepoe(cj, cn)) continue;
      const topo = cn.y + cn.h;
      const deCima = j.vy <= 0 && peAntes[i] >= topo - 0.3;
      if (deCima) {
        // lançado: soltar o pulo não corta o quique (sem isso o quique solto subia só 0,47 m em vez de 1,35 m)
        j.y = topo; j.vy = entradas[i].jump ? PISAO.quiqueSegurando : PISAO.quique; j.noChao = false; j.lancado = true; j.arTicks = 99;
        ev.push(`pisao:${i}:${k}`);
        if (n.tipo === 'espinhudo') machucar(e, i, n.x);
        else if (n.tipo === 'rei') { if (n.aberto && ferir(n, k, 1, ev)) recompensaDerrota(e, k); }
        else if (ferir(n, k, n.vida, ev)) recompensaDerrota(e, k);
      } else machucar(e, i, n.x);
      break;
    }
    // esporos
    const ie = e.esporos.findIndex((s) => pontoDentro(cj, s.x, s.y, 0.15));
    if (ie >= 0 && !j.bolha && j.invencivel <= 0) { const s = e.esporos[ie]; e.esporos.splice(ie, 1); machucar(e, i, s.x - s.vx); }
  }

  // estrelinhas de lembrança
  const estrelas = fase.estrelinhas ?? [];
  for (let i = 0; i < 2; i++) {
    const j = e.jogadores[i];
    if (j.bolha) continue;
    const cx = j.x, cy = j.y + FISICA.altura / 2;
    const perto = (p: Ponto) => Math.abs(p.x - cx) <= FISICA.largura / 2 + COLETA.raio && Math.abs(p.y - cy) <= FISICA.altura / 2 + COLETA.raio;
    for (let k = 0; k < estrelas.length; k++) {
      if (e.coletadas.includes(k) || !perto(estrelas[k])) continue;
      e.coletadas.push(k); j.estrelinhas++; ev.push(`estrelinha:${i}`);
    }
    for (let k = e.soltas.length - 1; k >= 0; k--) {
      if (e.soltas[k].t < 0.3 || !perto(e.soltas[k])) continue;
      e.soltas.splice(k, 1); j.estrelinhas++; ev.push(`estrelinha:${i}`);
    }
  }
  for (const s of e.soltas) { if (s.t < 0.5) s.y += 1.2 * DT; s.t += DT; }
  e.estrelinhasCasal = a.estrelinhas + b.estrelinhas;

  // lanternas (checkpoint)
  const lanternas = fase.lanternas ?? [];
  for (let k = e.checkpoint + 1; k < lanternas.length; k++) {
    const l = lanternas[k];
    if (e.jogadores.some((j) => !j.bolha && j.x >= l.x - 0.6 && Math.abs(j.y - l.y) < 2.5)) { e.checkpoint = k; ev.push(`lanterna:${k}`); }
  }

  // bolha: renasce encostando no parceiro; os dois bolha → volta à lanterna
  if (a.bolha && b.bolha) {
    for (let i = 0; i < 2; i++) { const p = pontoCheckpoint(fase, e, i); renascer(e.jogadores[i], p.x, p.y); }
    e.esporos = []; e.faiscas = []; e.fio.zona = -1; e.fio.comprimento = FIO.comprimento;
    ev.push('volta-checkpoint');
  } else {
    for (let i = 0; i < 2; i++) {
      const j = e.jogadores[i], o = e.jogadores[1 - i];
      if (!j.bolha) continue;
      if (Math.hypot(o.x - j.x, o.y + 0.6 - j.y) <= VIDA.encostar) {
        renascer(j, o.x - o.olhando * 0.4, o.y + 0.2);
        ev.push(`renasce:${i}`);
      }
    }
  }

  // baús, sinos, barbantes, miçangas soltas e o baú de munição das lanternas
  passoElementos(fase, e, sol, ev);

  // Placas e portas: porta comum abre com qualquer placa ligada; porta dupla ('todas') só com todas ao mesmo tempo.
  // Um alvo-sino tocado segura a porta dele aberta por `tempo` s, como uma placa pisada.
  const ligadas: Record<string, boolean[]> = {};
  for (const porta of fase.portas) { const s = sinosDaPorta(fase, e, porta.id); if (s.length) ligadas[porta.id] = s; }
  for (const p of fase.placas) {
    const pressionada = [a, b].some((j) => !j.bolha && j.noChao && sobrepoe(caixa(j), { ...p, y: p.y - 0.05, h: p.h + 0.1 }));
    if (pressionada !== e.placasPressionadas[p.id]) ev.push(`${pressionada ? 'placa' : 'solta'}:${p.id}`);
    e.placasPressionadas[p.id] = pressionada;
    (ligadas[p.abre] ??= []).push(pressionada);
  }
  for (const porta of fase.portas) {
    const l = ligadas[porta.id];
    if (!l) continue;
    const abrindo = porta.modo === 'todas' ? l.every(Boolean) : l.some(Boolean);
    const v = e.portas[porta.id] ?? 0;
    const nv = Math.max(0, Math.min(1, v + (abrindo ? 1 : -1) * FISICA.velPorta * DT));
    if (nv === 1 && v < 1) ev.push(`porta-abriu:${porta.id}`);
    e.portas[porta.id] = nv;
  }

  // Pedaço da estrela: os dois tocando juntos (e o Rei, se houver, derrotado)
  const reiVivo = e.inimigos.some((n) => n.tipo === 'rei' && n.vivo);
  const dentro = !reiVivo && [a, b].every((j) => !j.bolha && sobrepoe(caixa(j), fase.portal));
  if (dentro && e.noPortal === 0) ev.push('pedaco');
  e.noPortal = dentro ? e.noPortal + DT : 0;
  if (e.noPortal >= FISICA.tempoPortal) { e.concluida = true; ev.push('concluida'); }

  for (let i = 0; i < 2; i++) e.jogadores[i].maoSegurada = entradas[i].act;
  return e;
}

/**
 * Quina dos pés: no ar, batendo de lado numa parede cujo topo está até `quinaPes` acima dos pés e subindo devagar
 * (ou caindo), o corpo sobe para o topo em vez de escorregar. Perdoa o "quase" num degrau (1,75 → ~1,95 m).
 */
function quinaDosPes(j: EstadoJogador, sol: readonly Retangulo[], xQuer: number, vx: number) {
  if (j.vy > FISICA.quinaVy) return;
  const meia = FISICA.largura / 2;
  let topo = Infinity;
  for (const r of sol) {
    const t = r.y + r.h;
    if (t <= j.y || t - j.y > FISICA.quinaPes) continue;
    if (xQuer + meia <= r.x || xQuer - meia >= r.x + r.w || j.y + FISICA.altura <= r.y) continue;
    topo = Math.min(topo, t);
  }
  if (!Number.isFinite(topo)) return;
  const alvo: Retangulo = { x: xQuer - meia, y: topo + 1e-3, w: FISICA.largura, h: FISICA.altura };
  if (sol.some((r) => sobrepoe(alvo, r))) return;
  j.x = xQuer; j.y = topo + 1e-3; j.vx = vx; j.vy = Math.min(j.vy, -0.01);
}


/** Limpa uma entrada recebida pela rede (valores fora do formato viram neutros). */
export function normalizarInput(i: unknown): Input {
  const o = (i ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  const troca = typeof o.troca === 'number' && Number.isInteger(o.troca) && o.troca >= 1 && o.troca <= 6 ? o.troca : 0;
  return {
    x: num(o.x), y: num(o.y), jump: o.jump === true, act: o.act === true, shoot: o.shoot === true || o.atk === true,
    ...(troca ? { troca } : {}), ...(o.dar === true ? { dar: true } : {}),
  };
}
