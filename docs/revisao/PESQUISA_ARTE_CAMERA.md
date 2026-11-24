# Pesquisa de arte e câmera — Entre Dois Mundos

> Autor: equipe "pesquisa-arte-camera" · 2026-11-24 · etapa de diagnóstico e design (nada foi alterado em `src/`,
> `index.html`, `public/` ou `test/`). O experimento rodou numa worktree própria (já apagada); o código dele está em
> `tools/revisao/pesquisa-arte-camera/experimento_camera.patch`.

## 0. Resumo (o que importa)
1. **"Esbranquiçado na alta" = o bloom.** Confirmado: desligando só o bloom, a alta volta a ter os escuros e a
   saturação da média (cap. 1: pixels escuros 0,3 % → 9,5 %, saturação 0,41 → 0,61, mediana de L* 0,70 → 0,46).
   Raios de sol e névoa em quadros quase não mudam a imagem (< 1 ponto). → Na alta: bloom a ¼ de resolução, força
   ≤ 0,3, limiar acima do céu, e só em materiais "mágicos" (seletivo).
2. **Personagens pequenos = câmera compartilhada.** Medido: 17,9 % da altura da tela juntos (61 px no iPhone 14,
   70 px no Redmi, em px CSS), **10,5 % a 8 m** um do outro e **6,4 % a 20 m** (22–25 px). A arte conceitual tem ≈ 21 %.
3. **Proposta de câmera: uma por celular**, seguindo o próprio personagem: **23 % da altura** (78 px / 90 px), FOV 35°,
   distância 7,6 m, olho a 1,7 m acima dos pés sem inclinar (pés a 30 % da tela por deslocamento de lente), zona morta
   ±0,35 m, foco à frente 1,0–1,8 m, encaixe na plataforma, enquadra os dois até 8 m (afastando até 15 %), **indicador do
   parceiro na borda** além disso, e regras de afastamento pelo Fio Vermelho (livre até 12 m, aviso 12–24 m, puxão > 24 m,
   "Ir até"). Experimento: personagens a 23 % em todas as cenas (antes 6,4–17,9 %), com **o mesmo ou menos**
   chamadas e triângulos (ex.: 24 → 20 chamadas no início do cap. 2).
4. **"Blocos com enfeites"** vem em boa parte do **ângulo**: a câmera atual fica ~2,5 m acima e olha ~9° para baixo,
   então se vê o tampo das plataformas (um "tabuleiro"). Câmera mais baixa mostra a face dos barrancos e o chão como
   faixa, como na arte. Mas câmera baixa demais (olho a 1,0 m) **esconde os personagens atrás da grama da borda** — o
   cenário precisa de regra para a borda da frente.
5. **Hierarquia de valor** (o que falta para parecer desenho): primeiro plano escuro, personagens claros com borda de
   luz, fundo dessaturado com névoa colorida só atrás. A arte conceitual tem **mais faixa de valor** (p5–p95 de L* =
   0,725) e **menos saturação** (0,50) que o jogo na média (0,59–0,70 e 0,63–0,76): o jogo está saturado demais nos
   meios-tons verdes/rosa e com pouco escuro e pouco claro. Saturar menos e contrastar mais.

## 1. Método
- Li `README.md`, `docs/HISTORIA.md`, `DESIGN.md`, `NUCLEO.md`, `ARENA_FINAL.md`, `src/core/fases/LEIAME.md`,
  `docs/arte/RECURSOS.md`, `src/render/cena.ts`, `pos.ts`, `materiais.ts`, `ceu.ts`, `tema.ts` e partes de `cenario.ts`;
  olhei `docs/arte/conceito.png` (recorte do quadro de jogo: `img/pesquisa-arte-camera/conceito_quadro_jogo.webp`).
- Pesquisa na web (seção 9). Atenção: **gamedeveloper.com e github.io estavam bloqueados** nesta sessão; usei os
  resumos das buscas e conhecimento público. Nenhum número interno de estúdio é citado como fato.
- Worktree em `HEAD` (612fe86) com um experimento em `src/render/cena.ts` e `test/vitrine/vitrine.ts` ativado por
  parâmetros de URL (sem mudar o padrão): `?cam=nova&v=2&olho=1.7&alt=0.23&frente` (câmera proposta, primeiro plano),
  `?bloom=0`, `?luz=0`, `?nevoa=0` (desligar peças da alta), `?tom=agx|aces&exp=` (tone mapping).
- Capturas com a vitrine (`test/vitrine/`) e Playwright sem GPU, `?resfixa`, qualidade média, em **iPhone 14
  paisagem (750×340 CSS)** e **Redmi Note 11 paisagem em tela cheia (873×393 CSS)**, escala 1. Tamanho do personagem
  medido **projetando** os pés (y) e a cabeça (y + 1,1 m, a altura da colisão em `sim.ts:22`) com a câmera do jogo.
  Script: `tools/revisao/pesquisa-arte-camera/capturar_camera.mjs`; estatísticas de imagem: `estatisticas_imagem.py`
  (L* aproximado, contraste, percentis, saturação HSV); montagens: `montar_comparacoes.py`.
- **Não vale como medida**: fps (sem GPU). Vale: chamadas, triângulos, tamanho em px, estatística de pixels.

## 2. Como os jogos de referência constroem a imagem

> Fonte do que segue: buscas na web em 2026-11-24 (lista na seção 9) e o conhecimento público sobre esses jogos.
> Vários sites técnicos (gamedeveloper.com, github.io) **não abriram nesta sessão** (rede bloqueada), então nenhum
> número interno dos estúdios é citado. Onde digo "padrão observável", é leitura de capturas públicas e não
> documentação oficial. O que vale como regra para o nosso jogo está marcado com **→ regra**.

