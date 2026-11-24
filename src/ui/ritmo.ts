// Limitador de quadros por relógio-alvo (R39). A simulação é de 60 Hz fixos; numa tela de 90 ou 120 Hz o navegador
// chama o requestAnimationFrame 90–120 vezes por segundo e cada quadro a mais é trabalho de GPU (calor, bateria) que
// repete o estado anterior. O limitador decide, a cada batida do rAF, se este quadro é desenhado.
//
// Relógio-alvo, e não "intervalo desde o último": com meta 60 numa tela de 90 Hz desenha 2 de cada 3 batidas
// (60/s); com "desde o último" desenharia 1 de 2 (45/s). Tolerância de 1/4 do intervalo para a variação do vsync
// (numa tela de 60 Hz nenhum quadro é pulado). Depois de uma parada longa (pausa, segundo plano) recomeça do zero.
// Base: tools/revisao/tecnico-desempenho/proposta/qualidadeAuto.ts.

/** `?fps=30` (modo economia, para medir no aparelho; a opção no menu fica para o L5/L13). Padrão 60. */
export function metaDeFps(busca = typeof location !== 'undefined' ? location.search : ''): number {
  return new URLSearchParams(busca).get('fps') === '30' ? 30 : 60;
}

export class Limitador {
  private proximo = 0;
  readonly intervalo: number;
  constructor(readonly meta = 60) { this.intervalo = 1000 / meta; }

  /** Chamar no começo do callback do rAF com o `agora` dele. false = pular este quadro (nem simular nem desenhar). */
  quadro(agora: number): boolean {
    const iv = this.intervalo;
    if (this.proximo && agora < this.proximo - iv / 4) return false;
    this.proximo = this.proximo && agora - this.proximo < iv ? this.proximo + iv : agora + iv;
    return true;
  }
}
