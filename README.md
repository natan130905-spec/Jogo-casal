# Entre Dois Mundos

Aventura cooperativa para dois jogadores, no navegador, pensada para celular na horizontal (Android e iOS) e instalável como PWA.

Natan e Bruna atravessam sete mundos de sonho para juntar os pedaços da estrela do primeiro encontro. Ninguém
vence sozinho: cada capítulo tem trechos em que um precisa do outro.

Jogar: **https://natan130905-spec.github.io/Jogo-casal/** (no celular, deite o aparelho; dá para instalar como
aplicativo pelo menu do navegador, "Adicionar à tela inicial").

## Como jogar
1. **Criar sala** (quem cria joga com o Natan/P1 e escolhe os capítulos) → aparece um código de 5 letras e o botão de
   compartilhar convite. A outra pessoa abre o mesmo endereço, digita o código e toca em **Entrar** (joga com a Bruna/P2).
   Funciona em redes diferentes. **Treinar sozinho** joga os dois personagens (o botão ⇄ troca), libera todos os
   capítulos e não salva.
2. **Prólogo** em quadrinhos (toque avança, "Pular ››" pula) e o **mapa da jornada**: sete ilhas, uma por capítulo.
   Quem criou a sala escolhe e toca em **Jogar ▶**; o outro vê a mesma tela.
3. Na fase: chegue com os dois ao **pedaço da estrela** no fim e toquem nele juntos. Pelo caminho, pegue
   **estrelinhas** (★ no alto da tela) e devolva a lembrança aos **bichinhos-pesadelo** com o Lança-Estrelas ou com
   um pisão (eles estouram em brilho e viram estrelinha). As **lanternas** guardam o ponto de volta.
4. **Vida:** 3 corações cada. Sem corações você vira **bolha**: flutue até o parceiro e encoste para voltar. Se os
   dois virarem bolha, voltam à última lanterna acesa. Cair num vão não tira coração: volta ao chão seguro.
5. Ao concluir: estrelinhas do capítulo (até 3 estrelas grandes), a **lembrança** do casal e o próximo capítulo no
   mapa. No capítulo 7, ao tocarem o pedaço, o Rei-Pesadelo o arranca e foge para a **Arena do Coração** (luta em 3D,
   abaixo); vencendo, vêm a lembrança, o final e os créditos. O capítulo 7 só conta depois da arena (se saírem antes,
   o mapa oferece **Arena do Coração ⚔** no capítulo 7). O progresso fica salvo no aparelho de quem criou a sala.

### Controles
| Ação | Celular | Teclado |
|---|---|---|
| Andar (e ⬆/⬇ no fio e na argola) | joystick à esquerda | setas ou WASD |
| Pular (segure para ir mais alto) | ⬆ grande à direita | Espaço, ↑ ou W |
| Lança-Estrelas (segure: 3 por segundo) | ✨ | J |
| Mão: dar a mão (impulso), puxar, ancorar ou soltar o Fio Vermelho, agarrar argola, empurrar | ✋ | E ou Shift |
| Pausa (os dois param) | ❚❚ | Esc ou P |

Truques de casal: **de mãos dadas** (✋ perto do outro) um pulo vira impulso para alcançar o que é alto; quem está em
cima segura ✋ e puxa o parceiro. No **Fio Vermelho**, quem está firme segura ✋ (âncora) e o outro pendura, balança
com o joystick, sobe com ⬆ ou segurando o pulo e solta com ✋.

### Controles da Arena do Coração (3D, fim do capítulo 7)
| Ação | Celular | Teclado |
|---|---|---|
| Andar (relativo à câmera, que trava no Rei) | joystick à esquerda (a base vai até o polegar) | WASD ou setas |
| Golpe: Espada da Aurora / Lança de Pétala (toques seguidos = combo de 3) | ⚔ grande à direita | J |
| Lança-Estrelas (segure: 3 por segundo) | ✨ | K |
| Pular (a onda de choque passa por baixo) | ⬆ | Espaço |
| Esquiva (rolamento com invencibilidade curta) | ↻ | Shift |
| Poder da arma (barra em volta do ★; acende cheia). Os dois a até 3 s = Golpe do Fio Vermelho | ★ | Q |