| Jogo | O que faz na imagem | O que copiar (no celular) |
|---|---|---|
| **Trine 4** (Frozenbyte, 2019) | Voltou do 3D para o 2.5D lateral ("é onde Trine pertence"). Fundo pintado muito detalhado com **luz quente pontual** (raio de sol, lanterna) e muita partícula. A equipe disse que o difícil foi **manter legíveis as coisas de jogo** no meio do detalhe. | Detalhe e brilho ficam **no fundo e nas bordas**; o caminho jogável tem valor e cor próprios. Luz quente só em pontos (lanterna, janela), não um véu sobre tudo. |
| **Rayman Legends** (UbiArt) | Arte 2D pintada à mão recortada em peças; **luz dinâmica que clareia ou deixa em silhueta** os personagens; primeiro plano em silhueta escura; fundo claro e dessaturado. Coop: quem fica para trás vira **bolha** e volta encostando no parceiro (igual a New Super Mario Bros.). | Primeiro plano escuro (silhueta) emoldurando a tela; personagem sempre mais saturado que o fundo; a bolha já existe aqui. |
| **Unravel Two** (Coldwood) | "Mostrar a beleza do comum visto bem de perto": câmera **baixa e próxima**, escala de macro, profundidade de campo rasa, luz natural. | Câmera na altura do personagem (não de cima), objetos do primeiro plano grandes e desfocados/escuros; profundidade por **escala e valor**, não por névoa branca. |
| **It Takes Two** (Hazelight) | Alterna tela dividida e tela única por trecho; na tela dividida "você sempre vê o outro personagem"; tudo é desenhado duas vezes (custo alto) e mesmo assim mira 60 fps. | Aqui cada um tem o **próprio celular** — é a "tela dividida de graça": cada câmera segue o seu personagem. Mas é preciso o equivalente a "sempre ver o outro": **indicador na borda** e enquadrar os dois quando estão perto. |
| **Ori** (Moon Studios) | Aspecto pintado em camadas com profundidade "que não parece achatado"; cada recurso foi **iluminado à mão**; primeiro plano em silhueta, fundo com névoa colorida, o personagem é a coisa mais clara/rim light. | Luz "pintada" (cor por vértice, AO assado) em vez de luz física; contraste de valor **personagem claro × primeiro plano escuro × fundo médio colorido**. |
| **Kirby e a Terra Esquecida** (HAL) | Câmera **fixa por área, dirigida pelo design de fase**, porque iniciante sofre com câmera livre; "aterrissagem difusa" (pulo aceito pouco antes de tocar o chão); acerto calculado pelo que **parece** acertar na câmera. | Câmera com **dicas por trecho** (zonas na fase que mudam zoom/enquadramento); jump buffer; hit-box generosa vista da câmera. |
| **LittleBigPlanet** | 3 planos jogáveis em profundidade (16 no LBP3) e planos extras só decorativos na frente e atrás. | Plano de jogo único (z≈0) + planos decorativos fixos: primeiro plano (z>0), meio (z<0), fundo pintado. |
| **Yoshi's Crafted World** | Diorama de papelão visto de lado, com frente/trás do cenário; materiais "de artesanato" com textura forte e luz suave. | Identidade por capítulo pelo **material** (papelão, tecido, doce) e não só pela cor. |

Câmeras de plataforma (palestra "Scroll Back", Itay Keren, GDC 2015 — índice confirmado: rolagem, atenção e conforto,
seguir a ação, conter o movimento, encaixe, suavização, enquadramento):
- **janela de câmera / zona morta**: o personagem anda dentro de uma caixa sem a câmera mexer;
- **encaixe na plataforma** (platform snapping): o eixo vertical só muda quando o personagem **pousa**; o pulo não
  balança a câmera;
- **foco à frente** (look-ahead / dual forward focus): mais tela na direção em que se anda;
- **foco por dica** (cue focus): a fase marca pontos de interesse que puxam a câmera;
- **suavização** (lerp ou mola) e **zoom para caber** (zoom-to-fit) os vários jogadores, com limite.

**→ regras para Entre Dois Mundos:**
1. **Hierarquia de valor** (o mais importante): personagens e coletáveis = mais claros/saturados com borda de luz;
   caminho jogável = valor médio, saturação média; fundo = valor médio-claro, **dessaturado e frio** (lilás/azul),
   sem preto; primeiro plano = **escuro** (L* 10–25 %), quase silhueta.
2. **Névoa colorida só atrás** do plano de jogo (z < −3). Nada transparente e claro entre a câmera e os personagens.
3. **Luz quente localizada** (lanterna, janela, raio pontual atrás da cena) — nunca um véu aditivo que cobre a tela.
4. **Câmera baixa e lateral**, quase na altura dos olhos dos personagens: o chão aparece como faixa de grama sobre um
   barranco visto de frente (como na arte conceitual), e não como um tampo visto de cima ("blocos com enfeites").

## 3. Diagnóstico medido

### 3.1 Câmera atual (`src/render/cena.ts:294–302`)
```ts
const sep = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.6);
const dist = Math.min(22, Math.max(7.6, 6 + sep * 0.9));
this.alvoCam.set(mx, my + 2.0 + dist * 0.06, dist);
this.camera.position.lerp(this.alvoCam, Math.min(1, dt * 4));
this.camera.lookAt(this.camera.position.x, this.camera.position.y - 0.9 - dist * 0.04, 0);
```
FOV 42° (`cena.ts:28`). Uma câmera para os dois, no meio deles; afasta linearmente com a separação; segue também o
arco do pulo (y = meio dos dois); sem zona morta, sem foco à frente; suavização dependente do fps.

