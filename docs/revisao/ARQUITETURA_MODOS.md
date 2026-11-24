# Arquitetura de modos, salvamento, progressão e companheiro controlado pelo jogo

Equipe: **arquitetura-modos** · 2026-11-24 · etapa de diagnóstico e desenho (pedido do jogador, itens 5–9, 10 e 13).
Nada em `src/`, `test/`, `public/` ou `index.html` foi alterado. As medidas rodaram numa cópia isolada (worktree de
`ed9fe6f`, já apagada). Ferramentas: `tools/revisao/arquitetura-modos/` (§14).

Convenção: **[confirmado]** = lido no código ou medido com a simulação real; **[hipótese]** = proposta ou estimativa
ainda não verificada.

---

## 0. Resumo

**Como está hoje [confirmado]**
1. **Não existe campanha solo.** A campanha só começa quando a outra pessoa conecta: `iniciarSessao()` só é chamada em
   `aoMudarEstado('conectado')` (`src/main.ts:272–273`). O "Treinar sozinho" não é um modo à parte. É a campanha com tudo
   liberado e sem salvar (`main.ts:222–224`, `:357`), e o outro personagem fica **parado** (`INPUT_NEUTRO`,
   `src/ui/partida.ts:150`).
2. **O progresso é do aparelho de quem criou a sala, não do casal.** Só o anfitrião grava (`main.ts:224`). O convidado
   zera os capítulos ao entrar (`main.ts:342`) e nunca grava. Se a Bruna criar a sala na vez seguinte, a jornada
   recomeça do zero no aparelho dela.
3. **Nada é salvo no meio do capítulo.** Fechar o navegador ou o iOS descartar a aba no meio da fase faz voltar ao
   começo do capítulo. Só existem a conclusão e o `arena7`.
4. **Se a conexão cai, os dois param.** O jogo pausa (`main.ts:267`). A queda só é declarada depois de 7 s de silêncio
   (`src/net/rede.ts:18`). O anfitrião espera até 20 s pela volta (`rede.ts:137`). Ninguém assume o personagem de quem
   caiu.

**Medido com a simulação real (§2)**
5. **Ajudas obrigatórias.** Pelo caminho com menos ajudas no grafo de alcance (`test/fases/alcance.ts`), cada capítulo
   tem **4 a 8 ajudas sem as quais não se avança**: mãos dadas, placa do outro lado e fio. É essa lista curta, com
   posição e papel, que o companheiro precisa saber cumprir. Não é preciso jogar o capítulo inteiro "como uma pessoa".
6. **Salvar na lanterna e retomar funciona com 174–201 bytes.** De **37 lanternas** dos 7 capítulos, as **37**
   retomadas chegaram ao pedaço da estrela. Cada uma recria o estado só com o resumo, põe os dois na lanterna e
   continua com os bots. O estado completo tem 2,3–4,6 KB.
7. **O grafo de alcance leva de 0,13 a 3,0 s para ser montado** (cap. 3: 303 nós, 155 mil saltos simulados, num
   processador de computador). No celular ele precisa vir **pronto do build** (1,4–67 KB de JSON por capítulo).

**Defeito novo, reproduzido [confirmado]**
8. **Teleporte no capítulo 6.** Um superpulo de mãos dadas para a esquerda, saindo de x 30,4–30,71, leva o Natan de
   x 29,5 a x 66,1 em 1 tick. Ele pula as duas portas espelhadas do 1º trecho. A causa está em `src/core/colisao.ts`
   (§3). Isso também cria uma ligação falsa no grafo de alcance.

**O que proponho (decisões)**
- **Dois modos de jogo e um ambiente:**
  - **Campanha**: uma só, com um slot salvo. O assento 2 é ocupado pelo **companheiro do jogo** ou por **uma pessoa
    pela sala**, e pode mudar a qualquer momento sem reiniciar.
  - **Treino ("Quintal de Treino")**: fase própria, tudo liberado, que nunca toca o salvo da campanha.
- **Salvamento do casal com fusão sem perda.**
  - O progresso só cresce: capítulos, estrelinhas, itens e lembranças se juntam por **união e máximo**.
  - Os dois aparelhos guardam cópia e se acertam ao conectar. Tanto faz quem cria a sala.
  - Ao acender uma lanterna, grava um **ResumoLanterna** (≈ 200 B).
  - Exportar e importar por um **código de texto** (`EDM2-…`).
- **Companheiro dentro da simulação do anfitrião.**
  - É um **controlador de assento** puro e determinístico (`src/core/companheiro/`) que só produz um `Input`, como um
    humano. A rede não muda para ele.
  - Navega por um **mapa de apoio** pré-calculado (grafo de alcance + pontos de cooperação).
  - Executa as manobras que os bots de teste já usam (`test/fases/bot.ts`, migradas para `src/core`).
  - Decide por uma **árvore de prioridades**: sobreviver › reviver › comando › cooperar › lutar › coletar › seguir.
- **Entrar e sair da partida (drop-in/drop-out).**
  - A sala pode ser aberta a qualquer momento da campanha ("Chamar a Bruna").
  - Quem entra assume o assento do companheiro no tick seguinte à cena carregar.
  - Se a entrada remota some por **1 s**, a IA reassume **sem pausar**.
  - Se cai o **anfitrião**, o convidado continua sozinho da última lanterna com a sua cópia.
- **Plano B nos trechos difíceis.** Uma dica aparece aos 20 s parado num ponto de cooperação. Aos 45 s, ou depois de
  3 falhas, aparece "Deixa comigo", e o companheiro faz a parte dele com tolerâncias maiores. Aos 60 s, aparece o
  **"Atalho da Dona Lume"**: uma bolha leva os dois à próxima lanterna, sem perder nada, e as estrelinhas do trecho
  ficam para depois.

---

## 1. O que existe hoje (lido no código)

| Peça | Onde | O que faz | Consequência para o pedido |
|---|---|---|---|
| Modos | `src/ui/partida.ts:13` | `'treino' \| 'anfitriao' \| 'convidado'` | não há "solo" nem "companheiro" |
| Quem controla quem | `partida.ts:68–70`, `:149–151` | treino: o jogador local num assento e `INPUT_NEUTRO` no outro; o ⇄ troca. Anfitrião: `[local, entradaRemota]` | **é aqui que entra o controlador do assento 2** (uma linha) |
| Início da campanha | `main.ts:265–283` | só começa com o convidado conectado | campanha solo impossível hoje |
| Salvar | `main.ts:222–224`, `src/ui/progresso.ts:5` | `edm-progresso-v1`, só no anfitrião; o treino não salva | progresso preso a um aparelho; nada no meio da fase |
| Convidado | `main.ts:342` | `capitulos: {}` até chegar o do anfitrião; nunca grava | a Bruna não tem cópia |
| Queda | `main.ts:267`, `rede.ts:18`, `:137`, `:145` | pausa os dois; 7 s para declarar a queda; o anfitrião espera 20 s; sala para dois | parar a história é o oposto do pedido |
| Versão | `main.ts:232` | versões diferentes só geram `console.warn` | com mensagens novas, é preciso recusar a sala de forma clara |
| Identidade da sala | `rede.ts:129`, `:172` | o id do peer é `entre-dois-mundos-v1-<código>` | se o anfitrião sai, a sala morre |
| Bots | `test/fases/bot.ts`, `test/fases/planos/` | planos roteirizados por x, com barreira entre os dois; primitivas de manobra (ir, saltar, darImpulso, superpulo, segurarFio, balancar, carona, subirNaGiratoria, quicarPara, atravessarArgola, lutarComORei) | as **manobras** servem ao companheiro; o **roteiro** não, porque o humano é imprevisível |
| Grafo de alcance | `test/fases/alcance.ts` | nós de "lugar em pé" e ligações `solo/super/fio/porta`, com quem precisa estar onde (`podeUsar`, `:280`) | é exatamente o mapa de pontos de apoio que o companheiro precisa |
| Arena | `src/core/arena/sim.ts:29`, `src/ui/partidaArena.ts:128` | `treino` + `solo`: no treino só um personagem está em jogo | a campanha solo precisa de um aliado IA na arena, e há o `BotArena` em `test/arena_bot.ts` (não mexi: arquivos da outra equipe) |