HUD da arena: rostos, corações e barra de poder de cada um, vida do Rei com as 3 fases marcadas e o aviso "Usem o
poder juntos!". Detalhes da luta: `docs/ARENA_FINAL.md`.

### Capítulos
| # | Capítulo | O que tem de novo |
|---|---|---|
| 1 | Pequenos em um mundo gigante (brinquedos) | placas dos dois lados da tampa, mãos dadas, trenzinho, portão de prateleira |
| 2 | A floresta dos sonhos | dois abismos com o Fio Vermelho (um segura, o outro balança), folhas que caem |
| 3 | A cidade do tempo | ponteiros que giram (pulo na hora certa), portas duplas, portão do tempo |
| 4 | O oceano das lembranças | bolhas-elevador, argolas de pêndulo, fio entre o píer e a jangada, barquinho |
| 5 | O reino dos doces | gelatinas que quicam, biscoitos que caem, chuva de bichinhos, muro de chocolate |
| 6 | O labirinto dos espelhos | dois corredores (em cima e embaixo): a placa de cada porta está no corredor do outro |
| 7 | O coração do universo | o Fio Vermelho o tempo todo, ilhas que se movem e o Rei-Pesadelo (3 fases, ponto fraco) |

Cada capítulo tem de 184 a 220 m, 33 a 46 estrelinhas e trechos secretos; os bots de teste levam de 54 a 123 s
(um casal de verdade, de 2 a 4 minutos — estimativa, falta medir com gente).

## Tecnologia (decisões da equipe)
| Parte | Escolha | Por quê |
|---|---|---|
| 3D | Three.js | leve, maduro, roda em WebGL no Redmi e no iPhone; a equipe já domina |
| Linguagem/build | TypeScript + Vite | tipos, build rápido, divisão de código |
| Física | própria, determinística, passo fixo de 60 Hz (`src/core/sim.ts`) | plataforma 2.5D não precisa de motor físico pesado; testável em Node |
| Multiplayer | WebRTC (PeerJS): sala por código, anfitrião roda a simulação, convidado envia comandos e interpola instantâneos (100 ms) | sem servidor próprio; sinalização e TURN públicos do PeerJS atravessam redes diferentes |
| PWA | manifesto (tela cheia, paisagem) + service worker | adicionar à tela inicial e abrir como aplicativo |

## Arte
- Referência oficial: `docs/arte/conceito.png` (floresta mágica crepuscular roxo/dourado, personagens chibi).
- Tudo é procedural (geometria, shaders e texturas em canvas): nenhum arquivo de terceiros e nenhum crédito pago gasto.
  Se um recurso CC0 for usado no futuro, registre-o em `docs/arte/LICENCAS.md`.
- Cenário: `src/render/cenario.ts`, `ceu.ts`, `agua.ts`, `efeitos.ts`, `materiais.ts`. Personagens: `src/render/personagem.ts`.
- Qualidades: **alta** = sombras reais + bloom; **média** e **baixa** = Lambert e sombra-bolha (a baixa sem névoa em
  camadas). Resolução dinâmica abaixo de 40 fps (`?resfixa` desliga). `?debug=1` mostra chamadas e triângulos no HUD.
- Orçamento (Redmi Note 11, média): ≤ 80 chamadas e ≤ 250 mil triângulos. Medido em 2026-11-23 percorrendo a fase
  (Pixel 7 em paisagem): baixa ≤ 23 chamadas / 65 mil tri; média ≤ 26 / 144 mil; alta ≤ 45 / 320 mil.