| Cena (cap. 2 salvo indicação) | iPhone 14: altura do personagem | Redmi 11: altura | Chamadas / triângulos (iPhone) |
|---|---|---|---|
| juntos, início | 61 px = 17,9 % | 70 px = 17,9 % | 24 / 163 mil |
| juntos, clareira | 61 px = 17,9 % | 70 px = 17,9 % | 29 / 168 mil |
| **8 m de distância** | **36 px = 10,5 %** | 41 px = 10,5 % | 38 / 218 mil |
| **20 m de distância** | **22 px = 6,4 %** | 25 px = 6,4 % | 40 / 209 mil |
| cap. 1, juntos | 61 px = 17,9 % | 70 px = 17,9 % | 23 / 39 mil |
| cap. 5, juntos | 61 px = 17,9 % | 70 px = 17,9 % | 26 / 59 mil |

Arte conceitual: personagem ≈ 125 px num quadro de 586 px ≈ **21 %**. Num celular de 6,1" deitado, 22 px é ~3 mm:
não se lê rosto nem pose. Como cada um joga no seu aparelho, não há motivo para os dois caberem sempre na tela.

### 3.2 Valor e cor (alta × média × arte)
Estatística de pixels (`estatisticas_imagem.py`; L* de 0 a 1). Capturas iPhone 14, qualidade **alta**, mesmo quadro,
desligando uma peça de cada vez (experimento com `?bloom=0`, `?luz=0`, `?nevoa=0`):

| Quadro | Variante | mediana L* | escuros (L* < 0,25) | claros (L* > 0,85) | faixa p5–p95 | saturação |
|---|---|---|---|---|---|---|
| cap. 1 | média | 0,44 | 4,9 % | 17,2 % | 0,70 | 0,63 |
| cap. 1 | **alta (atual)** | **0,70** | **0,3 %** | 21,8 % | **0,55** | **0,41** |
| cap. 1 | alta sem bloom | 0,46 | 9,5 % | 15,5 % | 0,71 | 0,61 |
| cap. 1 | alta sem raios/halos aditivos | 0,69 | 0,4 % | 21,6 % | 0,56 | 0,41 |
| cap. 1 | alta sem névoa em quadros | 0,70 | 0,2 % | 22,9 % | 0,54 | 0,41 |
| cap. 2 clareira | média | 0,32 | 33 % | 1,3 % | 0,59 | 0,76 |
| cap. 2 clareira | **alta (atual)** | **0,45** | **12,8 %** | 2,6 % | 0,62 | **0,58** |
| cap. 2 clareira | alta sem bloom | 0,32 | 35,7 % | 1,1 % | 0,64 | 0,74 |
| cap. 5 doces | média | 0,59 | 3,2 % | 18 % | 0,73 | 0,50 |
| cap. 5 doces | **alta (atual)** (bloom "claro" 0,2) | 0,65 | 3,2 % | 17,4 % | 0,64 | **0,41** |
| cap. 5 doces | alta sem bloom | 0,58 | 9,7 % | 17,2 % | 0,78 | 0,51 |
| **arte conceitual** (quadro de jogo) | — | 0,40 | 20,8 % | 5,6 % | **0,725** | **0,50** |

Leitura: **o bloom é a causa confirmada** do véu branco (mediana sobe até +0,26, escuros somem, saturação cai até
−0,20). Na floresta (média), o problema é outro: **escuro demais e saturado demais** (33 % de pixels escuros e 0,76 de
saturação contra 21 % e 0,50 na arte) e **poucos claros** (1,3 % contra 5,6 %): falta luz de destaque (borda dos
personagens, topo da grama, céu) e sobra verde saturado. Imagens: `img/pesquisa-arte-camera/alta_c1_meio.webp`,
`alta_c2_clareira.webp`, `alta_c5_doces.webp` (em cima a alta atual; embaixo sem bloom/raios/névoa).

Observações de olho nas capturas (hipóteses, sem medida): o fundo é uma faixa lilás uniforme de silhuetas
recortadas (mesmo valor em toda a largura), o chão é um "tampo" visto de cima com tufos espalhados por igual, e não há
primeiro plano: por isso a cena lê como "blocos com enfeites" e não como ilustração em camadas.

## 4. Técnicas web/Three.js para esse visual, com custo no celular

**Os aparelhos.** iPhone 14: A15 com GPU de 5 núcleos (folga grande). **Redmi Note 11**: a versão global usa
**Snapdragon 680 / Adreno 610**; a GPU **Mali-G57 MC2** é do **Redmi Note 11S** (Helio G96) — confirmar qual é o
aparelho do jogador (Configurações › Sobre o telefone). Os dois são GPUs de entrada (Adreno 610 ≈ Mali-G57 MC2 em
ordem de grandeza) e o gargalo é **preenchimento de pixels e largura de banda**, não triângulos. Tela 2400×1080; com
`razaoPixel` 1,5 (média) o jogo desenha ~1310×590 ≈ **0,77 Mpx por passe de tela cheia** (CSS 873×393). Custos abaixo
são **estimativas relativas** (não medi no aparelho; esta máquina não tem GPU) — o critério é "passes de tela cheia",
"sobreposição de transparentes" e "chamadas de desenho".

