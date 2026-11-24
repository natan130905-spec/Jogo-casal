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
