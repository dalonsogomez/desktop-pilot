#!/usr/bin/env bash
set -uo pipefail

LOG="$HOME/Library/Logs/UI-TARS"
mkdir -p "$LOG"
DATE=$(date +%Y-%m-%d)
LOGFILE="$LOG/smoke-test-$DATE.log"
echo "Smoke test run $DATE" > "$LOGFILE"

PASS=0
FAIL=0
SKIPPED=0

note() {
  local result="$1"; local name="$2"; shift 2
  echo "[$result] $name $*" | tee -a "$LOGFILE"
  case "$result" in
    PASS) PASS=$((PASS+1)) ;;
    FAIL) FAIL=$((FAIL+1)) ;;
    SKIP) SKIPPED=$((SKIPPED+1)) ;;
  esac
}

# 11. exec_shell: positive
out=$(curl -fsS -X POST "http://localhost:9991/task" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"run shell: ls ~ | wc -l"}' 2>/dev/null || echo "FAIL")
if [[ "$out" == *"id"* ]]; then
  note PASS "11a-exec-shell-positive"
else
  note FAIL "11a-exec-shell-positive" "$out"
fi

# 11b. exec_shell: denied (rm -rf /)
note SKIP "11b-exec-shell-denied" "requires transcript inspection"

# 12a. exec_applescript: positive
note SKIP "12a-exec-applescript-positive" "requires transcript inspection"

# 13. video file generation
SESSION_DIR=$(ls -td "$HOME/Library/Application Support/DesktopPilot/sessions"/*/ 2>/dev/null | head -n1)
if [ -n "$SESSION_DIR" ] && [ -f "$SESSION_DIR/session.mp4" ]; then
  if ffprobe -v error "$SESSION_DIR/session.mp4" >/dev/null 2>&1; then
    note PASS "13-video-valid-mp4"
  else
    note FAIL "13-video-valid-mp4" "ffprobe rejected"
  fi
else
  note SKIP "13-video-valid-mp4" "no session.mp4 found yet"
fi

# GUI tests 1-10 require an actual agent run. We don't replicate them here;
# they're driven by the agent + a fixture prompt and verified via the
# transcript/screenshot output. See test:agent in package.json (future).
note SKIP "1-10-gui-cases" "drive via agent fixture suite"

echo ""
echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIPPED" | tee -a "$LOGFILE"
[ "$FAIL" -eq 0 ]
