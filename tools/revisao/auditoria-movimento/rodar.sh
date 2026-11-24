#!/bin/sh
# Empacota um script desta pasta (TypeScript que importa src/core) com o rolldown do projeto e roda no node.
# Uso: tools/revisao/auditoria-movimento/rodar.sh <envoltoria|alcance|visibilidade|janela> [args...]
# Rode de uma cópia (worktree) do repositório: lê src/core/ e src/core/fases/ dessa cópia.
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../../.." && pwd)
QUAL=$1; shift
case $QUAL in envoltoria) ARQ=envoltoria.ts ;; alcance) ARQ=alcance_estrelinhas.ts ;; visibilidade) ARQ=visibilidade.ts ;; janela) ARQ=janela.ts ;; *) echo "uso: $0 envoltoria|alcance|visibilidade|janela"; exit 2 ;; esac
SAIDA=${TMPDIR:-/tmp}/auditoria-movimento-$$
mkdir -p "$SAIDA"
"$RAIZ/node_modules/.bin/rolldown" "$AQUI/$ARQ" --platform node --format esm -o "$SAIDA/$QUAL.mjs" >/dev/null
AUDITORIA_DIR="$AQUI" node "$SAIDA/$QUAL.mjs" "$QUAL" "$@"
rm -rf "$SAIDA"
