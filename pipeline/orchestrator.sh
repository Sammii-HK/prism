#!/bin/bash
# prism pipeline — autonomous design engineering component pipeline
# Usage:
#   ./orchestrator.sh auto              Full autonomous cycle: scout → curator → builder → record → publish
#   ./orchestrator.sh inspire           Scout + Curator (get today's brief)
#   ./orchestrator.sh build             Build from existing brief (curator must have run)
#   ./orchestrator.sh record <slug>     Record a component video
#   ./orchestrator.sh record-all        Record all unrecorded components (builds once, starts server once)
#   ./orchestrator.sh rerecord <slugs>  Re-record specific components by slug
#   ./orchestrator.sh schedule-all      Schedule all validated recordings to X via Spellcast
#   ./orchestrator.sh publish           Publish today's component to X
#   ./orchestrator.sh run <agent>       Run a single agent
#   ./orchestrator.sh status            Show pipeline status

set -euo pipefail

# Prioritize orchestration wrapper (for OpenAI/DeepInfra fallback) over system claude
export PATH="$HOME/development/orchestration/lib:$HOME/.local/bin:$HOME/go/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

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

# Load API keys for OpenAI/DeepInfra fallback (replaces claude --print)
if [[ -f /Users/sammii/development/spellcast/docker/.env ]]; then
    export CC_OPENAI_API_KEY="${CC_OPENAI_API_KEY:-$(grep '^CC_OPENAI_API_KEY=' /Users/sammii/development/spellcast/docker/.env | cut -d= -f2-)}"
    export DEEPINFRA_API_KEY="${DEEPINFRA_API_KEY:-$(grep '^DEEPINFRA_API_KEY=' /Users/sammii/development/spellcast/docker/.env | cut -d= -f2-)}"
fi

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

build_registry_context() {
  python3 - <<'PY'
from pathlib import Path
import re

text = Path("/Users/sammii/development/prism/app/lib/registry.ts").read_text()
pattern = re.compile(
    r"slug:\s*\"([^\"]+)\"[\s\S]*?title:\s*\"([^\"]+)\"[\s\S]*?tags:\s*\[([^\]]*)\][\s\S]*?type:\s*\"([^\"]+)\"",
    re.MULTILINE,
)
items = []
for slug, title, tags_raw, item_type in pattern.findall(text):
    tags = [t.strip().strip('"') for t in tags_raw.split(",") if t.strip()]
    items.append((item_type, title, slug, tags))

components = [item for item in items if item[0] == "component"]
playground = [item for item in items if item[0] == "playground"]

print("--- CURRENT REGISTRY ---")
print(f"Components: {len(components)}")
for _, title, slug, tags in components:
    tag_list = ", ".join(tags[:5]) if tags else "none"
    print(f"- {title} ({slug}) — tags: {tag_list}")

if playground:
    print("Playground:")
    for _, title, slug, tags in playground:
        tag_list = ", ".join(tags[:4]) if tags else "none"
        print(f"- {title} ({slug}) — tags: {tag_list}")
PY
}

