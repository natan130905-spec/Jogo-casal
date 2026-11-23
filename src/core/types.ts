// Tipos compartilhados entre simulação, rede e renderização. Nada aqui depende de Three.js nem do navegador.

export interface Input {
  /** -1 (esquerda) … 1 (direita) */
  x: number;
  jump: boolean;
  /** botão de interação (mão): ajudar o parceiro a subir, apertar alavanca */
  act: boolean;
}

export const INPUT_NEUTRO: Input = Object.freeze({ x: 0, jump: false, act: false });

export interface Retangulo { x: number; y: number; w: number; h: number }

export interface Placa extends Retangulo { id: string; abre: string }
export interface Porta extends Retangulo { id: string }

export interface Fase {
  id: string;
  nome: string;
  largura: number;
  inicio: [{ x: number; y: number }, { x: number; y: number }];
  plataformas: Retangulo[];
  placas: Placa[];
  portas: Porta[];
  /** portal final: os dois precisam estar dentro ao mesmo tempo */
  portal: Retangulo;
  /** limite de queda: abaixo disso o jogador volta ao último ponto seguro */
  fundo: number;
}

export interface EstadoJogador {
  x: number; y: number; vx: number; vy: number;
  noChao: boolean;
  olhando: 1 | -1;
  /** último ponto seguro (para reaparecer depois de cair) */
  seguroX: number; seguroY: number;
  /** segundos restantes do impulso dado pelo parceiro */
  impulso: number;
  pulouSegurado: boolean;
}

export interface Estado {
  tick: number;
  fase: string;
  jogadores: [EstadoJogador, EstadoJogador];
  /** 0 (fechada) … 1 (aberta) */
  portas: Record<string, number>;
  placasPressionadas: Record<string, boolean>;
  /** segundos com os dois no portal */
  noPortal: number;
  concluida: boolean;
  /** eventos do último passo, para efeitos e som (não persistem) */
  eventos: string[];
}
