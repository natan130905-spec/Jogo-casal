# Capítulo 7 — A Arena do Coração (fase 3D final)

Pedido do jogador (2026-11-24): a última fase em **3D de verdade**, numa arena, contra o chefe, com **luta corpo a corpo
(arma branca) e tiro**, **armas com poderes**, **balanceada**, **bonitinha e em desenho**, com a história no final.

## Onde entra na história
O capítulo 7 ("O coração do universo") continua com a parte de plataforma 2.5D. Ao tocar o pedaço da estrela no fim, ela
se recusa a se juntar: o **Rei-Pesadelo** a arranca e foge para a **Arena do Coração**, uma ilha flutuante redonda no meio
das estrelas. A câmera "vira" para trás dos personagens e o jogo passa para **3D em terceira pessoa**. Vencendo, vêm as
cenas da história (cap. 7 e final) e os créditos com a música final.

## Visual (em desenho, como a arte conceitual)
- Ilha circular de ~24 m de diâmetro, grama e flores, bordas de pedra com cascatas caindo no vazio, céu roxo e dourado
  com galáxia, as 6 lembranças anteriores flutuando ao redor como pequenas ilhas (brinquedos, floresta, relógio, oceano,
  doces, espelhos). Pilares de cristal que servem de cobertura e quebram.
- Materiais toon/cartoon, contorno, bloom suave. Personagens: os modelos 3D de Natan e Bruna (`public/modelos/natan.glb`,
  `bruna.glb`, com esqueleto). Chefe: `rei.glb` com animação procedural (respirar, inclinar, crescer, névoa em volta).

## Controles (celular na horizontal)
Joystick (mover em relação à câmera). Botões: **⚔ golpe** (espada/lança; toques em sequência = combo de 3), **✨ tiro**
(Lança-Estrelas), **⬆ pulo**, **↻ esquiva** (rolamento com invencibilidade curta), **★ poder** (quando a barra enche).
Câmera em terceira pessoa que mantém o Rei e os dois no quadro (trava no chefe). PC: WASD, J golpe, K tiro, Espaço, Shift
esquiva, Q poder.

## Armas e poderes
| Personagem | Arma branca | Poder da arma (barra cheia) |
|---|---|---|
| Natan | **Espada da Aurora** (lâmina de luz dourada) | **Corte Cometa**: avanço em linha reta que atravessa e atordoa |
| Bruna | **Lança de Pétala** (alcance maior, mais lenta) | **Jardim de Luz**: círculo de flores que cura o parceiro e enfraquece a névoa |
| Os dois | Lança-Estrelas (tiro fraco à distância) | — |
| **Juntos** | — | **Golpe do Fio Vermelho**: se os dois usam o poder a até 3 s um do outro, o fio os une num ataque combinado que derruba o escudo do Rei |
A barra de poder enche acertando golpes, desviando no último instante e **ficando perto do parceiro** (o laço cresce).

## O Rei-Pesadelo (3 fases)
1. **Coroa Brava** (100 %–66 %): pancada no chão com onda de choque (pular para desviar), chuva de esporos com sombra no chão
   (aviso de 1 s), invoca 3 bolotinhas.
2. **Névoa Teimosa** (66 %–33 %): fica com escudo de névoa (só o poder ou o Golpe do Fio Vermelho quebra; depois 6 s
   vulnerável), investida em linha com aviso, morcegos em círculo.
3. **Medo de se Perder** (33 %–0): separa os dois com uma parede de névoa no meio da arena; cada um precisa acertar o
   cristal do seu lado ao mesmo tempo para unir de novo; ataques mais rápidos. Ponto fraco: a estrela no peito.
Derrotado, vira um **vaga-lume** (cena final da história).

## Balanceamento (alvos verificáveis por teste)
- Vida do Rei: duração de **3 a 5 minutos** para uma dupla mediana (bot com 60 % de acerto); nunca menos de 2 min.
- Todo ataque do Rei tem **aviso visual ≥ 0,8 s** e é desviável (teste: bot que sempre desvia não toma dano).
- Dano no jogador: 1 coração (de 3) por acerto; 1 s de invencibilidade; caído vira bolha e renasce perto do parceiro
  (como nas fases); se os dois caem, recomeça a **fase atual** do chefe (não a luta toda).
- Golpe da espada > tiro em dano (≈ 3×), mas exige ficar perto (risco × recompensa). Poder: ≈ 10 golpes.
- Uma pessoa jogando sozinha (treino) consegue vencer, mais devagar (fase 3 com um botão que ativa os dois cristais).

## Técnica
- Módulo separado: `src/core/arena/` (simulação 3D pura e determinística, x-z no chão + y altura, passo fixo 60 Hz,
  testes vitest) e `src/render/arena/`. Rede: o anfitrião simula, o convidado envia entradas e interpola (como no 2.5D).
- Orçamento no celular (Média): ≤ 80 chamadas, ≤ 250 mil triângulos, sombras reais só na Alta.
- Música: `public/som/musica_chefe.mp3`; final: `musica_final.mp3`. Efeitos: `sfx_*`.

## Números (núcleo `src/core/arena/`, ajustados pelos testes `test/arena*.test.ts`)
Todos ficam em `src/core/arena/numeros.ts` (mudou lá, rode `npx vitest run test/arena_balanceamento.test.ts`).

