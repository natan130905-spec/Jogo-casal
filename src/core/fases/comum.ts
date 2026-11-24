// Peças comuns das fases dos capítulos. Medidas em metros, y para cima; o chão "normal" tem o topo em y = 0.
import type { Fase, Retangulo } from '../types';

/** Chave do tema visual (o artista monta o cenário por ela). */
export type TemaVisual = 'brinquedos' | 'floresta' | 'relogio' | 'oceano' | 'doces' | 'espelhos' | 'cosmos';

export interface FaseCapitulo extends Fase {
  capitulo: number;
  tema: TemaVisual;
  /** a lembrança do capítulo (aparece na tela de capítulo concluído) */
  lembranca: string;
  /** frase curta da lembrança, dita quando o pedaço da estrela é tocado */
  frase: string;
  /** novidade de jogo do capítulo (para o mapa e a tela de carregamento) */
  novidade: string;
}

/** Bloco com o topo em `topo`, de x0 a x1, com `h` de espessura (padrão 1). */
export const chao = (x0: number, x1: number, topo = 0, h = 1): Retangulo => ({ x: x0, y: topo - h, w: x1 - x0, h });
/** Bloco apoiado: canto de baixo em (x, y), largura w, altura h. */
export const bloco = (x: number, y: number, w: number, h: number): Retangulo => ({ x, y, w, h });
/** Plataforma fina (0,5 m) com o topo em `topo`. */
export const tabua = (x0: number, x1: number, topo: number, h = 0.5): Retangulo => chao(x0, x1, topo, h);
/** Fileira de estrelinhas de (x0, y) a (x1, y), `n` estrelinhas. */
export const fileira = (x0: number, x1: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1), y }));
/** Arco de estrelinhas (para marcar o caminho de um pulo). */
export const arco = (x0: number, x1: number, y: number, altura: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const k = n === 1 ? 0.5 : i / (n - 1);
    return { x: x0 + (x1 - x0) * k, y: y + altura * 4 * k * (1 - k) };
  });
