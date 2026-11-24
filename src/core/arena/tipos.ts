// Tipos da Arena do Coração. Nada aqui depende de Three.js nem do navegador.
// Convenções: chão no plano x-z, y para cima, centro da ilha em (0, 0). Corpos têm (x, z) no centro e y nos pés.
// Ângulo de direção `ang` igual ao rotation.y do Three.js: o objeto olha para (sin ang, 0, cos ang) (o +Z do modelo).
import type { TipoAtaque } from './numeros';

/**
 * Entrada de um jogador na arena (um por tick). `x`/`y` é o joystick (-1…1; y = 1 é "para a frente", longe da
 * câmera), relativo à câmera: `yaw` é o rotation.y da câmera (ordem 'YXZ'), em radianos. Botões são "segurado"
 * (o núcleo detecta o toque pela borda de subida); `tiro` segurado dispara na cadência.
 */
export interface EntradaArena {
  x: number;
  y: number;
  yaw: number;
  pulo: boolean;
  golpe: boolean;
  tiro: boolean;
  esquiva: boolean;
  poder: boolean;
}

export type AcaoJogador = 'livre' | 'golpe' | 'esquiva' | 'poder';

export interface JogadorArena {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  ang: number;
  noChao: boolean;
  /** 0 … 3 */
  coracoes: number;
  /** invencibilidade depois de levar dano / renascer (pisca) */
  invencivel: number;
  /** sem corações (ou caiu da borda): bolha que flutua até o parceiro */
  bolha: boolean;
  /** barra de poder, 0 … PODER.max */
  poder: number;
  /** segundos desde que usou o poder (para o Golpe do Fio Vermelho); 99 = há muito tempo */
  desdePoder: number;
  acao: AcaoJogador;
  /** segundos desde o começo da ação atual */
  tAcao: number;
  /** golpe do combo em andamento: 0, 1 ou 2 */
  combo: number;
  /** apertou golpe de novo durante o golpe: emenda o próximo */
  encadear: boolean;
  /** o golpe/efeito da ação atual já foi aplicado */
  aplicou: boolean;
  recargaTiro: number;
  recargaEsquiva: number;
  recargaGolpe: number;
  /** direção da esquiva / do Corte Cometa (unitária, no chão) */
  dx: number; dz: number;
  /** bits dos botões no tick anterior (1 pulo, 2 golpe, 4 esquiva, 8 poder) */
  botoes: number;
}

export type TipoPerigo = 'onda' | 'esporo' | 'investida' | 'mergulho' | 'bote';
export type FormaPerigo = 'circulo' | 'anel' | 'linha';

/**
 * Ataque com aviso. Enquanto `aviso` > 0 é só a telegrafia (desenhar a sombra/marca no chão); depois fica ativo
 * por `dura` s (`t` conta o tempo ativo).
 * - circulo: centro (x, z), raio r.
 * - anel (onda de choque): centro (x, z); raio atual = r + REI.onda.vel * t; pula-se por cima.
 * - linha (investida): de (x, z) até (x2, z2), meia-largura r.
 */
export interface Perigo {
  id: number;
  tipo: TipoPerigo;
  forma: FormaPerigo;
  x: number; z: number; r: number;
  x2: number; z2: number;
  aviso: number;
  t: number;
  dura: number;
  /** bits: jogadores já atingidos (1, 2) e pilares já trincados (4 << k) */
  atingiu: number;
  /** -1 = do Rei; senão o id do bichinho que atacou */
  fonte: number;
}

export type TipoLacaio = 'bolotinha' | 'morcego';
export type EtapaLacaio = 'surgindo' | 'andando' | 'bote' | 'descanso';

export interface Lacaio {
  id: number;
  tipo: TipoLacaio;
  x: number; y: number; z: number;
  vida: number;
  etapa: EtapaLacaio;
  /** relógio da etapa */
  t: number;
  /** morcego: ângulo no círculo; bolotinha: para onde olha */
  ang: number;
  /** morcego: segundos de vida restantes; bolotinha: perigo do bote em andamento (-1 nenhum) */
  aux: number;
  /** jogador que ele mira agora */
  alvo: number;
}

export interface Disparo { id: number; dono: 0 | 1; x: number; y: number; z: number; vx: number; vz: number; /** m restantes */ resta: number }

export type EtapaRei = 'descanso' | 'aviso' | 'execucao';

export interface ReiArena {
  x: number; z: number; ang: number;
  vida: number;
  /** 1 Coroa Brava, 2 Névoa Teimosa, 3 Medo de se Perder */
  fase: 1 | 2 | 3;
  etapa: EtapaRei;
  /** segundos restantes da etapa */
  t: number;
  ataque: TipoAtaque | null;
  /** posição no ciclo de ataques da fase */
  ciclo: number;
  /** jogador mirado pelo ataque atual */
  alvo: number;
  /** fase 2: escudo de névoa (só poder ou Fio Vermelho quebram) */
  escudo: boolean;
  /** segundos vulnerável (escudo quebrado na fase 2; parede caída na fase 3) */
  vulneravel: number;
  /** segundos atordoado (não ataca nem anda) */
  atordoado: number;
  /** segundos do rugido de troca de fase (invulnerável) */
  transicao: number;
  /** investida: direção (unitária) e metros restantes */
  ix: number; iz: number; resta: number;
}

export interface Jardim { x: number; z: number; t: number }

export interface OpcoesArena {
  /** modo treino: uma pessoa joga; o parceiro acompanha (não leva dano) e cada cristal acende os dois */
  treino?: boolean;
  /** treino: quem joga (0 Natan, 1 Bruna). Pode ser trocado depois com `trocarSolo`. */
  solo?: 0 | 1;
}

export interface EstadoArena {
  tick: number;
  treino: boolean;
  /** treino: quem joga; o outro só acompanha */
  solo: 0 | 1;
  jogadores: [JogadorArena, JogadorArena];
  rei: ReiArena;
  perigos: Perigo[];
  lacaios: Lacaio[];
  disparos: Disparo[];
  /** vida de cada pilar (na ordem de PILARES.pos); 0 = quebrado */
  pilares: number[];
  /** fase 3: segundos que cada cristal ainda fica aceso (na ordem de CRISTAIS.pos) */
  cristais: number[];
  /** fase 3: 0 sem parede, 1 subindo (aviso, empurra cada um para o seu lado), 2 de pé */
  parede: 0 | 1 | 2;
  /** relógio da parede (s restantes da subida, ou até subir de novo) */
  tParede: number;
  jardim: Jardim | null;
  vitoria: boolean;
  /** segundos desde a vitória */
  tVitoria: number;
  /** o Rei virou vaga-lume (posição) */
  vagalume: { x: number; y: number; z: number } | null;
  /** quantas vezes a fase do chefe recomeçou (os dois caíram) */
  recomecos: number;
  proxId: number;
  /** eventos do último passo, para som e efeitos (não persistem) */
  eventos: string[];
}
