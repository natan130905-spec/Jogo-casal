// Capítulo 1 — balões de fala (docs/revisao/NARRATIVA_CASAL.md §5), cortado para caber em ≤ 90 s de balão por
// passada (PLANO C14) e só com textos genéricos (C10: o site é público; os [REAL] ficam para o pacote cifrado do
// L11). Fora desta versão: Seu Algodão, a caixinha de música e o vislumbre (geometria e convites do L8b), a contagem
// de estrelinhas e o "…obrigado" do bichinho (cortes do C14). Mapa do capítulo: src/core/fases/cap1_brinquedos.ts.
import type { Estado } from '../../core/types';
import type { CtxFala, Roteiro } from './tipos';

const vivos = (e: Estado) => e.jogadores.filter((j) => !j.bolha);
/** o primeiro (0 ou 1) que satisfaz p, ou -1 */
const qual = (e: Estado, p: (j: Estado['jogadores'][number], i: number) => boolean) => e.jogadores.findIndex((j, i) => !j.bolha && p(j, i));
const emCimaDaCaixa = (j: Estado['jogadores'][number]) => j.x >= 52 && j.x <= 58 && j.y >= 2.6;
const aoPeDaCaixa = (j: Estado['jogadores'][number]) => j.x >= 45.5 && j.x < 52.2 && j.y < 1;

/** quem chegou primeiro em cima da caixa (guardado na memória da fala) */
function primeiroEmCima(c: CtxFala) {
  if (c.mem.cima === undefined) { const i = qual(c.e, emCimaDaCaixa); if (i >= 0) c.mem.cima = i; }
  return c.mem.cima ?? -1;
}

