# Entre Dois Mundos — desenho do jogo (v1)

Plataforma 2.5D cooperativo "estilo Mario" para dois, no celular na horizontal. História em `HISTORIA.md`.

## Controles (celular)
Joystick à esquerda. À direita: **⬆ pular**, **✨ atirar** (Lança-Estrelas, na direção em que o personagem olha),
**✋ mão** (impulso, puxar, segurar o fio). No PC: setas/WASD, Espaço, J (atirar), E (mão).

## Mecânicas
- **Pular**: pulo variável; pisar na cabeça de um bichinho-pesadelo também o derrota (como no Mario) e dá um quique.
- **Lança-Estrelas**: faísca reta, alcance ~8 m, cadência ~3 por segundo, sem munição. Derrota bichinhos.
- **Bichinhos-pesadelo** (fofos e emburrados, nunca assustadores):
  - **Bolotinha**: anda de um lado ao outro; 1 faísca.
  - **Morcego-sono**: voa em onda; 1 faísca.
  - **Cogumelo-bravo**: parado, cospe esporos lentos de tempos em tempos; 2 faíscas.
  - **Espinhudo**: não pode ser pisado; só faísca (2).
  - **Rei-Pesadelo** (chefe do capítulo 7): fases de ataque, ponto fraco brilhante, 20 faíscas.
- **Vida**: cada um tem 3 corações. Tocar num bichinho/esporo tira 1 e dá 1 s de invencibilidade. Sem corações,
  vira uma **bolha** que flutua até o parceiro e renasce encostando nele. Se os dois virarem bolha ao mesmo tempo,
  voltam ao último **checkpoint** (lanterna).
- **Estrelinhas de lembrança**: coletáveis (contador); bichinhos derrotados soltam uma.
- **Pedaço da estrela**: 1 por capítulo, no fim; os dois tocam juntos.
- **Mãos dadas**: impulso lado a lado; puxar de cima (já existe).
- **Placas e portas**: placa abre porta enquanto alguém está nela; portas duplas exigem as duas placas ao mesmo tempo.
- **Fio Vermelho**: em trechos marcados, os dois ficam amarrados por uma corda de até 4 m.
  - A corda não deixa um se afastar mais que o comprimento (puxa o outro).
  - Se um cai num vão e o outro está no chão segurando **✋**, o de baixo fica **pendurado** e pode **subir** pela corda
    (segurar ⬆) ou **balançar** (joystick) e soltar para alcançar outra plataforma.
  - Ninguém segurando: os dois são puxados para baixo; o que está no chão escorrega devagar até a beira.
- **Pêndulo**: argolas no teto onde o fio se prende; um se pendura e o outro dá impulso.

## Estrutura
Menu → (prólogo em quadrinhos) → mapa da jornada (7 capítulos; desbloqueia em ordem) → fase → tela de capítulo
concluído (estrelinhas, pedaço da estrela) → cena curta da lembrança → próximo. Progresso salvo no aparelho do
anfitrião (e copiado ao convidado). Treino solo continua disponível (troca de personagem com ⇄).

## Rede
O anfitrião simula tudo (bichinhos, faíscas, corda) a 60 Hz; o convidado manda comandos e interpola.
Mensagens novas: entrada com `shoot`; instantâneo com bichinhos, faíscas, coletáveis, corações e corda.
