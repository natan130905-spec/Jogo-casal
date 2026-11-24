# Lote 0 · camera-hud — câmera por jogador, indicador do parceiro, squash & stretch

Base: `PESQUISA_ARTE_CAMERA.md` §6 e plano #2, #3 e #9. Código: `src/render/camera.ts` (lógica pura),
`src/render/cena.ts`, `src/ui/indicador.ts`, `src/ui/partida.ts`, `index.html`/`src/estilo.css` (só o indicador),
`src/render/personagem.ts` (squash & stretch).

## O que mudou
- Cada celular segue **o próprio personagem** (convidado = Bruna; anfitrião = Natan; treino = o controlado, ⇄ troca a
  câmera junto). FOV 35°, personagem a **23 %** da altura, olho 1,7 m acima dos pés **sem inclinar** (pés a 30 % por
  deslocamento de lente), zona morta ±0,35 m, foco à frente 1,0→1,8 m, encaixe na plataforma (pulo não mexe y),
  enquadra os dois até 8 m (some entre 8 e 12 m), afastando até 15 %. Suavização por meia-vida (igual em 30 e 60 fps).
  Trava dura: o próprio personagem nunca sai do quadro (queda rápida, gelatina).
- **Estrelinha alta**: com a câmera nova o topo da tela fica 3,35 m acima dos pés (antes ~4,6 m). Quando há
  estrelinha não pega até 2–3,2 m na horizontal e acima do quadro, os pés descem na tela (até 18 %) e, se faltar,
  a câmera afasta (no pior caso, cap. 5 #14 a 4,5 m, o personagem fica a ~18 %).
- **Indicador do parceiro** (44 px, rosto do outro, seta, distância em m) preso à borda do lado dele, a ≥ 12 px dos
  botões, joystick e HUD (retângulos remedidos a cada ~0,5 s). Pulsa vermelho (“ajuda”) em bolha, pendurado no fio ou
  2 s depois de dano; mostra ✋ quando ele segura o fio ou está numa placa. Some na arena 3D.
- Squash & stretch: 1,15 na saída do pulo e 0,85 no pouso, ~110 ms (antes: só 0,80 no pouso por 200 ms).

## Medidas
Por projeção (`test/camera.test.ts`, câmera do Three montada como no render, todos os ticks das partidas dos bots,
câmera do Natan e da Bruna, 844×390 e 750×340). Altura do personagem em % da tela, mediana / 10 % piores / mínimo:

| Cap. | antes (câmera compartilhada) | depois, câmera do Natan | depois, câmera da Bruna | quadros normais | % do tempo normal |
|---|---|---|---|---|---|
| 1 | 17,7 / 13,4 / 10,7 | 22,9 / 20,2 / 17,0 | 23,0 / 20,4 / 15,8 | 22,1–23,0 | 53 % |
| 2 | 17,4 / 11,7 / 8,5 | 22,8 / 18,3 / 15,2 | 22,8 / 18,8 / 15,4 | 22,0–23,0 | 46 % |
| 3 | 15,7 / 8,6 / 6,4 | 22,3 / 18,9 / 16,2 | 22,4 / 19,5 / 16,5 | 22,2–23,0 | 41 % |
| 4 | 16,3 / 11,4 / 8,6 | 22,6 / 16,0 / 15,0 | 22,7 / 19,0 / 15,4 | 21,9–23,0 | 47 % |
| 5 | 14,8 / 7,9 / 6,5 | 22,4 / 19,3 / 16,7 | 22,6 / 20,0 / 17,0 | 22,3–23,0 | 39 % |
| 6 | 17,4 / 10,2 / 10,1 | 21,9 / 16,9 / 15,5 | 22,1 / 17,0 / 15,9 | 22,2–23,0 | 38 % |
| 7 | 17,9 / 8,0 / 8,0 | 23,0 / 18,1 / 15,3 | 23,0 / 19,2 / 15,4 | 21,9–23,0 | 72 % |

“Quadro normal” = o alvo da câmera é o enquadramento-base (sem afastar para o parceiro nem para estrelinha) há ≥ 2 s.
Fora disso a câmera está enquadrando os dois (os bots andam quase sempre a 2–8 m um do outro) e fica entre 15 % e 23 %.
Dados: `medidas_projecao_bots.json`.

No navegador (`tools/revisao/camera-hud/verificar.mjs`, câmera REAL do render via `__edm.camera()`): 49 pontos dos
7 capítulos, todos ≥ 15,2 %, normais 22,6–23,0 % (`verificar_844x390.log`). Indicador: 720 quadros com a Bruna
afastando e voltando, 0 divergências entre “indicador visível” e “centro dela fora do quadro” (aparece no mesmo
quadro); folga mínima 13,3 px (844×390) e 12,5 px (750×340) dos controles/HUD em 7 direções; estado “ajuda” na bolha.

Chamadas / triângulos (`capturas_*.json`, média, 844×390, 14 quadros): todos ≤ antes. Ex.: cap. 2 início
33 → 32 ch e 206 → 183 mil; cap. 5 meio 37 → 29 ch; cap. 6 meio 33 → 28 ch e 69 → 53 mil.

Imagens: `antes_depois_p012.webp` e `antes_depois_p05.webp` (mesmo tick e mesmas entradas dos bots,
`tools/revisao/capturas.mjs --q media --tam 844x390@1 --hud`; antes = f6a32a9, depois = f6a32a9 + só estas
mudanças), `indicador_*.webp`.

## Limites
- Sem GPU: fps não medido. A câmera do convidado segue a Bruna com os ~100 ms de interpolação da rede (hipótese da
  pesquisa: pode parecer atrasado; não medido em dupla real).
- Não feitos (P1, fora do escopo): regras de afastamento 12/24 m e “Ir até”, zonas de câmera por fase (mecanismos de
  dupla, chefe), zoom de 30 % nos momentos do casal.
