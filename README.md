# Entre Dois Mundos

Aventura cooperativa para dois jogadores, no navegador, pensada para celular na horizontal (Android e iOS) e instalável como PWA.

## Como jogar (protótipo 0.1)
- **Criar sala** → aparece um código de 5 caracteres e o botão de compartilhar convite.
- O outro jogador abre o mesmo endereço, digita o código e toca em **Entrar**. Funciona em redes diferentes.
- **Treinar sozinho**: você controla um personagem por vez (botão ⇄ troca).
- Controles: joystick à esquerda; **⬆ pular** e **✋ mão** à direita. No PC: setas/WASD, Espaço, E.
- Fase de teste "A floresta dos sonhos": um segura a placa para a porteira abrir para o outro, os dois se revezam,
  e a casa na árvore só se alcança de mãos dadas (impulso) e puxando o parceiro pela mão.

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

## Desenvolvimento
```
npm install
npm run dev          # servidor local
npm test             # testes da simulação (vitest)
npm run build        # gera dist/ (site estático)
node test/e2e/dupla.mjs   # dois "celulares" conectando por código (servidor PeerJS local)
```
