# Plano de execução da revisão geral — Entre Dois Mundos

Autor: diretor técnico e de produção · 2026-11-24 · base: `main` em `f6a32a9` + lote de arte-luz ainda não commitado
em `src/render/` (ver §1.2).
Fontes: `ARTE_DIAGNOSTICO.md`, `PESQUISA_ARTE_CAMERA.md`, `AUDITORIA_MOVIMENTO.md`, `DESIGN_ARMAS.md`,
`ARQUITETURA_MODOS.md`, `NARRATIVA_CASAL.md`, `TECNICO_DESEMPENHO.md`, `PLAYTEST.md`, `PEDIDOS_JOGADOR_2.md` e o
código. Registro de problemas e lições: `docs/revisao/REGISTRO.md` (ids `R01…`, citados aqui entre colchetes).

Este documento é para a equipe que vai **implementar**. Cada lote diz o objetivo, os arquivos, quem faz, do que
depende, com quem pode rodar em paralelo sem conflito de arquivos, o critério de aceite medível e como comparar
antes/depois.

---

## 0. Resumo

### 0.1 Para o jogador (em português simples)

- **Por que a qualidade alta ficava "lavada".** Um efeito de brilho espalhava a luz do céu pela tela inteira. Isso foi
  medido: sem ele, as cores e os escuros voltam. Já está sendo trocado por um brilho que só acende lanternas, janelas e
  estrelas. A água e os vaga-lumes também estavam com a cor errada (o lago saía azul-claro em vez de azul-marinho), e
  isso já foi corrigido.
- **Por que ainda não parece a arte.** O chão é o mesmo bloco em todos os mundos, só muda a cor. A câmera vê o chão
  de cima, como um tabuleiro. Falta contorno de desenho no cenário, falta uma moldura escura na frente e o fundo é
  claro demais. Os personagens ficam pequenos (de 6 % a 18 % da altura da tela; na arte são uns 22 %) porque uma câmera
  só tenta mostrar os dois, mesmo longe um do outro.
- **Estrelas que "não dá para pegar".** Testamos 6 milhões de pulos no computador e todas as 238 estrelinhas podem ser
  pegas. O que atrapalhava era outra coisa:
  - o pulo não perdoava: não dava para pular um instante depois de sair da beirada, e um toque rápido subia pouco;
  - algumas estrelinhas ficavam fora da tela ou num arco que não batia com o pulo de verdade;
  - 6 eram "segredos de dupla" sem nenhum aviso;
  - no celular da Bruna, o boneco dela responde com uns 0,2 s de atraso.

  O pulo e essas estrelinhas já foram corrigidos e agora um teste automático confere tudo. O atraso da Bruna entra
  neste plano.
- **Jogar sozinho não existe hoje.** O "treino" deixa o outro personagem parado, e cada capítulo precisa de 4 a 8
  ajudas do parceiro (placa, mãos dadas, fio). Também:
  - o progresso fica só no celular de quem criou a sala;
  - nada é salvo no meio do capítulo;
  - se a internet cai, os dois param.
- **Trocar os poderes por armas de brinquedo não quebra nenhum puzzle, porque hoje nenhum puzzle usa o tiro.** O
  cuidado é com a munição: se ela acabar no lugar errado, o jogo trava. Por isso existe uma regra: todo obstáculo
  obrigatório se vence com algo que nunca acaba (o estilingue de 3 pedrinhas que voltam, a espada de papelão).
- **Celular.** Achamos problemas no jogo de hoje:
  - se a Bruna sai do app com o dedo no controle, a personagem dela continua andando;
  - não dá para pausar com o polegar no joystick;
  - os botões tapam 15–28 % das estrelinhas;
  - ao tocar em Jogar, a tela congela vários segundos sem aviso;
  - a qualidade alta perde o antialias e gasta 3× mais memória de vídeo.
- **O plano.** Primeiro fazemos o **capítulo 1 inteiro do jeito novo**: arte nova, câmera nova, armas de brinquedo,
  companheiro controlado pelo jogo, falas e carinhos do casal, salvamento. Vocês jogam esse capítulo e aprovam. Só
  então os outros 6 capítulos são refeitos no mesmo padrão. Depois vêm a Casa, os minigames, os segredos e a Floresta
  do Coração.

### 0.2 Para a equipe (as 12 decisões que guiam o resto)

1. **Fatia vertical = capítulo 1 completo** (arte, câmera, física, armas MVP, companheiro, casal, salvamento,
   desempenho). O companheiro precisa vencer **os capítulos 1 e 2 no núcleo** (vitest), porque o fio do cap. 2 é o
   maior risco técnico dele e não depende de arte (§3).
2. **Câmera por celular**, seguindo o próprio personagem: 23 % da altura da tela. Ela enquadra os dois até 8 m e, nos
   pontos de cooperação, usa uma zona de câmera que mostra os dois. Além disso há um indicador do parceiro na borda.
   O Fio Vermelho cuida do afastamento (C2).
3. **Predição local do convidado entra na fatia.** A câmera seguindo a Bruna deixa o atraso de 220 ms mais visível,
   e esse atraso é a causa mais provável de "não alcanço" no celular dela (C5).
4. **Regra do recurso infinito** para todo obstáculo obrigatório. Ferramentas de travessia só agem em elementos
   marcados na fase (C3).
5. **Orçamento oficial** = tabela do Redmi Note 11 de `TECNICO_DESEMPENHO §11`. A arte gasta o extra da alta em
   detalhe, resolução e antialias, nunca em pós-processo (C1).
6. **Personagens continuam procedurais no 2.5D**, melhorados com rampa dura, contorno em pixels, squash e
   acessórios, porque rostos, expressões e roupas dependem disso. Um experimento lado a lado decide se os GLB entram
   (C11).
7. **Arena: só troca de pele**, com os mesmos números, feita pela equipe da arena. A campanha solo usa o modo treino
   da arena, que já vence sozinho, até o aliado IA existir (C7).
8. **Uma pessoa dona de cada arquivo por onda** (§4.2). Um assunto por commit. Toda mudança visível tem captura
   antes/depois nos mesmos enquadramentos (§5).
9. **Nenhum lote fecha só "com teste verde".** Cada um tem um número de imagem, de alcance, de bot, de e2e ou de
   orçamento.
10. **Créditos pagos só com autorização explícita do responsável, com teto por lote** (§8). A fatia pede ≈ 25
    Higgsfield + ≈ 130 Meshy.
11. **O que já foi feito não se refaz**: o Lote 0 (§1.2) fecha com os critérios dele antes de a fatia começar a mexer
    em `src/render/`.
12. **Dicas, balões e plano B são um sistema só** (C16), com um dono, alimentado pelo roteiro.

---

## 1. Ponto de partida

### 1.1 O que NÃO muda (identidade e contrato)

- **História e elenco.** Natan (lenço vermelho, óculos de aviador), Bruna (roxo, coquinhos), Dona Lume, a Névoa e os
  bichinhos-pesadelo. Os bichinhos **estouram em brilho e viram estrelinha**: ninguém morre. Continuam os 7 capítulos
  na mesma ordem e com as mesmas lembranças, o final "Algumas coisas a gente não precisa lembrar sozinho." e o
  Fio Vermelho vermelho.
- **Jogo de casal cooperativo.** Sem o parceiro (pessoa ou companheiro), nenhuma fase chega ao fim (teste
  `SOLO_ATE`). Mãos dadas, placas, Fio Vermelho, argolas e pisão continuam sendo o coração. As armas complementam.
- **2 celulares, cada um com o seu personagem.** A rede é por **código de sala** (PeerJS, WebRTC, sem servidor
  próprio). O anfitrião simula e o convidado manda entradas. Celular na horizontal, PWA, navegador, Three.js +
  TypeScript + Vite.
- **Núcleo puro e determinístico** (`src/core`, 60 Hz, sem `Math.random`, sem DOM), os ganchos `window.__edm` e a
  reprodução por `roteiro`. Toda medida deste plano depende disso.
- **Física medida e travada** (`docs/NUCLEO.md`, `test/sim.test.ts`): pulo 1,75 m / 3,64 m, superpulo 4,40 m,
  coyote 6, buffer 7, pulo mínimo 8, quina dos pés 0,20 m, **cabeça 0,32 m** [R13]. Mudança de `FISICA` só com nova
  rodada de alcance.
- **O que o playtest mandou preservar** (`PLAYTEST §7`): multitoque com `pointerdown`, curva do joystick, tiro
  segurado, área segura, tamanho dos botões de jogo, bolha em vez de "game over", vão que não tira coração, squash nas
  animações, catenária do fio, prólogo pintado e a estrela do mapa.
- **Arte conceitual `docs/arte/conceito.png`** como alvo, mais os 7 style frames
  `docs/revisao/img/arte-diagnostico/alvo_cap1…7.webp`.
- **Arquivos da equipe da Arena** (`src/core/arena`, `src/render/arena`, `src/ui/partidaArena.ts`, `hudArena.ts`,
  `test/arena*`): este plano só pede coisas a ela (L14), não mexe neles.

### 1.2 O que já foi feito (Lote 0, 2026-11-24)

| Assunto | Estado | Onde |
|---|---|---|
| Coyote 6, buffer 7, pulo mínimo 8, quina dos pés 0,20 m, pisão com `lancado` | **commitado** | `572e276`; números em `NUCLEO.md` |
| Estrelinhas das gelatinas na trajetória real; relógio grande à vista; marca de mãos dadas | **commitado** | `f79a88a` |
| Teste permanente de alcance de todo coletável (busca rápida, folga ≥ 15) | **commitado** | `3ac475a` (`test/fases/busca.ts`, `fases_alcance*.test.ts`) |
| Abismos do fio de 5,6 → 6,2 m (com o coyote passavam sozinho) + teste de solo | **commitado** | `7cca84c` |
| Água e vaga-lumes em sRGB; mesma curva de tons nas três qualidades | **commitado** | `f4ccace` |
| Som do pulo sintetizado | **commitado** | `28b64c5` |
| Bloom seletivo (marca no alfa, ¼ de resolução, força 0,3, raio 0,3, `?bloom=0`) | **em andamento, sem commit** | `src/render/pos.ts` |
| Paleta nova (silhuetas e névoa médias, `estilo` por capítulo), rampa de toon macia no cenário, névoa só atrás, primeiro plano escurecido no shader, AO assado, sorteio independente da qualidade, borda da frente baixa, cascatas só com água | **em andamento, sem commit** | `tema.ts`, `materiais.ts`, `cenario.ts`, `aderecos.ts`, `ceu.ts`, `elementos.ts`, `bichinhos.ts`, `test/render_cenario.test.ts` |

| Câmera por jogador (`CAM`: FOV 35°, 23 %, olho 1,7 m, zona morta, foco à frente, encaixe; baixa os pés para mostrar estrelinha logo acima) e indicador do parceiro | **em andamento, sem commit** (apareceu durante esta etapa) | `src/render/camera.ts`, `src/ui/indicador.ts`, `test/camera.test.ts`, `src/ui/partida.ts`, `src/estilo.css`, `index.html` |

