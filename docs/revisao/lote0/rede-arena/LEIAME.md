# Lote 0 · rede-arena: medidas antes e depois

## 1. Predição do próprio personagem no convidado (2.5D)

O que mudou (src/net/predicao.ts, src/core/instantaneo.ts, src/input/controles.ts, e uma ligação pequena em src/ui/partida.ts):

- O convidado simula o próprio personagem com a própria entrada, a 60 Hz. Cada entrada ganha um número (`seq`).
- O anfitrião aplica as entradas do convidado **uma por tick, na ordem**. A fila tem no máximo 6 entradas (100 ms); se
  passar disso, as entradas mais velhas são juntadas e os botões apertados nelas não se perdem. O instantâneo devolve o
  `sq` da última entrada aplicada.
- A cada instantâneo novo, o convidado volta ao estado do anfitrião e reaplica as entradas que o anfitrião ainda não viu.
  A diferença para o que estava na tela some em cerca de 80 ms. Acima de 2,5 m (queda, renascer), o personagem salta
  para o lugar certo em vez de deslizar.
- O instantâneo agora leva o estado interno do pulo: coyote, buffer, pulo mínimo, lançado, argola e recarga. Posição e
  velocidade vão em mm. Sem isso, o convidado rebobinaria de um estado diferente do anfitrião.
- Só o próprio personagem vem da predição. O parceiro, os bichinhos e as portas continuam vindo do anfitrião,
  interpolados 100 ms no passado. Em plataforma móvel, o personagem é desenhado em relação à plataforma que está na
  tela. Pendurado no Fio Vermelho ou em bolha, volta a mostrar a posição do anfitrião, com transição suave.
- Os controles guardam o toque: um botão apertado e solto entre duas leituras sai apertado uma vez.

### Latência entre apertar e o próprio personagem se mexer no quadro do convidado

Medido com `tools/revisao/rede-arena/latencia.mjs`: dois celulares emulados no mesmo Chromium, sem GPU e com servidor
PeerJS local. O atraso é emulado em uma via, nas duas direções, embrulhando `RTCDataChannel.send`. Arquivos:
`latencia_antes_*.json` e `latencia_depois_*.json`.

| atraso de uma via | pulo antes | pulo depois | corrida antes | corrida depois | toque curto (vira pulo no anfitrião) |
|---|---|---|---|---|---|
| 0 ms | 147 ms (132–172) | **2 ms** (1–7) | 179 ms (151–228) | **2 ms** (2–3) | 0/5 → **5/5** |
| 80 ms | 514 ms (429–548) | **5 ms** (2–9) | 587 ms (415–615) | **2 ms** (1–7) | 0/5 → **5/5** |
| 100 ms | 621 ms (504–795) | — | 692 ms (454–793) | — | 0/5 |
| 150 ms | 720 ms (561–963) | **4 ms** (2–5) | 720 ms (630–909) | **3 ms** (2–5) | 0/5 → **5/5** |

O "antes" sem GPU fica acima da soma do pipeline (≈ 160 ms + 2 × uma via), porque o quadro sem GPU dura 80–90 ms.

O anfitrião continua com 2 a 7 ms, ou seja, no mesmo quadro. Depois da mudança, o convidado fica igual ao anfitrião:
a meta da AUDITORIA_MOVIMENTO §6 era ficar no máximo 2 quadros acima dele.

Erro de reconciliação, de `__edm.predicao()` no convidado:
- 0 ms: 755 reconciliações, maior erro 0,9 mm.
- 80 ms: maior erro 0,25 m.
- 150 ms: maior erro 0,27 m.

Nenhum desses casos teve salto. Os erros maiores aparecem quando o anfitrião sem GPU perde tempo de simulação (o `dt`
é limitado a 0,1 s), a fila de entradas enche e as entradas são juntadas. Esses erros são desfeitos por deslizamento
de ~80 ms.

Testes: `test/predicao.test.ts` usa uma rede simulada com 0, 83 e 150 ms de uma via. Ele exige que o próprio pulo e a
corrida apareçam em até 2 ticks, que o fim coincida com o anfitrião (< 1 cm) e que nenhum quadro ande mais de 0,2 m.
O mesmo teste **sem** a predição falha nos três casos: 12 e 19 ticks de atraso, e um tranco de 0,23 m. `test/e2e/dupla.mjs`
confere três coisas: o próprio pulo em ≤ 2 quadros, o toque curto 3/3 e a reconciliação sem salto.

Limites:
- Medido sem GPU e com atraso emulado, sem perda de pacotes. O canal do PeerJS é confiável e ordenado.
- Sem predição na Arena do Coração (3D). Ela precisaria do estado interno do jogador e do `sq` em
  `src/core/arena/instantaneo.ts`, que está fora deste escopo.
- O parceiro continua 100 ms no passado. Quando os dois interagem de perto (mãos dadas, Fio Vermelho), o próprio
  personagem está "no presente" e o parceiro "no passado".

## 2. Arena: câmera, clarões e golpes

Medido com `tools/revisao/rede-arena/capturas_arena.mjs`, que usa relógio falso e a luta dos bots em dupla reproduzida
na câmera do Natan, qualidade média, 844×390. A folha `arena_antes_depois.webp` mostra o antes à esquerda e o depois à
direita. A tabela completa está em `arena_antes_depois.md`.

| problema (QA anterior) | antes | depois |
|---|---|---|
| Fase 3 com a parede de névoa: câmera longe | próprio personagem com **0,108** da altura da tela, câmera a 9,9 m | **0,208**, a 4,8 m. O parceiro, do outro lado da parede, não entra mais no enquadramento. |
| Resto da luta | 0,17 da tela | 0,17–0,18. A câmera ficou 0,26 rad ao lado e mais alta, sem encolher ninguém. |
| Clarão no Golpe do Fio Vermelho / acertos fortes perto do Rei | pico de luminância no centro da tela **163**, **26 quadros** acima de base+15, 6,1 % de pixels quase brancos | pico **143**, **13 quadros**, 3,2 % |
| Rei pálido ou piscando branco | clarão branco até 0,48, a cada tiro e golpe | clarão na cor de quem acertou: dourado do Natan, rosa da Bruna, vermelho no Fio. Até 0,14 (tiro), 0,26 (golpe) e 0,34 (poderes), e some em ~60 ms. O anel de impacto também ficou colorido e menor. |
| Golpes pouco legíveis com a câmera atrás | rastro fraco (opacidade 0,5, 8 seções) e câmera atrás das costas | rastro com opacidade 0,95 e 12 seções, câmera levemente lateral e mais alta (ver `golpe_acerto` e `golpe_depois`) |

Limites: as partículas usam `Math.random`, então as fotos não são idênticas pixel a pixel entre execuções. As curvas
de luminância medem a tela inteira e o terço central, não a percepção. A imagem vem do SwiftShader (sem GPU).
