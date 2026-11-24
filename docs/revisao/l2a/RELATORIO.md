# Lote L2a: colisão, manobras, mapa de apoio e afastamento

Data: 2026-11-24. Base: `aaa8469`. Commits: `ac61f15` (R20), `91956ad` (manobras), `7703f7c` (R59, apoio),
`2ca2ab5` (afastamento), `35a1593` (test:lento). O núcleo usado para os planos dos bots é o do HEAD do lote.

## Critérios de aceite (PLANO §L2a), medidos

| # | Critério | Medida | Resultado |
|---|---|---|---|
| 1 | T15: nenhum passo move o corpo mais que \|vx·dt\| + 0,35 m nos 7 planos; `teleporte_cap6.ts` sem TELEPORTE | maior excesso nos 7 planos: 0,20 m (cap. 3, deslize da quina da cabeça); `teleporte_cap6.ts`: 12 casos, nenhum TELEPORTE (antes 5 de 12 iam de 29,5 a 66,1); `test/colisao.test.ts`: 3 de 4 casos reprovam com o código antigo | passou |
| 2 | Os 7 planos fecham igual (mesmo tick ±0) com as manobras de `src/core` | ticks 4008, 4201, 7356, 5589, 4394, 3227, 5343 e hash do rastro de posições iguais antes e depois (`tools/revisao/l2a/rodar.sh planos_ticks`); travados em `TICK_PLANO` | passou |
| 3 | T14: hash em dia; PontoCoop × ligações de ajuda do caminho mínimo | `test/apoio.test.ts`: json idêntico ao gerado hoje nos 7; 4–8 pontos por capítulo (7, 8, 4, 4, 4, 6, 4), cada um com inverso e anotação à mão; controle reprova fase mudada, papel fora do nó e ponto apagado | passou |
| 4 | Cap. 6 volta às 4 portas espelhadas | caminho mínimo: porta-baixo-1, porta-cima-1, porta-cima-2, porta-baixo-2 + muro (impulso/puxar); nenhuma ligação da sala de entrada (x ≤ 31,5) para além de x 44 | passou |
| 5 | Afastamento: > 24 m para longe a 60 %; zona de fio e "separados" sem mudança | `test/afastamento.test.ts`: 3,12 m/s para longe, 5,2 para perto e de 12 a 24 m; zona do fio e corredores do cap. 6: 5,2; desligado por padrão; com a regra ligada, os 7 planos fecham | passou |
| 6 | `npm test` verde, com `SOLO_ATE`, cooperativa e sem armadilha | 17 arquivos, 227 testes | passou |
| — | `npm run test:lento` | 7 arquivos, 21 testes, 15 min 20 s; menor folga da busca completa 121 (cap. 5 #7); cap. 3 sem bater no limite (33 477 / 41 218 estados) | passou (1 exceção nomeada, R71) |

## O que mudou

- `src/core/colisao.ts`: saída pelo lado de menor penetração; deslize da quina só para lugar livre. Afeta também os
  bichinhos (no cap. 7 os bots pegam 39 estrelinhas em vez de 38).
- `src/core/companheiro/manobras.ts`: as primitivas dos bots; `test/fases/bot.ts` reexporta e fica com etapas e diretor.
- `src/core/companheiro/apoio.ts` (tipos, `hashFase`, `lerMapa`), `src/core/fases/apoio/capN.json` e `index.ts`
  (`carregarApoio`), `test/fases/apoio.ts` (Dijkstra, montagem, conferência), `tools/gerar_apoio.ts` (`npm run apoio`).
  Campo `apoio` nos 7 capítulos. Acréscimo ao ARQUITETURA §6.2: `tipo` é sempre o papel do companheiro, e os inversos
  usam `passar`, `superpulo`, `serPuxado` e `fioPendurado`; cada ponto guarda `de`, `para` e o nó do papel.
- `src/core/sim.ts` (um bloco): `AFASTAMENTO`, `situacaoAfastamento()` (para câmera e indicador) e o fator na velocidade
  de andar; `Estado.afastamento` e `Fase.separados` em `types.ts`; cap. 6 com `separados` nos dois trechos espelhados.
- `npm run test:lento` (`vitest.lento.config.ts`, `test/lento/`), `test/fases/busca.ts` com `completa`,
  `test/fases/janela.ts` (coyote do núcleo, sem emulação).

## Limites

- A busca e a janela são de um jogador com o parceiro parado; o fio não entra na busca real (ver AUDITORIA §2.1).
- A visibilidade do `test:lento` usa a câmera de `src/render/camera.ts` de hoje: quando o L3a mudar a câmera, ela roda
  de novo sozinha.
- O companheiro ainda não existe (L6): o mapa de apoio foi conferido contra o grafo, não usado por um controlador.