---

## 2. Medidas

Script: `tools/revisao/arquitetura-modos/medir_modos.ts`. Saída completa: `medidas.json`.

### 2.1 Ajudas obrigatórias por capítulo (o que o companheiro tem de saber fazer)

Método: Dijkstra no espaço dos pares (nó do Natan, nó da Bruna) do grafo de `alcance.ts`. Cada ligação feita sozinho
custa 1. Cada ligação que exige o parceiro custa 100: `super`, `fio` e `porta` com a placa longe (mais de 1,5 m) ou
dupla. O caminho mais barato do início até os dois no pedaço da estrela dá o **mínimo de ajudas**.

Quando dois caminhos custam o mesmo, o tipo pode variar entre eles: por exemplo, uma porta ou um superpulo. Os números
são o mínimo, não a única solução. "x" é o centro do trecho de chão (nó) onde a ajuda acontece.

| Cap. | Ajudas | Tipos (um caminho mínimo) | Onde (x de quem passa → x de chegada) |
|---|---|---|---|
| 1 | 7 | 4 porta, 3 mãos dadas | tampa 33,7→46,3 (os dois, um de cada vez); caixa alta 46→55 (sobe e puxa); prateleira 136,7→143 e portão 136,7→158,3 |
| 2 | 8 | 8 mãos dadas (o grafo prefere mãos dadas ao fio) | 39→54, 106→127,5, 127,5→143, 175→182 (cada uma: impulso, depois puxar) |
| 3 | 4 | 3 porta (2 duplas), 1 mãos dadas | porta-rua 73→91,5; porta-sacada 76,5→82,3; telhado 144→161; portão do tempo 144→163 |
| 4 | 4 | 2 mãos dadas, 2 porta | 77→99,8 (fio/jangada); comporta 137,5→152,5 |
| 5 | 4 | 2 porta, 2 mãos dadas | portão de pirulito 68,7→97,5; muro de chocolate 137,7→152 |
| 6 | 6* | 6 mãos dadas | *inclui o teleporte do §3 (16→58,8 e 58,8→105,5 em y = 0 não existem de verdade); sem ele, o caminho são as 4 portas espelhadas + o muro 140,6→152 |
| 7 | 4 | 3 mãos dadas, 1 fio | 61→92,8; ilha alta 92,8→117 (um sobe, segura o fio, o outro sobe pela corda) |

Leitura:
- São poucas ajudas, todas com lugar fixo: entre 4 e 8 por capítulo, numa fase de 184–220 m.
- Elas vêm de só **4 papéis**:
  1. ficar numa placa;
  2. dar impulso (mãos dadas embaixo);
  3. puxar de cima (mãos dadas em cima);
  4. no fio, ser âncora ou ficar pendurado.

  O resto é **seguir**.

### 2.2 Salvar na lanterna e retomar

Ao acender cada lanterna, o script grava o `ResumoLanterna` (§5.3). Depois recria o estado só com ele:
`estadoInicial` + lanterna, tick, estrelinhas pegas e bichinhos derrotados. Põe os dois em `pontoCheckpoint` e continua
o plano dos bots a partir da etapa em andamento.

| Cap. | Lanternas | Retomadas que chegam ao fim | Resumo (B) | Estado completo máx. (B) | Instantâneo médio / máx. (B) |
|---|---|---|---|---|---|
| 1 | 5 | 5/5 | 174 | 2 304 | 288 / 349 |
| 2 | 5 | 5/5 | 188 | 2 885 | 372 / 464 |
| 3 | 5 | 5/5 | 176 | 3 731 | 377 / 481 |
| 4 | 6 | 6/6 | 179 | 3 220 | 347 / 433 |
| 5 | 5 | 5/5 | 201 | 4 578 | 502 / 599 |
| 6 | 5 | 5/5 | 188 | 2 891 | 327 / 405 |
| 7 | 6 | 6/6 | 179 | 3 981 | 408 / 551 |

**37/37 [confirmado].** Isso combina com o teste "sem armadilha" de `test/fases.test.ts:137–141`, que já prova que de
toda lanterna ainda se chega ao fim. O resumo cabe com folga no `localStorage`: 7 capítulos × 3 slots < 5 KB.

### 2.3 Custo do grafo de alcance (tempo de montagem, num processador de computador)

| Cap. | ms | Nós | Ligações | Saltos simulados | JSON |
|---|---|---|---|---|---|
| 1 | 619 | 58 | 516 | 30 360 | 7,1 KB |
| 2 | 130 | 24 | 71 | 9 440 | 1,4 KB |
| 3 | 3 000 | 303 | 5 028 | 155 312 | 67 KB |
| 4 | 539 | 117 | 1 517 | 30 874 | 20 KB |
| 5 | 191 | 28 | 74 | 11 162 | 1,6 KB |
| 6 | 1 010 | 75 | 1 016 | 48 058 | 13 KB |
| 7 | 1 023 | 113 | 1 431 | 66 126 | 19 KB |

**Decisão:** gerar o mapa de apoio **no build**, com um script em `tools/` que grava `src/core/fases/apoio/capN.json`,
e conferir no teste se está em dia: um hash da fase dentro do JSON. Montar no celular custaria [hipótese] 3–10 × esses
tempos, e o cap. 3 levaria de 10 a 30 s no Redmi.

---

## 3. Defeito encontrado: teleporte no capítulo 6 (para a equipe de movimento)

**[confirmado, reproduzido]** `tools/revisao/arquitetura-modos/teleporte_cap6.ts`:
- Natan fica em x 30,4 (ou 30,71) e Bruna ao lado dá a mão.
- Natan faz o superpulo para a esquerda.
- No tick 20, ele vai de **x 29,50 para x 66,10** (y 3,40).

Ele pula o 1º trecho espelhado inteiro: a porta-baixo-1, a porta-cima-1 e as duas placas.

**Mecanismo [confirmado pelo rastro tick a tick, `teleporte_cap6_rastro.ts`]**. São três passos no `moverEixo`
(`src/core/colisao.ts:18–43`):
1. **Subindo**, a cabeça encosta na quina da tábua 4 (x 27,2–29,2, y 4,3). A regra de quina (`:35–36`, sobra
   ≤ 0,32 m) empurra o corpo para x = 29,2 + 0,3 + 1e-4 = 29,5001.
2. O vão entre a tábua 4 e o piso do corredor de cima (x 29,8) tem 0,6 m, **exatamente a largura do corpo**. Com o
   épsilon, a borda direita fica 1e-4 m dentro do piso, e a correção da quina deste não desfaz a sobreposição com a
   tábua.
3. No tick seguinte, o passo horizontal (indo para a esquerda) acha o corpo dentro da tábua. Ele **escolhe o lado pela
   direção do movimento**, não pela menor penetração, e põe o corpo em `r.x + r.w + meia` (`:24`).

O laço continua com a posição nova. O corpo agora está dentro do piso de 34 m (x 29,8–64), vai para x 64,3, depois
entra na tábua 10 e vai para x 66,1.

**Correção proposta:**
- Em `moverEixo`, resolver a sobreposição pelo lado de **menor penetração**.
- Só aplicar o empurrão de quina se o destino estiver livre.
- Guardião: "nenhum passo move um corpo mais que |vx·dt| + 0,35 m na horizontal", rodando os 7 planos.

O mesmo defeito cria a ligação falsa 0 → 2 do grafo do cap. 6 (§2.1). O "sem armadilha" segue válido, mas fica
otimista ali.

---

## 4. Modos

### 4.1 Matriz