build_atoms_context() {
  python3 - <<'PY'
from pathlib import Path
import re

text = Path("/Users/sammii/development/prism/app/atoms/page.tsx").read_text()
sections = re.findall(r'<Section title="([^"]+)">', text)
imports = re.findall(r'import \{ ([^}]+) \} from "\.\./lib/components/([^"]+)";', text)

print("--- ATOMS SURFACE ---")
if sections:
    print("Sections: " + ", ".join(sections))
if imports:
    print("Component imports:")
    for names, source in imports:
        cleaned = ", ".join(part.strip() for part in names.split(","))
        print(f"- {cleaned} from {source}")
PY
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

  if [[ "$agent" == "curator" || "$agent" == "builder" ]]; then
    full_prompt="$full_prompt

$(build_registry_context)

$(build_atoms_context)"
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

  cd "$PRISM_DIR"

  local server_pid=""
  local prod_port=3099

  # Build + start production server (record.ts uses port 3099)
  if curl -s "http://localhost:$prod_port" > /dev/null 2>&1; then
    echo -e "${YELLOW}Production server already running on port $prod_port${NC}"
  else
    echo -e "${CYAN}Building production bundle...${NC}"
    pnpm build
    echo -e "${CYAN}Starting production server on port $prod_port...${NC}"
    npx next start -p "$prod_port" > /tmp/prism-prod.log 2>&1 &
    server_pid=$!

    local waited=0
    while ! curl -s "http://localhost:$prod_port" > /dev/null 2>&1; do
      sleep 1
      waited=$((waited + 1))
      if [[ $waited -ge 30 ]]; then
        echo -e "${RED}Production server failed to start after 30s${NC}"
        [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
        return 1
      fi
    done
    echo -e "${GREEN}Production server ready${NC}"
  fi

  # Record the component
  SKIP_BUILD=1 PRISM_SERVER_RUNNING=1 npx tsx scripts/record.ts "$slug"

  # Stop server if we started it
  if [[ -n "$server_pid" ]]; then
    echo -e "${CYAN}Stopping production server...${NC}"
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi

  local video_path="$RECORDINGS_DIR/$slug.mp4"
  if [[ -f "$video_path" ]]; then
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
  elif [[ -f "$RECORDINGS_DIR/${slug}.validation.json" ]]; then
    local validation
    validation=$(python3 -c "import json; print(json.load(open('$RECORDINGS_DIR/${slug}.validation.json')).get('overall', 'fail'))" 2>/dev/null || echo "fail")
    if [[ "$validation" != "pass" ]]; then
      echo -e "${YELLOW}Recording validation returned '$validation' — stopping before publish${NC}"
      log_activity "prism" "auto_failed" "record_validation_$validation"
      return 1
    fi
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

run_record_all() {
  echo -e "${PURPLE}=== prism — record all unrecorded components ===${NC}"
  echo ""
  log_activity "prism" "record_all_started" ""

  cd "$PRISM_DIR"

  # Discover unrecorded components
  local unrecorded
  unrecorded=$(npx tsx -e "
    import { registry } from './app/lib/registry';
    import { readdirSync } from 'fs';
    const recorded = readdirSync('recordings')
      .filter(f => f.endsWith('.mp4'))
      .map(f => f.replace('.mp4', ''));
    const needed = registry
      .filter(r => r.type === 'component' && !recorded.includes(r.slug))
      .map(r => r.slug);
    console.log(JSON.stringify(needed));
  " 2>/dev/null)

  local slugs
  slugs=$(echo "$unrecorded" | python3 -c "import sys,json; [print(s) for s in json.loads(sys.stdin.read())]" 2>/dev/null)

  if [[ -z "$slugs" ]]; then
    echo -e "${GREEN}All components already recorded.${NC}"
    return 0
  fi

  local total
  total=$(echo "$slugs" | wc -l | tr -d ' ')
  echo -e "${CYAN}Found $total unrecorded components${NC}"
  echo ""

  # Build production bundle once
  echo -e "${CYAN}Building production bundle...${NC}"
  cd "$PRISM_DIR"
  pnpm build
  echo -e "${GREEN}Build complete${NC}"
  echo ""

  # Start production server once
  local server_pid=""
  local prod_port=3099

  if curl -s "http://localhost:$prod_port" > /dev/null 2>&1; then
    echo -e "${YELLOW}Production server already running on port $prod_port${NC}"
  else
    echo -e "${CYAN}Starting production server on port $prod_port...${NC}"
    cd "$PRISM_DIR"
    npx next start -p "$prod_port" > /tmp/prism-prod.log 2>&1 &
    server_pid=$!

    # Kill server on exit
    trap '[[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true' EXIT

    # Wait for server to be ready (max 30s)
    local waited=0
    while ! curl -s "http://localhost:$prod_port" > /dev/null 2>&1; do
      sleep 1
      waited=$((waited + 1))
      if [[ $waited -ge 30 ]]; then
        echo -e "${RED}Production server failed to start after 30s${NC}"
        [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
        return 1
      fi
    done
    echo -e "${GREEN}Production server ready${NC}"
  fi
  echo ""

  # Track results
  local recorded_count=0
  local pass_count=0
  local warn_count=0
  local fail_count=0
  local error_count=0
  local summary_lines=""

  # Record each component
  while IFS= read -r slug; do
    echo -e "${CYAN}Recording: $slug${NC}"
    cd "$PRISM_DIR"

    local exit_code=0
    SKIP_BUILD=1 PRISM_SERVER_RUNNING=1 npx tsx scripts/record.ts "$slug" || exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
      echo -e "${RED}  Failed to record: $slug${NC}"
      error_count=$((error_count + 1))
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${RED}ERROR${NC}  (recording failed)"
      continue
    fi

    recorded_count=$((recorded_count + 1))

    # Check validation
    local validation_file="$RECORDINGS_DIR/${slug}.validation.json"
    if [[ -f "$validation_file" ]]; then
      local overall frames
      overall=$(python3 -c "import json; print(json.load(open('$validation_file')).get('overall','unknown'))" 2>/dev/null || echo "unknown")
      frames=$(python3 -c "import json; print(json.load(open('$validation_file')).get('frames',0))" 2>/dev/null || echo "0")

      local status_colour="$NC"
      local status_label
      case "$overall" in
        pass)
          status_colour="$GREEN"
          status_label="PASS"
          pass_count=$((pass_count + 1))
          ;;
        warn)
          status_colour="$YELLOW"
          status_label="WARN"
          warn_count=$((warn_count + 1))
          ;;
        fail)
          status_colour="$RED"
          status_label="FAIL"
          fail_count=$((fail_count + 1))
          ;;
        *)
          status_label="$overall"
          ;;
      esac

      local detail
      detail=$(python3 -c "import json; v=json.load(open('$validation_file')); checks=[k for k,c in v.get('checks',{}).items() if c.get('status')!='pass']; print('(' + ', '.join(checks) + ')' if checks else '($frames frames)')" 2>/dev/null || echo "")
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${status_colour}${status_label}${NC}  ${detail}"
    else
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${GREEN}DONE${NC}  (no validation)"
    fi
  done <<< "$slugs"

  # Stop server if we started it
  if [[ -n "$server_pid" ]]; then
    echo ""
    echo -e "${CYAN}Stopping production server...${NC}"
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi

  # Summary
  echo ""
  echo -e "${PURPLE}=== record-all summary ===${NC}"
  echo -e "$summary_lines"
  echo ""
  echo -e "  Recorded: ${recorded_count}/${total}  ${GREEN}Passed: ${pass_count}${NC}  ${YELLOW}Warnings: ${warn_count}${NC}  ${RED}Failed: ${fail_count}${NC}"
  echo ""

  log_activity "prism" "record_all_completed" "recorded=$recorded_count/$total pass=$pass_count warn=$warn_count fail=$fail_count"
}

