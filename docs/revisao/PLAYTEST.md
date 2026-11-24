# Playtest independente e UX móvel — Entre Dois Mundos

Autor: playtester (revisão geral, etapa de diagnóstico; 2026-11-24). Versão jogada: `cd6159b` (worktree própria,
servidor de desenvolvimento do Vite, sem alterar `src/`). Aparelhos simulados no Playwright (Chromium 153, sem GPU):

| Perfil | Viewport CSS | Área segura | Por quê |
|---|---|---|---|
| **iPhone 14, app na tela inicial** | 844×390 | 47 px esquerda/direita, 21 px embaixo (`Emulation.setSafeAreaInsetsOverride`) | Bruna |
| **iPhone 14 no Safari** | 844×340 | idem | o iPhone não tem Fullscreen API: a barra do Safari fica [altura de 340 px = hipótese; conferir no aparelho] |
| **Pixel/Redmi** | 915×412 | — | Android em tela cheia |

Toques **de verdade** (CDP `Input.dispatchTouchEvent`, vários dedos ao mesmo tempo): joystick arrastado, ⬆, ✨, ✋,
❚❚, ⇄, botões das telas. Jogados: menu, sala (servidor PeerJS público e local), prólogo, mapa, capítulos 1, 2, 3 e
7, pausa, capítulo concluído, lembrança, e uma partida em **dupla** (iPhone anfitrião × Android convidado).
Os ganchos `window.__edm` / `__edmFluxo` foram usados para ler o estado e para levar a partida a pontos fixos
(entradas gravadas dos bots). Limites: fps aqui não vale (3–8 fps no SwiftShader); a simulação foi medida em
**ticks**, não em segundos reais; som, vibração e calor não podem ser ouvidos/sentidos aqui.

Este documento evita repetir o que o jogador já disse (esbranquiçado, poderes → armas, estrelas inalcançáveis, modo
solo) e o que as outras equipes já cobriram em `ARTE_DIAGNOSTICO.md`, `AUDITORIA_MOVIMENTO.md`, `DESIGN_ARMAS.md`,
`ARQUITETURA_MODOS.md`, `NARRATIVA_CASAL.md` e `PESQUISA_ARTE_CAMERA.md`. Onde toca nesses assuntos, traz medida nova.

---

## 0. Resumo (o que mais pesa para o casal)

1. **[Crítico] O celular do convidado vai para segundo plano e a Bruna continua andando.** Com o dedo no joystick,
   congelei a página do convidado por 180 ticks (3 s de jogo): no anfitrião a Bruna seguiu com `vx = −5,2 m/s` o
   tempo todo, sem pausa e sem aviso (§2.1). Uma notificação do WhatsApp derruba a Bruna num vão.
2. **[Alto] Com o polegar no joystick, ❚❚ não pausa** (e ⇄, Continuar e todos os botões de tela também não):
   eles usam `onclick`, e o navegador não gera `click` num toque com outro dedo encostado. Medido: 0 de 1
   tentativas nos dois aparelhos; só funciona soltando o joystick (§2.2).
3. **[Alto] Os controles tapam o lugar onde o jogo acontece.** Projetando a câmera real sobre os retângulos dos
   botões: uma estrelinha visível passa **15–28 %** do tempo atrás de um controle ou do HUD, e um bichinho visível,
   **19–56 %** (pior: Android, capítulo 1). As placas de pressão ficam no chão da frente, sob o joystick; no fio do
   capítulo 2 a beirada de pouso e duas estrelinhas estão sob ✋/⬆ (§3.1, figuras 02 e 03).
4. **[Alto] O jogo não ensina nada dentro da fase.** O `#aviso` só é usado na arena; no 2.5D não existe uma única
   dica, seta ou ícone de contexto (mãos dadas, ancorar o fio, placa↔porta). A única explicação é uma linha de 13 px
   no mapa ("Novidade: …") (§4.1).
5. **[Alto, iPhone] No Safari o jogo perde ~50 px de altura e nunca fica em tela cheia**; nada na tela diz à Bruna
   para "Adicionar à Tela de Início" (só o README diz) (§3.4, figura 06).
6. **[Alto] "Sair" e "Mapa da jornada" encerram a fase (e a sala, no caso de ✕/Sair) sem perguntar.** "Mapa da
   jornada" fica 8 px abaixo de "Continuar" (§2.3).
