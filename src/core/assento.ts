// Assentos: quem controla cada personagem. A simulação (passo) não sabe se a entrada vem de uma pessoa neste
// aparelho, de uma pessoa do outro lado da sala ou do jogo. O laço da partida pede uma Input a cada assento por tick:
//   ent = [assentos[0].entrada(f, e, 0), assentos[1].entrada(f, e, 1)]
// (ARQUITETURA_MODOS §6.1 e §9). Puro e determinístico: sem DOM, sem relógio, sem Math.random. O companheiro de
// verdade (L6, src/core/companheiro/) entra aqui implementando ControladorAssento com tipo 'ia'; até lá, o solo usa
// o Seguidor abaixo (segue o parceiro de forma simples).
import { solidos } from './sim';
import { INPUT_NEUTRO, type Estado, type Fase, type Input } from './types';

export type TipoAssento = 'pessoa' | 'remoto' | 'ia';

export interface ControladorAssento {
  readonly tipo: TipoAssento;
  /** entrada do jogador `i` neste tick */
  entrada(f: Fase, e: Estado, i: 0 | 1): Input;
  /** chamado quando o controlador assume um personagem já em jogo (troca ⇄, volta da rede): limpa a memória */
  reiniciar?(): void;
}

/** Pessoa neste aparelho (toque/teclado) ou do outro lado da sala: só repassa o que `ler` devolve. */
export class AssentoEntrada implements ControladorAssento {
  constructor(readonly tipo: 'pessoa' | 'remoto', private ler: () => Input) {}
  entrada(): Input { return this.ler(); }
}

/** Ninguém: o personagem fica parado (o treino de hoje). */
export class AssentoParado implements ControladorAssento {
  readonly tipo = 'ia' as const;
  entrada(): Input { return INPUT_NEUTRO; }
}

/** Distâncias do Seguidor (m): começa a andar acima de `longe`, para abaixo de `perto` (histerese, sem tremer). */
export const SEGUIR = Object.freeze({ longe: 2.4, perto: 1.3, ticksPulo: 18, ticksPreso: 20 });

/**
 * Companheiro provisório do solo (até o L6): anda até o parceiro, pula degrau, parede e vão quando o parceiro está
 * do outro lado ou mais alto, e desce quando o parceiro está embaixo. Não coopera (placa, mãos dadas, fio): isso é
 * do Companheiro do L6. Memória só de contadores (determinístico).
 */
export class Seguidor implements ControladorAssento {
  readonly tipo = 'ia' as const;
  private andando = false;
  private pulo = 0;
  private preso = 0;
  reiniciar() { this.andando = false; this.pulo = 0; this.preso = 0; }

  entrada(f: Fase, e: Estado, i: 0 | 1): Input {
    const eu = e.jogadores[i], outro = e.jogadores[1 - i];
    // bolha flutua sozinha até o parceiro; pendurado no fio ou na argola, não mexe (não solta ninguém)
    if (eu.bolha || eu.pendurado || eu.segurando || eu.argola >= 0) { this.reiniciar(); return INPUT_NEUTRO; }
    const dx = outro.x - eu.x, dist = Math.abs(dx);
    this.andando = this.andando ? dist > SEGUIR.perto : dist > SEGUIR.longe || (outro.y > eu.y + 1.2 && dist > 0.6);
    if (this.pulo > 0) {
      this.pulo--;
      return { x: Math.sign(dx), y: 0, jump: true, act: false, shoot: false };
    }
    if (!this.andando || outro.bolha) { this.preso = 0; return INPUT_NEUTRO; }
    const dir = Math.sign(dx) || 1;
    if (eu.noChao) {
      const sol = solidos(f, e);
      const dentro = (px: number, py: number) => sol.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
      const parede = dentro(eu.x + dir * 0.45, eu.y + 0.3);
      const semChao = !dentro(eu.x + dir * 0.6, eu.y - 0.2) && !dentro(eu.x + dir * 0.6, eu.y - 1.2);
      // vão à frente: pula se o parceiro está do outro lado (não está embaixo); com o parceiro embaixo, desce andando
      const vao = semChao && outro.y > eu.y - 0.5 && dist > 1.2;
      const alto = outro.noChao && outro.y > eu.y + 1 && dist < 3.5;
      this.preso = Math.abs(eu.vx) < 0.3 ? this.preso + 1 : 0;
      if (parede || vao || alto || this.preso >= SEGUIR.ticksPreso) {
        this.preso = 0;
        this.pulo = SEGUIR.ticksPulo;
        return { x: dir, y: 0, jump: true, act: false, shoot: false };
      }
    }
    return { x: dir, y: 0, jump: false, act: false, shoot: false };
  }
}
