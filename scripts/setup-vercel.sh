#!/usr/bin/env bash
# Configura o projeto nextgen-autoric na Vercel sem abrir o dashboard.
#
#   VERCEL_TOKEN=... ./scripts/setup-vercel.sh
#
# Lê as credenciais do ambiente (ou pede uma vez cada) e grava em Production.
# Não imprime nenhum valor de segredo.

set -uo pipefail

PROJECT="${VERCEL_PROJECT:-nextgen-autoric}"
SCOPE="${VERCEL_SCOPE:-}"

fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ -n "${VERCEL_TOKEN:-}" ] || fail "defina VERCEL_TOKEN (vercel.com/account/tokens)"
command -v vercel >/dev/null 2>&1 || fail "instale a CLI: npm i -g vercel"

VERCEL="vercel --token $VERCEL_TOKEN --yes"
[ -n "$SCOPE" ] && VERCEL="$VERCEL --scope $SCOPE"

echo "vinculando ao projeto $PROJECT"
$VERCEL link --project "$PROJECT" >/dev/null || fail "não consegui vincular ao projeto $PROJECT"

requerido() {
  local nome="$1" dica="$2" valor=""
  printf '%s (%s): ' "$nome" "$dica"
  read -rs valor
  echo
  [ -n "$valor" ] || fail "$nome é obrigatório"
  printf '%s' "$valor" | $VERCEL env rm "$nome" production >/dev/null 2>&1
  printf '%s' "$valor" | $VERCEL env add "$nome" production >/dev/null || fail "falhou ao gravar $nome"
  echo "  ok $nome"
}

opcional() {
  local nome="$1" dica="$2" valor=""
  printf '%s (%s, enter para pular): ' "$nome" "$dica"
  read -rs valor
  echo
  [ -n "$valor" ] || { echo "  -- $nome não configurada"; return; }
  printf '%s' "$valor" | $VERCEL env rm "$nome" production >/dev/null 2>&1
  printf '%s' "$valor" | $VERCEL env add "$nome" production >/dev/null || fail "falhou ao gravar $nome"
  echo "  ok $nome"
}

echo
echo "URL do papel de aplicação é a pooled, com usuário nextgen_app — não use a do dono."
requerido DATABASE_URL       "postgres pooled (dono, para migração)"
requerido APP_DATABASE_URL   "postgres pooled como nextgen_app"
requerido BETTER_AUTH_SECRET "openssl rand -base64 32"
requerido BETTER_AUTH_URL    "https://nextgen-autoric.vercel.app"
requerido RESEND_API_KEY     "re_..."
requerido MAIL_FROM          "NextGen <nao-responda@seudominio.com.br>"
opcional  BLOB_PUBLIC_READ_WRITE_TOKEN  "store público"
opcional  BLOB_PRIVATE_READ_WRITE_TOKEN "store privado"

echo
echo
echo "gerando deploy de produção"
$VERCEL --prod || fail "deploy falhou — veja o log acima"

echo
echo "próximo passo:"
echo "  node scripts/check-deploy.mjs https://$PROJECT.vercel.app"