| Técnica | Para quê | Como em Three.js r187 | Custo no Adreno 610 / Mali-G57 | Recomendação |
|---|---|---|---|---|
| **Toon ramp** (`MeshToonMaterial.gradientMap` ou rampa no `onBeforeCompile`) | sombras em 2–3 faixas, "desenho" | textura 1D 3–4 px, `NearestFilter`; ou `smoothstep` da luz difusa no shader do mundo | ≈ Lambert (barato) | **Usar no cenário também** (hoje só os personagens têm rampa: `personagem.ts:334`). Rampa **macia** (borda de 0,1) no cenário, dura nos personagens. Todas as qualidades. |
| **Contorno por casco invertido** | traço escuro de desenho | segunda malha com `side: BackSide`, vértices empurrados pela normal (já existe nos personagens) | +1 chamada e +N triângulos por objeto; nenhum passe de tela | **Personagens, bichinhos, coletáveis e bordas de plataforma** (média e alta). Na baixa: só personagens. |
| Contorno por pós-processo (Sobel em profundidade/normal) | traço em tudo | passe extra com textura de normais | 1–2 passes de tela cheia + alvo de normais: **caro** | **Não usar** no celular. |
| **Névoa por distância com gradiente de cor** | perspectiva atmosférica colorida (lilás/azul ao fundo) | `scene.fog` + `onBeforeCompile` trocando `fogColor` por `mix(corPerto, corLonge, fogFactor)` e por altura do céu | ~4 instruções por pixel | **Usar**; névoa **começa em z < −3** (atrás do plano de jogo), nunca na frente. |
| **Névoa por altura** (vale com bruma embaixo) | profundidade vertical, "abismo" | `exp(-max(y - h0, 0) * k)` no mesmo trecho do shader | idem | Usar nos abismos e no lago (substitui quadros de névoa transparentes). |
| **Céu pintado + cartões de parallax** | fundo de ilustração | 3–5 planos com textura pintada (WebP), `alphaTest` (sem transparência), cada um com cor já "enevoada" | 1 chamada; preenchimento ~1× tela | **Já existe** (`ceu.ts:63`, 3 camadas). Trocar a silhueta procedural por **pinturas por capítulo** (gerar com IA a partir da arte conceitual = créditos → pedir autorização) e escurecer/esfriar por camada. |
| **Texturas pintadas à mão / atlas** | sair do "liso de computador" | atlas 1024–2048 por capítulo, `KTX2`/Basis (memória de GPU 4–8× menor que PNG) | memória; amostragem barata | Atlas por capítulo com grama, casca, pedra, tecido/doce; **KTX2** com `KTX2Loader` (transcoder ~200 KB). |
| **Vento no vértice** | vegetação viva | já existe (`materiais.ts:36`, grama e flores instanciadas) | quase grátis no vértice | **Estender** às copas, cipós, cogumelos (balanço), bandeirinhas; amplitude por capítulo. |
| **Instancing / BatchedMesh** | muitas plantas, pedras, flores | `InstancedMesh` (já usado), `BatchedMesh` para variedade com 1 chamada | reduz chamadas | Usar para todos os adereços repetidos; alvo ≤ 60 chamadas na média. |
| **LOD** | detalhe perto, simples longe | `THREE.LOD` ou trocar por cartão (impostor) no fundo | menos triângulos | Fundo **sempre** em cartões; LOD só para árvores/casas do plano médio. |
| **Luz e AO assados no vértice** | sombra de contato, cantos escuros, "pintura" | calcular AO por vértice ao montar a fase (raios contra a própria geometria, uma vez) e gravar na cor | zero por quadro; ~50–200 ms ao carregar | **Usar em todas as qualidades** — dá o contraste que falta (pé de parede, sob plataforma, entre raízes). |
| **Sombra real** (shadow map 2048) | sombra dos personagens | já na alta | 1 passe de profundidade + 2048² = 16 MB | Manter só na alta, **mapa 1024** e caixa menor perto da câmera; nas outras, sombra-bolha (já existe). |
| **Tone mapping** | paleta de desenho | `renderer.toneMapping` (ou `OutputPass` com pós) | grátis | **Neutral** mantém a cor-base (bom para desenho), mas comprime os claros para o branco; **AgX** desatura de propósito (ruim aqui); **ACES** escurece e satura demais o vermelho/amarelo. → **Neutral, exposição 0,9–1,0, e cores-base menos saturadas** (a arte conceitual tem saturação média 0,50; o jogo tem 0,68–0,71). |
| **Bloom seletivo** | brilho só no que é mágico | limiar alto (≥ 1,0 em HDR) e só materiais `toneMapped:false` com cor > 1; ou "bloom falso" com halos aditivos (já existe) | UnrealBloom: ~5 níveis × 2 desfoques + composição ≈ **1,5–2 telas cheias** + ~9 MB de alvos | Alta: bloom **a ¼ da resolução**, força ≤ 0,3, limiar acima da cor do céu. Média/baixa: só halos. |
| **Profundidade de campo / desfoque do primeiro plano** | "macro" de Unravel | não usar DOF de pós; desfocar **na textura** do primeiro plano (pintura já borrada) | zero | Primeiro plano já pintado desfocado e escuro. |
| **Partículas ambientais** | mundo vivo | `Points`/instâncias com movimento no shader (já: vaga-lumes e `particulas.ts`, 2 chamadas) | sobreposição se grandes | Muitas e **pequenas** (≤ 8 px), nunca véus grandes; folhas, pólen, poeira de luz, gotas na cachoeira. |
| **Squash & stretch e animação secundária** | personagens de desenho | escala no grupo do personagem ao pular/pousar (1,15/0,85 por 80–120 ms), cabelo/lenço com mola | grátis (CPU) | Usar em personagens, bichinhos, plataformas que quicam. |