run_rerecord() {
  if [[ $# -eq 0 ]]; then
    echo -e "${RED}Usage: ./orchestrator.sh rerecord <slug> [slug2] [slug3] ...${NC}"
    return 1
  fi

  echo -e "${PURPLE}=== prism — re-recording: $* ===${NC}"
  echo ""
  log_activity "prism" "rerecord_started" "slugs=$*"

  cd "$PRISM_DIR"

  local total=$#

  # Build production bundle once
  echo -e "${CYAN}Building production bundle...${NC}"
  pnpm build
  echo -e "${GREEN}Build complete${NC}"
  echo ""

  # Start production server once
  local server_pid=""
  local prod_port=3099

  if curl -s "http://localhost:$prod_port" > /dev/null 2>&1; then
    echo -e "${YELLOW}Production server already running on port $prod_port${NC}"
  else
    echo -e "${CYAN}Starting production server on port $prod_port...${NC}"
    npx next start -p "$prod_port" > /tmp/prism-prod.log 2>&1 &
    server_pid=$!

    trap '[[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true' EXIT

    local waited=0
    while ! curl -s "http://localhost:$prod_port" > /dev/null 2>&1; do
      sleep 1
      waited=$((waited + 1))
      if [[ $waited -ge 30 ]]; then
        echo -e "${RED}Production server failed to start after 30s${NC}"
        [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
        return 1
      fi
    done
    echo -e "${GREEN}Production server ready${NC}"
  fi
  echo ""

  # Track results
  local recorded_count=0
  local summary_lines=""

  for slug in "$@"; do
    echo -e "${CYAN}Recording: $slug${NC}"
    cd "$PRISM_DIR"

    local exit_code=0
    SKIP_BUILD=1 PRISM_SERVER_RUNNING=1 npx tsx scripts/record.ts "$slug" || exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
      echo -e "${RED}  Failed to record: $slug${NC}"
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${RED}ERROR${NC}"
      continue
    fi

    recorded_count=$((recorded_count + 1))

    local validation_file="$RECORDINGS_DIR/${slug}.validation.json"
    if [[ -f "$validation_file" ]]; then
      local overall
      overall=$(python3 -c "import json; print(json.load(open('$validation_file')).get('overall','unknown'))" 2>/dev/null || echo "unknown")
      local status_colour="$NC"
      case "$overall" in
        pass) status_colour="$GREEN" ;;
        warn) status_colour="$YELLOW" ;;
        fail) status_colour="$RED" ;;
      esac
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${status_colour}${overall^^}${NC}"
    else
      summary_lines="${summary_lines}\n  ${slug}$(printf '%*s' $((22 - ${#slug})) '')${GREEN}DONE${NC}"
    fi
  done

  # Stop server if we started it
  if [[ -n "$server_pid" ]]; then
    echo ""
    echo -e "${CYAN}Stopping production server...${NC}"
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    trap - EXIT
  fi

  echo ""
  echo -e "${PURPLE}=== rerecord summary ===${NC}"
  echo -e "$summary_lines"
  echo ""
  echo -e "  Recorded: ${recorded_count}/${total}"
  echo ""

  log_activity "prism" "rerecord_completed" "recorded=$recorded_count/$total"
}

