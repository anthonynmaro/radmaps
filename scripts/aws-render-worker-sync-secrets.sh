#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"
SECRET_NAME="${SECRET_NAME:-radmaps/render-worker-v4/env}"
PROOF_TOKEN_SECRET_NAME="${PROOF_TOKEN_SECRET_NAME:-radmaps/proof-renderer/token}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node is required." >&2
  exit 1
fi

tmp_secret="$(mktemp)"
cleanup() {
  rm -f "$tmp_secret"
}
trap cleanup EXIT

node - "$ROOT_DIR/.env" "$ROOT_DIR/render-worker-v4/.env" > "$tmp_secret" <<'NODE'
const fs = require('node:fs')

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'DATABASE_URL',
  'RENDER_TICKET_SECRET',
  'GELATO_API_KEY',
]
const optional = [
  'PROOF_RENDER_TOKEN',
  'BROWSERLESS_TOKEN',
  'BROWSERLESS_ENDPOINT',
]
const keys = [...required, ...optional]
const values = {}

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {}
  const out = {}
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    value = value.replace(/\s+#.*$/, '')
    value = value.replace(/^['"]|['"]$/g, '')
    out[match[1]] = value
  }
  return out
}

for (const path of process.argv.slice(2)) {
  Object.assign(values, parseEnvFile(path))
}
for (const key of keys) {
  if (process.env[key]) values[key] = process.env[key]
}

const secret = {}
for (const key of keys) {
  if (values[key]) secret[key] = values[key]
}

const missing = required.filter(key => !secret[key])
if (missing.length) {
  console.error(`Missing required secret values: ${missing.join(', ')}`)
  process.exit(1)
}

process.stdout.write(`${JSON.stringify(secret, null, 2)}\n`)
NODE

chmod 600 "$tmp_secret"

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "file://$tmp_secret" \
    --region "$REGION" >/dev/null
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "RadMaps render-worker-v4 environment secret" \
    --secret-string "file://$tmp_secret" \
    --tags Key=Project,Value=radmaps Key=Service,Value=render-worker-v4 Key=ManagedBy,Value=codex \
    --region "$REGION" >/dev/null
fi

secret_arn="$(
  aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --query ARN \
    --output text \
    --region "$REGION"
)"

echo "Synced render worker secret: $secret_arn"

proof_token="$(
  node -e "const fs=require('node:fs'); const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(s.PROOF_RENDER_TOKEN || s.BROWSERLESS_TOKEN || '')" "$tmp_secret"
)"

if [[ -n "$proof_token" ]]; then
  if aws secretsmanager describe-secret --secret-id "$PROOF_TOKEN_SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value \
      --secret-id "$PROOF_TOKEN_SECRET_NAME" \
      --secret-string "$proof_token" \
      --region "$REGION" >/dev/null
  else
    aws secretsmanager create-secret \
      --name "$PROOF_TOKEN_SECRET_NAME" \
      --description "RadMaps proof renderer screenshot token" \
      --secret-string "$proof_token" \
      --tags Key=Project,Value=radmaps Key=Service,Value=proof-renderer Key=ManagedBy,Value=codex \
      --region "$REGION" >/dev/null
  fi
  proof_token_secret_arn="$(
    aws secretsmanager describe-secret \
      --secret-id "$PROOF_TOKEN_SECRET_NAME" \
      --query ARN \
      --output text \
      --region "$REGION"
  )"
  echo "Synced proof renderer token secret: $proof_token_secret_arn"
else
  echo "Missing PROOF_RENDER_TOKEN or BROWSERLESS_TOKEN. The AWS proof renderer requires a /screenshot token." >&2
  echo "Generate one with: openssl rand -hex 32" >&2
  exit 1
fi
