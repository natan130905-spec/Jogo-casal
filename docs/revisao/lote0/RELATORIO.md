# Lote 0: relatório do QA e da integração (2026-11-24)

O pedido do jogador foi "continue e corrija os erros". Quatro agentes trabalharam ao mesmo tempo (fisica-fases,
arte-luz, camera-hud e rede-arena). O QA conferiu o trabalho, integrou, corrigiu o que apareceu e mediu antes e
depois.

- **Antes:** `f362fe6`. **Depois:** `main` com os 4 agentes (`e9cd8ae`) e as correções do QA (`1ad5dfc`, `4cab0bf`,
  `2bd4b8b`, `5a923d4`).
- **Folha principal:** [`COMPARACAO.webp`](COMPARACAO.webp). Média, iPhone 14 (844×390 a 3×), ponto 12 % da partida
  dos bots, com antes | depois | alvo e um capítulo por linha.
- **Folhas completas:** `qa/<qualidade>_<tela>_<ponto>.webp`, 3 qualidades × 2 telas × 2 pontos, todas com
  antes | depois | alvo.
  - Telas: 844×390@3 (iPhone 14 em paisagem; o Redmi Note 11 tem os mesmos 844×390 CSS a 2×) e 915×412@2 (Pixel 7 /
    Android grande).
- **Ferramentas:**
  - `tools/revisao/capturas.mjs` (as capturas) e `tools/revisao/qa/folha_comparacao.py` (as folhas).
  - Imagens brutas e `medidas.json` ficam em `test-out/revisao/capturas/qa_antes` e `qa_final`, fora do git.

## 1. Como foi medido (o mesmo enquadramento)

- O Lote 0 mudou a física e as fases. Por isso o "antes" é o `f362fe6` com `src/core` e `test/fases` do depois
  (REGISTRO R64/R70). Assim as entradas gravadas dos bots levam os dois jogadores às mesmas posições nas duas cópias.
- Em 83 das 84 capturas as posições são idênticas; a que difere, difere em 0,02 m. O tick da foto varia até 29, mas
  só com os jogadores parados no fim do roteiro. A câmera e a arte são as de cada commit.
- O relógio da página é falso, a resolução dinâmica fica desligada e o navegador não tem GPU (SwiftShader). A imagem
  vale; o fps não vale.
- As imagens foram todas olhadas: 84 antes e 84 depois, mais as 12 refeitas depois das correções. O que se viu está
  nas seções 3 e 4.

## 2. Testes (todos no HEAD final)

| Verificação | Resultado |
|---|---|
| `npx tsc -p .` | limpo |
| `npx vitest run` | 11 arquivos, **186/186** (eram 183; +2 de R65 e +1 de R66) |
| `npx vite build` | ok (index 990 kB, 278 kB gzip) |
| `node test/e2e/dupla.mjs` | APROVADO (ver R67) |
| `node test/e2e/capitulos.mjs treino` | APROVADO (7 capítulos + arena, média dentro do orçamento) |
| `node test/e2e/capitulos.mjs dupla` | APROVADO na rodada final (desvio máx 0,21 m); intermitente em rodadas anteriores (R68, já existia no `f362fe6`) |
| `node test/e2e/arena.mjs treino` / `dupla` | APROVADO / APROVADO (a dupla precisou de 2 tentativas: na 1ª o mapa não abriu em 30 s ao montar a sala) |

O resultado de cada rodada final fica na seção 6.

## 3. Critérios de aceite de cada agente, com números

### fisica-fases (núcleo e fases)

Velocidade, gravidade, pulo cheio (1,75 m) e superpulo (4,40 m) continuam iguais.

| Critério | Medida | Passa? |
|---|---|---|
| Coyote 6 ticks, buffer 7, pulo mínimo 8 | `sim.test.ts` | sim; 5 testes falham no código antigo |
| Toque de 1 tick sobe ≥ 1,3 m | 0,725 → 1,385 m | sim |
| Degrau colado | 1,74 → 1,90 m | sim |
| Pisão solto | 0,475 → 1,275 m | sim |
| Todo coletável alcançável, folga ≥ 15 | `fases_alcance*.test.ts` | sim |
| Nenhuma estrelinha acima da tela | `alcance_teste.ts` e `camera.test.ts` | sim |
| Sozinho não passa do fio (abismos de 6,2 m) | `SOLO_ATE` | sim |
| Bots vencem os 7 capítulos | e2e `capitulos treino` | sim |

**Não feito:** o ícone das marcas de mãos dadas (cap. 1 e cap. 2) não é desenhado. Os dados existem, mas o render
não os lê.

### arte-luz (render)

O "antes" é o `f362fe6`; o "depois" é o final, com a correção R65. São 84 capturas de cada lado.

