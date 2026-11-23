// Tipos compartilhados entre simulação, rede e renderização. Nada aqui depende de Three.js nem do navegador.
// Convenções: medidas em metros, tempo em segundos, y para cima. Corpos (jogadores e bichinhos) têm `x` no centro
// e `y` nos pés. Retângulos têm (x, y) no canto de baixo à esquerda.

export interface Input {
  /** -1 (esquerda) … 1 (direita) */
  x: number;
  /** -1 (baixo) … 1 (cima). Opcional: usado para subir/descer pelo Fio Vermelho e pela argola. */
  y?: number;
  jump: boolean;
  /** botão de interação (mão): impulso, puxar, ancorar o fio, soltar o fio, agarrar argola, empurrar o parceiro */
  act: boolean;
  /** Lança-Estrelas (segurar = dispara na cadência) */
  shoot?: boolean;
}

export const INPUT_NEUTRO: Input = Object.freeze({ x: 0, y: 0, jump: false, act: false, shoot: false });

export interface Retangulo { x: number; y: number; w: number; h: number }
export interface Ponto { x: number; y: number }

export interface Placa extends Retangulo { id: string; abre: string }
export interface Porta extends Retangulo {
  id: string;
  /** 'qualquer' (padrão): abre com qualquer placa ligada a ela. 'todas': porta dupla, exige todas ao mesmo tempo. */
  modo?: 'qualquer' | 'todas';
}

export type TipoInimigo = 'bolotinha' | 'morcego' | 'cogumelo' | 'espinhudo' | 'rei';

/** Bichinho-pesadelo na fase. `x` é o centro e `y` os pés (morcego: altura do meio do voo). */
export interface DefInimigo {
  tipo: TipoInimigo;
  x: number; y: number;
  /** direção inicial (padrão -1, andando para a esquerda) */
  dir?: 1 | -1;
  /** morcego: metade da largura da patrulha (padrão 3 m). Rei: metade da arena (padrão 6 m). */
  alcance?: number;
}

/** Plataformas especiais. Todas são "de um lado só": atravessa-se por baixo e pelos lados, pousa-se por cima. */
export type DefEspecial =
  /** Vai e volta pelo trajeto (lista de cantos de baixo à esquerda), a `vel` m/s. `circular`: volta ao início. */
  | { tipo: 'movel'; w: number; h: number; trajeto: Ponto[]; vel: number; circular?: boolean }
  /** Ponteiro de relógio: o centro da plataforma gira num círculo (cx, cy, raio); a plataforma fica na horizontal.
   *  `periodo` em s por volta; `inicio` em graus (0 = direita, 90 = em cima); `sentido` 1 anti-horário, -1 horário. */
  | { tipo: 'giratoria'; w: number; h: number; cx: number; cy: number; raio: number; periodo: number; inicio?: number; sentido?: 1 | -1 }
  /** Gelatina: quem pousa é lançado para cima com `forca` m/s (padrão 15; segurando pulo, 20% a mais). */
  | { tipo: 'quicante'; x: number; y: number; w: number; h: number; forca?: number }
  /** Treme quando alguém pisa, cai depois de `espera` s (padrão 0.6) e volta depois de `volta` s (padrão 3). */
  | { tipo: 'cai'; x: number; y: number; w: number; h: number; espera?: number; volta?: number }
  /** Bolha que sobe de (x, y) até `sobe` m acima, a `vel` m/s, estoura e reaparece embaixo após `pausa` s.
   *  `atraso`: s de defasagem (para várias bolhas em sequência). */
  | { tipo: 'bolha'; x: number; y: number; w: number; h: number; sobe: number; vel: number; pausa?: number; atraso?: number };

/** Trecho do Fio Vermelho: enquanto os dois estão entre x0 e x1, ficam amarrados (comprimento padrão 4 m). */
export interface ZonaFio { x0: number; x1: number; comprimento?: number }

/**
 * Formato de fase (para o designer de fases). Campos opcionais podem ser omitidos.
 * Exemplo completo e comentado: `EXEMPLO_MECANICAS` em `src/core/fases.ts`. Fábrica com padrões: `criarFase`.
 */