7. **[Médio] Ao tocar em Jogar ▶ a tela congela sem nenhum retorno**: a fase é montada de forma síncrona dentro do
   toque. Aqui, 2,6–6,8 s de tarefa única (capítulo 2 na alta: 6,8 s); no celular será menor, mas sem tela de
   carregamento qualquer meio segundo parece travamento (§5.1).
8. **[Médio] O contador de fps aparece para o jogador** em todas as fases ("3 fps" na figura 01) (§3.2).

O que está bom e deve ser preservado está na §7.

---

## 1. Como reproduzir

Ferramentas em `tools/revisao/playtester/` (rodam numa cópia; sobem o Vite de desenvolvimento dela):

```sh
git -C /home/user/entre-dois-mundos worktree add <wt> HEAD && ln -s /home/user/entre-dois-mundos/node_modules <wt>/node_modules
node tools/revisao/playtester/telas.mjs    --raiz <wt> --aps iphone,iphoneSafari,android   # telas, letras, alvos, rede
node tools/revisao/playtester/jogo.mjs     --raiz <wt> --aps iphone,android --caps 1,2,3,7  # toque real + capturas com HUD
node tools/revisao/playtester/projecao.mjs --raiz <wt> --rects <saida>/jogo.json             # o que os controles tapam
node tools/revisao/playtester/carga.mjs    --raiz <wt> --caps 1,2,7 --q baixa,media,alta     # congelamento ao entrar
node tools/revisao/playtester/dupla.mjs    --raiz <wt>                                       # convidado em 2º plano, pausa
```

`comum.mjs` tem o toque multi-dedo (`Toque`), a área segura do iPhone e a auditoria de DOM (tamanho de letra,
alvos de toque, entalhe). Medidas brutas desta rodada: `tools/revisao/playtester/medidas/*.json`. Capturas
anotadas: `docs/revisao/img/playtester/` (contornos vermelhos = problema; faixas vermelhas nas laterais = entalhe,
laranja embaixo = barra de "home" do iPhone).

A projeção (`projecao.mjs`) refaz a câmera de `src/render/cena.ts` (fov 42°, `dist = clamp(6 + sep·0,9, 7,6, 22)`,
alvo acima do meio dos dois, `lerp dt·4`) e foi **validada** contra uma captura: no capítulo 1, tick 1002, previu
Natan em (452, 190) e Bruna em (393, 325); na figura 02 eles estão nesses pontos (±5 px).

---

## 2. Problemas de controle e fluxo (com passos para reproduzir)

### 2.1 [Crítico] Entrada do convidado "presa" quando o celular dele sai do jogo — confirmado
- **Passos:** dupla; no convidado, segure o joystick para um lado; troque de aplicativo (ou receba uma ligação).
- **Medido** (`dupla.mjs`, página do convidado congelada com `Page.setWebLifecycleState: frozen` por 180 ticks):
  `vxBruna = −5,2` (velocidade máxima) até o fim; `anfitriaoPausou: false`; `avisoConexao: false`.
- **Causa (código):** `src/ui/partida.ts:98` guarda a última entrada recebida (`entradaRemota`) e a reutiliza em
  todo tick, sem prazo; não há `visibilitychange`/`pagehide` em lugar nenhum de `src/` (grep vazio). O PeerJS só
  acusa queda bem depois (o canal continua aberto com a página congelada).
- **Correção sugerida:** (a) no convidado, `visibilitychange → hidden` manda `{t:'in', i: neutro}` e um pedido de
  pausa; (b) no anfitrião, entrada remota com mais de ~250 ms vira neutra e, com mais de ~2 s, pausa com
  "Bruna saiu do jogo — esperando voltar"; (c) o mesmo no anfitrião (se ele sair, o convidado vê "Natan saiu…").

### 2.2 [Alto] Não dá para pausar com o polegar no joystick — confirmado no Chromium (Android)
- **Passos:** fase qualquer; segure o joystick; toque em ❚❚ com a outra mão.
- **Medido** (`jogo.mjs`): `pausaComDedoNoJoystick: false` e `continuarComDedoNoJoystick: false` no iPhone e no
  Android simulados; soltando o joystick, o mesmo toque pausa.
