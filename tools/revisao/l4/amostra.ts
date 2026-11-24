// L4: imprime instantâneos de amostra do cap. N com os bots (para ver o que pesa). Uso: rodar.sh amostra [cap] [ticks...]
import { CAPITULOS } from '../../../src/core/fases/index';
import { instantaneo } from '../../../src/core/instantaneo';
import { jogar } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';
const n = Number(process.argv[2] ?? 1), ticks = process.argv.slice(3).map(Number);
const f = CAPITULOS[n - 1];
jogar(f, PLANOS[f.id], { cada: (e) => { if (ticks.includes(e.tick)) console.log(e.tick, JSON.stringify(instantaneo(f, e))); } });
