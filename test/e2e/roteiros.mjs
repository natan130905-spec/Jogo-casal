// Grava as entradas dos dois bots cooperativos (test/fases) jogando cada capítulo na simulação de verdade.
// Como a simulação é determinística, o jogo no navegador reproduz a mesma partida com window.__edm.roteiro(lista).
import { createServer } from 'vite';

/** Devolve { [capitulo]: { lista: [P1, P2][], segundos, estrelinhas } } para os capítulos pedidos. */
export async function gravarRoteiros(caps = [1, 2, 3, 4, 5, 6, 7]) {
  const vs = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  try {
    const { jogar } = await vs.ssrLoadModule('/test/fases/bot.ts');
    const { PLANOS } = await vs.ssrLoadModule('/test/fases/planos/index.ts');
    const { faseDoCapitulo } = await vs.ssrLoadModule('/src/core/fases.ts');
    const saida = {};
    for (const n of caps) {
      const f = faseDoCapitulo(n);
      const lista = [];
      const r = jogar(f, PLANOS[f.id], { limite: 420, entradas: (ents) => lista.push(ents.map((i) => ({ ...i }))) });
      if (!r.concluida) throw new Error(`bots não venceram o capítulo ${n}: ${r.erro}`);
      saida[n] = { lista, segundos: r.segundos, estrelinhas: r.estrelinhas, derrotados: r.derrotados, id: f.id };
    }
    return saida;
  } finally { await vs.close(); }
}