| | **Campanha (sozinho)** | **Campanha (a dois)** | **Treino — Quintal de Treino** |
|---|---|---|---|
| Assento 1 / 2 | pessoa / **companheiro do jogo** | pessoa / pessoa remota (ou IA enquanto ela não chega ou se cai) | pessoa / IA, parado ou pessoa remota (sala de treino opcional) |
| Simulação | local (o aparelho é o anfitrião) | anfitrião (quem abriu a sala) | local |
| Fases | capítulos em ordem | as mesmas, o mesmo slot | **fase própria** `treino-quintal` (oficina de mecânicas + bonecos + alvos) e "qualquer capítulo em modo treino" |
| Liberado | o que a campanha conquistou | idem | **tudo**: armas, munição infinita (chave), roupas, capítulos e chave de câmera e qualidade |
| Salva | slot da campanha (lanterna, conclusão, itens) | idem, **nos dois aparelhos** | **nada** da campanha; só as preferências do treino (`edm-treino-v1`) |
| Física | idêntica | idêntica | idêntica ("dá no treino" = "dá na campanha") |

O Treino é um **ambiente**, não um modo de campanha:
- No código: `Modo` ganha `'campanha'` e `'treino'`, e o papel na rede (`'local' | 'anfitriao' | 'convidado'`) vira
  um eixo à parte.
- O mapa do treino é o mesmo, com o selo "TREINO" e moldura de outra cor.
- Ao sair, volta ao menu sem passar pelo slot.

### 4.2 Fluxo de telas

```
Menu
 ├─ Continuar  (último slot: "Cap. 3 · lanterna 2 · ★ 61")  → fase direto na lanterna
 ├─ Jornada    → escolher slot (3) → [novo: nome do casal, quem é Natan/Bruna aqui] → prólogo → Casa → mapa
 ├─ Entrar na sala (código)  → recebe o slot do anfitrião, funde com a cópia local → onde o anfitrião estiver
 ├─ Quintal de Treino        → fase de treino (nunca toca no slot)
 └─ Opções / Trocar de aparelho (exportar · importar código)
Dentro da campanha (pausa):  Chamar a Bruna (abre sala, mostra código, o jogo segue com a IA)
                             Trocar de personagem ⇄ (sozinho)   Atalho da Dona Lume (quando oferecido)   Voltar à Casa
```

A **Casa** (hub, item 10 do pedido) fica entre o mapa e o menu. Nela aparecem:
- o álbum de lembranças, as fotos na parede, o roupeiro e os minigames liberados;
- a porta do Quintal de Treino.

Para a arte, a Casa é uma fase pequena, de 30–40 m, com o mesmo motor. Para a arquitetura, ela é **só uma fase com
`tipo: 'casa'`**, sem pedaço da estrela, e os objetos interativos usam o ✋.

---

## 5. Salvamento

### 5.1 Princípios
1. **O progresso é do casal e da campanha, não do aparelho.** Cada aparelho guarda uma cópia de cada campanha em que
   jogou, identificada por `id` (16 caracteres aleatórios do `crypto.getRandomValues`).
2. **Só cresce, então a fusão não perde nada.**
   - Conjuntos (capítulos concluídos, estrelinhas pegas por capítulo, itens, roupas, lembranças, segredos e minigames)
     se juntam por **união**.
   - Números de recorde ("melhor") usam **máximo**.
   - Marcas (prólogo visto, final visto) usam **OU**.

   Como se trata de um semirreticulado, fundir A com B dá o mesmo que fundir B com A, e repetir a fusão não muda nada.
   Quem foi anfitrião deixa de importar.
3. **A retomada no meio do capítulo não é monotônica.** Fica o `ResumoLanterna` mais novo, por `(rev, salvoEm)`. O
   `rev` sobe a cada gravação. Em empate, o de `salvoEm` maior. Se os dois aparelhos tiverem resumos de capítulos
   diferentes, fica o do anfitrião da sessão atual.
4. **Do jogador (do aparelho), e não da campanha:**
   - qualidade, som e controles (tamanho e posição dos botões, canhoto);
   - apelido;
   - último código de sala;
   - preferência de personagem.

   Hoje: `edm-qualidade` (`main.ts:28`), a chave do som (`som.ts:14`).
5. **Do personagem, dentro da campanha** (e não da pessoa):
   - a roupa vestida;
   - o acessório;
   - o arsenal na última lanterna, como em `DESIGN_ARMAS.md §3.2` e §10.

   Quem assume o personagem assume o que ele veste e carrega.

### 5.2 Quando grava
- Ao acender uma lanterna: o `ResumoLanterna` e o que o capítulo deu até ali (estrelinhas pegas, itens de baú).
- Ao concluir um capítulo ou vencer a arena.
- Ao ganhar um item, uma roupa ou uma lembrança.
- No `visibilitychange → hidden` e no `pagehide`. O iOS descarta abas em segundo plano sem aviso, e só esses eventos
  chegam a tempo. O `beforeunload` não é confiável no Safari [recomendação conhecida da plataforma; não testado aqui].
- No convidado: sempre que chega a mensagem `salvo` (§8). Hoje o convidado não grava nada.
- Uma vez por sessão, `navigator.storage.persist()` [hipótese: o Android Chrome concede por engajamento; no iOS, o PWA
  instalado já tem armazenamento persistente].

### 5.3 Tipos propostos (`src/ui/salvo.ts`, substitui `progresso.ts`)

```ts
export const CHAVE_SALVO = 'edm-salvo-v2';            // { v: 2, slots: Campanha[], aparelho: Aparelho }
export const CHAVE_TREINO = 'edm-treino-v1';          // preferências do Quintal; nunca lido pela campanha

export interface Aparelho { apelido: string; qualidade: 'baixa' | 'media' | 'alta'; som: boolean; controles: ConfigControles; ultimaSala?: string }

export interface Campanha {
  v: 2;
  id: string;                    // 16 chars [A-Za-z0-9]
  nome: string;                  // "Natan & Bruna"
  criadaEm: number; salvoEm: number; rev: number;
  prologoVisto: boolean; finalVisto: boolean;
  /** por capítulo (1–7): concluído e o que se pegou (união entre aparelhos) */
  capitulos: Record<number, ProgressoCapitulo>;
  /** desbloqueios do casal (bitmasks, base64url): armas (16 bits, DESIGN_ARMAS), roupas, acessórios, lembranças, minigames, segredos */
  desbloqueios: { armas: number; roupas: string; acessorios: string; lembrancas: number; minigames: number; segredos: string };
  /** o que cada personagem veste e carrega (0 Natan, 1 Bruna) */
  personagens: [Visual, Visual];
  /** onde parar e voltar (o mais novo vence) */
  retomada?: ResumoLanterna;
  /** recordes e estatísticas só por diversão (máximo/soma por aparelho, não afetam desbloqueio) */
  estat: { tempoJogado: number; bolhas: number; abracos: number; atalhosDonaLume: number };
}
export interface ProgressoCapitulo {
  concluido: boolean;            // OU
  /** índices de fase.estrelinhas já pegos em qualquer partida (união) → as 3 estrelas grandes saem daqui */
  pegas: string;                 // bitset base64url (≤ 46 estrelinhas = 8 chars)
  /** melhor total numa só passada (máximo) — o placar de hoje (`ResultadoCapitulo.estrelinhas`) */
  melhorPassada: number; total: number;
  arena?: boolean;               // cap. 7: a Arena foi vencida (substitui `arena7`)
  baus: string;                  // baús abertos (bitset)
}
export interface ResumoLanterna {
  v: 1; cap: number; lanterna: number;    // -1 = início
  tick: number;                  // mantém as plataformas que dependem do tempo onde estavam
  coletadas: number[];           // estrelinhas desta passada
  est: [number, number]; casal: number;
  derrotados: string;            // bitset dos bichinhos já derrotados (não voltam: já deram a estrelinha)
  arsenal?: [unknown, unknown];  // quando o arsenal existir (DESIGN_ARMAS §11)
  rev: number; salvoEm: number;
}

export function fundir(a: Campanha, b: Campanha): Campanha;          // união/máximo/OU; retomada pela regra (rev, salvoEm)
export function retomar(f: Fase, r: ResumoLanterna): Estado;          // o que o script de medida faz (§2.2)
export function exportarCodigo(c: Campanha): Promise<string>;         // "EDM2-" + base64url(deflate-raw(JSON)) + "-" + crc32
export function importarCodigo(s: string): Promise<Campanha | Error>; // valida (limpar*), nunca substitui: funde
```

