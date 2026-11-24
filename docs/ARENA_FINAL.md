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