**Causa do "esbranquiçado na alta": o bloom (CONFIRMADO por medição, seção 3).** Desligando uma coisa de cada vez
na alta (mesmo quadro, mesmo aparelho), só o bloom muda a imagem de forma relevante: sem ele a alta volta a ter o valor e
a saturação da média. Os raios de sol/halos aditivos (`cenario.ts:479–481`) e a névoa em quadros (`cenario.ts:484–487`)
mudam menos de 1 ponto. O `UnrealBloomPass` (`pos.ts:16`: força 0,55, raio 0,65, limiar 0,82; nos temas claros
0,2/0,4/0,97) recebe a cena **em HDR linear antes do tone mapping**; o céu rosado, a névoa clara e as plataformas
iluminadas passam do limiar e o desfoque largo espalha um véu claro sobre tudo, levantando os pretos.

## 5. Experimento de câmera (worktree) — antes/depois

Implementado em `cena.ts` da worktree (`cameraNova`, ~60 linhas; patch em
`tools/revisao/pesquisa-arte-camera/experimento_camera.patch`) e indicador do parceiro em `vitrine.ts`. Parâmetros
usados nas capturas finais: `cam=nova&v=2&olho=1.7&alt=0.23&frente`, câmera do jogador 1 (Natan).

| Cena | Aparelho | Antes: altura | Depois: altura | Antes ch / tri | Depois ch / tri |
|---|---|---|---|---|---|
| cap. 2 início (juntos) | iPhone 14 | 61 px (17,9 %) | **78 px (23 %)** | 24 / 163 mil | 20 / 154 mil |
| cap. 2 início | Redmi 11 | 70 px | **90 px** | 25 / 164 mil | 21 / 155 mil |
| cap. 2 clareira | iPhone 14 | 61 px | 78 px | 29 / 168 mil | 24 / 164 mil |
| cap. 2, **8 m** (os dois no quadro) | iPhone 14 | 36 px (10,5 %) | **66 px (19,4 %)**, os dois na tela (x 17 % e 81 %) | 38 / 218 mil | 30 / 172 mil |
| cap. 2, **8 m** | Redmi 11 | 41 px | 77 px (19,6 %) | 31 / 206 mil | 31 / 192 mil |
| cap. 2, **20 m** (indicador "20 m" na borda) | iPhone 14 | 22 px (6,4 %) | **78 px (23 %)** | 40 / 209 mil | 35 / 203 mil |
| cap. 1 | iPhone 14 | 61 px | 78 px | 23 / 39 mil | 28 / 58 mil |
| cap. 5 | iPhone 14 | 61 px | 78 px | 26 / 59 mil | 26 / 64 mil |

(+5 chamadas no cap. 1 e +19 mil triângulos vêm do primeiro plano de teste e de adereços que entram no quadro; o
orçamento da média é ≤ 80 / 250 mil.)

Imagens (em cima antes, embaixo depois): `img/pesquisa-arte-camera/cam_<aparelho>_<cena>.webp`, por exemplo
`cam_iphone14_c2_sep20.webp` (antes: os dois minúsculos; depois: Natan grande e o indicador "20 m" da Bruna à direita),
`cam_redmi11_c2_sep8.webp` (depois: os dois no quadro, grandes) e `cam_iphone14_c2_inicio.webp`.

O que o experimento **mostrou de errado** (vale como aprendizado, não como defeito da proposta):
- `olho1_grama_tapa.webp`: com o olho a **1,0 m** a grama da borda da frente das plataformas cobre os personagens.
  Com 1,7 m não cobre. → regra de cenário (seção 6.4) ou olho ≥ 1,5 m.
- `cam_iphone14_c5_doces.webp`: o primeiro plano de teste (cones escuros) **passou na frente da Bruna**. Era um
  rascunho de 1 chamada; mostra por que a regra "nunca sobre a faixa de jogo" precisa ser verificada por teste
  (projetar o primeiro plano e checar a faixa pés−0,5 … pés+2,5 m).
- As fotos de 20 m da primeira rodada sumiam com o personagem: a captura deixava os dois invencíveis e o personagem
  **pisca** quando invencível (`personagem.ts:596`). Corrigido no script (congela e zera a invencibilidade antes da foto).

## 6. Proposta de câmera: uma câmera por celular

### 6.1 Princípio
Cada jogador tem o próprio celular, então **não precisamos de câmera compartilhada nem de tela dividida**: cada tela
segue **o seu personagem** (o "eu"), como uma tela dividida de It Takes Two em que cada metade é um aparelho. A câmera
compartilhada atual (meio dos dois, afastando até 22 m) é o que faz os personagens encolherem para 6 % da tela.
A "sensação de casal" vem de: (a) **enquadrar os dois juntos quando estão perto** (o normal na maior parte do tempo),
(b) **indicador do outro na borda** quando ele sai do quadro e (c) **regras de afastamento** do Fio Vermelho.

### 6.2 Números

