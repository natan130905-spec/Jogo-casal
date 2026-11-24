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
- **Cooperativa**: sozinho (sem mãos dadas, fio ou placa do outro) nenhuma fase chega ao fim.

## Medidas úteis (da física do núcleo)
Pulo normal ≈ 1,8 m de altura e ≈ 3,6 m de distância; mãos dadas ≈ 4,5 m (o de cima puxa até 3,6 m); gelatina 3,75 m
(segurando, 5,4 m); porta 3,2 m fecha a 1,5/s (placa a até 1,5 m da porta deixa passar sozinho). No ar, o joystick
leva a velocidade a 5,2 m/s: soltar o fio/argola mais rápido que isso não leva mais longe.
