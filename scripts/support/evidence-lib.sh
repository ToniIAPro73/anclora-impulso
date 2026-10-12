# evidence-lib.sh — sourced helpers that make run evidence non-overwritable and tamper-evident.
#   evidence_new_dir <base> <id>   creates <base>/<id>; FAILS (non-zero) if it already exists; prints the path
#   evidence_manifest_write <dir>  writes <dir>/MANIFEST.sha256 (sha256 of every file except itself)
#   evidence_manifest_verify <dir> exit 0 only if every listed file matches AND no file was added or removed
evidence_new_dir() {
  local base="$1" id="$2"
  mkdir -p "$base" || return 1
  if ! mkdir "$base/$id" 2>/dev/null; then
    echo "refusing: run directory already exists: $base/$id (evidence is never overwritten)" >&2
    return 1
  fi
  printf '%s\n' "$base/$id"
}

evidence_manifest_write() {
  local dir="$1"
  ( cd "$dir" && find . -type f ! -name MANIFEST.sha256 -exec shasum -a 256 {} + | sort -k2 > MANIFEST.sha256 )
}

evidence_manifest_verify() {
  local dir="$1" listed actual
  [ -f "$dir/MANIFEST.sha256" ] || { echo "no manifest in $dir" >&2; return 1; }
  ( cd "$dir" && shasum -a 256 -c MANIFEST.sha256 --quiet ) >/dev/null 2>&1 || { echo "manifest mismatch (changed or missing file) in $dir" >&2; return 1; }
  listed="$(cd "$dir" && awk '{print $2}' MANIFEST.sha256 | sort)"
  actual="$(cd "$dir" && find . -type f ! -name MANIFEST.sha256 | sort)"
  [ "$listed" = "$actual" ] || { echo "manifest mismatch (file added or removed) in $dir" >&2; return 1; }
}
