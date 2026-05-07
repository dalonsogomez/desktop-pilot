# Usage

## Backend selector

Desktop Pilot supports two AI backends, selectable via `~/.config/desktop-pilot/config.yaml`:

| `backend` value | Description |
|---|---|
| `anthropic` (default) | Uses Anthropic's cloud API (claude-sonnet-4-6). Requires API key in Keychain. |
| `ui-tars` | Uses UI-TARS-1.5-7B running locally via Ollama. No API key required. Requires `ollama pull 0000/ui-tars-1.5-7b`. |

Example config to switch to local UI-TARS:
```yaml
backend: ui-tars
ollamaUrl: "http://localhost:11434"
ollamaModel: "0000/ui-tars-1.5-7b"
displayWidth: 1920
displayHeight: 1080
```

See `docs/INSTALL.md` for full UI-TARS setup instructions.

## Tool families

Desktop Pilot exposes three tool families to the Anthropic model:

- **AppleScript** (`exec_applescript`) — scripting for Finder, Safari, Mail, Notes, Calendar, etc.
- **Shell** (`exec_shell`) — filesystem, git, npm, python, and any CLI tool.
- **Computer** (`computer`) — native GUI control via `computer_use_20250124`: screenshot, click, drag, type, key, scroll, cursor_position.

The agent prefers AppleScript over Shell over Computer. Computer use always takes a screenshot first to ground its actions in the current screen state.

## From Claude Code

After install, copy the skill into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills
cp -r skill/desktop-pilot ~/.claude/skills/
```

Then in Claude Code:

```
/desktop-pilot abre Figma y exporta el frame "Hero" como PNG a ~/Desktop
/dp lista los 10 archivos más grandes en ~/Downloads
/dp crea un evento en Calendar mañana a las 10:00 con título "Standup"
```

## Direct HTTP (no Claude Code)

```bash
# Submit task
curl -X POST http://localhost:9991/task \
  -H "Content-Type: application/json" \
  -d '{"prompt":"open Safari and search for cats"}'

# Poll status
curl http://localhost:9991/status/<id>

# Get transcript
curl http://localhost:9991/transcript/<id>

# Abort
curl -X POST http://localhost:9991/abort/<id>
```

## Panic key

Press **Esc three times rapidly** (within 800 ms) to abort the current session.

## Sessions

All sessions are stored in:

```
~/Library/Application Support/DesktopPilot/sessions/<uuid>/
├── metadata.json
├── transcript.jsonl
├── screenshots/NNN-action.png
├── session.mp4         # video, kept 30 days
└── timeline.json       # frame ↔ action sync
```

Video is **not** copied to your Obsidian wiki by default. To archive a session
fully (with video and all screenshots embedded) use:

```bash
desktop-pilot archive <session-id> --full
```