- **Causa:** ❚❚, ⇄ e os botões das sobrepostas usam `onclick` (`src/main.ts:361-364`, `partida.ts` para ⇄); um
  toque com outro dedo já encostado não gera `click`. Os botões de jogo usam `pointerdown` e funcionam
  (multitoque joystick + ⬆ = 1 pulo com `vx = 5,2` no ar, correto).
- **No iPhone:** o Safari também não gera `click` em toques com mais de um dedo [hipótese forte; conferir no aparelho].
- **Correção:** `pointerdown`/`pointerup` com captura também em ❚❚, ⇄ e nos botões de pausa/concluído/mapa.
- **Efeito colateral medido:** se o polegar volta ao joystick **durante** a pausa, o toque cai na sobreposta; ao
  continuar, o joystick só responde depois de levantar o dedo e tocar de novo (`vx = 0` mesmo mexendo o dedo).

### 2.3 [Alto] Saídas destrutivas sem confirmação — confirmado no código
- **✕ no mapa** (`main.ts:354`) e **Sair** na pausa (`main.ts:364`) chamam `sair()` (`main.ts:290`): fecham a
  conexão e recarregam a página. No anfitrião isso **derruba a sala dos dois**. O ✕ tem 41×35 px e fica no canto
  superior esquerdo, onde o polegar esquerdo passa ao pegar o celular (figura 10).
- **"Mapa da jornada"** na pausa (`main.ts:363`) abandona a fase (estrelinhas e lanterna perdidas), 8 px abaixo de
  "Continuar" e com a mesma cor dourada (figura 07).
