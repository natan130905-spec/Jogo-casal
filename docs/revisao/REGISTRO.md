# Registro de problemas e lições — Entre Dois Mundos

Mantido pela direção técnica. Cada entrada tem: **id**, **sintoma** (o que se vê), **causa** (*confirmada* = lida no
código ou medida; *hipótese* = ainda não provada), **correção** (com o estado e o lote do `PLANO.md`) e **teste que
impede a volta**. A última linha diz de onde veio. Entradas novas entram no fim, com o próximo número. Não se apaga
entrada: quando a correção chega, atualiza-se o estado e o commit.

Estados: **corrigido** (commit citado) · **em andamento** (sem commit) · **planejado** (lote) · **lição** (não é
defeito do jogo; é regra de trabalho).

Preenchido em 2026-11-24 com o que a etapa de diagnóstico encontrou (base `f6a32a9`).

---

## Imagem e arte

### R01 · Véu branco na qualidade alta
- **Sintoma:** a alta fica esbranquiçada, sem contraste e com menos cor que a média. No cap. 1, L\* 62,3 contra 51,9
  na média, saturação 0,47 contra 0,63 e % de sombra 8,3 contra 17,3.
- **Causa (confirmada por experimento):** o `UnrealBloomPass` (`pos.ts:16`, força 0,55, raio 0,65, limiar 0,82) age
  sobre a cena HDR antes da curva de tons. O céu do horizonte, o sol, os raios aditivos e as cascatas passam do limiar
  em áreas grandes, e o raio espalha o brilho pela tela. Desligando só o bloom, os 7 capítulos vão de L\* 49,4 para
  46,2 e a saturação de 0,581 para 0,632. Sombras, Standard × Lambert e névoa mudam ≤ 1 ponto.
- **Correção:** bloom seletivo marcado no alfa (só lanternas, janelas, cristais, estrelas e faíscas), a ¼ da
  resolução, força 0,3, raio 0,3, `?bloom=0` para medir. Estado: **em andamento** (L0, `src/render/pos.ts`, sem
  commit).
- **Teste que impede a volta:** `capturas.mjs` + `comparar.mjs` com alta × `?bloom=0`: \|ΔL\*\| ≤ 1,5 e Δsat ≥ −0,02
  nos 7 capítulos; alta × média: \|ΔL\*\| ≤ 3 e Δsat ≥ −0,03 (faixa no `ALVO`). A proposta é virar e2e de imagem
  no L9.
- Fonte: ARTE_DIAGNOSTICO §3 (C1); PESQUISA_ARTE_CAMERA §3.2.

### R02 · Lago azul-claro e vaga-lumes lavados
- **Sintoma:** o lago `#1a296b` (azul-marinho) aparecia como ≈ `#5970ad`.
- **Causa (confirmada no código):** `agua.ts:74` e `efeitos.ts:57` usavam `setHex(hex, LinearSRGBColorSpace)` com
  cores escritas em sRGB.
- **Correção:** cores do tema tratadas como sRGB; cascata e lago com a mesma curva de tons nas três qualidades.
  Estado: **corrigido** (`f4ccace`).
- **Teste que impede a volta:** proposto no L0: cor medida do lago na captura igual à do tema com ΔE ≤ 5. Ainda falta
  um vitest que proíba `LinearSRGBColorSpace` em `setHex` de cores de tema (grep).
- Fonte: ARTE_DIAGNOSTICO §3 (C5).

### R03 · A qualidade muda a composição
- **Sintoma:** no mesmo tick, a média e a alta mostram adereços diferentes no fundo (cap. 1: blocos verdes × bola e
  urso; cap. 5: outro castelo).
- **Causa (hipótese):** o sorteio dos adereços era consumido de forma diferente conforme a qualidade.
- **Correção:** uma semente por grupo de peças (`semear`), e a qualidade só acrescenta. Estado: **em andamento** (L0).
- **Teste que impede a volta:** `test/render_cenario.test.ts` (sem commit): a grama e os adereços da baixa estão no
  mesmo lugar na média e na alta.
- Fonte: ARTE_DIAGNOSTICO §0.4.

### R04 · Fundo pastel e claro demais (caps. 1, 5 e 6)
- **Sintoma:** de 10 % a 26 % da tela quase branca, contra 3,4 % na arte conceitual; o terço de cima vira uma parede
  clara e lisa.
- **Causa (confirmada por medida e no código):** silhuetas e névoa já pintadas em rosa e lilás claros (`tema.ts`,
  `silhuetas`), com L\* 75–90.
- **Correção:** paleta da ARTE §6.2 (silhuetas e névoa com L\* 35–55, campo `estilo` por capítulo). Estado: **em
  andamento** (L0).
- **Teste que impede a volta:** `comparar.mjs` com % quase branco ≤ 4 e L\* do capítulo ±6.
- Fonte: ARTE_DIAGNOSTICO §2.2 e §4.1.6.

### R05 · Sombra dos personagens borrada (sem "cel")
- **Sintoma:** a sombra dos personagens é um degradê suave, não as faixas de desenho animado.
- **Causa (confirmada no código):** `personagem.ts:337` usa `LinearFilter` no `gradientMap` de 3 tons.
- **Correção:** `NearestFilter` e sombra colorida do capítulo. Estado: **planejado** (L7).
- **Teste que impede a volta:** retrato (`test/retrato/`): 3 faixas de tom distintas medidas no rosto. Proposta: um
  vitest que confere `minFilter`/`magFilter === NearestFilter` no material do personagem.
- Fonte: ARTE_DIAGNOSTICO §4.1.8.

### R06 · "Blocos com enfeites": o mesmo chão em todos os mundos
- **Sintoma:** floresta, quarto, cidade do relógio e reino dos doces têm a mesma laje com bordas caídas, só
  recolorida; arestas retas e enfeites espalhados de forma regular.
