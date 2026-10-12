#!/usr/bin/env bash
# shield-env.sh : prints NAME= assignments (empty values) for every environment variable NAME the backend can read.
# Prisma's client loader merges backend/.env into process.env for keys that are NOT already defined; predefining
# every name the application reads (even as an empty string) prevents any operational value from entering a test
# process. Names only; no file is read except source code and .env.example (both non-secret).
set -euo pipefail
BACKEND="$(cd "$(dirname "$0")/../../backend" && pwd)"
{
  grep -rhoE 'process\.env\.[A-Z][A-Z0-9_]+' "$BACKEND/src" "$BACKEND/prisma" 2>/dev/null | sed 's/process\.env\.//'
  grep -hoE '^[#[:space:]]*[A-Z][A-Z0-9_]+=' "$BACKEND/.env.example" | sed -E 's/^[#[:space:]]*//; s/=$//'
  echo GROQ_API_KEY; echo OPENAI_API_KEY; echo SMTP_HOST; echo SMTP_USER; echo SMTP_PASS
} | sort -u | while read -r name; do
  case "$name" in NODE_ENV|PATH|HOME|PORT) continue ;; esac
  echo "$name="
done