- Comparação conceito × jogo: `test-out/final_comparacao.png`. Página de poses: `test/retrato/` (só no `npm run dev`).
- Elementos de jogo (2026-11-24): bichinhos-pesadelo (`bichinhos.ts`: bolotinha, morcego-sono, cogumelo-bravo,
  espinhudo e Rei-Pesadelo, com piscada, cara de dor e estouro em brilho), estrelinhas, lanternas, argolas,
  plataformas especiais e o Fio Vermelho em catenária (`elementos.ts`), partículas instanciadas em 2 chamadas
  (`particulas.ts`), temas dos 7 capítulos (`tema.ts` + adereços em `aderecos.ts`; `fase.tema` ou o capítulo escolhe;
  `?tema=` força para conferir). Medido na vitrine (Pixel 7 paisagem, oficina de mecânicas e capítulo 1): média
  ≤ 45 chamadas / 158 mil tri; baixa ≤ 33 / 65 mil; alta ≤ 59 / 355 mil (Rei na tela).
- **Medido nos 7 capítulos de ponta a ponta** (2026-11-24, `test/e2e/capitulos.mjs`, Pixel 7 em paisagem, máximo de
  chamadas / triângulos por capítulo). Padrão do jogo: **média** (a alta é só por escolha no menu).

  | Qualidade | Cap. 1 | Cap. 2 | Cap. 3 | Cap. 4 | Cap. 5 | Cap. 6 | Cap. 7 |
  |---|---|---|---|---|---|---|---|
  | baixa | 31 / 48 mil | 33 / 100 mil | 42 / 67 mil | 33 / 57 mil | 38 / 59 mil | 39 / 62 mil | 34 / 57 mil |
  | **média** (≤ 80 / 250 mil) | 35 / 64 mil | 37 / 217 mil | 46 / 114 mil | 38 / 93 mil | 42 / 98 mil | 42 / 79 mil | 42 / 91 mil |
  | alta (sombras + brilho) | 56 / 149 mil | 59 / 488 mil | 70 / 234 mil | 60 / 218 mil | 65 / 222 mil | 68 / 185 mil | 64 / 204 mil |
- Vitrine dos elementos (só no `npm run dev`): `test/vitrine/?fase=<id>&tema=<chave>`; capturas automáticas:
  `PORTA=4821 node test/vitrine/capturar.mjs [cena…]` → `test-out/vitrine/`.

## Desenvolvimento
```
npm install
npm run dev          # servidor local
npm test             # testes da simulação (vitest)
npm run build        # gera dist/ (site estático)
node test/e2e/dupla.mjs   # dois "celulares" (Pixel 7 × iPhone 14) conectando por código (servidor PeerJS local)
node test/e2e/capitulos.mjs treino baixa,media,alta   # os 7 capítulos de ponta a ponta, medindo o orçamento
node test/e2e/capitulos.mjs dupla                     # os 7 capítulos em dupla, conferindo a sincronia
node test/e2e/arena.mjs [treino|dupla]                 # Arena do Coração: controles, HUD, luta inteira, final e créditos
```
Os testes e2e usam o `dist/` (rode `npm run build` antes). Para jogar um capítulo inteiro no navegador, eles gravam as
entradas dos bots cooperativos (`test/fases/bot.ts` e `test/fases/planos/`) na simulação em Node e as reproduzem no
jogo com `window.__edm.roteiro(lista)` (a simulação é determinística); `window.__edm.acelerar(k)` encurta o tempo.
O `dupla.mjs` confere: sala, prólogo, mapa, andar, pular, tiro do convidado, pausa, o capítulo 1 inteiro (tiro em
bichinho, estrelinhas, mesmo placar e posições nos dois, capítulo concluído, progresso salvo) e a conexão perdida.
Capturas em `test-out/` e `test-out/capitulos/`. Portas: `PORTA` (preview) e `PORTA_SINAL` (PeerJS).
