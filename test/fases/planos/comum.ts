import { carona as caronaPasso, type Etapa } from '../bot';

/** Os dois pegam a plataforma k: esperam em `espera`, sobem quando o canto dela está em `xEmbarque`, descem quando
 *  está em `xDesce` e andam até `saida`. */
export const carona = (k: number, espera: number, xEmbarque: number, xDesce: number, saida: number, o: { pular?: boolean } = {}): Etapa => ({
  nome: `carona na plataforma ${k}`,
  p: [
    [caronaPasso(k, espera, xEmbarque, xDesce, saida, { ...o, dx: 0.45 })],
    [caronaPasso(k, espera - 0.35, xEmbarque, xDesce, saida - 0.7, { ...o, dx: -0.45 })],
  ],
});
