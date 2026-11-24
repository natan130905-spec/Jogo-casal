// Grava as entradas dos bots da Arena do Coração (test/arena_bot.ts) jogando a luta inteira na simulação de verdade.
// Como o núcleo é determinístico, o jogo no navegador reproduz a mesma luta com window.__edm.roteiro(lista).
// Formato compacto de cada tick: [[x, y, bits], [x, y, bits]] com yaw 0 (bits: 1 pulo, 2 golpe, 4 tiro, 8 esquiva,
// 16 poder) — o mesmo que __edm.roteiro aceita na arena.
import { createServer } from 'vite';

const comprimir = (i) => [Math.round(i.x * 1000) / 1000, Math.round(i.y * 1000) / 1000,
  (i.pulo ? 1 : 0) | (i.golpe ? 2 : 0) | (i.tiro ? 4 : 0) | (i.esquiva ? 8 : 0) | (i.poder ? 16 : 0)];

/** { lista, segundos, vitoria } da luta com dois bots (`treino`: uma pessoa só). Perfil padrão: dupla perfeita. */
export async function gravarRoteiroArena({ treino = false, acerto = 1, desvio = 1, semente = 1, maxSeg = 900 } = {}) {
  const vs = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  try {
    const { BotArena } = await vs.ssrLoadModule('/test/arena_bot.ts');
    const { estadoInicialArena, passoArena } = await vs.ssrLoadModule('/src/core/arena/index.ts');
    const e = estadoInicialArena({ treino });
    const bots = [new BotArena(0, { acerto, desvio, semente: semente * 11 }), new BotArena(1, { acerto, desvio, semente: semente * 17 })];
    const lista = [];
    while (!e.vitoria && e.tick < maxSeg * 60) {
      // arredonda antes de simular: a luta gravada é exatamente a que o navegador vai reproduzir
      const ents = [bots[0].entrada(e), bots[1].entrada(e)].map(comprimir);
      lista.push(ents);
      passoArena(e, ents.map(([x, y, b]) => ({ x, y, yaw: 0, pulo: !!(b & 1), golpe: !!(b & 2), tiro: !!(b & 4), esquiva: !!(b & 8), poder: !!(b & 16) })));
    }
    return { lista, segundos: e.tick / 60, vitoria: e.vitoria, recomecos: e.recomecos };
  } finally { await vs.close(); }
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL(process.argv[1], 'file://' + process.cwd() + '/').pathname) {
  for (const treino of [false, true]) {
    const r = await gravarRoteiroArena({ treino });
    console.log(`${treino ? 'treino' : 'dupla '}: vitória ${r.vitoria} em ${r.segundos.toFixed(1)} s, ${r.lista.length} ticks, ${(JSON.stringify(r.lista).length / 1e6).toFixed(2)} MB`);
  }
}
