// Textos da história (docs/HISTORIA.md) e dados dos capítulos para as telas: prólogo, lembranças, final e mapa.
import { FLORESTA_1, faseDoCapitulo } from '../core/fases';
import type { Fase } from '../core/types';
import type { Ilustracao } from './ilustracoes';

export interface Quadro {
  /** texto curto do quadro */
  texto: string;
  /** ilustração desenhada em SVG (sempre presente; aparece por baixo e enquanto a arte carrega) */
  ilustracao: Ilustracao;
  /** arte pintada opcional (public/arte), por cima da ilustração */
  arte?: string;
  /** fala em destaque (aspas) */
  fala?: boolean;
}

export interface InfoCapitulo {
  n: number;
  nome: string;
  lembranca: string;
  frase: string;
  novidade: string;
  arte: string;
  /** cor do brilho da ilha no mapa */
  cor: string;
}

const A = (f: string) => `./arte/${f}.webp`;

export const CAPITULOS_INFO: readonly InfoCapitulo[] = [
  { n: 1, nome: 'Pequenos em um mundo gigante', lembranca: 'A tarde em que se conheceram, numa loja de brinquedos.',
    frase: 'Você riu do mesmo urso de pelúcia que eu. Foi ali que tudo começou.', novidade: 'Andar, pular, atirar, placas e mãos dadas',
    arte: A('06_cap1_brinquedos'), cor: '#ffb86b' },
  { n: 2, nome: 'A floresta dos sonhos', lembranca: 'O primeiro passeio, quando se perderam numa trilha e riram disso.',
    frase: 'A gente se perdeu… e mesmo assim foi o melhor caminho.', novidade: 'O Fio Vermelho: um segura o outro',
    arte: A('07_cap2_floresta'), cor: '#7dffb0' },
  { n: 3, nome: 'A cidade do tempo', lembranca: 'O dia em que um esperou o outro por horas e não desistiu.',
    frase: 'Eu esperaria de novo. Quantas horas fossem.', novidade: 'Ponteiros que giram e portas duplas',
    arte: A('08_cap3_relogio'), cor: '#ffd36b' },
  { n: 4, nome: 'O oceano das lembranças', lembranca: 'A primeira viagem à praia.',
    frase: 'O mar levou nosso castelo de areia, mas a risada ficou.', novidade: 'Bolhas e o pêndulo do fio',
    arte: A('09_cap4_praia'), cor: '#6bd8ff' },
  { n: 5, nome: 'O reino dos doces', lembranca: 'O primeiro bolo que fizeram juntos (e queimaram).',
    frase: 'Queimou tudo. Foi o bolo mais gostoso do mundo.', novidade: 'Gelatinas que quicam e muitos bichinhos',
    arte: A('10_cap5_doces'), cor: '#ff8fd0' },
  { n: 6, nome: 'O labirinto dos espelhos', lembranca: 'A primeira briga — e o primeiro pedido de desculpas.',
    frase: 'Desculpa. Brigar com você me ensinou a abraçar mais forte.', novidade: 'Caminhos espelhados: um abre o do outro',
    arte: A('11_cap6_espelhos'), cor: '#b98cff' },
  { n: 7, nome: 'O coração do universo', lembranca: 'A noite da estrela.',
    frase: 'O mesmo pedido, ao mesmo tempo. A gente nunca vai se esquecer.', novidade: 'Ilhas flutuantes e o Rei-Pesadelo',
    arte: A('12_cap7_estrela'), cor: '#fff1a8' },
];

export const PROLOGO: readonly Quadro[] = [
  { ilustracao: 'morro', arte: A('01_prologo1'),
    texto: 'Um ano juntos. Natan e Bruna sobem o morro atrás de casa para ver o céu, como no primeiro encontro.' },
  { ilustracao: 'cadente', arte: A('02_prologo2'), fala: true,
    texto: 'Uma estrela cadente risca o céu e os dois fazem o mesmo pedido, em segredo: “que a gente nunca esqueça nada do que viveu juntos”.' },
  { ilustracao: 'pedacos', arte: A('03_prologo3'),
    texto: 'A estrela ouve… mas cai perto demais e se parte em sete pedaços. Os dois adormecem ali mesmo, encostados um no outro.' },
  { ilustracao: 'nevoa', arte: A('04_prologo4'),
    texto: 'Acordam dentro do sonho. Mas a Névoa do Esquecimento transforma as lembranças em bichinhos-pesadelo, todos emburrados.' },
  { ilustracao: 'coruja', arte: A('05_prologo5'),
    texto: 'Dona Lume, a vovó-coruja dos sonhos, entrega o Lança-Estrelas, que devolve as lembranças, e o Fio Vermelho, que une os dois.' },
  { ilustracao: 'sete',
    texto: 'Juntem os sete pedaços da estrela, um em cada lembrança… e acordem juntos.' },
];

export const FINAL: readonly Quadro[] = [
  { ilustracao: 'estrela-inteira',
    texto: 'Com os sete pedaços, a estrela se reconstrói e a Névoa do Esquecimento se desfaz.' },
  { ilustracao: 'vagalume',
    texto: 'O Rei-Pesadelo era só a maior lembrança esquecida: o medo de se perder um do outro. Agora é um vaga-lume pousado no ombro dos dois.' },
  { ilustracao: 'amanhecer', arte: A('13_final'),
    texto: 'Natan e Bruna acordam no morro, de manhã, ainda de mãos dadas. No céu do amanhecer, uma estrela pequena continua acesa.' },
  { ilustracao: 'fim', fala: true,
    texto: '“Algumas coisas a gente não precisa lembrar sozinho.”' },
];

/** Cena curta de lembrança ao concluir o capítulo n. */
export function lembranca(n: number): Quadro[] {
  const c = info(n);
  const f = faseDoCapitulo(n) as (Fase & { lembranca?: string; frase?: string }) | undefined;
  return [
    { ilustracao: 'lembranca', arte: c.arte, texto: f?.lembranca ?? c.lembranca },
    { ilustracao: 'pedaco', fala: true, texto: `“${(f?.frase ?? c.frase).replace(/^“|”$/g, '')}”` },
  ];
}

export const info = (n: number): InfoCapitulo => CAPITULOS_INFO[Math.max(1, Math.min(7, n)) - 1];

/** Fase jogável do capítulo n. Enquanto o capítulo não tem fase própria, usa uma provisória (a floresta de teste). */
export function faseDoCap(n: number): Fase {
  const f = faseDoCapitulo(n);
  if (f) return f;
  return { ...FLORESTA_1, id: `cap${n}-provisoria`, nome: info(n).nome, capitulo: n };
}

/** Estrelinhas possíveis numa fase: as espalhadas + uma por bichinho (o Rei não conta). */
export const estrelinhasPossiveis = (f: Fase) =>
  (f.estrelinhas?.length ?? 0) + (f.inimigos ?? []).length; // cada bichinho derrotado (o Rei também) solta uma
