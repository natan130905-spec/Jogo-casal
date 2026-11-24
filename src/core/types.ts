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
  /** ATACAR (DESIGN_ARMAS §3, §7): usa a arma atual. Tiro: o aperto atira; segurar 0,6 s e soltar dá o tiro
   *  carregado. Corpo a corpo: segurar repete o golpe. (O nome `shoot` ficou da rede antiga do Lança-Estrelas.) */
  shoot?: boolean;
  /** troca de arma (vale a borda: o valor mudou desde o tick anterior). 1–4: espaço direto (corpo, tiro 1, tiro 2,
   *  ferramenta); 5: na lanterna acesa, troca o item do espaço atual pelo próximo da mochila do casal; 6: próxima
   *  arma (corpo → tiro 1 → tiro 2 → ferramenta, pulando os vazios). 0 ou ausente: nada. */
  troca?: number;
  /** 🎁 dar ao parceiro (borda): com arma de tiro, metade das miçangas; com corpo a corpo ou ferramenta, o item */
  dar?: boolean;
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
  /** marcas no cenário, só visuais (o render desenha; a simulação ignora) */
  marcas?: Marca[];
  /** trechos "separados de propósito" (x0…x1, cap. 6): ali a regra de afastamento não freia ninguém */
  separados?: { x0: number; x1: number }[];
  /** baús de item (L4): quem encosta abre e ganha o item */
  baus?: Bau[];
  /** alvos-sino: a pedrinha toca o sino */
  alvos?: AlvoSino[];
  /** barbantes: o corpo a corpo corta */
  barbantes?: Barbante[];
  /** blocos rachados: sólidos até o Martelo quebrar */
  rachados?: Rachado[];
}

/** O que um elemento das armas exige (A3): 'estilingue' e 'corpo' são recursos infinitos; 'martelo' é item comum
 *  achado no caminho (só em uso opcional, ou com o baú antes, A5). */
export type Requer = 'estilingue' | 'corpo' | 'martelo' | 'qualquer';
/** Baú com um item (x = centro, y = pé). */
export interface Bau { x: number; y: number; item: number }
/** Alvo-sino (x, y = centro do sino). Tocado, abre `abre` (porta) por `tempo` s (padrão 4) e/ou solta `premio`
 *  estrelinhas em `premioEm` (padrão: 1 m abaixo do sino). */
export interface AlvoSino { x: number; y: number; abre?: string; tempo?: number; premio?: number; premioEm?: Ponto; requer?: Requer }
/** Barbante pendurado de (x, y1) até (x, y0), com um pacote na ponta de baixo. Cortado, o pacote cai e solta
 *  `premio` estrelinhas em `premioEm` (padrão: no chão embaixo). */
export interface Barbante { x: number; y0: number; y1: number; premio?: number; premioEm?: Ponto; requer?: Requer }
/** Bloco rachado: sólido até levar `vida` marteladas (padrão 1); quebrado, solta `premio` estrelinhas no meio. */
export interface Rachado extends Retangulo { vida?: number; premio?: number; requer?: Requer }

/**
 * Marca visual no cenário. 'maos-dadas': ponto de dupla. Daqui, de mãos dadas (superpulo), alcança-se um segredo
 * que um jogador sozinho não alcança; o render desenha o ícone de duas mãos no chão em (x, y = topo do chão).
 */
export interface Marca { tipo: 'maos-dadas'; x: number; y: number }

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
  /** armas (L4). `recarga` abaixo ficou do Lança-Estrelas e não é mais usado pela simulação. */
  arsenal: EstadoArsenal;
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
  /** ticks seguidos no ar desde o último chão (coyote time; 99 depois de pular ou ser lançado) */
  arTicks: number;
  /** idade em ticks do último aperto do pulo ainda não usado (jump buffer; -1 = nenhum) */
  puloGuardado: number;
  /** ticks restantes do pulo mínimo (soltar o botão ainda não corta a subida) */
  semCorte: number;
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

/** Projétil (pedrinha do Estilingue e afins; o nome ficou da faísca do Lança-Estrelas). `arma` é o id do item,
 *  `dano` o dano por acerto e `fura` quantos bichinhos ainda atravessa (tiro carregado). Gravidade da arma em `g`. */
export interface Faisca {
  id: number; dono: 0 | 1; x: number; y: number; vx: number; /** s restantes */ t: number;
  vy?: number; g?: number; arma?: number; dano?: number; fura?: number; /** último bichinho atravessado */ ult?: number;
}
/** Miçangas soltas no chão: `q` miçangas, ou (com `carga`) a fração `q` de uma carga da arma mais vazia. */
export interface Pote { x: number; y: number; vy: number; q: number; carga?: boolean; /** s desde que caiu */ t: number }

/** Arsenal de um jogador (DESIGN_ARMAS §3, §11). Ids de src/core/arsenal.ts (`ITEM`); -1 = espaço vazio. */
export interface EstadoArsenal {
  /** [corpo a corpo, tiro 1, tiro 2, ferramenta] */
  itens: [number, number, number, number];
  /** espaço na mão (0–3) */
  atual: number;
  /** munição pronta e guardada de cada espaço (Infinity não vai: arma infinita guarda 0 na reserva) */
  carga: [number, number, number, number];
  reserva: [number, number, number, number];
  /** relógio de cada espaço: volta da pedrinha (Estilingue) ou recarga (arma de munição) */
  relogio: [number, number, number, number];
  /** s até poder usar a arma de novo (cadência, troca) */
  espera: number;
  /** s sem atirar (1,5 s com a carga incompleta recarrega) */
  ocioso: number;
  /** próximo golpe do combo e s desde o último golpe */
  combo: number; comboT: number;
  /** s segurando ATACAR com arma de tiro (−1 = não está carregando) */
  carregando: number;
  /** martelada caindo em andamento (Martelo no ar) */
  martelada: boolean;
  /** miçangas guardadas sem arma de munição para receber (vão para a primeira que aparecer) */
  bolsa: number;
  /** entradas do tick anterior (bordas) */
  atkAntes: boolean; darAntes: boolean; trocaAntes: number;
}
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
  /** coyote da rede: ticks extras de coyote por jogador (o anfitrião põe ≈ RTT/2 do convidado enquanto não há
   *  predição local; teto total FISICA.coyoteRedeMax). Opcional; ausente = 0. */
  toleranciaRede?: [number, number];
  /** regra de afastamento ligada (AFASTAMENTO em sim.ts; C2 do PLANO). Opcional; ausente = desligada. */
  afastamento?: boolean;
  /** miçangas soltas (potes de bichinho, tiro defendido, saquinho jogado longe) */
  potes: Pote[];
  /** itens achados pelo casal (bit = id do item): a mochila das lanternas */
  desbloqueadas: number;
  /** elementos das armas, na ordem da fase: s restantes do sino tocado, s desde o corte do barbante (−1 intacto),
   *  vida do bloco rachado (0 = quebrado), baú aberto (0/1) */
  alvos: number[]; barbantes: number[]; rachados: number[]; baus: number[];
  /** teste A2: potes de miçanga desligados (só o recurso infinito) */
  semPotes?: boolean;
}