O L0 (§6) fecha esse trabalho com números antes de qualquer outro lote tocar em `src/render/`. A câmera em andamento
**é o início do L3a**: o L3a fecha esse trabalho com os critérios dele (não recomeça). Atenção ao §4.2: ela já mexe em
`partida.ts` e `estilo.css`, que na onda A são do L1a. O L1a começa depois que a câmera for commitada, ou a câmera e
o L1a combinam a ordem de merge.

---

## 2. Conflitos entre as recomendações e as decisões

| # | Conflito | Decisão | Por quê |
|---|---|---|---|
| **C1** | **Arte × desempenho.** A arte quer mais detalhe, contorno, primeiro plano, mundo vivo e fundos pintados; o técnico mede a alta com 135–155 MB de VRAM, 488 mil triângulos e sem AA. Os orçamentos divergem: arte "alta ≤ 60 ch / 300 mil", README "média ≤ 80 / 250 mil", técnico "Normal ≤ 60 / 220 mil (Redmi)". | Vale a **tabela do Redmi** (`TECNICO §11`), resumida em §5.3. A arte ganha o extra **só** como detalhe de geometria e vegetação perto da câmera, resolução e AA. Contorno por casco só em personagens, bichinhos, coletáveis e bordas (nunca Sobel de tela). Sombra real só nos dinâmicos, 1024². Bloom seletivo do L0 mantido, com MSAA no alvo (`samples: 4`). Se a VRAM da alta passar de 90 MB, a alta fica sem compositor. Fundos pintados são cartões com `alphaTest`, 1 chamada por camada, WebP e, se a VRAM apertar, KTX2. | É o aparelho mais fraco do casal. A medida mostra que o custo está em pixels e passes, não em triângulos. "Alta mais bonita, não mais efeito" é o pedido do jogador. |
| **C2** | **Câmera por jogador × Fio Vermelho e cooperação.** A câmera por celular resolve o tamanho, mas o casal pode se perder um do outro e os mecanismos de dupla ficam fora do quadro. | (a) Enquadra os dois quando estão a até 8 m (até 15 %). (b) **Zonas de câmera geradas dos `PontoCoop`** do mapa de apoio (L2a): no gatilho, os dois celulares mostram os dois e o mecanismo (15–18 %). (c) Indicador do parceiro na borda com estado ("precisa de ajuda", "na placa"). (d) Afastamento fora das zonas de fio: livre até 12 m, aviso de 12 a 24 m, acima de 24 m quem se afasta anda a 60 %. **"Ir até" = reagrupar como bolha** (mesma mecânica do companheiro, sem teleporte escondido). (e) O cap. 6 marca os corredores como "separados de propósito", sem puxão. | Mantém personagens grandes (23 %) sem perder o "casal na tela". Usa a mecânica que já existe (bolha) e os dados que o companheiro também precisa. |
| **C3** | **Armas × puzzles antigos.** Munição finita trava os caps. 3, 5 e 7. As ferramentas (Guarda-sol, Arco, Vara-Gancho) podem pular trechos de casal. As 6 estrelinhas de dupla correm o risco de virar solo. | **Regra do recurso infinito** (A2/A3). A lista de **combate forçado** (cap. 3 x 84–92; Rei do cap. 7) entra em teste. **Ferramentas só agem em elementos marcados** e o grafo de alcance roda de novo com cada aresta nova (A4). As 6 estrelinhas de dupla **continuam de dupla** (Bumerangue só horizontal); no solo, o companheiro dá a mão. Na fatia, só o MVP: Estilingue, Espada e Martelo, e alvo-sino, barbante e bloco rachado como usos **opcionais** no cap. 1. | Nenhum puzzle de hoje usa o tiro: a troca é segura desde que a munição nunca seja a chave do caminho. |
| **C4** | **Disputa pela tela e pelos polegares.** O playtest quer botões mais baixos e transparentes. As armas acrescentam ⇆ e a roda. A narrativa quer o leque de emotes no próprio rosto. A arquitetura quer comandos no rosto do parceiro. A câmera quer o indicador na borda. O HUD de hoje já tapa estrelinhas. | **Um só layout, um só dono (L5)**, com uma tabela de retângulos por resolução (844×390, 844×340 Safari, 873×393, 915×412) e quatro testes ao mesmo tempo: A9 (sem sobreposição, Ø e espaço), T-U1 (balões fora dos polegares), `projecao.mjs` (estrelinhas ≤ 8 %, bichinhos ≤ 10 %) e indicador ≥ 12 px dos botões. Zona dos polegares: só jogo. Topo esquerdo: meu rosto (emotes). Topo direito: rosto do parceiro (comandos). Bordas laterais a 30–60 % da altura: indicador. Centro do topo: só ★ e ❚❚. | Quatro equipes desenharam a mesma área: sem dono único, cada lote quebra o do outro. |
| **C5** | **Predição local.** A auditoria pede P0 e o técnico P2 ("grande"). | **Fatia (L3b)**: predição só do próprio personagem + entradas com tick e redundância (6) + coyote de rede preenchido pelo anfitrião (`toleranciaRede` já existe no núcleo). O canal não confiável e o buffer adaptativo ficam no L13. | A câmera seguindo a Bruna mostra o atraso dela o tempo todo. O núcleo já é determinístico e o campo `seq` já existe. |
| **C6** | **Quina da cabeça 0,20 m** (auditoria) × medida do Lote 0 (206 pares sem saída no cap. 3). | **Fica 0,32 m** até o trecho do cap. 3 ser redesenhado em R3 (L10). Ali se testa de novo com 0,20. | Medido [R13]. |
| **C7** | **Companheiro na Arena** (arquitetura) × arquivos da equipe da Arena. | Até a equipe da Arena entregar o aliado IA (`BotArena`), a campanha solo entra na arena no **modo treino** dela, que já vence sozinho em 436–492 s com um botão que acende os dois cristais. É um pedido formal à equipe (L14). | Não bloqueia o solo e não mexe nos arquivos dela. |
| **C8** | **Onde fica o Treino.** As armas o colocam no quintal da Casa; a arquitetura quer uma fase própria e "qualquer capítulo em modo treino". | **Fase própria `treino-quintal`**, aberta do menu, com chave `edm-treino-v1`. Na fatia, uma versão **mínima**: a oficina `EXEMPLO_MECANICAS`, bonecos e as 3 armas MVP, tudo liberado, física idêntica. A porta na Casa vem depois (L11). | O jogador pediu treino separado já. A Casa é P1/P2. |
| **C9** | **Câmera baixa × grama da borda tapando os personagens.** | Olho a 1,7 m e borda da frente ≤ 0,25 m (o teste já existe no L0, `render_cenario.test.ts`). Mais o teste de oclusão (raio câmera → cabeça e peito, 100 posições por fase). | Medido no experimento (`olho1_grama_tapa.webp`). |
| **C10** | **Roteiro com detalhes [REAL] × site público.** | Na fatia, só textos genéricos. Os [REAL] vão em `public/cartas.bin` cifrado (AES-GCM/PBKDF2) no L11, e o texto original nunca entra no git. | Risco confirmado: todo texto vai no pacote JS. |
| **C11** | **Personagens procedurais × `natan.glb`/`bruna.glb`.** | A fatia **melhora o procedural** (rampa `NearestFilter`, contorno em px de tela, squash, mochila/óculos/lenço com mola, 8 expressões). Um **experimento lado a lado** (retrato + 3 capturas do cap. 1, procedural × GLB com os mesmos ossos-pose da arena) decide. O GLB só entra se vencer na revisão com o jogador **e** couber em ≤ 2 chamadas e ≤ +600 KB (meshopt). | Expressões em canvas, roupas e poses de carinho dependem do procedural, que custa 0 crédito. A arena prova que o GLB funciona, mas ele pesa 457 KB por personagem com meshopt. |
| **C12** | **Floresta do Coração (mundo 3D grande) × celular.** | Entra só **depois da fatia e da replicação**, em zonas com carregamento por zona, instancing de árvores e LOD, com o mesmo orçamento da arena. Usa o núcleo da arena estendido (equipe da arena) e o arsenal da campanha. | Decisão do diretor em `PEDIDOS_JOGADOR_2`. Sem o arsenal e o companheiro prontos, seria refeito. |
| **C13** | **Roda de armas no online** (não pausa) × solo (30 % de velocidade). | Aceito como no desenho. No online, toque curto no ⇆ e arrasto direto, sem esperar a roda abrir. | A simulação é uma só para os dois. |
| **C14** | **Quantidade de falas.** O roteiro do cap. 1 dá ≈ 135 s de balão; o alvo é ≤ 90 s. | Cortar para ≤ 90 s por passada típica **antes** do playtest humano. Métrica: soma dos tempos de leitura dos balões que disparam com os bots. | Evita poluir a tela pequena. |
| **C15** | **Estrelas grandes.** O playtest quer 3 estrelas só com 100 %; a arquitetura usa 50/75/100 % pela união das passadas. | 1ª estrela com 50 %, 2ª com 75 %, **3ª só com 100 %** (união). A tela de concluído diz quantas faltam e onde ("no alto da prateleira"). | As duas propostas são compatíveis. |
| **C16** | **Três sistemas de ajuda.** O playtest pede dica na primeira vez; a arquitetura tem o plano B aos 20/45/60 s; a narrativa tem o pool `dica` de falas. | **Um sistema** (`src/ui/dicas.ts` + roteiro). A primeira vez dispara o balão da dica do roteiro. Aos 20 s vem a mesma dica com seta e botão piscando. Aos 45 s, "Deixa comigo". Aos 60 s, o Atalho da Dona Lume. O `#aviso` serve de reserva para quem desliga os balões. | Uma voz, sem duas mensagens ao mesmo tempo. |
| **C17** | **Entrada remota velha.** O playtest quer neutro em 250 ms e pausa em 2 s; a arquitetura quer a IA assumindo em 1 s, sem pausa. | **Em etapas.** L1: neutro em 250 ms e pausa com aviso em 2 s. L11, com o drop-in pronto: neutro em 250 ms, IA em 1 s (histerese de 10 entradas para devolver) e a queda não pausa. | Corrige o crítico já, sem esperar o companheiro. |
| **C18** | **Qualidade inicial.** Hoje é `media` fixa; o técnico propõe a escolha pela GPU. | Continua `media` até haver ≥ 2 relatórios `?diag=1` reais (Redmi e iPhone). Depois, `qualidadeInicial()` + governo (L13). | Os limiares precisam de medida no aparelho. |
| **C19** | **Um capítulo para a fatia: 1 ou 2.** | **Cap. 1** (com o companheiro também fechando o cap. 2 no núcleo). | O cap. 1 é a primeira impressão e é o mais "lavado" (L\* 62 na alta). As armas MVP e o roteiro completo já estão desenhados para ele, e ele tem 2 dos 4 papéis do companheiro (placa e mãos dadas). O papel de fio é provado no cap. 2 sem depender de arte. |

---

## 3. A fatia vertical (capítulo 1 inteiro)