- **Causa (confirmada no código):** `cenario.ts:62` (`penhasco` = caixa deformada) e `aderecos.ts:3` ("o chão… é o
  mesmo, com a paleta do tema").
- **Correção:** `Kit.chao()` por capítulo (tapete, trilho e livros no 1; raízes no 2; pedra e engrenagem no 3; areia
  e píer no 4; bolo no 5; cristal e runa no 6; ilhas com raízes no 7), marcos e primeiro plano. Estado: **planejado**
  (L7 no cap. 1; L10 nos outros).
- **Teste que impede a volta:** revisão cega (5 de 5 acertam o capítulo por um recorte só do chão); medida de % de
  tampo ≤ 12 %.
- Fonte: ARTE_DIAGNOSTICO §4.1; PESQUISA_ARTE_CAMERA §0.4.

### R07 · Personagens pequenos
- **Sintoma:** 17,9 % da altura da tela juntos, 10,5 % a 8 m e 6,4 % a 20 m (22–25 px). Nos 10 % piores momentos,
  31–33 px. Na arte conceitual são ≈ 21–23 %.
- **Causa (confirmada pela geometria e pela projeção):** câmera compartilhada no meio dos dois, com distância
  `clamp(6 + 0,9·sep, 7,6, 22)` e FOV 42° (`cena.ts:294–302`).
- **Correção:** câmera por celular, com o personagem a 23 %, os dois enquadrados até 8 m, zonas de câmera e
  indicador do parceiro. Estado: **planejado** (L3a).
- **Teste que impede a volta:** altura projetada entre 21 % e 25 % nos pontos normais e ≥ 15 % no pior caso
  (`capturar_camera.mjs` e `capturas.mjs --eu`).
- Fonte: PESQUISA_ARTE_CAMERA §3.1; PLAYTEST §3.5; ARTE_DIAGNOSTICO §0.3.

### R08 · A câmera mostra o tampo das plataformas como um tabuleiro
- **Sintoma:** de 25 % a 35 % do quadro é uma área chapada de uma cor só (caps. 1 e 5), estimado nas capturas.
- **Causa (confirmada no código):** a câmera fica ≈ 2,5 m acima e olha ≈ 9° para baixo, e a faixa de chão tem 4 m
  de fundo.
- **Correção:** olho a 1,7 m sem inclinar, pés a 30 % da tela, chão como faixa fina. Estado: **planejado** (L3a e
  L7).
- **Teste que impede a volta:** % de tampo ≤ 12 % (máscara por normal na ferramenta de capturas, a criar no L7).
- Fonte: PESQUISA_ARTE_CAMERA §0.4; ARTE_DIAGNOSTICO §4.1.2.

## Movimento e fases

### R09 · Pulo sem tolerância (sem coyote time nem jump buffer)
- **Sintoma:** apertar 1 tick depois de sair da quina faz cair; apertar 1 tick antes de pousar e segurar não pula.
- **Causa (confirmada, medida 0 tick):** `sim.ts` exigia `noChao` no tick e `pulouSegurado` ficava verdadeiro no ar.
- **Correção:** coyote 6 ticks e buffer 7 ticks. Estado: **corrigido** (`572e276`).
- **Teste que impede a volta:** `test/sim.test.ts` trava os números (`NUCLEO.md`).
- Fonte: AUDITORIA_MOVIMENTO §3.

### R10 · Toque rápido sobe pouco
- **Sintoma:** um toque de 1 tick subia 0,73 m e um de 100 ms, 1,23 m (70 % do pulo).
- **Causa (confirmada):** corte `vy *= 0,88` desde o primeiro tick sem o botão.
- **Correção:** o corte só vale depois de 8 ticks (pulo mínimo 1,38 m). Estado: **corrigido** (`572e276`).
- **Teste que impede a volta:** `test/sim.test.ts`.
- Fonte: AUDITORIA_MOVIMENTO §1.

### R11 · Pisão sem segurar quicava 0,47 m
- **Sintoma:** pisar num bichinho sem segurar o pulo dava um quique fraco.
- **Causa (confirmada no código):** `sim.ts:265` dava `vy = 9` mas não ligava `lancado`, e o corte derrubava o quique.
- **Correção:** `lancado = true` no pisão. O quique solto vai a 1,27 m. Estado: **corrigido** (`572e276`).
- **Teste que impede a volta:** `test/sim.test.ts`.
- Fonte: AUDITORIA_MOVIMENTO §3.4.

### R12 · Sem correção de quina para os pés
- **Sintoma:** quem chegava 1 cm abaixo do topo de um degrau batia na parede e caía; o degrau máximo era 1,74 m.
- **Causa (confirmada):** não existia a regra.
- **Correção:** no ar, contra a parede, o corpo sobe para um topo até 0,20 m acima dos pés (com vy ≤ 4). O degrau
  máximo passa a 1,90 m. Estado: **corrigido** (`572e276`).
- **Teste que impede a volta:** `test/sim.test.ts`.
- Fonte: AUDITORIA_MOVIMENTO §3.

### R13 · Lição: a quina da cabeça de 0,20 m quebra o capítulo 3
- **Sintoma:** com a proposta de 0,20 m (no lugar de 0,32), o cap. 3 ficou com 206 pares de posições sem saída e os
  bots pararam em x 164,7.
- **Causa (confirmada por medida):** um trecho do cap. 3 depende do deslize de 0,32 m.
- **Correção:** fica 0,32 m (comentado em `colisao.ts`) até o trecho ser redesenhado no R3 (L10). Estado: **lição**.
- **Teste que impede a volta:** `fases.test.ts` (bots vencem) e o "sem armadilha" do grafo. **Regra:** mudança de
  física só com nova rodada de alcance.
- Fonte: NUCLEO.md (tabela de 2026-11-24).

### R14 · Com o coyote, os abismos do fio passavam sozinhos
- **Sintoma:** pulo correndo da ponta do galho (cap. 2, x 44) e da ponte de luz (cap. 7, x 72) pousava do outro lado
  sem o fio.
- **Causa (confirmada pela busca):** um vão de 5,6 m com 3 m de queda passou a ser vencível, porque o coyote dá
  ≈ 0,52 m a mais.
- **Correção:** abismos do fio com 6,2 m (caps. 2, 4 e 7). Estado: **corrigido** (`7cca84c`).
- **Teste que impede a volta:** `test/fases/alcance_teste.ts` (`SOLO_ATE`: sozinho, a busca não passa da primeira
  ajuda). **Regra:** todo movimento novo (planar, gancho, pulo duplo) roda esse teste de novo.
- Fonte: commit `7cca84c`; LEIAME das fases.

### R15 · Estrelinhas das gelatinas fora da trajetória real
- **Sintoma:** estrelinhas do cap. 5 (#6–9, #31–38) só saíam por 17 a 64 combinações; o quique segurado passava 2 m
  acima.
- **Causa (confirmada):** o arco foi desenhado por fórmula (`arco()`), não pela trajetória simulada.
- **Correção:** recolocadas sobre a trajetória gravada. Estado: **corrigido** (`f79a88a`).
- **Teste que impede a volta:** `fases_alcance*.test.ts` (folga ≥ 15 no CI) e a regra no LEIAME ("estrelinha de pulo
  especial vai na trajetória simulada"). No `test:lento` (L2a), folga ≥ 100.
- Fonte: AUDITORIA_MOVIMENTO §2.3.

### R16 · Estrelinhas acima da tela
- **Sintoma:** cap. 3 #31/#32 ficavam 2,55 m acima da tela com a dupla no chão; cap. 5 #14, 0,38 m acima.
- **Causa (confirmada pela projeção da câmera):** posições altas para a câmera de 42° a 7,6 m.
- **Correção:** relógio grande à vista e posições revistas. Estado: **corrigido para a câmera antiga** (`f79a88a`);
  **refazer com a câmera nova** (L3a).
- **Teste que impede a volta:** `visibilidade.ts` com a câmera do render no `test:lento`, mais a lista aprovada de
  segredos.
- Fonte: AUDITORIA_MOVIMENTO §2.3.

### R17 · Estrelinhas "de dupla" sem aviso
- **Sintoma:** 6 estrelinhas (cap. 1 #22–24; cap. 2 #18–20) só saem com mãos dadas; no treino e no solo não saem e
  nada avisa.
- **Causa (confirmada pela busca):** são segredos de dupla de propósito, sem sinal na tela.
- **Correção:** marca de mãos dadas a até 6 m (`marcas: [{ tipo: 'maos-dadas' }]`). Estado: **corrigido**
  (`f79a88a`). No solo, o companheiro dá a mão (L6).
- **Teste que impede a volta:** lista aprovada de estrelinhas só em dupla em `fases_alcance*.test.ts` (uma nova quebra
  o teste).
- Fonte: AUDITORIA_MOVIMENTO §2.3.

### R18 · Medidas do pulo erradas nos documentos
- **Sintoma:** LEIAME e comentários diziam de 5 a 15 cm a mais que o real (≈ 1,8 m; 4,5 m; 3,75/5,4 m).
- **Causa (confirmada):** valores escritos à mão, não medidos.
- **Correção:** números medidos em `NUCLEO.md` e no LEIAME. Estado: **corrigido** (`3754f5b`).
- **Teste que impede a volta:** `test/sim.test.ts` trava a envoltória. **Regra:** documento cita o número do teste.
- Fonte: AUDITORIA_MOVIMENTO §1.

### R19 · O convidado vê o próprio personagem com ≈ 220 ms de atraso
- **Sintoma:** a Bruna precisa pular ≈ 1 m antes da quina que vê; "não alcanço" no celular dela.
- **Causa (confirmada pela medida e pelo código):** não há predição local; o instantâneo sai a cada 3 ticks e o
  convidado interpola 100 ms no passado (`partida.ts:136`). São 220 ms com rede de 0 ms e ≈ 2 × latência + 130 ms no
  celular. A 5,2 m/s isso dá 1,1–1,4 m.
- **Correção:** predição do próprio personagem, entradas com tick e redundância, coyote de rede. Estado:
  **planejado** (L3b; canal não confiável no L13).
- **Teste que impede a volta:** `latencia.mjs`: mediana do convidado ≤ anfitrião + 2 quadros; `medir.mjs rede` com
  150 ms: reação ≤ 1 quadro.
- Fonte: AUDITORIA_MOVIMENTO §4; TECNICO_DESEMPENHO §10.

### R20 · Teleporte no capítulo 6
- **Sintoma:** um superpulo de mãos dadas para a esquerda, saindo de x 30,4–30,71, leva o Natan de x 29,5 a x 66,1 em
  1 tick e pula as duas portas espelhadas.
- **Causa (confirmada e reproduzida tick a tick):** em `moverEixo` (`colisao.ts`), o empurrão de quina deixa o corpo
  1e-4 m dentro do piso vizinho (o vão de 0,6 m é igual à largura do corpo). A resolução horizontal escolhe o lado pela
  direção do movimento, não pela menor penetração, e encadeia o empurrão até o fim do piso de 34 m. Isso também cria
  uma ligação falsa no grafo de alcance.
- **Correção:** resolver pelo lado de menor penetração; empurrão de quina só para lugar livre. Estado: **corrigido**
  (L2a, `ac61f15`). Os 7 planos de bots fecham no mesmo tick e com o mesmo rastro de posições; a ligação falsa 0 → 2
  do cap. 6 sumiu do grafo (o caminho mínimo voltou às 4 portas espelhadas + o muro, `test/apoio.test.ts`). Efeito
  colateral medido: a colisão dos bichinhos usa a mesma função, e no cap. 7 os bots pegam 39 estrelinhas em vez de 38
  (uma estrelinha solta por bichinho cai noutro lugar), sem mudar tick nem posições dos jogadores.
- **Teste que impede a volta:** T15: nos 7 planos, nenhum passo move o corpo mais que \|vx·dt\| + 0,35 m na horizontal
  (`fases.test.ts`; maior medido 0,20 m no cap. 3, o deslize da quina da cabeça); `teleporte_cap6.ts` como caso fixo
  e 3 casos de `moverEixo` (`test/colisao.test.ts`, 3 de 4 reprovam com o código antigo).
- Fonte: ARQUITETURA_MODOS §3.

## Armas e combate

### R21 · Munição finita trava capítulos; combate forçado no cap. 3
- **Sintoma (medido nos bots):** sem nenhum tiro, os caps. 3, 5 e 7 não fecham; o cap. 7 não fecha nem com 20 tiros
  por jogador (27 de 80 tiros batem no Rei fechado).
- **Causa:** **confirmada** no cap. 3 (o espinhudo de x 87 patrulha sob uma tábua com a face de baixo a 1,3 m: não dá
  para pular por cima) e no cap. 7 (o Rei só leva dano aberto). **Hipótese** no cap. 5 (os bots não desviam na chuva
  de bichinhos).
- **Correção:** regra do recurso infinito (Estilingue de 3 pedrinhas que voltam e corpo a corpo); tiro defendido vira
  miçanga; lista de combate forçado. Estado: **planejado** (L4).
- **Teste que impede a volta:** A2 (os 7 capítulos fecham só com recurso infinito) e A3 (nenhum obrigatório exige
  munição finita ou item raro).
- Fonte: DESIGN_ARMAS §1.2 e §6.

## Modos, salvamento e rede

### R22 · Não existe campanha solo
- **Sintoma:** a campanha só começa com o convidado conectado; o "treino" deixa o outro personagem parado; sozinho,
  nenhum capítulo passa da primeira ajuda (22 % a 43 % do comprimento).
- **Causa (confirmada no código):** `iniciarSessao()` só em `aoMudarEstado('conectado')` (`main.ts:272–273`);
  `INPUT_NEUTRO` no outro assento (`partida.ts:150`).
- **Correção:** assentos, campanha sem sala e companheiro controlado pelo jogo. Estado: **planejado** (L2b e L6).
- **Teste que impede a volta:** T1/T2/T3 (o solo fecha os capítulos); `test/e2e/solo.mjs`.
- Fonte: ARQUITETURA_MODOS §0–1; AUDITORIA_MOVIMENTO §5.

### R23 · O progresso fica só no aparelho de quem criou a sala
- **Sintoma:** se a Bruna criar a sala, a jornada recomeça do zero; o convidado zera os capítulos ao entrar.
- **Causa (confirmada no código):** só o anfitrião grava (`main.ts:224`); o convidado recebe `capitulos: {}`
  (`main.ts:342`).
- **Correção:** salvo v2 do casal com fusão por união, máximo e OU, gravado nos dois aparelhos. Estado: **planejado**
  (L2b).
- **Teste que impede a volta:** T9 (fusão comutativa e idempotente), T10 (migração do v1), `dupla.mjs` (o convidado
  grava com o mesmo `id`).
- Fonte: ARQUITETURA_MODOS §0.2.

### R24 · Nada é salvo no meio do capítulo
- **Sintoma:** fechar o navegador (ou o iOS descartar a aba) volta ao começo do capítulo.
- **Causa (confirmada):** só se grava na conclusão e no `arena7`.
- **Correção:** `ResumoLanterna` de ≈ 200 B, gravado também em `pagehide`/`visibilitychange`, e o botão "Continuar".
  Estado: **planejado** (L2b).
- **Teste que impede a volta:** T8 (37/37 retomadas no vitest + e2e recarregando no meio).
- Fonte: ARQUITETURA_MODOS §2.2.

### R25 · Se a conexão cai, os dois param
- **Sintoma:** pausa geral; a queda só é declarada depois de 7 s de silêncio.
- **Causa (confirmada):** `main.ts:267`, `rede.ts:18` (7 s), `rede.ts:137` (o anfitrião espera 20 s).
- **Correção:** em etapas (PLANO C17): primeiro, entrada neutra e aviso (L1); depois, a IA assume em 1 s sem pausar
  (L11). Estado: **planejado**.
- **Teste que impede a volta:** T5 (com o convidado offline, a IA assume em ≤ 70 ticks e o tick continua avançando).
- Fonte: ARQUITETURA_MODOS §0.4.

### R26 · O convidado sai do app e a Bruna continua andando
- **Sintoma:** com o dedo no joystick, o celular do convidado vai para segundo plano e a Bruna segue a −5,2 m/s; o
  anfitrião não pausa nem avisa (medido com a página congelada por 180 ticks).
- **Causa (confirmada no código):** `partida.ts:98` reaproveita a última entrada recebida sem prazo; não há
  `visibilitychange`/`pagehide` em `src/`.
- **Correção:** entrada do convidado vale no máximo 6 ticks sem nova (a Bruna para em ≤ 18 ticks = 0,3 s depois da
  última mensagem); 1,5 s sem nada do outro aparelho pausa com "Bruna/Natan saiu do jogo" (o prazo cresce para 8 × o
  intervalo típico quando o aparelho já mandava devagar, para não pausar à toa); `visibilitychange`/`pagehide` nos
  dois (mensagem `ausente`, pausa, música e `AudioContext` suspensos). Estado: **corrigido** (L1a, `58ccd30`,
  `c80ff3f`, `888d95c`).
- **Teste que impede a volta:** `test/e2e/interface.mjs` (dupla): convidado sem mandar nada ⇒ `vxBruna = 0` em 18
  ticks e aviso "Bruna saiu do jogo"; anfitrião escondido ⇒ o convidado vê "Natan saiu do jogo". Ver R74 (o
  "congelado" do CDP não congelava).
- Fonte: PLAYTEST §2.1; TECNICO_DESEMPENHO A7.

## Interface e controles no celular

### R27 · Não dá para pausar com o polegar no joystick
- **Sintoma:** ❚❚, ⇄, Continuar e os botões das telas não respondem enquanto outro dedo está na tela.
- **Causa:** **confirmada no Chromium**: os botões usam `onclick` (`main.ts:361–364`), e o navegador não gera
  `click` com outro dedo encostado. No Safari é **hipótese** forte.
- **Correção:** `tocavel()` (`src/ui/telas.ts`): ❚❚ no `pointerdown`, os outros no `pointerup` dentro do botão, com
  captura; o `click` de compatibilidade é descartado. A pausa deixa o toque passar fora do cartão e o joystick
  segurado continua valendo ao continuar. Estado: **corrigido** (L1a, `c9b3ffe`, `0bc19fe`, `ab17eda`).
- **Teste que impede a volta:** `test/e2e/interface.mjs`: ❚❚, Continuar e ⇄ com o polegar no joystick, e o joystick
  anda depois de continuar sem levantar o dedo; `jogo.mjs` (com R73 corrigido).
- Fonte: PLAYTEST §2.2.

### R28 · Saídas destrutivas sem confirmação
- **Sintoma:** o ✕ do mapa e Sair derrubam a sala dos dois; "Mapa da jornada" abandona a fase e fica 8 px abaixo de
  Continuar.
- **Causa (confirmada no código):** `main.ts:290, 354, 363, 364` chamam `sair()` e a troca de tela direto.
- **Correção:** `comConfirmacao()`: o 1º toque troca o texto ("Toque de novo: sair (a Bruna também sai)") por 3 s
  (pela hora do toque, não por timer: R77); Mapa e Sair em cor neutra, 14 px abaixo de Continuar. Estado:
  **corrigido** (L1a, `c45d8d4`, `ab17eda`).
- **Teste que impede a volta:** `test/e2e/interface.mjs`: um toque em ✕, Sair ou Mapa nunca sai (treino e convidado);
  o segundo sai.
- Fonte: PLAYTEST §2.3.

### R29 · Os controles tapam estrelinhas, bichinhos e pousos
- **Sintoma:** uma estrelinha visível fica atrás de um controle ou do HUD 15–28 % do tempo, e um bichinho, 19–56 %.
  Placas ficam sob o joystick; no fio do cap. 2, a beirada de pouso fica sob ✋/⬆.
- **Causa (confirmada pela projeção validada, ±5 px):** os botões ocupam a faixa onde chega o chão da frente; a câmera
  não tem respiro à frente.
- **Correção:** layout único (PLANO C4) com botões mais baixos e mais transparentes, câmera com olhar à frente.
  Estado: **planejado** (L3a e L5).
- **Teste que impede a volta:** `projecao.mjs`: estrelinhas ≤ 8 % e bichinhos ≤ 10 % do tempo tapados, nos 7
  capítulos.
- Fonte: PLAYTEST §3.1.

### R30 · O jogo não ensina nada dentro da fase
- **Sintoma:** nenhuma dica, seta ou ícone de contexto no 2.5D (mãos dadas, ancorar o fio, placa e porta, bolha).
- **Causa (confirmada no código):** `#aviso` só é usado na arena (`partidaArena.ts`); o ✋ tem sempre o mesmo ícone.
- **Correção:** sistema único de dicas e balões (PLANO C16), com ✋ de contexto e fio de luz entre placa e porta.
  Estado: **planejado** (L8a e L5).
- **Teste que impede a volta:** cada mecânica nova de cada capítulo tem uma dica na primeira vez (teste de dados do
  roteiro); T-R1.
- Fonte: PLAYTEST §4.1.

### R31 · iPhone: sem tela cheia no Safari; controles encostam na barra de início
- **Sintoma:** no Safari o jogo perde ≈ 50 px de altura (esse valor é **hipótese**, a conferir); o ⬆ termina a ≈ 1 px
  da barra.
- **Causa:** **confirmada** (o iPhone não tem `requestFullscreen`, e ele falha em silêncio em `main.ts:298`; os
  controles usam `bottom: 5vh` sem `safe-area-inset-bottom`).
- **Correção:** cartão "Adicionar à Tela de Início" no iOS fora do modo standalone, uma vez (`src/ui/plataforma.ts`);
  `env(safe-area-inset-bottom)` somado nos controles do 2.5D e da arena. Estado: **corrigido** (L1a, `8ef5fa4`).
- **Teste que impede a volta:** `test/plataforma.test.ts` e `test/e2e/interface.mjs` (iPhone: aparece uma vez;
  standalone e Android: nunca; joystick e ⬆ acima dos 21 px da barra).
- Fonte: PLAYTEST §3.4.

### R32 · Joystick fixo
- **Sintoma:** pousar o polegar 12 px fora ou 20 px acima não faz nada; pousar fora do centro já anda a 2,4 m/s.
- **Causa (confirmada):** joystick de base fixa no 2.5D; a arena já usa o flutuante (`controlesArena.ts`).
- **Correção:** o joystick flutuante da arena, com a mesma curva. Estado: **planejado** (L5).
- **Teste que impede a volta:** `jogo.mjs`: pouso fora anda; pouso fora do centro ⇒ `vx = 0` até arrastar.
- Fonte: PLAYTEST §2.4.

### R33 · A tela congela ao tocar em Jogar
- **Sintoma:** de 3,7 a 6,6 s do toque ao primeiro quadro, sem tela de carregamento; tarefas únicas de até 1,6 s
  (6,8 s na alta do cap. 2 na máquina sem GPU).
- **Causa (confirmada pelo perfil):** a fase é montada de forma síncrona dentro do toque; 70–80 % do tempo é geometria
  procedural (`mergeVertices`, ruído por vértice em `util.ts`), mais a compilação síncrona dos shaders.
- **Correção:** tela de carregamento pintada antes de montar (`mostrarCarregando` + `quadroPintado`), montagem em
  5 etapas com `await` e barra de progresso (`Cena.montar`), `compileAsync` e um quadro de aquecimento atrás dela.
  Estado: **corrigido** no L1 (`ebad74f`, `337cd60`); a etapa "cenário" ainda é uma tarefa única de 1–3 s na máquina
  sem GPU (geometria procedural em `cenario.ts`): assar no build ou Worker continua **planejado** (L13).
- **Teste que impede a volta:** `test/e2e/interface.mjs`: nenhuma tarefa > 200 ms entre o toque em Jogar e a tela
  pintada (medido: 0 ms; pintada em 28–37 ms); ≤ 3 s no Redmi pelo `?diag` (falta o relatório do aparelho).
- Fonte: PLAYTEST §5.1; TECNICO_DESEMPENHO A5.

### R34 · Informação de depuração na tela do jogador
- **Sintoma:** "N fps" sempre visível (o jogador vê "24 fps" e acha que quebrou); o nome do capítulo fica fixo em cima
  das estrelinhas altas.
- **Causa (confirmada):** `partida.ts:183` escreve o fps sempre.
- **Correção:** fps só com `?debug` (também escondido na arena, por CSS); o nome some depois de 3 s. Estado:
  **corrigido** (L1a, `c05ddd5`).
- **Teste que impede a volta:** `test/e2e/interface.mjs`: sem `?debug`, `#hud-info` vazio e escondido; o nome com
  opacidade 0 depois de 3 s.
- Fonte: PLAYTEST §3.2.

## Desempenho e plataforma

### R35 · A qualidade alta perde o antialias
- **Sintoma:** serrilhado na grama e no cabelo justamente na alta.
- **Causa (confirmada no código e em captura):** a cena é desenhada no alvo do `EffectComposer` (HalfFloat, 0
  samples); o MSAA do canvas só vale para o retângulo final.
- **Correção:** alvo da cena com `samples: 4` e canvas sem antialias na alta (`pos.ts`, `cena.ts`); a saída não
  troca os alvos, para a cena cair sempre no alvo com MSAA (R76). Estado: **corrigido** (L1b, `905172d`,
  `a031822`).
- **Teste que impede a volta:** `serrilhado.mjs` sem degraus na alta.
- Fonte: TECNICO_DESEMPENHO A1.

### R36 · `bloom.resolution` sem efeito (bloom em resolução cheia)
- **Sintoma:** 11 passes de tela e 2 alvos HalfFloat em tela cheia.
- **Causa (confirmada no código):** o `UnrealBloomPass` só lê `resolution` no construtor; o `composer.setSize` já
  tinha chamado `bloom.setSize` com o tamanho cheio.
- **Correção:** `bloom.setSize` a ¼ depois do `composer.setSize`. Estado: **em andamento** (L0, `pos.ts`).
- **Teste que impede a volta:** sonda (`medir.mjs cenas`): VRAM da alta ≤ 90 MB e tamanho dos alvos do bloom = ¼.
- Fonte: TECNICO_DESEMPENHO A2.

### R37 · Alta com 3× a memória de vídeo; a sombra redesenha a cena inteira
- **Sintoma:** ≈ 135–155 MB de VRAM estimada contra 48–59 MB no Normal; cap. 2 alta com 488 mil triângulos e 62
  chamadas.
- **Causa (confirmada por medida):** sombra 2048² com toda a cena projetando sombra (`cena.ts:108`), alvos HalfFloat
  de tela cheia, cadeia do bloom e MSAA do canvas que não é usado.
- **Correção:** sombra só dos dinâmicos (personagens e porteiras; o cenário fixo só recebe), 1024², câmera de sombra
  justa ao quadro visível (calculada a cada quadro no espaço da luz); alta com no máximo 0,8 Mpx internos; writeBuffer
  do compositor 1×1. Estado: **corrigido** (L1b, `84c336c`, `3d23276`, `a031822`). Efeito na imagem: R78.
- **Teste que impede a volta:** `medir.mjs cenas`: cap. 2 alta ≤ 80 chamadas e ≤ 300 mil triângulos; VRAM ≤ 90 MB.
- Fonte: TECNICO_DESEMPENHO A3/A4.

### R38 · Shaders compilados no meio do jogo
- **Sintoma:** engasgo quando aparece um efeito ou bichinho novo; de 8 a 10 programas compilados depois do 1º quadro
  por capítulo.
- **Causa (confirmada por medida):** compilação síncrona, `checkShaderErrors` ligado e sem `compileAsync`.
- **Correção:** `compileAsync` atrás da tela de carregamento (na alta, com o alvo do compositor ligado), Lança-Estrelas
  já presa na mão, quadro de aquecimento com a sombra cobrindo a fase, `checkShaderErrors` só no desenvolvimento.
  Estado: **corrigido** (L1b, `ebad74f`, `337cd60`; ver R75).
- **Teste que impede a volta:** `tools/revisao/l1/compilacoes.mjs` (sonda + a fase inteira dos bots): 0 compilações
  depois do 1º quadro nos 7 capítulos × 3 qualidades (medido).
- Fonte: TECNICO_DESEMPENHO A6.

### R39 · Sem limite de fps e sem pausa em segundo plano
- **Sintoma:** a tela de 90 Hz do Redmi desenha até 90 quadros para uma simulação de 60 Hz (1 em cada 3 quadros
  repete o estado); a música continua com o app escondido (no Android isso é **hipótese**).
- **Causa (confirmada no código):** `requestAnimationFrame` direto, sem `visibilitychange`.
- **Correção:** limitador por relógio-alvo (60 e 30 no modo economia), suspender música e `AudioContext`. Estado:
  **corrigido** (L1a, `86b3c66`: `src/ui/ritmo.ts`, economia com `?fps=30`; `58ccd30`: música e `AudioContext`
  suspensos em segundo plano; a pausa não redesenha a cena, `ab17eda`).
- **Teste que impede a volta:** `test/ritmo.test.ts`: rAF a 90, 120 e 144 Hz ⇒ 58–60 quadros/s; a 60 Hz nenhum
  pulado; economia 30. A sonda no navegador não serve (sem GPU a página roda a 3–4 fps).
- Fonte: TECNICO_DESEMPENHO A7.

### R40 · A resolução dinâmica cai à metade no Modo de Pouca Energia do iPhone
- **Sintoma:** imagem borrada sem ganho nenhum.
- **Causa (confirmada na lógica):** `cena.ts:238–240` lê < 40 fps como aparelho fraco, mas o iOS limita a 30 fps no
  modo de pouca energia (comportamento documentado da plataforma).
- **Correção:** governo de qualidade por tempo de quadro, com detecção do teto de 30 fps do sistema. Estado:
  **planejado** (L13).
- **Teste que impede a volta:** `teste_governo.mts` no `npm test` (intervalos presos em 33,3 ms com CPU folgada ⇒
  não rebaixa).
- Fonte: TECNICO_DESEMPENHO A8 e §12.

### R41 · Service worker: música fora do cache e arquivos que nunca se atualizam
- **Sintoma:** 1 MB de música baixado de novo a cada sessão; arte velha depois de uma atualização; o cache cresce a
  cada versão.
- **Causa (confirmada no código):** `sw.js:12` ignora pedidos com `Range` (o `<audio>` sempre pede assim); cache de
  nome fixo `edm-v2`; `activate` não apaga os `index-*.js` velhos.
- **Correção:** SW gerado no build com precache por hash, `Range` a partir do cache e navegação com prazo de 3 s.
  Estado: **planejado** (L13).
- **Teste que impede a volta:** CDP: 0 bytes de música da rede na 2ª sessão; um WebP trocado chega na próxima
  abertura.
- Fonte: TECNICO_DESEMPENHO A10.

### R42 · Arena: 4,3 MB de GLB baixados na hora mais emocionante
- **Sintoma:** espera longa no 4G ao entrar na arena.
- **Causa (confirmada por medida):** GLB sem compressão e sem pré-carga.
- **Correção:** meshopt (1,6 MB, −62 %, medido) e pré-carga durante o cap. 7. Estado: **planejado** (L14, equipe da
  arena).
- **Teste que impede a volta:** GLB da arena ≤ 1,7 MB; arena pronta ≤ 1 s depois da fuga em 4G simulado.
- Fonte: TECNICO_DESEMPENHO A11.

### R43 · Perda de pacote congela o convidado (canal confiável e ordenado)
- **Sintoma:** com 150 ms e 3 % de perda, o desvio p95 da posição mostrada vai a 0,9 m e a reação ao pulo a 707 ms.
- **Causa:** **confirmada no código** (`reliable: true`, `rede.ts:172`); o efeito real do SCTP é **hipótese**, porque
  foi medido com um modelo.
- **Correção:** instantâneos e entradas num canal não confiável, eventos com confirmação, buffer adaptativo. Estado:
  **planejado** (L13).
- **Teste que impede a volta:** `medir.mjs rede` com 3 % de perda: nenhum congelamento > 150 ms.
- Fonte: TECNICO_DESEMPENHO A12 e §10.

### R44 · Eventos sem som e o primeiro som atrasado
- **Sintoma:** 20 tipos de evento mudos (o pisão inclusive); sem tremida de câmera; o primeiro pulo e o primeiro tiro
  de cada sessão saem sem som.
- **Causa (confirmada no código):** não há efeito ligado a esses eventos em `som.ts`; cada efeito é baixado na
  primeira vez (`som.ts:50/68`).
- **Correção:** sons sintetizados em WebAudio, pré-carga ao entrar na fase, volume separado de música e efeitos.
  Estado: **planejado** (L8b).
- **Teste que impede a volta:** teste de dados: todo evento da lista da PLAYTEST §4.2 tem som; e2e: o primeiro pulo tem
  som.
- Fonte: PLAYTEST §4.2; TECNICO_DESEMPENHO §7.

### R45 · O mapa baixa 2,8 MB para miniaturas de 70 px
- **Sintoma:** peso alto numa tela de menu.
- **Causa (confirmada):** `telas.ts:91` usa as pinturas inteiras (229–310 KB cada).
- **Correção:** miniaturas WebP de ≈ 10 KB. Estado: **planejado** (L13).
- **Teste que impede a volta:** o mapa baixa ≤ 400 KB além da música (`telas.mjs`).
- Fonte: PLAYTEST §5.2.

### R46 · Três estrelas grandes com 36 de 38
- **Sintoma:** quem quer completar não sabe que faltou algo, nem onde.
- **Causa (confirmada):** `telas.ts:152` arredonda.
- **Correção:** a 3ª estrela só com 100 % (união das passadas), e a tela de concluído diz o que falta. Estado:
  **planejado** (L11).
- **Teste que impede a volta:** vitest da progressão (36/38 ⇒ 2 estrelas).
- Fonte: PLAYTEST §4.3; PLANO C15.

### R47 · Rótulos "Natan"/"Bruna" sobrepostos
- **Sintoma:** lado a lado, viram "BrunaNatan".
- **Causa (confirmada nas capturas):** sprites sem desvio vertical nem teste de proximidade.
- **Correção:** afastar na vertical ou esconder a menos de 1 m. Estado: **planejado** (L5).
- **Teste que impede a volta:** captura antes/depois (figura 04 do playtest) e teste de retângulos sem interseção.
- Fonte: PLAYTEST §3.3.

## História, casal e privacidade

### R48 · O casal não fala nem tem gestos durante as fases
- **Sintoma:** a história só aparece nos quadrinhos; dois a quatro minutos de fase sem uma palavra; a Dona Lume só no
  prólogo; nenhum abraço, beijo ou dança.
- **Causa (confirmada no código):** todo o texto está em `historia.ts`; as mãos dadas são só mecânica.
- **Correção:** balões, roteiro, emotes, convites e momentos por capítulo. Estado: **planejado** (L8 na fatia; L10
  nos outros).
- **Teste que impede a volta:** T-R2 (≥ 1 momento emocionante, 1 engraçado e 1 segredo por capítulo), T-R3
  (equilíbrio de voz).
- Fonte: NARRATIVA_CASAL §0–1.

### R49 · Detalhes íntimos ficariam legíveis no site público
- **Sintoma:** qualquer texto do repositório vai legível no pacote JS publicado em `github.io`.
- **Causa (confirmada):** o site e o repositório são públicos.
- **Correção:** `[REAL]` cifrados em `public/cartas.bin` (AES-GCM/PBKDF2), com o texto original fora do git; guia de
  segredos em `.segredos/` (no `.gitignore`). Estado: **planejado** (L11 e L12).
- **Teste que impede a volta:** T-C1 (`grep` no `dist/` não acha o texto original) e T-R4 (0 "te amo" em texto
  claro).
- Fonte: NARRATIVA_CASAL §10.3; PEDIDOS_JOGADOR_2.

### R50 · O som do pulo durava 1 s
- **Sintoma:** pulo com som "estranho" (queixa do jogador).
- **Causa (confirmada):** `sfx_pulo.mp3` genérico de 1 s.
- **Correção:** "puín" sintetizado de 0,16 s (0,26 s no superpulo), Natan mais grave e Bruna mais aguda. Estado:
  **corrigido** (`28b64c5`). Os outros efeitos de 1 s entram no R44.
- **Teste que impede a volta:** proposta: teste de dados com a duração dos efeitos de ação ≤ 0,4 s.
- Fonte: PEDIDOS_JOGADOR_2.

## Processo, ferramentas e lições

### R51 · Créditos gastos sem confirmação direta do responsável
- **Sintoma:** 14 créditos Higgsfield (7 alvos visuais; saldo de 249,63 para 235,63) gastos com base no teto da tarefa
  do workflow e numa autorização anterior, sem confirmação nesta sessão.
- **Causa (confirmada):** o teto veio do texto da tarefa, não do responsável.
- **Correção:** a autorização é pedida **por lote**, com teto (PLANO §8), e registrada em `docs/arte/RECURSOS.md`
  antes de gerar. Estado: **lição**.
- **Teste que impede a volta:** revisão do diretor; nenhum job sem linha correspondente em RECURSOS.md com a
  autorização citada.
- Fonte: ARTE_DIAGNOSTICO §5.

### R52 · Capturas não reprodutíveis
- **Sintoma:** o tick da foto variava 856/1023/1298 entre execuções; o personagem sumia em fotos de 20 m.
- **Causa (confirmada):** o relógio corria no tempo real sem `pauseAt`; o personagem pisca quando está invencível
  (`personagem.ts:596`).
- **Correção:** relógio falso parado (`capturas.mjs`); a ferramenta de câmera zera a invencibilidade antes da foto.
  Estado: **corrigido nas ferramentas**.
- **Teste que impede a volta:** duas execuções dão imagens idênticas ou com PSNR ≥ 48 dB (as partículas usam
  `Math.random` no render).
- Fonte: ARTE_DIAGNOSTICO §1; PESQUISA_ARTE_CAMERA §5.

### R53 · Foto preta no SwiftShader
- **Sintoma:** ≈ 7 % das fotos saíam pretas depois da troca de tamanho.
- **Causa (hipótese):** falha do SwiftShader ao redimensionar o contexto.
- **Correção:** a ferramenta detecta e redesenha até 5 vezes (fica em `capturas.json › erros`). Estado: **contornado**.
- **Teste que impede a volta:** a própria ferramenta registra.
- Fonte: ARTE_DIAGNOSTICO §1.

### R54 · O gancho de teste `__edm` prende a última partida na memória
- **Sintoma:** ≈ 4,5 MB de heap sobram depois de sair da fase (não acumula).
- **Causa (confirmada):** `window.__edm` fecha sobre `this` (`partida.ts:77`).
- **Correção:** o gancho só existe com `?teste`/`?debug` em produção. Os e2e passam o parâmetro. Estado:
  **planejado** (L13).
- **Teste que impede a volta:** e2e sem o parâmetro: `window.__edm === undefined`; heap de volta ao mapa ≤ heap
  inicial + 1 MB.
- Fonte: TECNICO_DESEMPENHO §4.

### R55 · Modelo exato do "Redmi Note 11" é incerto
- **Sintoma:** os documentos citavam a GPU Mali-G57; o Note 11 global usa Snapdragon 680 / Adreno 610.
- **Causa:** **hipótese** sobre o aparelho do jogador.
- **Correção:** o painel `?diag=1` (`src/ui/diag.ts`) lê a GPU real (`WEBGL_debug_renderer_info`). Estado: **em
  andamento** (painel pronto, `bf0d8c5`; falta o relatório dos dois aparelhos, mandado pelo Natan).
- **Teste que impede a volta:** relatório do aparelho anexado ao L1.
- Fonte: PESQUISA_ARTE_CAMERA §4; TECNICO_DESEMPENHO §1.

### R56 · Lição: os poderes da Arena não podem simplesmente sumir
- **Sintoma (risco):** trocar os poderes por armas desbalancearia a luta.
- **Causa (confirmada por medida):** os poderes fazem 41–45 % do dano no Rei e são o único jeito de quebrar o escudo
  da fase 2 (15–17 vezes por luta).
- **Correção:** troca de pele com os mesmos números e eventos. Estado: **lição** (L14).
- **Teste que impede a volta:** A7 (`test/arena*.test.ts` sem alteração; `medir_armas.ts` com as mesmas porcentagens).
- Fonte: DESIGN_ARMAS §1.2 e §9.

### R57 · Arquivos de outra equipe na pasta de imagens
- **Sintoma:** três imagens que não eram da narrativa (atual, fundo, proposto) foram copiadas para
  `img/narrativa-casal/` a partir da pasta compartilhada do scratchpad.
- **Causa (confirmada):** pasta temporária compartilhada entre agentes.
- **Correção:** removidas. **Regra:** cada agente usa uma subpasta própria no scratchpad e na worktree. Estado:
  **lição**.
- **Teste que impede a volta:** revisão do diretor no fechamento de cada lote (`git status` só com os arquivos do
  lote).
- Fonte: NARRATIVA_CASAL (resumo da entrega).

### R58 · Constantes do material do mundo viram programas de shader extras
- **Sintoma:** de 2 a 4 programas a mais por capítulo.
- **Causa (confirmada no código):** `escalaRuido` e `forcaRuido` são escritas no código do shader e entram na
  `customProgramCacheKey` (`materiais.ts:57,67`).
- **Correção:** `uEscRuido`/`uForcaRuido` por material, fora da chave do programa. Estado: **corrigido** (L1b,
  `5e078d5`).
- **Teste que impede a volta:** sonda: programas ≤ orçamento (Leve ≤ 26, Normal ≤ 32, Bonito ≤ 38).
- Fonte: TECNICO_DESEMPENHO §4.

### R59 · Montar o grafo de alcance no celular seria lento demais
- **Sintoma (risco):** o companheiro precisa do grafo para navegar.
- **Causa:** **confirmada no PC** (até 3,0 s no cap. 3: 303 nós e 155 mil saltos simulados); no celular é **hipótese**
  (3–10×).
- **Correção:** mapa de apoio gerado no build (`tools/gerar_apoio.ts` → `apoio/capN.json` com `hashFase`). Estado:
  **corrigido** (L2a, `7703f7c`): `npm run apoio` grava os 7 mapas (4,3–60 KB em listas curtas; o cap. 3 tem 303 nós
  e 5 027 ligações) e o companheiro carrega com `carregarApoio(n)` (import dinâmico, um pedaço por capítulo).
- **Teste que impede a volta:** T14 (`test/apoio.test.ts`): o hash confere, o json gravado é idêntico ao que o
  gerador monta hoje (pega mudança de física e de colisão, não só de fase), todo PontoCoop cobre uma ligação de ajuda
  e toda ajuda do caminho mínimo tem PontoCoop; um controle prova que fase mudada, papel fora do lugar e ponto apagado
  reprovam. **Regra:** mudou fase, física, colisão ou o campo `apoio`? `npm run apoio`.
- Fonte: ARQUITETURA_MODOS §2.3.

### R60 · Toques curtos podem se perder com quadros longos
- **Sintoma (risco):** um toque que começa e termina entre dois quadros não vira pulo.
- **Causa (hipótese):** `controles.ts` só guarda "está apertado agora"; a arena guarda o toque (`pego`). No Chromium,
  12 de 12 toques funcionaram.
- **Correção:** guardar o toque como na arena. Estado: **planejado** (L5).
- **Teste que impede a volta:** com quadros de 100 ms, 12/12 toques curtos viram pulo.
- Fonte: PLAYTEST §2.5.

### R61 · Lição: no Meshy, texto→3D sai bem pior que imagem→3D
- **Sintoma:** cogumelo gigante, castelo de doces, cristais e ilha flutuante saíram "fracos" (sem cor, facetados,
  escuros).
- **Causa (confirmada na avaliação de `RECURSOS.md`):** geração por texto.
- **Correção:** sempre gerar antes a imagem no estilo de `conceito.png` e depois imagem→3D. Estado: **lição** (regra
  do PLANO §8).
- **Teste que impede a volta:** revisão de arte antes de integrar (retrato lado a lado com a imagem de referência).
- Fonte: docs/arte/RECURSOS.md.

### R62 · Lição: "o bot não terminou" não prova que uma pessoa não termine
- **Sintoma (risco de leitura errada):** os bots sem tiro não fecham os caps. 3, 5 e 7.
- **Causa (confirmada):** os bots são roteirizados e não desviam.
- **Correção:** usar o bot como **detector de parede** (onde a munição finita vira bloqueio) e confirmar a causa pela
  geometria ou pelo código antes de mudar a fase. Estado: **lição**.
- **Teste que impede a volta:** A3 lê os dados (combate forçado) além do resultado dos bots.
- Fonte: DESIGN_ARMAS §1.2 e §14.

### R63 · Lição: ACES e AgX pioram este estilo; baixar a luz só escurece
- **Sintoma (tentação):** trocar a curva de tons ou baixar a exposição para "tirar o branco".
- **Causa (confirmada por experimento):** com ACES, L\* 55,1 e saturação −0,13; com AgX, saturação 0,349. Com
  exposição 0,85 ou hemisférica × 0,6, a imagem só escurece (−3 L\*) sem devolver a cor.
- **Correção:** manter a curva Neutral; o conserto de cor é bloom, paleta e rampa de toon. Estado: **lição**.
- **Teste que impede a volta:** faixas de saturação da §5.3 do PLANO no `comparar.mjs`.
- Fonte: ARTE_DIAGNOSTICO §3 (e06–e09).

### R64 · Lição: mudar o núcleo muda os pontos das capturas
- **Sintoma (risco):** comparar "p012" antes e depois de mudar a física ou as fases compara lugares diferentes.
- **Causa (confirmada):** as capturas reproduzem as entradas dos bots gravadas com o núcleo da própria cópia.
- **Correção:** com mudança no núcleo, comparar por tick absoluto e posição, ou gravar as entradas com o núcleo do
  "antes" e reproduzir nos dois (PLANO §5.1). A linha de base B0 é refeita depois do Lote 0 de física. Estado:
  **lição**.
- **Teste que impede a volta:** o relatório de cada lote cita o commit do núcleo usado para gravar as entradas.
- Fonte: ARTE_DIAGNOSTICO §1 (limites).

## QA do Lote 0 (integração, 2026-11-24)

Entradas do QA e integrador do Lote 0 (base `e9cd8ae`, os 4 agentes já commitados). Relatório: `docs/revisao/lote0/RELATORIO.md`.

### R65 · Quadrado claro em volta das estrelinhas na alta
- **Sintoma:** na qualidade alta, um quadrado mais claro e borrado aparece em volta de faíscas e vaga-lumes quando eles
  passam na frente de um fundo claro. Na captura do cap. 3 (p012, estrelinha sobre o mostrador grande), o quadrado
  aparece bem nítido. Não acontece na média nem na baixa, que não têm brilho.
- **Causa (confirmada no código e por captura):** o brilho seletivo (`pos.ts`, commit `56027a0`) só deixa florescer
  pixels com alfa > 1,5 no alvo HalfFloat. Em `particulas.ts` (lote aditivo) e `efeitos.ts` (vaga-lumes) a cor já
  vinha multiplicada pela forma, mas o alfa era a constante **1,0** no quadrado inteiro, com `AdditiveBlending`
  (alfa: src·src + dst). Sobre o fundo opaco (alfa 1), o quadrado todo ia para 2 e ficava marcado.
- **Correção:** `CustomBlending` com cor 1·src + 1·dst (a cor não muda) e alfa 1·src + 1·dst, com alfa = 1,5 ×
  a forma da textura. Assim só a forma da partícula marca o brilho. Estado: **corrigido** (`4cab0bf`).
- **Teste que impede a volta:** `test/render_brilho.test.ts`, que falha com o código antigo (2/2) e confere o modo de
  mistura e que o alfa depende da textura. Comparação: `docs/revisao/lote0/qa/r65_quadrado_antes_depois.webp`.
- Fonte: QA do Lote 0, a partir das capturas `capturas.mjs`.

### R66 · Câmera nova deixa o parceiro fora do quadro com 4–5 m de desnível
- **Sintoma:** no cap. 6 (dois corredores, y 0 e y 5), com o Natan em cima e a Bruna 4,6 m abaixo e 3,9 m ao lado,
  a câmera do Natan mostra só o nome da Bruna na borda de baixo. Na câmera antiga ela aparecia inteira.
- **Causa (confirmada no código e por teste):** em `camera.ts` (`47d08a3`) o centro vertical ao enquadrar os dois era
  `aE + limitar(dy/2, ±1,5)`. Com os pés a 30 % da tela e o afastamento no teto (personagem a 15 %), sobram só
  0,3 × 7,3 m = 2,2 m abaixo do centro, e o parceiro 4,6 m abaixo não cabia. Os dois **cabiam** se o centro descesse.
- **Correção:** com o afastamento já calculado, o y desliza até a faixa em que os dois cabem, se ela existir
  (`fyMin ≤ fyMax`). O resto da câmera não muda: os 12 testes de `camera.test.ts` passam, incluindo a faixa de
  21–25 % nos quadros normais. O desnível em que a câmera ainda enquadra os dois subiu de 4,5 para 5,2 m (`pertoY`;
  `longeY` de 6 para 6,5), porque os corredores do cap. 6 ficam a 5 m: no p05, com a Bruna 5 m acima, ela também
  ficava fora do quadro. Estado: **corrigido** (`2bd4b8b`, `5a923d4`). Imagens:
  `docs/revisao/lote0/qa/r66_cap6_antes_depois_corrigido.webp` (antes, depois do lote e depois da correção do
  desnível 4,6 m) e as folhas `qa/*_p05.webp` (cap. 6, com o desnível de 5 m).
- **Teste que impede a volta:** `camera.test.ts` › "R66 · parceiro 4–5 m abaixo ou acima…", com 6 casos × 2 telas.
  Ele falha com o código antigo (dx 4, dy −4,6).
- Fonte: QA do Lote 0 (captura do cap. 6, p012).

### R67 · e2e "P2 andou no anfitrião" reprovava sem GPU com a máquina carregada
- **Sintoma:** `dupla.mjs` reprovava com `3,00 → 5,60` (pedia > 3 m) em 2 de 3 rodadas. O `f362fe6` passava na
  mesma carga, com o anfitrião a 6 fps contra 3 fps.
- **Causa (confirmada pela conta):** cada quadro do laço anda no máximo 0,1 s de jogo (`partida.ts`). A 3 fps, 1,6 s
  reais viram cerca de 0,5 s de jogo, e 5,2 m/s × 0,5 s = 2,6 m. O teste media a distância em tempo real. Não é
  defeito do jogo.
- **Correção:** a distância esperada agora é medida em ticks de jogo (≥ 60 % de 5,2 m/s × ticks com a tecla, no
  máximo 3 m). Estado: **corrigido** (`1ad5dfc`).
- **Teste que impede a volta:** o próprio `dupla.mjs`. Na tela de partida, o fps do anfitrião sai em `HUD A`.
- Fonte: QA do Lote 0.

### R68 · e2e "convidado em sincronia" pega 1,30 m de vez em quando (antes do Lote 0 também)
- **Sintoma:** `capitulos.mjs dupla` reprova às vezes em um capítulo com "maior desvio 1,30 m" (cap. 5 numa rodada,
  cap. 6 noutra). Nas outras rodadas o mesmo capítulo fica em 0,07–0,09 m.
- **Causa (hipótese, não confirmada):** a medida compara o que o convidado mostra com a história do anfitrião nos
  ticks [t−24, t+3]. Com quadros longos (sem GPU e com a máquina carregada) e ACEL 6, os instantâneos chegam em rajadas
  e o convidado interpola entre dois que estão a mais de 24 ticks um do outro. O valor 1,30 m também apareceu no
  `f362fe6`, rodado limpo e na mesma carga (cap. 6), então o problema já existia antes do Lote 0. Não é o teleporte
  R20: a busca de saltos de 0,4–3 m em 1 tick nos 7 planos não acha nada no cap. 6. Uma rodada instrumentada dos
  caps. 1–6 não reproduziu.
- **Correção:** nenhuma ainda. A proposta é o convidado expor o intervalo de ticks que está interpolando
  (`a.tick`–`b.tick`) e a medida usar esse intervalo. Estado: **planejado**: precisa de um gancho em `partida.ts`
  (L1a/L3b).
- **Teste que impede a volta:** quando o gancho existir, o próprio `capitulos.mjs dupla` com o intervalo real.
- Fonte: QA do Lote 0. Rodadas: HEAD 1/3 reprovada com 1,30 m (cap. 5), 1/3 com 1,30 m (cap. 6) e 1/3 em que caiu
  a conexão; caps. 1–6 instrumentados 0,02–0,09 m; `f362fe6`, cap. 6 com 1,30 m.

### R69 · Conexão perdida no meio do cap. 2 do e2e com a máquina sobrecarregada
- **Sintoma:** uma rodada de `capitulos.mjs dupla` mostrou "Conexão perdida" no cap. 2, ao mesmo tempo em que
  rodavam o vitest e as capturas (carga > 8 em 4 núcleos).
- **Causa (hipótese):** `PRAZO_SILENCIO` = 7 s em `rede.ts`. Uma aba que fica parada mais de 7 s (SwiftShader
  sobrecarregado) é tratada como queda. Não se repetiu com a máquina só para o e2e.
- **Correção:** nenhuma. É limite do ambiente de teste. Estado: **lição**: os e2e de dupla rodam sozinhos na
  máquina, sem capturas nem vitest em paralelo.
- **Teste que impede a volta:** —
- Fonte: QA do Lote 0.

### R70 · Lição: o "antes" do QA usa o núcleo do "depois"
- **Sintoma (risco):** comparar a arte e a câmera do `f362fe6` com o HEAD pelos pontos dos bots compara lugares
  diferentes, porque o Lote 0 mudou a física e as fases (R64).
- **Correção:** o worktree "antes" é o `f362fe6` com `src/core` e `test/fases` do HEAD (`git checkout e9cd8ae --
  src/core test/fases`). As posições dos dois jogadores ficaram iguais em 83 das 84 capturas (uma difere 0,02 m). O
  tick da foto varia em até 29, mas só com os jogadores parados no fim do roteiro. Estado: **lição**.
- **Teste que impede a volta:** `RELATORIO.md` cita o commit do núcleo usado e a lista de posições
  (`capturas.json`).
- Fonte: QA do Lote 0.

## Núcleo, Lote L2a (2026-11-24)

### R71 · Estrelinha do relógio de dois ponteiros (cap. 3 #24) com janela de 0,1 m a partir do chão fixo
- **Sintoma:** a janela de decolagem (`test/fases/janela.ts`, no `npm run test:lento`) mede 0,1 m (0,62 m com o pulo
  tardio do coyote) para a estrelinha #24 (114; 4), abaixo do mínimo de 0,4 m (0,9 m com o coyote).
- **Causa (confirmada pela geometria; hipótese quanto ao jogador):** ela fica no alto do relógio de dois ponteiros
  (centro 114; 1,6, raio 2,2) e o caminho pensado é subir no ponteiro. A ferramenta só conta pulos de chão fixo, e o
  pulo do chão que também a pega é um acaso de 0,1 m. Se a busca completa (que usa os ponteiros) a pega com folga
  alta, não há defeito. Não há relato do jogador sobre esta estrelinha.
- **Correção:** nenhuma na fase. Fica como exceção nomeada (`JANELA_EXCECOES` em `test/lento/comum.ts`); a folga ≥ 100
  da busca completa continua exigida nela. Estado: **lição** (a janela de chão fixo não vale para estrelinha de
  plataforma especial). Revisitar no R3 (L10), com o trecho do cap. 3.
- **Teste que impede a volta:** `npm run test:lento` (folga e janela por capítulo).
- Fonte: L2a, medida de `tools/revisao/l2a/rodar.sh janela 3`.

### R72 · Os abismos do Fio Vermelho também se atravessam de mãos dadas
- **Sintoma:** no mapa de apoio, o caminho mínimo dos caps. 2 e 4 não usa o fio: os pontos de cooperação dos dois
  abismos do cap. 2 e da jangada do cap. 4 são impulso + puxar (superpulo de mãos dadas por cima do vão); só o cap. 7
  tem um ponto de fio (a ilha alta).
- **Causa (confirmada no grafo, que voa com a física real):** o superpulo vence 5,6 m correndo no mesmo nível e mais
  descendo; os abismos de 6,2 m (R14) têm o outro lado 3 m mais baixo. Com o parceiro do outro lado puxando, ou dando
  impulso antes, a ligação `super` existe. O ARQUITETURA_MODOS §2.1 já notava que "o grafo prefere mãos dadas ao fio".
- **Correção:** nenhuma no núcleo. É decisão de design (o fio é a novidade do cap. 2): ou se aceita o atalho de mãos
  dadas, ou o abismo cresce até o superpulo não passar (rodar a busca de novo, R14). Para o companheiro (L6), o mapa
  traz as duas ligações e os pontos `cap2:abismo*` são de mãos dadas. Estado: **planejado** (decisão no R2/L10).
- **Teste que impede a volta:** T14 mostra os pontos gerados; se o abismo mudar, `npm run apoio` e o T14 acusam.
- Fonte: L2a, `npm run apoio`.


## Lote L1 (interface, rede e render técnico, 2026-11-24)

### R73 · Lição: no CDP, o `touchEnd` leva só o dedo que sai
- **Sintoma:** no playtest de toque, "Continuar com o dedo no joystick" falhava e o joystick "soltava" sozinho.
- **Causa (confirmada no Chromium):** `Input.dispatchTouchEvent` com `touchEnd` solta os pontos LISTADOS. A classe
  `Toque` do playtester mandava a lista dos dedos que ficavam: soltava o polegar do joystick e o dedo do botão nunca
  recebia `pointerup`. As medidas antigas de `continuarComDedoNoJoystick` (PLAYTEST §2.2) mediam isso, não o jogo.
- **Correção:** `soltar(id)` manda só o dedo que sai (`tools/revisao/playtester/comum.mjs`, `test/e2e/interface.mjs`).
  Estado: **corrigido** (`0bc19fe`).
- **Teste que impede a volta:** `test/e2e/interface.mjs` (joystick segurado do começo ao fim do teste de pausa).
- Fonte: L1.

### R74 · Lição: `Page.setWebLifecycleState: frozen` não congela uma página visível
- **Sintoma:** com o convidado "congelado", o anfitrião continuava recebendo ~6 mensagens/s.
- **Causa (confirmada por medida):** o CDP não congela a página que está visível; o convidado seguia mandando as
  entradas (o joystick segurado). A medida do PLAYTEST §2.1 (`vxBruna = −5,2` "congelado") não distinguia isso; a
  causa do R26 continua confirmada pelo código.
- **Correção:** o e2e simula a página congelada cortando o que o convidado manda (`RTCDataChannel.send` vazio), que é
  o que o anfitrião vê. Estado: **corrigido** (`c80ff3f`).
- **Teste que impede a volta:** `test/e2e/interface.mjs` (dupla).
- Fonte: L1.

### R75 · `compileAsync` da alta compilava programas que o jogo não usava
- **Sintoma:** depois do `compileAsync`, a alta ainda compilava 13 programas no meio da fase; a média, 2.
- **Causa (confirmada pelas chaves dos programas):** (1) compilado sem o alvo do compositor, o programa saía em sRGB
  com curva de tons; no jogo a cena vai para o alvo em espaço linear sem curva (outra chave); (2) a Lança-Estrelas só
  entrava na cena no 1º tiro; (3) com a sombra justa, o programa de profundidade da porteira só compilava quando ela
  entrava no quadro.
- **Correção:** compilar com `setRenderTarget(alvo da cena)`, Lança-Estrelas presa (invisível) na mão desde a criação,
  quadro de aquecimento com a câmera de sombra cobrindo a fase. Estado: **corrigido** (`ebad74f`, `337cd60`).
- **Teste que impede a volta:** `tools/revisao/l1/compilacoes.mjs`: 0 compilações depois do 1º quadro.
- Fonte: L1.

### R76 · Na alta, um quadro sim e outro não ia para o alvo sem MSAA
- **Sintoma (risco medido nas chamadas):** ao deixar só um alvo do compositor com MSAA, a cena aparecia em branco a
  cada quadro trocado.
- **Causa (confirmada no código do three r187):** o `OutputPass` tem `needsSwap = true`; o `EffectComposer` troca
  `readBuffer`/`writeBuffer` depois dele a cada quadro, e o `RenderPass` desenha no `readBuffer`. Com os dois alvos
  iguais isso só gastava memória (dois alvos de tela cheia com MSAA).
- **Correção:** `needsSwap = false` na saída; a cena cai sempre no `readBuffer` (MSAA 4×); o `writeBuffer` fica 1×1
  sem amostras. Estado: **corrigido** (`a031822`).
- **Teste que impede a volta:** `serrilhado.mjs` (alta sem degraus), capturas da alta e a VRAM medida pela sonda
  (`compilacoes.mjs`: renderbuffers de um alvo só).
- Fonte: L1.

### R77 · Confirmação por timer falhava com quadros longos; clique fantasma na tela nova
- **Sintoma:** com a máquina carregada, o 2º toque em "Mapa da jornada" só pedia a confirmação de novo; depois de
  "Mapa da jornada", o clique de compatibilidade caía numa ilha do mapa.
- **Causa (confirmada no navegador):** (1) o estado "pedindo confirmação" dependia de um `setTimeout` de 3 s, e a pausa
  continuava redesenhando a cena (quadros de 1–3 s sem GPU), atrasando os eventos; (2) o navegador gera o `click` de
  compatibilidade depois do `pointerup` no que estiver embaixo do dedo na tela nova.
- **Correção:** confirmação pela hora do 1º toque; `preventDefault` no `touchend` do botão que já agiu; a pausa
  desenha a cena uma vez e para. Estado: **corrigido** (`ab17eda`).
- **Teste que impede a volta:** `test/e2e/interface.mjs` (o 2º toque sai; o 1º nunca).
- Fonte: L1.

### R78 · Sem a sombra do cenário fixo, a alta fica até 2,3 pontos de L\* mais clara
- **Sintoma:** nas capturas antes × depois (p012 e p05, 844×390@2), a alta sobe L\* de +0,4 a +2,3 (cap. 2 p012 e
  cap. 6) e a % de sombra cai 0,3–6,5 pontos; a média não muda (|ΔL\*| ≤ 0,1).
- **Causa (confirmada):** R37 tirou a sombra que o cenário fixo projetava nele mesmo (a correção pedida pelo plano). O
  aceite do L1b pede |ΔL\*| ≤ 1: os dois pedidos se chocam. Com a sombra só dos dinâmicos o cap. 2 alta fica em 297
  mil triângulos (teto 300 mil); devolver a sombra do cenário, mesmo com a câmera justa, redesenharia 2–3 pedaços de
  16 m do cenário no mapa de sombra (hipótese: passaria do teto; não medido).
- **Correção:** nenhuma no L1. Alta − média (§5.3: \|ΔL\*\| ≤ 3, Δsat ≥ −0,03) chega mais perto de 0 nos caps. 1,
  2 (p012: −2,2 → +0,1), 3 e 5, e se afasta nos caps. 4 (+2,0 → +2,9; Δsat −0,029 → −0,036), 6 (−0,8 → +1,1) e 7
  (p05 +4,4 → +5,1, que já passava do teto; Δsat −0,086 → −0,107). Escurecer o pé das paredes e o chão sob as copas na
  oclusão assada (`cenario.ts`) é do L7. Estado: **planejado** (L7).
- **Teste que impede a volta:** `comparar.mjs` alta × média e alta antes × depois no L7.
- Fonte: L1.
