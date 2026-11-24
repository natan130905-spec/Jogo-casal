#!/bin/sh
# Empacota medir_armas.ts com o rolldown do projeto e roda no node. Rode de uma cópia (worktree) do repositório.
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../../.." && pwd)
SAIDA=${TMPDIR:-/tmp}/design-armas-$$
mkdir -p "$SAIDA"
"$RAIZ/node_modules/.bin/rolldown" "$AQUI/medir_armas.ts" --platform node --format esm -o "$SAIDA/medir.mjs" >/dev/null
node "$SAIDA/medir.mjs" "$@"
rm -rf "$SAIDA"