**Regras da retomada (iguais às da medida de §2.2):**
- Bichinhos derrotados continuam derrotados.
- Portas começam fechadas (as placas recalculam).
- Os dois renascem na lanterna com 3 corações.
- O fio volta ao estado inicial, como já acontece no "os dois viraram bolha" (`sim.ts:321–325`).

### 5.4 Migração de `edm-progresso-v1`
1. Na primeira abertura da versão nova, se existir `edm-progresso-v1` e não existir `edm-salvo-v2`, criar o slot 1
   "Nossa jornada" com:
   - `prologoVisto` e `finalVisto` do v1;
   - para cada capítulo do v1: `concluido = true`, `melhorPassada = estrelinhas`, `total = total` e `pegas = ''`.
     O v1 não diz quais estrelinhas foram pegas. As 3 estrelas grandes usam `max(melhorPassada, contagem(pegas))`,
     então ninguém perde estrela grande;
   - `arena7` presente → `capitulos[7] = { concluido: false, melhorPassada: arena7.estrelinhas, … }` e
     `retomada = { cap: 7, lanterna: <última>, … }`. O mapa oferece a Arena, como hoje.
2. **Não apagar o v1** por duas versões, para poder voltar atrás. O v2 é a fonte e o v1 deixa de ser escrito.
3. Teste: um v1 de cada forma (vazio, 3 capítulos, só `arena7`, completo, lixo) → v2 → `liberado`, `pedacos` e
   `estrelinhasTotais` iguais aos de antes.

### 5.5 Trocar de aparelho (código de progresso)
- **Tamanho [hipótese, pela conta]:**
  - uma campanha completa em JSON tem ≈ 600–900 B: 7 × (≈ 60 B) + desbloqueios + visuais + retomada de 200 B;
  - com `CompressionStream('deflate-raw')` (Chrome 80+, Safari 16.4+, ou seja iOS 16.4 ou mais novo no iPhone 14)
    cai para ≈ 350–500 B;
  - em base64url, isso dá **≈ 470–670 caracteres**.

  Serve para "copiar e colar" e para link (`?importar=` no próprio endereço, que abre a tela de confirmação). Não
  serve para digitar.
- **Para digitar:** o próprio canal da sala. Na tela de sala, "Enviar meu progresso" manda o slot ao outro aparelho, e
  o outro funde. Isso já resolve celular → celular sem código.
- **Na importação:**
  - CRC32 confere erros de cópia;
  - `limpar*` (como o `limparProgresso` de hoje, `progresso.ts:27`) recusa campos estranhos;
  - a importação **sempre funde**, sem substituir;
  - o slot importado mantém o `id`, então importar duas vezes não duplica.

---

## 6. Companheiro controlado pelo jogo

### 6.1 Onde ele mora
```
Partida (anfitrião ou local)
  ent[0] = assento[0].entrada(...)   ← Controles (toque/teclado) | Remoto (rede) | Companheiro
  ent[1] = assento[1].entrada(...)
  passo(fase, estado, ent)           ← o núcleo não sabe quem é quem
```
- `src/core/companheiro/` é TypeScript puro, sem DOM e sem Three.js, determinístico e sem `Math.random`. Ele roda
  **só no aparelho que simula**: o anfitrião, ou o aparelho local quando se joga sozinho.
- O convidado continua recebendo `st` (instantâneos) e não sabe se o outro personagem é gente ou IA, a não ser por um
  bit de exibição (§8).
- **O determinismo não é exigido pela rede**, que tem anfitrião autoritativo. Ele é exigido pelos **testes** (a mesma
  semente dá a mesma partida) e pelo gancho `roteiro` dos e2e, que reproduz entradas gravadas.
- A IA lê o `Estado` completo, como os bots. Não há "visão" simulada: o que limita a IA são **regras de
  comportamento** (raios e tempos), não a falta de informação.

### 6.2 Mapa de apoio (dados por fase, gerados no build)

```ts
export interface MapaApoio {
  hashFase: string;                  // o teste falha se a fase mudou e o mapa não foi regenerado
  nos: NoApoio[];                    // os nós de alcance.ts (tipo, x0, x1, y, k)
  lig: LigApoio[][];                 // { para, tipo: 'solo'|'super'|'fio'|'porta', porta?, manobra: Manobra }
  coop: PontoCoop[];                 // as ajudas da §2.1, revisadas pelo designer
  estrelas: number[][];              // estrelinhas alcançáveis sozinho a partir de cada nó (alcance.ts já calcula)
}
/** Onde e como o companheiro ajuda. Gerado pelo Dijkstra da §2.1 e anotado à mão quando preciso (campo `apoio` da fase). */
export interface PontoCoop {
  id: string;                        // 'cap1:tampa'
  tipo: 'placa' | 'placaDupla' | 'impulso' | 'puxar' | 'fioAncora' | 'fioPendurado' | 'argolaEmpurrar' | 'ferramenta';
  /** onde o JOGADOR precisa estar para o ponto "acender" (retângulo de gatilho) */
  gatilho: Retangulo;
  /** onde o companheiro fica e o que faz (placa id, x de espera, lado do fio…) */
  papel: { x: number; y: number; placa?: string; segurar?: 'act'; ate: CondicaoFim };
  /** a mesma ajuda com os papéis trocados (o jogador faz a parte do companheiro) */
  inverso?: string;
  /** plano B (§6.6) */
  dica: string; autoSolucao: 'tolerancia' | 'atalho';
}
```

- **Gerado:** nós, ligações e o candidato a `coop`, pelo Dijkstra de `medir_modos.ts` (§2.1). Esse script vira
  `tools/gerar_apoio.ts`.
- **Escrito à mão** (campo opcional `apoio` em `FaseCapitulo`, `src/core/fases/comum.ts`):
  - o texto da dica;
  - o x exato de espera quando a geometria pede (por exemplo, a beira do galho no fio);
  - os pontos inversos.
- **Na conferência do build:** todo `PontoCoop` cobre uma ligação que exige o parceiro, e toda ligação dessas que
  esteja num caminho mínimo tem um `PontoCoop`.

### 6.3 Camadas e comportamento

1. **Percepção** (a cada tick, ~0,05 ms [hipótese]):
   - em que nó estão o jogador e o companheiro (`noSob`, já existe);
   - qual `PontoCoop` está aceso (o jogador dentro do `gatilho`);
   - perigos a menos de 3 m: bichinho, esporo ou beira;
   - bichinhos a menos de 6 m na frente;
   - estrelinhas da lista do nó.
2. **Planejador** (só quando muda o nó de alguém, ou a cada 30 ticks):
   - BFS ou A\* no grafo do mapa de apoio, de `nóCompanheiro` até o `nóAlvo` que o comportamento escolheu;
   - só ligações que ele pode usar agora: `podeUsar` com o jogador onde ele está.

   O cap. 3 tem 303 nós e 5 028 ligações: é barato.
3. **Comportamento**: árvore de prioridades, avaliada a cada tick, em que a primeira que se aplica vence:

| # | Ramo | Quando | O que faz |
|---|---|---|---|
| 1 | **Sobreviver** | esporo ou bichinho vai tocar em < 0,5 s; beira sem chão à frente | pula, recua, ataca o esporo (o `autoTiro` de `bot.ts:154` vira `autoAtaque`) |
| 2 | **Reviver** | o jogador virou bolha | para no chão seguro mais perto, de frente para ele, sem pular (a bolha vem a 3,5 m/s, `VIDA.velBolha`) |
| 3 | **Ser revivido** | o companheiro virou bolha | a bolha já voa até o jogador (`sim.ts`); nada a fazer |
| 4 | **Comando** | há comando ativo (§6.4) | cumpre até o fim ou até o tempo limite (20 s; "espera" dura até um novo comando) |
| 5 | **Cooperar** | um `PontoCoop` aceso | vai ao `papel.x` pela rota e executa a manobra (placa: fica em cima; impulso: chega a ≤ 1,3 m e aperta ✋ quando o jogador para; puxar: sobe primeiro, se for o caso, e aperta ✋ na beira; âncora: segura ✋ na beira; pendurado: desce da beira, sobe ou balança e solta) |
| 6 | **Lutar** | bichinho a < 6 m entre os dois ou indo para o jogador | ataca com a arma comum; nunca gasta munição rara (DESIGN_ARMAS §10) |
| 7 | **Coletar** | estrelinha da lista do nó a < 4 m da rota e o jogador a < 8 m | pega e volta |
| 8 | **Seguir** | sempre | fica 1,5–3 m atrás do jogador (do lado de onde vieram), no mesmo nó ou no vizinho; para quando ele para; nunca passa à frente sem comando |
| 9 | **Reagrupar** | > 18 m do jogador, ou sem rota por 6 s, ou fora da tela por 4 s | vira **bolha de propósito** (sem perder corações) e voa até o jogador. Usa a mecânica que o jogo já tem e não é um teleporte escondido |

4. **Manobras.** As primitivas de `test/fases/bot.ts` mudam para `src/core/companheiro/manobras.ts`, e o
   `test/fases/bot.ts` passa a importá-las de lá, sem perder nada. Elas são `ir`, `saltar`, `darImpulso`, `superpulo`,
   `segurarFio`, `descerDaBeira`, `balancar` (com `preverVoo`), `carona`, `subirEm`, `saltarDe`,
   `subirNaGiratoria`/`saltarDaGiratoria`, `atravessarArgola`, `quicarPara` e `lutarComORei`.

   Cada ligação do mapa já diz qual manobra a atravessa: `solo` vira `saltar` ou `ir`, especial vira `carona` ou
   `subirEm`, `quica` vira `quicarPara` e `argola` vira `atravessarArgola`. São as mesmas usadas pelos 7 planos, que
   hoje fecham os 7 capítulos.

5. **Ajustes "humanos"** (para não parecer robô):
   - 6–12 ticks de reação, por uma tabela fixa indexada pelo tick, sem sorteio;
   - olha para o jogador quando para;
   - anima "acenar" quando está esperando;
   - nunca fica em cima de placa sem motivo.

### 6.4 Comandos de contexto no celular

- **Botão:** o **rosto do parceiro no HUD** (canto de cima, longe dos polegares). Na tela de 844×390 ele tem Ø 48 px.
- **Um toque: "Vem!"** O companheiro corre até o jogador. Se estiver longe, vira bolha e vem.
- **Segurar:** abre um leque de 4 opções abaixo do rosto, que **mudam com o contexto**:

| Contexto (percepção) | Opções |
|---|---|
| padrão | Vem · Espera aqui · Vai na frente · Ataca |
| placa à vista (≤ 12 m) | **Fica na placa** · Vem · Espera · Ataca |
| parede alta a ≤ 2 m | **Mãos dadas (me dá impulso)** · **Sobe e me puxa** · Vem · Espera |
| zona de fio, na beira | **Segura o fio** · **Eu seguro, você desce** · Vem · Espera |
| bolha/perigo | Vem · Me espera aí · — · — |

- **No teclado:** `C` = "Vem", `1–4` = opções.
- A **intenção implícita** vem antes do comando. Nos casos de §6.5, o ponto acende sozinho quando o jogador entra no
  gatilho. O comando serve para escolher **outro papel**, por exemplo quando o jogador quer ser quem segura a placa.
- O ✋ **não muda**: continua sendo mão, fio e argola. O companheiro responde ao ✋ como uma pessoa responderia. Se o
  jogador para ao lado dele e aperta ✋ perto de uma parede alta, ele dá o impulso.

### 6.5 Cada puzzle cooperativo de hoje, jogado sozinho

