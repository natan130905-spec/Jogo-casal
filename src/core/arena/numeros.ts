// Números da Arena do Coração (capítulo 7, fase 3D final). Todos ajustados pelos testes de balanceamento
// (test/arena_balanceamento.test.ts) e documentados em docs/ARENA_FINAL.md, seção "Números".
// Medidas em metros, tempo em segundos, ângulos em radianos. Chão no plano x-z, y para cima, centro da ilha em (0, 0).

export const DT = 1 / 60;

export const ILHA = Object.freeze({
  /** raio da ilha (24 m de diâmetro); além disso não há chão */
  raio: 12,
  /** abaixo desta altura quem caiu da borda volta como bolha */
  queda: -4,
});

/** Corpo dos jogadores (cilindro): raio e altura. */
export const CORPO = Object.freeze({ raio: 0.4, altura: 1.1 });

export const MOVIMENTO = Object.freeze({
  vel: 6, acelChao: 50, acelAr: 18,
  gravidade: 25, pulo: 9,
  /** andar durante o golpe (fração da velocidade) */
  noGolpe: 0.3,
  /** avanço curto a cada golpe do combo (m/s) */
  avancoGolpe: 2.5,
  /** trava no alvo (Rei ou cristal) quando o joystick está solto e o alvo está a até esta distância */
  travaAlvo: 16,
});

export const VIDA = Object.freeze({
  coracoes: 3, invencivel: 1, invencivelRenasce: 1.5,
  /** empurrão ao levar dano (m/s) */
  recuo: 6,
  velBolha: 5, encostar: 1.2, alturaBolha: 1.2,
});

export const ESQUIVA = Object.freeze({ dura: 0.4, vel: 10, invencivel: 0.35, recarga: 0.6 });

export interface Arma {
  nome: string;
  /** dano de cada golpe do combo de 3 */
  golpes: readonly [number, number, number];
  /** duração de um golpe e instante (desde o começo) em que ele acerta */
  dura: number; tAcerto: number;
  /** alcance a partir da borda do corpo do jogador até a borda do alvo */
  alcance: number;
  /** abertura do golpe (graus, total) */
  arco: number;
  /** espera depois do 3º golpe */
  recargaCombo: number;
}

/** Armas brancas: índice 0 = Natan (Espada da Aurora), 1 = Bruna (Lança de Pétala). */
export const ARMAS: readonly [Arma, Arma] = Object.freeze([
  Object.freeze({ nome: 'Espada da Aurora', golpes: [3, 3, 3] as const, dura: 0.3, tAcerto: 0.1, alcance: 1.5, arco: 120, recargaCombo: 0.25 }),
  Object.freeze({ nome: 'Lança de Pétala', golpes: [3, 3, 4] as const, dura: 0.42, tAcerto: 0.18, alcance: 2.4, arco: 70, recargaCombo: 0.3 }),
]) as readonly [Arma, Arma];

/** Lança-Estrelas (tiro fraco). Segurar = dispara na cadência. */
export const TIRO = Object.freeze({ dano: 1, vel: 18, alcance: 16, cadencia: 0.33, altura: 1.0, raio: 0.25 });

export const PODER = Object.freeze({
  max: 100,
  porGolpe: 6, porTiro: 2, porLacaio: 4, porEsquivaPerfeita: 20,
  /** perto do parceiro (a menos de `perto` m): enche por segundo */
  pertoPorSeg: 3, perto: 4,
  /** Corte Cometa (Natan): avanço em linha reta que atravessa e atordoa */
  cometa: Object.freeze({ dano: 30, dist: 8, vel: 22, atordoa: 2 }),
  /** Jardim de Luz (Bruna): cura o parceiro, enfraquece a névoa */
  jardim: Object.freeze({ dano: 30, raio: 4.5, dura: 5, lancar: 0.5, cura: 1 }),
  /** Golpe do Fio Vermelho: os dois usam o poder a até `janela` s um do outro */
  fio: Object.freeze({ janela: 3, dano: 15, atordoa: 3 }),
});

export type TipoAtaque = 'pancada' | 'esporos' | 'invocar' | 'investida' | 'morcegos';

