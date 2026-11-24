# Núcleo da simulação (`src/core`)

Simulação pura e determinística (passo fixo de 60 Hz, sem Three.js/DOM, sem sorteio). Roda no anfitrião e no treino.

| Arquivo | O quê |
|---|---|
| `types.ts` | `Input`, formato de fase (`Fase` e defs), `Estado` |
| `sim.ts` | `estadoInicial`, `passo`, jogadores, tiro, contato, vida/bolha, coletáveis, lanternas, placas/portas, pedaço da estrela; lista de eventos no topo |
| `inimigos.ts` | bichinhos-pesadelo e Rei-Pesadelo (`INIMIGO`, `REI`, `COGUMELO`) |
| `fio.ts` | Fio Vermelho e argolas (`FIO`, `ARGOLA`) |
| `plataformas.ts` | plataformas especiais |
| `instantaneo.ts` | `instantaneo` / `restaurar` / `interpolar` (rede) |
| `fases.ts` | `criarFase` (padrões), `FLORESTA_1`, `EXEMPLO_MECANICAS` (todas as mecânicas, comentada) |

## Entrada
`{ x: -1..1, y?: -1..1, jump, act, shoot? }`. `y` (⬆/⬇) sobe/desce pelo fio e pela argola. `shoot` segurado dispara na
cadência (3/s). A entrada do convidado passa por `normalizarInput` no anfitrião.

## Regras principais
- **Faísca**: 14 m/s, alcance 8 m, sai na direção em que o jogador olha; some na parede; estoura esporos.
- **Vida dos bichinhos**: bolotinha 1, morcego 1, cogumelo 2, espinhudo 2, Rei 20 (só com o ponto fraco à mostra;
  fases de ataque 1→2→3 com 14 e 7 de vida; pisar nele com o ponto fraco aberto também conta 1).
- **Pisão** (caindo, pés acima do topo do bichinho): derrota e quica (segurando pulo, quica mais). Espinhudo machuca.
- **Dano**: −1 coração, 1 s de invencibilidade, empurrão. 0 corações = bolha (atravessa tudo, vai até o parceiro,
  renasce com 3 corações ao encostar). Os dois bolha = voltam à última lanterna acesa (ou ao início).
- **Estrelinhas**: `jogadores[i].estrelinhas` e `estrelinhasCasal`; bichinho derrotado solta uma (`soltas`).
- **Pedaço da estrela** (`fase.portal`): os dois dentro por 0,6 s conclui; com Rei vivo, não vale.
- **Fio Vermelho** (`fase.fio`): os dois dentro da zona = amarrados (padrão 4 m). Quem está no chão com ✋ ancora.
  Pendurado: ⬆/pulo sobe (escala a beira ao chegar), ⬇ desce, joystick balança, ✋ solta (com impulsinho; o fio só
  volta a prender quando os dois ficam a menos do comprimento). Sem âncora, o do chão escorrega até a beira (1,2 m/s).
- **Argola** (`fase.argolas`): no ar, ✋ perto agarra; joystick balança, ⬆/⬇ muda o raio, pulo solta; o parceiro no
  chão perto aperta ✋ e empurra o balanço.
- **Plataformas especiais** (`fase.especiais`): todas de um lado só (pousa-se por cima). Móvel, giratória e bolha são
  funções do tempo; quicante lança; a que cai treme, cai e volta. Porta com `modo: 'todas'` exige todas as placas.
- Bichinhos andam só sobre plataformas fixas (`plataformas`) e portas fechadas.

## Física do pulo (números de `FISICA` em `sim.ts`; travados em `test/sim.test.ts`)
Medidos tick a tick na simulação (60 Hz). Mudanças de 2026-11-24 (`docs/revisao/AUDITORIA_MOVIMENTO.md` §3), com o
valor anterior:

| Número | Antes | Agora | Efeito medido |
|---|---|---|---|
| `coyote` (ticks depois de sair da quina em que o pulo ainda sai) | 0 | **6** (0,10 s) | desligado por pulo, quique, pisão e dano (`arTicks = 99`) |
| `buffer` (ticks antes de pousar em que o aperto do pulo vale) | 0 | **7** (0,12 s) | vale segurando ou só tocando; soltar a argola com o pulo consome o aperto |
| `puloMinimo` (ticks de subida antes de soltar o botão cortar) | 0 | **8** (0,13 s) | toque de 1 tick: 0,73 → **1,38 m**; toque de 100 ms: 1,23 → 1,38 m; 170 ms: 1,51 m (igual); cheio 1,75 m (igual) |
| `corte` (por tick com o pulo solto) | 0,88 (fixo no código) | 0,88 (constante) | — |
| `quinaPes` / `quinaVy` (no ar, contra a parede) | não havia | **0,20 m** / vy ≤ 4 m/s | degrau colado máximo: 1,74 → **1,90 m**; no chão não sobe degrau |
| pisão (`lancado = true`) | não ligava | liga | quique solto: 0,47 → **1,27 m**; segurando 2,7 m (igual) |
| `coyoteRedeMax` | — | 15 ticks (0,25 s) | teto para `Estado.toleranciaRede` (coyote extra do convidado; o anfitrião ainda não preenche) |
| `QUINA_CABECA` (`colisao.ts`) | 0,32 | **0,32** (não mudou) | 0,20 m (proposta) deixa 206 pares sem saída no cap. 3 e os bots param em x 164,7 |

Sem mudança (medido de novo): `velAndar` 5,2 m/s, `gravidade` 30, `pulo` 10,5 (1,75 m, 0,70 s, 3,64 m correndo),
`impulsoPulo` 16,5 (4,40 m; 5,63 m correndo), gelatina 3,63 / 5,25 m. A tabela "vão × desnível" só cresceu (nada ficou
mais difícil); com o coyote, um vão de 5,6 m com 3 m de queda passou a ser vencido sozinho, por isso os abismos do fio
(cap. 2, 4 e 7) foram para 6,2 m.

## Rede
O anfitrião manda `instantaneo(fase, estado, eventos)` a cada 3 ticks (~20/s; números arredondados, plataformas que
dependem do tempo recalculadas pelo convidado). O convidado faz `restaurar(fase, s)` e desenha `interpolar(fase, a, b, k)`.
