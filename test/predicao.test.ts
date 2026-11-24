// Predição do convidado (src/net/predicao.ts) com uma rede simulada: anfitrião e convidado rodam ticks de 60 Hz no
// mesmo laço, as mensagens chegam com atraso de uma via fixo (em ticks) e passam por JSON como na rede real.
import { describe, expect, it } from 'vitest';
import { DT, estadoInicial, passo } from '../src/core/sim';
import { faseDoCapitulo } from '../src/core/fases';
import { instantaneo, interpolar, restaurar, type Instantaneo } from '../src/core/instantaneo';
import { EntradasDoConvidado, Preditor, type MensagemEntrada } from '../src/net/predicao';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from '../src/core/types';

const fase: Fase = faseDoCapitulo(1)!;

/** Roda `ticks` com atraso de uma via `via` ticks. `entrada(t)` é a do convidado. Devolve a série por tick. */
function simular(ticks: number, via: number, entrada: (t: number) => Input) {
  const host = estadoInicial(fase);
  const remota = new EntradasDoConvidado();
  const paraHost: { em: number; m: MensagemEntrada }[] = [];
  const paraConv: { em: number; s: Instantaneo }[] = [];
  let agora = 0;
  const pred = new Preditor(fase, 1, (m) => paraHost.push({ em: agora + via, m: JSON.parse(JSON.stringify(m)) }));
  const buffer: Estado[] = [];
  const serie: { t: number; mostradoY: number; mostradoX: number; hostX: number; hostY: number; pulosHost: number }[] = [];
  let pulosHost = 0;
  for (agora = 0; agora < ticks; agora++) {
    // anfitrião
    while (paraHost.length && paraHost[0].em <= agora) remota.receber(paraHost.shift()!.m);
    passo(fase, host, [INPUT_NEUTRO, remota.consumir()]);
    pulosHost += host.eventos.filter((e) => e === 'pulo:1').length;
    if (host.tick % 3 === 0) paraConv.push({ em: agora + via, s: JSON.parse(JSON.stringify(instantaneo(fase, host, host.eventos, remota.aplicada))) });
    // convidado (um quadro = um tick)
    while (paraConv.length && paraConv[0].em <= agora) {
      const s = paraConv.shift()!.s;
      const e = restaurar(fase, s);
      buffer.push(e); if (buffer.length > 8) buffer.shift();
      pred.receber(e, s.sq);
    }
    pred.quadro(DT, () => entrada(agora));
    if (buffer.length) {
      // interpolação 6 ticks (100 ms) no passado, como a partida
      const b = buffer[buffer.length - 1], a = buffer[Math.max(0, buffer.length - 3)];
      const mostrar = interpolar(fase, a, b, 0.5);
      pred.aplicar(mostrar, DT);
      serie.push({ t: agora, mostradoX: mostrar.jogadores[1].x, mostradoY: mostrar.jogadores[1].y, hostX: host.jogadores[1].x, hostY: host.jogadores[1].y, pulosHost });
    }
  }
  return { serie, pred, pulosHost };
}

const N = INPUT_NEUTRO;

describe('predição do convidado', () => {
  it('anfitrião: toque curto (apertou e soltou entre dois ticks) vira um tick de pulo, na ordem', () => {
    const r = new EntradasDoConvidado();
    r.receber({ i: N, seq: 2, l: [N, { ...N, jump: true }, N] });
    expect(r.consumir().jump).toBe(false);
    expect(r.consumir().jump).toBe(true);
    expect(r.consumir().jump).toBe(false);
    expect(r.aplicada).toBe(2);
    // repetida (a mesma seq de novo) não entra duas vezes
    r.receber({ i: { ...N, jump: true }, seq: 2 });
    expect(r.consumir().jump).toBe(false);
  });

  it('anfitrião: fila cheia junta os botões em vez de perder o toque', () => {
    const r = new EntradasDoConvidado();
    const l = Array.from({ length: 10 }, (_, k) => ({ ...N, jump: k === 1 }));
    r.receber({ i: l[9], seq: 9, l });
    expect(r.tamanho).toBeLessThanOrEqual(6);
    const saidas = Array.from({ length: 6 }, () => r.consumir().jump);
    expect(saidas.filter(Boolean).length).toBe(1);
  });

  for (const via of [0, 5, 9]) {
    it(`com ${Math.round(via * DT * 1000)} ms de uma via: o próprio pulo aparece em ≤ 2 ticks e o fim bate com o anfitrião`, () => {
      // corre para a direita 1 s, pula (toque de 1 tick) e para
      const entrada = (t: number): Input => ({ ...N, x: t >= 60 && t < 120 ? 1 : 0, jump: t === 130 });
      const { serie, pred, pulosHost } = simular(300, via, entrada);
      const y0 = serie.find((s) => s.t === 129)!.mostradoY;
      const subiu = serie.find((s) => s.t >= 130 && s.mostradoY > y0 + 0.02)!;
      expect(subiu.t - 130).toBeLessThanOrEqual(2);
      const x0 = serie.find((s) => s.t === 59)!.mostradoX;
      const andou = serie.find((s) => s.t >= 60 && Math.abs(s.mostradoX - x0) > 0.02)!;
      expect(andou.t - 60).toBeLessThanOrEqual(2);
      expect(pulosHost).toBe(1);
      const fim = serie[serie.length - 1];
      expect(Math.abs(fim.mostradoX - fim.hostX)).toBeLessThan(0.01);
      expect(Math.abs(fim.mostradoY - fim.hostY)).toBeLessThan(0.01);
      // a reconciliação quase não corrige (mesma simulação nos dois lados)
      expect(pred.medidas.maiorErro).toBeLessThan(0.05);
      expect(pred.medidas.saltos).toBe(0);
      // sem tranco: nenhum quadro anda mais que a velocidade máxima permite (+ folga)
      for (let k = 1; k < serie.length; k++) expect(Math.abs(serie[k].mostradoX - serie[k - 1].mostradoX)).toBeLessThan(0.2);
    });
  }

  it('sem `sq` no instantâneo (anfitrião jogando roteiro), não prevê: mostra o anfitrião', () => {
    const fase1 = fase;
    const p = new Preditor(fase1, 1, () => {});
    const e = estadoInicial(fase1);
    e.jogadores[1].x = 7;
    p.receber(e, undefined);
    p.quadro(DT * 3, () => ({ ...N, x: 1 }));
    const m = structuredClone(e);
    p.aplicar(m, DT);
    expect(m.jogadores[1].x).toBe(7);
  });

  it('R86: o anfitrião recomeça a fase (tick volta) e a predição aceita os instantâneos novos', () => {
    const p = new Preditor(fase, 1, () => {});
    const velho = estadoInicial(fase); velho.tick = 900; velho.jogadores[1].x = 20;
    p.receber(velho, 5);
    p.quadro(DT, () => N);
    const novo = estadoInicial(fase); novo.tick = 3;
    p.receber(novo, 6);
    p.quadro(DT, () => N);
    const m = structuredClone(novo);
    p.aplicar(m, 1); // dt grande: sem transição sobrando
    expect(Math.abs(m.jogadores[1].x - novo.jogadores[1].x)).toBeLessThan(0.5);
  });
});
