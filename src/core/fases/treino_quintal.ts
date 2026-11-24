// Quintal de Treino (L2b, mínimo): a oficina de mecânicas (EXEMPLO_MECANICAS) com um campo de bonecos no lugar da
// arena do Rei. Tudo liberado e nada conta para a campanha: a partida de treino nunca grava o salvo (só a chave
// edm-treino-v1). Sem pedaço da estrela: sai-se pela pausa. Os bonecos (bichinhos parados ou lentos) voltam alguns
// segundos depois de derrotados (src/ui/partida.ts, só nesta fase).
import { EXEMPLO_MECANICAS } from '../fases';
import type { Fase } from '../types';

export const ID_QUINTAL = 'treino-quintal';
/** s até um boneco derrotado voltar */
export const VOLTA_BONECO = 4;

export const TREINO_QUINTAL: Fase & { tema: 'brinquedos' } = {
  ...EXEMPLO_MECANICAS,
  id: ID_QUINTAL,
  nome: 'Quintal de Treino',
  tema: 'brinquedos',
  // sem pedaço da estrela (fora do alcance): o treino não acaba sozinho
  portal: { x: 200, y: -100, w: 1, h: 1 },
  inimigos: [
    // os da oficina menos o Rei: a bolotinha (x 6) e o espinhudo (x 9) já estão no chão do começo, antes do fio, onde
    // quem treina sozinho alcança (o outro personagem fica parado; com ⇄ dá para passar o fio trocando)
    ...(EXEMPLO_MECANICAS.inimigos ?? []).filter((n) => n.tipo !== 'rei'),
    // campo dos bonecos depois da porta dupla (x 50–66): três cogumelos parados e uma bolotinha
    { tipo: 'cogumelo', x: 52, y: 0 },
    { tipo: 'cogumelo', x: 57, y: 0 },
    { tipo: 'cogumelo', x: 62, y: 0 },
    { tipo: 'bolotinha', x: 59, y: 0 },
  ],
};