| Critério do PLANO L0 | Antes | Depois | Passa? |
|---|---|---|---|
| Alta × média \|ΔL\*\| ≤ 3 | 10/28 (máx 10,7) | **26/28** (máx 4,3) | quase; falha o cap. 7 p05 nas 2 telas |
| Alta × média Δsat ≥ −0,03 | 6/28 (mín −0,161) | **24/28** (mín −0,086) | quase; falham o cap. 7 p05 e o cap. 4 p012 (−0,030, no limite) |
| % quase branco ≤ 4 | 26/84 (máx 26) | **77/84** (máx 6,0) | quase; falham caps. 1, 3 e 5 em alguns pontos |
| L\* na faixa do capítulo (±6) | 32/84 | **69/84** | 6 de 7 capítulos pela mediana |
| % sombra na faixa do capítulo | 16/84 | 31/84 | **não**: 4 de 7 pela mediana, o aceite pede 5 |
| Grama igual nas 3 qualidades, borda ≤ 0,25 m, AO | `render_cenario.test.ts` | 8/8 | sim |
| Chamadas e triângulos da média ≤ antes + 2 | Δ −9…+1 chamadas; Δ −21…+1 mil triângulos | máx 33 / 185 mil | sim |

Mediana por capítulo (antes → depois), com o alvo entre parênteses:

| cap | L\* | % sombra | % branco | saturação | contraste |
|---|---|---|---|---|---|
| 1 | 61,9 → **47,0** (46) | 11,2 → **24,0** (18–28) | 16,3 → 2,5 | 0,54 → 0,72 | 23,7 → 21,4 |
| 2 | 41,2 → 39,7 (41) | 34,6 → 33,4 (30–45) | 0,9 → 0,2 | 0,64 → 0,67 | 18,9 → 17,7 ✗ |
| 3 | 52,5 → **46,0** (42) | 9,9 → 21,5 (28–40) ✗ | 6,3 → 2,6 | 0,68 → 0,84 ✗ | 18,7 → 18,4 ✗ |
| 4 | 52,2 → 48,9 (48) | 19,2 → 22,6 (18–28) | 6,1 → 2,2 | 0,65 → 0,71 | 22,6 → 22,2 |
| 5 | 62,4 → **49,4** (53) | 9,4 → **17,7** (14–24) | 14,8 → 3,4 | 0,44 → 0,63 | 23,0 → 20,4 |
| 6 | 50,7 → **33,2** (31) | 28,0 → 48,0 (50–65) ✗ | 7,9 → 0,2 | 0,50 → 0,68 | 27,0 → 19,8 ✗ |
| 7 | 34,9 → 32,2 (31) | 53,8 → 59,2 (55–68) | 2,9 → 1,7 | 0,62 → 0,65 | 27,5 → 25,4 |

O véu branco da alta (R01) acabou. A alta ainda fica 4,3 L\* acima da média no cap. 7 p05: os raios de luz e o anel
claro do planeta só existem na alta. A composição é a mesma; a diferença é a luz extra.

### camera-hud (câmera por jogador e indicador do parceiro)

| Critério | Medida | Passa? |
|---|---|---|
| Personagem entre 21 % e 25 % nos quadros normais; nunca < 15 % | `camera.test.ts` (projeção sobre as partidas dos bots, 7 capítulos, 2 telas, câmera do Natan e da Bruna) | sim |
| Pulo no plano não mexe y nem zoom | `camera.test.ts` | sim |
| Chamadas e triângulos ≤ antes | capturas: −10…+1 chamadas (média) | sim |
| Indicador aparece no mesmo quadro e fica ≥ 12 px dos botões | camera-hud: 0 divergências em 720 quadros; 12,5–13,3 px | sim (medida do agente; o QA não refez) |
| **Os dois no quadro até 8 m** | o QA achou o cap. 6 com o parceiro 4,6 m abaixo (p012) e 5 m acima (p05) **fora do quadro** | **não** → corrigido (R66) |

Visual: os personagens ficaram maiores em todas as capturas (ver `COMPARACAO.webp`). O camera-hud mediu ~70 px → 90
px no Redmi.

### rede-arena (predição do convidado e arena)

| Critério | Medida | Passa? |
|---|---|---|
| Convidado vê o próprio pulo em ≤ 1 quadro | `dupla.mjs`: 1 quadro (antes ≈ 220 ms) | sim |
| Toque curto do convidado vira pulo | 3/3 no `dupla.mjs` (antes 0/5) | sim |
| Reconciliação sem salto | maior erro 0,001 m, 0 saltos | sim |
| `predicao.test.ts` com rede de 0/83/150 ms | passa; falha com a predição desligada | sim |
| Arena: personagem maior na fase 3, clarões sem lavar a tela | do agente: 0,108 → 0,208 da altura da tela; pico de luminância 163 → 143 | sim (medida do agente) |
| e2e da arena (treino e dupla) | APROVADO | sim |

**Não feito:** a predição na Arena 3D. Lá o personagem continua 100 ms no passado.

## 4. O que o QA achou e corrigiu