**O que é "pronto" para a fatia.** O casal joga o capítulo 1 do começo ao pedaço da estrela, **sozinho** (com o
companheiro) e **em dupla** (dois celulares), na nova arte, com a nova câmera e as armas MVP, ouvindo e vendo o casal
falar e se abraçar. Fecha o app no meio, volta na lanterna e termina. Tudo isso dentro do orçamento do Redmi.

| Pilar | Lotes | Resultado visível |
|---|---|---|
| Plataforma e UX crítica | L1 | pausa com o polegar no joystick, nada anda sozinho em segundo plano, tela de carga, sem fps na tela, confirmação ao sair |
| Núcleo, salvamento e solo | L2a, L2b | campanha abre sem sala, "Continuar" na lanterna, progresso nos dois aparelhos, Quintal mínimo |
| Câmera e rede | L3a, L3b | personagens com 23 % da tela, indicador do parceiro, Bruna sem atraso no próprio pulo |
| Armas MVP | L4 | Estilingue de Xuxinha, Espada de Papelão, Martelo, alvo-sino, barbante, bloco rachado |
| Controles e HUD | L5 | joystick flutuante, ATACAR, ⇆, roda, rostos com emotes e comandos, indicador sem tapar o jogo |
| Companheiro | L6 | segue, luta, segura placa, dá a mão, ancora o fio (cap. 2 no núcleo), plano B |
| Arte do cap. 1 | L7 | quarto de brinquedos com chão próprio (tapete, trilho, livros), marcos (urso, blocos ABC, janela), primeiro plano escuro, contorno, vida |
| Casal | L8 | balões e roteiro do cap. 1, convites (toca aqui, abraço, dança), caixinha de música, Seu Algodão, sons |
| Portão | L9 | todas as medidas da §5 + o casal jogando de verdade |

---

## 4. Ordem, dependências e paralelismo

### 4.1 Grafo

```
Onda A (agora, em paralelo)
  L0 Fechar arte-luz (src/render)        L1 UX/plataforma P0 (src/ui, main, css, sw?)     L2a Núcleo: colisão, manobras, apoio, afastamento (src/core, tools, test/fases)
        │                                        │                                                 │
Onda B  ├──► L7 Arte cap.1 (render)              ├──► L2b Assentos + salvo v2 + retomar + Quintal  │
        ├──► L3a Câmera por jogador (cena.ts) ◄──┼──────────────────────────────────── apoio ◄─────┤
        │                                        │                                                 ├──► L4 Arsenal MVP (core + rede + salvo)
        │                                        └──► L8a Balões e roteiro (src/ui/baloes, roteiro)│
Onda C  L3b Predição do convidado (após L4 em instantaneo.ts)                                     │
        L5 Controles e HUD unificados (após L3a, L4, L8a)                                         │
        L6 Companheiro + plano B + comandos (após L2a, L2b, L4) ◄─────────────────────────────────┘
        L8b Emotes, convites, poses, expressões, sons (após L5)
Onda D  L9 PORTÃO DA FATIA (cap. 1)  ── reprovado → volta ao lote dono do critério
Onda E  L10 Replicação: R2…R7 (um capítulo por equipe, em paralelo)
Onda F  L11 Modos completos e Casa · L12 Segredos, quedas secretas, final verdadeiro · L14 Arena re-skin + Floresta do Coração
Contínuo (arquivos próprios, em qualquer onda depois de L1): L13 Plataforma P1/P2
```

### 4.2 Dono de cada arquivo por onda (evita conflito)

Regra: numa onda, cada arquivo tem **um** lote dono. Outro lote que precise dele pede ao dono ou espera a próxima
onda. Arquivo novo é do lote que o cria.

| Arquivo | Onda A | Onda B | Onda C | Onda E (replicação) |
|---|---|---|---|---|
| `src/render/pos.ts`, `tema.ts`, `materiais.ts`, `ceu.ts`, `cenario.ts`, `aderecos.ts` | L0 | L7 | L7 | R*: só o kit do próprio capítulo (`src/render/kits/capN.ts`); `cenario.ts` com API congelada (mudança só pelo dono de L7) |
| `src/render/cena.ts` | — | L3a | L3a | congelado |
| `src/render/personagem.ts` | — | L7 | L8b (poses e expressões) | congelado |
| `src/render/elementos.ts`, `bichinhos.ts` | L0 | L4 (projéteis, alvos, baús) | L7 (contorno) | R* pede ao dono |
| `src/ui/partida.ts` | L1 | L2b (assentos) → L3a (eu/parceiro), nesta ordem, na mesma onda | L3b → L5 | congelado |
| `src/main.ts`, `src/ui/telas.ts` | L1 | L2b | L5 | congelado |
| `src/estilo.css`, `src/input/controles.ts` | L1 (pointerdown, confirmações) | — | L5 | congelado |
| `src/net/rede.ts`, `src/core/instantaneo.ts` | L1 (`visibilitychange`, entrada expira) | L4 (arsenal no instantâneo) | L3b (tick nas entradas, predição) | — |
| `src/core/sim.ts`, `types.ts` | L2a (afastamento, só um bloco) | L4 | L6 (só `Input.emo`, para L8b) | R*: nada |
| `src/core/colisao.ts` | L2a | — | — | R3: `QUINA_CABECA` |
| `src/core/fases/capN_*.ts` | L2a (campo `apoio`) | L4 (cap. 1: baús e alvos) | — | R*: o próprio |
| `test/fases/*` | L2a | L4 (`autoAtaque`) | L6 | R*: o próprio plano |
| `src/core/companheiro/*`, `tools/gerar_apoio.ts`, `src/core/fases/apoio/*` | L2a | L2a | L6 | R*: regenerar o próprio json |
| `src/ui/salvo.ts`, `progresso.ts` | — | L2b | L4 (arsenal no salvo, pedido ao dono L2b) | — |
| `src/ui/baloes.ts`, `src/ui/dicas.ts`, `src/ui/roteiro/*` | — | L8a | L8a/L6 (plano B usa `dicas.ts`) | R*: `roteiro/capN.ts` |
| `src/ui/som.ts` | L1 (suspender) | — | L8b (sons novos) | — |
| `public/sw.js`, build | L13 | L13 | L13 | L13 |
| `tools/revisao/*` | qualquer um, em pasta própria | | | |

### 4.3 Esforço e calendário (estimativa, dias de desenvolvimento)

| Onda | Lotes | Esforço somado | Duração com 4–5 agentes em paralelo |
|---|---|---|---|
| A | L0, L1, L2a | ≈ 2 + 6 + 6 | ≈ 1,5 semana |
| B | L2b, L3a, L4, L7, L8a | ≈ 6 + 4 + 10 + 15 + 4 | ≈ 3 semanas (L7 é o caminho crítico) |
| C | L3b, L5, L6, L8b | ≈ 5 + 5 + 14 + 7 | ≈ 3 semanas (L6 é o caminho crítico) |
| D | L9 | ≈ 4 + o tempo do casal | 1 semana |
| E | L10 (6 capítulos) | ≈ 6 × 12 | ≈ 3–4 semanas com 6 equipes |
| F | L11, L12, L14 | ≈ 30 + 15 + 25 | ≈ 4–6 semanas |

A fatia (ondas A a D) leva **≈ 8–9 semanas**. É a parte que mais importa acertar.

---

## 5. Como medir (vale para todos os lotes)

### 5.1 Protocolo antes/depois

1. **Duas cópias** (`git worktree add <wt-antes> <commit-base>` e `<wt-depois>`), cada uma com
   `ln -s …/node_modules`, portas próprias. Nunca medir no diretório principal.
2. **Linha de base B0**: no fim do L0, rodar a bateria completa (§5.2) e guardar em
   `docs/revisao/medidas/B0/` (JSON + folhas WebP pequenas). Cada lote compara contra a última linha de base aprovada
   (B0, depois B-fatia).
3. **Mesmos enquadramentos.** `capturas.mjs` com relógio parado e entradas dos bots.
   - Quando o lote **muda o núcleo** (física, arsenal, companheiro), as entradas dos bots mudam e "p012" cai noutro
     lugar. Nesse caso compare com **ticks absolutos** e posições dos personagens (`capturas.json`), ou grave as
     entradas com o núcleo do "antes" e reproduza nos dois.
   - Quando o lote **muda a câmera** (L3a), a comparação é "mesma posição dos personagens, câmera antiga × nova", nos
     dois celulares (opção nova `--eu 0|1`, que o L3a acrescenta à ferramenta).
4. **Pontos canônicos por capítulo**: p012, p05 e 4 pontos nomeados (início, 1ª ajuda, segredo, fim/chefe), em
   844×390@2 (iPhone 14) e 873×393@2,75 (Redmi). Baixa, média e alta.
5. **Relatório do lote**: `comparar.mjs <antes> <depois> --folha` + tabela de orçamento (`medir.mjs cenas`) + testes. Um
   assunto por commit; o commit cita o id do lote e do registro (`L7`, `R06`).
6. **Problema novo achado = entrada nova em `REGISTRO.md`**, com o teste que impede a volta.

### 5.2 Bateria de medidas (ferramenta → métrica)

| Ferramenta | O que mede | Onde |
|---|---|---|
| `tools/revisao/capturas.mjs` + `medir.mjs` + `comparar.mjs` | L\*, contraste, % quase branco, % sombra, saturação, chamadas e triângulos por foto | ARTE_DIAGNOSTICO §1 |
| `comparar.mjs` (a estender no L7) | + C\* ≥ 30, % de tampo (máscara por normal), % de primeiro plano com L\* ≤ 25, altura do personagem em % (projeção) | L7/L3a acrescentam |
| `tools/revisao/pesquisa-arte-camera/capturar_camera.mjs` | altura do personagem em px e % por projeção de pés e cabeça | PESQUISA §5 |
| `tools/revisao/tecnico-desempenho/medir.mjs` (`cenas`, `carga`, `cpu`, `rede`, `arena`) + `sonda.js` | chamadas, triângulos, programas, compilações depois do 1º quadro, VRAM estimada, tarefas longas, bytes, reação do pulo da P2 | TECNICO §15 |
| `tools/revisao/tecnico-desempenho/serrilhado.mjs` | degraus de AA | TECNICO §6.3 |
| `tools/revisao/playtester/{jogo,projecao,dupla,carga,telas}.mjs` | multitoque, % do tempo que controles tapam estrelinhas e bichinhos, segundo plano, congelamento, alvos e letras | PLAYTEST §1 |
| `npm test` (vitest) | física travada, alcance de todo coletável (folga ≥ 15), sem armadilha, cooperativa, `SOLO_ATE`, arena | `test/` |
| `tools/revisao/auditoria-movimento/rodar.sh alcance|janela|visibilidade` | busca completa (folga ≥ 100), janela ≥ 0,4 m (≥ 0,9 m com coyote), visibilidade com a câmera do render | `npm run test:lento` (L2a cria) |
| `test/e2e/capitulos.mjs`, `dupla.mjs`, `arena.mjs` | ponta a ponta treino/dupla, orçamento | README |
| Novo `test/e2e/solo.mjs` (L2b/L6) | campanha solo com o companheiro, salvar/retomar, T5/T6/T8 | L2b cria |
| `latencia.mjs` | mediana convidado × anfitrião | AUDITORIA §4 |
| `?diag=1` (L1) no aparelho | fps p50/p95, GPU real, aquecimento em 10 min, bateria | TECNICO §13 |