| Parâmetro | Atual (`cena.ts:294–302`) | Proposto | Por quê |
|---|---|---|---|
| FOV vertical | 42° | **35°** (horizontal ≈ 69° em 2,2:1) | menos deformação nas bordas, mais "lente de desenho"; profundidade ainda visível |
| Altura do personagem (1,1 m) | **17,9 %** juntos (61 px iPhone / 70 px Redmi, em px CSS); **10,5 %** a 8 m; **6,4 %** a 20 m (medido) | **23 %** no normal (78 px / 90 px); faixa **15 %–30 %** | arte conceitual ≈ 21 % (≈ 125 px de 586 no quadro do jogo); celular é tela pequena, então um pouco maior |
| Área visível no normal | 5,8 × 12,9 m (juntos) | **4,8 × 10,5 m** | ~2 pulos (3,6 m) à frente com o foco à frente |
| Distância da câmera | 7,6–22 m (`6 + 0,9·separação`) | **7,6 m** normal; 5,8 m (30 %, carinho/diálogo); 11,6 m (15 %, trecho vertical, chefe, os dois no quadro) | V = 1,1 / altura%; dist = V / (2·tan(FOV/2)) |
| Altura do olho | 2,0 + 0,06·dist acima do meio (≈ 2,5 m), olhando ~9° para baixo | **1,7 m acima dos pés**, **sem inclinação**; pés a **30 %** da altura da tela por **deslocamento de lente** (`projectionMatrix.elements[9]`) | vê a **face** dos barrancos e o chão como faixa (como a arte), e não o tampo das plataformas visto de cima |
| Zona morta horizontal | nenhuma (segue sempre) | **±0,35 m** | some o tremido de andar pouco |
| Foco à frente | nenhum | **1,0 m** parado → **1,8 m** correndo, na direção em que olha; meia-vida 0,45 s | mais tela para onde se vai |
| Vertical | segue o meio dos dois, inclusive o pulo | **encaixe na plataforma**: só muda ao pousar (meia-vida 0,18 s); fora disso só se sair da faixa **−0,8 / +2,4 m** | pulo não balança a câmera |
| Suavização | `lerp(dt·4)` (depende do fps) | exponencial por meia-vida (independe do fps): x 0,14 s, y 0,25 s, zoom 0,6 s | igual em 30 e 60 fps |
| Parceiro perto | sempre os dois | **enquadra os dois** se |dx| < 8 m e |dy| < 4,5 m (transição 8–12 m), afastando até **15 %** | o normal do casal |
| Parceiro longe | afasta até 22 m (6 % de altura) | **indicador na borda** (rostinho 44 px, seta, distância em m) | personagem nunca encolhe |

### 6.3 Indicador do outro e regras de afastamento (Fio Vermelho)
- **Indicador**: círculo de 44 px (área de toque não precisa) com o **rosto** do parceiro (`public/arte/14_rosto_natan.webp`
  / `15_rosto_bruna.webp`), preso à borda do lado em que ele está (90 % × 78 % da tela, longe dos botões), com a
  **distância em metros**. Estados: normal; **pulsando vermelho** quando ele virou bolha, está pendurado ou perdeu
  coração; **ícone de placa/porta** quando ele está segurando uma placa ou esperando ("preciso de você"). Toque
  longo no indicador: **"Ir até"** (veja abaixo).
- **Afastamento** (fora das zonas de Fio, onde já há corda de 4 m): **≤ 12 m** livre; **12–24 m** o Fio Vermelho aparece
  no HUD ligando o indicador ao personagem, cada vez mais esticado (sem bloquear); **> 24 m**: o fio "puxa" — quem se
  afasta anda a 60 % da velocidade para longe do outro (volta normal para perto). Sem parede invisível.
- **"Ir até"** (assistência, como a bolha de Rayman/NSMB): disponível quando o outro está > 24 m **há 3 s** e em chão
  seguro, ou virou bolha; leva quem pediu até a última lanterna/ponto seguro perto do parceiro. Não usar em trechos
  marcados como "separados de propósito" (cap. 6).
- **Trechos de dupla** (placas, portas duplas, mãos dadas, Fio): a fase marca **zonas de câmera** (foco por dica) que
  fixam um enquadramento que **mostra os dois e o mecanismo** (ex.: 15–18 %), nos dois celulares.

### 6.4 Casos especiais
- **Treino num só celular / campanha solo com companheiro da IA**: a mesma câmera seguindo o personagem controlado;
  o companheiro da IA fica a 1,5–4 m, então quase sempre aparece no quadro; se sair, indicador.
- **Momentos do casal** (abraço, dança, beijo, chegada ao pedaço da estrela): aproxima para **30 %** em 0,8 s, centraliza
  os dois; volta em 0,6 s.
- **Chefe** (cap. 7 em 2.5D): zona de câmera fixa mostrando o Rei e os dois (≈ 14–15 %); a arena 3D é de outra equipe.
- **Convidado na rede**: hoje o convidado desenha os dois com ~100 ms de atraso (interpolação). Com a câmera seguindo o
  próprio personagem, esse atraso fica mais perceptível — **hipótese** a medir: prever localmente o próprio personagem.
- **Cenário com câmera baixa**: no experimento, com olho a 1,0 m a **grama da borda da frente das plataformas tapou os
  personagens** (captura `olho1_grama_tapa.webp`). Com olho a 1,7 m não tapa. Regra para o cenário: borda da frente
  do plano de jogo com plantas baixas (≤ 0,25 m) ou recuadas para z ≤ +0,6.

### 6.5 Camadas de profundidade (para a arte)
| Camada | z (m) | Valor/cor | Regras |
|---|---|---|---|
| Primeiro plano | +2,5 … +6 | **escuro** (L* 10–25 %), cor do tema puxada para roxo/azul, sem névoa | ocupa ≤ 15 % da tela, só nos cantos/base; **nunca** sobre a faixa pés−0,5 … pés+2,5 m; balança com vento; parallax natural 1,3–1,8× |
| Plano de jogo | −1 … +1 | valor médio, saturação média; personagens mais claros e com borda de luz | AO assado nos pés das paredes; borda da frente baixa |
| Plano médio | −3 … −15 | névoa 0–40 %, um pouco mais frio | árvores, casas, cachoeiras, animais; animação secundária |
| Fundo pintado | −20 … −75 | névoa 40–80 % **colorida** (lilás, azul, rosa do tema) | cartões pintados por capítulo, `alphaTest` |
| Céu | domo | gradiente pintado | sol/lua com halo |

