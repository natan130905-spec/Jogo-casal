#!/bin/sh
# Empacota um script desta pasta com o rolldown do projeto e roda no node. Rode de uma cópia (worktree):
#   <worktree>/tools/revisao/arquitetura-modos/rodar.sh [medir_modos|teleporte_cap6|teleporte_cap6_rastro|tempo_grafo]
# medir_modos grava medidas.json em SAIDA_DIR (padrão: esta pasta).
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../../.." && pwd)
QUAL=${1:-medir_modos}
TMP=${TMPDIR:-/tmp}/arquitetura-modos-$$
mkdir -p "$TMP"
"$RAIZ/node_modules/.bin/rolldown" "$AQUI/$QUAL.ts" --platform node --format esm -o "$TMP/s.mjs" >/dev/null
SAIDA_DIR=${SAIDA_DIR:-$AQUI} node "$TMP/s.mjs"
rm -rf "$TMP"