### 5.3 Faixas-alvo oficiais

**Imagem** (todas as qualidades, quadro inteiro sem HUD, p012 e p05; `comparar.mjs › ALVO` e `ALVO_CAP`):

| Medida | Faixa |
|---|---|
| L\* médio | alvo do capítulo ±6: cap. 1 46 · 2 41 · 3 42 · 4 48 · 5 53 · 6 31 · 7 31 |
| contraste (dp de L\*) | 20–32 (a baixa pode ficar até 2 abaixo) |
| % quase branco (L\* ≥ 90) | ≤ 4 (≤ 6 com o pedaço da estrela na tela) |
| % sombra (L\* ≤ 30) | cap. 1 18–28 · 2 30–45 · 3 28–40 · 4 18–28 · 5 14–24 · 6 50–65 · 7 55–68 |
| saturação HSV média | 0,42–0,75 |
| croma C\* | ≥ 30 |
| alta × média, mesma cena | \|ΔL\*\| ≤ 3, Δcontraste ≥ −1, Δsat ≥ −0,03 |
| alta com bloom × `?bloom=0` | \|ΔL\*\| ≤ 1,5, Δsat ≥ −0,02 |
| personagem (altura do corpo de 1,1 m) | 21–25 % no normal; ≥ 15 % no pior caso (zonas de 15 %); nunca < 15 % |
| tampo das plataformas | ≤ 12 % do quadro |
| primeiro plano (L\* ≤ 25 nas bordas) | 5–15 % do quadro; 0 % sobre a faixa pés −0,5 m … pés +2,5 m |
| contorno a 390 px de altura | 2–3 px em personagens e peças de jogo |

**Orçamento por quadro** (Redmi Note 11, o mais fraco; o iPhone tem a tabela própria em `TECNICO §11`):

| | Leve | Normal (padrão) | Bonito |
|---|---|---|---|
| pixels internos | ≤ 0,35 Mpx | ≤ 0,6 Mpx (escala 0,7–1) | ≤ 0,9 Mpx (escala 0,7–1) |
| chamadas | ≤ 45 | ≤ 60 | ≤ 80 |
| triângulos | ≤ 120 mil | ≤ 220 mil | ≤ 300 mil |
| passes de tela cheia | 0 | 0 | ≤ 1 (bloom seletivo a ¼) |
| programas de shader | ≤ 26 | ≤ 32 | ≤ 38 |
| compilações depois do 1º quadro | 0 | 0 | 0 |
| VRAM estimada | ≤ 30 MB | ≤ 50 MB | ≤ 90 MB |
| AA | — | MSAA 4× | MSAA 4× (no alvo) |
| tarefa longa entre "Jogar" e a tela de transição pintada | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms |
| "Jogar" → jogando (no aparelho, `?diag`) | ≤ 3 s | ≤ 4 s | ≤ 5 s |
| fps no aparelho (`?diag`, cap. mais pesado) | p95 do intervalo ≤ 20 ms | p95 ≤ 20 ms | p95 ≤ 20 ms; queda ≤ 15 % depois de 10 min |

---

## 6. Lotes

Formato: **Objetivo · Arquivos · Quem · Depende de · Paralelo com · Aceite · Antes/depois**. Prioridade herdada dos
documentos (P0/P1/P2). Os testes A1–A12 são de `DESIGN_ARMAS §13`, T1–T18 de `ARQUITETURA_MODOS §11` e T-R/T-E/T-U/
T-P/T-C de `NARRATIVA_CASAL §13`.

### L0 — Fechar o Lote 0 (arte-luz) · Onda A · ≈ 2 dias

- **Objetivo:** commitar o trabalho em andamento de `src/render/` em commits por assunto (bloom seletivo; paleta e
  `estilo`; rampa macia; névoa só atrás; AO assado; sorteio independente da qualidade; borda baixa; cascatas por
  tema) e gerar a linha de base **B0**.
- **Arquivos:** `src/render/{pos,tema,materiais,cenario,aderecos,ceu,elementos,bichinhos}.ts`,
  `src/render/arena/ilha.ts` (só `plano: false`; avisar a equipe da arena), `test/render_cenario.test.ts`.
- **Quem:** artista técnico de render (o mesmo agente arte-luz).
- **Depende de:** nada. **Paralelo com:** L1 e L2a (nenhum arquivo em comum).
- **Aceite:**
  1. `capturas.mjs` 7 capítulos × 3 qualidades × p012/p05 × 844×390@2: alta × `?bloom=0` com \|ΔL\*\| ≤ 1,5;
     alta × média com \|ΔL\*\| ≤ 3 e Δsat ≥ −0,03; % quase branco ≤ 4 nos 7 capítulos [R01, R04].
  2. % sombra e L\* dentro da faixa do capítulo em **pelo menos 5 dos 7** capítulos. O resto vai para R2–R7, porque
     depende da forma do chão e do primeiro plano.
  3. `test/render_cenario.test.ts` dentro do `npm test`: mesma grama nas 3 qualidades, borda ≤ 0,25 m, AO no pé das
     paredes [R03].
  4. Cor do lago na captura = cor do tema com ΔE ≤ 5 [R02].
  5. `medir.mjs cenas`: chamadas e triângulos da média ≤ os de antes +2; programas ≤ antes. A VRAM da alta
     é anotada (o critério ≤ 90 MB é do L1b).
- **Antes/depois:** `f6a32a9` (sem o lote) × o lote, folha `antes_depois_844x390@2.webp` por capítulo, mais a tabela
  da §5.3 marcando ✗. Guardar como **B0**.

### L1 — Base de UX e plataforma (P0 do playtest e do técnico) · Onda A · ≈ 6 dias

Dois sublotes com arquivos separados: **L1a** (interface e rede) e **L1b** (render técnico, que começa assim que o L0
for commitado).

- **Objetivo L1a:**
  - entrada remota vira neutra depois de 250 ms; pausa com "Bruna saiu do jogo" depois de 2 s [R26] (C17);
  - `visibilitychange`/`pagehide` nos dois: manda entrada neutra, pede pausa, suspende música e `AudioContext`;
  - ❚❚, ⇄ e os botões das telas sobrepostas com `pointerdown`/`up` [R27];
  - confirmação no ✕ do mapa, em Sair e em "Mapa da jornada", com Continuar isolado [R28];
  - fps e nome do capítulo saem da tela (o fps só com `?debug`; o nome some depois de 3 s) [R34];
  - limitador de fps por relógio-alvo, 60 (30 no modo economia) [R39];
  - tela de transição pintada **antes** de montar a fase, montagem em etapas com `await` [R33];
  - cartão "Adicionar à Tela de Início" no Safari fora do modo `standalone`; `safe-area-inset-bottom` nos controles
    [R31];
  - painel `?diag=1` (de `tools/revisao/tecnico-desempenho/proposta/diag.ts`).
- **Objetivo L1b:**
  - alta com MSAA no alvo do compositor (`samples: 4`) e `antialias: false` no canvas quando houver compositor [R35];
  - `compileAsync` atrás da tela de transição, `checkShaderErrors = false` em produção [R38];
  - constantes de `materialMundo` como uniform [R58];
  - sombra só dos dinâmicos, mapa 1024², frustum justo [R37].
- **Arquivos:** L1a: `src/ui/partida.ts`, `src/main.ts`, `src/ui/telas.ts`, `src/estilo.css`,
  `src/input/controles.ts`, `src/ui/som.ts`, `src/net/rede.ts`, `index.html`, novo `src/ui/diag.ts`. L1b:
  `src/render/cena.ts`, `pos.ts`, `materiais.ts`.
- **Quem:** L1a = engenheiro de UX móvel + rede; L1b = engenheiro de render e desempenho.
- **Depende de:** L1b depende do L0 commitado. **Paralelo com:** L2a.
- **Aceite:**
  1. `dupla.mjs` (playtester): convidado congelado 3 s ⇒ `vxBruna = 0` em ≤ 0,3 s e aviso em ≤ 2 s; o anfitrião
     escondido ⇒ o convidado vê "pausado".
  2. `jogo.mjs`: `pausaComDedoNoJoystick = true` e `continuarComDedoNoJoystick = true` (iPhone e Android).
  3. e2e: um toque só em ✕, Sair ou Mapa nunca sai da fase nem da sala.
  4. Sonda: ≤ 60 quadros/s com rAF de 90 e 120 Hz.
  5. `carga.mjs`: nenhuma tarefa > 200 ms entre o toque em Jogar e a tela de transição pintada.
  6. Sonda: **0 compilações depois do 1º quadro** nos 7 capítulos × 3 qualidades; programas dentro do orçamento.
  7. `serrilhado.mjs` sem degraus na alta; VRAM da alta ≤ 90 MB; cap. 2 alta ≤ 80 chamadas e ≤ 300 mil triângulos.
  8. `?diag=1`: o painel custa < 0,3 ms por quadro (perfil). **O Natan manda 2 relatórios** (Redmi e iPhone),
     seguindo o roteiro de `TECNICO §13`. Isso calibra a §5.3 e responde se o aparelho é Note 11 ou 11S [R55].
- **Antes/depois:** `medir.mjs cenas`/`carga` e `serrilhado.mjs` antes × depois; capturas dos pontos canônicos (o L1b
  não pode mudar L\*/saturação: \|ΔL\*\| ≤ 1).

### L2a — Núcleo: colisão, manobras, mapa de apoio, afastamento · Onda A–B · ≈ 6 dias

- **Objetivo:**
  1. Corrigir o teleporte do cap. 6: resolver pelo lado de **menor penetração** e só aplicar o empurrão de quina para
     um lugar livre. Guardião T15 [R20].
  2. Levar as manobras de `test/fases/bot.ts` para `src/core/companheiro/manobras.ts`; os bots passam a importar de
     lá.
  3. `tools/gerar_apoio.ts` → `src/core/fases/apoio/capN.json` (com `hashFase`) e o campo `apoio` (dicas, `papel.x`,
     inversos) nos 7 capítulos. A geração do mapa de apoio tem de ficar fora do celular [R59].
  4. Regra de afastamento (12/24 m, 60 %) num bloco isolado de `sim.ts`, desligada por padrão; o L3a liga.
  5. `npm run test:lento` com a busca completa (folga ≥ 100), `janela` e `visibilidade`.
- **Arquivos:** `src/core/colisao.ts`, `src/core/sim.ts` (só o bloco de afastamento), `src/core/companheiro/`,
  `src/core/fases/comum.ts` + `capN_*.ts` (campo `apoio`), `tools/gerar_apoio.ts`, `test/fases/*`, `package.json`
  (script `test:lento`).