| id | Problema | Correção | Teste |
|---|---|---|---|
| R65 | Quadrado claro em volta de faíscas e vaga-lumes na **alta** (o alfa 1 do quadrado inteiro marcava o brilho seletivo). Bem visível no cap. 3, sobre o mostrador | `particulas.ts`, `efeitos.ts`: o alfa soma só a forma da textura; a cor não muda (`4cab0bf`) | `test/render_brilho.test.ts`, que falha no código antigo. Imagem: `qa/r65_quadrado_antes_depois.webp` |
| R66 | A câmera nova deixava o parceiro fora do quadro com 4–5 m de desnível (cap. 6, dois corredores a 5 m) | `camera.ts`: o y desliza até a faixa em que os dois cabem; o desnível enquadrado vai de 4,5 para 5,2 m (`2bd4b8b`, `5a923d4`) | `camera.test.ts` › R66 (6 casos × 2 telas), que falha no código antigo. Imagem: `qa/r66_cap6_antes_depois_corrigido.webp` |
| R67 | `dupla.mjs` reprovava "P2 andou" com o anfitrião a 3 fps (tempo real × tempo de jogo) | a medida passa a usar ticks de jogo (`1ad5dfc`) | o próprio e2e |

Desempenho sem GPU: o mesmo treino (cap. 1, média, Pixel 7) gasta ~10 % mais por quadro no SwiftShader. Foram 8,1–8,5
fps e 122–128 ms de tarefa no `f362fe6`, contra 7,5–7,6 fps e 137–140 ms no Lote 0. O script por quadro é igual (1,7
ms contra 1,8 ms). O custo extra é de pixel: toon em todas as qualidades, AO e névoa. Isso **não** mede o celular. Fica
para medir no Redmi e no iPhone.

## 5. O que não passou ou ficou de fora (sem esconder)

- **`capitulos.mjs dupla`, "convidado em sincronia" (R68):**
  - Às vezes um capítulo marca **1,30 m** (o limite é 0,75 m): o cap. 5 numa rodada, o cap. 6 noutra.
  - O `f362fe6`, sem o Lote 0, deu o mesmo 1,30 m no cap. 6 na mesma máquina, então o problema já existia.
  - Uma rodada instrumentada dos caps. 1–6 no HEAD deu 0,02–0,09 m em todos.
  - Causa provável: a medida não conhece o intervalo de ticks que o convidado está interpolando. Precisa de um gancho
    em `partida.ts` (L1a/L3b).
- **Conexão perdida (R69):** caiu uma vez, com a máquina sobrecarregada (prazo de silêncio de 7 s). A regra agora é
  rodar os e2e de dupla sozinhos.
- **Arte:**
  - % sombra na faixa em 4 de 7 capítulos (o aceite pede 5): caps. 3 e 6 ficam abaixo, e o cap. 2 entra pela mediana
    mas não em todos os pontos.
  - Contraste baixo nos caps. 2, 3 e 6.
  - Saturação alta demais no cap. 3 (0,84 > 0,75).
  - Alta × média no cap. 7 p05 (+4,3 L\*).
  - O chão continua o mesmo bloco em todos os capítulos (R06), e a distância para os alvos é de forma e composição
    (primeiro plano, marcos). Isso fica para os próximos lotes.
- **Não desenhado:** a marca de mãos dadas (`Fase.marcas`).
- **Rede:**
  - `Estado.toleranciaRede` ainda não é preenchida pelo anfitrião.
  - Falta a predição na arena.
  - Falta o buffer na argola e no fio.
- **Ferramentas com a câmera antiga:** `test/fases/alcance_teste.ts` (`topoDaTela`), `auditoria-movimento/visibilidade.ts`
  e `playtester/projecao.mjs`. A visibilidade com a câmera nova está coberta por `camera.test.ts`.
- **Quina da cabeça:** continua em 0,32 m. Com 0,20 m, o cap. 3 trava em x 164,7.
- **Celulares reais:** nada foi medido num celular. Faltam fps, calor, brilho sem alvo float, e a dupla com perda de
  pacotes.

## 6. Rodadas finais dos e2e (HEAD com as correções)

Veja a tabela do §2. Os registros ficam fora do git, no scratchpad do QA. Resumo:
Todas foram rodadas em sequência, sozinhas na máquina, com o build do HEAD que tem as correções do QA.

- **vitest:** 186/186.
- **`dupla.mjs`:** APROVADO.
  - Anfitrião a 6 fps.
  - Sincronia no capítulo: 0,09 m.
  - O convidado vê o próprio pulo em 1 quadro.
  - Toque curto: 3/3.
- **`capitulos.mjs treino`:** APROVADO.
- **`capitulos.mjs dupla`:** APROVADO.
  - Sincronia, caps. 1 a 7: 0,21 / 0,15 / 0,07 / 0,01 / 0,09 / 0,07 / 0,07 m.
  - Média dentro do orçamento (≤ 80 chamadas e ≤ 250 mil triângulos).
- **`arena.mjs treino`:** APROVADO.
- **`arena.mjs dupla`:**
  - 1ª tentativa: o mapa não abriu em 30 s ao montar a sala.
  - 2ª tentativa: APROVADO.

Rodadas anteriores (com a máquina carregada ou antes das correções):

- `dupla.mjs` reprovou 2 vezes pelo R67, que foi corrigido no teste.
- `capitulos.mjs dupla` deu 1,30 m no cap. 5 e no cap. 6 em rodadas diferentes (R68), e caiu a conexão uma vez
  (R69).