- **Correção:** segundo toque de confirmação ("Sair da sala? A Bruna também volta ao menu" / "Voltar ao mapa? O
  progresso desta fase se perde"), cor neutra para as saídas, Continuar maior e isolado.

### 2.4 [Médio] Joystick fixo e só dentro do círculo — confirmado
Curva medida (dedo no centro, arrasto de *dx* px, velocidade do Natan após 12 ticks; raio 70 px no iPhone):

| dx (px) | 5 | 10 | 15 | 20 | 30 | 40 | 50 | 60 | ≥70 |
|---|---|---|---|---|---|---|---|---|---|
| vx (m/s), iPhone | 0 | 0 | 0,55 | 1,17 | 2,40 | 3,64 | 4,87 | 5,2 | 5,2 |
| vx (m/s), Android (raio 74) | 0 | 0 | 0,45 | 1,04 | 2,21 | 3,37 | 4,54 | 5,2 | 5,2 |

A curva em si é boa (zona morta ~10 px, plena a ~75 % do raio, diagonal de 45° ainda dá 4,3 m/s). O problema é onde
o polegar pousa:
- **Pousar 12 px fora da borda** e arrastar para dentro: `vx = 0` (nada acontece). **Pousar 20 px acima** do
  círculo: `vx = 0`. Em paisagem o polegar costuma pousar mais alto e mais para dentro que o desenho.
- **Pousar fora do centro** (30 px à direita, sem arrastar): o Natan já sai andando a 2,4 m/s — movimento que a
  pessoa não pediu.
- A **arena já tem joystick flutuante** (`controlesArena.ts`, a base vai até o polegar, área de 42 % × 62 % da
  tela). Os dois modos do mesmo jogo se comportam diferente. **Correção:** usar o joystick flutuante também no 2.5D.

### 2.5 [Baixo / risco] Toques curtos dependem do quadro
`controles.ts` só guarda "está apertado agora" e o jogo lê uma vez por quadro; a arena guarda o toque (`pego`,
`controlesArena.ts:20`). Medido aqui: 12 de 12 toques instantâneos viraram pulo (o Chromium entrega o toque alinhado
ao quadro), então **não confirmei perda**. Com quadros longos no celular (queda de fps, aquecimento) um toque que
começa e termina entre dois quadros se perde [hipótese]. Barato de blindar: copiar o `pego` da arena.

### 2.6 [Médio] Convidado: retorno pobre
- O convidado que pausa vê só **"Pausado."**; o anfitrião vê "Pausado por Bruna (quem entrou na sala)." (figura 09).
- No mapa o convidado vê "Esperando quem criou a sala escolher…" sem poder sugerir capítulo (figura 08); não há
  sinal de que o outro está tocando em ilhas (seleção é sincronizada, mas sem destaque de "Natan está escolhendo").
- A sala não diz quem vai ser quem ("você joga com o Natan") nem deixa escolher; quem cria é sempre Natan.

---

## 3. Leitura da tela

### 3.1 [Alto] Controles e HUD tapam estrelinhas, bichinhos e pousos — medido
`projecao.mjs`, bots dos 7 capítulos, retângulos reais dos botões/HUD (círculos para os botões redondos, folga de
8 px para estrelinhas e 6 px para bichinhos):

| Cap. | iPhone: estrelinhas — fração do tempo visível tapada | iPhone: bichinhos tapados | Android: estrelinhas | Android: bichinhos |
|---|---|---|---|---|
| 1 | 21 % | 37 % | 25 % | **56 %** |
| 2 | 23 % | 23 % | 21 % | 19 % |
| 3 | 16 % (5 estrelinhas ≥ metade do tempo) | 28 % | 20 % (6) | 22 % |
| 4 | 21 % | 37 % | 20 % | 32 % |
| 5 | 22 % | 30 % | 23 % (7) | 32 % |
| 6 | **28 %** (8 estrelinhas ≥ metade do tempo) | 28 % | 25 % (8) | 31 % |
| 7 | **28 %** | 19 % | 25 % | 22 % |

Estrelinhas soltas por bichinho derrotado: 7–38 % do tempo tapadas. Os personagens quase nunca ficam atrás de
controles (≤ 2,3 % do tempo, capítulo 5, atrás de ✨ e do placar) — a câmera os mantém no centro; **o que fica
embaixo dos polegares é o que vem pela frente e o chão da frente**.

Casos vistos nas capturas:
- **Figura 02** (cap. 1, tick 1002): a placa de pressão está metade sob o joystick; uma estrelinha encosta no ✋.
- **Figura 03** (cap. 2, fio sobre a cachoeira): a beirada onde a Bruna precisa pousar ao soltar o fio e duas
  estrelinhas estão sob ✋ e ⬆ — no momento de maior precisão do capítulo.
- **Figura 01** (cap. 1, início): um item dourado atrás do ✋.
- **Figura 04** (cap. 3): uma estrelinha sob o retrato da Bruna. **Figura 05** (cap. 7): uma estrelinha sob o placar ★.

**Correções:** botões mais baixos e mais para a borda (o grupo da direita ocupa 203×185 px no iPhone; ✋ a 186 px do
topo está no meio da tela), opacidade menor quando nada passa por trás e mais forte só no toque; câmera com mais
"respiro" à frente do movimento e o chão da frente fora da faixa de baixo; HUD central (capítulo + fps) some depois
de 3 s. Um critério testável: `projecao.mjs` com estrelinhas ≤ 8 % e bichinhos ≤ 10 % do tempo tapados.

### 3.2 [Médio] Informação de depuração e texto fixo no topo
- **fps para o jogador:** `partida.ts:183` escreve "N fps" (e o ping) em `#hud-info` sempre; só chamadas/triângulos
  dependem de `?debug`. Num aparelho quente o jogador vê "24 fps" e acha que está quebrado.
- **"Capítulo 1 · Pequenos em um mundo gigante"** fica para sempre no topo central (12 px), em cima do céu e das
  estrelinhas altas (figura 05). Mostrar 3 s ao entrar e sumir.

### 3.3 [Médio] Letras e alvos pequenos (auditoria do DOM)
| Onde | Medida | Referência |
|---|---|---|
| ❚❚ pausa | 49×29 px | alvo ≥ 44×44 pt (Apple) / 48×48 dp (Android) |
| ⇄ trocar (essencial no treino) | **37×29 px** | idem |
| ✕ do mapa · 📖 História · Pular ›› | 41×35 · 107×35 · 82×35 px | idem |
| Campo de código · Entrar · seletor Gráficos | 41 px · 86×41 · 102×31 px | idem |
| Número e selo das ilhas do mapa | 11,7 px e 10,9 px (iPhone); **10 px** no Safari | ≥ 12–13 px em celular |
| "você", fps, nome do capítulo, dica da pausa | 11, 11, 12, 11 px | idem |
| Rótulos "Natan"/"Bruna" sobre a cabeça | encolhem com a câmera; no fio do cap. 2 ficam com ~8 px | — |

- **Rótulos sobrepostos:** lado a lado, viram "BrunaNatan" (figura 04). Afastar verticalmente ou esconder quando
  os dois estão a menos de 1 m.
- **Dica da pausa é de teclado** ("PC: setas/WASD andar…", 11 px) mesmo no celular (figura 07). No celular,
  trocar por um desenho dos botões de toque.

### 3.4 [Alto no iPhone] Safari sem tela cheia; entalhe e barra
- O iPhone não tem `requestFullscreen` (`main.ts:298` falha em silêncio): a barra do Safari fica e, em 844×340, o
  joystick ocupa a faixa de 197 a 319 px (**42 % da altura a partir de baixo**) e o ✋ sobe para 162 px
  (figura 06). Como app na tela inicial (PWA) a altura volta a 390 px. **Correção:** no iPhone (Safari fora do modo
  `standalone`), mostrar uma vez um cartão "Toque em Compartilhar → Adicionar à Tela de Início para jogar em tela
  cheia", com desenho.
- **Entalhe:** HUD, joystick e botões respeitam `env(safe-area-inset-left/right)` (joystick em x = 47 px; botões
  terminam em 797 px) — está certo. **Barra de "home":** os controles usam `bottom: 5vh/6vh` sem
  `safe-area-inset-bottom` e encostam nela (⬆ termina a ~1 px da faixa de 21 px). Baixo risco; somar
  `env(safe-area-inset-bottom)` evita que um arrasto para cima no ⬆ vire gesto de "ir para o início".
- **Vibração:** `navigator.vibrate(8)` não existe no Safari do iPhone: a Bruna não tem retorno tátil nenhum.

### 3.5 [Médio] Personagens pequenos quando se afastam — medido
Altura na tela de um corpo de 1,1 m (projeção sobre os bots; iPhone 390 px de altura):

| Cap. | mediana | 10 % piores | mínimo | câmera (mediana / máx.) |
|---|---|---|---|---|
| 1 | 69 px (17,7 %) | 52 px | 42 px | 7,6 / 13,1 |
| 3 | 61 px | **33 px** | 25 px | 8,8 / 22 |
| 5 | 59 px | **31 px** | 25 px | 9,1 / 22 |
| 7 | 70 px | **31 px** | 31 px | 7,6 / 17,7 |

Na arte conceitual os personagens ocupam ~23 % da altura do quadro de jogo; no jogo, ~18 % no melhor caso e
**8 %** nos 10 % piores momentos (a câmera compartilhada afasta até 22 m para caber os dois). Como cada um tem o
próprio celular, a câmera de cada aparelho pode priorizar o próprio personagem e mostrar o outro por uma seta na
borda (sugestão para a equipe de câmera, com esta medida como critério).

---

## 4. Momentos confusos e retorno

### 4.1 [Alto] Nenhuma pista dentro da fase — confirmado
- `#aviso` só é usado na arena (`partidaArena.ts:140, 323-325`). No 2.5D não há texto, seta, balão nem ícone
  contextual. O ✋ é sempre a mesma mão, faça ela "dar a mão", "ancorar", "puxar", "agarrar argola" ou "empurrar".
- O que o jogador precisa descobrir sozinho: que mãos dadas viram impulso (cap. 1, caixa alta em x=52); que no fio
  **um segura ✋ parado** enquanto o outro balança (cap. 2); que a placa abre uma porta 5–8 m adiante (nada liga as
  duas visualmente); que a bolha precisa encostar no parceiro; que os dois viraram bolha e voltaram à lanterna.
- Figura 13 (cap. 3, tick 5517): campo aberto, uma estrelinha brilhando, nenhuma indicação do próximo objetivo.
- **Correção mínima:** usar o `#aviso` já existente em gatilhos de zona ("Segurem ✋ juntos para dar as mãos",
  "Quem está no galho: segure ✋!"), ícone do ✋ que muda conforme o contexto, um fio de luz entre placa e porta, e
  "Encoste na Bruna para voltar!" quando alguém vira bolha.

### 4.2 [Médio] Retorno que falta (som, tremida, partículas)
Eventos da simulação **sem som** (comparando `sim.ts` com `SFX` de `som.ts`): `pouso`, `pisao`, `quique`,
`acerto` (faísca que não mata), `defendeu` (espinhudo), `esporo`, `caiu` (vão), `renasce`, `volta-checkpoint`,
`placa`/`solta`, `fio-solto`, `soltou`, `escalou`, `argola`, `empurrao`, `treme`/`cai` (plataforma que cai),
`estoura`, `chefe-fase`, `concluida`. Pisar num bichinho (o golpe mais "Mario" do jogo) é mudo.
- **Sem tremida de câmera** em lugar nenhum do 2.5D (grep); dano só faz o retrato do HUD tremer.
- **Primeiro som atrasado:** cada efeito é baixado e decodificado na primeira vez que acontece (`som.ts:68`); o
  primeiro pulo, tiro e estrelinha de cada sessão saem atrasados ou não saem. Pré-carregar os 12 efeitos (98 kB) ao
  entrar na fase.
- **Música em `HTMLAudioElement` com `loop`** em MP3 de 90 s: costuma ter um vão audível na volta [hipótese; ouvir
  no aparelho]; o volume é um só (não há música × efeitos separados), e o botão de som só existe na pausa.
- Há retorno visual bom em vários eventos (achatar no pouso, giro ao cair, estouro dos bichinhos) — ver §7.

### 4.3 [Baixo] Tela de capítulo concluído
- **3 estrelas grandes com 36 de 38** (`telas.ts:152` arredonda): quem quer completar não sabe que faltou algo, nem
  onde (figura 12). Usar 3 estrelas só com tudo, e mostrar "faltaram 2: uma no alto da prateleira…".
- O total mistura estrelinhas espalhadas e bichinhos (38 = 33 + 5) sem dizer.
- Capítulo 7: a frase do pedaço é a mesma frase final do jogo e dos créditos ("Algumas coisas a gente não precisa
  lembrar sozinho") — aparece 3–4 vezes em sequência. `historia.ts` ainda guarda frases antigas diferentes das das
  fases (texto morto; só as das fases aparecem).

### 4.4 Repetição
O ciclo de cada capítulo é idêntico (mapa → fase → concluído → 2 quadros de lembrança → mapa) e o primeiro quadro da
lembrança é a mesma pintura que já aparece na ilha do mapa. Cabe à equipe de narrativa; aqui só registro que, como
jogador, a sétima vez cansa.

---

## 5. Carregamento, rede e bateria

### 5.1 [Médio] Jogar ▶ congela a tela — medido (máquina sem GPU; compare entre si)
`carga.mjs`, Android 915×412, do toque ao primeiro tick:

| Qualidade | Cap. 1 | Cap. 2 | Cap. 7 | maior tarefa única |
|---|---|---|---|---|
| baixa | 5,0 s | 7,1 s | 3,7 s | 1,5–3,3 s |
| média | 7,1 s | 10,3 s | 4,8 s | 2,1–6,2 s |
| alta | 10,2 s | 14,5 s | 8,0 s | 4,2–6,8 s |

Os números absolutos são da CPU emulando a GPU (compilar shaders é muito mais lento aqui) — **no celular serão
menores; o que se confirma é a forma**: uma tarefa de vários segundos dentro do toque. `mostrarTela('jogo')` acontece
mas não chega a ser pintado: a pessoa vê o mapa parado com o botão afundado. O capítulo 2 é o mais lento em todas
as qualidades. **Correção:** tela de transição (pintura do capítulo + "Preparando o mundo…") pintada antes de montar
a cena, montar em partes (`await` entre etapas), e compilar shaders com `renderer.compileAsync`.

### 5.2 [Médio] Peso baixado
| Tela | O que baixa | Tamanho |
|---|---|---|
| Menu | rostos | 45 kB |
| Sala | música do menu | 1,0 MB |
| **Mapa** | 7 pinturas inteiras para miniaturas de ~70 px + música | **2,8 MB** |
| Prólogo | 5 pinturas | 1,3 MB |
| Cada fase | música do capítulo | 1,0 MB |
| Primeira fase | 12 efeitos (sob demanda) | 98 kB |

As miniaturas das ilhas usam a pintura inteira (`telas.ts:91`, 229–310 kB cada). Miniaturas de 160 px em WebP
ficariam com ~10 kB cada. Música a 96 kbps estéreo, 1 MB por faixa: 64 kbps mono/estéreo conjunto ou Opus cortaria
pela metade.

### 5.3 [Médio] Bateria e segundo plano
- Nada pausa o jogo ao trocar de aplicativo ou apagar a tela (sem `visibilitychange`); ver §2.1.
- Sem `navigator.wakeLock`: no mapa, esperando o anfitrião, a tela do convidado pode apagar sozinha (30 s no iPhone)
  e a conexão cair [hipótese; conferir no aparelho].
- O `#ceu` do menu (CSS animado com 3 camadas e `blur(30px)`) fica escondido no jogo — está certo.

---

## 6. Achados por tela (passo a passo)

| Tela | Achado | Grav. |
|---|---|---|
| Menu (fig. 11) | Claro e bonito. "Treinar sozinho" não diz que libera tudo e não salva; o seletor Gráficos (Leve/Normal/Bonito) tem 31 px de altura e não existe dentro do jogo (só no menu) | Baixo |
| Menu | Código curto: "O código tem 5 letras/números." — boa mensagem; o teclado do celular cobre metade da tela em paisagem e o campo fica a 150 px do topo [hipótese de sobreposição; conferir] | Baixo |
| Sala | Código grande e legível, "Compartilhar convite" funciona; "Esperando…" sem animação nem tempo; não diz quem será Natan/Bruna | Baixo |
| Prólogo (fig. 14) | Arte excelente; o texto de 14–22 px é legível; "Pular ››" tem 35 px de altura e encosta no canto do quadro | Baixo |
| Mapa (fig. 10) | No treino tudo mostra "novo!", até o que já foi jogado; selo de 10–11 px; ✕ destrutivo no canto | Médio |
| Fase | fps visível; nome do capítulo fixo; controles sobre estrelinhas (§3) | Médio–Alto |
| Pausa (fig. 07) | Dica de teclado no celular; "Mapa" e "Sair" sem confirmação; sem ajuste de gráficos/volume | Alto |
| Concluído (fig. 12) | Estrelas arredondadas para cima; sem detalhe do que faltou | Baixo |
| Convidado (fig. 08–09) | "Pausado." sem autor; mapa sem retorno de quem escolhe | Médio |

---

## 7. O que está BOM e deve ser preservado

- **Multitoque correto nos botões de jogo** (`pointerdown` + captura): andar + pular + atirar ao mesmo tempo funciona;
  arrastar o polegar para fora do joystick não o solta.
- **Curva do joystick** (zona morta de ~10 px, plena a 75 % do raio, diagonal útil) — manter ao torná-lo flutuante.
- **Tiro segurado** com cadência estável (10 faíscas em 180 ticks = 3,3/s), sem precisar martelar o botão.
- **Área segura do iPhone respeitada** no HUD, no joystick e nos botões laterais (`env(safe-area-inset-*)`).
- **Tamanho dos botões de jogo** (⬆ 93 px, ✨ 77 px, ✋ 73 px no iPhone) e o ⬆ maior no canto, como na arte conceitual.
- **Pausa sincronizada** e o anfitrião sabendo quem pausou; **tela de conexão perdida** com "Tentar de novo".
- **Cair num vão não tira coração** e volta ao chão seguro; bolha em vez de "game over": perdoa sem frustrar.
- **Animação dos personagens**: achatar no pouso, esticar no ar, giro ao reaparecer, estouro dos bichinhos em
  brilho, Fio Vermelho como catenária visível (figuras 03 e 05) — é o que mais parece "desenho animado" hoje.
- **Rótulos com nome e cor** (Natan vermelho, Bruna azul) iguais aos anéis dos retratos: dá para saber quem é quem
  no celular do outro.
- **Prólogo e lembranças pintados**, "Toque para continuar", pontos de progresso, `prefers-reduced-motion`.
- **Mapa da jornada** com a estrela que acende uma ponta por pedaço: claro e emocional.
- **Determinismo + ganchos `__edm`**: permitiram este playtest inteiro com reprodução exata; manter.

---

## 8. Lista priorizada

| # | Prioridade | O que fazer | Critério de aceite |
|---|---|---|---|
| 1 | P0 | Entrada remota expira (neutra após 250 ms; pausa e aviso após 2 s) e `visibilitychange` pausa/neutraliza nos dois | `dupla.mjs`: convidado congelado 3 s ⇒ `vxBruna = 0` em ≤ 0,3 s e pausa com aviso em ≤ 2 s |
| 2 | P0 | ❚❚, ⇄ e botões das sobrepostas por `pointerdown/up` | `jogo.mjs`: `pausaComDedoNoJoystick` e `continuarComDedoNoJoystick` = true nos dois aparelhos |
| 3 | P0 | Confirmação em ✕ do mapa, Sair e "Mapa da jornada"; Continuar isolado | segundo toque obrigatório; teste e2e que um toque só não sai |
| 4 | P1 | Dicas contextuais no 2.5D (`#aviso` por zona, ✋ com ícone de contexto, ligação placa↔porta, aviso de bolha) | cada mecânica nova de cada capítulo tem uma dica que aparece na primeira vez; capturas antes/depois |
| 5 | P1 | Reposicionar/atenuar controles e HUD; nome do capítulo e fps somem | `projecao.mjs`: estrelinhas ≤ 8 % e bichinhos ≤ 10 % do tempo tapados nos 7 capítulos, iPhone e Android |
| 6 | P1 | Joystick flutuante no 2.5D (mesmo da arena) | `jogo.mjs`: pouso 12 px fora e 20 px acima ⇒ anda; pouso fora do centro ⇒ `vx = 0` até arrastar |
| 7 | P1 | Cartão "Adicionar à Tela de Início" no iPhone fora do modo standalone; controles somam `safe-area-inset-bottom` | aparece uma vez no Safari do iPhone; nunca no PWA nem no Android |
| 8 | P1 | Tela de transição pintada antes de montar a fase; montagem em partes | nenhuma tarefa > 200 ms entre o toque e a tela de transição (`carga.mjs`) |
| 9 | P2 | Alvos ≥ 44 px e letras ≥ 12 px (❚❚, ⇄, ✕, Pular, selos do mapa, "você") | auditoria do `telas.mjs` sem itens abaixo |
| 10 | P2 | Sons para pisão, pouso, vão, placa, fio, plataforma que cai, conclusão; pré-carregar efeitos; volume música × efeitos | todos os eventos de §4.2 com som; primeiro pulo com som |
| 11 | P2 | Miniaturas do mapa (~10 kB) e música mais leve | mapa ≤ 400 kB além da música |
| 12 | P2 | Pausa do convidado diz quem pausou; sala diz quem será quem; rótulos não se sobrepõem; 3 estrelas só com 100 % | capturas antes/depois |
| 13 | P2 | Entrada com "toque guardado" (`pego`) no 2.5D | teste com quadros de 100 ms: 12/12 toques curtos viram pulo |

---

## 9. Causas confirmadas × hipóteses

**Confirmadas** (medidas aqui ou lidas no código): entrada do convidado presa ao congelar a página (§2.1); ❚❚ e
botões de tela não respondem com outro dedo encostado no Chromium (§2.2); saídas sem confirmação (§2.3); joystick
fixo ignora pouso fora do círculo e anda com pouso fora do centro (§2.4); frações tapadas de estrelinhas e bichinhos
pela projeção validada (§3.1); fps visível (§3.2); tamanhos de letras e alvos (§3.3); sem Fullscreen API no iPhone
(§3.4, comportamento conhecido da plataforma); alturas dos personagens (§3.5); nenhuma dica no 2.5D (§4.1);
eventos sem som e efeitos sob demanda (§4.2); arredondamento das estrelas (§4.3); congelamento síncrono ao entrar e
peso baixado por tela (§5).

**Hipóteses** (conferir no aparelho): altura útil de ~340 px no Safari do iPhone; Safari também sem `click` em
multitoque; perda de toques curtos com quadros longos; vão na volta da música; tela do convidado apagando por falta
de wake lock; teclado cobrindo o campo de código; tempos de carregamento reais no Redmi/iPhone (só a forma foi
medida).

## 10. Arquivos desta entrega
- Documento: `docs/revisao/PLAYTEST.md`
- Capturas anotadas: `docs/revisao/img/playtester/01…14_*.webp`
- Ferramentas: `tools/revisao/playtester/{comum,telas,jogo,projecao,carga,dupla}.mjs`
- Medidas brutas: `tools/revisao/playtester/medidas/{telas,telas_safari_android,jogo,projecao,carga,dupla}.json`