## 7. Plano recomendado (ordem, esforço e critério de aceite)

| # | Prioridade | O quê | Arquivos | Esforço | Critério de aceite (mensurável) |
|---|---|---|---|---|---|
| 1 | P0 | **Bloom da alta**: ¼ de resolução, força ≤ 0,3, limiar ≥ 1,0 (HDR), só cores > 1 (materiais `toneMapped:false`) | `pos.ts` | 0,5 dia | nos 7 capítulos (mesmos quadros do e2e), alta × alta-sem-bloom: mediana de L* difere ≤ 0,05, saturação ≥ 0,9× e escuros ≥ 0,8×; brilho visível só em lanternas, janelas, pedaço da estrela, faíscas |
| 2 | P0 | **Câmera por jogador** (seção 6): 23 % / FOV 35° / olho 1,7 m / zona morta / foco à frente / encaixe na plataforma / enquadrar os dois até 8 m | `cena.ts` (+ `partida.ts` para saber quem é "eu") | 2–3 dias | personagem entre 21 % e 25 % da altura em todos os quadros normais dos 7 capítulos; nunca < 15 %; câmera não muda y durante um pulo no plano; chamadas/triângulos ≤ antes |
| 3 | P0 | **Indicador do parceiro** na borda (rosto, distância, estados) | `ui/partida.ts` + CSS | 1 dia | quando o parceiro sai do quadro o indicador aparece em ≤ 1 quadro, fica a ≥ 12 px dos botões, mostra o estado "precisa de ajuda" |
| 4 | P1 | **Regras de afastamento** (12/24 m, puxão, "Ir até") e **zonas de câmera** nas fases (mecanismos de dupla, chefe) | `core/sim.ts`, `core/fases/*`, `cena.ts` | 2 dias | teste no núcleo: separação > 24 m reduz a velocidade de afastamento a 60 %; "Ir até" leva a ≤ 3 m do parceiro em chão seguro; os testes de alcance continuam passando |
| 5 | P1 | **Hierarquia de valor**: primeiro plano escuro (z +2,5…+6), névoa colorida só atrás (fog com gradiente e altura), menos saturação nos meios-tons, borda de luz mais forte nos personagens | `cenario.ts`, `materiais.ts`, `tema.ts`, `ceu.ts` | 3–5 dias | por capítulo, estatística do quadro do e2e: faixa p5–p95 ≥ 0,68, saturação média 0,45–0,60, claros ≥ 3 %, escuros 10–25 %; primeiro plano nunca cobre a faixa de jogo (teste por projeção) |
| 6 | P1 | **Borda da frente do plano de jogo** baixa (plantas ≤ 0,25 m ou recuadas z ≤ +0,6) | `cenario.ts`, `aderecos.ts` | 1 dia | teste de oclusão: raio da câmera até cabeça e peito do personagem não bate em geometria opaca em 100 posições por fase |
| 7 | P1 | **AO assado por vértice** + rampa toon macia no cenário | `cenario.ts`, `materiais.ts` | 2 dias | custo zero por quadro; carregamento +≤ 200 ms no Redmi (medir no aparelho) |
| 8 | P2 | **Fundos pintados por capítulo** (cartões WebP/KTX2), animação secundária (vento em copas, cipós, cachoeiras), partículas pequenas | `ceu.ts`, `cenario.ts` | 1–2 semanas | identidade: um teste cego com 5 pessoas acerta o capítulo pelo quadro em ≥ 80 %; ≤ 60 chamadas na média |
| 9 | P2 | Squash & stretch e momentos do casal com zoom 30 % | `personagem.ts`, `cena.ts` | 1–2 dias | pulo/aterrissagem com 1,15/0,85 por 80–120 ms; zoom 30 % em 0,8 s nos eventos de carinho |

Créditos pagos (pinturas de fundo por IA) exigem autorização do responsável, com teto (regra do projeto).

## 8. Limites deste trabalho
- **Sem GPU**: não medi fps, tempo de quadro, temperatura nem bateria. Os custos da seção 4 são estimativas
  relativas; o bloom e as sombras precisam ser medidos no Redmi e no iPhone (o projeto já tem `?debug=1`).
- O aparelho "Redmi Note 11" pode ser Adreno 610 (Note 11) ou Mali-G57 MC2 (Note 11S): confirmar.
- Medi o personagem pela altura da colisão (1,1 m); o modelo desenhado pode passar um pouco (cabelo).
- O experimento cobre 6 quadros × 2 aparelhos, parados. Não testei a câmera em movimento (pulo, Fio, argola) com o
  jogo rodando de verdade nem em dupla pela rede.
- A arte conceitual é uma imagem gerada (painel de apresentação), não um quadro de jogo; a comparação de estatística é
  um guia, não uma meta exata.
- O primeiro plano do experimento é um rascunho feio de propósito (formas escuras simples), só para testar posição.

