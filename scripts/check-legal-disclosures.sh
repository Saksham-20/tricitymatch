#!/usr/bin/env bash
# Verify the statutory disclosures reach the built frontend.
#
#   bash scripts/check-legal-disclosures.sh [env-file] [dist-dir]
#   STRICT=1 bash scripts/check-legal-disclosures.sh .env frontend/dist
#
# Two checks:
#   1. the env file defines the values (VITE_LEGAL_ENTITY, VITE_LEGAL_ADDRESS,
#      VITE_GRIEVANCE_OFFICER at minimum);
#   2. if a built dist directory is given, each defined value actually appears in
#      the bundle — Vite bakes VITE_* in at BUILD time, so a value set only in
#      the server .env after the image was built never shows up.
# Without STRICT=1 it warns and exits 0; with it, any gap exits 1.

ENV_FILE="${1:-.env}"
DIST_DIR="${2:-}"
missing=0

get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

for key in VITE_LEGAL_ENTITY VITE_LEGAL_ADDRESS VITE_GRIEVANCE_OFFICER; do
  val="$(get "$key")"
  if [ -z "$val" ]; then
    echo "MISSING  $key is empty in $ENV_FILE"
    missing=1
  elif [ -n "$DIST_DIR" ]; then
    if grep -rqF -- "$val" "$DIST_DIR" 2>/dev/null; then
      echo "OK       $key is present in the built bundle"
    else
      echo "NOT BUILT $key is set but its value is not in $DIST_DIR — rebuild the frontend image"
      missing=1
    fi
  else
    echo "OK       $key is set"
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Statutory disclosures are incomplete (a hidden line is honest; a fabricated one is not)."
  [ "${STRICT:-0}" = "1" ] && exit 1
fi
exit 0
