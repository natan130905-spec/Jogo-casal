#!/usr/bin/env bash
# Gera um modelo 3D no Meshy (API oficial via Meshy CLI 0.4.0), baixa o GLB, otimiza e deixa pronto para o jogo.
#
# Uso:
#   tools/meshy_gerar.sh <nome> "<descrição>"                      -> só ESTIMA o custo (grátis) e mostra o saldo
#   tools/meshy_gerar.sh <nome> "<descrição>" --confirmar <créditos> -> gera de verdade (gasta créditos)
# Opções: --textura "<orientação de textura>"  --max-px <512|1024> (texturas do GLB final, padrão 1024)
#         --poligonos <n>  malha refeita pelo Meshy já com ~n triângulos (target_polycount + should_remesh), para celular
#
# Segurança da chave:
#   - Nunca coloque a chave neste arquivo, no repositório ou no HTML do jogo.
#   - Na sessão na nuvem, a chave fica no cofre do ambiente e o proxy a injeta nas chamadas a api.meshy.ai;
#     este script passa à CLI só um valor de marcação ("proxy-injected"), que não é a chave.
#   - No seu computador, use `meshy auth login` (navegador) ou exporte MESHY_API_KEY no terminal, fora do projeto.
#
# Regras: sem --confirmar nada é gerado; --confirmar precisa ser IGUAL à estimativa atual; o saldo é conferido antes;
# cada etapa tem um identificador de operação (repetir o comando não envia de novo a mesma etapa).
set -euo pipefail

NOME="${1:-}"; PROMPT="${2:-}"; shift 2 || true
CONFIRMAR=""; TEXTURA=""; MAXPX=1024; POLI=""
while [ $# -gt 0 ]; do
  case "$1" in
    --confirmar) CONFIRMAR="$2"; shift 2 ;;
    --textura) TEXTURA="$2"; shift 2 ;;
    --max-px) MAXPX="$2"; shift 2 ;;
    --poligonos) POLI="$2"; shift 2 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done
if ! [[ "$NOME" =~ ^[a-z0-9_]{2,40}$ ]] || [ -z "$PROMPT" ]; then
  echo "uso: $0 <nome_minusculo> \"<descrição>\" [--confirmar <créditos>] [--textura \"...\"] [--max-px 512|1024]" >&2; exit 2
fi

WEB="$(cd "$(dirname "$0")/.." && pwd)"; RASCUNHO="${MESHY_RASCUNHO:-/tmp/meshy_trabalho}"
WORK="$RASCUNHO/$NOME"
OUT="$WEB/public/modelos/$NOME.glb"
mkdir -p "$WORK" "$WEB/public/modelos"

# Executor oficial: a CLI instalada (se for a 0.4.0) ou o pacote fixo pelo npm, sem instalação global.
if command -v meshy >/dev/null 2>&1 && [ "$(meshy --version 2>/dev/null)" = "0.4.0" ]; then MESHY=(meshy)
else MESHY=(npm exec --yes --package=meshy-cli@0.4.0 -- meshy); fi
# Atrás do proxy da sessão, o fetch do Node precisa desta opção para usar HTTPS_PROXY.
if [ -n "${HTTPS_PROXY:-}" ]; then export NODE_USE_ENV_PROXY=1; fi
if [ -z "${MESHY_API_KEY:-}" ] && [ -d /root/.ccr ]; then export MESHY_API_KEY="msy_proxy_injected"; fi  # marcação, não é a chave

COMMON=(--output-schema v1 --format json --no-update-check)
m() { "${MESHY[@]}" "$@" "${COMMON[@]}" 2> "$WORK/stderr.log"; }
j() { python3 -I "$WEB/tools/meshy_json.py" "$@"; }

echo "== Estimativa (planejador da CLI, sem chamar a API)"
EST="$(m make "$PROMPT" --dry-run | j get result.estimated_credits)"
SALDO="$(m balance | j get result.balance)"
echo "   estimativa: $EST créditos (prévia + refino com texturas PBR) | saldo: $SALDO"
echo "   (confirme preços em https://docs.meshy.ai/en/api/pricing)"
if [ -z "$CONFIRMAR" ]; then
  echo "== Nada foi gerado. Para gerar, rode de novo com: --confirmar $EST"; exit 0
fi
if [ "$CONFIRMAR" != "$EST" ]; then echo "!! Confirmação ($CONFIRMAR) diferente da estimativa atual ($EST). Nada foi gerado." >&2; exit 3; fi
if [ "$SALDO" -lt "$EST" ]; then echo "!! Saldo insuficiente ($SALDO < $EST). Nada foi gerado." >&2; exit 4; fi

echo "== Etapa 1/2: prévia (geometria)"
PREV_ARGS=(--mode preview --prompt "$PROMPT" --async --operation-id "edm-$NOME-preview")
[ -n "$POLI" ] && PREV_ARGS+=(--data "{\"art_style\":\"realistic\",\"topology\":\"triangle\",\"target_polycount\":$POLI,\"should_remesh\":true}")
PREV="$(m text-to-3d create "${PREV_ARGS[@]}" | j get result.task.id result.id result.task_id)"
echo "   tarefa: $PREV (costuma levar alguns minutos)"
m text-to-3d wait "$PREV" --timeout 1800 --save-json "$WORK/preview_$PREV.json" | j status
echo "== Etapa 2/2: refino (texturas PBR)"
REF_ARGS=(--mode refine --preview-task-id "$PREV" --texture-resolution 2k --enable-pbr true --async --operation-id "edm-$NOME-refine")
[ -n "$TEXTURA" ] && REF_ARGS+=(--texture-prompt "$TEXTURA")
REF="$(m text-to-3d create "${REF_ARGS[@]}" | j get result.task.id result.id result.task_id)"
echo "   tarefa: $REF"
m text-to-3d wait "$REF" --timeout 1800 --save-json "$WORK/refine_$REF.json" | j status

echo "== Download do GLB e da prévia renderizada"
# Busca a tarefa de novo (GET grátis) para ter links de download válidos; exige acesso a assets.meshy.ai.
m download --resource text-to-3d --task-id "$REF" --save-json "$WORK/download_$REF.json" --asset model.glb --output "$WORK/original.glb" --overwrite > /dev/null
m download --task-json "$WORK/refine_$REF.json" --asset thumbnail.primary --output "$WORK/previa.png" --overwrite > /dev/null || echo "   (sem prévia renderizada)"

echo "== Otimização para o jogo (texturas até ${MAXPX}px, contagem de triângulos)"
python3 -I "$WEB/tools/glb_optimize.py" "$WORK/original.glb" "$OUT" --max "$MAXPX"
GASTO="$(j consumed "$WORK/preview_$PREV.json" "$WORK/refine_$REF.json")"
echo "== Pronto: $OUT"
echo "   créditos efetivamente gastos (informados pelo Meshy): $GASTO"
echo "   prévia: $WORK/previa.png  | tarefas: prévia $PREV, refino $REF"
echo "   O modelo fica em public/modelos/ (carregar com GLTFLoader)."
