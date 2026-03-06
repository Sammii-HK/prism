#!/bin/bash
# prism pipeline — autonomous design engineering component pipeline
# Usage:
#   ./orchestrator.sh auto              Full autonomous cycle: scout → curator → builder → record → publish
#   ./orchestrator.sh inspire           Scout + Curator (get today's brief)
#   ./orchestrator.sh build             Build from existing brief (curator must have run)
#   ./orchestrator.sh record <slug>     Record a component video
#   ./orchestrator.sh publish           Publish today's component to X
#   ./orchestrator.sh run <agent>       Run a single agent
#   ./orchestrator.sh status            Show pipeline status

set -euo pipefail

PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"
PRISM_DIR="$(dirname "$PIPELINE_DIR")"
AGENTS_DIR="$PIPELINE_DIR/agents"
MCP_DIR="$PIPELINE_DIR/mcp-configs"
STATE_DIR="$PIPELINE_DIR/state"
QUEUE_DIR="$STATE_DIR/queue"
AGENT_STATE_DIR="$STATE_DIR/agents"
ACTIVITY_LOG="$STATE_DIR/activity.jsonl"
RECORDINGS_DIR="$PRISM_DIR/recordings"

mkdir -p "$QUEUE_DIR" "$AGENT_STATE_DIR" "$RECORDINGS_DIR"

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
  local extra_context="${2:-}"
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
    full_prompt="$full_prompt

--- SCOUT FINDINGS ---
$(cat "$QUEUE_DIR/scout-findings.json")"
  fi

  if [[ "$agent" == "builder" ]] && [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    full_prompt="Build the following component from this curator brief:

--- CURATOR BRIEF ---
$(cat "$QUEUE_DIR/daily-brief.json")"
  fi

  if [[ "$agent" == "publisher" ]]; then
    local pub_context=""
    if [[ -f "$QUEUE_DIR/builder-result.json" ]]; then
      pub_context="--- BUILDER RESULT ---
$(cat "$QUEUE_DIR/builder-result.json")"
    fi
    if [[ -n "$extra_context" ]]; then
      pub_context="$pub_context

--- VIDEO ---
$extra_context"
    fi
    full_prompt="Create and schedule an X post for this Prism component. Use the details below. Follow the brand voice rules strictly.

$pub_context"
  fi

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

  # Extract the result text from Claude's JSON output
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

  # Try to extract JSON from the result
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

  # Map agent to output queue file
  local output_file=""
  case "$agent" in
    scout)    output_file="$QUEUE_DIR/scout-findings.json" ;;
    curator)  output_file="$QUEUE_DIR/daily-brief.json" ;;
    builder)  output_file="$QUEUE_DIR/builder-result.json" ;;
    publisher) output_file="$QUEUE_DIR/publish-result.json" ;;
  esac

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