- **Quem:** engenheiro de gameplay e núcleo (física e grafo).
- **Depende de:** nada. **Paralelo com:** L0 e L1.
- **Aceite:**
  1. T15: nenhum passo move o corpo mais que \|vx·dt\| + 0,35 m nos 7 planos; `teleporte_cap6.ts` não imprime
     TELEPORTE.
  2. Os 7 planos de bots fecham igual (mesmo tick ±0) com as manobras importadas de `src/core`.
  3. T14: hash em dia; todo `PontoCoop` cobre uma ligação de ajuda e toda ligação de ajuda de um caminho mínimo tem
     `PontoCoop`.
  4. O cap. 6 volta ao caminho real das 4 portas espelhadas (sem a ligação falsa 0 → 2).
  5. Teste do afastamento: acima de 24 m a velocidade para longe cai a 60 %; dentro de zona de fio ou de trecho
     "separado de propósito", nada muda.
  6. `npm test` verde, incluindo `SOLO_ATE`, `cooperativa` e `sem armadilha`.

### L2b — Assentos, salvamento v2, retomar, campanha sem sala, Quintal mínimo · Onda B · ≈ 6 dias

- **Objetivo:**
  - `ControladorAssento` no laço de `partida.ts` (pessoa, remoto ou IA); a campanha começa **sem sala**;
  - `src/ui/salvo.ts`: `Campanha`, `fundir` por união, máximo e OU, migração do v1, slots, gravação também no
    convidado, gravação em `pagehide`/`visibilitychange`;
  - `ResumoLanterna` e o botão "Continuar";
  - Quintal de Treino mínimo (fase `treino-quintal` = `EXEMPLO_MECANICAS` + bonecos), chave `edm-treino-v1`;
  - `test/e2e/solo.mjs`.

  Corrige [R22, R23, R24].
- **Arquivos:** `src/ui/partida.ts`, `src/main.ts`, `src/ui/telas.ts`, novo `src/ui/salvo.ts` (substitui
  `progresso.ts`), novo `src/core/assento.ts`, `src/core/fases/` (fase de treino), `test/e2e/solo.mjs`.
- **Quem:** engenheiro de sistemas (salvamento e fluxo).
- **Depende de:** L1a (mesmos arquivos de interface). **Paralelo com:** L3a (cena.ts), L4 (núcleo), L7 (render) e
  L8a. Em `partida.ts` o L2b entra antes do L3a, na mesma onda.
- **Aceite:**
  1. T8: 37/37 retomadas no vitest; no e2e, recarregar no meio do cap. 1 → "Continuar" → mesma lanterna, mesmas
     estrelinhas e bichinhos derrotados.
  2. T9: 500 pares, fusão comutativa e idempotente, nada some.
  3. T10: os 5 formatos de v1 migram com `liberado`, `pedacos` e `estrelinhasTotais` iguais.
  4. O convidado grava `edm-salvo-v2` com o mesmo `id` (`dupla.mjs`).
  5. T12: `edm-salvo-v2` idêntico byte a byte depois de 2 min no Quintal.
  6. `capitulos.mjs treino` e `dupla` sem mudança de resultado.

### L3a — Câmera por jogador, indicador e zonas · Onda B · ≈ 4 dias

- **Objetivo:**
  - câmera de `PESQUISA_ARTE_CAMERA §6.2` (FOV 35°, 7,6 m, olho a 1,7 m sem inclinação, pés a 30 % por deslocamento de
    lente, zona morta ±0,35 m, olhar à frente de 1,0 a 1,8 m, encaixe na plataforma, meia-vida independente do fps);
  - enquadra os dois até 8 m;
  - zonas de câmera geradas dos `PontoCoop` e marcadas à mão em trechos verticais (relógio grande, torre de gelatina,
    ilha alta);
  - indicador do parceiro (rosto, m, estado);
  - liga o afastamento do L2a;
  - zoom de 30 % para os momentos do casal (gancho para o L8b);
  - opção `--eu 0|1` e medida de altura em % nas ferramentas.

  Corrige [R07, R08]. Base: o trabalho em andamento em `src/render/camera.ts`, `src/ui/indicador.ts` e
  `test/camera.test.ts` (§1.2), que veio de `tools/revisao/pesquisa-arte-camera/experimento_camera.patch`. O L3a o
  completa e fecha.
- **Arquivos:** `src/render/cena.ts`, `src/ui/partida.ts` (quem é "eu"), novo `src/ui/indicador.ts` + CSS próprio
  (`src/ui/indicador.css`, para não conflitar com `estilo.css`), `tools/revisao/capturas.mjs`.
- **Quem:** engenheiro de câmera.
- **Depende de:** L0 (cena.ts depois do render), L2a (apoio e afastamento), L2b (partida.ts primeiro).
- **Aceite:**
  1. Altura do personagem entre 21 % e 25 % nos pontos normais dos 7 capítulos e nunca < 15 % (zonas incluídas), nos
     dois celulares.
  2. O y da câmera não muda durante um pulo no plano.
  3. Chamadas e triângulos ≤ antes.
  4. Indicador em ≤ 1 quadro depois de o parceiro sair do quadro e ≥ 12 px dos botões.
  5. **Visibilidade de novo com a câmera nova**: nenhuma estrelinha acima da tela com a dupla em pé logo abaixo (fora
     da lista aprovada) [R16].
  6. Oclusão: em 100 posições por fase, o raio da câmera até a cabeça e o peito não bate em geometria opaca (C9).
  7. `projecao.mjs` refeito com a câmera nova (entra na L5 como linha de base).
  8. Tampo ≤ 12 % do quadro no cap. 1.
- **Antes/depois:** `capturar_camera.mjs` e `capturas.mjs --eu 0` e `--eu 1`, mesmas posições, 6 cenas × 2 aparelhos
  (juntos, clareira, 8 m, 20 m, cap. 1, cap. 5), como as 12 do experimento.

### L3b — Rede do convidado: predição e entradas com tick · Onda C · ≈ 5 dias

- **Objetivo:**
  - o convidado roda `passo` só para o próprio personagem e reconcilia com o instantâneo (rebobina e reaplica);
  - entradas com número de tick e as últimas 6 em cada envio;
  - o anfitrião aplica a borda do pulo no tick certo e preenche `toleranciaRede` (coyote de rede, teto de 15 ticks).

  Corrige [R19].
- **Arquivos:** `src/ui/partida.ts`, `src/net/rede.ts`, `src/core/instantaneo.ts`, `src/core/sim.ts` (só
  `toleranciaRede`).
- **Quem:** engenheiro de rede.
- **Depende de:** L4 (o arsenal muda o instantâneo e a entrada: mesclar depois) e L3a.
- **Aceite:**
  1. `latencia.mjs`: mediana do convidado ≤ mediana do anfitrião + 2 quadros (hoje 220 × 5 ms, rede 0 ms).
  2. `medir.mjs rede` com 150 ms: reação do pulo da P2 ≤ 1 quadro na tela dela; desvio p95 da posição ≤ 0,3 m.
  3. `dupla.mjs` e `capitulos.mjs dupla` passam (mesmo placar e mesmas posições no fim).
  4. Teste unitário do coyote de rede com entrada atrasada.

### L4 — Arsenal MVP (núcleo, rede, salvamento, puzzles do cap. 1) · Onda B · ≈ 10 dias

- **Objetivo:**
  - `DESIGN_ARMAS §3, §11`: 4 espaços, troca, miçangas que vão para a arma mais vazia, recarga, potes por índice, dar
    munição e arma, sem fogo amigo;
  - Estilingue de Xuxinha (3 pedrinhas que voltam, ∞), Espada de Papelão, Martelo;
  - tiro defendido vira miçanga;
  - alvo-sino, barbante e bloco rachado, com um uso opcional de cada no cap. 1 (alvo-sino em x 13, baú do Martelo no
    topo da pirâmide, bloco rachado em ≈ 100);
  - `autoAtaque` nos bots;
  - projéteis num `InstancedMesh` por tipo; itens na mão com ≤ 1,5 mil triângulos, procedurais;
  - na história, o "Lança-Estrelas" vira "Estilingue de Xuxinha + Espada de Papelão" (texto do prólogo e `HISTORIA.md`).

  Corrige [R21].
- **Arquivos:** `src/core/types.ts`, `sim.ts`, novo `src/core/arsenal.ts`, `instantaneo.ts`, `src/core/fases/cap1_brinquedos.ts`,
  `test/fases/bot.ts`, `src/render/elementos.ts` (projéteis, alvos, baús), novo `src/render/armas.ts`,
  `src/ui/historia.ts`, `docs/HISTORIA.md`. Salvamento: pedido ao dono do L2b.
- **Quem:** designer de combate + engenheiro de gameplay.
- **Depende de:** L2a (bots e manobras em `src/core`). **Paralelo com:** L2b, L3a, L7 e L8a.
- **Aceite:**
  1. **A2 nos 7 capítulos**: os bots fecham só com o Estilingue ∞ e o corpo a corpo, sem potes (hoje o "sem tiro"
     falha nos caps. 3, 5 e 7).
  2. A1 no cap. 1 com a munição real.
  3. A3: varredura dos dados sem nenhum obrigatório que exija munição finita; a lista de combate forçado (cap. 3
     x 84–92; Rei) tem recurso infinito à mão.
  4. A4: grafo sem armadilha e ainda cooperativo.
  5. A5: baús alcançáveis e item antes do uso.
  6. A8: munição, espaços e projéteis iguais no anfitrião e no convidado; instantâneo médio ≤ +15 %.
  7. A10: determinismo; `grep Math.random src/core` vazio.
  8. A12: sem fogo amigo.
  9. `fases_alcance` verde.
  10. Combate ≤ 25 % do tempo do cap. 1 (bots, bichinho vivo a < 8 m).
  11. Média: +≤ 5 chamadas.
  12. `test/arena*.test.ts` sem mudança.

### L5 — Controles e HUD unificados · Onda C · ≈ 5 dias

- **Objetivo:**
  - o layout único de C4: joystick flutuante (o da arena) com a mesma curva;
  - ATACAR no lugar de ✨, ⇆ com anel de munição, roda acima e à esquerda do polegar;
  - ✋ com ícone de contexto (mão, fio, argola, ferramenta, convite);
  - meu rosto (abre os emotes) e o rosto do parceiro (comandos; 🤖 quando é IA);
  - chip de arma no HUD; o indicador do L3a encaixado;
  - opacidade baixa quando nada passa por trás;
  - alvos ≥ 44 px e letras ≥ 12 px;
  - rótulos de nome que não se sobrepõem; dica de toque (não de teclado) na pausa;
  - teclas do PC (`DESIGN_ARMAS §7.2`, `C` e `1–4` dos comandos, `T` dos emotes);
  - toque guardado (`pego`) no 2.5D.

  Corrige [R29, R32, R47, R60].
- **Arquivos:** `src/estilo.css`, `src/input/controles.ts`, `src/ui/partida.ts` (HUD), `src/ui/telas.ts`,
  `index.html`.
