# Recursos gerados no Higgsfield (2026-11-23)

Autorização do responsável: "pode gastar os créditos do Higgsfield". Teto definido pelo coordenador: 300 créditos.
Saldo 792,75 → 625,38: **gasto 167,37 créditos**. Referência de estilo e personagens: `docs/arte/conceito.png` (enviada como referência em todas as imagens).

## Imagens (`public/arte/`, WebP otimizado para celular)
| Arquivo | Uso no jogo | Modelo |
|---|---|---|
| 00_capa.webp | fundo do menu principal (céu vazio em cima para o título) | gpt_image_2_6 high 2k |
| 01_prologo1 … 05_prologo5.webp | quadrinhos do prólogo: subida do morro, pedido na estrela, estrela se parte, acordam no sonho, Dona Lume entrega o Lança-Estrelas e o Fio Vermelho (03 e 04 já vêm em vários quadros) | idem |
| 06_cap1_brinquedos … 12_cap7_estrela.webp | cena da lembrança mostrada ao concluir cada capítulo (1 brinquedos, 2 floresta, 3 relógio, 4 praia, 5 doces, 6 espelhos, 7 estrela) | idem |
| 13_final.webp | cena final (amanhecer, de mãos dadas) | idem |
| 14_rosto_natan.webp, 15_rosto_bruna.webp | rostinhos redondos do HUD (384 px) | gpt_image_2_6 high 1k |
| 16_mapa.webp | fundo do mapa da jornada: 7 ilhas, da esquerda para a direita, com os pontos da trilha | gpt_image_2_6 high 2k |
| 17_bichinhos.webp | folha de design dos bichinhos-pesadelo e do Rei (referência para os modelos 3D procedurais) | idem |

## Músicas (`public/som/musica_*.mp3`, 96 kbps, ~90 s, feitas para tocar em loop)
menu, cap1_brinquedos, cap2_floresta, cap3_relogio, cap4_oceano, cap5_doces, cap6_espelhos, cap7_cosmos, chefe (luta com o Rei-Pesadelo), final (créditos). Modelo: elevenlabs_music_v2_5, instrumental.

## Efeitos sonoros (`public/som/sfx_*.mp3`, 64 kbps mono)
tiro (Lança-Estrelas), estouro (bichinho vira brilho), pulo, estrelinha (coletar), dano, maos (mãos dadas/impulso), porta, lanterna (checkpoint), bolha, corda (Fio Vermelho esticando), pedaco_estrela (fanfarra), rei (resmungo do chefe). Modelo: mirelo_text_to_audio.

Uso: referência e recurso do jogo; conferir os termos do plano antes de qualquer uso comercial.

# Modelos 3D (2026-11-24) — `public/modelos/*.glb`
Prévia: `docs/arte/previa_modelos.png`.

## Higgsfield (Meshy 7 imagem→3D a partir de imagens novas no estilo da arte)
Imagens de referência (corpo inteiro A-pose e bichinhos isolados): 7 × gpt_image_2_6 (~14 créditos). Modelos: Natan e Bruna com
esqueleto e animação "Run_02" (id 14), 1,10 m, ~8,3 mil triângulos, textura 1024 (47,5 cada); bolotinha, morcego, cogumelo,
espinhudo (~5,2 mil tri, textura 512) e rei (~8,3 mil tri) estáticos (38 cada). Qualidade: **ótima**, fiéis à arte.
Saldo Higgsfield: 625,38 → (ver `balance`; rodada estimada em ~299 créditos).

## Meshy (texto→3D, API oficial, `tools/meshy_gerar.sh`): 10 × 30 = **300 créditos** (saldo 821 → 521)
| Modelo | Uso | Avaliação |
|---|---|---|
| lanca_estrelas | arma na mão dos personagens | boa |
| pedaco_estrela | fim de capítulo | forma boa, cor marrom: usar material dourado emissivo no jogo |
| lanterna | checkpoint | boa |
| casa_arvore | cenário cap. 2 | razoável |
| cogumelo_gigante | cenário | fraca (facetada, sem pintas) |
| blocos_brinquedo | cenário cap. 1 | boa |
| torre_relogio | cenário cap. 3 | boa |
| castelo_doces | cenário cap. 5 | fraca (sem cor de doce) |
| cristais_espelho | cenário cap. 6 | fraca (veio só o espelho) |
| ilha_flutuante | cenário cap. 7 | fraca (escura) |
Lição: no Meshy, texto→3D sai bem pior que imagem→3D; para refazer os fracos, gerar antes a imagem no estilo da arte.

## Arena do Coração (Higgsfield, 2026-11-24): **80,50 créditos** (saldo 330,13 → 249,63)
| Recurso | Ferramenta | Arquivo |
|---|---|---|
| Conceito da arena | gpt_image_2_6 | `docs/arte/arena_conceito.webp` |
| Espada da Aurora (imagem) | gpt_image_2_6 | `docs/arte/arma_espada.webp` |
| Lança de Pétala (imagem) | gpt_image_2_6 | `docs/arte/arma_lanca.webp` |
| Espada da Aurora (3D) | meshy_v7_image_to_3d (job 8d102492) | `public/modelos/espada_aurora.glb`: 2,6 mil tri, textura 512, 245 KB, 1,9 m (escalar no jogo) |
| Lança de Pétala (3D) | meshy_v7_image_to_3d (job 59d11884) | `public/modelos/lanca_petala.glb`: 2,6 mil tri, textura 512, 261 KB, 1,9 m (escalar no jogo) |
