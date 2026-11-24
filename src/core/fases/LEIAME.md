# Fases dos capítulos

Uma fase por capítulo de `docs/HISTORIA.md`. São dados puros (o formato `Fase` de `src/core/types.ts`), sem Three.js.

| Arquivo | id | Capítulo | Tema (`tema`) | Novidade |
|---|---|---|---|---|
| `cap1_brinquedos.ts` | `cap1-brinquedos` | 1. Pequenos em um mundo gigante | `brinquedos` | andar, pular, atirar, placas, mãos dadas, trenzinho |
| `cap2_floresta.ts` | `cap2-floresta` | 2. A floresta dos sonhos | `floresta` | Fio Vermelho: balançar e soltar; pular e subir pela corda |
| `cap3_relogio.ts` | `cap3-relogio` | 3. A cidade do tempo | `relogio` | ponteiros que giram, portas duplas |
| `cap4_oceano.ts` | `cap4-oceano` | 4. O oceano das lembranças | `oceano` | bolhas, argolas, fio sobre a água, barquinho |
| `cap5_doces.ts` | `cap5-doces` | 5. O reino dos doces | `doces` | gelatinas, biscoitos que quebram, muitos bichinhos |
| `cap6_espelhos.ts` | `cap6-espelhos` | 6. O labirinto dos espelhos | `espelhos` | dois corredores; a placa de cada porta fica no corredor do outro |
| `cap7_cosmos.ts` | `cap7-cosmos` | 7. O coração do universo | `cosmos` | ilhas flutuantes, fio o tempo todo, Rei-Pesadelo |

Uso: `import { CAPITULOS, faseDoCapitulo } from './core/fases'` (também estão em `FASES[id]`).
Cada fase é um `FaseCapitulo` (`comum.ts`): `Fase` + `capitulo`, `tema`, `lembranca`, `frase` (dita ao tocar o
pedaço da estrela) e `novidade` (para o mapa). O comentário no topo de cada arquivo diz o que há em cada trecho (x).

## Regras de desenho (o que os testes conferem)
- 150–320 m; lanternas a cada 18–42 m; ≥ 20 estrelinhas e ≥ 4 bichinhos.
- Nada nasce dentro de parede; bichinhos que andam nascem em cima de chão fixo; toda porta tem placa.
- **Vencível**: dois bots cooperativos roteirizados (`test/fases/planos/capN.ts`) jogam a simulação de verdade do
  início ao pedaço da estrela, sem os dois virarem bolha (`test/fases.test.ts`).
- **Sem armadilha**: `test/fases/alcance.ts` monta o grafo de lugares e saltos (mesma física do núcleo) e busca no
  espaço dos dois jogadores juntos: de todo par de posições alcançável ainda se chega ao fim, inclusive depois de
  voltar a qualquer lanterna. Quem passa à frente tem sempre um jeito de voltar para ajudar (degraus "do lado de lá",
  placas coladas na porta do lado de lá, o barquinho do capítulo 4).
- **Cooperativa**: sozinho (sem mãos dadas, fio ou placa do outro) nenhuma fase chega ao fim. A busca sobre a
  simulação real (`test/fases/busca.ts`) confere que um jogador sozinho, saindo do início, não passa da primeira ajuda
  (`SOLO_ATE` em `test/fases/alcance_teste.ts`).
- **Toda estrelinha alcançável com folga** (`test/fases_alcance*.test.ts`): a mesma busca pega cada estrelinha, cada
  lanterna, cada placa e o pedaço em pelo menos 15 combinações de lugar e gesto (não um salto exato). As que só saem
  de mãos dadas ficam numa lista aprovada (cap. 1 #22–24, cap. 2 #18–20) e precisam de `marcas: [{ tipo: 'maos-dadas'
  }]` a até 6 m. Nenhuma estrelinha fica acima da tela com a dupla em pé logo abaixo (câmera de 2026-11-24).
- **Mapa de apoio em dia** (T14, `test/apoio.test.ts`): mudou a fase, o campo `apoio`, a física ou a colisão? Rode
  `npm run apoio` (grava `apoio/capN.json`, o mapa que o companheiro usa) e revise os pontos de cooperação que ele
  imprime: cada um precisa de uma anotação no campo `apoio` da fase (id, dica, dica do inverso).
- **Bateria lenta** (`npm run test:lento`, ≈ 20 min): busca completa com folga ≥ 100 em toda estrelinha, janela de
  decolagem ≥ 0,4 m (≥ 0,9 m com o coyote) e visibilidade com a câmera do render. Rode antes de entregar mudança de
  física ou de fase.
- **Trechos separados de propósito** (`separados`, cap. 6): ali a regra de afastamento (12/24 m) não freia ninguém.
- **Estrelinha de pulo especial (gelatina, argola)**: ponha sobre a trajetória simulada, não por `arco()`: o arco por
  fórmula do cap. 5 passava 1–3 m longe do corpo (ver `docs/revisao/AUDITORIA_MOVIMENTO.md` §2.3).

## Medidas úteis (da física do núcleo, medidas tick a tick; `test/sim.test.ts` trava estes números)
Pulo normal 1,75 m de altura (pés), 0,70 s no ar e 3,64 m de distância correndo; um toque rápido sobe 1,38 m (pulo
mínimo); de mãos dadas 4,40 m e 5,63 m correndo (o de cima puxa até 3,6 m); gelatina 3,63 m acima do topo dela
(segurando, 5,25 m); pisão 1,27 m (segurando, 2,7 m). Coyote time 0,10 s (o pulo sai até 6 ticks depois da quina,
≈ 0,5 m a mais de vão) e jump buffer 0,12 s. No ar, contra a parede, o corpo sobe para um topo até 0,20 m acima dos
pés: um degrau colado de até 1,90 m sobe com o pulo cheio. **Um vão que só o fio deve vencer precisa de ≥ 6,2 m com
3 m de queda** (5,6 m passava sozinho com o coyote). Porta 3,2 m fecha a 1,5/s (placa a até 1,5 m da porta deixa
passar sozinho). No ar, o joystick leva a velocidade a 5,2 m/s: soltar o fio/argola mais rápido que isso não leva
mais longe.