export const ROTEIRO_CAP1: Roteiro = {
  cap: 1,
  falas: [
    // ---- abertura (x 0–6): os controles já respondem; os balões vão junto
    { id: 'c1-01', gatilho: { inicio: true }, quem: 'B', texto: 'A gente… encolheu?', depois: 'c1-02' },
    { id: 'c1-02', quem: 'N', texto: 'Ou a loja cresceu. Prefiro essa versão.', depois: 'c1-03' },
    { id: 'c1-03', quem: 'L', texto: 'Hu-hu! Tomem estilingue e espada, meus filhotes.', depois: 'c1-05' },
    { id: 'c1-05', quem: 'L', texto: 'A névoa virou bichinho. Devolvam com carinho…', depois: 'c1-08' },
    { id: 'c1-08', quem: 'L', texto: 'E não se separem. Sozinho ninguém chega ao fim.' },

    // ---- aprender (x 0–31)
    { id: 'c1-09', pool: 'dica', mecanica: 'andar', quem: 'O', texto: 'Arrasta o círculo da esquerda pra andar.',
      gatilho: { por: 5, cond: ({ e, f }) => e.tick < 8 * 60 ? -1 : qual(e, (j, i) => Math.abs(j.x - f.inicio[i].x) < 0.8) } },
    { id: 'c1-10', pool: 'dica', mecanica: 'pular', quem: 'O', texto: 'Segura o ⬆ que o pulo vai mais alto.',
      gatilho: { zona: [4, 8.5], por: 4 } },
    { id: 'c1-12', emPerigo: true, quem: 'B', texto: 'Olha. Ele tem cara de quem perdeu o ônibus.',
      gatilho: { zona: [11, 16], cond: ({ e }) => (e.inimigos[0]?.vivo ? 0 : -1) } },
    { id: 'c1-11', pool: 'dica', mecanica: 'atirar', emPerigo: true, quem: 'O', texto: 'Toca no 🎯 e manda uma pedrinha nele!',
      gatilho: { por: 2, cond: ({ e }) => { const n = e.inimigos[0]; return n?.vivo ? qual(e, (j) => Math.abs(j.x - n.x) < 7) : -1; } } },
    { id: 'c1-13', pool: 'reacao', quem: 'P', texto: 'Virou estrelinha!', depois: 'c1-14', gatilho: { evento: 'derrota' } },
    { id: 'c1-14', pool: 'reacao', quem: 'O', texto: 'Só precisava de um carinho. De pedra.' },
    { id: 'c1-15', pool: 'reacao', quem: 'P', texto: 'Ninguém viu isso.', depois: 'c1-16', gatilho: { evento: 'caiu' } },
    { id: 'c1-16', pool: 'reacao', quem: 'O', texto: 'Eu vi. Vou lembrar pra sempre.' },
    { id: 'c1-17', pool: 'dica', mecanica: 'lanterna', quem: 'N', texto: 'Uma lanterna. Se der ruim, a gente volta aqui.',
      gatilho: { evento: 'lanterna' } },
    { id: 'c1-18', pool: 'dica', mecanica: 'bolha', emPerigo: true, quem: 'P', texto: 'Virei bolha! Vou flutuando até você.',
      gatilho: { evento: 'bolha' } },

    // ---- a tampa da caixa (x 33–48): a primeira ajuda
    { id: 'c1-20', quem: 'P', texto: 'Uma placa… e a tampa tá fechada.', gatilho: { zona: [33, 36] } },
    { id: 'c1-21', pool: 'dica', mecanica: 'placa', quem: 'O', texto: 'Um segura a placa, o outro passa?',
      gatilho: { zona: [33, 39.5], por: 6, cond: ({ e }) => ((e.portas.tampa ?? 0) < 0.5 && !e.placasPressionadas['placa-tampa-a'] ? 0 : -1) } },
    // quem ficou esperando agradece a quem voltou para segurar a placa do lado de lá
    { id: 'c1-24', quem: 'P', texto: { N: 'Obrigado por voltar.', B: 'Obrigada por voltar.' }, depois: 'c1-25',
      gatilho: { cond: (c) => {
        const j = c.e.jogadores;
        if (c.mem.primeiro === undefined) { const i = qual(c.e, (p) => p.x > 41); if (i >= 0) c.mem.primeiro = i; }
        return c.mem.primeiro !== undefined && vivos(c.e).length === 2 && j[0].x > 41.5 && j[1].x > 41.5 && j[0].x < 52 && j[1].x < 52 ? 1 - c.mem.primeiro : -1;
      } } },
    { id: 'c1-25', quem: 'O', texto: 'Não ia te deixar numa caixa de brinquedos.' },

    // ---- a caixa alta (x 48–60): mãos dadas
    { id: 'c1-30', pool: 'dica', mecanica: 'maos', quem: 'O', texto: 'Alto demais. Me dá a mão no ✋ e pula comigo!',
      gatilho: { zona: [46.5, 51.8], ambos: true, por: 3, cond: ({ e }) => (qual(e, emCimaDaCaixa) < 0 ? 0 : -1) } },
    { id: 'c1-32', pool: 'reacao', quem: 'O', texto: 'Viu? De mão dada a gente quase voa.', gatilho: { evento: 'maos' } },
    { id: 'c1-33', pool: 'dica', mecanica: 'puxar', quem: 'P', texto: 'Pula e segura o ✋ que eu te puxo.',
      gatilho: { por: 3, cond: ({ e }) => { const i = qual(e, emCimaDaCaixa); return i >= 0 && aoPeDaCaixa(e.jogadores[1 - i]) && !e.jogadores[1 - i].bolha ? i : -1; } } },
    { id: 'c1-34', quem: 'N', texto: 'Você é mais forte do que parece.', depois: 'c1-35',
      gatilho: { cond: (c) => (primeiroEmCima(c) === 1 && c.e.jogadores.every(emCimaDaCaixa) ? 1 : -1) } },
    { id: 'c1-35', quem: 'B', texto: 'Eu sou exatamente tão forte quanto pareço.' },
    { id: 'c1-34b', quem: 'B', texto: 'Nem precisava. Mas gostei.',
      gatilho: { cond: (c) => (primeiroEmCima(c) === 0 && c.e.jogadores.every(emCimaDaCaixa) ? 0 : -1) } },

    // ---- trenzinho (x 60–72)
    { id: 'c1-40', quem: 'N', texto: 'Piuí! Todo mundo a bordo!', depois: 'c1-41', gatilho: { zona: [61, 64] } },
    { id: 'c1-41', quem: 'B', texto: 'É um trenzinho de brinquedo, Natan.' },
    { id: 'c1-42', pool: 'dica', mecanica: 'trem', quem: 'O', texto: 'Espera o trenzinho chegar e pula nele.',
      gatilho: { zona: [61.5, 64.2], por: 4 } },

    // ---- blocos e o segredo na prateleira alta (x 104–124)
    { id: 'c1-61', quem: 'B', texto: 'Tem alguma coisa brilhando lá em cima…',
      gatilho: { zona: [106, 118], por: 1, cond: ({ e }) => (qual(e, (j) => j.y > 4.5) < 0 ? 0 : -1) } },
    { id: 'c1-62', pool: 'dica', mecanica: 'marca', quem: 'N', texto: 'Mão dada de novo? Lá na marca das mãos.',
      gatilho: { zona: [111.5, 118.5], por: 9, cond: ({ e }) => (qual(e, (j) => j.y > 4.5) < 0 ? 0 : -1) } },
    { id: 'c1-63', quem: 'P', texto: 'Achei! Ninguém olha pra cima nessa loja.',
      gatilho: { cond: ({ e }) => qual(e, (j) => j.y >= 5 && j.x >= 113.3 && j.x <= 116.7) } },

    // ---- portão da prateleira (x 124–156)
    { id: 'c1-70', pool: 'dica', mecanica: 'placa-alta', quem: 'P', texto: 'Um sobe na prateleira e abre o portão pro outro.',
      gatilho: { zona: [134, 140], por: 1, cond: ({ e }) => ((e.portas.portao ?? 0) < 0.5 ? 0 : -1) } },
    { id: 'c1-71', quem: 'P', texto: 'Pode passar. A porta é sua.', depois: 'c1-72',
      gatilho: { evento: 'porta-abriu:portao', cond: ({ e }) => qual(e, (j) => j.y >= 3 && j.x >= 140.5 && j.x <= 145.5) } },
    { id: 'c1-72', quem: 'O', texto: { N: 'Que dama.', B: 'Que cavalheiro.' } },

    // ---- o pódio (x 160–172)
    { id: 'c1-80', quem: 'B', texto: 'O primeiro pedaço da estrela!', depois: 'c1-81', gatilho: { zona: [161, 166] } },
    { id: 'c1-81', quem: 'N', texto: 'Juntos, no três?', depois: 'c1-82' },
    { id: 'c1-82', quem: 'B', texto: 'Um… dois… três!' },

    // ---- pools (repetem com espera; uma de cada pool a cada 60 s)
    { id: 'c1-r1', pool: 'resgate', espera: 60, gatilho: { evento: 'renasce' }, quem: ['O', 'O', 'P'],
      texto: ['Te peguei.', 'De nada, viu?', 'Sabia que você vinha.'] },
    { id: 'c1-r2', pool: 'reacao', espera: 60, gatilho: { evento: 'volta-checkpoint' }, quem: 'N', texto: 'De novo. Juntos.', depois: 'c1-r3' },
    { id: 'c1-r3', pool: 'reacao', quem: 'B', texto: 'Essa não conta.' },
    { id: 'c1-o1', pool: 'ocioso', espera: 60, gatilho: { ocioso: 12 }, quem: ['N', 'B', 'L'],
      texto: ['Se a gente parar, a névoa ganha.', 'Tô pensando. Pensar é andar com a cabeça.', 'Zzz… hu? Tô acordada!'] },
  ],
};