## 9. Fontes (buscas de 2026-11-24)
- Trine 4: [PC Gamer — dev diary](https://www.pcgamer.com/au/trine-4-dev-diary-showcases-a-return-to-sidescrolling-fairy-tales/), [Fandom — "2.5D is where Trine belongs"](https://www.fandom.com/articles/2017-interview-frozenbyte-on-trine-4-2-5d-is-where), [Wccftech — entrevista E3 2019](https://wccftech.com/trine-4-hands-on-interview-e3-2019/), [Kotaku](https://kotaku.com/trine-4s-developers-want-to-take-the-series-back-to-wha-1833945435), [CGM — análise](https://www.cgmagonline.com/review/trine-4-the-nightmare-prince-review/), [Frozenbyte — making of](https://frozenbyte.com/tag/trine-4-making-of), [Edge (PressReader)](https://www.pressreader.com/australia/edge/20150604/281930246580659)
- Rayman: [UbiArt Framework (Wikipedia)](https://en.wikipedia.org/wiki/UbiArt_Framework), [GDC Vault — Rayman Legends: The Design Process](https://gdcvault.com/play/1021191/Rayman-Legends-The-Design-Process), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/RaymanLegends), [Prima — coop](https://primagames.com/news/rayman-legends-co-op-multiplayer-tips), [GamesRadar — Origins](https://www.gamesradar.com/rayman-origins-hands-on-preview), [Co-Optimus](https://co-optimus.com/review/1347/page/2/rayman-legends-co-op-review.html)
- Unravel Two: [PlayStation Blog — arte](https://blog.playstation.com/2018/07/24/celebrating-the-art-of-unravel-two/), [EA — entrevista do diretor](https://www.ea.com/games/unravel/unravel/news/unravel-two-director-interview-development), [EA — ambientes](https://www.ea.com/games/unravel/news/unravel-game-environments)
- It Takes Two: [Unreal Engine — entrevista](https://www.unrealengine.com/developer-interviews/it-takes-two-lovingly-marries-story-and-gameplay-together), [Audiokinetic — som em tela dividida](https://blog.audiokinetic.com/behind-the-sound-of-it-takes-two-a-qa-with-the-hazelight-audio-team), [GDC Vault — Soundscape](https://gdcvault.com/play/1027157/Creating-the-Soundscape-of-It), [The Ringer](https://www.theringer.com/platform/amp/2021/4/22/22396763/josef-fares-it-takes-two-interview-co-op-gaming)
- Ori: [Xbox Wire — The Art of Ori](https://news.xbox.com/en-us/?p=4339), [Airborn Studios](https://airborn-studios.com/projects/ori), [TheGamer — arte de Will of the Wisps](https://www.thegamer.com/ori-and-the-will-of-the-wisps-art-interview/)
- Kirby: [Nintendo — Ask the Developer](https://www.nintendo.com/sg/interview/arzg/02.html), [Nintendo Wire](https://nintendowire.com/news/2022/03/24/kirby-and-the-forgotten-land-developers-didnt-want-kirby-to-suffer-by-giving-him-too-many-enemies-to-fight/), [Automaton](https://automaton-media.com/en/news/20220325-10834/), [Kotaku](https://kotaku.com/1848704577)
- LittleBigPlanet: [LBP3 (Wikipedia)](https://www.wikipedia.org/wiki/LittleBigPlanet_3), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/LittleBIGPlanet)
- Câmeras: [Itay Keren — Scroll Back (Game Developer)](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers) (bloqueado nesta sessão; usei o índice), [GDC Vault](https://www.gdcvault.com/play/1022243/contactUs), [Cornell CS3152 — slides de câmera](https://www.cs.cornell.edu/courses/cs3152/2026sp/lectures/lecture13/slides-13.pdf), [mais exemplos](https://qwe321qwe321qwe321.github.io/posts/17027)
- Three.js: [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html), [Stylized NPR](https://masterallarts.pages.dev/learn/threejs-from-zero/s4-09-stylized-npr/), [Discourse — AgX](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609), [Discourse — visão geral de tone mapping](https://discourse.threejs.org/t/tone-mapping-overview/75204), [Blender — Khronos PBR Neutral](https://projects.blender.org/blender/blender/pulls/118936), [PR three.js 27413](https://github.com/mrdoob/three.js/pull/27413)
- Aparelhos: [GSMArena — Note 11 (SD680) e 11S](https://www.gsmarena.com/redmi_note_11s_launches_with_108mp_camera_snapdragon_680_powered_note_11_follows-news-52858.php), [nanoreview — 11S × 11](https://nanoreview.net/en/phone-compare/xiaomi-redmi-note-11s-vs-xiaomi-redmi-note-11), [Arm — Mali-G57](https://www.arm.com/products/silicon-ip-multimedia/gpu/mali-g57), [Notebookcheck — Mali-G57 MP2](https://www.notebookcheck.net/Mali-G57-MP1-vs-Mali-G57-MP2_11103_10691.247598.0.html)

## 10. Arquivos desta entrega
- Este documento: `docs/revisao/PESQUISA_ARTE_CAMERA.md`
- Imagens: `docs/revisao/img/pesquisa-arte-camera/` — `cam_*.webp` (12 pares antes/depois da câmera),
  `alta_*.webp` (3 pares alta atual × sem bloom/raios/névoa), `olho1_grama_tapa.webp`, `conceito_quadro_jogo.webp`
- Ferramentas: `tools/revisao/pesquisa-arte-camera/` — `capturar_camera.mjs` (capturas e medidas;
  `RAIZ=<worktree com o patch> node capturar_camera.mjs antes "depois:v=2&olho=1.7&alt=0.23"`),
  `estatisticas_imagem.py`, `montar_comparacoes.py`, `experimento_camera.patch` (aplicar numa worktree:
  `git apply`), `medidas/` (log com todas as medidas; as linhas `c2_sep20` da primeira rodada têm o defeito do pisca
  e foram refeitas — valem as da tabela da seção 5)