run_schedule_all() {
  echo -e "${PURPLE}=== prism — schedule all validated recordings ===${NC}"
  echo ""
  log_activity "prism" "schedule_all_started" ""

  cd "$PRISM_DIR"

  # Find validated, unscheduled recordings
  local to_schedule=()
  for validation_file in "$RECORDINGS_DIR"/*.validation.json; do
    [[ -f "$validation_file" ]] || continue

    local slug
    slug=$(basename "$validation_file" .validation.json)

    # Skip if already scheduled
    if [[ -f "$RECORDINGS_DIR/${slug}.scheduled" ]]; then
      continue
    fi

    # Check validation status
    local overall
    overall=$(python3 -c "import json; print(json.load(open('$validation_file')).get('overall','unknown'))" 2>/dev/null || echo "unknown")

    if [[ "$overall" == "pass" ]] || [[ "$overall" == "warn" ]]; then
      to_schedule+=("$slug")
    fi
  done

  if [[ ${#to_schedule[@]} -eq 0 ]]; then
    echo -e "${GREEN}No unscheduled validated recordings found.${NC}"
    return 0
  fi

  local total=${#to_schedule[@]}
  echo -e "${CYAN}Found $total recordings to schedule${NC}"
  echo ""

  local scheduled_count=0
  local post_index=0

  for slug in "${to_schedule[@]}"; do
    echo -e "${CYAN}Scheduling: $slug${NC}"

    # Get component details from registry
    local component_info
    component_info=$(cd "$PRISM_DIR" && npx tsx -e "
      import { registry } from './app/lib/registry';
      const comp = registry.find(r => r.slug === '$slug');
      if (comp) {
        console.log(JSON.stringify({
          slug: comp.slug,
          title: comp.title,
          description: comp.description,
          tags: comp.tags || []
        }));
      } else {
        console.log('null');
      }
    " 2>/dev/null)

    if [[ "$component_info" == "null" ]] || [[ -z "$component_info" ]]; then
      echo -e "${YELLOW}  Component not found in registry: $slug — skipping${NC}"
      continue
    fi

    local title description
    title=$(echo "$component_info" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])" 2>/dev/null)
    description=$(echo "$component_info" | python3 -c "import sys,json; print(json.load(sys.stdin)['description'])" 2>/dev/null)

    # Create builder-result JSON for the publisher agent
    local tweet_caption
    tweet_caption=$(echo "$description" | head -c 200)

    python3 -c "
import json
result = {
    'slug': '$slug',
    'title': '$title',
    'description': $(echo "$description" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
    'tweet_caption': $(echo "$tweet_caption" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
    'schedule_offset_hours': $((post_index * 4))
}
with open('$QUEUE_DIR/builder-result.json', 'w') as f:
    json.dump(result, f, indent=2)
" 2>/dev/null

    # Set the video path
    local video_path="$RECORDINGS_DIR/${slug}.mp4"
    if [[ ! -f "$video_path" ]]; then
      echo -e "${YELLOW}  No video file for $slug — skipping${NC}"
      continue
    fi
    echo "$video_path" > "$QUEUE_DIR/current-video.txt"

    # Run publisher
    if run_publish; then
      touch "$RECORDINGS_DIR/${slug}.scheduled"
      scheduled_count=$((scheduled_count + 1))
      echo -e "${GREEN}  Scheduled: $slug${NC}"
    else
      echo -e "${RED}  Failed to schedule: $slug${NC}"
    fi

    post_index=$((post_index + 1))
    echo ""
  done

  echo -e "${PURPLE}=== schedule-all summary ===${NC}"
  echo -e "  Scheduled: ${scheduled_count}/${total} posts"
  echo ""

  log_activity "prism" "schedule_all_completed" "scheduled=$scheduled_count/$total"
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
  record-all)
    run_record_all
    ;;
  schedule-all)
    run_schedule_all
    ;;
  rerecord)
    shift
    run_rerecord "$@"
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
    echo "  ./orchestrator.sh record-all        Record all unrecorded components"
    echo "  ./orchestrator.sh rerecord <slugs>  Re-record specific components"
    echo "  ./orchestrator.sh schedule-all      Schedule all validated recordings to X"
    echo "  ./orchestrator.sh publish           Post to X via Spellcast"
    echo "  ./orchestrator.sh run <agent>       Run single agent"
    echo "  ./orchestrator.sh status            Show pipeline status"
    echo ""
    echo "Agents: scout, curator, builder, publisher"
    ;;
esac
