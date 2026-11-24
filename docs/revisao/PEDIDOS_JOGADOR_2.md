# Pedido do jogador (2026-11-24, depois de jogar a versão com a arena)

> "O jogo ficou muito legal, mas tá feio ainda: estude o que pode ser feito para melhorar o gráfico (otimização é muito
> importante também), ajuste esses sons de pulo que estão muito estranhos. Sinto que a luta do final é meio pequena:
> queria que o mapa fosse gigante e a gente tivesse que ir explorando uma floresta adentro com vários bichos até o boss."

## Decisões do diretor
1. **Som do pulo**: o arquivo `sfx_pulo.mp3` durava 1 s (efeito gerado genérico). Trocado por um "puín" sintetizado
   em `src/ui/som.ts` (`pulo()`): 0,16 s (superpulo 0,26 s), Natan mais grave e Bruna mais aguda, ±4 % de variação.
   Vale no 2.5D e na arena. Revisar os outros efeitos (todos têm 1 s) na mesma passada de som.
2. **Gráfico**: o Lote 0 (agente arte-luz) ataca o esbranquiçado e a hierarquia de valor. O plano da revisão deve
   ter um lote de arte de verdade (fundos pintados por capítulo, texturas pintadas/atlas, vegetação viva, modelos
   melhores) com orçamento de desempenho por qualidade e medição em aparelho (?diag=1).
3. **Final grande**: o capítulo final 3D deixa de ser só a arena. Passa a ser uma **expedição 3D**: a
   **Floresta do Coração**, um mapa grande (ordem de 300–500 m de percurso, com trilhas, clareiras, rio, ponte,
   cavernas e segredos), que vocês exploram floresta adentro, com bichos-pesadelo em grupos, baús com armas/munição
   (sistema novo de armas), lanternas de checkpoint, pequenos puzzles de dupla, e no coração da floresta a Arena do
   Coração com o Rei. Usa o núcleo da arena (`src/core/arena`) estendido para mundo aberto em zonas (carregamento por
   zona, LOD, instancing de árvores) para caber no celular.

## Pedido seguinte (2026-11-24): caminhos secretos com easter eggs
> "Quero que tenha alguns caminhos secretos que tenham easter eggs como arma diferente, habilidades diferentes, moedas;
> só me passe fora do jogo onde estão cada um e o que são."

Decisões do diretor:
- Cada capítulo (e a Floresta do Coração) ganha **2–3 caminhos secretos** de verdade (parede falsa, cipó escondido atrás
  do primeiro plano, cano/toca, nuvem alta, sala atrás da cachoeira), com pista visual discreta (não invisível por
  azar: tem que ser descobrível por quem explora).
- Recompensas: **armas únicas** (só existem no segredo), **habilidades** permanentes da campanha (ex.: pulo duplo, botas de
  impulso, guarda-chuva planador, mergulho, abraço que cura), **moedas** (moeda do casal, gastas na casa compartilhada em
  roupas/decoração/minigames) e easter eggs de casal (fotos, recados).
- Tudo coletável no solo (o companheiro ajuda) e em dupla; teste automático de alcance cobre os segredos.
- **Guia fora do jogo**: gerado automaticamente dos dados das fases por `tools/guia_segredos.mjs` (para nunca ficar
  desatualizado), entregue ao jogador como arquivo e **não publicado** no repositório público (a pasta `.segredos/`
  fica no .gitignore). O repositório é público: os dados das fases ficam no código, mas o guia legível não.
