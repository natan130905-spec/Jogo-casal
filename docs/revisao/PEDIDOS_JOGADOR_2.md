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

## Pedido seguinte (2026-11-24): queda secreta que leva a outra parte ou outro final
> "Tipo uma queda que leva a outra parte ou outro final do jogo."

Decisões do diretor:
- **Quedas secretas**: alguns abismos, em vez de virar bolha, levam a outro lugar quando se cai no ponto certo (pista:
  vaga-lumes descendo, brilho no fundo, som diferente). Um por capítulo em média, sempre opcional.
- Destinos: **fases secretas curtas** (ex.: "O Fundo da Caixa de Brinquedos" no cap. 1, "Raízes da Floresta" no cap. 2,
  "Engrenagens" no cap. 3, "Fundo do Mar" no cap. 4, "Caverna de Caramelo" no cap. 5, "Do Outro Lado do Espelho" no
  cap. 6) com armas únicas, habilidades, moedas e uma **lembrança secreta** cada.
- **Final alternativo**: juntando as lembranças secretas, uma queda no fim do cap. 7 (cair os dois juntos, de mãos dadas,
  no vazio do cosmos) leva ao **Mundo de Dentro da Estrela**, uma fase extra e um **final verdadeiro** diferente do normal
  (cena e música próprias). O final normal continua igual para quem não achar.
- Tudo entra no guia de segredos fora do jogo (`tools/guia_segredos.mjs` → `.segredos/`), no teste de alcance e
  funciona no solo e em dupla. Salvamento guarda quais segredos e finais foram vistos.

## Pedido seguinte (2026-11-24, tarde): luta final
> "A luta contra o boss final não tem uma mudança muito diferente, as habilidades não têm um som legal, parece que a
> gente dá muito pouco dano. Queria que tivesse várias armas, mas não que o personagem já estivesse com elas todas:
> quem estiver jogando tem que achar, e essas armas ou habilidades devem estar escondidas."

Decisões do diretor (entram no L14, depois do companheiro e da conexão):
- **Fases do Rei bem diferentes entre si** (não só mais rápido): cenário muda (a ilha racha, a noite cai, a névoa
  cobre metade), música muda por fase, ataques novos e um "momento" de dupla diferente em cada fase; o Rei muda de
  forma/tamanho.
- **Sensação de dano**: números e barras que reagem forte (pedaço da barra que cai em atraso), tremida, pausa de
  impacto de 2–4 quadros, Rei recua/achata, faíscas maiores; rever os números para os golpes "pesarem" (menos golpes
  para cair cada fase, mantendo 3–5 min no total com ataques mais intensos).
- **Sons**: cada arma/habilidade com som próprio caprichado (sintetizado em camadas ou gerado por IA de som, com
  registro de custo), som de acerto diferente de defesa, rugido por fase.
- **Armas e habilidades achadas, não dadas**: começa só com o básico; as outras ficam **escondidas** pela campanha
  (segredos, quedas secretas, baús) e na Floresta do Coração antes do Rei; quem achou leva para a luta. Várias armas
  com estilos diferentes (perto, longe, área, apoio). Entra no guia de segredos fora do jogo.
