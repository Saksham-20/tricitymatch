#!/usr/bin/env bash
# Pre-launch checklist for TricityShadi production deployment
# Run: bash scripts/prelaunch-check.sh
# Set BASE_URL to override default: BASE_URL=https://tricityshadi.com bash scripts/prelaunch-check.sh

set -euo pipefail

BASE_URL="${BASE_URL:-https://tricityshadi.com}"
BACKEND_URL="${BACKEND_URL:-$BASE_URL}"
ENV_FILE="${ENV_FILE:-.env}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  ✓ $1${NC}"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ $1${NC}"; ((FAIL++)); }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; ((WARN++)); }

section() { echo -e "\n${YELLOW}── $1 ──────────────────────────${NC}"; }

echo "TricityShadi Pre-Launch Checklist"
echo "BASE_URL: $BASE_URL"
echo "ENV_FILE: $ENV_FILE"

# ── ENV VARS ──────────────────────────────────────────────────────────────────
section "Environment Variables"

check_env() {
  local key=$1 required=${2:-true}
  if [ -f "$ENV_FILE" ]; then
    local val; val=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -z "$val" ] || [[ "$val" == *"<"*">"* ]] || [[ "$val" == *"placeholder"* ]] || [[ "$val" == *"xxx"* ]]; then
      if [ "$required" = "true" ]; then fail "$key not set or placeholder"; else warn "$key not configured (optional)"; fi
    else
      pass "$key is set"
    fi
  else
    warn "ENV_FILE=$ENV_FILE not found — skipping env checks"
  fi
}

check_env "JWT_SECRET"
check_env "COOKIE_SECRET"
check_env "DB_PASSWORD"
check_env "FRONTEND_URL"
check_env "CORS_ORIGIN"
check_env "CLOUDINARY_CLOUD_NAME"
check_env "CLOUDINARY_API_KEY"
check_env "CLOUDINARY_API_SECRET"
check_env "RAZORPAY_KEY_ID"
check_env "RAZORPAY_KEY_SECRET"
check_env "RAZORPAY_WEBHOOK_SECRET"
check_env "EMAIL_HOST"        false
check_env "SMS_API_KEY"       false
check_env "FCM_PROJECT_ID"    false
check_env "AGORA_APP_ID"      false

# Warn if JWT_SECRET is too short
if [ -f "$ENV_FILE" ]; then
  jwt=$(grep "^JWT_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"')
  if [ ${#jwt} -lt 64 ]; then
    fail "JWT_SECRET too short (${#jwt} chars, need 64+)"
  fi
fi

# ── HEALTH CHECK ──────────────────────────────────────────────────────────────
section "API Health"

if command -v curl &>/dev/null; then
  http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BACKEND_URL/health" 2>/dev/null || echo "000")
  if [ "$http_status" = "200" ]; then
    pass "Health endpoint $BACKEND_URL/health → 200"
  elif [ "$http_status" = "000" ]; then
    warn "Cannot reach $BACKEND_URL (server not running or unreachable)"
  else
    fail "Health endpoint → $http_status"
  fi

  # Check HTTPS redirect (HTTP → HTTPS)
  if [[ "$BASE_URL" == https://* ]]; then
    http_url="${BASE_URL/https:/http:}"
    redirect=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$http_url" 2>/dev/null || echo "000")
    if [ "$redirect" = "301" ] || [ "$redirect" = "302" ]; then
      pass "HTTP → HTTPS redirect ($redirect)"
    elif [ "$redirect" = "000" ]; then
      warn "HTTP redirect check skipped (unreachable)"
    else
      warn "HTTP → HTTPS redirect not configured (got $redirect)"
    fi
  fi
else
  warn "curl not found — skipping HTTP checks"
fi

# ── SSL CERTIFICATE ───────────────────────────────────────────────────────────
section "SSL Certificate"

if command -v openssl &>/dev/null && [[ "$BASE_URL" == https://* ]]; then
  host=$(echo "$BASE_URL" | sed 's|https://||' | cut -d/ -f1)
  expiry=$(echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$expiry" ]; then
    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    if [ "$days_left" -gt 30 ]; then
      pass "SSL cert valid for $days_left days (expires: $expiry)"
    elif [ "$days_left" -gt 0 ]; then
      warn "SSL cert expires in $days_left days — renew soon"
    else
      fail "SSL cert EXPIRED"
    fi
  else
    warn "SSL check skipped (could not connect to $host:443)"
  fi
else
  warn "SSL check skipped (openssl not found or not HTTPS URL)"
fi

# ── DOCKER SERVICES ───────────────────────────────────────────────────────────
section "Docker Services"

if command -v docker &>/dev/null; then
  for svc in backend postgres; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$svc"; then
      pass "Container $svc running"
    else
      warn "Container $svc not found (may be named differently)"
    fi
  done
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "redis"; then
    pass "Redis container running"
  else
    warn "Redis not running (app falls back to in-memory cache)"
  fi
else
  warn "docker not found — skipping container checks"
fi

# ── DB MIGRATIONS ─────────────────────────────────────────────────────────────
section "Database Migrations"

if command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "backend"; then
  pending=$(docker exec "$(docker ps --format '{{.Names}}' | grep backend | head -1)" \
    sh -c "cd /app && npx sequelize-cli db:migrate:status 2>/dev/null | grep 'down' | wc -l" 2>/dev/null || echo "?")
  if [ "$pending" = "0" ]; then
    pass "All migrations applied"
  elif [ "$pending" = "?" ]; then
    warn "Could not check migration status"
  else
    fail "$pending pending migration(s) — run: docker exec backend npm run migrate"
  fi
else
  warn "Migration check skipped (backend container not running)"
fi

# ── SECURITY FLAGS ────────────────────────────────────────────────────────────
section "Security Config"

if [ -f "$ENV_FILE" ]; then
  swagger=$(grep "^ENABLE_SWAGGER=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  if [ "$swagger" = "false" ]; then
    pass "Swagger disabled in production"
  else
    warn "ENABLE_SWAGGER not set to false — disable in production"
  fi

  node_env=$(grep "^NODE_ENV=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  if [ "$node_env" = "production" ]; then
    pass "NODE_ENV=production"
  else
    fail "NODE_ENV=$node_env (must be 'production')"
  fi
fi

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo -e "\n────────────────────────────────────"
echo -e "Results: ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$WARN warnings${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}✗ NOT ready to launch — fix failures above.${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}⚠ Ready with warnings — review above before launch.${NC}"
  exit 0
else
  echo -e "${GREEN}✓ All checks passed — ready to launch!${NC}"
  exit 0
fi
