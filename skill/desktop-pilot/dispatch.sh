#!/usr/bin/env bash
set -euo pipefail

PROMPT="$*"
if [ -z "$PROMPT" ]; then
  echo "Usage: $0 <prompt>" >&2
  exit 1
fi

API="http://localhost:9991"

# Health check
if ! curl -fsS "$API/status/00000000-0000-0000-0000-000000000000" -o /dev/null --max-time 2; then
  # 404 is OK (means server is up); only fail on connection error
  if ! curl -sS "$API/status/00000000-0000-0000-0000-000000000000" -o /dev/null --max-time 2; then
    echo "ERROR: desktop-pilot-bridge not reachable at $API" >&2
    echo "Start it with: launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/ai.desktop-pilot.bridge.plist" >&2
    exit 2
  fi
fi

# Submit task
ID=$(curl -fsS -X POST "$API/task" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" '{prompt:$p}')" | jq -r .id)

echo "Task submitted: $ID"

# Poll status
STATUS="queued"
while true; do
  STATUS=$(curl -fsS "$API/status/$ID" | jq -r '.status // "queued"')
  case "$STATUS" in
    completed|failed|aborted) break ;;
    *) sleep 1 ;;
  esac
done

# Fetch transcript
curl -fsS "$API/transcript/$ID" | jq .

echo "Task $ID finished with status: $STATUS"