| Cap. | Trecho (x) | Mecânica | Companheiro | Gatilho / comando | Plano B |
|---|---|---|---|---|---|
| 1 | tampa 33–46 | placa dos dois lados | fica na placa de cá; quando o jogador passa e pisa na de lá, atravessa | o jogador entra a ≤ 3 m da porta | dica "o Natan segura, você passa"; aos 45 s a tolerância sobe (fica na placa até o jogador estar 2 m depois da porta) |
| 1 | caixa alta 46–55 | mãos dadas (impulso + puxar) | dá impulso; depois o jogador puxa de cima, **ou** ele sobe primeiro e puxa | parede alta + jogador parado ao lado (✋) | auto: em "Deixa comigo", ele sobe com impulso (o jogador só precisa ficar parado e apertar ✋, e o botão pisca) |
| 1 | prateleira secreta 112–116 | mãos dadas | idem; **opcional** (segredo) | só por comando ou ✋ | — |
| 1 | portão 136–158 | placa no alto, impulso + placa | dá impulso ao jogador, que segura a placa lá em cima; depois atravessa e segura a de lá; **ou o inverso** | gatilho na base da prateleira | inverso pelo comando "Sobe e segura" |
| 2 | fio 1 (36–63) e fio 2 (112–134) | âncora / pendurado | **âncora** na ponta do galho (✋ segurado) enquanto o jogador balança; depois, do outro lado, é âncora de novo e o jogador sobe pela corda; ou, por comando, **pendurado** com o jogador como âncora | jogador na zona do fio a ≤ 4 m da beira | dica + "segura ✋"; aos 45 s, assistência do balanço (§6.6) |
| 2 | ilha 125–130 e trechos 39→54, 175→182 | mãos dadas | impulso/puxar | parede alta | idem cap. 1 |
| 3 | rua 64–100 | **porta dupla** (`modo: 'todas'`) + porta da sacada com a placa do lado de lá | fica na placa B enquanto o jogador está na A; depois o jogador vai pela rua e o companheiro pelo ponteiro do relógio 2 (manobra `subirNaGiratoria`), e quem chega à sacada abre para o outro | jogador numa placa da porta dupla | o ponteiro é a parte difícil: se o **jogador** escolher o ponteiro e falhar 3 vezes, o companheiro troca de papel (ele pega o ponteiro) |
| 3 | portão do tempo 128–186 | porta dupla colada + telhado por mãos dadas | impulso para o jogador subir ao telhado; os dois em uma placa cada | parede/telhado | inverso: ele sobe e o jogador segura a placa |
| 3 | ponteiros 38–64, 186–214 | tempo (sozinho) | só segue e espera do outro lado | — | dica de tempo (o ponteiro pisca na hora de pular) — solo para os dois |
| 4 | argolas 58–84, 162–220 | pêndulo + empurrar | na beira, aperta ✋ e **empurra o balanço** do jogador (`fio.ts`, ARGOLA) | jogador agarrado na argola | o barquinho (162–220) já é a alternativa sozinho |
| 4 | fio píer–jangada 82–103 | fio de 5 m | âncora na ponta do píer | jogador na zona | assistência do balanço |
| 4 | comporta 104–162 | placa no mastro | sobe a bolha até o mastro e segura a placa; ou fica embaixo e o jogador sobe | gatilho na comporta | inverso |
| 5 | portão de pirulito 48–104 | placa na torre de bolo (gelatina) | ele quica até a torre (`quicarPara`) e segura; o jogador passa e segura a de lá | gatilho no portão | inverso; gelatina com "segura o pulo" piscando |
| 5 | muro de chocolate 140–175 | mãos dadas | impulso/puxar | parede alta | idem cap. 1 |
| 6 | corredores 30–98 | cada porta tem a placa no corredor do OUTRO | **o caso mais pedido pela história.** O companheiro vai **para o outro corredor** nas salas de espelho (tábuas), anda emparelhado no mesmo x, para na placa da porta do jogador e, aberta a porta, o jogador para na placa dele; repete no 2º trecho | jogador entra num corredor → o companheiro pega o outro | dica "um em cada corredor"; aos 45 s, porta aberta por "Deixa comigo" (ele já está na placa: só aumenta a tolerância) |
| 6 | muro 140–152 | mãos dadas | impulso/puxar | parede alta | idem cap. 1 |
| 7 | fio o tempo todo (4–176, 5,5 m) | amarrados | **segue sempre a < 4 m** (o fio puxa quem se afasta); na ilha alta (92–124), ele sobe com impulso, segura o fio, e o jogador sobe pela corda | sempre / ilha alta | o fio sem âncora escorrega a 1,2 m/s (`docs/NUCLEO.md`): o companheiro **nunca solta a âncora** com o jogador pendurado |
| 7 | Rei-Pesadelo 180–216 | combate | ataca só com o ponto fraco aberto (`lutarComORei`); fica do lado oposto ao do jogador para dividir os esporos | bichinho "rei" vivo a < 16 m | Arena 3D: aliado com o `BotArena` (`test/arena_bot.ts`, perfil acerto 0,6 e desvio 0,7) — **a cargo da equipe da arena** |
| Todos | estrelinhas "de dupla" (cap. 1 #22–24, cap. 2 #18–20, AUDITORIA_MOVIMENTO §2.3) | mãos dadas | comando "Mãos dadas" | parede alta | marcar com o ícone de mãos dadas |

### 6.6 Plano B quando a IA (ou o jogador) não consegue

Para cada `PontoCoop`, a partir do momento em que acende:

| Tempo/falhas | O que acontece |
|---|---|
| 0–20 s | nada; o companheiro faz a parte dele |
| 20 s sem passar | **dica**: balão do companheiro ("Eu seguro aqui, você passa!") + seta no chão + o botão necessário pisca |
| 45 s **ou** 3 falhas (queda/bolha no trecho) | **"Deixa comigo"**: o papel do companheiro fica tolerante. Ele não solta a placa ou a âncora até o jogador estar 2 m depois. O impulso fica ligado por 1 s em vez da janela curta. No fio, um "balanço assistido" leva a velocidade a 5,2 m/s no sentido certo, o máximo útil (`LEIAME.md`) |
| 60 s **ou** o companheiro sem rota por 10 s | **Atalho da Dona Lume** (no HUD e na pausa): uma bolha leva os dois à próxima lanterna. As estrelinhas do trecho continuam no mapa (podem ser pegas depois). Conta em `estat.atalhosDonaLume`, sem punição. É a rede de segurança contra "impossível" — inclusive para falhas da própria IA |
| qualquer hora | **Trocar de personagem ⇄**: se a parte do companheiro for a fácil, o jogador assume o outro |

**Telemetria local** (sem servidor): o aparelho conta, por `PontoCoop`, tempo, falhas e uso do atalho. Na tela de
capítulo concluído, aparecem 3 números para o diretor (`?debug`). É o "registro de problemas" do item 13.

### 6.7 Alternar de personagem (sozinho)
- A troca usa o ⇄ que já existe (`partida.ts:69–71`). Hoje ele só está no treino. Na campanha solo, passa a trocar
  **qual assento recebe `Controles` e qual recebe `Companheiro`**.
- A IA recebe o personagem no estado em que ele está. A memória dela é limpa, e o planejador recomeça.
- O arsenal, a roupa e as estrelinhas são **do personagem** (DESIGN_ARMAS §10).
- **Bloqueado** enquanto há alguém pendurado no fio, agarrado na argola ou no ar, para não deixar ninguém caindo.
  Também fica bloqueado em dupla.
- A câmera segue o personagem controlado e faz a transição em 0,4 s [a câmera é da equipe de câmera].

---

## 7. Progressão e desbloqueios

| Marco | Como se ganha | O que libera | Onde aparece |
|---|---|---|---|
| Capítulo N | pedaço da estrela do N−1 (como `liberado`, `progresso.ts:56`) | o capítulo N no mapa; a lembrança N no álbum da Casa | tela de concluído com "Novidades" em cartões |
| ★ estrelas grandes (3 por capítulo) | 50 %, 75 % e 100 % das estrelinhas **pegas em qualquer passada** (união, §5.3) | 1ª: um acessório do capítulo; 3ª: uma roupa do capítulo | roupeiro da Casa; o mapa mostra ★★☆ |
| Armas e ferramentas | achadas na fase/baús (curva de DESIGN_ARMAS §5) | ficam do casal (bitmask) | chip "Novo!" na roda de armas |
| Segredos (prateleira, galho alto, nuvem…) | chegar ao lugar secreto | foto secreta na parede da Casa + uma estrelinha dourada | parede da Casa |
| Minigames (P2) | concluir capítulo X | trenzinho (1), corrida de folhas (2), relógio de bater ponto (3), barquinho (4), bolo (5), espelho (6), dança das estrelas (7) | jogos da Casa (2 jogadores ou com o companheiro) |
| Momentos do casal | abraço ao renascer da bolha, dança na lanterna (✋ duas vezes parado), beijo no pedaço da estrela | contador e emotes desbloqueáveis | álbum |
| Final | Arena vencida | créditos + "Nova jornada+" no slot (mesmas fases, desafios de estrelinha) [P2] | menu |

Para dar a **sensação de conquista**, a tela de concluído mostra, em ordem e com som:
1. as estrelinhas;
2. as estrelas grandes;
3. os cartões das coisas novas;
4. a lembrança.

O mapa mostra o **quanto falta** em cada ilha (por exemplo ★ 31/38, 2 segredos de 3). Nada fica só no treino: o
**Treino libera tudo para teste e não conta para nada**. O teste T-Treino (§11) confere que o slot fica igual byte a
byte.

---

## 8. Rede

### 8.1 Quem é anfitrião
- **Sempre o aparelho que está simulando a campanha naquele momento.**
  - Começou sozinho: é o anfitrião.
  - "Chamar a Bruna" chama `criarSala` **sem parar o jogo**. O PeerJS registra o id em ≈ 1–3 s [hipótese: só o
    público mediu "funciona"; o tempo não foi medido].
  - A Bruna entra pelo código e vira convidada.
- **Se cai o convidado:** a IA assume (§8.3), e o anfitrião continua com a sala aberta para a volta.
- **Se cai o anfitrião** (fechou o navegador ou ficou sem rede): a sessão termina para o convidado. Mas o convidado
  tem a cópia do slot, recebida em `salvo` a cada lanterna. A tela oferece **"Continuar sozinha daqui"**, que retoma
  na última lanterna no aparelho dela, com o mesmo `id` de campanha.
  - Na próxima conexão, a fusão (§5.1) junta tudo.
  - [P2] Migração automática: o convidado restaura do `ResumoLanterna` em ≈ 1 s e vira anfitrião local. Ele não reabre
    a sala com o mesmo código, porque o id do peer era do outro aparelho (`rede.ts:129`).

### 8.2 Mensagens (o que muda em `src/net/rede.ts`)
```ts
export const PROTOCOLO = 2;              // 'oi' com protocolo diferente → recusa com mensagem "atualize o jogo" (hoje só console.warn, main.ts:232)
export type Mensagem =
  | { t: 'oi'; versao: string; proto: number; aparelho: string /* id do aparelho */; campanha?: { id: string; rev: number } }
  /** anfitrião → convidado: assento dado, slot inteiro para fundir, chave para voltar ao mesmo assento */
  | { t: 'boasVindas'; assento: 0 | 1; slot: Campanha; chave: string }
  /** convidado → anfitrião: a cópia dele da mesma campanha (se tiver), para fundir; ou outra campanha (pergunta ao anfitrião) */
  | { t: 'meuSlot'; slot: Campanha }
  /** cópia do slot a cada gravação (lanterna, conclusão, item) — o convidado grava (hoje 'progresso' só em memória) */
  | { t: 'salvo'; slot: Campanha }
  /** quem controla cada assento, para o HUD ("IA" no rosto) */
  | { t: 'assentos'; a: ['pessoa' | 'ia' | 'remoto', 'pessoa' | 'ia' | 'remoto'] }
  /** convidado → anfitrião: cena da fase carregada; só depois disso a entrada dele assume o assento */
  | { t: 'pronto'; cap: number }
  /** convidado → anfitrião: voltar depois de cair, com a chave de boasVindas */
  | { t: 'volta'; chave: string }
  | /* as de hoje: 'in', 'st', 'ping', 'pong', 'mapa', 'cena', 'fase', 'arena', 'ina', 'sta', 'pausa', 'pedido' */ …;
```
- `'progresso'` vira `'salvo'`. Por compatibilidade, o anfitrião v2 não fala com o v1: o protocolo é recusado com a
  mensagem.
- `'in'` ganha a regra de **entrada velha**: o anfitrião guarda o tick da última `in`. Se passa de **60 ticks (1 s)**
  sem nenhuma, o assento 1 volta para `Companheiro`, sem esperar os 7 s do `PRAZO_SILENCIO`. Quando volta a chegar
  `in`, o assento retorna ao remoto (com o toast "Bruna voltou!").
- O instantâneo (`instantaneo.ts`) ganha **1 bit por jogador** em `bits` (64 = IA), +0 B. O resto não muda: a IA é
  invisível para a rede.
- A sala continua sendo para dois (`rede.ts:145`). Quem volta com a `chave` certa reocupa o assento. Uma pessoa nova
  com o código só entra se o assento estiver com a IA.

### 8.3 Linha do tempo de entrar, cair e voltar
```
t=0     sozinho, IA no assento 1 ................................................. (local)
t=10s   pausa → "Chamar a Bruna" → criarSala; o jogo continua (IA)
t=40s   Bruna: código → 'oi' → 'boasVindas' (slot) → convidado funde e grava → 'fase' cap → carrega cena → 'pronto'
t=43s   anfitrião: assento 1 = Remoto. Toast "Bruna entrou!" + abraço curto (anima só, sem parar a simulação)
t=300s  rede da Bruna some → 60 ticks sem 'in' → assento 1 = Companheiro (toast "A Bruna caiu — eu cuido dela")
t=307s  PRAZO_SILENCIO: canal 'caiu' → o anfitrião NÃO pausa (hoje pausa: main.ts:267); sala aberta esperando 'volta'
t=330s  Bruna volta → 'volta' + chave → 'salvo' + 'fase' (retoma pela tela atual, como hoje em main.ts:275–278) → 'pronto' → Remoto
```
**Pausa:** só por pedido explícito (o botão ❚❚ de qualquer um), como hoje. A queda **não pausa** mais. Na arena (3D),
é a mesma regra, desde que a equipe da arena ofereça um aliado IA. Até lá, a arena mantém a pausa.

---

## 9. APIs propostas (resumo para quem implementar)

```ts
// src/core/assento.ts
export interface ControladorAssento { tipo: 'pessoa' | 'remoto' | 'ia'; entrada(f: Fase, e: Estado, i: 0 | 1): Input; reiniciar?(): void }

// src/core/companheiro/index.ts
export interface OpcoesCompanheiro { mapa: MapaApoio; perfil?: { reacao: number; distSeguir: [number, number] } }
export type Comando = 'vem' | 'espera' | 'frente' | 'ataca' | 'placa' | 'impulso' | 'puxar' | 'segurarFio' | 'descerFio';
export class Companheiro implements ControladorAssento {
  constructor(f: Fase, o: OpcoesCompanheiro);
  entrada(f: Fase, e: Estado, i: 0 | 1): Input;      // determinística: mesma (f, e, memória) → mesma Input
  comandar(c: Comando, tick: number): void;          // vem do HUD (local) — no convidado não existe (dupla não tem IA)
  readonly ramo: string;                              // para depuração e testes ('seguir', 'coop:cap1:tampa'…)
  readonly ponto: { id: string; aceso: number; falhas: number } | null;   // alimenta o plano B (§6.6)
}

// src/ui/partida.ts (a única mudança no laço): ent = [assentos[0].entrada(f, e, 0), assentos[1].entrada(f, e, 1)]
// src/ui/salvo.ts: Campanha, ResumoLanterna, fundir, retomar, migrarV1, exportarCodigo, importarCodigo (§5.3)
// tools/gerar_apoio.ts → src/core/fases/apoio/capN.json (hashFase) ; test: apoio em dia + PontoCoop cobre toda ligação de ajuda
```

---

## 10. Desempenho e bateria do companheiro [hipótese até medir]
- Percepção + comportamento: só aritmética sobre ≤ 300 nós e ≤ 12 bichinhos. A meta é **≤ 0,1 ms por tick** no Redmi
  Note 11 (6 ms/s a 60 Hz).
- Planejador: só quando muda o nó ou a cada 30 ticks.
- Medir com `performance.now()` no `?debug=1`, ao lado das chamadas e triângulos.
- Mapa de apoio: carregado com a fase (import dinâmico, como as fases). São 1,4–67 KB de JSON, e o gzip deve reduzir
  para ≈ 25 %.
- Sala aberta à toa custa bateria (ping a cada 1,5 s, `rede.ts:19`), por isso **só abre com "Chamar a Bruna"**.

---

## 11. Testes de aceite

| Id | Teste | Como | Passa quando |
|---|---|---|---|
| T1 | **Sozinho, os 7 capítulos** | vitest: o assento 0 é um "bot humano" que só segue a rota principal e reage aos `PontoCoop` como jogador (vai ao gatilho, espera, aperta ✋/pulo); o assento 1 é o `Companheiro` real | `concluida` nos 7; ≤ 2 voltas à lanterna por capítulo; **0 atalhos da Dona Lume** |
| T2 | Sozinho com o jogador fazendo o **papel inverso** | igual ao T1, com o bot humano escolhendo `inverso` em todos os pontos que têm | os 7 concluem |
| T3 | **Bot humano "distraído"** | o bot humano para 5–15 s em lugares fixos, volta 10 m, cai de propósito em 1 vão por capítulo | os 7 concluem; o companheiro nunca fica > 18 m por mais de 6 s sem reagrupar |
| T4 | **Plano B** | bot humano que **erra** o papel dele 3× no fio 1 do cap. 2 e na sacada do cap. 3 | "Deixa comigo" dispara em ≤ 45 s; atalho oferecido em ≤ 60 s; com o atalho, chega à lanterna seguinte |
| T5 | **Cair a conexão no meio** (e2e, `dupla.mjs` + servidor PeerJS local) | cap. 1 em dupla com `roteiro`; no tick 3000, o convidado corta a rede (`context.setOffline(true)`) | em ≤ 70 ticks o assento 1 está com a IA (`__edm.assentos()`); **a simulação não pausa** (tick avança); a fase conclui; o convidado volta com `setOffline(false)` e reassume; mesmo placar nos dois |
| T6 | **Entrar no meio** (e2e) | anfitrião sozinho até a lanterna 2 do cap. 3; convidado entra pelo código | o convidado recebe o slot, grava `edm-salvo-v2` com o mesmo `id`; assume em ≤ 1 s após `pronto`; a campanha conclui o cap. 3 sem recomeçar |
| T7 | **Cair o anfitrião** (e2e) | fecha a página do anfitrião depois da lanterna 3 do cap. 4 | o convidado mostra "Continuar sozinha daqui"; retoma na lanterna 3 do cap. 4 com o companheiro e conclui |
| T8 | **Salvar/retomar** | vitest: o `medir_modos.ts` vira teste (37/37 hoje) + e2e: recarregar a página no meio do cap. 5 e tocar "Continuar" | 37/37; no e2e, volta na mesma lanterna com as mesmas estrelinhas e os mesmos bichinhos derrotados |
| T9 | **Fusão** | vitest de propriedades: 500 pares de slots gerados com semente; `fundir(a,b) == fundir(b,a)`, `fundir(a,a) == a`, nada que estava em `a` ou `b` some | sempre |
| T10 | **Migração v1** | os 5 v1 de §5.4 → v2 | `liberado`, `pedacos`, `estrelinhasTotais`, a Arena pendente: iguais a antes |
| T11 | **Código de progresso** | exportar → importar em outra página limpa; corromper 1 caractere | igual depois de importar; corrompido → erro claro, nada gravado |
| T12 | **Treino não toca na campanha** | e2e: `localStorage` antes/depois de 2 min no Quintal (armas, capítulos, troca) | `edm-salvo-v2` idêntico byte a byte |
| T13 | **Determinismo do companheiro** | duas execuções do T1 | entradas e estados iguais tick a tick; `grep Math.random src/core` vazio |
| T14 | **Mapa de apoio em dia** | vitest | `hashFase` confere; todo `PontoCoop` cobre ligação de ajuda; toda ligação de ajuda de um caminho mínimo tem `PontoCoop` |
| T15 | **Teleporte (guardião do §3)** | vitest: os 7 planos + o caso do cap. 6 | nenhum passo move o corpo > |vx·dt| + 0,35 m na horizontal |
| T16 | **Comandos** | vitest: no cap. 1, comando "Fica na placa" com o companheiro a 10 m | ele chega à placa em ≤ 4 s e fica até novo comando |
| T17 | **Alternar** | vitest: ⇄ no meio do cap. 4 | a IA assume o outro sem pular nem soltar âncora; bloqueado com alguém pendurado |
| T18 | **Versão diferente** | e2e: convidado com `proto: 1` | recusa com mensagem "atualize", sem travar o anfitrião |

---

## 12. Plano de implementação

| Prioridade | Entrega | Depende de | Esforço (dias) | Aceite |
|---|---|---|---|---|
| **P0** | Corrigir o teleporte em `colisao.ts` + guardião | — | 0,5–1 | T15; `npm test` |
| **P0** | Salvo v2: `Campanha`, fusão, migração v1, slots, gravar no convidado, `pagehide` | — | 3 | T8 (vitest), T9, T10 |
| **P0** | Retomar na lanterna ("Continuar") | salvo v2 | 1–2 | T8 (e2e) |
| **P0** | Assentos (`ControladorAssento`) no laço de `partida.ts`; campanha sozinho abre sem sala | — | 1 | `npm test`; e2e capitulos (treino) sem mudança |
| **P0** | Manobras para `src/core/companheiro/manobras.ts` (os bots passam a importar) | — | 1 | os 7 planos fecham igual |
| **P0** | `gerar_apoio.ts` + `apoio/capN.json` + `PontoCoop` revisados (7 capítulos, 4–8 cada) | correção do teleporte | 3 | T14 |
| **P0** | `Companheiro`: seguir, reagrupar, reviver, os 4 papéis de cooperação, lutar | assentos, manobras, apoio | 8–12 | T1, T3, T13 |
| **P0** | Plano B (dica, "Deixa comigo", Atalho da Dona Lume) | Companheiro | 2–3 | T4 |
| **P1** | Drop-in/drop-out: protocolo 2, `boasVindas`/`salvo`/`pronto`/`volta`, entrada velha → IA, sem pausa na queda | assentos, salvo v2 | 4–5 | T5, T6, T18 |
| **P1** | Comandos de contexto (rosto no HUD, leque) + teclado | Companheiro | 2–3 | T16 + A9 de DESIGN_ARMAS (sem sobreposição) |
| **P1** | Alternar de personagem na campanha solo | assentos | 1 | T17 |
| **P1** | Quintal de Treino (fase própria, chave separada) | salvo v2; arsenal (DESIGN_ARMAS) | 3–4 | T12 |
| **P1** | Progressão: estrelas grandes por união, cartões de novidades, mapa com "quanto falta" | salvo v2 | 3 | T1 + revisão visual |
| **P1** | Código de progresso (exportar/importar) e "Enviar meu progresso" pela sala | salvo v2 | 1–2 | T11 |
| **P2** | Cair o anfitrião → "Continuar sozinha daqui"; migração automática | drop-in | 2–3 | T7 |
| **P2** | Casa (hub), roupeiro, álbum, minigames, momentos do casal | progressão; arte | 10+ | revisão com o jogador |
| **P2** | Companheiro usando ferramentas/armas raras por comando; aliado na Arena (equipe da arena) | DESIGN_ARMAS P1; arena | 4–6 | A6 de DESIGN_ARMAS |

Total do P0: ≈ 20–27 dias de desenvolvimento [estimativa]. O maior risco é o `Companheiro` (ver §13).

---

## 13. Riscos, causas confirmadas e hipóteses

| Item | Situação |
|---|---|
| Campanha só com sala, convidado sem cópia, nada no meio da fase, queda pausa | **confirmado** no código (§1, linhas citadas) |
| 4–8 ajudas obrigatórias por capítulo | **confirmado** pelo grafo (§2.1); o tipo exato varia entre caminhos de mesmo custo; o cap. 6 está distorcido pelo teleporte |
| Retomar na lanterna com ≈ 200 B | **confirmado** com os bots: 37/37 (§2.2). Com pessoas, falta o e2e (T8) |
| Teleporte do cap. 6 | **confirmado**, reproduzido e rastreado (§3). Não sei se uma pessoa já passou por ele (exige o superpulo para a esquerda numa faixa de 0,3 m) |
| Grafo caro demais para montar no celular | **confirmado** no computador (até 3 s); no celular é **hipótese** (3–10×) |
| Um companheiro genérico (sem roteiro) fecha os 7 capítulos | **hipótese**. As manobras existem e fecham os 7 capítulos nos planos roteirizados; o que falta provar é a escolha reativa. Risco maior: os trechos de tempo (ponteiros do cap. 3, giratórias, plataformas que caem) e o balanço do fio. Mitigação: o companheiro **segue** nesses trechos (são solo) e o `PontoCoop` traz `papel.x` exato e escrito à mão |
| A IA parecer "burra" ou "trapaceira" | **hipótese de design**. Reagrupar como bolha (mecânica do jogo) em vez de teleporte; nunca pegar o que o jogador está indo pegar (estrelinha a < 2 m do jogador fica para ele); reação de 6–12 ticks |
| 1 s sem entrada = IA assume | **hipótese**: o 4G pode ter buracos de 0,5–1 s; o limiar de 60 ticks deve ser medido no `dupla.mjs` com perda simulada; se a troca piscar, usar histerese (assume com 60 ticks, devolve com 10 entradas seguidas) |
| Tempo do PeerJS para abrir a sala no meio da partida | **não medido**; o jogo não para enquanto abre, então só afeta o tempo até mostrar o código |
| Código de progresso de ≈ 500–700 caracteres | **estimativa por conta**; por isso o caminho principal é "Enviar pela sala" |

---

## 14. Arquivos desta entrega e como reproduzir

- `docs/revisao/ARQUITETURA_MODOS.md`: este documento.
- `tools/revisao/arquitetura-modos/`:
  - `medir_modos.ts`: ajudas obrigatórias (§2.1) e salvar/retomar na lanterna com tamanhos (§2.2). Grava
    `medidas.json`;
  - `tempo_grafo.ts`: tempo e tamanho do grafo por capítulo (§2.3);
  - `teleporte_cap6.ts` e `teleporte_cap6_rastro.ts`: reprodução e rastro do defeito do §3;
  - `rodar.sh`: empacota com o rolldown do projeto e roda no node;
  - `medidas.json`: saída da última execução.

```sh
git -C /home/user/entre-dois-mundos worktree add <pasta> HEAD && ln -s /home/user/entre-dois-mundos/node_modules <pasta>/node_modules
cp -r /home/user/entre-dois-mundos/tools/revisao/arquitetura-modos <pasta>/tools/revisao/
<pasta>/tools/revisao/arquitetura-modos/rodar.sh medir_modos         # ~10 s; SAIDA_DIR=… para onde gravar medidas.json
<pasta>/tools/revisao/arquitetura-modos/rodar.sh tempo_grafo
<pasta>/tools/revisao/arquitetura-modos/rodar.sh teleporte_cap6      # imprime "TELEPORTE 29.50→66.10"
git -C /home/user/entre-dois-mundos worktree remove --force <pasta>
```