- **Quem:** designer de UX móvel.
- **Depende de:** L3a (indicador), L4 (armas) e L8a (lugar dos balões).
- **Aceite:**
  1. A9 em 844×390, 844×340 (Safari), 873×393 e 915×412: sem sobreposição; Ø ≥ 52 px (ATACAR ≥ 72); ≥ 10 px entre
     bordas; a roda fora do quadrado de 170 px do polegar.
  2. `projecao.mjs` com a câmera nova: estrelinhas ≤ 8 % e bichinhos ≤ 10 % do tempo tapados no cap. 1 (e medido nos
     outros 6 como linha de base para o L10).
  3. `jogo.mjs`: pouso 12 px fora e 20 px acima do joystick ⇒ anda; pouso fora do centro ⇒ `vx = 0` até arrastar;
     multitoque andar + pular + atacar mantido.
  4. `telas.mjs` sem alvo < 44 px nem texto < 12 px.
  5. Com quadros de 100 ms, 12/12 toques curtos viram pulo.
- **Antes/depois:** capturas com `--hud` nos pontos canônicos nos 4 tamanhos, mais a figura no padrão de
  `controles_atual_vs_proposto.webp`, agora com o jogo de verdade.

### L6 — Companheiro controlado pelo jogo, plano B e comandos · Onda C · ≈ 14 dias

- **Objetivo:**
  - `ARQUITETURA_MODOS §6`: percepção, planejador no mapa de apoio e árvore de prioridades (sobreviver, reviver,
    comando, cooperar, lutar, coletar, seguir, reagrupar como bolha);
  - os 4 papéis (placa, impulso, puxar, fio âncora ou pendurado);
  - usa o Estilingue e a Espada; nunca gasta munição rara;
  - joga miçangas quando o jogador cai abaixo de 20 %;
  - plano B (dica aos 20 s, "Deixa comigo" aos 45 s ou em 3 falhas, Atalho da Dona Lume aos 60 s) por `dicas.ts`;
  - comandos pelo rosto do parceiro (Vem; leque de contexto);
  - ⇄ para alternar de personagem no solo;
  - "Ir até" pela bolha (C2);
  - telemetria local por `PontoCoop`.

  Corrige [R22].
- **Arquivos:** `src/core/companheiro/*`, `src/core/assento.ts`, `src/ui/dicas.ts` (com o dono do L8a),
  `src/ui/partida.ts` (comandos), `test/companheiro*.test.ts`, `test/e2e/solo.mjs`.
- **Quem:** engenheiro de IA de jogo.
- **Depende de:** L2a, L2b e L4.
- **Aceite:**
  1. **T1 nos caps. 1 e 2** (vitest; bot humano + `Companheiro` real): `concluida`, ≤ 2 voltas à lanterna, 0 atalhos.
  2. T2 (papel inverso) e T3 (jogador distraído) nos caps. 1 e 2.
  3. T4 no fio 1 do cap. 2: "Deixa comigo" em ≤ 45 s e atalho em ≤ 60 s.
  4. T13: determinismo tick a tick.
  5. T16: "Fica na placa" chega em ≤ 4 s.
  6. T17: ⇄ não solta a âncora e fica bloqueado com alguém pendurado.
  7. A6 parcial: o companheiro usa as armas MVP.
  8. ≤ 0,1 ms por tick medido no `?diag` do Redmi.
  9. As 3 estrelinhas de dupla do cap. 1 saem no solo pelo comando "mãos dadas".
  10. e2e `solo.mjs` conclui o cap. 1 no navegador.
- **Antes/depois:** o "Treinar sozinho" de hoje (parceiro parado, trava em x 39,7 do cap. 1) × o solo novo; medir onde
  cada um para e o tempo até o pedaço.

### L7 — Arte do capítulo 1 · Onda B–C · ≈ 15 dias

- **Objetivo:** levar o cap. 1 ao `alvo_cap1.webp`.
  - **Chão próprio**: um kit `brinquedos` com tapete felpudo (faixa fina com a "parede" à mostra), trilho de trem,
    livros como degraus e blocos ABC arredondados e chanfrados. Fica numa API `Kit.chao()` que os outros capítulos
    vão implementar [R06].
  - **Marcos**: janela do pôr do sol, Seu Algodão (procedural até o modelo chegar), blocos ABC grandes, cama. Um por
    trecho de 20 m.
  - **Primeiro plano escuro**: bola xadrez, pote de lápis, franja do tapete, com transparência perto dos jogadores.
  - **Contorno**: casco invertido em pixels de tela nos personagens, bichinhos, coletáveis, armas e interativos;
    traço pintado na aresta das lajes.
  - **Personagens**: rampa `NearestFilter` com sombra colorida [R05]; squash e stretch (1,15/0,85, 80–120 ms); poeira
    no pouso; lenço e cabelo com mola; olhar para o parceiro.
  - **Mundo vivo**: poeira de luz na janela, mobile de estrelas girando, carrinho que anda sozinho, cortina ao vento,
    pelúcias que balançam ao passar.
  - **Fundo pintado** em 3 camadas de cartão (com créditos, §8) ou, sem autorização, procedural com a paleta da §6.2
    da arte.
  - **Alta = mais detalhe**: mais fibras no tapete e mais brinquedos no meio.
  - Experimento C11 (procedural × GLB).
- **Arquivos:** `src/render/cenario.ts` (API de kit), novo `src/render/kits/brinquedos.ts`, `aderecos.ts`,
  novo `src/render/primeiroPlano.ts`, novo `src/render/ambiente.ts`, `personagem.ts`, `materiais.ts`, `ceu.ts`,
  `public/arte/fundos/cap1_*.webp` (se autorizado).
- **Quem:** diretor de arte técnico + artista técnico de render (2 agentes: chão, marcos e fundo; personagens,
  contorno e vida).
- **Depende de:** L0 (commitado e B0) e L3a (a câmera nova define o que aparece: começar pelo que não depende dela,
  como personagens e contorno, e fazer chão e primeiro plano depois do L3a). **Paralelo com:** L2b, L4 e L8a.
- **Aceite:**
  1. Faixas da §5.3 para o cap. 1 nas 3 qualidades, p012/p05 e pontos nomeados: L\* 40–52, contraste 20–32, branco
     ≤ 4, sombra 18–28, sat. 0,42–0,75, C\* ≥ 30; alta × média \|ΔL\*\| ≤ 3.
  2. Tampo ≤ 12 %; primeiro plano 5–15 % com L\* ≤ 25 e 0 % sobre a faixa de jogo (teste por projeção no vitest).
  3. Contorno de 2–3 px a 390 px de altura.
  4. 3 faixas de tom distintas no rosto (retrato `test/retrato/`).
  5. ≥ 3 elementos animados por tela.
  6. Orçamento da §5.3 (Normal ≤ 60 chamadas e ≤ 220 mil triângulos; Bonito ≤ 80 e ≤ 300 mil; programas e VRAM);
     vida ≤ +4 chamadas na média.
  7. Mesma composição nas 3 qualidades (teste do L0 estendido ao kit).
  8. Revisão lado a lado com `alvo_cap1.webp` e `conceito.png` pelo diretor de arte, e depois pelo jogador (L9).
- **Antes/depois:** B0 × depois nos 6 pontos canônicos × 3 qualidades × 2 aparelhos; folha com o alvo na primeira
  coluna.

### L8 — Casal e voz na fatia · L8a Onda B (≈ 4 dias) · L8b Onda C (≈ 7 dias)

- **Objetivo L8a:**
  - sistema de balões DOM (gatilhos por zona, evento, primeira vez e ocioso; variante por `hash(tick, id)`; prioridade;
    nada durante perigo);
  - murmúrio em WebAudio;
  - roteiro do cap. 1 (`NARRATIVA_CASAL §5`), **cortado para ≤ 90 s** de balão por passada (C14), só com textos
    genéricos (C10);
  - `src/ui/dicas.ts` (C16) com as dicas da primeira vez de cada mecânica do cap. 1;
  - opções de balões (todos, só história, desligados).

  Corrige [R30, R48].
- **Objetivo L8b:**
  - `Input.emo` (4 bits) e os eventos `emote`, `convite` e `interacao` no núcleo;
  - leque no meu rosto: 4 rápidos + toca aqui, abraço, dança e beijo, aceitos com ✋; o ✋ nunca rouba fio, argola nem
    mãos dadas;
  - +1 coração no abraço uma vez por lanterna;
  - interações automáticas (renascer, porta dupla, lanterna);
  - 8 expressões (`QUADROS` 4 → 8) e poses procedurais;
  - **momentos do cap. 1**: Seu Algodão (atalho e piada), caixinha de música no segredo (dança → Polaroid 1 e
    desbloqueio), vislumbre do urso da vitrine (6 s, pulável);
  - o companheiro aceita convites e toma iniciativa no máximo a cada 90 s;
  - **sons sintetizados** (WebAudio) para pisão, pouso, vão, placa, fio, plataforma que cai, conclusão, abraço e
    toca aqui;
  - pré-carga dos efeitos ao entrar na fase; volume de música separado do de efeitos.

  Corrige [R44].
- **Arquivos:** L8a: novos `src/ui/baloes.ts`, `src/ui/dicas.ts`, `src/ui/roteiro/cap1.ts`, `src/ui/baloes.css`.
  L8b: `src/core/types.ts` e `sim.ts` (só `emo` e as interações, pedido ao dono da onda), `src/render/personagem.ts`,
  `src/ui/som.ts`, `src/ui/roteiro/cap1.ts`, `src/core/fases/cap1_brinquedos.ts` (caixinha e urso).
- **Quem:** roteirista + designer de experiência do casal (L8a); engenheiro de gameplay + animador técnico (L8b).
- **Depende de:** L8a de nada; L8b de L5 (rostos e ✋), L6 (resposta da IA) e L7 (`personagem.ts` depois do
  contorno).
- **Aceite:**
  1. T-R1 (≤ 48 caracteres, zonas válidas, ids únicos), T-R3 (voz entre 0,40 e 0,60), T-R4 (0 "te amo").
  2. T-U1 (nenhum balão sobre os controles ou os corações nos 4 tamanhos).
  3. T-U2 (nenhuma trava > 6 s; momento visto não repete).
  4. T-P1 (+0 chamadas para balões e emotes).
  5. T-E1 (convite no mesmo tick e visível em ≤ 300 ms nos dois celulares), T-E2, T-E3, T-E4.
  6. T-R5/T-R6 para o segredo do cap. 1 (alcançável, sem armadilha, e no solo com o companheiro).
  7. Soma de balões por passada dos bots ≤ 90 s.
  8. Toda mecânica nova do cap. 1 com dica na primeira vez.
  9. Todos os eventos da `PLAYTEST §4.2` presentes no cap. 1 com som; o primeiro pulo da sessão com som.

### L9 — Portão da fatia (capítulo 1) · Onda D · ≈ 4 dias + sessão com o casal

- **Objetivo:** provar a fatia inteira e congelar as APIs que a replicação vai usar (`Kit`, `apoio`, `roteiro`,
  `dicas`, arsenal e layout).
