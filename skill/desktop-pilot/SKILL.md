---
name: desktop-pilot
description: Use when the user asks to automate something on their Mac — clicking, dragging, opening apps, executing shell, AppleScript, batch file ops, RPA. Triggers on phrases like "abre X y haz Y", "automatiza X en Mac", "hazme un click en", "ejecuta este script", "drag X a Y", "/desktop-pilot", "/dp". Dispatches to the local desktop-pilot-bridge sidecar at localhost:9991 and streams progress back.
---

# desktop-pilot

Dispatch a natural-language task to the local `desktop-pilot-bridge` sidecar,
which controls the user's macOS via mouse, keyboard, drag, shell and AppleScript.

## Usage

```
/desktop-pilot <natural language task>
```

Aliases: `/dp`

## Examples

- `/desktop-pilot abre Figma y exporta el frame "Hero" como PNG a ~/Desktop`
- `/dp lista los 10 archivos más grandes en ~/Downloads y mételos en una nota Obsidian`
- `/dp crea un evento en Calendar mañana a las 10:00 con título "Standup"`

## Implementation

This skill calls `./dispatch.sh "$ARGS"` which:

1. POSTs the prompt to `http://localhost:9991/task`.
2. Polls `/status/:id` every 1s for live progress.
3. On completion, fetches `/transcript/:id` and renders the summary.
4. Invokes the user's `guardar` skill to archive the session as
   `wiki/sesiones-desktop-pilot/YYYY-MM-DD-<slug>.md`.

## Prerequisites

- desktop-pilot-bridge running (via launchd; see `scripts/launchd/`).
- macOS Accessibility, Screen Recording, Input Monitoring, Automation permissions granted.
- Anthropic API key in macOS Keychain (`security find-generic-password -s ai.desktop-pilot.anthropic`).
