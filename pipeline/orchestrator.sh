#!/bin/bash
# prism pipeline — daily visual experiment automation
# Usage:
#   ./orchestrator.sh inspire       Scout + Curator (morning cron — gives you today's brief)
#   ./orchestrator.sh record <slug> Record an experiment video
#   ./orchestrator.sh publish       Publish today's experiment to X
#   ./orchestrator.sh run <agent>   Run a single agent
#   ./orchestrator.sh status        Show agent statuses

set -euo pipefail

PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"
PRISM_DIR="$(dirname "$PIPELINE_DIR")"
AGENTS_DIR="$PIPELINE_DIR/agents"
MCP_DIR="$PIPELINE_DIR/mcp-configs"
STATE_DIR="$PIPELINE_DIR/state"
QUEUE_DIR="$STATE_DIR/queue"
AGENT_STATE_DIR="$STATE_DIR/agents"
ACTIVITY_LOG="$STATE_DIR/activity.jsonl"

mkdir -p "$QUEUE_DIR" "$AGENT_STATE_DIR"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log_activity() {
  local agent="$1" action="$2" detail="${3:-}"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{\"timestamp\":\"$timestamp\",\"agent\":\"$agent\",\"action\":\"$action\",\"detail\":\"$detail\"}" >> "$ACTIVITY_LOG"
}

update_agent_state() {
  local agent="$1" status="$2" detail="${3:-}"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local config_file="$AGENTS_DIR/$agent.json"
  local model=""
  if [[ -f "$config_file" ]]; then
    model=$(python3 -c "import json; print(json.load(open('$config_file'))['model'])" 2>/dev/null || echo "unknown")
  fi
  cat > "$AGENT_STATE_DIR/$agent.json" <<EOF
{
  "name": "$agent",
  "status": "$status",
  "model": "$model",
  "lastRun": "$timestamp",
  "detail": "$detail"
}
EOF
}

run_agent() {
  local agent="$1"
  local config_file="$AGENTS_DIR/$agent.json"

  if [[ ! -f "$config_file" ]]; then
    echo -e "${RED}Error: Agent config not found: $config_file${NC}"
    return 1
  fi

  local model mcp_config max_budget system_prompt prompt use_chrome
  model=$(python3 -c "import json; print(json.load(open('$config_file'))['model'])" 2>/dev/null)
  mcp_config=$(python3 -c "import json; print(json.load(open('$config_file'))['mcp_config'])" 2>/dev/null)
  max_budget=$(python3 -c "import json; print(json.load(open('$config_file'))['max_budget_usd'])" 2>/dev/null)
  system_prompt=$(python3 -c "import json; print(json.load(open('$config_file'))['system_prompt'])" 2>/dev/null)
  prompt=$(python3 -c "import json; print(json.load(open('$config_file'))['prompt'])" 2>/dev/null)
  use_chrome=$(python3 -c "import json; c=json.load(open('$config_file')); print('true' if c.get('chrome') else 'false')" 2>/dev/null)

  local mcp_file="$MCP_DIR/$mcp_config"
  if [[ ! -f "$mcp_file" ]]; then
    echo -e "${RED}Error: MCP config not found: $mcp_file${NC}"
    return 1
  fi

  echo -e "${CYAN}[$agent]${NC} Starting (model: $model, budget: \$$max_budget)"
  update_agent_state "$agent" "running"
  log_activity "$agent" "started" "model=$model budget=\$$max_budget"

  local full_prompt="$prompt"

  # Inject queue data as context
  if [[ "$agent" == "curator" ]] && [[ -f "$QUEUE_DIR/scout-findings.json" ]]; then
    full_prompt="$full_prompt\n\n--- SCOUT FINDINGS ---\n$(cat "$QUEUE_DIR/scout-findings.json")"
  fi
  if [[ "$agent" == "publisher" ]] && [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    full_prompt="$full_prompt\n\n--- DAILY BRIEF ---\n$(cat "$QUEUE_DIR/daily-brief.json")"
  fi

  # Map agent to output queue file
  local output_file=""
  case "$agent" in
    scout)    output_file="$QUEUE_DIR/scout-findings.json" ;;
    curator)  output_file="$QUEUE_DIR/daily-brief.json" ;;
    publisher) output_file="$QUEUE_DIR/publish-result.json" ;;
  esac

  local chrome_flag=""
  if [[ "$use_chrome" == "true" ]]; then
    chrome_flag="--chrome"
  fi

  local exit_code=0
  local output
  output=$(unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT; claude --print \
    --model "$model" \
    --system-prompt "$system_prompt" \
    --strict-mcp-config \
    --mcp-config "$mcp_file" \
    --max-budget-usd "$max_budget" \
    --permission-mode bypassPermissions \
    --output-format json \
    $chrome_flag \
    -p "$full_prompt" 2>&1) || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo -e "${RED}[$agent]${NC} Failed (exit code: $exit_code)"
    update_agent_state "$agent" "error" "Exit code: $exit_code"
    log_activity "$agent" "failed" "exit_code=$exit_code"
    echo "$output" > "$AGENT_STATE_DIR/$agent-error.log"
    return 1
  fi

  local result
  result=$(echo "$output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, dict) and 'result' in data:
        print(data['result'])
    else:
        print(json.dumps(data))
except:
    print(sys.stdin.read())
" 2>/dev/null || echo "$output")

  local json_content
  json_content=$(echo "$result" | python3 -c "
import sys, re, json
text = sys.stdin.read()
match = re.search(r'\{[\s\S]*\}', text)
if match:
    try:
        parsed = json.loads(match.group())
        print(json.dumps(parsed, indent=2))
    except:
        print(text)
else:
    print(text)
" 2>/dev/null || echo "$result")

  if [[ -n "$output_file" ]]; then
    echo "$json_content" > "$output_file"
  fi

  local cost
  cost=$(echo "$output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'cost_usd' in data:
        print(f\"\${data['cost_usd']:.4f}\")
    else:
        print('unknown')
except:
    print('unknown')
" 2>/dev/null || echo "unknown")

  echo -e "${GREEN}[$agent]${NC} Completed (cost: $cost)"
  update_agent_state "$agent" "idle" "cost=$cost"
  log_activity "$agent" "completed" "cost=$cost"
}

run_inspire() {
  echo -e "${PURPLE}=== prism — daily inspiration ===${NC}"
  echo ""
  log_activity "prism" "inspire_started" ""

  if ! run_agent "scout"; then
    echo -e "${RED}Scout failed${NC}"
    return 1
  fi
  echo ""

  if ! run_agent "curator"; then
    echo -e "${RED}Curator failed${NC}"
    return 1
  fi
  echo ""

  echo -e "${GREEN}=== Today's brief ===${NC}"
  if [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    python3 -c "
import json
with open('$QUEUE_DIR/daily-brief.json') as f:
    brief = json.load(f)
chosen = brief.get('chosen', {})
print(f\"  Title: {chosen.get('title', '?')}\")
print(f\"  Technique: {chosen.get('technique', '?')}\")
print(f\"  Interaction: {chosen.get('interaction', '?')}\")
print(f\"  Hours: {chosen.get('estimated_hours', '?')}\")
print(f\"  Hook: {chosen.get('visual_hook', '?')}\")
print()
print(f\"  Tweet: {chosen.get('tweet_caption', '?')}\")
" 2>/dev/null || cat "$QUEUE_DIR/daily-brief.json"
  fi
  echo ""

  log_activity "prism" "inspire_completed" ""
}

run_record() {
  local slug="${1:-}"
  if [[ -z "$slug" ]]; then
    echo "Usage: ./orchestrator.sh record <slug>"
    exit 1
  fi

  echo -e "${CYAN}Recording experiment: $slug${NC}"
  cd "$PRISM_DIR"
  npx tsx scripts/record.ts "$slug"
  log_activity "prism" "recorded" "slug=$slug"
}

show_status() {
  echo -e "${PURPLE}=== prism status ===${NC}"
  echo ""

  for agent_file in "$AGENT_STATE_DIR"/*.json; do
    if [[ -f "$agent_file" ]]; then
      local name status lastRun model
      name=$(python3 -c "import json; print(json.load(open('$agent_file'))['name'])" 2>/dev/null)
      status=$(python3 -c "import json; print(json.load(open('$agent_file'))['status'])" 2>/dev/null)
      lastRun=$(python3 -c "import json; print(json.load(open('$agent_file'))['lastRun'])" 2>/dev/null)
      model=$(python3 -c "import json; print(json.load(open('$agent_file'))['model'])" 2>/dev/null)

      local colour="$NC"
      case "$status" in
        running) colour="$YELLOW" ;;
        idle)    colour="$GREEN" ;;
        error)   colour="$RED" ;;
      esac

      echo -e "  ${colour}●${NC} $name ($model) - ${colour}$status${NC} - last: $lastRun"
    fi
  done

  echo ""
  if [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    echo -e "Latest brief:"
    python3 -c "
import json
with open('$QUEUE_DIR/daily-brief.json') as f:
    brief = json.load(f)
chosen = brief.get('chosen', {})
print(f\"  {chosen.get('title', '?')} — {chosen.get('technique', '?')}\")
" 2>/dev/null || true
  fi
}

case "${1:-help}" in
  inspire)
    run_inspire
    ;;
  record)
    run_record "${2:-}"
    ;;
  publish)
    run_agent "publisher"
    ;;
  run)
    if [[ -z "${2:-}" ]]; then
      echo "Usage: ./orchestrator.sh run <agent>"
      echo "Agents: scout, curator, publisher"
      exit 1
    fi
    run_agent "$2"
    ;;
  status)
    show_status
    ;;
  *)
    echo -e "${PURPLE}prism${NC} — visual experiments pipeline"
    echo ""
    echo "Usage:"
    echo "  ./orchestrator.sh inspire          Scout + Curator (get today's brief)"
    echo "  ./orchestrator.sh record <slug>    Record experiment as video"
    echo "  ./orchestrator.sh publish          Post to X via Spellcast"
    echo "  ./orchestrator.sh run <agent>      Run single agent"
    echo "  ./orchestrator.sh status           Show pipeline status"
    echo ""
    echo "Agents: scout, curator, publisher"
    ;;
esac