- **Quem:** diretor técnico + QA + playtester + o casal.
- **Aceite (todos):**
  1. **Imagem**: §5.3 inteira no cap. 1, 3 qualidades × 2 aparelhos × 6 pontos; os outros 6 capítulos sem regressão
     contra B0 (\|ΔL\*\| ≤ 2 com a câmera nova nos mesmos lugares).
  2. **Alcance**: `npm test` + `npm run test:lento` verdes nos 7 capítulos (folga ≥ 100 em toda estrelinha; lista de
     dupla igual à aprovada; visibilidade com a câmera nova).
  3. **Bots e IA**: A1/A2/A3/A10/A12 (7 capítulos), T1/T2/T3/T4/T13 (caps. 1 e 2), T8–T10, T12, T14, T15.
  4. **e2e**:
     - `solo.mjs` cap. 1 completo + recarregar no meio + Continuar;
     - `dupla.mjs` cap. 1 completo (iPhone 14 × Pixel/Redmi) com convites, armas e mesmas posições no fim;
     - convidado em segundo plano (L1);
     - `capitulos.mjs treino` e `dupla` nos 7 capítulos (arte antiga nos caps. 2–7, núcleo novo);
     - `arena.mjs` sem regressão.
  5. **UX**: A9, T-U1, `projecao.mjs` (≤ 8 %/≤ 10 %), `jogo.mjs`, `telas.mjs`, `carga.mjs`.
  6. **Desempenho**: §5.3 no `medir.mjs cenas` e **no aparelho** (`?diag=1` no Redmi e no iPhone: p95 ≤ 20 ms na
     média do cap. 1; Bonito no iPhone p95 ≤ 17,5 ms; 10 min no Bonito com queda ≤ 15 %; 0 contexto perdido).
  7. **Com gente**:
     - o casal joga o cap. 1 **solo** (cada um uma vez) e **em dupla**; o Natan relata;
     - nenhuma estrela fica "sem jeito de pegar";
     - nada trava mais de 60 s sem o plano B oferecer saída;
     - o Natan lê o roteiro do cap. 1 e marca o que "não soa como nós";
     - a revisão de arte lado a lado com `alvo_cap1.webp` é aprovada pelo jogador.
- **Se reprovar:** cada critério tem um lote dono, que volta. O registro ganha a entrada com a causa.
- **Saída:** linha de base **B-fatia** e a lista "o que mudar no padrão antes de replicar".

### L10 — Replicação nos capítulos 2–7 (R2…R7) · Onda E · ≈ 10–14 dias por capítulo

Uma equipe por capítulo, em paralelo. Cada uma é dona de `src/core/fases/capN_*.ts`, `test/fases/planos/capN.ts`,
`src/render/kits/<tema>.ts`, `src/ui/roteiro/capN.ts`, `src/core/fases/apoio/capN.json` e
`public/arte/fundos/capN_*`. Os arquivos compartilhados estão congelados e qualquer mudança neles passa pelo dono do
padrão (diretor técnico).

| Capítulo | Chão e marcos (forma própria) | Armas e ferramentas que estreiam | Companheiro (pontos) | Casal (momentos) | Cuidados conhecidos |
|---|---|---|---|---|---|
| R2 Floresta | barrancos com musgo arredondado, raízes, cogumelos, casa na árvore, ponte de corda, cascatas com espuma e névoa na base | Pote de Vaga-lumes (ponte de luz opcional 150–158), Bumerangue (raro, no galho de dupla) | 2 fios + 4 mãos dadas | "O caminho errado", placa giratória, ninho das corujinhas | o cap. 2 é o mais pesado (alta 488 mil tri): sombra só dos dinâmicos; folhas caindo como partículas pequenas |
| R3 Relógio | engrenagens e mostradores como plataformas, telhados, vapor; engrenagens escuras na frente | Chave de Corda (acessibilidade nos ponteiros), Rolha, Ímã (raro) | porta dupla + sacada (ponteiro por troca de papel) | "Você voltou", o cuco, banco com dois cafés | **redesenhar o trecho de x ≈ 164** e testar `QUINA_CABECA` 0,20 [R13]; combate forçado em 84–92 coberto pelo recurso infinito; busca completa do cap. 3 com teto (60 mil estados) |
| R4 Oceano | píer de madeira, areia, ruínas submersas, corais, baleia no fundo, cáusticas | Vara-Gancho, Revólver de Bolhas, Guarda-sol (3º caminho no fim) | argolas (empurrar), fio do píer, comporta | castelo de areia, gaivota e óculos, gruta das conchas | o **planar** cria arestas novas: A4 de novo; croma ≥ 30 (hoje 24–26) |
| R5 Doces | cobertura escorrendo sobre camadas de **chocolate escuro**, gelatinas, pontes de biscoito | Lançador de Confeitos (antes da chuva), Arco de Pirulito (raro) | portão de pirulito (gelatina), muro de chocolate | "Queimou. Perfeito.", "NÃO LAMBA", duas cerejas | estrelinhas das gelatinas já na trajetória real: manter folga ≥ 100; trecho de 104–140 com combate ≤ 25 % |
| R6 Espelhos | caverna de cristal com dois corredores empilhados, piso rúnico, espelhos que refletem | Travesseiro de Penas, espelho giratório opcional | **o companheiro no outro corredor** (o caso mais pedido) | "Desculpa", espelho troca-roupa, bilhete atrás do espelho; falas abafadas entre os corredores | trechos "separados de propósito" sem puxão do fio nem "Ir até"; o teleporte já corrigido (L2a) |
| R7 Cosmos | ilhas flutuantes com raízes e cascatas no vazio, galáxia, castelo dourado | Lança-Cometas (do casal) | fio o tempo todo; ilha alta | "Lá embaixo", "Faz um pedido!", telescópio | **Rei 2.5D com recurso infinito** (o tiro defendido vira miçanga); o corte para a Arena com as Armas do Coração (L14); pré-carga da arena durante o capítulo |

- **Quem (por capítulo):** artista técnico + designer de fase + roteirista. O companheiro e as armas ficam com os donos
  do padrão, só por dados.
- **Depende de:** L9 aprovado. As ferramentas de cada capítulo (P1 de `DESIGN_ARMAS`) entram no R do capítulo onde
  estreiam, sobre o núcleo do arsenal.
- **Aceite (por capítulo):**
  1. §5.3 de imagem e orçamento com as faixas do capítulo.
  2. A1 com o arsenal da curva, A2, A3 e A4 (com as arestas novas das ferramentas), A5.
  3. T1/T2/T3 do capítulo; T-R2 (3 momentos), T-R5/T-R6 (segredos, incluindo os **novos** dos caps. 3, 4, 6 e 7).
  4. `projecao.mjs` ≤ 8 %/≤ 10 %.
  5. Folga ≥ 100 em toda estrelinha.
  6. `solo.mjs` e `dupla.mjs` no capítulo.
  7. Ao fim do R7, **revisão cega**: 5 de 5 pessoas acertam o capítulo vendo só um recorte do chão; ≥ 80 % acertam pelo
     quadro inteiro.
  8. Combate ≤ 25 % do tempo.

### L11 — Modos completos, progressão e Casa · Onda F · ≈ 30 dias (P1/P2)

- **Objetivo:**
  - drop-in/drop-out (protocolo 2: `oi`, `boasVindas`, `salvo`, `assentos`, `pronto`, `volta`); 1 s sem entrada ⇒ IA
    assume sem pausar, com histerese; a queda não pausa; "Chamar a Bruna" sem parar o jogo (C17);
  - "Continuar sozinha daqui" quando o anfitrião cai;
  - código de progresso `EDM2-` e "Enviar meu progresso" pela sala;
  - progressão (estrelas grandes pela união com 3ª só em 100 % (C15), cartões de novidades, "quanto falta" no mapa)
    [R46];
  - Quintal de Treino completo (16 itens, bonecos, todos os elementos de puzzle, munição infinita com chave);
  - Casa compartilhada (varanda/mapa, sala com mural e foto, quarto com roupeiro, cozinha, quintal com a porta do
    Treino, sótão);
  - polaroids e bilhetes; cartas [REAL] cifradas (C10) [R49]; lembrança em 3 quadros;
  - personalização (7 roupas por personagem, 6 paletas, lenço e coquinhos sempre);
  - minigames: Quebra-Cabeça de Foto e Bolo a Quatro Mãos (P1); Dança, Pescaria e Carrinhos (P2);
  - modo foto.
- **Quem:** engenheiro de rede, engenheiro de sistemas, designer de experiência, artista técnico.
- **Depende de:** L9 (padrões), L10 (os objetos da Casa vêm dos capítulos), §8 para a arte da Casa.
- **Aceite:**
  1. T5 (IA assume em ≤ 70 ticks e o tick avança), T6 (entrar no meio, assumir em ≤ 1 s depois de `pronto`), T7, T11,
     T12, T18.
  2. A6 (o solo fecha os 7 capítulos e a Arena, esta pelo modo treino até o aliado existir) e A11.
  3. Casa ≤ 45 chamadas e ≤ 150 mil triângulos na média; o Treino não altera a Casa.
  4. T-C1 (`grep` no `dist/` não acha o texto original; `cartas.bin` só abre com a senha).
  5. Minigames jogáveis online, no solo e no PC em 60–120 s, com recompensa só cosmética.

### L12 — Caminhos secretos, quedas secretas e final verdadeiro · Onda F · ≈ 15 dias

- **Objetivo (decisões de `PEDIDOS_JOGADOR_2`):**
  - 2–3 caminhos secretos por capítulo, com pista visual descobrível (parede falsa, cipó atrás do primeiro plano, toca,
    nuvem alta, sala atrás da cachoeira);
  - recompensas: armas únicas, habilidades permanentes (pulo duplo, botas de impulso, guarda-chuva planador,
    mergulho, abraço que cura), moedas do casal e easter eggs;
  - quedas secretas (uma por capítulo em média) que levam a fases secretas curtas que reaproveitam o kit do capítulo,
    cada uma com uma lembrança secreta;
  - o Mundo de Dentro da Estrela e o final verdadeiro (os dois caem juntos, de mãos dadas, no fim do cap. 7);
  - `tools/guia_segredos.mjs` → `.segredos/` (no `.gitignore`, nunca publicado).
- **Quem:** designer de fase + roteirista + engenheiro de gameplay.
- **Depende de:** L10 (capítulo com arte nova), L4 (armas) e L11 (moedas, salvamento de segredos e finais).
- **Aceite:**
  1. Todo segredo e toda queda alcançáveis **no solo e em dupla** (busca + companheiro), sem armadilha.
  2. **Habilidade nova = rodada nova de alcance**: com a habilidade, `SOLO_ATE` e `cooperativa` continuam verdadeiros,
     ou o trecho é marcado. O pulo duplo é o maior risco: ele quebra a regra "vão do fio ≥ 6,2 m".
  3. O guia gerado bate com os dados (teste); `.segredos/` fora do git; nenhum texto do guia no `dist/`.
  4. Final normal inalterado para quem não acha.

### L13 — Plataforma P1/P2 (contínuo, arquivos próprios) · ≈ 15 dias espalhados