export const REI = Object.freeze({
  raio: 1.6, altura: 4,
  vidaMax: 3400,
  /** frações da vida em que mudam as fases (1→2, 2→3) */
  limiares: Object.freeze([2 / 3, 1 / 3]) as readonly number[],
  vel: 1.8,
  /** distância que tenta manter dos jogadores (centro a centro) */
  distancia: 3.5,
  /** fica a até este raio do centro da ilha */
  raioMax: 8,
  inicio: Object.freeze({ x: 0, z: -3 }),
  /** rugido de troca de fase (invulnerável, sem atacar) */
  transicao: 2,
  /** fase 2: tempo vulnerável depois de quebrar o escudo */
  vulneravelEscudo: 6,
  /** fase 3: tempo vulnerável (atordoado, estrela do peito à mostra) depois que a parede cai */
  vulneravelParede: 8,
  /** fase 3: dano na estrela do peito */
  multEstrela: 1.5,
  /** aviso (telegrafia) de cada ataque, por fase; nunca menos de 0,8 s */
  aviso: Object.freeze([1.0, 1.0, 0.8]) as readonly number[],
  /** pausa entre ataques, por fase */
  descanso: Object.freeze([1.6, 1.4, 1.0]) as readonly number[],
  /** ordem dos ataques em cada fase (repete) */
  ciclos: Object.freeze([
    ['pancada', 'esporos', 'invocar', 'esporos', 'pancada', 'esporos'],
    ['investida', 'esporos', 'morcegos', 'investida', 'esporos'],
    ['esporos', 'pancada', 'morcegos', 'esporos', 'pancada'],
  ]) as readonly (readonly TipoAtaque[])[],
  /** duração da execução de cada ataque (depois do aviso) */
  execucao: Object.freeze({ pancada: 0.6, esporos: 0.3, invocar: 0.3, investida: 0, morcegos: 0.3 }) as Readonly<Record<TipoAtaque, number>>,
  onda: Object.freeze({ vel: 9, largura: 0.7, alturaPulo: 0.45, raioMax: 13 }),
  esporo: Object.freeze({ raio: 1.3, extras: 2, dura: 0.15 }),
  investida: Object.freeze({ vel: 16, meiaLargura: 2.0, dist: 14 }),
});

export const LACAIO = Object.freeze({
  surgir: 0.8,
  bolotinha: Object.freeze({ vida: 1, vel: 2.4, perto: 1.6, aviso: 0.9, raio: 1.1, descanso: 1.2, quantos: 3, max: 3 }),
  morcego: Object.freeze({ vida: 1, raio: 9, altura: 2.5, velAng: 0.6, intervalo: 3, aviso: 0.9, raioMergulho: 1.2, duraVida: 20, quantos: 4, max: 4 }),
});

/** Pilares de cristal (cobertura): bloqueiam o movimento e os tiros; a onda de choque trinca, a investida quebra. */
export const PILARES = Object.freeze({
  raio: 0.6, vida: 3,
  pos: Object.freeze([30, 90, 150, 210, 270, 330].map((g) => {
    const a = (g * Math.PI) / 180;
    return Object.freeze({ x: Math.round(7.5 * Math.sin(a) * 100) / 100, z: Math.round(7.5 * Math.cos(a) * 100) / 100 });
  })) as readonly { x: number; z: number }[],
});

/** Fase 3: parede de névoa no plano x = 0; Natan fica do lado x < 0, Bruna do lado x > 0. Um cristal de cada lado. */
export const PAREDE = Object.freeze({ meiaLargura: 0.5, aviso: 1.2, empurrao: 6 });
export const CRISTAIS = Object.freeze({
  raio: 0.6,
  /** segundos aceso depois de acertado (com o Jardim de Luz ativo, mais tempo) */
  aceso: 2, acesoJardim: 4,
  pos: Object.freeze([Object.freeze({ x: -6, z: 2.5 }), Object.freeze({ x: 6, z: 2.5 })]) as readonly { x: number; z: number }[],
});

/** Posições de começo (de cada fase, e ao recomeçar a fase). */
export const INICIO = Object.freeze([Object.freeze({ x: -3, z: 7 }), Object.freeze({ x: 3, z: 7 })]) as readonly { x: number; z: number }[];