export interface Fase {
  id: string;
  nome: string;
  /** capítulo da história (1–7) */
  capitulo?: number;
  largura: number;
  /** posições iniciais de P1 (Natan) e P2 (Bruna) */
  inicio: [Ponto, Ponto];
  /** chão e paredes fixos (sólidos por todos os lados) */
  plataformas: Retangulo[];
  placas: Placa[];
  portas: Porta[];
  /** pedaço da estrela no fim da fase: os dois precisam tocá-lo juntos. Se houver Rei-Pesadelo, só vale depois
   *  que ele for derrotado. (O nome "portal" ficou da primeira versão.) */
  portal: Retangulo;
  /** limite de queda: abaixo disso o jogador volta ao último ponto seguro */
  fundo: number;
  inimigos?: DefInimigo[];
  /** estrelinhas de lembrança (coletáveis); o ponto é o centro */
  estrelinhas?: Ponto[];
  /** lanternas de checkpoint (ponto = pé da lanterna); acendem quando alguém passa */
  lanternas?: Ponto[];
  especiais?: DefEspecial[];
  fio?: ZonaFio[];
  /** argolas/ganchos de pêndulo no teto (ponto = a argola) */
  argolas?: Ponto[];
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
  /** 0 … 3 */
  coracoes: number;
  /** segundos restantes de invencibilidade (pisca) */
  invencivel: number;
  /** sem corações: vira bolha que flutua até o parceiro */
  bolha: boolean;
  /** segundos até poder disparar de novo */
  recarga: number;
  /** estrelinhas de lembrança pegas por este jogador */
  estrelinhas: number;
  /** pendurado no Fio Vermelho (o parceiro segura) */
  pendurado: boolean;
  /** no chão segurando a mão: ancora o fio */
  segurando: boolean;
  /** soltou o fio: o fio não o segura até pisar no chão de novo */
  soltouFio: boolean;
  /** índice da argola agarrada (-1 = nenhuma) e o raio do pêndulo */
  argola: number;
  raioArgola: number;
  /** segundos até poder agarrar argola de novo */
  esperaArgola: number;
  /** índice da plataforma especial onde está em pé (-1 = nenhuma) */
  plataforma: number;
  maoSegurada: boolean;
  /** lançado por gelatina ou pisão: soltar o pulo não corta a subida */
  lancado: boolean;
}

export interface EstadoInimigo {
  tipo: TipoInimigo;
  x: number; y: number; vx: number; vy: number;
  vida: number;
  vivo: boolean;
  dir: 1 | -1;
  noChao: boolean;
  /** relógio interno (onda do morcego, cuspe do cogumelo, ciclo do Rei) */
  t: number;
  /** Rei: fase de ataque 1–3 */
  fase: number;
  /** Rei: ponto fraco à mostra (só assim as faíscas contam) */
  aberto: boolean;
}

export interface Faisca { id: number; dono: 0 | 1; x: number; y: number; vx: number; /** s restantes */ t: number }
export interface Esporo { x: number; y: number; vx: number; vy: number; t: number }
/** estrelinha solta por um bichinho derrotado */
export interface EstrelinhaSolta { x: number; y: number; t: number }
export interface EstadoEspecial {
  x: number; y: number;
  /** pode-se pisar */
  ativa: boolean;
  /** 'cai': 0 parada, 1 tremendo, 2 caindo, 3 sumida. 'bolha': 0 subindo, 3 estourada. */
  s: number;
  /** relógio do estado ('cai') e velocidade de queda */
  t: number; vy: number;
}
export interface EstadoFio {
  /** zona ativa (-1 = sem fio) */
  zona: number;
  /** comprimento atual (encurta quando alguém sobe) */
  comprimento: number;
  /** quem ancora (-1 ninguém) */
  ancora: number;
  /** quem está pendurado (-1 ninguém) */
  pendurado: number;
  /** entrou na zona longe demais: o fio fica frouxo até se aproximarem */
  frouxo: boolean;
}

export interface Estado {
  tick: number;
  fase: string;
  jogadores: [EstadoJogador, EstadoJogador];
  /** 0 (fechada) … 1 (aberta) */
  portas: Record<string, number>;
  placasPressionadas: Record<string, boolean>;
  /** segundos com os dois no pedaço da estrela */
  noPortal: number;
  concluida: boolean;
  /** eventos do último passo, para efeitos e som (não persistem) */
  eventos: string[];
  inimigos: EstadoInimigo[];
  faiscas: Faisca[];
  proxFaisca: number;
  esporos: Esporo[];
  /** índices de `fase.estrelinhas` já pegas */
  coletadas: number[];
  soltas: EstrelinhaSolta[];
  /** total do casal */
  estrelinhasCasal: number;
  /** última lanterna acesa (-1 = início da fase) */
  checkpoint: number;
  especiais: EstadoEspecial[];
  fio: EstadoFio;
}
