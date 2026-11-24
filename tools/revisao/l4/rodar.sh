#!/bin/sh
# Empacota um script desta pasta com o rolldown do projeto e roda no node.
#   tools/revisao/l4/rodar.sh <planos_ticks|...> [args]
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../../.." && pwd)
QUAL=$1; shift
TMP=${TMPDIR:-/tmp}/l4-$$
mkdir -p "$TMP"
"$RAIZ/node_modules/.bin/rolldown" "$AQUI/$QUAL.ts" --platform node --format esm -o "$TMP/s.mjs" >/dev/null
node "$TMP/s.mjs" "$@"
rm -rf "$TMP"