- **Objetivo:**
  - governo de qualidade por tempo de quadro, com a escada de 7 degraus e a qualidade inicial pela GPU, depois dos
    relatórios (C18) [R40];
  - geometria "assada" no build ou montada num Worker [R33];
  - service worker gerado no build (precache por hash, `Range` a partir do cache, navegação com prazo de 3 s) [R41];
  - instantâneos e entradas num canal não confiável, eventos com confirmação, buffer adaptativo [R43];
  - menu sem three nem peerjs (import dinâmico + `modulepreload`);
  - música AAC 64 kbit/s (com o ok de quem cuida do som);
  - miniaturas do mapa de ~10 KB [R45];
  - gancho `__edm` só com `?teste` [R54];
  - apagar do deploy os 12 GLB não usados (ou convertê-los com meshopt quando entrarem);
  - `navigator.wakeLock` no mapa e na sala.
- **Arquivos:** `public/sw.js` → script de build, `src/render/qualidadeAuto.ts`, `tools/assar_cenario.ts`,
  `src/net/rede.ts` (depois do L3b), `src/main.ts` (depois do L5), `public/som`, `public/arte`.
- **Quem:** engenheiro de plataforma web.
- **Aceite:**
  1. `teste_governo.mts` no `npm test`; no iPhone em pouca energia, a escala não cai.
  2. Nenhuma tarefa > 200 ms entre Jogar e o 1º quadro (`medir.mjs carga`); ≤ 3 s no Redmi (`?diag`).
  3. Na 2ª sessão, 0 bytes de música vindos da rede (CDP); um WebP trocado chega na próxima abertura; nenhum
     `index-*.js` velho no cache.
  4. `medir.mjs rede` com 3 % de perda: sem congelamento > 150 ms; reação da P2 ≤ RTT + 120 ms.
  5. Menu interativo ≤ 0,8 s no 3G lento.
  6. O mapa baixa ≤ 400 KB além da música.

### L14 — Final 3D: troca de pele da Arena e Floresta do Coração · Onda F · equipe da Arena + apoio

- **Objetivo:**
  - **(a) Troca de pele** (`DESIGN_ARMAS §9`): Estilingue de Xuxinha, Espada da Aurora de papelão dourado, Lança de
    Pétala de feltro, Foguete de Garrafa, Toalha de Piquenique + Canhão de Pétalas, Estilingue Gigante do Fio Vermelho
    com a Estrela de Pelúcia, bomba de ar no lugar da barra, sinos de cristal — **sem mudar números**;
  - aliado IA na arena (`BotArena`) para o solo (C7);
  - GLB com meshopt e pré-carga durante o cap. 7 [R42];
  - falas nas trocas de fase (`NARRATIVA §12`);
  - **(b) Floresta do Coração** (C12): 300–500 m de percurso em zonas (trilhas, clareiras, rio, ponte, cavernas,
    segredos), grupos de bichos-pesadelo, baús com armas e munição, lanternas, pequenos puzzles de dupla e a Arena no
    coração da floresta; carregamento por zona, instancing de árvores e LOD.
- **Arquivos:** os da equipe da Arena (`src/core/arena`, `src/render/arena`, `src/ui/partidaArena.ts`, `hudArena.ts`).
  Este plano **só especifica**.
- **Depende de:** L4 (nomes e ícones do arsenal), L9 (padrão de arte), L11 (salvo v2 e drop-in).
- **Aceite:**
  1. `test/arena*.test.ts` **sem alteração** passam; `medir_armas.ts` dá as mesmas porcentagens de dano por origem
     (A7).
  2. GLB da arena ≤ 1,7 MB; arena pronta ≤ 1 s depois da fuga em 4G simulado.
  3. Solo vence com o aliado.
  4. Na Floresta: Normal ≤ 60 chamadas e ≤ 220 mil triângulos em toda zona (Redmi); troca de zona sem tarefa
     > 200 ms; todos os baús e segredos alcançáveis no solo e em dupla.

---

## 7. Plano de riscos

| Risco | Efeito | Mitigação | Gatilho para replanejar |
|---|---|---|---|
| O companheiro genérico não fecha os trechos de tempo (ponteiros, giratórias) e o fio | o solo trava | `papel.x` escrito à mão, segue nos trechos solo, plano B com o atalho garante saída | T1 falha no cap. 2 depois de 5 dias de L6 → reduzir para "papéis roteirizados por `PontoCoop`" |
| A câmera nova muda o que o jogador vê e quebra a visibilidade e a legibilidade de trechos verticais | estrelinha "some" de novo | zonas de câmera manuais + visibilidade com a câmera nova no `test:lento` | mais de 5 estrelinhas fora da tela depois do L3a |
| GPU do Redmi mais fraca que o esperado | fps baixo no Normal | `?diag` cedo (L1), governo (L13), orçamento por pixel | p95 > 25 ms na média do cap. 1 no aparelho |
| Créditos não autorizados | arte sem fundos pintados | caminho procedural com a paleta (L7 funciona sem créditos; os fundos pintados são melhoria) | — |
| Conflito de arquivos entre equipes em paralelo | retrabalho | tabela §4.2; congelar APIs no L9 | merge com conflito em arquivo de outro dono → parar e chamar o diretor |
| Mudança no núcleo altera os pontos das capturas | antes/depois inválido | ticks absolutos ou entradas gravadas do "antes" (§5.1) | — |
| Os [REAL] não chegam do Natan | roteiro genérico | genéricos bons por padrão; validação humana no L9 | — |
| A equipe da Arena muda números junto com a pele | balanceamento perdido | A7 com os testes sem alteração | qualquer diff em `numeros.ts` no lote (a) |

---

## 8. Recursos a gerar (Higgsfield / Meshy) e créditos

**Regra (D40 do projeto):** toda geração paga exige autorização explícita do responsável, com teto em créditos, e é
registrada em `docs/arte/RECURSOS.md`. Cotar antes (`estimate_image_cost` / `estimate_audio_cost`; para o Meshy,
cotar na API). Fazer sempre imagem → 3D, nunca texto → 3D (lição de RECURSOS.md) [R61]. Saldos conhecidos: Higgsfield
**235,63** (depois dos 14 dos alvos); Meshy **521**.

Valores de referência medidos nas rodadas anteriores: imagem `gpt_image_2_6` alta 2k ≈ **2**; modelo estático
imagem→3D (meshy_v7 pelo Higgsfield) ≈ **38**; modelo com esqueleto ≈ **47,5**; texto→3D no Meshy = 30 (o preço de
imagem→3D no Meshy **precisa de cotação**; aqui estimado em 30–40).

| Lote | Recurso | Ferramenta | Qtde | Estimativa | Sem crédito, o que acontece |
|---|---|---|---|---|---|
| **L7 (fatia)** | fundo pintado do cap. 1 em 3 camadas (céu com janela; parede e estante; móveis médios) | Higgsfield gpt_image_2_6 2k | 3 | 6 | fundo procedural com a paleta |
| L7 | atlas de superfícies (tapete felpudo, madeira, papelão e capa de livro) | Higgsfield 2k | 2 | 4 | ruído procedural |
| L7/L8 | cartão da Dona Lume para os balões (2D, 3 poses) | Higgsfield 1k | 1 | 2 | rosto em SVG |
| L7/L8 | imagens de referência: Seu Algodão, trem de brinquedo, caixinha de música | Higgsfield 1k | 3 | 6 | — |
| L7/L8 | modelos 3D: Seu Algodão, trem, caixinha de música | Meshy imagem→3D | 3 | 90–120 Meshy | procedurais (~1,5 mil tri) |
| | **Fatia, teto a pedir** | | | **≈ 25 Higgsfield + ≈ 130 Meshy** | |
| L10 (por capítulo, × 6) | fundo em 3 camadas + atlas (2) + 2–3 referências | Higgsfield | 7–8 | 14–16 | procedural |
| L10 | 2–3 modelos-marco (refazer os "fracos": cogumelo, castelo de doces, cristais, ilha flutuante; reaproveitar `casa_arvore`, `torre_relogio` e `blocos_brinquedo`, que estão bons ou razoáveis) | Meshy imagem→3D | 2–3 | 60–120 Meshy | marcos procedurais |
| | **Replicação, total** | | | **≈ 90 Higgsfield + 360–600 Meshy** | não cabe no saldo do Meshy: priorizar 2 por capítulo |
| L11 | Dona Lume (folha), Casa em corte, 7 polaroids, expressões, figurinos, ingredientes e peixes, carrinhos, urso, caixinha (`NARRATIVA §11.2`) | Higgsfield | 18 imagens | ≈ 36 | polaroids genéricas pintadas em canvas |
| L11 | Dona Lume com esqueleto + 7 móveis e objetos (`NARRATIVA §11.3`) | Meshy / Higgsfield | 8 | ≈ 48 + 7 × 30–38 ≈ 260–315 | Casa procedural |
| L11 | 12 efeitos sonoros + 3 músicas (Casa; Dança A/B com BPM fixo) | Higgsfield áudio | 15 | **cotar** (estimativa 30–60) | efeitos sintetizados em WebAudio (padrão da fatia) |
| L12 | 6 lembranças secretas + cena do final verdadeiro | Higgsfield 2k | 7 | ≈ 14 | — |
| L12 | música do final verdadeiro | Higgsfield áudio | 1 | cotar (≈ 5–10) | reaproveitar `musica_final` |
| L14 (equipe da Arena) | Foguete de Garrafa, Toalha + Canhão, Estrela de Pelúcia: imagens + 3D | Higgsfield | 3 + 3 | ≈ 6 + 114 | procedurais |
| L14 | Floresta do Coração: 2 conceitos + kit de 6–8 modelos (árvore grande, raízes, ponte, rocha, tronco caído, cogumelo) | Higgsfield + Meshy | 2 + 6–8 | ≈ 4 + 180–300 Meshy | árvores procedurais instanciadas |
| L13 | meshopt dos GLB (local, gltf-transform) | — | — | 0 | — |

**Soma aproximada do programa inteiro:** Higgsfield ≈ 230–290 (o saldo é 235,63), Meshy ≈ 900–1 400 (o saldo é 521).
**Não cabe tudo.** Ordem de prioridade para o responsável decidir: fatia → replicação (2 modelos por capítulo) →
Floresta do Coração → Arena → Casa e minigames.

Registro de processo: os 14 créditos dos alvos foram gastos com base no teto da tarefa do workflow, sem confirmação
direta do responsável nesta sessão [R51]. Daqui em diante, a autorização é pedida por lote, com o teto da tabela.

---

## 9. Entregáveis de cada lote (checklist)

1. Commits por assunto, citando lote e registro; sem misturar.
2. Relatório curto em `docs/revisao/lotes/Lx.md`: o que mudou, a tabela de medidas antes/depois e o que ficou de
   fora.
3. Imagens antes/depois pequenas (WebP ≤ 200 KB) em `docs/revisao/img/Lx/`.
4. Testes novos no `npm test` (rápidos) ou no `npm run test:lento` (busca completa), nunca só em `tools/`.
5. Entrada no `REGISTRO.md` para cada problema novo achado e corrigido.
6. Documentos atualizados (`README.md`, `NUCLEO.md`, `LEIAME.md` das fases, `HISTORIA.md`) quando os números ou a
   história mudam.