| O quê | Valor |
|---|---|
| Ilha | raio 12 m (24 m de diâmetro); quem sai da borda cai e, abaixo de −4 m, perde 1 coração e volta como bolha perto do parceiro |
| Jogador | corpo r 0,4 × 1,1 m; anda 6 m/s; pulo 9 m/s (gravidade 25 → ~1,6 m de altura, 0,72 s no ar) |
| Esquiva | rolamento 0,4 s a 10 m/s (~4 m), invencível nos primeiros 0,35 s, espera 0,6 s |
| Espada da Aurora (Natan) | combo 3 + 3 + 3; 0,30 s por golpe (acerta aos 0,10 s); alcance 1,5 m; arco 120° |
| Lança de Pétala (Bruna) | combo 3 + 3 + 4; 0,42 s por golpe (acerta aos 0,18 s); alcance 2,4 m; arco 70° |
| Lança-Estrelas | 1 de dano, 18 m/s, alcance 16 m, 3 por segundo (segurado); os pilares bloqueiam |
| Proporção | golpe ≈ 3,0× (espada) e 3,3× (lança) o tiro; poder = 30 = 10 golpes |
| Mira | com o joystick solto (ou a até 45° do alvo) golpe, tiro e poder travam no alvo: bolotinha a < 2,5 m, cristal do seu lado (fase 3 com parede) ou o Rei |
| Barra de poder (100) | +6 por golpe no Rei (conta no escudo também), +2 por tiro, +4 por bichinho/cristal, +20 por esquiva no último instante, +3/s a menos de 4 m do parceiro |
| Corte Cometa | avanço de até 8 m a 22 m/s rumo ao Rei; 30 de dano e atordoa 2 s; quebra o escudo |
| Jardim de Luz | 30 de dano (pétalas), +1 coração no parceiro, círculo de 4,5 m por 5 s que faz bolha renascer; cristais ficam acesos 4 s (em vez de 2) enquanto dura; quebra o escudo |
| Durante o poder | quem usa fica protegido (0,36 s no Cometa, 0,5 s no Jardim) |
| Golpe do Fio Vermelho | o segundo poder a ≤ 3 s do primeiro: +15 de dano, atordoa 3 s, quebra o escudo e, na fase 3, derruba a parede |
| Vida | 3 corações; 1 por acerto; 1 s invencível (1,5 s ao renascer); bolha voa a 5 m/s e renasce a 1,2 m do parceiro (com 3 corações se tinha zerado) |
| Rei-Pesadelo | vida 3400 (fases em 2/3 e 1/3: 1133 por fase); raio 1,6 m; anda 1,8 m/s; rugido de 2 s (invulnerável) a cada troca de fase |
| Fase 1 — Coroa Brava | ciclo pancada, esporos, invocar, esporos, pancada, esporos; aviso 1,0 s; descanso 1,6 s. Onda de choque a 9 m/s (pular: passa abaixo de 0,45 m; atrás de pilar protege e trinca o pilar); esporos r 1,3 m em cada um + 2 soltos; 3 bolotinhas (bote com aviso 0,9 s, r 1,1 m) |
| Fase 2 — Névoa Teimosa | escudo; poder/Fio quebram → 6 s vulnerável e o escudo volta. Ciclo investida, esporos, morcegos, investida, esporos; aviso 1,0 s; descanso 1,4 s. Investida a 16 m/s, faixa de 2 m de meia-largura, até 14 m, quebra pilares. 4 morcegos circulando (r 9 m) mergulham com aviso 0,9 s |
| Fase 3 — Medo de se Perder | parede de névoa em x = 0 (Natan em x < 0, Bruna em x > 0; sobe em 1,2 s empurrando cada um para o seu lado). Os dois cristais (±6, 2,5) acesos ao mesmo tempo (2 s cada) derrubam a parede: 8 s com o Rei atordoado e a estrela do peito à mostra (dano × 1,5); depois a parede sobe de novo. Ciclo esporos, pancada, morcegos, esporos, pancada; aviso 0,8 s; descanso 1,0 s |
| Legibilidade | bichinhos não atacam enquanto o Rei ataca nem perto de outro aviso; o Rei espera o bote/mergulho terminar |
| Pilares | 6 a 7,5 m do centro (30°, 90°, …), r 0,6 m, 3 de vida; voltam a cada fase |
| Os dois bolha | recomeça a fase atual do chefe (vida do início da fase, pilares de volta, barra de poder mantida) |
| Treino | o parceiro acompanha (não é mirado, não leva dano); quem joga, ao zerar, vira bolha e renasce ao chegar no parceiro; um cristal acende os dois; `trocarSolo` troca o personagem |

Resultado dos bots (6 sementes cada, `test/arena_balanceamento.test.ts`):

| Bot | Vitória em | Dano tomado |
|---|---|---|
| Dupla mediana (mira certa 60 % do tempo, reage a 70 % dos avisos) | 213–274 s (média ~4 min), nenhum recomeço | 17–38 corações |
| Dupla perfeita (100 % / 100 %) | 218 s (nunca < 2 min) | 0 |
| Desvia de tudo, 60 % de mira | 260–297 s | 0 (todo ataque é desviável) |
| Uma pessoa no treino (60 % / 70 %) | 436–492 s | 25–43 |

Instantâneo da rede: ~380 bytes em média e ~720 no momento mais cheio (JSON).
