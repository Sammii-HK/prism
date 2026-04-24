#!/bin/bash
# prism pipeline — daily runner
# Runs `orchestrator.sh auto` then commits and pushes anything the pipeline
# produced so Vercel redeploys and the GitHub contributions graph stays honest.
# Invoked by ~/Library/LaunchAgents/dev.sammii.prism-daily.plist

set -uo pipefail

PRISM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PRISM_DIR/pipeline/state/logs"
mkdir -p "$LOG_DIR"

STAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
LOG="$LOG_DIR/daily-$STAMP.log"

notify_failure() {
  local summary="$1"
  osascript -e "display notification \"$summary — see $LOG\" with title \"Prism daily failed\" sound name \"Basso\"" 2>/dev/null || true
}

trap 'notify_failure "unexpected exit at line $LINENO"' ERR

{
  echo "=== prism daily run $STAMP ==="
  cd "$PRISM_DIR"

  # Run the full autonomous cycle
  if ! ./pipeline/orchestrator.sh auto; then
    notify_failure "orchestrator auto exited non-zero"
  fi

  # Stage anything the pipeline produced. Be explicit about paths so we never
  # accidentally commit pipeline state, lockfile churn, or IDE noise.
  git add \
    app/lib/components/ \
    app/lib/registry.ts \
    app/lib/components/index.ts \
    "app/[slug]/page.tsx" \
    app/demos/ \
    app/atoms/ \
    2>/dev/null || true

  if ! git diff --cached --quiet; then
    SLUG=$(git diff --cached --name-only | grep -Eo 'app/lib/components/[a-z0-9-]+\.tsx$' | head -1 | sed 's|app/lib/components/||; s|\.tsx$||')
    SLUG=${SLUG:-daily}
    git commit -m "Autonomous daily drop: $SLUG

Co-Authored-By: Prism pipeline (scout → curator → builder) <noreply@prism.local>"
    git push || echo "push failed"
  else
    echo "no component changes to commit"
  fi

  echo "=== done $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
} >> "$LOG" 2>&1