# --- Commands ---

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
print(f\"  Component: {chosen.get('title', '?')}\")
print(f\"  Slug: {chosen.get('slug', '?')}\")
print(f\"  Technique: {chosen.get('technique', '?')}\")
print(f\"  Interaction: {chosen.get('interaction', '?')}\")
print(f\"  Hook: {chosen.get('visual_hook', '?')}\")
print()
print(f\"  Tweet: {chosen.get('tweet_caption', '?')}\")
" 2>/dev/null || cat "$QUEUE_DIR/daily-brief.json"
  fi
  echo ""
  log_activity "prism" "inspire_completed" ""
}

run_build() {
  if [[ ! -f "$QUEUE_DIR/daily-brief.json" ]]; then
    echo -e "${RED}No daily brief found. Run 'inspire' first.${NC}"
    return 1
  fi

  echo -e "${PURPLE}=== prism — building component ===${NC}"
  echo ""
  log_activity "prism" "build_started" ""

  if ! run_agent "builder"; then
    echo -e "${RED}Builder failed${NC}"
    return 1
  fi
  echo ""

  # Extract slug from builder result
  local slug=""
  if [[ -f "$QUEUE_DIR/builder-result.json" ]]; then
    slug=$(python3 -c "
import json
with open('$QUEUE_DIR/builder-result.json') as f:
    result = json.load(f)
print(result.get('slug', ''))
" 2>/dev/null || echo "")
  fi

  if [[ -n "$slug" ]]; then
    echo -e "${GREEN}Built: $slug${NC}"
    # Save slug for record/publish steps
    echo "$slug" > "$QUEUE_DIR/current-slug.txt"
  fi

  log_activity "prism" "build_completed" "slug=$slug"
}

run_record() {
  local slug="${1:-}"

  # If no slug provided, try to get from queue
  if [[ -z "$slug" ]] && [[ -f "$QUEUE_DIR/current-slug.txt" ]]; then
    slug=$(cat "$QUEUE_DIR/current-slug.txt")
  fi

  if [[ -z "$slug" ]]; then
    echo -e "${RED}No slug provided and no current-slug in queue.${NC}"
    echo "Usage: ./orchestrator.sh record <slug>"
    return 1
  fi

  echo -e "${CYAN}=== Recording component: $slug ===${NC}"
  log_activity "prism" "record_started" "slug=$slug"

  # Start dev server in background
  local dev_pid=""
  local dev_port=3000

  # Check if dev server is already running
  if curl -s "http://localhost:$dev_port" > /dev/null 2>&1; then
    echo -e "${YELLOW}Dev server already running on port $dev_port${NC}"
  else
    echo -e "${CYAN}Starting dev server...${NC}"
    cd "$PRISM_DIR"
    pnpm dev --port "$dev_port" > /tmp/prism-dev.log 2>&1 &
    dev_pid=$!

    # Wait for server to be ready (max 30s)
    local waited=0
    while ! curl -s "http://localhost:$dev_port" > /dev/null 2>&1; do
      sleep 1
      waited=$((waited + 1))
      if [[ $waited -ge 30 ]]; then
        echo -e "${RED}Dev server failed to start after 30s${NC}"
        [[ -n "$dev_pid" ]] && kill "$dev_pid" 2>/dev/null || true
        return 1
      fi
    done
    echo -e "${GREEN}Dev server ready${NC}"
  fi

  # Record the component
  cd "$PRISM_DIR"
  BASE_URL="http://localhost:$dev_port" npx tsx scripts/record.ts "$slug" 12

  # Stop dev server if we started it
  if [[ -n "$dev_pid" ]]; then
    echo -e "${CYAN}Stopping dev server...${NC}"
    kill "$dev_pid" 2>/dev/null || true
    wait "$dev_pid" 2>/dev/null || true
  fi

  local video_path="$RECORDINGS_DIR/$slug.mp4"
  if [[ ! -f "$video_path" ]]; then
    # Fall back to webm
    video_path=$(ls -t "$RECORDINGS_DIR"/*.webm 2>/dev/null | head -1 || echo "")
  fi

  if [[ -n "$video_path" ]] && [[ -f "$video_path" ]]; then
    echo -e "${GREEN}Recorded: $video_path${NC}"
    echo "$video_path" > "$QUEUE_DIR/current-video.txt"
    log_activity "prism" "record_completed" "path=$video_path"
  else
    echo -e "${RED}No recording found${NC}"
    log_activity "prism" "record_failed" "no video file"
    return 1
  fi
}

run_publish() {
  echo -e "${PURPLE}=== prism — publishing to X ===${NC}"
  echo ""
  log_activity "prism" "publish_started" ""

  local video_context=""
  if [[ -f "$QUEUE_DIR/current-video.txt" ]]; then
    local video_path
    video_path=$(cat "$QUEUE_DIR/current-video.txt")
    if [[ -f "$video_path" ]]; then
      video_context="Video file path: $video_path"
    fi
  fi

  if ! run_agent "publisher" "$video_context"; then
    echo -e "${RED}Publisher failed${NC}"
    return 1
  fi
  echo ""

  echo -e "${GREEN}=== Published ===${NC}"
  if [[ -f "$QUEUE_DIR/publish-result.json" ]]; then
    python3 -c "
import json
with open('$QUEUE_DIR/publish-result.json') as f:
    result = json.load(f)
print(f\"  Post: {result.get('content', '?')}\")
print(f\"  Score: {result.get('score', '?')}\")
print(f\"  Scheduled: {result.get('scheduled', '?')}\")
print(f\"  Media: {result.get('media_uploaded', '?')}\")
" 2>/dev/null || cat "$QUEUE_DIR/publish-result.json"
  fi
  echo ""
  log_activity "prism" "publish_completed" ""
}

run_auto() {
  local skip_scout="${1:-}"
  local start_time
  start_time=$(date +%s)

  echo -e "${PURPLE}======================================${NC}"
  echo -e "${PURPLE}  prism — autonomous pipeline${NC}"
  echo -e "${PURPLE}======================================${NC}"
  echo ""
  log_activity "prism" "auto_started" "skip_scout=$skip_scout"

  # Phase 1: Research (skip if --no-scout or findings already exist)
  if [[ "$skip_scout" == "--no-scout" ]]; then
    if [[ -f "$QUEUE_DIR/scout-findings.json" ]]; then
      echo -e "${YELLOW}[1/5] Skipping scout — reusing existing findings${NC}"
    else
      echo -e "${YELLOW}[1/5] Skipping scout — curator will use component backlog${NC}"
    fi
  else
    echo -e "${BLUE}[1/5] Scouting...${NC}"
    if ! run_agent "scout"; then
      echo -e "${RED}Scout failed — aborting${NC}"
      log_activity "prism" "auto_failed" "scout"
      return 1
    fi
  fi
  echo ""

  # Phase 2: Curate
  echo -e "${BLUE}[2/5] Curating...${NC}"
  if ! run_agent "curator"; then
    echo -e "${RED}Curator failed — aborting${NC}"
    log_activity "prism" "auto_failed" "curator"
    return 1
  fi

  # Show what we're building
  local slug=""
  local title=""
  if [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    slug=$(python3 -c "import json; print(json.load(open('$QUEUE_DIR/daily-brief.json'))['chosen']['slug'])" 2>/dev/null || echo "")
    title=$(python3 -c "import json; print(json.load(open('$QUEUE_DIR/daily-brief.json'))['chosen']['title'])" 2>/dev/null || echo "")
  fi
  echo -e "${GREEN}  Building: $title ($slug)${NC}"
  echo ""

  # Phase 3: Build
  echo -e "${BLUE}[3/5] Building...${NC}"
  if ! run_agent "builder"; then
    echo -e "${RED}Builder failed — aborting${NC}"
    log_activity "prism" "auto_failed" "builder"
    return 1
  fi

  # Get slug from builder result (may differ from curator if builder changed it)
  if [[ -f "$QUEUE_DIR/builder-result.json" ]]; then
    local builder_slug
    builder_slug=$(python3 -c "import json; print(json.load(open('$QUEUE_DIR/builder-result.json'))['slug'])" 2>/dev/null || echo "")
    if [[ -n "$builder_slug" ]]; then
      slug="$builder_slug"
    fi

    local build_success
    build_success=$(python3 -c "import json; print(json.load(open('$QUEUE_DIR/builder-result.json')).get('build_success', False))" 2>/dev/null || echo "False")
    if [[ "$build_success" != "True" ]]; then
      echo -e "${RED}Build verification failed — aborting before record${NC}"
      log_activity "prism" "auto_failed" "build_verification"
      return 1
    fi
  fi
  echo -e "${GREEN}  Component built and verified: $slug${NC}"
  echo "$slug" > "$QUEUE_DIR/current-slug.txt"
  echo ""

  # Phase 4: Record
  echo -e "${BLUE}[4/5] Recording...${NC}"
  if ! run_record "$slug"; then
    echo -e "${YELLOW}Recording failed — publishing without video${NC}"
    # Don't abort — we can still publish without video
  fi
  echo ""

  # Phase 5: Publish
  echo -e "${BLUE}[5/5] Publishing...${NC}"
  if ! run_publish; then
    echo -e "${RED}Publisher failed${NC}"
    log_activity "prism" "auto_failed" "publisher"
    return 1
  fi

  local end_time
  end_time=$(date +%s)
  local elapsed=$(( end_time - start_time ))
  local minutes=$(( elapsed / 60 ))
  local seconds=$(( elapsed % 60 ))

  echo ""
  echo -e "${GREEN}======================================${NC}"
  echo -e "${GREEN}  Pipeline complete (${minutes}m ${seconds}s)${NC}"
  echo -e "${GREEN}======================================${NC}"
  echo ""

  # Summary
  if [[ -f "$QUEUE_DIR/builder-result.json" ]]; then
    python3 -c "
import json
with open('$QUEUE_DIR/builder-result.json') as f:
    r = json.load(f)
print(f\"  Component: {r.get('title', '?')}\")
print(f\"  Slug: {r.get('slug', '?')}\")
print(f\"  Tech: {', '.join(r.get('tech', []))}\")
print(f\"  Path: {r.get('component_path', '?')}\")
" 2>/dev/null || true
  fi
  if [[ -f "$QUEUE_DIR/publish-result.json" ]]; then
    python3 -c "
import json
with open('$QUEUE_DIR/publish-result.json') as f:
    r = json.load(f)
print(f\"  Tweet: {r.get('content', '?')}\")
print(f\"  Scheduled: {r.get('scheduled', '?')}\")
" 2>/dev/null || true
  fi
  echo ""

  log_activity "prism" "auto_completed" "slug=$slug elapsed=${elapsed}s"
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

  # Show queue state
  echo -e "Queue:"
  [[ -f "$QUEUE_DIR/scout-findings.json" ]] && echo -e "  ${GREEN}●${NC} scout-findings.json" || echo -e "  ${RED}○${NC} scout-findings.json"
  [[ -f "$QUEUE_DIR/daily-brief.json" ]] && echo -e "  ${GREEN}●${NC} daily-brief.json" || echo -e "  ${RED}○${NC} daily-brief.json"
  [[ -f "$QUEUE_DIR/builder-result.json" ]] && echo -e "  ${GREEN}●${NC} builder-result.json" || echo -e "  ${RED}○${NC} builder-result.json"
  [[ -f "$QUEUE_DIR/current-video.txt" ]] && echo -e "  ${GREEN}●${NC} current-video.txt" || echo -e "  ${RED}○${NC} current-video.txt"
  [[ -f "$QUEUE_DIR/publish-result.json" ]] && echo -e "  ${GREEN}●${NC} publish-result.json" || echo -e "  ${RED}○${NC} publish-result.json"
  echo ""

  if [[ -f "$QUEUE_DIR/daily-brief.json" ]]; then
    echo -e "Latest brief:"
    python3 -c "
import json
with open('$QUEUE_DIR/daily-brief.json') as f:
    brief = json.load(f)
chosen = brief.get('chosen', {})
print(f\"  {chosen.get('title', '?')} ({chosen.get('slug', '?')}) — {chosen.get('technique', '?')}\")
" 2>/dev/null || true
  fi

  # Show recent activity
  if [[ -f "$ACTIVITY_LOG" ]]; then
    echo ""
    echo -e "Recent activity:"
    tail -5 "$ACTIVITY_LOG" | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        print(f\"  {e['timestamp'][:16]} [{e['agent']}] {e['action']} {e.get('detail','')}\")
    except:
        pass
" 2>/dev/null || true
  fi
}

case "${1:-help}" in
  auto)
    run_auto "${2:-}"
    ;;
  inspire)
    run_inspire
    ;;
  build)
    run_build
    ;;
  record)
    run_record "${2:-}"
    ;;
  publish)
    run_publish
    ;;
  run)
    if [[ -z "${2:-}" ]]; then
      echo "Usage: ./orchestrator.sh run <agent>"
      echo "Agents: scout, curator, builder, publisher"
      exit 1
    fi
    run_agent "$2"
    ;;
  status)
    show_status
    ;;
  *)
    echo -e "${PURPLE}prism${NC} — design engineering component pipeline"
    echo ""
    echo "Usage:"
    echo "  ./orchestrator.sh auto              Full autonomous cycle (scout → build → record → publish)"
    echo "  ./orchestrator.sh auto --no-scout   Skip scout, reuse findings or pick from backlog"
    echo "  ./orchestrator.sh inspire           Scout + Curator (get today's brief)"
    echo "  ./orchestrator.sh build             Build from existing brief"
    echo "  ./orchestrator.sh record [slug]     Record component as video"
    echo "  ./orchestrator.sh publish           Post to X via Spellcast"
    echo "  ./orchestrator.sh run <agent>       Run single agent"
    echo "  ./orchestrator.sh status            Show pipeline status"
    echo ""
    echo "Agents: scout, curator, builder, publisher"
    ;;
esac
